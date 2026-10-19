package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSameOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SameOrigin([]string{"https://chat.example.com"}))
	r.Any("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	cases := []struct {
		method, origin string
		want           int
	}{
		{http.MethodGet, "", http.StatusOK},
		{http.MethodGet, "https://evil.com", http.StatusOK},
		{http.MethodPost, "https://chat.example.com", http.StatusOK},
		{http.MethodPost, "https://evil.com", http.StatusForbidden},
		{http.MethodPost, "", http.StatusForbidden},
		{http.MethodDelete, "null", http.StatusForbidden},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, "/x", nil)
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Errorf("%s origin=%q: got %d, want %d", tc.method, tc.origin, w.Code, tc.want)
		}
	}
}
