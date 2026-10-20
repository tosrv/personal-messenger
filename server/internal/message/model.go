// Package message implements message persistence, cursor pagination and
// idempotent sends (ADR 0003).
package message

import "time"

type Message struct {
	ID              int64     `json:"id"`
	ConversationID  int64     `json:"conversation_id"`
	SenderID        int64     `json:"sender_id"`
	ClientMessageID string    `json:"client_message_id"`
	Body            string    `json:"body"`
	CreatedAt       time.Time `json:"created_at"`
}

// Page is a slice of history in ascending ID order.
type Page struct {
	Messages []Message `json:"messages"`
	// HasMore reports whether more messages exist beyond this page in the
	// requested direction (older for `before`, newer for `after`).
	HasMore bool `json:"has_more"`
}
