// Package realtime pushes events to browsers over WebSocket.
//
// Clients send messages through the REST API, which stores them first
// (ADR 0003, ADR 0006); the only client frame is the ephemeral "typing"
// signal (ADR 0009). The hub keeps an
// in-memory registry of connections per user, which is valid because the
// MVP runs a single backend instance (ADR 0005).
package realtime

import (
	"sync"
)

// sendBuffer is how many events may queue per connection before the client
// is considered too slow and is disconnected. It will resync on reconnect.
const sendBuffer = 64

type client struct {
	userID int64
	send   chan []byte
	// kick is closed when the hub drops the client (slow or shutting down).
	kick     chan struct{}
	kickOnce sync.Once
}

func (c *client) drop() { c.kickOnce.Do(func() { close(c.kick) }) }

// Hub tracks open connections by user and fans events out to them.
type Hub struct {
	mu      sync.RWMutex
	clients map[int64]map[*client]struct{}
}

func NewHub() *Hub {
	return &Hub{clients: make(map[int64]map[*client]struct{})}
}

// register adds a connection. first reports whether it is the user's only
// one, i.e. they just came online.
func (h *Hub) register(userID int64) (c *client, first bool) {
	c = &client{userID: userID, send: make(chan []byte, sendBuffer), kick: make(chan struct{})}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[userID] == nil {
		h.clients[userID] = make(map[*client]struct{})
	}
	h.clients[userID][c] = struct{}{}
	return c, len(h.clients[userID]) == 1
}

// unregister removes a connection. last reports whether the user has no
// connection left, i.e. they just went offline.
func (h *Hub) unregister(c *client) (last bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	set := h.clients[c.userID]
	if set == nil {
		return false
	}
	delete(set, c)
	if len(set) == 0 {
		delete(h.clients, c.userID)
		return true
	}
	return false
}

// IsOnline reports whether the user has at least one open connection.
func (h *Hub) IsOnline(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[userID]) > 0
}

// SendToUsers queues payload for every open connection of the given users.
// It never blocks: a connection whose queue is full is dropped instead.
func (h *Hub) SendToUsers(userIDs []int64, payload []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, id := range userIDs {
		for c := range h.clients[id] {
			select {
			case c.send <- payload:
			default:
				c.drop()
			}
		}
	}
}

// CloseAll disconnects every client, e.g. on server shutdown.
func (h *Hub) CloseAll() {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, set := range h.clients {
		for c := range set {
			c.drop()
		}
	}
}

// Connections returns the number of open connections (for tests and metrics).
func (h *Hub) Connections() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	n := 0
	for _, set := range h.clients {
		n += len(set)
	}
	return n
}
