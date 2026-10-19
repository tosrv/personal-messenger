package user

import "time"

// User is the full record. It contains private fields (GoogleSub, Email)
// and must never be serialized to other users — use PublicProfile.
type User struct {
	ID          int64
	GoogleSub   string
	Email       string
	DisplayName string
	AvatarURL   string
	Username    string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// PublicProfile is what other users may see.
type PublicProfile struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}

func (u User) Public() PublicProfile {
	return PublicProfile{ID: u.ID, Username: u.Username, DisplayName: u.DisplayName, AvatarURL: u.AvatarURL}
}
