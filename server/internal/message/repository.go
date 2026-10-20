package message

import (
	"context"
	"errors"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const messageColumns = `id, conversation_id, sender_id, client_message_id::text, body, created_at`

// errClientIDReused means the sender reused a client_message_id in a different conversation.
var errClientIDReused = errors.New("client_message_id already used in another conversation")

type PostgresRepository struct {
	db *pgxpool.Pool
}

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// Create stores a message and bumps the conversation's activity time in one
// transaction. If (sender, client_message_id) already exists, it returns the
// stored message with created=false instead of inserting a duplicate.
func (r *PostgresRepository) Create(ctx context.Context, m Message) (stored Message, created bool, err error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Message{}, false, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after commit

	stored, err = scanMessage(tx.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, sender_id, client_message_id, body)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (sender_id, client_message_id) DO NOTHING
		 RETURNING `+messageColumns,
		m.ConversationID, m.SenderID, m.ClientMessageID, m.Body))

	if errors.Is(err, pgx.ErrNoRows) { // duplicate: return what we stored the first time
		stored, err = scanMessage(tx.QueryRow(ctx,
			`SELECT `+messageColumns+` FROM messages WHERE sender_id = $1 AND client_message_id = $2`,
			m.SenderID, m.ClientMessageID))
		if err != nil {
			return Message{}, false, err
		}
		if stored.ConversationID != m.ConversationID {
			return Message{}, false, errClientIDReused
		}
		return stored, false, tx.Commit(ctx)
	}
	if err != nil {
		return Message{}, false, err
	}

	// Activity time for list ordering; the sender has implicitly read their own message.
	if _, err := tx.Exec(ctx,
		`UPDATE conversations SET last_message_at = $2 WHERE id = $1`,
		stored.ConversationID, stored.CreatedAt); err != nil {
		return Message{}, false, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE conversation_members SET last_read_message_id = $3
		 WHERE conversation_id = $1 AND user_id = $2`,
		stored.ConversationID, stored.SenderID, stored.ID); err != nil {
		return Message{}, false, err
	}
	return stored, true, tx.Commit(ctx)
}

// ListBefore returns up to limit messages with id < before (0 = from newest),
// in ascending order, and whether older messages remain.
func (r *PostgresRepository) ListBefore(ctx context.Context, conversationID, before int64, limit int) (Page, error) {
	if before == 0 {
		before = 1<<63 - 1
	}
	msgs, err := r.list(ctx,
		`SELECT `+messageColumns+` FROM messages
		 WHERE conversation_id = $1 AND id < $2
		 ORDER BY id DESC LIMIT $3`,
		conversationID, before, limit+1)
	if err != nil {
		return Page{}, err
	}
	hasMore := len(msgs) > limit
	if hasMore {
		msgs = msgs[:limit]
	}
	slices.Reverse(msgs)
	return Page{Messages: msgs, HasMore: hasMore}, nil
}

// ListAfter returns up to limit messages with id > after, in ascending order,
// and whether newer messages remain. Used to catch up after reconnecting.
func (r *PostgresRepository) ListAfter(ctx context.Context, conversationID, after int64, limit int) (Page, error) {
	msgs, err := r.list(ctx,
		`SELECT `+messageColumns+` FROM messages
		 WHERE conversation_id = $1 AND id > $2
		 ORDER BY id ASC LIMIT $3`,
		conversationID, after, limit+1)
	if err != nil {
		return Page{}, err
	}
	hasMore := len(msgs) > limit
	if hasMore {
		msgs = msgs[:limit]
	}
	return Page{Messages: msgs, HasMore: hasMore}, nil
}

func (r *PostgresRepository) list(ctx context.Context, sql string, args ...any) ([]Message, error) {
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Message, error) { return scanMessage(row) })
}

func scanMessage(row pgx.Row) (Message, error) {
	var m Message
	err := row.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.ClientMessageID, &m.Body, &m.CreatedAt)
	return m, err
}
