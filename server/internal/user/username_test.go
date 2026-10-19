package user

import "testing"

func TestUsernameBase(t *testing.T) {
	cases := []struct{ email, name, want string }{
		{"Tomy.Apr+x@gmail.com", "", "tomy_apr_x"},
		{"ab@example.com", "", "userab"},
		{"admin@example.com", "", "useradmin"},
		{"", "Rahmat Tomy", "rahmat_tomy"},
		{"a.very.long.local.part.indeed@example.com", "", "a_very_long_local_pa"},
		{"__@example.com", "", "user"},
	}
	for _, tc := range cases {
		got := usernameBase(tc.email, tc.name)
		if got != tc.want {
			t.Errorf("usernameBase(%q, %q) = %q, want %q", tc.email, tc.name, got, tc.want)
		}
		if err := validateUsername(usernameCandidate(got, 1)); err != nil {
			t.Errorf("candidate from %q is invalid: %v", got, err)
		}
	}
}
