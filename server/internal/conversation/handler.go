package conversation

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Register mounts routes that require a session; rg must use auth.RequireSession.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/conversations", h.list)
	rg.POST("/conversations", h.start)
	rg.GET("/conversations/:id", h.get)
	rg.POST("/conversations/:id/read", h.markRead)
	rg.DELETE("/conversations/:id", h.deleteForMe)
}

func (h *Handler) list(c *gin.Context) {
	viewerID, _ := httpx.UserID(c)
	items, err := h.svc.List(c.Request.Context(), viewerID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversations": items})
}

func (h *Handler) start(c *gin.Context) {
	var body struct {
		Username string `json:"username"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Username == "" {
		httpx.Error(c, apperr.ErrInvalidInput)
		return
	}
	viewerID, _ := httpx.UserID(c)
	s, err := h.svc.StartDirect(c.Request.Context(), viewerID, body.Username)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) get(c *gin.Context) {
	id, ok := httpx.PathID(c, "id")
	if !ok {
		return
	}
	viewerID, _ := httpx.UserID(c)
	s, err := h.svc.Get(c.Request.Context(), viewerID, id)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) markRead(c *gin.Context) {
	id, ok := httpx.PathID(c, "id")
	if !ok {
		return
	}
	var body struct {
		MessageID int64 `json:"message_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.MessageID <= 0 {
		httpx.Error(c, apperr.ErrInvalidInput)
		return
	}
	viewerID, _ := httpx.UserID(c)
	if err := h.svc.MarkRead(c.Request.Context(), viewerID, id, body.MessageID); err != nil {
		httpx.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// deleteForMe hides the chat and its history from the viewer only.
func (h *Handler) deleteForMe(c *gin.Context) {
	id, ok := httpx.PathID(c, "id")
	if !ok {
		return
	}
	viewerID, _ := httpx.UserID(c)
	if err := h.svc.DeleteForMe(c.Request.Context(), viewerID, id); err != nil {
		httpx.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
