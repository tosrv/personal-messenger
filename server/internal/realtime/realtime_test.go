package realtime

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"

	"github.com/tosrv/personal-messenger/server/internal/httpx"
	"github.com/tosrv/personal-messenger/server/internal/message"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

type staticMembers map[int64][]int64

func (m staticMembers) MemberIDs(_ context.Context, conversationID int64) ([]int64, error) {
	return m[conversationID], nil
}

// newServer serves /ws with a fake auth step: the user ID comes from ?user=.
func newServer(t *testing.T, hub *Hub) *httptest.Server {
	return newServerWithMembers(t, hub, staticMembers{})
}

func newServerWithMembers(t *testing.T, hub *Hub, members MemberLookup) *httptest.Server {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Query("user"), 10, 64)
		httpx.SetUserID(c, id)
	})
	alwaysValid := func(context.Context, *gin.Context) bool { return true }
	NewHandler(hub, members, []string{"http://allowed.test"}, alwaysValid, quiet).Register(g)
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

func dial(t *testing.T, srv *httptest.Server, user int, origin string) *websocket.Conn {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws?user=" + strconv.Itoa(user)
	conn, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {origin}}})
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	if ev := read(t, conn); ev.Type != "ready" {
		t.Fatalf("first event = %q, want ready", ev.Type)
	}
	return conn
}

func read(t *testing.T, conn *websocket.Conn) Event {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, data, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	var ev Event
	if err := json.Unmarshal(data, &ev); err != nil {
		t.Fatalf("decode %s: %v", data, err)
	}
	return ev
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("condition not met in time")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestMessageIsDeliveredOnlyToConversationMembers(t *testing.T) {
	hub := NewHub()
	srv := newServer(t, hub)
	alice := dial(t, srv, 1, "http://allowed.test")
	aliceTab2 := dial(t, srv, 1, "http://allowed.test")
	bob := dial(t, srv, 2, "http://allowed.test")
	carol := dial(t, srv, 3, "http://allowed.test")
	waitFor(t, func() bool { return hub.Connections() == 4 })

	n := NewNotifier(hub, staticMembers{7: {1, 2}}, quiet)
	n.MessageCreated(context.Background(), message.Message{ID: 42, ConversationID: 7, SenderID: 1, Body: "hi"})

	for name, conn := range map[string]*websocket.Conn{"alice": alice, "alice tab 2": aliceTab2, "bob": bob} {
		ev := read(t, conn)
		if ev.Type != EventMessageNew || ev.Message == nil || ev.Message.ID != 42 {
			t.Errorf("%s got %+v", name, ev)
		}
	}

	// Carol is not a member: she must receive nothing.
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	if _, data, err := carol.Read(ctx); err == nil {
		t.Errorf("carol received %s", data)
	}
}

func TestRejectsForeignOrigin(t *testing.T) {
	srv := newServer(t, NewHub())
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws?user=1"
	_, resp, err := websocket.Dial(ctx, url, &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {"https://evil.test"}}})
	if err == nil || resp == nil || resp.StatusCode != http.StatusForbidden {
		t.Fatalf("err = %v, resp = %v; want 403", err, resp)
	}
}

func TestClientsAreRemovedOnDisconnectAndShutdown(t *testing.T) {
	hub := NewHub()
	srv := newServer(t, hub)
	a := dial(t, srv, 1, "http://allowed.test")
	b := dial(t, srv, 2, "http://allowed.test")
	waitFor(t, func() bool { return hub.Connections() == 2 })

	_ = a.Close(websocket.StatusNormalClosure, "")
	waitFor(t, func() bool { return hub.Connections() == 1 })

	hub.CloseAll()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _, err := b.Read(ctx)
	if websocket.CloseStatus(err) != websocket.StatusTryAgainLater {
		t.Errorf("close status = %v, want TryAgainLater", websocket.CloseStatus(err))
	}
	waitFor(t, func() bool { return hub.Connections() == 0 })
}

func TestSlowClientIsDroppedInsteadOfBlocking(t *testing.T) {
	hub := NewHub()
	c := hub.register(1)
	payload := []byte(`{}`)
	done := make(chan struct{})
	go func() {
		for range sendBuffer + 10 {
			hub.SendToUsers([]int64{1}, payload)
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("SendToUsers blocked on a full client")
	}
	select {
	case <-c.kick:
	default:
		t.Error("slow client was not dropped")
	}
}
