package user

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
)

const userColumns = `id, google_sub, email, display_name, coalesce(avatar_url, ''), username, created_at, updated_at`

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
// Accounts are matched by google_sub, never by email (PRD §6.1).
func (r *PostgresRepository) UpdateGoogleProfile(ctx context.Context, p GoogleProfile) (User, error) {
	return r.getOne(ctx,
		`UPDATE users SET email = $2, display_name = $3, avatar_url = nullif($4, ''), updated_at = now()
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

func (r *PostgresRepository) UpdateUsername(ctx context.Context, id int64, username string) (User, error) {
	u, err := r.getOne(ctx,
		`UPDATE users SET username = $2, updated_at = now() WHERE id = $1 RETURNING `+userColumns,
		id, username)
	if constraintViolated(err) == "users_username_key" {
		return User{}, errUsernameTaken
	}
	return u, err
}

func (r *PostgresRepository) SearchByUsernamePrefix(ctx context.Context, prefix string, excludeID int64, limit int) ([]User, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+userColumns+` FROM users
		 WHERE lower(username::text) LIKE $1 AND id <> $2
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
	err := row.Scan(&u.ID, &u.GoogleSub, &u.Email, &u.DisplayName, &u.AvatarURL, &u.Username, &u.CreatedAt, &u.UpdatedAt)
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
