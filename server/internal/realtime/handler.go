package realtime

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
	"time"

	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

const (
	pingInterval = 30 * time.Second
	writeTimeout = 10 * time.Second
	// Clients never send data frames; only control frames are expected.
	readLimit = 512
)

// SessionCheck reports whether the connection's session is still valid, so a
// sign-out elsewhere also ends open sockets. Returning false closes the socket.
type SessionCheck func(ctx context.Context, c *gin.Context) bool

type Handler struct {
	hub            *Hub
	originPatterns []string
	sessionValid   SessionCheck
	logger         *slog.Logger
}

// NewHandler accepts connections only from allowedOrigins (PRD §8: WebSocket
// origin validation). Each origin is reduced to its host for the check.
func NewHandler(hub *Hub, allowedOrigins []string, sessionValid SessionCheck, logger *slog.Logger) *Handler {
	var patterns []string
	for _, o := range allowedOrigins {
		if u, err := url.Parse(o); err == nil && u.Host != "" {
			patterns = append(patterns, u.Host)
		}
	}
	return &Handler{hub: hub, originPatterns: patterns, sessionValid: sessionValid, logger: logger}
}

// Register mounts GET /ws; rg must use auth.RequireSession, which
// authenticates the upgrade request by its session cookie.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/ws", h.serve)
}

func (h *Handler) serve(c *gin.Context) {
	userID, _ := httpx.UserID(c)
	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{
		OriginPatterns: h.originPatterns,
	})
	if err != nil {
		return // Accept already wrote the error response (e.g. 403 bad origin)
	}
	conn.SetReadLimit(readLimit)

	cl := h.hub.register(userID)
	defer h.hub.unregister(cl)

	// CloseRead answers pings/close frames and cancels ctx when the peer goes away.
	ctx := conn.CloseRead(c.Request.Context())
	status, reason := h.writeLoop(ctx, c, conn, cl)
	_ = conn.Close(status, reason)
}

func (h *Handler) writeLoop(ctx context.Context, c *gin.Context, conn *websocket.Conn, cl *client) (websocket.StatusCode, string) {
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()

	if err := write(ctx, conn, []byte(`{"type":"ready"}`)); err != nil {
		return websocket.StatusInternalError, ""
	}
	for {
		select {
		case <-ctx.Done():
			return websocket.StatusNormalClosure, ""
		case <-cl.kick:
			// Too slow or server shutting down; the client reconnects and resyncs.
			return websocket.StatusTryAgainLater, "reconnect"
		case payload := <-cl.send:
			if err := write(ctx, conn, payload); err != nil {
				return websocket.StatusInternalError, ""
			}
		case <-ticker.C:
			if !h.sessionValid(ctx, c) {
				return websocket.StatusPolicyViolation, "session ended"
			}
			pingCtx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := conn.Ping(pingCtx)
			cancel()
			if err != nil {
				if !errors.Is(err, context.Canceled) {
					h.logger.Debug("realtime: ping failed", "err", err)
				}
				return websocket.StatusGoingAway, ""
			}
		}
	}
}

func write(ctx context.Context, conn *websocket.Conn, payload []byte) error {
	ctx, cancel := context.WithTimeout(ctx, writeTimeout)
	defer cancel()
	return conn.Write(ctx, websocket.MessageText, payload)
}
