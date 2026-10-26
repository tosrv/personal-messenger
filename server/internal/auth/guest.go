package auth

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

// GuestCreator makes guest accounts (implemented by user.Service).
type GuestCreator interface {
	CreateGuest(ctx context.Context, displayName string) (userID int64, err error)
}

// GuestHandler signs visitors in as guests (ADR 0008): no Google account,
// just a display name. The session works exactly like a Google one; what a
// guest may do is restricted elsewhere (they can only chat with the owner).
type GuestHandler struct {
	sessions      *SessionStore
	users         GuestCreator
	secureCookies bool
	logger        *slog.Logger
}

func NewGuestHandler(sessions *SessionStore, users GuestCreator, secureCookies bool, logger *slog.Logger) *GuestHandler {
	return &GuestHandler{sessions: sessions, users: users, secureCookies: secureCookies, logger: logger}
}

func (h *GuestHandler) Register(rg *gin.RouterGroup) {
	rg.POST("/auth/guest", h.create)
}

// create accepts {"display_name": "..."} and starts a guest session.
func (h *GuestHandler) create(c *gin.Context) {
	var body struct {
		DisplayName string `json:"display_name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, apperr.ErrInvalidInput)
		return
	}
	ctx := c.Request.Context()
	userID, err := h.users.CreateGuest(ctx, body.DisplayName)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	token, expires, err := h.sessions.Create(ctx, userID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	writeCookie(c, SessionCookie, token, "/", int(time.Until(expires).Seconds()), h.secureCookies)
	h.logger.Info("guest signed in", "user_id", userID)
	c.Status(http.StatusCreated)
}
