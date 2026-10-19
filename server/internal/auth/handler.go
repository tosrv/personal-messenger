package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

const (
	SessionCookie   = "pm_session"
	flowCookie      = "pm_oauth"
	flowCookiePath  = "/api/v1/auth"
	flowStateTTL    = 10 * time.Minute
	googleIssuerURL = "https://accounts.google.com"
)

// GoogleIdentity is the verified data we take from Google's ID token.
type GoogleIdentity struct {
	Subject   string
	Email     string
	Name      string
	AvatarURL string
}

// UserProvisioner finds or creates the internal account for a Google identity.
// Implemented by user.Service; defined here so auth does not import user.
type UserProvisioner interface {
	EnsureGoogleUser(ctx context.Context, id GoogleIdentity) (userID int64, err error)
}

type Config struct {
	ClientID      string
	ClientSecret  string
	RedirectURL   string
	SessionSecret []byte
	SecureCookies bool
}

// Handler implements the Google OpenID Connect sign-in flow and sign-out.
type Handler struct {
	cfg      Config
	oauth    oauth2.Config
	verifier *oidc.IDTokenVerifier
	sessions *SessionStore
	users    UserProvisioner
	logger   *slog.Logger
}

// NewHandler fetches Google's OIDC discovery document, so it needs network access.
func NewHandler(ctx context.Context, cfg Config, sessions *SessionStore, users UserProvisioner, logger *slog.Logger) (*Handler, error) {
	provider, err := oidc.NewProvider(ctx, googleIssuerURL)
	if err != nil {
		return nil, fmt.Errorf("discover google oidc: %w", err)
	}
	return &Handler{
		cfg: cfg,
		oauth: oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			RedirectURL:  cfg.RedirectURL,
			Endpoint:     provider.Endpoint(),
			Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
		},
		verifier: provider.Verifier(&oidc.Config{ClientID: cfg.ClientID}),
		sessions: sessions,
		users:    users,
		logger:   logger,
	}, nil
}

func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/auth/google", h.login)
	rg.GET("/auth/callback", h.callback)
	rg.POST("/auth/logout", h.logout)
}

func (h *Handler) login(c *gin.Context) {
	fs := flowState{
		State:    randomString(),
		Nonce:    randomString(),
		Verifier: oauth2.GenerateVerifier(),
		Next:     safeNext(c.Query("next")),
		Expires:  time.Now().Add(flowStateTTL).Unix(),
	}
	value, err := encodeFlowState(fs, h.cfg.SessionSecret)
	if err != nil {
		h.fail(c, "encode flow state", err)
		return
	}
	h.setCookie(c, flowCookie, value, flowCookiePath, int(flowStateTTL.Seconds()))

	url := h.oauth.AuthCodeURL(fs.State,
		oidc.Nonce(fs.Nonce),
		oauth2.S256ChallengeOption(fs.Verifier),
		oauth2.SetAuthURLParam("prompt", "select_account"),
	)
	c.Redirect(http.StatusFound, url)
}

func (h *Handler) callback(c *gin.Context) {
	ctx := c.Request.Context()

	raw, err := c.Cookie(flowCookie)
	h.setCookie(c, flowCookie, "", flowCookiePath, -1) // single use
	if err != nil {
		h.fail(c, "missing flow cookie", err)
		return
	}
	fs, err := decodeFlowState(raw, h.cfg.SessionSecret, time.Now())
	if err != nil || c.Query("state") != fs.State {
		h.fail(c, "state mismatch", errors.Join(err, errors.New("state check failed")))
		return
	}
	if e := c.Query("error"); e != "" { // e.g. user pressed Cancel on Google
		c.Redirect(http.StatusFound, "/login?error=cancelled&next="+url.QueryEscape(fs.Next))
		return
	}

	tok, err := h.oauth.Exchange(ctx, c.Query("code"), oauth2.VerifierOption(fs.Verifier))
	if err != nil {
		h.fail(c, "exchange code", err)
		return
	}
	rawID, ok := tok.Extra("id_token").(string)
	if !ok {
		h.fail(c, "no id_token", errors.New("token response without id_token"))
		return
	}
	idt, err := h.verifier.Verify(ctx, rawID) // checks signature, iss, aud, exp
	if err != nil {
		h.fail(c, "verify id_token", err)
		return
	}
	if idt.Nonce != fs.Nonce {
		h.fail(c, "nonce mismatch", errors.New("nonce mismatch"))
		return
	}
	var claims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := idt.Claims(&claims); err != nil || !claims.EmailVerified {
		h.fail(c, "unusable claims", errors.Join(err, errors.New("email not verified")))
		return
	}

	userID, err := h.users.EnsureGoogleUser(ctx, GoogleIdentity{
		Subject: idt.Subject, Email: claims.Email, Name: claims.Name, AvatarURL: claims.Picture,
	})
	if err != nil {
		h.fail(c, "provision user", err)
		return
	}
	token, expires, err := h.sessions.Create(ctx, userID)
	if err != nil {
		h.fail(c, "create session", err)
		return
	}
	h.setCookie(c, SessionCookie, token, "/", int(time.Until(expires).Seconds()))
	h.logger.Info("user signed in", "user_id", userID)
	c.Redirect(http.StatusFound, fs.Next)
}

func (h *Handler) logout(c *gin.Context) {
	if token, err := c.Cookie(SessionCookie); err == nil && token != "" {
		if err := h.sessions.Delete(c.Request.Context(), token); err != nil {
			h.logger.Error("delete session", "err", err)
		}
	}
	h.setCookie(c, SessionCookie, "", "/", -1)
	c.Status(http.StatusNoContent)
}

// fail logs the reason server-side and sends the user back to sign-in
// with a generic error, so internal details never reach the browser.
func (h *Handler) fail(c *gin.Context, reason string, err error) {
	h.logger.Warn("oauth callback failed", "reason", reason, "err", err)
	c.Redirect(http.StatusFound, "/login?error=signin_failed")
}

func (h *Handler) setCookie(c *gin.Context, name, value, path string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     path,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   h.cfg.SecureCookies,
		SameSite: http.SameSiteLaxMode,
	})
}

func randomString() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b) // crypto/rand.Read never fails on supported platforms
	return base64.RawURLEncoding.EncodeToString(b)
}
