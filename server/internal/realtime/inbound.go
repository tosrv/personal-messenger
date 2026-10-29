package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"slices"
	"time"

	"golang.org/x/time/rate"
)

// Client-to-server frames (ADR 0009). Only "typing" exists; everything that
// changes stored state still goes through the REST API.
const (
	FrameTyping = "typing"

	// frameRate and frameBurst bound how often one connection may send
	// frames. The web client sends at most one typing frame per conversation
	// every 3 s, so this is never reached in normal use.
	frameRate  = rate.Limit(1) // per second
	frameBurst = 5
	// maxStrikes is how many rejected frames (invalid, over the limit, or
	// for a conversation the user is not in) a connection may send before
	// it is closed with a policy violation.
	maxStrikes = 20
)

type clientFrame struct {
	Type           string `json:"type"`
	ConversationID int64  `json:"conversation_id"`
}

// parseFrame decodes and validates one client frame.
func parseFrame(data []byte) (clientFrame, bool) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	var f clientFrame
	if err := dec.Decode(&f); err != nil || dec.More() {
		return clientFrame{}, false
	}
	if f.Type != FrameTyping || f.ConversationID <= 0 {
		return clientFrame{}, false
	}
	return f, true
}

// inbound handles the frames of one connection: it rate-limits them,
// validates them, and counts strikes for rejected ones.
type inbound struct {
	userID  int64
	limiter *rate.Limiter
	strikes int
	members MemberLookup
	hub     *Hub
}

func newInbound(userID int64, members MemberLookup, hub *Hub) *inbound {
	return &inbound{userID: userID, limiter: rate.NewLimiter(frameRate, frameBurst), members: members, hub: hub}
}

// handle processes one frame and reports whether the connection may stay
// open (false once it has used up its strikes).
func (in *inbound) handle(ctx context.Context, data []byte, now time.Time) bool {
	if !in.accept(ctx, data, now) {
		in.strikes++
	}
	return in.strikes <= maxStrikes
}

func (in *inbound) accept(ctx context.Context, data []byte, now time.Time) bool {
	if !in.limiter.AllowN(now, 1) {
		return false
	}
	f, ok := parseFrame(data)
	if !ok {
		return false
	}
	ids, err := in.members.MemberIDs(ctx, f.ConversationID)
	if err != nil || !slices.Contains(ids, in.userID) {
		return false
	}
	// The sender's own tabs don't need to know they are typing.
	others := make([]int64, 0, len(ids)-1)
	for _, id := range ids {
		if id != in.userID {
			others = append(others, id)
		}
	}
	payload, err := json.Marshal(Event{Type: EventTyping, ConversationID: f.ConversationID, UserID: in.userID})
	if err != nil {
		return false
	}
	in.hub.SendToUsers(others, payload)
	return true
}
