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
	// Client frames are tiny ("typing" only, ADR 0009); anything larger
	// closes the connection.
	readLimit = 512
)

// SessionCheck reports whether the connection's session is still valid, so a
// sign-out elsewhere also ends open sockets. Returning false closes the socket.
type SessionCheck func(ctx context.Context, c *gin.Context) bool

type Handler struct {
	hub            *Hub
	members        MemberLookup
	presence       PresenceTracker
	originPatterns []string
	sessionValid   SessionCheck
	logger         *slog.Logger
}

// NewHandler accepts connections only from allowedOrigins (PRD §8: WebSocket
// origin validation). Each origin is reduced to its host for the check.
// members authorizes client frames such as "typing"; presence (optional)
// announces when a user comes online or goes offline.
func NewHandler(hub *Hub, members MemberLookup, presence PresenceTracker, allowedOrigins []string, sessionValid SessionCheck, logger *slog.Logger) *Handler {
	var patterns []string
	for _, o := range allowedOrigins {
		if u, err := url.Parse(o); err == nil && u.Host != "" {
			patterns = append(patterns, u.Host)
		}
	}
	return &Handler{hub: hub, members: members, presence: presence, originPatterns: patterns, sessionValid: sessionValid, logger: logger}
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

	cl, first := h.hub.register(userID)
	if first && h.presence != nil {
		h.presence.Online(c.Request.Context(), userID)
	}
	defer func() {
		if h.hub.unregister(cl) && h.presence != nil {
			// The request context may already be cancelled (shutdown or
			// disconnect); last seen must still be stored.
			ctx, cancel := context.WithTimeout(context.WithoutCancel(c.Request.Context()), writeTimeout)
			defer cancel()
			h.presence.Offline(ctx, userID)
		}
	}()

	// The read loop answers pings/close frames, handles client frames, and
	// cancels ctx when the peer goes away or breaks the rules.
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()
	violated := make(chan struct{})
	go func() {
		defer cancel()
		if !h.readLoop(ctx, conn, newInbound(userID, h.members, h.hub)) {
			close(violated)
		}
	}()
	status, reason := h.writeLoop(ctx, c, conn, cl)
	select {
	case <-violated:
		status, reason = websocket.StatusPolicyViolation, "too many invalid frames"
	default:
	}
	_ = conn.Close(status, reason)
}

// readLoop reads client frames until the connection ends. It returns false
// if the client sent too many rejected frames.
func (h *Handler) readLoop(ctx context.Context, conn *websocket.Conn, in *inbound) bool {
	for {
		typ, data, err := conn.Read(ctx)
		if err != nil {
			return true
		}
		if typ != websocket.MessageText {
			data = nil // binary frames are never valid
		}
		if !in.handle(ctx, data, time.Now()) {
			h.logger.Warn("realtime: closing connection after too many rejected frames", "user_id", in.userID)
			return false
		}
	}
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
