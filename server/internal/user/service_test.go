package user

import (
	"context"
	"errors"
	"testing"

	"github.com/rahmattomy/personal-messenger/server/internal/apperr"
)

type fakeRepo struct {
	users       []User
	gotPrefix   string
	gotExcluded int64
}

func (f *fakeRepo) GetByUsername(_ context.Context, username string) (User, error) {
	for _, u := range f.users {
		if u.Username == username {
			return u, nil
		}
	}
	return User{}, apperr.ErrNotFound
}

func (f *fakeRepo) SearchByUsernamePrefix(_ context.Context, prefix string, excludeID int64, _ int) ([]User, error) {
	f.gotPrefix, f.gotExcluded = prefix, excludeID
	return f.users, nil
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
