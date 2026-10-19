package user

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/rahmattomy/personal-messenger/server/internal/apperr"
)

const (
	minQueryLen   = 2
	maxQueryLen   = 32
	maxSearchSize = 20
)

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

// Repository is defined here, by its consumer, so the service can be tested
// with a fake and does not depend on pgx.
type Repository interface {
	GetByUsername(ctx context.Context, username string) (User, error)
	SearchByUsernamePrefix(ctx context.Context, prefix string, excludeID int64, limit int) ([]User, error)
}

// Service holds user business rules. It knows nothing about HTTP.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetProfile(ctx context.Context, username string) (PublicProfile, error) {
	username = strings.TrimSpace(username)
	if !usernamePattern.MatchString(username) {
		return PublicProfile{}, apperr.ErrNotFound
	}
	u, err := s.repo.GetByUsername(ctx, username)
	if err != nil {
		return PublicProfile{}, err
	}
	return u.Public(), nil
}

// Search finds users by username prefix. viewerID is excluded so users never
// get an option to message themselves (0 = anonymous, excludes nobody).
func (s *Service) Search(ctx context.Context, query string, viewerID int64) ([]PublicProfile, error) {
	query = strings.TrimPrefix(strings.TrimSpace(query), "@")
	if len(query) < minQueryLen || len(query) > maxQueryLen || !usernamePattern.MatchString(query) {
		return nil, fmt.Errorf("%w: query must be %d-%d letters, digits or underscores",
			apperr.ErrInvalidInput, minQueryLen, maxQueryLen)
	}
	users, err := s.repo.SearchByUsernamePrefix(ctx, query, viewerID, maxSearchSize)
	if err != nil {
		return nil, fmt.Errorf("search users: %w", err)
	}
	out := make([]PublicProfile, 0, len(users))
	for _, u := range users {
		out = append(out, u.Public())
	}
	return out, nil
}
