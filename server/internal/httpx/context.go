package httpx

import "github.com/gin-gonic/gin"

const userIDKey = "httpx.userID"

// SetUserID stores the authenticated user's ID on the request context.
func SetUserID(c *gin.Context, id int64) { c.Set(userIDKey, id) }

// UserID returns the authenticated user's ID, if the auth middleware set one.
func UserID(c *gin.Context) (int64, bool) {
	v, ok := c.Get(userIDKey)
	if !ok {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok
}
