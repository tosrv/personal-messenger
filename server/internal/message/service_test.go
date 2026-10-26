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
	gotFloor   int64
	usedBefore bool
}

func (f *fakeRepo) Create(_ context.Context, m Message) (Message, bool, error) {
	m.ID = int64(len(f.created) + 1)
	f.created = append(f.created, m)
	return m, true, nil
}

func (f *fakeRepo) ListBefore(_ context.Context, _, before, floor int64, limit int) (Page, error) {
	f.usedBefore, f.gotBefore, f.gotFloor, f.gotLimit = true, before, floor, limit
	return Page{}, nil
}

func (f *fakeRepo) ListAfter(_ context.Context, _, after int64, limit int) (Page, error) {
	f.gotAfter, f.gotLimit = after, limit
	return Page{}, nil
}

// members allows only (conversation 1, user 1), who cleared history up to id 5.
type members struct{}

func (members) VisibleFrom(_ context.Context, convID, userID int64) (int64, error) {
	if convID == 1 && userID == 1 {
		return 5, nil
	}
	return 0, apperr.ErrNotFound
}

func (members) RequireMember(_ context.Context, convID, userID int64) error {
	if convID == 1 && userID == 1 {
		return nil
	}
	return apperr.ErrNotFound
}

const validID = "6f1c2c1e-3a5b-4c1d-9e2f-1a2b3c4d5e6f"

func TestSend_Validation(t *testing.T) {
	svc := NewService(&fakeRepo{}, members{}, nil)
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
	svc := NewService(repo, members{}, nil)
	_, _, err := svc.Send(context.Background(), SendInput{ConversationID: 1, SenderID: 2, ClientMessageID: validID, Body: "hi"})
	if !errors.Is(err, apperr.ErrNotFound) || len(repo.created) != 0 {
		t.Errorf("err = %v, created = %d; want ErrNotFound and nothing stored", err, len(repo.created))
	}
}

func TestSend_AcceptsMaxLengthAndTrimsTrailingWhitespace(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, members{}, nil)
	body := strings.Repeat("é", MaxBodyLen)
	m, created, err := svc.Send(context.Background(), SendInput{ConversationID: 1, SenderID: 1, ClientMessageID: validID, Body: body + "\n\n"})
	if err != nil || !created || m.Body != body {
		t.Errorf("got %d chars, created=%v, err=%v", len(m.Body), created, err)
	}
}

type recordingNotifier struct{ got []Message }

func (r *recordingNotifier) MessageCreated(_ context.Context, m Message) { r.got = append(r.got, m) }

// dupRepo reports every create as an idempotent retry.
type dupRepo struct{ fakeRepo }

func (d *dupRepo) Create(_ context.Context, m Message) (Message, bool, error) { return m, false, nil }

func TestSend_NotifiesOnlyNewMessages(t *testing.T) {
	in := SendInput{ConversationID: 1, SenderID: 1, ClientMessageID: validID, Body: "hi"}

	n := &recordingNotifier{}
	if _, _, err := NewService(&fakeRepo{}, members{}, n).Send(context.Background(), in); err != nil || len(n.got) != 1 {
		t.Errorf("new message: notified %d times, err %v", len(n.got), err)
	}

	n = &recordingNotifier{}
	if _, _, err := NewService(&dupRepo{}, members{}, n).Send(context.Background(), in); err != nil || len(n.got) != 0 {
		t.Errorf("retry: notified %d times, err %v", len(n.got), err)
	}
}

func TestList_LimitsAndDirection(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, members{}, nil)
	ctx := context.Background()

	_, _ = svc.List(ctx, ListInput{ConversationID: 1, ViewerID: 1, Limit: 1000})
	if !repo.usedBefore || repo.gotLimit != MaxLimit {
		t.Errorf("default: before=%v limit=%d", repo.usedBefore, repo.gotLimit)
	}
	_, _ = svc.List(ctx, ListInput{ConversationID: 1, ViewerID: 1, After: 9, Before: 3})
	if repo.gotAfter != 9 || repo.gotLimit != DefaultLimit {
		t.Errorf("after: after=%d limit=%d", repo.gotAfter, repo.gotLimit)
	}
	if repo.gotFloor != 5 {
		t.Errorf("before: floor = %d, want the cleared id 5", repo.gotFloor)
	}
	_, _ = svc.List(ctx, ListInput{ConversationID: 1, ViewerID: 1, After: 2})
	if repo.gotAfter != 5 {
		t.Errorf("after 2 with history cleared to 5: after = %d, want 5", repo.gotAfter)
	}
	if _, err := svc.List(ctx, ListInput{ConversationID: 1, ViewerID: 2}); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("non-member: err = %v", err)
	}
}
