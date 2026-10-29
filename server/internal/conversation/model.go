// Package conversation implements direct conversations, membership checks,
// the conversation list, and read state.
package conversation

import "time"

// Peer is the other participant, as seen by the viewer. Never includes email.
type Peer struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url,omitempty"`
	IsGuest     bool   `json:"is_guest,omitempty"`
}

type LastMessage struct {
	ID        int64     `json:"id"`
	SenderID  int64     `json:"sender_id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

// Summary is one row of the viewer's conversation list.
type Summary struct {
	ID                int64        `json:"id"`
	Peer              Peer         `json:"peer"`
	LastMessage       *LastMessage `json:"last_message"`
	UnreadCount       int          `json:"unread_count"`
	LastReadMessageID int64        `json:"last_read_message_id"`
	// PeerLastReadMessageID is the peer's read marker: the viewer's messages
	// up to this id have been read (read receipts, ADR 0009).
	PeerLastReadMessageID int64     `json:"peer_last_read_message_id"`
	CreatedAt             time.Time `json:"created_at"`
}
