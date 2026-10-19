package user

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"regexp"
	"strings"
)

const (
	minUsernameLen = 3
	maxUsernameLen = 32
	maxBaseLen     = 20 // leaves room for a numeric suffix
)

var (
	usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_]{3,32}$`)
	invalidChars    = regexp.MustCompile(`[^a-z0-9_]+`)

	// Names that would be confusing as profile links or impersonate the app.
	reservedUsernames = map[string]bool{
		"admin": true, "administrator": true, "api": true, "auth": true, "login": true,
		"logout": true, "me": true, "messenger": true, "root": true, "search": true,
		"settings": true, "support": true, "system": true,
	}
)

// validateUsername checks a username a user picked themselves.
func validateUsername(u string) error {
	if !usernamePattern.MatchString(u) {
		return fmt.Errorf("username must be %d-%d letters, digits or underscores", minUsernameLen, maxUsernameLen)
	}
	if reservedUsernames[strings.ToLower(u)] {
		return fmt.Errorf("username %q is reserved", u)
	}
	return nil
}

// usernameBase derives a valid starting username from the email's local part
// or display name, e.g. "Tomy.Apr+x@gmail.com" → "tomy_apr_x".
func usernameBase(email, displayName string) string {
	src := displayName
	if local, _, ok := strings.Cut(email, "@"); ok && local != "" {
		src = local
	}
	base := strings.Trim(invalidChars.ReplaceAllString(strings.ToLower(src), "_"), "_")
	if len(base) > maxBaseLen {
		base = strings.TrimRight(base[:maxBaseLen], "_")
	}
	if len(base) < minUsernameLen || reservedUsernames[base] {
		base = "user" + base
	}
	return base
}

// usernameCandidate returns the base on the first attempt and adds a random
// 4-digit suffix on later attempts.
func usernameCandidate(base string, attempt int) string {
	if attempt == 0 {
		return base
	}
	n, _ := rand.Int(rand.Reader, big.NewInt(9000))
	return fmt.Sprintf("%s%d", base, n.Int64()+1000)
}
