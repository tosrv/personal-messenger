package message

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

// maxRequestBytes bounds the JSON body: 4000 characters can be up to 16 KB of UTF-8.
const maxRequestBytes = 32 << 10

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Register mounts routes that require a session; rg must use auth.RequireSession.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/conversations/:id/messages", h.list)
	rg.POST("/conversations/:id/messages", h.send)
}

func (h *Handler) list(c *gin.Context) {
	convID, ok := httpx.PathID(c, "id")
	if !ok {
		return
	}
	before, ok1 := httpx.QueryInt64(c, "before")
	after, ok2 := httpx.QueryInt64(c, "after")
	limit, ok3 := httpx.QueryInt64(c, "limit")
	if !ok1 || !ok2 || !ok3 {
		httpx.Error(c, apperr.ErrInvalidInput)
		return
	}
	viewerID, _ := httpx.UserID(c)
	page, err := h.svc.List(c.Request.Context(), ListInput{
		ConversationID: convID, ViewerID: viewerID, Before: before, After: after, Limit: int(limit),
	})
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}

func (h *Handler) send(c *gin.Context) {
	convID, ok := httpx.PathID(c, "id")
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBytes)
	var body struct {
		ClientMessageID string `json:"client_message_id"`
		Body            string `json:"body"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, apperr.ErrInvalidInput)
		return
	}
	senderID, _ := httpx.UserID(c)
	m, created, err := h.svc.Send(c.Request.Context(), SendInput{
		ConversationID: convID, SenderID: senderID, ClientMessageID: body.ClientMessageID, Body: body.Body,
	})
	if err != nil {
		httpx.Error(c, err)
		return
	}
	status := http.StatusCreated
	if !created {
		status = http.StatusOK // idempotent retry
	}
	c.JSON(status, m)
}
