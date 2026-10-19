package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// flowState is what we must remember between redirecting to Google and the
// callback. It travels in a short-lived HttpOnly cookie, signed with HMAC so
// it cannot be forged or altered.
type flowState struct {
	State    string `json:"s"`
	Nonce    string `json:"n"`
	Verifier string `json:"v"` // PKCE code verifier
	Next     string `json:"r"`
	Expires  int64  `json:"e"`
}

var errBadFlowState = errors.New("invalid oauth flow state")

func encodeFlowState(fs flowState, secret []byte) (string, error) {
	payload, err := json.Marshal(fs)
	if err != nil {
		return "", err
	}
	p := base64.RawURLEncoding.EncodeToString(payload)
	return p + "." + sign(p, secret), nil
}

func decodeFlowState(value string, secret []byte, now time.Time) (flowState, error) {
	p, sig, ok := strings.Cut(value, ".")
	if !ok || !hmac.Equal([]byte(sig), []byte(sign(p, secret))) {
		return flowState{}, errBadFlowState
	}
	payload, err := base64.RawURLEncoding.DecodeString(p)
	if err != nil {
		return flowState{}, errBadFlowState
	}
	var fs flowState
	if err := json.Unmarshal(payload, &fs); err != nil || now.Unix() > fs.Expires {
		return flowState{}, errBadFlowState
	}
	return fs, nil
}

func sign(payload string, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte("oauth-flow:" + payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// safeNext accepts only same-app paths, preventing open redirects (PRD §6.8).
func safeNext(next string) string {
	if next == "" || !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") ||
		strings.HasPrefix(next, `/\`) || strings.ContainsAny(next, "\r\n") {
		return "/"
	}
	return next
}
