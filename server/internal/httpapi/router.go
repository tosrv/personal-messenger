// Package httpapi wires HTTP routes, middleware, and handlers.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tosrv/personal-messenger/server/internal/auth"
	"github.com/tosrv/personal-messenger/server/internal/config"
	"github.com/tosrv/personal-messenger/server/internal/conversation"
	"github.com/tosrv/personal-messenger/server/internal/httpx"
	"github.com/tosrv/personal-messenger/server/internal/message"
	"github.com/tosrv/personal-messenger/server/internal/middleware"
	"github.com/tosrv/personal-messenger/server/internal/realtime"
	"github.com/tosrv/personal-messenger/server/internal/user"
)

// Deps are the services the router needs, built once in main.
type Deps struct {
	Pool          *pgxpool.Pool
	Logger        *slog.Logger
	Sessions      *auth.SessionStore
	Auth          *auth.Handler // nil when Google OAuth is not configured
	Users         *user.Service
	Conversations *conversation.Service
	Messages      *message.Service
	Hub           *realtime.Hub
}

// rateRules limit abuse-prone endpoints (PRD §8). Signed-in routes count per
// user; sign-in routes count per client IP.
var rateRules = []middleware.RateRule{
	{Route: "GET /api/v1/auth/google", Limit: middleware.Limit{PerMinute: 10, Burst: 10}},
	{Route: "GET /api/v1/auth/callback", Limit: middleware.Limit{PerMinute: 10, Burst: 10}},
	{Route: "GET /api/v1/users/search", Limit: middleware.Limit{PerMinute: 60, Burst: 20}},
	{Route: "PATCH /api/v1/me", Limit: middleware.Limit{PerMinute: 10, Burst: 5}},
	{Route: "POST /api/v1/conversations", Limit: middleware.Limit{PerMinute: 20, Burst: 10}},
	{Route: "POST /api/v1/conversations/:id/messages", Limit: middleware.Limit{PerMinute: 30, Burst: 20}},
}

func NewRouter(cfg config.Config, d Deps) *gin.Engine {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	// Only the reverse proxy may set X-Forwarded-For; otherwise anyone could
	// spoof their IP and dodge per-IP rate limits.
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		d.Logger.Error("invalid TRUSTED_PROXIES; trusting none", "err", err)
		_ = r.SetTrustedProxies(nil)
	}
	limit := middleware.RateLimit(rateRules)

	r.Use(
		gin.Recovery(),
		middleware.RequestID(),
		middleware.RequestLogger(d.Logger),
		middleware.CORS(cfg.AllowedOrigins),
		middleware.SameOrigin(cfg.AllowedOrigins),
	)

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/readyz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := d.Pool.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "database": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "database": "up"})
	})

	api := r.Group("/api/v1")
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	if d.Auth != nil {
		d.Auth.Register(api.Group("", limit))
	} else {
		api.GET("/auth/google", func(c *gin.Context) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "google sign-in is not configured"})
		})
	}

	// limit runs after RequireSession so it can count per user.
	private := api.Group("", auth.RequireSession(d.Sessions), limit)
	user.NewHandler(d.Users).Register(private)
	conversation.NewHandler(d.Conversations).Register(private)
	message.NewHandler(d.Messages).Register(private)

	// Real-time events (server → client only, see docs/realtime.md).
	ws := r.Group("", auth.RequireSession(d.Sessions))
	realtime.NewHandler(d.Hub, cfg.AllowedOrigins, sessionStillValid(d.Sessions), d.Logger).Register(ws)

	// Production image: the same server also serves the frontend (one origin, ADR 0002).
	if cfg.StaticDir != "" {
		r.NoRoute(serveSPA(cfg.StaticDir))
	}

	return r
}

// sessionStillValid lets long-lived sockets notice a sign-out or expiry.
func sessionStillValid(sessions *auth.SessionStore) realtime.SessionCheck {
	return func(ctx context.Context, c *gin.Context) bool {
		token, err := c.Cookie(auth.SessionCookie)
		if err != nil {
			return false
		}
		id, err := sessions.UserID(ctx, token)
		want, _ := httpx.UserID(c)
		return err == nil && id == want
	}
}
