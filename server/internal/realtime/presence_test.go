package realtime

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/coder/websocket"

	"github.com/tosrv/personal-messenger/server/internal/conversation"
)

type fakeAudience map[int64]conversation.Audience

func (f fakeAudience) PresenceAudience(_ context.Context, userID int64) (conversation.Audience, error) {
	return f[userID], nil
}

type fakeLastSeen map[int64]time.Time

func (f fakeLastSeen) SetLastSeen(_ context.Context, userID int64, at time.Time) error {
	f[userID] = at
	return nil
}

func readPresence(t *testing.T, conn *websocket.Conn) PresenceEvent {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, data, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	var ev PresenceEvent
	if err := json.Unmarshal(data, &ev); err != nil || ev.Type != EventPresence {
		t.Fatalf("decode %s: %v", data, err)
	}
	return ev
}

func TestPresenceGoesOnlyToTheAudience(t *testing.T) {
	hub := NewHub()
	srv := newServer(t, hub)
	bob := dial(t, srv, 2, "http://allowed.test")
	carol := dial(t, srv, 3, "http://allowed.test")
	waitFor(t, func() bool { return hub.Connections() == 2 })

	lastSeen := fakeLastSeen{}
	p := NewPresence(hub, lastSeen, fakeAudience{
		1: {Visible: true, ContactIDs: []int64{2}},
		4: {Visible: false, ContactIDs: []int64{2, 3}},
	}, quiet)
	now := time.Date(2026, 10, 29, 8, 0, 0, 500, time.UTC)
	p.now = func() time.Time { return now }

	p.Online(context.Background(), 1)
	if ev := readPresence(t, bob); ev.UserID != 1 || !ev.Online || ev.LastSeenAt != nil {
		t.Errorf("online event = %+v", ev)
	}

	p.Offline(context.Background(), 1)
	ev := readPresence(t, bob)
	if ev.Online || ev.LastSeenAt == nil || !ev.LastSeenAt.Equal(now.Truncate(time.Second)) {
		t.Errorf("offline event = %+v", ev)
	}
	if !lastSeen[1].Equal(now.Truncate(time.Second)) {
		t.Errorf("stored last seen = %v", lastSeen[1])
	}

	// User 4 hides presence: nothing is sent, but last seen is still stored.
	p.Online(context.Background(), 4)
	p.Offline(context.Background(), 4)
	if _, ok := lastSeen[4]; !ok {
		t.Error("last seen of a hidden user was not stored")
	}
	expectSilence(t, "bob", bob)
	expectSilence(t, "carol", carol)
}

func TestPresenceSettingChangeSendsHiddenOrCurrentState(t *testing.T) {
	hub := NewHub()
	srv := newServer(t, hub)
	bob := dial(t, srv, 2, "http://allowed.test")
	waitFor(t, func() bool { return hub.Connections() == 1 })

	seen := time.Date(2026, 10, 29, 7, 0, 0, 0, time.UTC)
	audience := fakeAudience{1: {Visible: false, LastSeenAt: &seen, ContactIDs: []int64{2}}}
	p := NewPresence(hub, fakeLastSeen{}, audience, quiet)

	p.PresenceSettingChanged(context.Background(), 1)
	if ev := readPresence(t, bob); ev.Online || ev.LastSeenAt != nil {
		t.Errorf("hidden event = %+v", ev)
	}

	audience[1] = conversation.Audience{Visible: true, LastSeenAt: &seen, ContactIDs: []int64{2}}
	p.PresenceSettingChanged(context.Background(), 1)
	if ev := readPresence(t, bob); ev.Online || ev.LastSeenAt == nil || !ev.LastSeenAt.Equal(seen) {
		t.Errorf("shown event = %+v", ev)
	}
}

type presenceLog struct {
	online, offline chan int64
}

func (l presenceLog) Online(_ context.Context, id int64)  { l.online <- id }
func (l presenceLog) Offline(_ context.Context, id int64) { l.offline <- id }

func TestHandlerReportsFirstAndLastConnection(t *testing.T) {
	hub := NewHub()
	log := presenceLog{online: make(chan int64, 4), offline: make(chan int64, 4)}
	srv := newServerWithPresence(t, hub, log)

	tab1 := dial(t, srv, 1, "http://allowed.test")
	tab2 := dial(t, srv, 1, "http://allowed.test")
	waitFor(t, func() bool { return hub.Connections() == 2 })
	if !hub.IsOnline(1) || hub.IsOnline(2) {
		t.Error("IsOnline is wrong")
	}

	_ = tab1.Close(websocket.StatusNormalClosure, "")
	waitFor(t, func() bool { return hub.Connections() == 1 })
	_ = tab2.Close(websocket.StatusNormalClosure, "")
	waitFor(t, func() bool { return hub.Connections() == 0 })

	if len(log.online) != 1 || <-log.online != 1 {
		t.Error("want exactly one online for the first tab")
	}
	select {
	case id := <-log.offline:
		if id != 1 || len(log.offline) != 0 {
			t.Error("want exactly one offline for the last tab")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no offline after the last tab closed")
	}
}
