package middleware

import (
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
)

// SameOrigin blocks cross-site state-changing requests (CSRF, PRD §8).
// Browsers always send Origin on POST/PUT/PATCH/DELETE, so a request whose
// Origin is missing or not in the allowlist is rejected. Safe methods pass.
func SameOrigin(allowed []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}
		if !slices.Contains(allowed, c.GetHeader("Origin")) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "cross-origin request blocked"})
			return
		}
		c.Next()
	}
}
