// Package middleware contains shared Gin middleware.
package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

const requestIDHeader = "X-Request-ID"

// RequestID gives every request an ID, returned in X-Request-ID and logged,
// so a user-reported error can be matched to a log line.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		id := hex.EncodeToString(b)
		c.Set(requestIDHeader, id)
		c.Header(requestIDHeader, id)
		c.Next()
	}
}

// RequestLogger logs method, route, status and latency. It never logs
// headers, cookies, query strings or bodies, so session IDs, tokens and
// search terms stay out of logs (PRD §8).
func RequestLogger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		status := c.Writer.Status()
		attrs := []any{
			"method", c.Request.Method,
			"route", c.FullPath(),
			"status", status,
			"latency_ms", time.Since(start).Milliseconds(),
			"request_id", c.GetString(requestIDHeader),
		}
		if id, ok := httpx.UserID(c); ok {
			attrs = append(attrs, "user_id", id)
		}
		level := slog.LevelInfo
		if status >= http.StatusInternalServerError {
			level = slog.LevelError
		}
		logger.Log(c.Request.Context(), level, "request", attrs...)
	}
}

// CORS allows credentialed requests only from the configured origins.
func CORS(allowed []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && slices.Contains(allowed, origin) {
			h := c.Writer.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token")
			h.Add("Vary", "Origin")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
