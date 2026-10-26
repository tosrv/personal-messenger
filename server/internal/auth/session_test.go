package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/database/dbtest"
)

func TestSessionStore(t *testing.T) {
	pool := dbtest.New(t)
	ctx := context.Background()
	var userID int64
	if err := pool.QueryRow(ctx,
		`INSERT INTO users (google_sub, email, display_name, username) VALUES ('g', 'e@x.com', 'E', 'eve') RETURNING id`,
	).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	store := NewSessionStore(pool)

	token, _, err := store.Create(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}

	var stored int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM sessions WHERE token_hash = $1::bytea`, []byte(token)).Scan(&stored)
	if stored != 0 {
		t.Error("raw token stored in database; only its hash should be")
	}

	if got, err := store.UserID(ctx, token); err != nil || got != userID {
		t.Fatalf("UserID = %d, %v", got, err)
	}
	if _, err := store.UserID(ctx, "wrong-token"); !errors.Is(err, apperr.ErrUnauthorized) {
		t.Errorf("wrong token: err = %v", err)
	}

	if _, err := pool.Exec(ctx, `UPDATE sessions SET expires_at = now() - interval '1 second'`); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UserID(ctx, token); !errors.Is(err, apperr.ErrUnauthorized) {
		t.Errorf("expired session accepted: err = %v", err)
	}
	if n, err := store.DeleteExpired(ctx); err != nil || n != 1 {
		t.Errorf("DeleteExpired = %d, %v", n, err)
	}

	token2, _, _ := store.Create(ctx, userID)
	if err := store.Delete(ctx, token2); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UserID(ctx, token2); !errors.Is(err, apperr.ErrUnauthorized) {
		t.Errorf("deleted session accepted: err = %v", err)
	}
}

func TestSessionStore_ExtendIfAging(t *testing.T) {
	pool := dbtest.New(t)
	ctx := context.Background()
	var userID int64
	if err := pool.QueryRow(ctx,
		`INSERT INTO users (google_sub, email, display_name, username) VALUES ('g', 'e@x.com', 'E', 'eve') RETURNING id`,
	).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	store := NewSessionStore(pool)
	token, _, _ := store.Create(ctx, userID)

	if exp, err := store.ExtendIfAging(ctx, token); err != nil || !exp.IsZero() {
		t.Errorf("fresh session extended: %v, %v", exp, err)
	}

	// Less than half the TTL left → pushed back to a full TTL.
	if _, err := pool.Exec(ctx, `UPDATE sessions SET expires_at = now() + interval '2 days'`); err != nil {
		t.Fatal(err)
	}
	exp, err := store.ExtendIfAging(ctx, token)
	if err != nil || time.Until(exp) < SessionTTL-time.Minute {
		t.Errorf("aging session: expires in %v, %v; want ~%v", time.Until(exp), err, SessionTTL)
	}

	// Expired sessions are never revived.
	if _, err := pool.Exec(ctx, `UPDATE sessions SET expires_at = now() - interval '1 second'`); err != nil {
		t.Fatal(err)
	}
	if exp, _ := store.ExtendIfAging(ctx, token); !exp.IsZero() {
		t.Error("expired session was extended")
	}
}
