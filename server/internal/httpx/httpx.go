// Package httpx holds HTTP response helpers shared by feature handlers.
package httpx

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/rahmattomy/personal-messenger/server/internal/apperr"
)

// Error writes {"error": msg} with a status derived from the domain error.
// Unknown errors become 500 with a generic message; details go to the log only.
func Error(c *gin.Context, err error) {
	status, msg := http.StatusInternalServerError, "internal server error"
	switch {
	case errors.Is(err, apperr.ErrInvalidInput):
		status, msg = http.StatusBadRequest, err.Error()
	case errors.Is(err, apperr.ErrUnauthorized):
		status, msg = http.StatusUnauthorized, "unauthorized"
	case errors.Is(err, apperr.ErrForbidden):
		status, msg = http.StatusForbidden, "forbidden"
	case errors.Is(err, apperr.ErrNotFound):
		status, msg = http.StatusNotFound, "not found"
	case errors.Is(err, apperr.ErrConflict):
		status, msg = http.StatusConflict, err.Error()
	default:
		slog.ErrorContext(c.Request.Context(), "unhandled error", "route", c.FullPath(), "err", err)
	}
	c.AbortWithStatusJSON(status, gin.H{"error": msg})
}
