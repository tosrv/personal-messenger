package auth

import (
	"testing"
	"time"
)

func TestFlowState_RoundTrip(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	now := time.Now()
	in := flowState{State: "s", Nonce: "n", Verifier: "v", Next: "/u/tomy", Expires: now.Add(time.Minute).Unix()}

	enc, err := encodeFlowState(in, secret)
	if err != nil {
		t.Fatal(err)
	}
	out, err := decodeFlowState(enc, secret, now)
	if err != nil || out != in {
		t.Fatalf("decode = %+v, %v; want %+v", out, err, in)
	}
}

func TestFlowState_RejectsTamperingExpiryAndWrongKey(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	now := time.Now()
	enc, _ := encodeFlowState(flowState{State: "s", Expires: now.Add(time.Minute).Unix()}, secret)

	cases := map[string]struct {
		value  string
		secret []byte
		now    time.Time
	}{
		"tampered payload": {"x" + enc, secret, now},
		"wrong key":        {enc, []byte("another-secret-another-secret-xx"), now},
		"expired":          {enc, secret, now.Add(2 * time.Minute)},
		"garbage":          {"not-a-cookie", secret, now},
	}
	for name, tc := range cases {
		if _, err := decodeFlowState(tc.value, tc.secret, tc.now); err == nil {
			t.Errorf("%s: expected error", name)
		}
	}
}

func TestSafeNext(t *testing.T) {
	cases := map[string]string{
		"/u/tomy":            "/u/tomy",
		"":                   "/",
		"https://evil.com":   "/",
		"//evil.com":         "/",
		`/\evil.com`:         "/",
		"/ok\r\nSet-Cookie:": "/",
	}
	for in, want := range cases {
		if got := safeNext(in); got != want {
			t.Errorf("safeNext(%q) = %q, want %q", in, got, want)
		}
	}
}
