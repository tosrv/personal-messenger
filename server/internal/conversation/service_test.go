package conversation

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/user"
)

type fakeUsers map[string]user.PublicProfile

func (f fakeUsers) GetProfile(_ context.Context, username string) (user.PublicProfile, error) {
	if p, ok := f[username]; ok {
		return p, nil
	}
	return user.PublicProfile{}, apperr.ErrNotFound
}

func (f fakeUsers) Me(_ context.Context, id int64) (user.Me, error) {
	for _, p := range f {
		if p.ID == id {
			return user.Me{PublicProfile: p}, nil
		}
	}
	return user.Me{}, apperr.ErrNotFound
}

type fakeRepo struct {
	Repository // unimplemented methods panic if called
	created    [][2]int64
}

func (f *fakeRepo) GetOrCreateDirect(_ context.Context, a, b int64) (int64, error) {
	f.created = append(f.created, [2]int64{a, b})
	return 10, nil
}

func (f *fakeRepo) GetForUser(_ context.Context, id, _ int64) (Summary, error) {
	return Summary{ID: id}, nil
}

func TestStartDirect(t *testing.T) {
	users := fakeUsers{"tomy": {ID: 1, Username: "tomy"}, "alice": {ID: 2, Username: "alice"}}
	ctx := context.Background()

	repo := &fakeRepo{}
	svc := NewService(repo, users, "tomy")

	if _, err := svc.StartDirect(ctx, 1, "tomy"); !errors.Is(err, apperr.ErrInvalidInput) {
		t.Errorf("self: err = %v, want ErrInvalidInput", err)
	}
	if _, err := svc.StartDirect(ctx, 1, "ghost"); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("unknown user: err = %v, want ErrNotFound", err)
	}
	s, err := svc.StartDirect(ctx, 1, "alice")
	if err != nil || s.ID != 10 || len(repo.created) != 1 || repo.created[0] != [2]int64{1, 2} {
		t.Errorf("start: %+v, %v, calls %v", s, err, repo.created)
	}
}

func TestStartDirect_GuestsOnlyTalkToTheOwner(t *testing.T) {
	users := fakeUsers{
		"tomy":       {ID: 1, Username: "tomy"},
		"alice":      {ID: 2, Username: "alice"},
		"guest_1111": {ID: 3, Username: "guest_1111", IsGuest: true},
		"guest_2222": {ID: 4, Username: "guest_2222", IsGuest: true},
	}
	ctx := context.Background()
	cases := []struct {
		name    string
		viewer  int64
		peer    string
		allowed bool
	}{
		{"guest → owner", 3, "tomy", true},
		{"guest → owner (any case)", 3, "TOMY", true},
		{"guest → regular user", 3, "alice", false},
		{"guest → guest", 3, "guest_2222", false},
		{"owner → guest", 1, "guest_1111", true},
		{"regular user → guest", 2, "guest_1111", false},
		{"regular user → owner", 2, "tomy", true},
	}
	for _, tc := range cases {
		svc := NewService(&fakeRepo{}, caseInsensitive(users), "tomy")
		_, err := svc.StartDirect(ctx, tc.viewer, tc.peer)
		if tc.allowed && err != nil {
			t.Errorf("%s: unexpected error %v", tc.name, err)
		}
		if !tc.allowed && !errors.Is(err, apperr.ErrForbidden) {
			t.Errorf("%s: err = %v, want ErrForbidden", tc.name, err)
		}
	}

	// With no owner configured, guests cannot start any chat.
	svc := NewService(&fakeRepo{}, users, "")
	if _, err := svc.StartDirect(ctx, 3, "tomy"); !errors.Is(err, apperr.ErrForbidden) {
		t.Errorf("no owner: err = %v, want ErrForbidden", err)
	}
}

// caseInsensitive mimics the CITEXT username lookup of the real repository.
type caseInsensitive fakeUsers

func (c caseInsensitive) GetProfile(ctx context.Context, username string) (user.PublicProfile, error) {
	for k, p := range c {
		if strings.EqualFold(k, username) {
			return p, nil
		}
	}
	return user.PublicProfile{}, apperr.ErrNotFound
}

func (c caseInsensitive) Me(ctx context.Context, id int64) (user.Me, error) {
	return fakeUsers(c).Me(ctx, id)
}

type readRepo struct {
	fakeRepo
	members map[int64]bool
	moved   bool
}

func (r *readRepo) IsMember(_ context.Context, _, userID int64) (bool, error) {
	return r.members[userID], nil
}

func (r *readRepo) MarkRead(_ context.Context, _, _, messageID int64) (int64, bool, error) {
	return messageID, r.moved, nil
}

type recordedRead struct{ conversation, user, marker int64 }

type fakeReads []recordedRead

func (f *fakeReads) ConversationRead(_ context.Context, conversationID, userID, marker int64) {
	*f = append(*f, recordedRead{conversationID, userID, marker})
}

func TestMarkReadAnnouncesOnlyAMovedMarker(t *testing.T) {
	ctx := context.Background()
	repo := &readRepo{members: map[int64]bool{1: true}, moved: true}
	svc := NewService(repo, fakeUsers{}, "")
	var reads fakeReads
	svc.SetReadNotifier(&reads)

	if err := svc.MarkRead(ctx, 1, 7, 42); err != nil {
		t.Fatal(err)
	}
	repo.moved = false
	if err := svc.MarkRead(ctx, 1, 7, 42); err != nil {
		t.Fatal(err)
	}
	if err := svc.MarkRead(ctx, 3, 7, 42); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("non-member: err = %v, want not found", err)
	}
	if want := (fakeReads{{7, 1, 42}}); len(reads) != 1 || reads[0] != want[0] {
		t.Errorf("announced %+v, want %+v", reads, want)
	}
}

type onlineSet map[int64]bool

func (o onlineSet) IsOnline(id int64) bool { return o[id] }

type summaryRepo struct {
	fakeRepo
	sum Summary
}

func (r *summaryRepo) GetForUser(context.Context, int64, int64) (Summary, error) { return r.sum, nil }

func TestPeerPresenceRespectsBothSettings(t *testing.T) {
	seen := time.Date(2026, 10, 29, 8, 0, 0, 0, time.UTC)
	base := Summary{ID: 7, Peer: Peer{ID: 2}, peerLastSeenAt: &seen}
	cases := []struct {
		name         string
		viewer, peer bool
		online       bool
		want         *Presence
	}{
		{"both show, peer online", true, true, true, &Presence{Online: true}},
		{"both show, peer offline", true, true, false, &Presence{LastSeenAt: &seen}},
		{"peer hides", true, false, true, nil},
		{"viewer hides (reciprocal)", false, true, true, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			sum := base
			sum.viewerShowsPresence, sum.peerShowsPresence = c.viewer, c.peer
			svc := NewService(&summaryRepo{sum: sum}, fakeUsers{}, "")
			svc.SetOnlineChecker(onlineSet{2: c.online})
			got, err := svc.Get(context.Background(), 1, 7)
			if err != nil {
				t.Fatal(err)
			}
			switch {
			case c.want == nil && got.PeerPresence != nil:
				t.Errorf("presence = %+v, want hidden", got.PeerPresence)
			case c.want != nil && (got.PeerPresence == nil || got.PeerPresence.Online != c.want.Online ||
				(c.want.LastSeenAt == nil) != (got.PeerPresence.LastSeenAt == nil)):
				t.Errorf("presence = %+v, want %+v", got.PeerPresence, c.want)
			}
		})
	}
}
