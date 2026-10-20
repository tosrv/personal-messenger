package httpx

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
)

// PathID parses a positive integer path parameter. On failure it writes a
// 404 (a malformed ID cannot exist) and returns false.
func PathID(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		Error(c, apperr.ErrNotFound)
		return 0, false
	}
	return id, true
}

// QueryInt64 parses an optional non-negative integer query parameter (0 if absent).
func QueryInt64(c *gin.Context, name string) (int64, bool) {
	raw := c.Query(name)
	if raw == "" {
		return 0, true
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v < 0 {
		return 0, false
	}
	return v, true
}
