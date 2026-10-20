package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

func TestLimiter_BurstThenRefill(t *testing.T) {
	l := &limiter{limit: Limit{PerMinute: 60, Burst: 2}, buckets: map[string]*bucket{}}
	now := time.Now()

	if ok, _ := l.take("a", now); !ok {
		t.Fatal("1st request rejected")
	}
	if ok, _ := l.take("a", now); !ok {
		t.Fatal("2nd request rejected")
	}
	ok, wait := l.take("a", now)
	if ok || wait <= 0 || wait > time.Second {
		t.Fatalf("3rd request: ok=%v wait=%v; want rejected with ~1s wait", ok, wait)
	}
	if ok, _ := l.take("b", now); !ok {
		t.Error("other key should have its own bucket")
	}
	// Rejections must not consume tokens: one second later exactly one is back.
	if ok, _ := l.take("a", now.Add(time.Second)); !ok {
		t.Error("token not refilled after 1s")
	}
}

func TestLimiter_SweepsIdleBuckets(t *testing.T) {
	l := &limiter{limit: Limit{PerMinute: 60, Burst: 1}, buckets: map[string]*bucket{}}
	now := time.Now()
	l.take("a", now)
	l.sweep(now.Add(idleTTL + time.Second))
	if len(l.buckets) != 0 {
		t.Errorf("buckets = %d, want 0", len(l.buckets))
	}
}

func TestRateLimit_PerRouteAndPerUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if u := c.GetHeader("X-Test-User"); u == "1" {
			httpx.SetUserID(c, 1)
		} else if u == "2" {
			httpx.SetUserID(c, 2)
		}
	})
	r.Use(RateLimit([]RateRule{{Route: "POST /limited/:id", Limit: Limit{PerMinute: 1, Burst: 1}}}))
	r.POST("/limited/:id", func(c *gin.Context) { c.Status(http.StatusOK) })
	r.GET("/free", func(c *gin.Context) { c.Status(http.StatusOK) })

	do := func(method, path, user string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("X-Test-User", user)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	if w := do("POST", "/limited/1", "1"); w.Code != http.StatusOK {
		t.Fatalf("first: %d", w.Code)
	}
	w := do("POST", "/limited/2", "1") // same route pattern, same user
	if w.Code != http.StatusTooManyRequests || w.Header().Get("Retry-After") == "" {
		t.Errorf("second: %d retry-after=%q; want 429 with Retry-After", w.Code, w.Header().Get("Retry-After"))
	}
	if w := do("POST", "/limited/1", "2"); w.Code != http.StatusOK {
		t.Errorf("other user: %d", w.Code)
	}
	for range 5 {
		if w := do("GET", "/free", "1"); w.Code != http.StatusOK {
			t.Fatalf("unlimited route: %d", w.Code)
		}
	}
}
