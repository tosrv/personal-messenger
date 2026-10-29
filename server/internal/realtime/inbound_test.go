package realtime

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestParseFrame(t *testing.T) {
	cases := []struct {
		in string
		ok bool
	}{
		{`{"type":"typing","conversation_id":7}`, true},
		{`{"type":"typing","conversation_id":0}`, false},
		{`{"type":"typing","conversation_id":-1}`, false},
		{`{"type":"typing"}`, false},
		{`{"type":"message.new","conversation_id":7}`, false},
		{`{"type":"typing","conversation_id":"7"}`, false},
		{`{"type":"typing","conversation_id":7,"body":"x"}`, false},
		{`{"type":"typing","conversation_id":7}{}`, false},
		{`not json`, false},
		{``, false},
	}
	for _, c := range cases {
		if _, ok := parseFrame([]byte(c.in)); ok != c.ok {
			t.Errorf("parseFrame(%q) ok = %v, want %v", c.in, ok, c.ok)
		}
	}
}

func TestInboundRateLimitsAndCountsStrikes(t *testing.T) {
	hub := NewHub()
	in := newInbound(1, staticMembers{7: {1, 2}}, hub)
	frame := []byte(`{"type":"typing","conversation_id":7}`)
	now := time.Now()

	for i := range frameBurst {
		if !in.accept(context.Background(), frame, now) {
			t.Fatalf("frame %d within the burst was rejected", i)
		}
	}
	if in.accept(context.Background(), frame, now) {
		t.Fatal("frame over the burst was accepted")
	}
	// One token is refilled per second.
	if !in.accept(context.Background(), frame, now.Add(time.Second)) {
		t.Fatal("frame after refill was rejected")
	}

	in = newInbound(1, staticMembers{}, hub)
	for i := range maxStrikes {
		if !in.handle(context.Background(), []byte(`junk`), now.Add(time.Duration(i)*time.Second)) {
			t.Fatalf("closed after %d strikes, want %d allowed", i+1, maxStrikes)
		}
	}
	if in.handle(context.Background(), []byte(`junk`), now.Add(time.Hour)) {
		t.Error("not closed after exceeding the strike limit")
	}
}

func send(t *testing.T, conn *websocket.Conn, frame string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := conn.Write(ctx, websocket.MessageText, []byte(frame)); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func expectSilence(t *testing.T, name string, conn *websocket.Conn) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	if _, data, err := conn.Read(ctx); err == nil {
		t.Errorf("%s received %s", name, data)
	}
}

func TestTypingIsSentOnlyToTheOtherMember(t *testing.T) {
	hub := NewHub()
	srv := newServerWithMembers(t, hub, staticMembers{7: {1, 2}})
	alice := dial(t, srv, 1, "http://allowed.test")
	aliceTab2 := dial(t, srv, 1, "http://allowed.test")
	bob := dial(t, srv, 2, "http://allowed.test")
	carol := dial(t, srv, 3, "http://allowed.test")
	waitFor(t, func() bool { return hub.Connections() == 4 })

	send(t, alice, `{"type":"typing","conversation_id":7}`)

	ev := read(t, bob)
	if ev.Type != EventTyping || ev.ConversationID != 7 || ev.UserID != 1 {
		t.Errorf("bob got %+v", ev)
	}
	expectSilence(t, "alice tab 2", aliceTab2)
	expectSilence(t, "carol", carol)
}

func TestTypingFromNonMemberOrInvalidFrameIsDropped(t *testing.T) {
	hub := NewHub()
	srv := newServerWithMembers(t, hub, staticMembers{7: {1, 2}})
	bob := dial(t, srv, 2, "http://allowed.test")
	carol := dial(t, srv, 3, "http://allowed.test")
	waitFor(t, func() bool { return hub.Connections() == 2 })

	send(t, carol, `{"type":"typing","conversation_id":7}`) // carol is not a member
	send(t, carol, `{"type":"typing","conversation_id":7,"user_id":1}`)
	send(t, carol, `{"type":"message.new"}`)
	expectSilence(t, "bob", bob)
}

func TestTooManyRejectedFramesClosesTheConnection(t *testing.T) {
	hub := NewHub()
	srv := newServerWithMembers(t, hub, staticMembers{})
	conn := dial(t, srv, 1, "http://allowed.test")

	for range maxStrikes + 1 {
		send(t, conn, `{"type":"typing","conversation_id":7}`)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _, err := conn.Read(ctx)
	if websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
		t.Errorf("close status = %v, want PolicyViolation (err %v)", websocket.CloseStatus(err), err)
	}
}

func TestOversizedFrameClosesTheConnection(t *testing.T) {
	srv := newServerWithMembers(t, NewHub(), staticMembers{})
	conn := dial(t, srv, 1, "http://allowed.test")
	send(t, conn, `{"type":"typing","conversation_id":7,"pad":"`+strings.Repeat("x", readLimit)+`"}`)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, _, err := conn.Read(ctx); websocket.CloseStatus(err) != websocket.StatusMessageTooBig {
		t.Errorf("close status = %v, want MessageTooBig", websocket.CloseStatus(err))
	}
}
