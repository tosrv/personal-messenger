package auth

import (
	"errors"
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

// RequireSession rejects requests without a valid session cookie and puts
// the user ID on the context for handlers (read it with httpx.UserID).
func RequireSession(sessions *SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(SessionCookie)
		if err != nil || token == "" {
			httpx.Error(c, apperr.ErrUnauthorized)
			return
		}
		userID, err := sessions.UserID(c.Request.Context(), token)
		if err != nil {
			if !errors.Is(err, apperr.ErrUnauthorized) {
				slog.ErrorContext(c.Request.Context(), "session lookup", "err", err)
			}
			httpx.Error(c, err)
			return
		}
		httpx.SetUserID(c, userID)
		c.Next()
	}
}
