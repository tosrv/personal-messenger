package user

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/rahmattomy/personal-messenger/server/internal/httpx"
)

// Handler adapts HTTP requests to the Service. No business rules live here.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/users/search", h.search)
	rg.GET("/users/:username", h.getProfile)
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
	// TODO(M2): take viewer ID from auth middleware and require a session.
	var viewerID int64
	users, err := h.svc.Search(c.Request.Context(), c.Query("q"), viewerID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}
