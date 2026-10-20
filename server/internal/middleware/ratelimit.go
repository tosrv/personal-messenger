package middleware

import (
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"

	"github.com/tosrv/personal-messenger/server/internal/httpx"
)

// Limit is a token bucket: Burst requests at once, refilled at PerMinute.
type Limit struct {
	PerMinute float64
	Burst     int
}

// RateRule limits one route ("METHOD /full/path", as registered in gin).
// Requests are counted per signed-in user, or per client IP before sign-in.
type RateRule struct {
	Route string
	Limit Limit
}

const idleTTL = 10 * time.Minute

type bucket struct {
	lim      *rate.Limiter
	lastSeen time.Time
}

type limiter struct {
	mu      sync.Mutex
	limit   Limit
	buckets map[string]*bucket
}

func (l *limiter) take(key string, now time.Time) (ok bool, retryAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	b := l.buckets[key]
	if b == nil {
		b = &bucket{lim: rate.NewLimiter(rate.Limit(l.limit.PerMinute/60), l.limit.Burst)}
		l.buckets[key] = b
	}
	b.lastSeen = now
	r := b.lim.ReserveN(now, 1)
	if d := r.DelayFrom(now); d > 0 {
		r.CancelAt(now) // don't consume a token for a rejected request
		return false, d
	}
	return true, 0
}

func (l *limiter) sweep(now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, b := range l.buckets {
		if now.Sub(b.lastSeen) > idleTTL {
			delete(l.buckets, k)
		}
	}
}

// RateLimit enforces per-route limits (PRD §8: sign-in, search, sending).
// State is in memory, which matches the single-instance design (ADR 0005).
// Rejected requests get 429 with a Retry-After header.
func RateLimit(rules []RateRule) gin.HandlerFunc {
	limiters := make(map[string]*limiter, len(rules))
	for _, r := range rules {
		limiters[r.Route] = &limiter{limit: r.Limit, buckets: make(map[string]*bucket)}
	}
	go func() {
		for now := range time.Tick(time.Minute) {
			for _, l := range limiters {
				l.sweep(now)
			}
		}
	}()

	return func(c *gin.Context) {
		l := limiters[c.Request.Method+" "+c.FullPath()]
		if l == nil {
			c.Next()
			return
		}
		key := "ip:" + c.ClientIP()
		if id, ok := httpx.UserID(c); ok {
			key = "user:" + strconv.FormatInt(id, 10)
		}
		if ok, wait := l.take(key, time.Now()); !ok {
			c.Header("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests, please slow down"})
			return
		}
		c.Next()
	}
}
