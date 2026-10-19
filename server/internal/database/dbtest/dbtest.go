// Package dbtest gives integration tests a migrated, empty PostgreSQL database.
//
// Tests using it are skipped unless TEST_DATABASE_URL is set, e.g.
//
//	TEST_DATABASE_URL=postgres://messenger:messenger@localhost:5432/messenger_test?sslmode=disable go test ./...
package dbtest

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tosrv/personal-messenger/server/internal/database"
)

// New migrates the test database, truncates all tables, and returns a pool.
// Tests sharing the database must not run in parallel across packages, so
// run with `go test -p 1` when TEST_DATABASE_URL is set.
func New(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}

	_, file, _, _ := runtime.Caller(0)
	migrations := filepath.Join(filepath.Dir(file), "..", "..", "..", "migrations")
	if err := database.Migrate(url, filepath.ToSlash(migrations)); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	ctx := context.Background()
	pool, err := database.Connect(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)

	if _, err := pool.Exec(ctx,
		`TRUNCATE users, sessions, conversations, conversation_members, messages RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return pool
}
