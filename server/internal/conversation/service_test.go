package conversation

import (
	"context"
	"errors"
	"testing"

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
	svc := NewService(repo, users)

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
