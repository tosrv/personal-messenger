// Package httpapi wires HTTP routes, middleware, and handlers.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rahmattomy/personal-messenger/server/internal/config"
	"github.com/rahmattomy/personal-messenger/server/internal/middleware"
	"github.com/rahmattomy/personal-messenger/server/internal/user"
)

func NewRouter(cfg config.Config, pool *pgxpool.Pool, logger *slog.Logger) *gin.Engine {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery(), middleware.RequestLogger(logger), middleware.CORS(cfg.AllowedOrigins))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/readyz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "database": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "database": "up"})
	})

	api := r.Group("/api/v1")
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	user.NewHandler(user.NewService(user.NewPostgresRepository(pool))).Register(api)

	// Milestone 2: /auth/google, /auth/callback, /auth/logout, /me
	// Milestone 3: /conversations, /conversations/:id/messages
	// Milestone 4: /ws

	return r
}
