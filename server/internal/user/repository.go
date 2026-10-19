package user

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rahmattomy/personal-messenger/server/internal/apperr"
)

const userColumns = `id, google_sub, email, display_name, coalesce(avatar_url, ''), username, created_at, updated_at`

// PostgresRepository implements Repository with pgx.
type PostgresRepository struct {
	db *pgxpool.Pool
}

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) GetByUsername(ctx context.Context, username string) (User, error) {
	row := r.db.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE username = $1`, username)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, apperr.ErrNotFound
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

func scanUser(row pgx.Row) (User, error) {
	var u User
	err := row.Scan(&u.ID, &u.GoogleSub, &u.Email, &u.DisplayName, &u.AvatarURL, &u.Username, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

// escapeLike neutralizes LIKE wildcards in user input.
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}
