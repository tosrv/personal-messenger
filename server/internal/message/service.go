package message

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
)

const (
	MaxBodyLen   = 4000 // characters; matches the CHECK constraint (PRD §8)
	DefaultLimit = 50
	MaxLimit     = 100
)

type Repository interface {
	Create(ctx context.Context, m Message) (stored Message, created bool, err error)
	ListBefore(ctx context.Context, conversationID, before int64, limit int) (Page, error)
	ListAfter(ctx context.Context, conversationID, after int64, limit int) (Page, error)
}

// Membership is satisfied by conversation.Service.
type Membership interface {
	RequireMember(ctx context.Context, conversationID, userID int64) error
}

type Service struct {
	repo    Repository
	members Membership
}

func NewService(repo Repository, members Membership) *Service {
	return &Service{repo: repo, members: members}
}

type SendInput struct {
	ConversationID  int64
	SenderID        int64
	ClientMessageID string
	Body            string
}

// Send validates and stores a message. It is idempotent per
// (sender, client_message_id): a retry returns the original message and
// created=false, so callers must not broadcast it again.
func (s *Service) Send(ctx context.Context, in SendInput) (Message, bool, error) {
	clientID, err := uuid.Parse(in.ClientMessageID)
	if err != nil {
		return Message{}, false, fmt.Errorf("%w: client_message_id must be a UUID", apperr.ErrInvalidInput)
	}
	body := strings.TrimRight(in.Body, " \t\r\n")
	if strings.TrimSpace(body) == "" {
		return Message{}, false, fmt.Errorf("%w: message is empty", apperr.ErrInvalidInput)
	}
	if !utf8.ValidString(body) || utf8.RuneCountInString(body) > MaxBodyLen {
		return Message{}, false, fmt.Errorf("%w: message must be at most %d characters", apperr.ErrInvalidInput, MaxBodyLen)
	}
	if err := s.members.RequireMember(ctx, in.ConversationID, in.SenderID); err != nil {
		return Message{}, false, err
	}

	m, created, err := s.repo.Create(ctx, Message{
		ConversationID:  in.ConversationID,
		SenderID:        in.SenderID,
		ClientMessageID: clientID.String(),
		Body:            body,
	})
	if errors.Is(err, errClientIDReused) {
		return Message{}, false, fmt.Errorf("%w: %s", apperr.ErrConflict, err)
	}
	if err != nil {
		return Message{}, false, fmt.Errorf("store message: %w", err)
	}
	return m, created, nil
}

type ListInput struct {
	ConversationID int64
	ViewerID       int64
	Before         int64 // older than this ID (0 = newest page)
	After          int64 // newer than this ID; takes precedence over Before
	Limit          int
}

func (s *Service) List(ctx context.Context, in ListInput) (Page, error) {
	if err := s.members.RequireMember(ctx, in.ConversationID, in.ViewerID); err != nil {
		return Page{}, err
	}
	limit := in.Limit
	if limit <= 0 {
		limit = DefaultLimit
	}
	limit = min(limit, MaxLimit)
	if in.After > 0 {
		return s.repo.ListAfter(ctx, in.ConversationID, in.After, limit)
	}
	return s.repo.ListBefore(ctx, in.ConversationID, in.Before, limit)
}
