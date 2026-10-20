package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestServeSPA(t *testing.T) {
	dir := t.TempDir()
	must := func(err error) {
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o644))
	must(os.MkdirAll(filepath.Join(dir, "assets"), 0o755))
	must(os.WriteFile(filepath.Join(dir, "assets", "index-abc.js"), []byte("console.log(1)"), 0o644))
	must(os.WriteFile(filepath.Join(dir, "favicon.svg"), []byte("<svg/>"), 0o644))
	// A secret next to the web root must never be reachable.
	must(os.WriteFile(filepath.Join(filepath.Dir(dir), "secret.txt"), []byte("top secret"), 0o644))

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/v1/health", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	r.NoRoute(serveSPA(dir))

	cases := []struct {
		method, path   string
		status         int
		bodyContains   string
		cacheControl   string
		notBodyContain string
	}{
		{"GET", "/", 200, "app", "no-cache", ""},
		{"GET", "/u/tomy", 200, "app", "no-cache", ""},
		{"GET", "/assets/index-abc.js", 200, "console.log", "public, max-age=31536000, immutable", ""},
		{"GET", "/favicon.svg", 200, "<svg/>", "", ""},
		{"GET", "/api/v1/health", 200, "ok", "", ""},
		{"GET", "/api/v1/nope", 404, `"not found"`, "", "app"},
		{"POST", "/u/tomy", 405, "method not allowed", "", ""},
		{"GET", "/../secret.txt", 400, "invalid URL path", "", "top secret"}, // ServeFile also rejects ".."
		{"GET", "/assets/../../secret.txt", 400, "invalid URL path", "", "top secret"},
	}
	for _, tc := range cases {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(tc.method, "/", nil)
		req.URL.Path = tc.path // bypass client-side cleaning to test traversal
		r.ServeHTTP(w, req)
		body := w.Body.String()
		if w.Code != tc.status || !strings.Contains(body, tc.bodyContains) {
			t.Errorf("%s %s: %d %q; want %d containing %q", tc.method, tc.path, w.Code, body, tc.status, tc.bodyContains)
		}
		if tc.notBodyContain != "" && strings.Contains(body, tc.notBodyContain) {
			t.Errorf("%s %s: body leaked %q", tc.method, tc.path, tc.notBodyContain)
		}
		if got := w.Header().Get("Cache-Control"); got != tc.cacheControl {
			t.Errorf("%s %s: Cache-Control %q, want %q", tc.method, tc.path, got, tc.cacheControl)
		}
	}
}
