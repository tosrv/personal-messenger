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
		_ = repo.MarkRead(ctx, ab, alice, 1)
		s, _ := repo.GetForUser(ctx, ab, alice)
		if s.UnreadCount != 1 || s.LastReadMessageID != 1 {
			t.Errorf("after read 1: %+v", s)
		}
		_ = repo.MarkRead(ctx, ab, alice, 999) // clamped to newest (2)
		_ = repo.MarkRead(ctx, ab, alice, 1)   // ignored: backwards
		s, _ = repo.GetForUser(ctx, ab, alice)
		if s.UnreadCount != 0 || s.LastReadMessageID != 2 {
			t.Errorf("after read all: %+v", s)
		}
	})
}
