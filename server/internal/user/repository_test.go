package user

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/database/dbtest"
)

func TestPostgresRepository(t *testing.T) {
	repo := NewPostgresRepository(dbtest.New(t))
	ctx := context.Background()

	alice, err := repo.Create(ctx, GoogleProfile{Subject: "g-alice", Email: "a@example.com", DisplayName: "Alice"}, "alice")
	if err != nil {
		t.Fatal(err)
	}

	t.Run("username is unique case-insensitively", func(t *testing.T) {
		_, err := repo.Create(ctx, GoogleProfile{Subject: "g-other", Email: "o@example.com", DisplayName: "O"}, "ALICE")
		if !errors.Is(err, errUsernameTaken) {
			t.Errorf("err = %v, want errUsernameTaken", err)
		}
	})

	t.Run("same google subject returns existing account", func(t *testing.T) {
		u, err := repo.Create(ctx, GoogleProfile{Subject: "g-alice", Email: "new@example.com", DisplayName: "Alice"}, "alice2")
		if err != nil || u.ID != alice.ID || u.Username != "alice" || u.Email != "new@example.com" {
			t.Errorf("got %+v, %v", u, err)
		}
	})

	t.Run("update google profile of unknown subject", func(t *testing.T) {
		if _, err := repo.UpdateGoogleProfile(ctx, GoogleProfile{Subject: "nope"}); !errors.Is(err, apperr.ErrNotFound) {
			t.Errorf("err = %v, want ErrNotFound", err)
		}
	})

	bob, err := repo.Create(ctx, GoogleProfile{Subject: "g-bob", Email: "b@example.com", DisplayName: "Bob"}, "bob")
	if err != nil {
		t.Fatal(err)
	}

	t.Run("update username conflict", func(t *testing.T) {
		taken := "Alice"
		if _, err := repo.UpdateProfile(ctx, bob.ID, ProfileUpdate{Username: &taken}); !errors.Is(err, errUsernameTaken) {
			t.Errorf("err = %v, want errUsernameTaken", err)
		}
	})

	t.Run("edited display name survives the next Google sign-in", func(t *testing.T) {
		name := "Bobby"
		if _, err := repo.UpdateProfile(ctx, bob.ID, ProfileUpdate{DisplayName: &name}); err != nil {
			t.Fatal(err)
		}
		u, err := repo.UpdateGoogleProfile(ctx, GoogleProfile{Subject: "g-bob", Email: "b2@example.com", DisplayName: "Bob From Google"})
		if err != nil || u.DisplayName != "Bobby" || u.Email != "b2@example.com" {
			t.Errorf("after sign-in: %+v, %v", u, err)
		}
		// Alice never edited hers, so Google's name still applies.
		u, _ = repo.UpdateGoogleProfile(ctx, GoogleProfile{Subject: "g-alice", Email: "a@example.com", DisplayName: "Alice G"})
		if u.DisplayName != "Alice G" {
			t.Errorf("unedited name not refreshed: %q", u.DisplayName)
		}
	})

	t.Run("search is prefix, case-insensitive, excludes viewer, escapes wildcards", func(t *testing.T) {
		got, err := repo.SearchByUsernamePrefix(ctx, "AL", bob.ID, 10)
		if err != nil || len(got) != 1 || got[0].ID != alice.ID {
			t.Errorf("AL: %+v, %v", got, err)
		}
		got, _ = repo.SearchByUsernamePrefix(ctx, "al", alice.ID, 10)
		if len(got) != 0 {
			t.Errorf("viewer not excluded: %+v", got)
		}
		got, _ = repo.SearchByUsernamePrefix(ctx, "_", 0, 10)
		if len(got) != 0 {
			t.Errorf("wildcard matched: %+v", got)
		}
	})
}

func TestGuests(t *testing.T) {
	pool := dbtest.New(t)
	repo := NewPostgresRepository(pool)
	ctx := context.Background()

	owner, err := repo.Create(ctx, GoogleProfile{Subject: "g-owner", Email: "o@example.com", DisplayName: "Owner"}, "tomy")
	if err != nil {
		t.Fatal(err)
	}
	quiet, err := repo.CreateGuest(ctx, "Quiet", "guest_1111")
	if err != nil || !quiet.IsGuest || quiet.Email != "" || quiet.GoogleSub != "" {
		t.Fatalf("CreateGuest = %+v, %v", quiet, err)
	}
	chatty, _ := repo.CreateGuest(ctx, "Chatty", "guest_2222")
	if _, err := repo.CreateGuest(ctx, "Dup", "guest_2222"); !errors.Is(err, errUsernameTaken) {
		t.Errorf("duplicate guest username: err = %v", err)
	}

	t.Run("non-guests still need a Google identity", func(t *testing.T) {
		_, err := pool.Exec(ctx, `INSERT INTO users (display_name, username) VALUES ('x', 'nobody')`)
		if constraintViolated(err) != "" || err == nil {
			// CHECK violations are 23514, not unique violations; any error is fine here.
			if err == nil {
				t.Error("insert without google_sub/email succeeded")
			}
		}
	})

	t.Run("guests are not searchable", func(t *testing.T) {
		got, _ := repo.SearchByUsernamePrefix(ctx, "guest", owner.ID, 10)
		if len(got) != 0 {
			t.Errorf("search returned guests: %+v", got)
		}
	})

	t.Run("cleanup removes only old guests who never wrote", func(t *testing.T) {
		var conv int64
		if err := pool.QueryRow(ctx, `INSERT INTO conversations (direct_key) VALUES ('x') RETURNING id`).Scan(&conv); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO messages (conversation_id, sender_id, client_message_id, body) VALUES ($1, $2, gen_random_uuid(), 'hi')`,
			conv, chatty.ID); err != nil {
			t.Fatal(err)
		}
		if n, _ := repo.DeleteAbandonedGuests(ctx, time.Hour); n != 0 {
			t.Errorf("deleted %d fresh guests", n)
		}
		if _, err := pool.Exec(ctx, `UPDATE users SET created_at = now() - interval '2 days' WHERE is_guest`); err != nil {
			t.Fatal(err)
		}
		n, err := repo.DeleteAbandonedGuests(ctx, 24*time.Hour)
		if err != nil || n != 1 {
			t.Fatalf("deleted %d, %v; want 1 (the quiet guest)", n, err)
		}
		if _, err := repo.GetByID(ctx, quiet.ID); !errors.Is(err, apperr.ErrNotFound) {
			t.Errorf("quiet guest still exists: %v", err)
		}
		if _, err := repo.GetByID(ctx, chatty.ID); err != nil {
			t.Errorf("guest with messages was deleted: %v", err)
		}
	})
}
