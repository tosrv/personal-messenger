package user

import (
	"context"
	"errors"
	"strings"
	"testing"

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

func (f *fakeRepo) UpdateUsername(_ context.Context, id int64, username string) (User, error) {
	if _, ok := f.find(func(u User) bool { return u.ID != id && strings.EqualFold(u.Username, username) }); ok {
		return User{}, errUsernameTaken
	}
	i, ok := f.find(func(u User) bool { return u.ID == id })
	if !ok {
		return User{}, apperr.ErrNotFound
	}
	f.users[i].Username = username
	return f.users[i], nil
}

func (f *fakeRepo) SearchByUsernamePrefix(_ context.Context, prefix string, excludeID int64, _ int) ([]User, error) {
	f.gotPrefix, f.gotExcluded = prefix, excludeID
	return f.users, nil
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

func TestChangeUsername(t *testing.T) {
	repo := &fakeRepo{users: []User{{ID: 1, Username: "alice"}, {ID: 2, Username: "bob"}}}
	svc := NewService(repo)
	ctx := context.Background()

	if _, err := svc.ChangeUsername(ctx, 1, "Bob"); !errors.Is(err, apperr.ErrConflict) {
		t.Errorf("taken: err = %v, want ErrConflict", err)
	}
	for _, bad := range []string{"ab", "has space", "admin", strings.Repeat("x", 33)} {
		if _, err := svc.ChangeUsername(ctx, 1, bad); !errors.Is(err, apperr.ErrInvalidInput) {
			t.Errorf("%q: err = %v, want ErrInvalidInput", bad, err)
		}
	}
	me, err := svc.ChangeUsername(ctx, 1, " @alice_2 ")
	if err != nil || me.Username != "alice_2" {
		t.Errorf("valid change: %+v, %v", me, err)
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
	repo := &fakeRepo{users: []User{{ID: 2, Username: "tomy", Email: "secret@example.com"}}}
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
