package realtime

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/tosrv/personal-messenger/server/internal/message"
)

// Event is the envelope for every server-to-client frame. See docs/realtime.md.
type Event struct {
	Type           string           `json:"type"`
	Message        *message.Message `json:"message,omitempty"`
	ConversationID int64            `json:"conversation_id,omitempty"`
	UserID         int64            `json:"user_id,omitempty"`
	// LastReadMessageID is set on "conversation.read".
	LastReadMessageID int64 `json:"last_read_message_id,omitempty"`
}

const (
	EventMessageNew = "message.new"
	EventTyping     = "typing"
	EventRead       = "conversation.read"
)

// MemberLookup lists a conversation's members (implemented by conversation.Service).
type MemberLookup interface {
	MemberIDs(ctx context.Context, conversationID int64) ([]int64, error)
}

// Notifier implements message.Notifier by pushing "message.new" to every
// member of the conversation, including the sender's other tabs.
type Notifier struct {
	hub     *Hub
	members MemberLookup
	logger  *slog.Logger
}

func NewNotifier(hub *Hub, members MemberLookup, logger *slog.Logger) *Notifier {
	return &Notifier{hub: hub, members: members, logger: logger}
}

func (n *Notifier) MessageCreated(ctx context.Context, m message.Message) {
	// The message is already committed; a failed push only delays delivery
	// until the client's next sync, so errors are logged, not returned.
	ids, err := n.members.MemberIDs(ctx, m.ConversationID)
	if err != nil {
		n.logger.Error("realtime: list members", "conversation_id", m.ConversationID, "err", err)
		return
	}
	payload, err := json.Marshal(Event{Type: EventMessageNew, Message: &m})
	if err != nil {
		n.logger.Error("realtime: encode event", "err", err)
		return
	}
	n.hub.SendToUsers(ids, payload)
}

// ConversationRead implements conversation.ReadNotifier: it tells every
// member (the other one for read receipts, the reader's other tabs for
// unread counts) that userID has read up to lastReadMessageID.
func (n *Notifier) ConversationRead(ctx context.Context, conversationID, userID, lastReadMessageID int64) {
	ids, err := n.members.MemberIDs(ctx, conversationID)
	if err != nil {
		n.logger.Error("realtime: list members", "conversation_id", conversationID, "err", err)
		return
	}
	payload, err := json.Marshal(Event{
		Type: EventRead, ConversationID: conversationID, UserID: userID, LastReadMessageID: lastReadMessageID,
	})
	if err != nil {
		n.logger.Error("realtime: encode event", "err", err)
		return
	}
	n.hub.SendToUsers(ids, payload)
}
