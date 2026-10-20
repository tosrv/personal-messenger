package message

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/tosrv/personal-messenger/server/internal/apperr"
)

type fakeRepo struct {
	created    []Message
	gotLimit   int
	gotBefore  int64
	gotAfter   int64
	usedBefore bool
}

func (f *fakeRepo) Create(_ context.Context, m Message) (Message, bool, error) {
	m.ID = int64(len(f.created) + 1)
	f.created = append(f.created, m)
	return m, true, nil
}

func (f *fakeRepo) ListBefore(_ context.Context, _, before int64, limit int) (Page, error) {
	f.usedBefore, f.gotBefore, f.gotLimit = true, before, limit
	return Page{}, nil
}

func (f *fakeRepo) ListAfter(_ context.Context, _, after int64, limit int) (Page, error) {
	f.gotAfter, f.gotLimit = after, limit
	return Page{}, nil
}

// members allows only (conversation 1, user 1).
type members struct{}

func (members) RequireMember(_ context.Context, convID, userID int64) error {
	if convID == 1 && userID == 1 {
		return nil
	}
	return apperr.ErrNotFound
}

const validID = "6f1c2c1e-3a5b-4c1d-9e2f-1a2b3c4d5e6f"

func TestSend_Validation(t *testing.T) {
	svc := NewService(&fakeRepo{}, members{})
	ctx := context.Background()

	cases := map[string]SendInput{
		"bad client id": {ConversationID: 1, SenderID: 1, ClientMessageID: "nope", Body: "hi"},
		"empty body":    {ConversationID: 1, SenderID: 1, ClientMessageID: validID, Body: " \n\t "},
		"too long":      {ConversationID: 1, SenderID: 1, ClientMessageID: validID, Body: strings.Repeat("é", MaxBodyLen+1)},
		"invalid utf8":  {ConversationID: 1, SenderID: 1, ClientMessageID: validID, Body: "\xff"},
	}
	for name, in := range cases {
		if _, _, err := svc.Send(ctx, in); !errors.Is(err, apperr.ErrInvalidInput) {
			t.Errorf("%s: err = %v, want ErrInvalidInput", name, err)
		}
	}
}

func TestSend_RejectsNonMember(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, members{})
	_, _, err := svc.Send(context.Background(), SendInput{ConversationID: 1, SenderID: 2, ClientMessageID: validID, Body: "hi"})
	if !errors.Is(err, apperr.ErrNotFound) || len(repo.created) != 0 {
		t.Errorf("err = %v, created = %d; want ErrNotFound and nothing stored", err, len(repo.created))
	}
}

func TestSend_AcceptsMaxLengthAndTrimsTrailingWhitespace(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, members{})
	body := strings.Repeat("é", MaxBodyLen)
	m, created, err := svc.Send(context.Background(), SendInput{ConversationID: 1, SenderID: 1, ClientMessageID: validID, Body: body + "\n\n"})
	if err != nil || !created || m.Body != body {
		t.Errorf("got %d chars, created=%v, err=%v", len(m.Body), created, err)
	}
}

func TestList_LimitsAndDirection(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, members{})
	ctx := context.Background()

	_, _ = svc.List(ctx, ListInput{ConversationID: 1, ViewerID: 1, Limit: 1000})
	if !repo.usedBefore || repo.gotLimit != MaxLimit {
		t.Errorf("default: before=%v limit=%d", repo.usedBefore, repo.gotLimit)
	}
	_, _ = svc.List(ctx, ListInput{ConversationID: 1, ViewerID: 1, After: 9, Before: 3})
	if repo.gotAfter != 9 || repo.gotLimit != DefaultLimit {
		t.Errorf("after: after=%d limit=%d", repo.gotAfter, repo.gotLimit)
	}
	if _, err := svc.List(ctx, ListInput{ConversationID: 1, ViewerID: 2}); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("non-member: err = %v", err)
	}
}
