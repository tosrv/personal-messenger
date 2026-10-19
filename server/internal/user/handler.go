package user

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

// Handler adapts HTTP requests to the Service. No business rules live here.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Register mounts routes that require a session; rg must use auth.RequireSession.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/me", h.me)
	rg.PATCH("/me/username", h.changeUsername)
	rg.GET("/users/search", h.search)
	rg.GET("/users/:username", h.getProfile)
}

func (h *Handler) me(c *gin.Context) {
	userID, _ := httpx.UserID(c)
	me, err := h.svc.Me(c.Request.Context(), userID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, me)
}

func (h *Handler) changeUsername(c *gin.Context) {
	var body struct {
		Username string `json:"username"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, apperr.ErrInvalidInput)
		return
	}
	userID, _ := httpx.UserID(c)
	me, err := h.svc.ChangeUsername(c.Request.Context(), userID, body.Username)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, me)
}

func (h *Handler) getProfile(c *gin.Context) {
	p, err := h.svc.GetProfile(c.Request.Context(), c.Param("username"))
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) search(c *gin.Context) {
	viewerID, _ := httpx.UserID(c)
	users, err := h.svc.Search(c.Request.Context(), c.Query("q"), viewerID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}
