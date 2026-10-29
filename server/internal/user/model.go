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
	IsGuest     bool // no Google account; may only chat with the owner (ADR 0008)
	// ShowPresence is the privacy setting for online status / last seen (ADR 0010).
	ShowPresence bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// PublicProfile is what other users may see.
type PublicProfile struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url,omitempty"`
	IsGuest     bool   `json:"is_guest,omitempty"`
}

// Me is the signed-in user's view of their own account.
type Me struct {
	PublicProfile
	Email        string `json:"email,omitempty"` // empty for guests
	ShowPresence bool   `json:"show_presence"`
}

func (u User) Me() Me {
	return Me{PublicProfile: u.Public(), Email: u.Email, ShowPresence: u.ShowPresence}
}

func (u User) Public() PublicProfile {
	return PublicProfile{
		ID: u.ID, Username: u.Username, DisplayName: u.DisplayName, AvatarURL: u.AvatarURL, IsGuest: u.IsGuest,
	}
}

// ProfileUpdate holds the fields a user may change; nil means unchanged.
type ProfileUpdate struct {
	Username     *string
	DisplayName  *string
	ShowPresence *bool
}

// GoogleProfile is the data needed to create or refresh a user from Google.
type GoogleProfile struct {
	Subject     string
	Email       string
	DisplayName string
	AvatarURL   string
}
