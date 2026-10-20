package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// serveSPA serves the built frontend from dir for every route the API does
// not handle. Existing files are served as-is (hashed /assets/* are cached
// for a year); any other path gets index.html so client-side routes such as
// /u/tomy work on reload. Unknown /api and /ws paths stay JSON 404s.
func serveSPA(dir string) gin.HandlerFunc {
	index := filepath.Join(dir, "index.html")
	return func(c *gin.Context) {
		p := c.Request.URL.Path
		if strings.HasPrefix(p, "/api/") || p == "/ws" {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "method not allowed"})
			return
		}

		// Clean against "/" first so ".." can never escape dir.
		file := filepath.Join(dir, filepath.FromSlash(filepath.ToSlash(filepath.Clean("/"+p))))
		if info, err := os.Stat(file); err == nil && !info.IsDir() {
			if strings.HasPrefix(p, "/assets/") {
				c.Header("Cache-Control", "public, max-age=31536000, immutable")
			}
			c.File(file)
			return
		}
		// index.html must always be revalidated so a deploy is picked up at once.
		c.Header("Cache-Control", "no-cache")
		c.File(index)
	}
}
