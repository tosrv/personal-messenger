package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/tosrv/personal-messenger/server/internal/auth"
	"github.com/tosrv/personal-messenger/server/internal/config"
	"github.com/tosrv/personal-messenger/server/internal/conversation"
	"github.com/tosrv/personal-messenger/server/internal/database"
	"github.com/tosrv/personal-messenger/server/internal/httpapi"
	"github.com/tosrv/personal-messenger/server/internal/message"
	"github.com/tosrv/personal-messenger/server/internal/realtime"
	"github.com/tosrv/personal-messenger/server/internal/user"
)

// version is set at build time (-ldflags "-X main.version=...").
var version = "dev"

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := database.Migrate(cfg.DatabaseURL, cfg.MigrationsDir); err != nil {
		logger.Error("run migrations", "err", err)
		os.Exit(1)
	}

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("connect database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	sessions := auth.NewSessionStore(pool)
	users := user.NewService(user.NewPostgresRepository(pool))
	conversations := conversation.NewService(conversation.NewPostgresRepository(pool), users, cfg.OwnerUsername)
	hub := realtime.NewHub()
	notifier := realtime.NewNotifier(hub, conversations, logger)
	conversations.SetReadNotifier(notifier)
	messages := message.NewService(message.NewPostgresRepository(pool), conversations, notifier)

	var authHandler *auth.Handler
	if cfg.GoogleClientID != "" {
		authHandler, err = auth.NewHandler(ctx, auth.Config{
			ClientID:      cfg.GoogleClientID,
			ClientSecret:  cfg.GoogleClientSecret,
			RedirectURL:   cfg.GoogleRedirectURL,
			SessionSecret: []byte(cfg.SessionSecret),
			SecureCookies: cfg.IsProduction(),
		}, sessions, users, logger)
		if err != nil {
			logger.Error("init google sign-in", "err", err)
			os.Exit(1)
		}
	} else {
		logger.Warn("GOOGLE_CLIENT_ID is empty; sign-in is disabled")
	}

	if cfg.OwnerUsername == "" {
		logger.Warn("OWNER_USERNAME is empty; guest mode is disabled")
	}

	go cleanUp(ctx, sessions, users, logger)

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: httpapi.NewRouter(cfg, httpapi.Deps{
			Pool: pool, Logger: logger, Sessions: sessions, Auth: authHandler,
			Users: users, Conversations: conversations, Messages: messages, Hub: hub,
		}),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("server listening", "addr", srv.Addr, "env", cfg.Env, "version", version)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server error", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	// Shutdown does not wait for hijacked WebSocket connections; close them
	// so clients reconnect (and resync) as soon as the server is back.
	hub.CloseAll()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err)
	}
	logger.Info("server stopped")
}

// Guest retention (ADR 0008): guests who never wrote are removed after a
// week; any guest chat is removed after 90 days without a new message.
const (
	abandonedGuestAge = 7 * 24 * time.Hour
	inactiveGuestAge  = 90 * 24 * time.Hour
)

// cleanUp removes expired sessions and abandoned guest accounts every hour.
func cleanUp(ctx context.Context, sessions *auth.SessionStore, users *user.Service, logger *slog.Logger) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if n, err := sessions.DeleteExpired(ctx); err != nil && ctx.Err() == nil {
			logger.Error("clean expired sessions", "err", err)
		} else if n > 0 {
			logger.Info("cleaned expired sessions", "count", n)
		}
		if n, err := users.DeleteAbandonedGuests(ctx, abandonedGuestAge); err != nil && ctx.Err() == nil {
			logger.Error("clean abandoned guests", "err", err)
		} else if n > 0 {
			logger.Info("cleaned abandoned guests", "count", n)
		}
		if n, err := users.DeleteInactiveGuests(ctx, inactiveGuestAge); err != nil && ctx.Err() == nil {
			logger.Error("clean inactive guests", "err", err)
		} else if n > 0 {
			logger.Info("cleaned inactive guests", "count", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
