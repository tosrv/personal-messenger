package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
)

// SessionTTL is how long a session stays valid after sign-in.
const SessionTTL = 30 * 24 * time.Hour

// SessionStore keeps sessions in PostgreSQL. Only the SHA-256 hash of each
// token is stored (ADR 0001); the raw token exists only in the user's cookie.
type SessionStore struct {
	db *pgxpool.Pool
}

func NewSessionStore(db *pgxpool.Pool) *SessionStore {
	return &SessionStore{db: db}
}

// Create starts a session for userID and returns the raw token for the cookie.
func (s *SessionStore) Create(ctx context.Context, userID int64) (token string, expiresAt time.Time, err error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", time.Time{}, err
	}
	token = base64.RawURLEncoding.EncodeToString(raw)
	expiresAt = time.Now().Add(SessionTTL)
	_, err = s.db.Exec(ctx,
		`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
		hashToken(token), userID, expiresAt)
	return token, expiresAt, err
}

// UserID resolves a raw token to its user. Missing or expired sessions return ErrUnauthorized.
func (s *SessionStore) UserID(ctx context.Context, token string) (int64, error) {
	var id int64
	err := s.db.QueryRow(ctx,
		`SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()`,
		hashToken(token)).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, apperr.ErrUnauthorized
	}
	return id, err
}

func (s *SessionStore) Delete(ctx context.Context, token string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, hashToken(token))
	return err
}

// DeleteExpired removes expired sessions and returns how many were removed.
func (s *SessionStore) DeleteExpired(ctx context.Context) (int64, error) {
	tag, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE expires_at <= now()`)
	return tag.RowsAffected(), err
}

func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}
