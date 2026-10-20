package user

import (
	"context"
	"errors"
	"testing"

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
