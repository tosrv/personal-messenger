package conversation

import (
	"context"
	"fmt"
	"strings"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/user"
)

type Repository interface {
	GetOrCreateDirect(ctx context.Context, a, b int64) (int64, error)
	IsMember(ctx context.Context, conversationID, userID int64) (bool, error)
	MemberIDs(ctx context.Context, conversationID int64) ([]int64, error)
	ListForUser(ctx context.Context, userID int64) ([]Summary, error)
	GetForUser(ctx context.Context, conversationID, userID int64) (Summary, error)
	MarkRead(ctx context.Context, conversationID, userID, messageID int64) error
	ClearForUser(ctx context.Context, conversationID, userID int64) (bool, error)
	VisibleFrom(ctx context.Context, conversationID, userID int64) (int64, error)
}

// UserLookup resolves users (implemented by user.Service).
type UserLookup interface {
	GetProfile(ctx context.Context, username string) (user.PublicProfile, error)
	Me(ctx context.Context, userID int64) (user.Me, error)
}

type Service struct {
	repo  Repository
	users UserLookup
	// owner is the username guests may talk to (ADR 0008). Empty = nobody.
	owner string
}

func NewService(repo Repository, users UserLookup, ownerUsername string) *Service {
	return &Service{repo: repo, users: users, owner: ownerUsername}
}

var errGuestsOwnerOnly = fmt.Errorf("%w: guests can only chat with the owner", apperr.ErrForbidden)

func (s *Service) isOwner(username string) bool {
	return s.owner != "" && strings.EqualFold(username, s.owner)
}

// StartDirect opens the viewer's conversation with username, creating it if
// it does not exist yet (PRD §6.4).
func (s *Service) StartDirect(ctx context.Context, viewerID int64, username string) (Summary, error) {
	peer, err := s.users.GetProfile(ctx, username)
	if err != nil {
		return Summary{}, err
	}
	if peer.ID == viewerID {
		return Summary{}, fmt.Errorf("%w: you cannot start a conversation with yourself", apperr.ErrInvalidInput)
	}
	// Guests only ever talk to the owner, in both directions (ADR 0008).
	viewer, err := s.users.Me(ctx, viewerID)
	if err != nil {
		return Summary{}, fmt.Errorf("load viewer: %w", err)
	}
	if viewer.IsGuest && !s.isOwner(peer.Username) {
		return Summary{}, errGuestsOwnerOnly
	}
	if peer.IsGuest && !s.isOwner(viewer.Username) {
		return Summary{}, errGuestsOwnerOnly
	}
	id, err := s.repo.GetOrCreateDirect(ctx, viewerID, peer.ID)
	if err != nil {
		return Summary{}, fmt.Errorf("get or create conversation: %w", err)
	}
	return s.repo.GetForUser(ctx, id, viewerID)
}

func (s *Service) List(ctx context.Context, viewerID int64) ([]Summary, error) {
	return s.repo.ListForUser(ctx, viewerID)
}

func (s *Service) Get(ctx context.Context, viewerID, conversationID int64) (Summary, error) {
	return s.repo.GetForUser(ctx, conversationID, viewerID)
}

func (s *Service) MarkRead(ctx context.Context, viewerID, conversationID, messageID int64) error {
	if err := s.RequireMember(ctx, conversationID, viewerID); err != nil {
		return err
	}
	return s.repo.MarkRead(ctx, conversationID, viewerID, messageID)
}

// DeleteForMe removes the chat from the viewer's list and hides its history
// from them only, like WhatsApp's "delete chat". It reappears, without the
// old messages, when a new message arrives or the viewer opens it again.
func (s *Service) DeleteForMe(ctx context.Context, viewerID, conversationID int64) error {
	ok, err := s.repo.ClearForUser(ctx, conversationID, viewerID)
	if err != nil {
		return fmt.Errorf("delete chat: %w", err)
	}
	if !ok {
		return apperr.ErrNotFound
	}
	return nil
}

// VisibleFrom implements message.Membership: it returns the id after which
// the user may read messages, or ErrNotFound if they are not a member.
func (s *Service) VisibleFrom(ctx context.Context, conversationID, userID int64) (int64, error) {
	return s.repo.VisibleFrom(ctx, conversationID, userID)
}

// MemberIDs lists the users in a conversation, for routing real-time events.
func (s *Service) MemberIDs(ctx context.Context, conversationID int64) ([]int64, error) {
	return s.repo.MemberIDs(ctx, conversationID)
}

// RequireMember returns ErrNotFound unless userID belongs to the conversation.
// Not-found (rather than forbidden) avoids revealing which conversations exist.
func (s *Service) RequireMember(ctx context.Context, conversationID, userID int64) error {
	ok, err := s.repo.IsMember(ctx, conversationID, userID)
	if err != nil {
		return fmt.Errorf("check membership: %w", err)
	}
	if !ok {
		return apperr.ErrNotFound
	}
	return nil
}
