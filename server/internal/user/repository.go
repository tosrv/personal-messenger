package user

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
)

const userColumns = `id, coalesce(google_sub, ''), coalesce(email, ''), display_name,
	coalesce(avatar_url, ''), username, is_guest, show_presence, created_at, updated_at`

// errUsernameTaken is returned by Create when the username is already used.
var errUsernameTaken = errors.New("username taken")

// PostgresRepository implements Repository with pgx.
type PostgresRepository struct {
	db *pgxpool.Pool
}

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) GetByID(ctx context.Context, id int64) (User, error) {
	return r.getOne(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id)
}

func (r *PostgresRepository) GetByUsername(ctx context.Context, username string) (User, error) {
	return r.getOne(ctx, `SELECT `+userColumns+` FROM users WHERE username = $1`, username)
}

// UpdateGoogleProfile refreshes Google-provided fields for an existing account.
// Accounts are matched by google_sub, never by email (PRD §6.1). A display
// name the user has edited is kept.
func (r *PostgresRepository) UpdateGoogleProfile(ctx context.Context, p GoogleProfile) (User, error) {
	return r.getOne(ctx,
		`UPDATE users SET email = $2,
		     display_name = CASE WHEN display_name_customized THEN display_name ELSE $3 END,
		     avatar_url = nullif($4, ''), updated_at = now()
		 WHERE google_sub = $1
		 RETURNING `+userColumns,
		p.Subject, p.Email, p.DisplayName, p.AvatarURL)
}

// Create inserts a new user. It returns errUsernameTaken if the username is used,
// and the existing user if the same Google account was created concurrently.
func (r *PostgresRepository) Create(ctx context.Context, p GoogleProfile, username string) (User, error) {
	u, err := r.getOne(ctx,
		`INSERT INTO users (google_sub, email, display_name, avatar_url, username)
		 VALUES ($1, $2, $3, nullif($4, ''), $5)
		 RETURNING `+userColumns,
		p.Subject, p.Email, p.DisplayName, p.AvatarURL, username)
	switch constraintViolated(err) {
	case "users_username_key":
		return User{}, errUsernameTaken
	case "users_google_sub_key":
		return r.UpdateGoogleProfile(ctx, p)
	}
	return u, err
}

// UpdateProfile changes the fields that are set (nil = keep) in one statement.
// Setting a display name marks it as customized so sign-in keeps it.
func (r *PostgresRepository) UpdateProfile(ctx context.Context, id int64, p ProfileUpdate) (User, error) {
	u, err := r.getOne(ctx,
		`UPDATE users SET
		     username = coalesce($2, username),
		     display_name = coalesce($3, display_name),
		     display_name_customized = display_name_customized OR $3::text IS NOT NULL,
		     show_presence = coalesce($4, show_presence),
		     updated_at = now()
		 WHERE id = $1
		 RETURNING `+userColumns,
		id, p.Username, p.DisplayName, p.ShowPresence)
	if constraintViolated(err) == "users_username_key" {
		return User{}, errUsernameTaken
	}
	return u, err
}

// CreateGuest inserts a guest user. It returns errUsernameTaken if the
// generated username is already used.
func (r *PostgresRepository) CreateGuest(ctx context.Context, displayName, username string) (User, error) {
	u, err := r.getOne(ctx,
		`INSERT INTO users (display_name, username, is_guest) VALUES ($1, $2, true)
		 RETURNING `+userColumns,
		displayName, username)
	if constraintViolated(err) == "users_username_key" {
		return User{}, errUsernameTaken
	}
	return u, err
}

// DeleteAbandonedGuests removes guests older than olderThan that never sent
// a message (with their sessions). Guests who did write stay, so the owner
// keeps the conversation.
func (r *PostgresRepository) DeleteAbandonedGuests(ctx context.Context, olderThan time.Duration) (int64, error) {
	tag, err := r.db.Exec(ctx,
		`DELETE FROM users u
		 WHERE u.is_guest
		   AND u.created_at < now() - make_interval(secs => $1)
		   AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.sender_id = u.id)`,
		olderThan.Seconds())
	return tag.RowsAffected(), err
}

// DeleteInactiveGuests removes guests whose chats have had no message for
// inactiveFor, together with those chats (both sides' messages) and their
// sessions. Guests cannot sign back in once their session is gone, so their
// data has no owner left to manage it (ADR 0008).
func (r *PostgresRepository) DeleteInactiveGuests(ctx context.Context, inactiveFor time.Duration) (int64, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after commit

	rows, err := tx.Query(ctx,
		`SELECT u.id FROM users u
		 WHERE u.is_guest
		   AND u.created_at < now() - make_interval(secs => $1)
		   AND NOT EXISTS (
		       SELECT 1 FROM conversation_members cm
		       JOIN messages m ON m.conversation_id = cm.conversation_id
		       WHERE cm.user_id = u.id AND m.created_at >= now() - make_interval(secs => $1))
		 FOR UPDATE OF u`,
		inactiveFor.Seconds())
	if err != nil {
		return 0, err
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil || len(ids) == 0 {
		return 0, err
	}
	// Guests only ever have chats with the owner, so their chats go entirely;
	// messages and memberships follow by ON DELETE CASCADE.
	if _, err := tx.Exec(ctx,
		`DELETE FROM conversations WHERE id IN (
		     SELECT conversation_id FROM conversation_members WHERE user_id = ANY($1))`,
		ids); err != nil {
		return 0, err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM users WHERE id = ANY($1)`, ids)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), tx.Commit(ctx)
}

// SetLastSeen records when the user's last connection closed.
func (r *PostgresRepository) SetLastSeen(ctx context.Context, id int64, at time.Time) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET last_seen_at = $2 WHERE id = $1`, id, at)
	return err
}

func (r *PostgresRepository) SearchByUsernamePrefix(ctx context.Context, prefix string, excludeID int64, limit int) ([]User, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+userColumns+` FROM users
		 WHERE lower(username::text) LIKE $1 AND id <> $2 AND NOT is_guest
		 ORDER BY username
		 LIMIT $3`,
		escapeLike(strings.ToLower(prefix))+"%", excludeID, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (User, error) { return scanUser(row) })
}

func (r *PostgresRepository) getOne(ctx context.Context, sql string, args ...any) (User, error) {
	u, err := scanUser(r.db.QueryRow(ctx, sql, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, apperr.ErrNotFound
	}
	return u, err
}

func scanUser(row pgx.Row) (User, error) {
	var u User
	err := row.Scan(&u.ID, &u.GoogleSub, &u.Email, &u.DisplayName, &u.AvatarURL, &u.Username, &u.IsGuest,
		&u.ShowPresence, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

// constraintViolated returns the name of the unique constraint err violated, or "".
func constraintViolated(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return pgErr.ConstraintName
	}
	return ""
}

// escapeLike neutralizes LIKE wildcards in user input.
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}
