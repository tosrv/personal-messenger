package user

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/auth"
)

const (
	minQueryLen         = 2
	maxQueryLen         = 32
	maxSearchSize       = 20
	maxUsernameAttempts = 10
)

var queryPattern = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

// Repository is defined here, by its consumer, so the service can be tested
// with a fake and does not depend on pgx.
type Repository interface {
	GetByID(ctx context.Context, id int64) (User, error)
	GetByUsername(ctx context.Context, username string) (User, error)
	UpdateGoogleProfile(ctx context.Context, p GoogleProfile) (User, error)
	Create(ctx context.Context, p GoogleProfile, username string) (User, error)
	UpdateProfile(ctx context.Context, id int64, p ProfileUpdate) (User, error)
	SearchByUsernamePrefix(ctx context.Context, prefix string, excludeID int64, limit int) ([]User, error)
	CreateGuest(ctx context.Context, displayName, username string) (User, error)
	DeleteAbandonedGuests(ctx context.Context, olderThan time.Duration) (int64, error)
	DeleteInactiveGuests(ctx context.Context, inactiveFor time.Duration) (int64, error)
	SetLastSeen(ctx context.Context, id int64, at time.Time) error
}

// PresenceListener is told when a user changes their presence setting, so
// contacts can be updated right away (implemented by realtime.Presence).
type PresenceListener interface {
	PresenceSettingChanged(ctx context.Context, userID int64)
}

// Service holds user business rules. It knows nothing about HTTP.
type Service struct {
	repo     Repository
	presence PresenceListener
}

// SetPresenceListener wires presence updates; nil disables them.
func (s *Service) SetPresenceListener(l PresenceListener) { s.presence = l }

// SetLastSeen records when the user's last connection closed (ADR 0009).
func (s *Service) SetLastSeen(ctx context.Context, userID int64, at time.Time) error {
	return s.repo.SetLastSeen(ctx, userID, at)
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// EnsureGoogleUser implements auth.UserProvisioner: it refreshes the profile of
// an existing account, or creates one with a generated, editable username.
func (s *Service) EnsureGoogleUser(ctx context.Context, id auth.GoogleIdentity) (int64, error) {
	p := GoogleProfile{
		Subject:     id.Subject,
		Email:       id.Email,
		DisplayName: strings.TrimSpace(id.Name),
		AvatarURL:   id.AvatarURL,
	}
	if p.DisplayName == "" {
		p.DisplayName, _, _ = strings.Cut(p.Email, "@")
	}

	u, err := s.repo.UpdateGoogleProfile(ctx, p)
	if err == nil {
		return u.ID, nil
	}
	if !errors.Is(err, apperr.ErrNotFound) {
		return 0, fmt.Errorf("refresh google profile: %w", err)
	}

	base := usernameBase(p.Email, p.DisplayName)
	for attempt := range maxUsernameAttempts {
		u, err := s.repo.Create(ctx, p, usernameCandidate(base, attempt))
		if errors.Is(err, errUsernameTaken) {
			continue
		}
		if err != nil {
			return 0, fmt.Errorf("create user: %w", err)
		}
		return u.ID, nil
	}
	return 0, fmt.Errorf("create user: no free username for base %q", base)
}

// CreateGuest makes a guest account (ADR 0008) with a generated username such
// as guest_4821 and the display name the visitor chose.
func (s *Service) CreateGuest(ctx context.Context, displayName string) (int64, error) {
	name, err := normalizeDisplayName(displayName)
	if err != nil {
		return 0, fmt.Errorf("%w: %s", apperr.ErrInvalidInput, err)
	}
	for attempt := range maxUsernameAttempts {
		u, err := s.repo.CreateGuest(ctx, name, usernameCandidate(guestUsernameBase, attempt+1))
		if errors.Is(err, errUsernameTaken) {
			continue
		}
		if err != nil {
			return 0, fmt.Errorf("create guest: %w", err)
		}
		return u.ID, nil
	}
	return 0, fmt.Errorf("create guest: no free username")
}

// DeleteInactiveGuests removes guests (and their chats) with no message for inactiveFor.
func (s *Service) DeleteInactiveGuests(ctx context.Context, inactiveFor time.Duration) (int64, error) {
	return s.repo.DeleteInactiveGuests(ctx, inactiveFor)
}

// IsGuest reports whether userID is a guest account.
func (s *Service) IsGuest(ctx context.Context, userID int64) (bool, error) {
	u, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return false, err
	}
	return u.IsGuest, nil
}

// DeleteAbandonedGuests removes guests older than olderThan who never wrote.
func (s *Service) DeleteAbandonedGuests(ctx context.Context, olderThan time.Duration) (int64, error) {
	return s.repo.DeleteAbandonedGuests(ctx, olderThan)
}

func (s *Service) Me(ctx context.Context, userID int64) (Me, error) {
	u, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return Me{}, err
	}
	return u.Me(), nil
}

// UpdateProfile changes the username, display name and/or presence setting.
// Fields left nil are unchanged; at least one must be set.
func (s *Service) UpdateProfile(ctx context.Context, userID int64, p ProfileUpdate) (Me, error) {
	if p.Username == nil && p.DisplayName == nil && p.ShowPresence == nil {
		return Me{}, fmt.Errorf("%w: nothing to update", apperr.ErrInvalidInput)
	}
	if p.Username != nil {
		// Guest usernames are generated and fixed; only their name can change.
		if guest, err := s.IsGuest(ctx, userID); err != nil {
			return Me{}, err
		} else if guest {
			return Me{}, fmt.Errorf("%w: guests cannot change their username", apperr.ErrForbidden)
		}
		username := strings.TrimPrefix(strings.TrimSpace(*p.Username), "@")
		if err := validateUsername(username); err != nil {
			return Me{}, fmt.Errorf("%w: %s", apperr.ErrInvalidInput, err)
		}
		p.Username = &username
	}
	if p.DisplayName != nil {
		name, err := normalizeDisplayName(*p.DisplayName)
		if err != nil {
			return Me{}, fmt.Errorf("%w: %s", apperr.ErrInvalidInput, err)
		}
		p.DisplayName = &name
	}
	u, err := s.repo.UpdateProfile(ctx, userID, p)
	if errors.Is(err, errUsernameTaken) {
		return Me{}, fmt.Errorf("%w: username is already taken", apperr.ErrConflict)
	}
	if err != nil {
		return Me{}, err
	}
	if p.ShowPresence != nil && s.presence != nil {
		s.presence.PresenceSettingChanged(ctx, userID)
	}
	return u.Me(), nil
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

// Search finds users by username prefix, excluding the viewer so users are
// never offered a conversation with themselves (PRD §6.3).
func (s *Service) Search(ctx context.Context, query string, viewerID int64) ([]PublicProfile, error) {
	query = strings.TrimPrefix(strings.TrimSpace(query), "@")
	if len(query) < minQueryLen || len(query) > maxQueryLen || !queryPattern.MatchString(query) {
		return nil, fmt.Errorf("%w: query must be %d-%d letters, digits or underscores",
			apperr.ErrInvalidInput, minQueryLen, maxQueryLen)
	}
	// Guests may only talk to the owner, so they cannot look anyone up.
	if guest, err := s.IsGuest(ctx, viewerID); err != nil {
		return nil, err
	} else if guest {
		return nil, apperr.ErrForbidden
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
