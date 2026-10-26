package message

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/google/uuid"

	"github.com/tosrv/personal-messenger/server/internal/database/dbtest"
)

func TestPostgresRepository(t *testing.T) {
	pool := dbtest.New(t)
	ctx := context.Background()
	repo := NewPostgresRepository(pool)

	// Fixture: users 1 and 2 share conversation 1; conversation 2 is someone else's.
	if _, err := pool.Exec(ctx, `
		INSERT INTO users (google_sub, email, display_name, username) VALUES
		  ('g1', 'a@x.com', 'A', 'alice'), ('g2', 'b@x.com', 'B', 'bob');
		INSERT INTO conversations (direct_key) VALUES ('1:2'), ('1:99');
		INSERT INTO conversation_members (conversation_id, user_id) VALUES (1, 1), (1, 2), (2, 1);
	`); err != nil {
		t.Fatal(err)
	}

	clientID := uuid.NewString()
	first, created, err := repo.Create(ctx, Message{ConversationID: 1, SenderID: 1, ClientMessageID: clientID, Body: "hello"})
	if err != nil || !created {
		t.Fatalf("create: %+v created=%v err=%v", first, created, err)
	}

	t.Run("retry with same client id returns the original", func(t *testing.T) {
		again, created, err := repo.Create(ctx, Message{ConversationID: 1, SenderID: 1, ClientMessageID: clientID, Body: "hello"})
		if err != nil || created || again.ID != first.ID {
			t.Errorf("retry: %+v created=%v err=%v", again, created, err)
		}
		var n int
		_ = pool.QueryRow(ctx, `SELECT count(*) FROM messages`).Scan(&n)
		if n != 1 {
			t.Errorf("messages = %d, want 1", n)
		}
	})

	t.Run("reusing client id in another conversation is rejected", func(t *testing.T) {
		_, _, err := repo.Create(ctx, Message{ConversationID: 2, SenderID: 1, ClientMessageID: clientID, Body: "x"})
		if !errors.Is(err, errClientIDReused) {
			t.Errorf("err = %v, want errClientIDReused", err)
		}
	})

	t.Run("create bumps activity and sender read marker", func(t *testing.T) {
		var lastAt, readID any
		_ = pool.QueryRow(ctx, `SELECT last_message_at FROM conversations WHERE id = 1`).Scan(&lastAt)
		_ = pool.QueryRow(ctx, `SELECT last_read_message_id FROM conversation_members WHERE conversation_id = 1 AND user_id = 1`).Scan(&readID)
		if lastAt == nil || readID != first.ID {
			t.Errorf("last_message_at=%v sender read=%v", lastAt, readID)
		}
	})

	// 11 more messages → 12 in conversation 1. IDs may have gaps (a rejected
	// duplicate still consumes a sequence value), so compare against real IDs.
	all := []int64{first.ID}
	for i := range 11 {
		m, _, err := repo.Create(ctx, Message{ConversationID: 1, SenderID: 2, ClientMessageID: uuid.NewString(), Body: fmt.Sprint(i)})
		if err != nil {
			t.Fatal(err)
		}
		all = append(all, m.ID)
	}

	t.Run("pages backwards in ascending order", func(t *testing.T) {
		p, err := repo.ListBefore(ctx, 1, 0, 0, 5)
		if err != nil || !p.HasMore || ids(p) != fmt.Sprint(all[7:12]) {
			t.Fatalf("newest page: %s hasMore=%v err=%v", ids(p), p.HasMore, err)
		}
		p, _ = repo.ListBefore(ctx, 1, all[7], 0, 5)
		if !p.HasMore || ids(p) != fmt.Sprint(all[2:7]) {
			t.Errorf("second page: %s hasMore=%v", ids(p), p.HasMore)
		}
		p, _ = repo.ListBefore(ctx, 1, all[2], 0, 5)
		if p.HasMore || ids(p) != fmt.Sprint(all[0:2]) {
			t.Errorf("last page: %s hasMore=%v", ids(p), p.HasMore)
		}
	})

	t.Run("catches up forwards", func(t *testing.T) {
		p, _ := repo.ListAfter(ctx, 1, all[8], 2)
		if !p.HasMore || ids(p) != fmt.Sprint(all[9:11]) {
			t.Errorf("after %d: %s hasMore=%v", all[8], ids(p), p.HasMore)
		}
		p, _ = repo.ListAfter(ctx, 1, all[11], 10)
		if p.HasMore || len(p.Messages) != 0 {
			t.Errorf("after newest: %s", ids(p))
		}
	})
}

func ids(p Page) string {
	out := make([]int64, len(p.Messages))
	for i, m := range p.Messages {
		out[i] = m.ID
	}
	return fmt.Sprint(out)
}
