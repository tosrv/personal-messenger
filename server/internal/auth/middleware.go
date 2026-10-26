package auth

import (
	"errors"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

// RequireSession rejects requests without a valid session cookie and puts
// the user ID on the context for handlers (read it with httpx.UserID).
// Sessions in use are extended (sliding expiry), and the cookie with them.
func RequireSession(sessions *SessionStore, secureCookies bool) gin.HandlerFunc {
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
		// At most one extra write per session per half-TTL; failure only logs.
		if expires, err := sessions.ExtendIfAging(c.Request.Context(), token); err != nil {
			slog.ErrorContext(c.Request.Context(), "extend session", "err", err)
		} else if !expires.IsZero() {
			writeCookie(c, SessionCookie, token, "/", int(time.Until(expires).Seconds()), secureCookies)
		}
		httpx.SetUserID(c, userID)
		c.Next()
	}
}
