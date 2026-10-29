package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/tosrv/personal-messenger/server/internal/conversation"
)

const EventPresence = "presence"

// PresenceEvent is the "presence" frame. Unlike Event, its fields are never
// omitted: online=false with last_seen_at=null means "hidden".
type PresenceEvent struct {
	Type       string     `json:"type"`
	UserID     int64      `json:"user_id"`
	Online     bool       `json:"online"`
	LastSeenAt *time.Time `json:"last_seen_at"`
}

// PresenceTracker is told when a user's first connection opens and their
// last one closes.
type PresenceTracker interface {
	Online(ctx context.Context, userID int64)
	Offline(ctx context.Context, userID int64)
}

// LastSeenStore stores when a user was last seen (implemented by user.Service).
type LastSeenStore interface {
	SetLastSeen(ctx context.Context, userID int64, at time.Time) error
}

// AudienceLookup finds who may see a user's presence (conversation.Service).
type AudienceLookup interface {
	PresenceAudience(ctx context.Context, userID int64) (conversation.Audience, error)
}

// Presence announces online status and last seen to the contacts allowed
// to see it (ADR 0009, ADR 0010).
type Presence struct {
	hub      *Hub
	lastSeen LastSeenStore
	audience AudienceLookup
	logger   *slog.Logger
	now      func() time.Time
}

func NewPresence(hub *Hub, lastSeen LastSeenStore, audience AudienceLookup, logger *slog.Logger) *Presence {
	return &Presence{hub: hub, lastSeen: lastSeen, audience: audience, logger: logger, now: time.Now}
}

func (p *Presence) Online(ctx context.Context, userID int64) {
	p.announce(ctx, userID, PresenceEvent{Online: true})
}

func (p *Presence) Offline(ctx context.Context, userID int64) {
	at := p.now().UTC().Truncate(time.Second)
	if err := p.lastSeen.SetLastSeen(ctx, userID, at); err != nil {
		p.logger.Error("presence: store last seen", "user_id", userID, "err", err)
	}
	p.announce(ctx, userID, PresenceEvent{LastSeenAt: &at})
}

// PresenceSettingChanged implements user.PresenceListener. Turning presence
// off sends contacts a "hidden" event; turning it on sends the current state.
func (p *Presence) PresenceSettingChanged(ctx context.Context, userID int64) {
	a, err := p.audience.PresenceAudience(ctx, userID)
	if err != nil {
		p.logger.Error("presence: load audience", "user_id", userID, "err", err)
		return
	}
	ev := PresenceEvent{} // hidden
	if a.Visible {
		if p.hub.IsOnline(userID) {
			ev.Online = true
		} else {
			ev.LastSeenAt = a.LastSeenAt
		}
	}
	p.send(a.ContactIDs, userID, ev)
}

// announce sends ev to the audience, if the user shows their presence.
func (p *Presence) announce(ctx context.Context, userID int64, ev PresenceEvent) {
	a, err := p.audience.PresenceAudience(ctx, userID)
	if err != nil {
		p.logger.Error("presence: load audience", "user_id", userID, "err", err)
		return
	}
	if !a.Visible {
		return
	}
	p.send(a.ContactIDs, userID, ev)
}

func (p *Presence) send(to []int64, userID int64, ev PresenceEvent) {
	if len(to) == 0 {
		return
	}
	ev.Type, ev.UserID = EventPresence, userID
	payload, err := json.Marshal(ev)
	if err != nil {
		p.logger.Error("presence: encode event", "err", err)
		return
	}
	p.hub.SendToUsers(to, payload)
}
