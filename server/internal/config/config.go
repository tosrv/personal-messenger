// Package config loads application configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Env                string
	Port               string
	DatabaseURL        string
	MigrationsDir      string
	AllowedOrigins     []string
	AppBaseURL         string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	SessionSecret      string
	// TrustedProxies are CIDRs whose X-Forwarded-For is believed (the reverse
	// proxy). Empty means the TCP peer is the client.
	TrustedProxies []string
	// StaticDir holds the built frontend to serve (production image). Empty in
	// development, where Vite serves the frontend.
	StaticDir string
}

func (c Config) IsProduction() bool { return c.Env == "production" }

func Load() (Config, error) {
	cfg := Config{
		Env:                getenv("APP_ENV", "development"),
		Port:               getenv("PORT", "8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		MigrationsDir:      getenv("MIGRATIONS_DIR", "migrations"),
		AllowedOrigins:     splitCSV(getenv("ALLOWED_ORIGINS", "http://localhost:5173")),
		AppBaseURL:         getenv("APP_BASE_URL", "http://localhost:5173"),
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
		SessionSecret:      os.Getenv("SESSION_SECRET"),
		TrustedProxies:     splitCSV(os.Getenv("TRUSTED_PROXIES")),
		StaticDir:          os.Getenv("STATIC_DIR"),
	}
	if cfg.DatabaseURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL is required")
	}
	if len(cfg.SessionSecret) < 32 {
		return cfg, fmt.Errorf("SESSION_SECRET must be at least 32 chars (openssl rand -base64 48)")
	}
	if cfg.GoogleClientID != "" && (cfg.GoogleClientSecret == "" || cfg.GoogleRedirectURL == "") {
		return cfg, fmt.Errorf("GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URL are required with GOOGLE_CLIENT_ID")
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitCSV(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
