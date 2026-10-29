package user

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
	"github.com/tosrv/personal-messenger/server/internal/auth"
)

// fakeRepo is an in-memory Repository.
type fakeRepo struct {
	users       []User
	gotPrefix   string
	gotExcluded int64
}

func (f *fakeRepo) find(match func(User) bool) (int, bool) {
	for i, u := range f.users {
		if match(u) {
			return i, true
		}
	}
	return 0, false
}

func (f *fakeRepo) GetByID(_ context.Context, id int64) (User, error) {
	if i, ok := f.find(func(u User) bool { return u.ID == id }); ok {
		return f.users[i], nil
	}
	return User{}, apperr.ErrNotFound
}

func (f *fakeRepo) GetByUsername(_ context.Context, username string) (User, error) {
	if i, ok := f.find(func(u User) bool { return strings.EqualFold(u.Username, username) }); ok {
		return f.users[i], nil
	}
	return User{}, apperr.ErrNotFound
}

func (f *fakeRepo) UpdateGoogleProfile(_ context.Context, p GoogleProfile) (User, error) {
	i, ok := f.find(func(u User) bool { return u.GoogleSub == p.Subject })
	if !ok {
		return User{}, apperr.ErrNotFound
	}
	f.users[i].Email, f.users[i].DisplayName, f.users[i].AvatarURL = p.Email, p.DisplayName, p.AvatarURL
	return f.users[i], nil
}

func (f *fakeRepo) Create(_ context.Context, p GoogleProfile, username string) (User, error) {
	if _, ok := f.find(func(u User) bool { return strings.EqualFold(u.Username, username) }); ok {
		return User{}, errUsernameTaken
	}
	u := User{ID: int64(len(f.users) + 1), GoogleSub: p.Subject, Email: p.Email,
		DisplayName: p.DisplayName, AvatarURL: p.AvatarURL, Username: username}
	f.users = append(f.users, u)
	return u, nil
}

func (f *fakeRepo) UpdateProfile(_ context.Context, id int64, p ProfileUpdate) (User, error) {
	if p.Username != nil {
		if _, ok := f.find(func(u User) bool { return u.ID != id && strings.EqualFold(u.Username, *p.Username) }); ok {
			return User{}, errUsernameTaken
		}
	}
	i, ok := f.find(func(u User) bool { return u.ID == id })
	if !ok {
		return User{}, apperr.ErrNotFound
	}
	if p.Username != nil {
		f.users[i].Username = *p.Username
	}
	if p.DisplayName != nil {
		f.users[i].DisplayName = *p.DisplayName
	}
	if p.ShowPresence != nil {
		f.users[i].ShowPresence = *p.ShowPresence
	}
	return f.users[i], nil
}

func (f *fakeRepo) SetLastSeen(context.Context, int64, time.Time) error { return nil }

type presenceSpy []int64

func (s *presenceSpy) PresenceSettingChanged(_ context.Context, userID int64) {
	*s = append(*s, userID)
}

func TestUpdateProfile_ShowPresence(t *testing.T) {
	svc := NewService(&fakeRepo{users: []User{{ID: 1, Username: "alice", DisplayName: "Alice", ShowPresence: true}}})
	var spy presenceSpy
	svc.SetPresenceListener(&spy)
	ctx := context.Background()

	off := false
	me, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{ShowPresence: &off})
	if err != nil || me.ShowPresence {
		t.Fatalf("hide presence = %+v, %v", me, err)
	}
	if _, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{DisplayName: ptr("Alice B")}); err != nil {
		t.Fatal(err)
	}
	if len(spy) != 1 || spy[0] != 1 {
		t.Errorf("listener calls = %v, want only the presence change for user 1", spy)
	}
}

func (f *fakeRepo) CreateGuest(_ context.Context, displayName, username string) (User, error) {
	if _, ok := f.find(func(u User) bool { return strings.EqualFold(u.Username, username) }); ok {
		return User{}, errUsernameTaken
	}
	u := User{ID: int64(len(f.users) + 1), DisplayName: displayName, Username: username, IsGuest: true}
	f.users = append(f.users, u)
	return u, nil
}

func (f *fakeRepo) DeleteAbandonedGuests(context.Context, time.Duration) (int64, error) {
	return 0, nil
}

func (f *fakeRepo) DeleteInactiveGuests(context.Context, time.Duration) (int64, error) {
	return 0, nil
}

func (f *fakeRepo) SearchByUsernamePrefix(_ context.Context, prefix string, excludeID int64, _ int) ([]User, error) {
	f.gotPrefix, f.gotExcluded = prefix, excludeID
	var out []User
	for _, u := range f.users {
		if u.ID != excludeID && !u.IsGuest {
			out = append(out, u)
		}
	}
	return out, nil
}

func TestEnsureGoogleUser_CreatesOnceAndMatchesBySubject(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)
	ctx := context.Background()

	id1, err := svc.EnsureGoogleUser(ctx, auth.GoogleIdentity{Subject: "g-1", Email: "Tomy.Apr@gmail.com", Name: "Tomy"})
	if err != nil {
		t.Fatal(err)
	}
	// Same Google account, changed email: must reuse the account (PRD §6.1).
	id2, err := svc.EnsureGoogleUser(ctx, auth.GoogleIdentity{Subject: "g-1", Email: "new@example.com", Name: "Tomy A"})
	if err != nil {
		t.Fatal(err)
	}
	if id1 != id2 || len(repo.users) != 1 {
		t.Fatalf("ids %d/%d, users %d; want same id and 1 user", id1, id2, len(repo.users))
	}
	if u := repo.users[0]; u.Username != "tomy_apr" || u.Email != "new@example.com" {
		t.Errorf("user = %+v", u)
	}
}

func TestEnsureGoogleUser_AddsSuffixWhenUsernameTaken(t *testing.T) {
	repo := &fakeRepo{users: []User{{ID: 1, GoogleSub: "other", Username: "tomy"}}}
	svc := NewService(repo)

	id, err := svc.EnsureGoogleUser(context.Background(), auth.GoogleIdentity{Subject: "g-2", Email: "tomy@example.com"})
	if err != nil {
		t.Fatal(err)
	}
	u, _ := repo.GetByID(context.Background(), id)
	if !strings.HasPrefix(u.Username, "tomy") || len(u.Username) != len("tomy")+4 {
		t.Errorf("username = %q, want tomy + 4 digits", u.Username)
	}
}

func ptr(s string) *string { return &s }

func TestUpdateProfile_Username(t *testing.T) {
	repo := &fakeRepo{users: []User{{ID: 1, Username: "alice"}, {ID: 2, Username: "bob"}}}
	svc := NewService(repo)
	ctx := context.Background()

	if _, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{Username: ptr("Bob")}); !errors.Is(err, apperr.ErrConflict) {
		t.Errorf("taken: err = %v, want ErrConflict", err)
	}
	for _, bad := range []string{"ab", "has space", "admin", strings.Repeat("x", 33)} {
		if _, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{Username: ptr(bad)}); !errors.Is(err, apperr.ErrInvalidInput) {
			t.Errorf("%q: err = %v, want ErrInvalidInput", bad, err)
		}
	}
	me, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{Username: ptr(" @alice_2 ")})
	if err != nil || me.Username != "alice_2" {
		t.Errorf("valid change: %+v, %v", me, err)
	}
}

func TestUpdateProfile_DisplayName(t *testing.T) {
	repo := &fakeRepo{users: []User{{ID: 1, Username: "alice", DisplayName: "Alice"}}}
	svc := NewService(repo)
	ctx := context.Background()

	me, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{DisplayName: ptr("  Alice   in\tWonderland  ")})
	if err != nil || me.DisplayName != "Alice in Wonderland" || me.Username != "alice" {
		t.Errorf("normalized: %+v, %v", me, err)
	}
	me, err = svc.UpdateProfile(ctx, 1, ProfileUpdate{DisplayName: ptr("Rahmat Tomy 🚀"), Username: ptr("tomy")})
	if err != nil || me.DisplayName != "Rahmat Tomy 🚀" || me.Username != "tomy" {
		t.Errorf("both fields: %+v, %v", me, err)
	}

	bad := map[string]string{
		"empty":         "   ",
		"too long":      strings.Repeat("é", maxDisplayNameLen+1),
		"control char":  "Al\x07ice",
		"bidi override": "Alice" + string(rune(0x202E)) + "gnp.exe", // right-to-left override
		"zero-width":    "Ali" + string(rune(0x200B)) + "ce",        // zero-width space
		"invalid utf8":  "\xff",
	}
	for name, v := range bad {
		if _, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{DisplayName: ptr(v)}); !errors.Is(err, apperr.ErrInvalidInput) {
			t.Errorf("%s: err = %v, want ErrInvalidInput", name, err)
		}
	}
	if _, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{DisplayName: ptr(strings.Repeat("é", maxDisplayNameLen))}); err != nil {
		t.Errorf("max length rejected: %v", err)
	}
	if _, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{}); !errors.Is(err, apperr.ErrInvalidInput) {
		t.Errorf("empty update: err = %v", err)
	}
}

func TestSearch_RejectsInvalidQuery(t *testing.T) {
	svc := NewService(&fakeRepo{})
	for _, q := range []string{"", "a", "has space", "drop%", "this_query_is_way_too_long_for_a_username"} {
		if _, err := svc.Search(context.Background(), q, 0); !errors.Is(err, apperr.ErrInvalidInput) {
			t.Errorf("Search(%q) err = %v, want ErrInvalidInput", q, err)
		}
	}
}

func TestSearch_NormalizesAndExcludesViewer(t *testing.T) {
	repo := &fakeRepo{users: []User{{ID: 2, Username: "tomy", Email: "secret@example.com"}, {ID: 7, Username: "viewer"}}}
	svc := NewService(repo)

	got, err := svc.Search(context.Background(), "  @tom ", 7)
	if err != nil {
		t.Fatal(err)
	}
	if repo.gotPrefix != "tom" || repo.gotExcluded != 7 {
		t.Errorf("repo called with (%q, %d), want (\"tom\", 7)", repo.gotPrefix, repo.gotExcluded)
	}
	if len(got) != 1 || got[0].Username != "tomy" {
		t.Errorf("got %+v", got)
	}
}

func TestGetProfile_NotFound(t *testing.T) {
	svc := NewService(&fakeRepo{})
	if _, err := svc.GetProfile(context.Background(), "nobody"); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestCreateGuest(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)
	ctx := context.Background()

	id, err := svc.CreateGuest(ctx, "  Budi   Santoso ")
	if err != nil {
		t.Fatal(err)
	}
	u, _ := repo.GetByID(ctx, id)
	if !u.IsGuest || u.DisplayName != "Budi Santoso" || !strings.HasPrefix(u.Username, "guest_") || u.Email != "" {
		t.Errorf("guest = %+v", u)
	}
	if _, err := svc.CreateGuest(ctx, "   "); !errors.Is(err, apperr.ErrInvalidInput) {
		t.Errorf("empty name: err = %v", err)
	}
}

func TestGuestRestrictions(t *testing.T) {
	repo := &fakeRepo{users: []User{
		{ID: 1, Username: "tomy"},
		{ID: 2, Username: "guest_1234", DisplayName: "Budi", IsGuest: true},
	}}
	svc := NewService(repo)
	ctx := context.Background()

	if _, err := svc.Search(ctx, "to", 2); !errors.Is(err, apperr.ErrForbidden) {
		t.Errorf("guest search: err = %v, want ErrForbidden", err)
	}
	if _, err := svc.UpdateProfile(ctx, 2, ProfileUpdate{Username: ptr("budi")}); !errors.Is(err, apperr.ErrForbidden) {
		t.Errorf("guest username change: err = %v, want ErrForbidden", err)
	}
	if me, err := svc.UpdateProfile(ctx, 2, ProfileUpdate{DisplayName: ptr("Budi S")}); err != nil || me.DisplayName != "Budi S" {
		t.Errorf("guest name change: %+v, %v", me, err)
	}
	// Nobody else can claim a guest-looking username.
	for _, name := range []string{"guest", "Guest_9999", "guestbook"} {
		if _, err := svc.UpdateProfile(ctx, 1, ProfileUpdate{Username: ptr(name)}); !errors.Is(err, apperr.ErrInvalidInput) {
			t.Errorf("%q: err = %v, want ErrInvalidInput", name, err)
		}
	}
	if base := usernameBase("guest_7777@gmail.com", ""); !strings.HasPrefix(base, "user") {
		t.Errorf("google user from guest-like email got base %q", base)
	}
}
