package conversation

import (
	"context"
	"errors"
	"testing"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/database/dbtest"
)

func TestPostgresRepository(t *testing.T) {
	pool := dbtest.New(t)
	ctx := context.Background()
	repo := NewPostgresRepository(pool)

	if _, err := pool.Exec(ctx, `
		INSERT INTO users (google_sub, email, display_name, username) VALUES
		  ('g1', 'a@x.com', 'Alice', 'alice'), ('g2', 'b@x.com', 'Bob', 'bob'), ('g3', 'c@x.com', 'Carol', 'carol')`); err != nil {
		t.Fatal(err)
	}
	const alice, bob, carol = 1, 2, 3

	ab, err := repo.GetOrCreateDirect(ctx, alice, bob)
	if err != nil {
		t.Fatal(err)
	}

	t.Run("same pair in either order reuses the conversation", func(t *testing.T) {
		ba, err := repo.GetOrCreateDirect(ctx, bob, alice)
		if err != nil || ba != ab {
			t.Errorf("got %d, %v; want %d", ba, err, ab)
		}
	})

	ac, _ := repo.GetOrCreateDirect(ctx, alice, carol)

	t.Run("membership", func(t *testing.T) {
		for _, tc := range []struct {
			conv, user int64
			want       bool
		}{{ab, alice, true}, {ab, bob, true}, {ab, carol, false}, {999, alice, false}} {
			if got, _ := repo.IsMember(ctx, tc.conv, tc.user); got != tc.want {
				t.Errorf("IsMember(%d, %d) = %v", tc.conv, tc.user, got)
			}
		}
		if ids, err := repo.MemberIDs(ctx, ab); err != nil || len(ids) != 2 {
			t.Errorf("MemberIDs = %v, %v", ids, err)
		}
		if _, err := repo.GetForUser(ctx, ab, carol); !errors.Is(err, apperr.ErrNotFound) {
			t.Errorf("non-member GetForUser: err = %v", err)
		}
	})

	// Bob sends two messages to Alice; Alice has read none.
	if _, err := pool.Exec(ctx, `
		INSERT INTO messages (conversation_id, sender_id, client_message_id, body) VALUES
		  ($1, 2, gen_random_uuid(), 'hi'), ($1, 2, gen_random_uuid(), 'are you there?')`, ab); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE conversations SET last_message_at = now() WHERE id = $1`, ab); err != nil {
		t.Fatal(err)
	}

	t.Run("list shows peer, last message, unread, newest activity first", func(t *testing.T) {
		list, err := repo.ListForUser(ctx, alice)
		if err != nil || len(list) != 2 {
			t.Fatalf("list = %+v, %v", list, err)
		}
		top := list[0]
		if top.ID != ab || top.Peer.Username != "bob" || top.LastMessage == nil ||
			top.LastMessage.Body != "are you there?" || top.UnreadCount != 2 {
			t.Errorf("top = %+v", top)
		}
		if list[1].ID != ac || list[1].LastMessage != nil || list[1].UnreadCount != 0 {
			t.Errorf("second = %+v", list[1])
		}
	})

	t.Run("mark read moves forward only and is clamped", func(t *testing.T) {
		if marker, moved, err := repo.MarkRead(ctx, ab, alice, 1); err != nil || !moved || marker != 1 {
			t.Errorf("read 1 = %d, %v, %v", marker, moved, err)
		}
		s, _ := repo.GetForUser(ctx, ab, alice)
		if s.UnreadCount != 1 || s.LastReadMessageID != 1 {
			t.Errorf("after read 1: %+v", s)
		}
		// clamped to newest (2)
		if marker, moved, err := repo.MarkRead(ctx, ab, alice, 999); err != nil || !moved || marker != 2 {
			t.Errorf("read 999 = %d, %v, %v", marker, moved, err)
		}
		// ignored: backwards, and repeating the same id
		for _, id := range []int64{1, 2} {
			if _, moved, err := repo.MarkRead(ctx, ab, alice, id); err != nil || moved {
				t.Errorf("read %d again: moved = %v, err = %v", id, moved, err)
			}
		}
		s, _ = repo.GetForUser(ctx, ab, alice)
		if s.UnreadCount != 0 || s.LastReadMessageID != 2 {
			t.Errorf("after read all: %+v", s)
		}
	})

	t.Run("the sender sees the peer's read marker (read receipts)", func(t *testing.T) {
		s, err := repo.GetForUser(ctx, ab, bob)
		if err != nil || s.PeerLastReadMessageID != 2 || s.LastReadMessageID != 0 {
			t.Errorf("bob's view = %+v, %v", s, err)
		}
	})
}

func TestDeleteForMe(t *testing.T) {
	pool := dbtest.New(t)
	ctx := context.Background()
	repo := NewPostgresRepository(pool)
	if _, err := pool.Exec(ctx, `
		INSERT INTO users (google_sub, email, display_name, username) VALUES
		  ('g1', 'a@x.com', 'Alice', 'alice'), ('g2', 'b@x.com', 'Bob', 'bob'), ('g3', 'c@x.com', 'Carol', 'carol')`); err != nil {
		t.Fatal(err)
	}
	const alice, bob, carol = 1, 2, 3
	conv, _ := repo.GetOrCreateDirect(ctx, alice, bob)
	send := func(from int64, body string) {
		t.Helper()
		if _, err := pool.Exec(ctx,
			`INSERT INTO messages (conversation_id, sender_id, client_message_id, body) VALUES ($1, $2, gen_random_uuid(), $3)`,
			conv, from, body); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `UPDATE conversations SET last_message_at = now() WHERE id = $1`, conv); err != nil {
			t.Fatal(err)
		}
	}
	listIDs := func(user int64) []int64 {
		t.Helper()
		list, err := repo.ListForUser(ctx, user)
		if err != nil {
			t.Fatal(err)
		}
		var ids []int64
		for _, s := range list {
			ids = append(ids, s.ID)
		}
		return ids
	}

	send(bob, "old 1")
	send(bob, "old 2")

	if ok, err := repo.ClearForUser(ctx, conv, carol); ok || err != nil {
		t.Errorf("non-member delete: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.ClearForUser(ctx, conv, alice); !ok || err != nil {
		t.Fatalf("delete: ok=%v err=%v", ok, err)
	}

	t.Run("gone from my list, still in theirs", func(t *testing.T) {
		if ids := listIDs(alice); len(ids) != 0 {
			t.Errorf("alice list = %v, want empty", ids)
		}
		if ids := listIDs(bob); len(ids) != 1 {
			t.Errorf("bob list = %v, want the chat", ids)
		}
	})

	t.Run("history hidden only for me", func(t *testing.T) {
		floor, err := repo.VisibleFrom(ctx, conv, alice)
		var newest int64
		_ = pool.QueryRow(ctx, `SELECT max(id) FROM messages WHERE conversation_id = $1`, conv).Scan(&newest)
		if err != nil || floor != newest {
			t.Errorf("alice floor = %d (%v), want %d", floor, err, newest)
		}
		if floor, _ := repo.VisibleFrom(ctx, conv, bob); floor != 0 {
			t.Errorf("bob floor = %d, want 0", floor)
		}
		if _, err := repo.VisibleFrom(ctx, conv, carol); !errors.Is(err, apperr.ErrNotFound) {
			t.Errorf("carol: err = %v, want ErrNotFound", err)
		}
	})

	t.Run("a new message brings it back with only the new history", func(t *testing.T) {
		send(bob, "hello again")
		s, err := repo.GetForUser(ctx, conv, alice)
		if err != nil || s.LastMessage == nil || s.LastMessage.Body != "hello again" || s.UnreadCount != 1 {
			t.Errorf("after new message: %+v, %v", s, err)
		}
		if ids := listIDs(alice); len(ids) != 1 {
			t.Errorf("alice list = %v, want the chat back", ids)
		}
	})

	t.Run("reopening an emptied chat shows it again", func(t *testing.T) {
		if _, err := repo.ClearForUser(ctx, conv, alice); err != nil {
			t.Fatal(err)
		}
		if ids := listIDs(alice); len(ids) != 0 {
			t.Fatalf("after second delete: %v", ids)
		}
		if _, err := repo.GetOrCreateDirect(ctx, alice, bob); err != nil {
			t.Fatal(err)
		}
		s, _ := repo.GetForUser(ctx, conv, alice)
		if ids := listIDs(alice); len(ids) != 1 || s.LastMessage != nil || s.UnreadCount != 0 {
			t.Errorf("reopened: list=%v summary=%+v", ids, s)
		}
	})
}
