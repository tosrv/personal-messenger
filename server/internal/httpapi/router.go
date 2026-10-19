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
	"github.com/tosrv/personal-messenger/server/internal/middleware"
	"github.com/tosrv/personal-messenger/server/internal/user"
)

// Deps are the services the router needs, built once in main.
type Deps struct {
	Pool     *pgxpool.Pool
	Logger   *slog.Logger
	Sessions *auth.SessionStore
	Auth     *auth.Handler // nil when Google OAuth is not configured
	Users    *user.Service
}

func NewRouter(cfg config.Config, d Deps) *gin.Engine {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(
		gin.Recovery(),
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
		d.Auth.Register(api)
	} else {
		api.GET("/auth/google", func(c *gin.Context) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "google sign-in is not configured"})
		})
	}

	private := api.Group("", auth.RequireSession(d.Sessions))
	user.NewHandler(d.Users).Register(private)
	// Milestone 3: /conversations, /conversations/:id/messages
	// Milestone 4: /ws

	return r
}
