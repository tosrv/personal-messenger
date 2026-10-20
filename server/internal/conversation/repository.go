package conversation

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
)

// listLimit caps the conversation list; paging it is not needed for the MVP.
const listLimit = 100

type PostgresRepository struct {
	db *pgxpool.Pool
}

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// GetOrCreateDirect returns the direct conversation between two users,
// creating it if needed. The unique direct_key makes concurrent calls for
// the same pair converge on one row.
func (r *PostgresRepository) GetOrCreateDirect(ctx context.Context, a, b int64) (int64, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after commit

	var id int64
	// DO UPDATE (a no-op) instead of DO NOTHING so RETURNING yields the existing row.
	err = tx.QueryRow(ctx,
		`INSERT INTO conversations (direct_key) VALUES ($1)
		 ON CONFLICT (direct_key) DO UPDATE SET direct_key = EXCLUDED.direct_key
		 RETURNING id`,
		directKey(a, b)).Scan(&id)
	if err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)
		 ON CONFLICT DO NOTHING`,
		id, a, b); err != nil {
		return 0, err
	}
	return id, tx.Commit(ctx)
}

func (r *PostgresRepository) IsMember(ctx context.Context, conversationID, userID int64) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2)`,
		conversationID, userID).Scan(&ok)
	return ok, err
}

func (r *PostgresRepository) MemberIDs(ctx context.Context, conversationID int64) ([]int64, error) {
	rows, err := r.db.Query(ctx,
		`SELECT user_id FROM conversation_members WHERE conversation_id = $1`, conversationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[int64])
}

// summarySQL selects conversation summaries for viewer $1. Unread counts only
// messages from the peer that are newer than the viewer's read marker.
const summarySQL = `
SELECT c.id, c.created_at, me.last_read_message_id,
       u.id, u.username, u.display_name, coalesce(u.avatar_url, ''),
       lm.id, lm.sender_id, lm.body, lm.created_at,
       (SELECT count(*) FROM messages m
         WHERE m.conversation_id = c.id
           AND m.sender_id <> me.user_id
           AND m.id > coalesce(me.last_read_message_id, 0)) AS unread
FROM conversation_members me
JOIN conversations c        ON c.id = me.conversation_id
JOIN conversation_members o ON o.conversation_id = c.id AND o.user_id <> me.user_id
JOIN users u                ON u.id = o.user_id
LEFT JOIN LATERAL (
    SELECT id, sender_id, body, created_at FROM messages
    WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1
) lm ON true
WHERE me.user_id = $1`

func (r *PostgresRepository) ListForUser(ctx context.Context, userID int64) ([]Summary, error) {
	rows, err := r.db.Query(ctx,
		summarySQL+` ORDER BY c.last_message_at DESC NULLS LAST, c.id DESC LIMIT $2`,
		userID, listLimit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Summary, error) { return scanSummary(row) })
}

// GetForUser returns one conversation as seen by userID, or ErrNotFound if
// it does not exist or userID is not a member.
func (r *PostgresRepository) GetForUser(ctx context.Context, conversationID, userID int64) (Summary, error) {
	s, err := scanSummary(r.db.QueryRow(ctx, summarySQL+` AND c.id = $2`, userID, conversationID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Summary{}, apperr.ErrNotFound
	}
	return s, err
}

// MarkRead moves the user's read marker forward to messageID, never backward
// and never past the newest message in the conversation.
func (r *PostgresRepository) MarkRead(ctx context.Context, conversationID, userID, messageID int64) error {
	_, err := r.db.Exec(ctx,
		`UPDATE conversation_members
		 SET last_read_message_id = GREATEST(
		     coalesce(last_read_message_id, 0),
		     LEAST($3, (SELECT coalesce(max(id), 0) FROM messages WHERE conversation_id = $1)))
		 WHERE conversation_id = $1 AND user_id = $2`,
		conversationID, userID, messageID)
	return err
}

func scanSummary(row pgx.Row) (Summary, error) {
	// Last-message columns are NULL for a conversation with no messages yet.
	var (
		s        Summary
		lastRead *int64
		lmID     *int64
		lmSender *int64
		lmBody   *string
		lmAt     *time.Time
	)
	err := row.Scan(&s.ID, &s.CreatedAt, &lastRead,
		&s.Peer.ID, &s.Peer.Username, &s.Peer.DisplayName, &s.Peer.AvatarURL,
		&lmID, &lmSender, &lmBody, &lmAt, &s.UnreadCount)
	if err != nil {
		return Summary{}, err
	}
	if lastRead != nil {
		s.LastReadMessageID = *lastRead
	}
	if lmID != nil {
		s.LastMessage = &LastMessage{ID: *lmID, SenderID: *lmSender, Body: *lmBody, CreatedAt: *lmAt}
	}
	return s, nil
}

// directKey is the canonical "<smaller>:<larger>" key for a pair of users.
func directKey(a, b int64) string {
	if a > b {
		a, b = b, a
	}
	return fmt.Sprintf("%d:%d", a, b)
}
