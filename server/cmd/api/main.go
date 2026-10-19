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
	"github.com/tosrv/personal-messenger/server/internal/database"
	"github.com/tosrv/personal-messenger/server/internal/httpapi"
	"github.com/tosrv/personal-messenger/server/internal/user"
)

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

	go cleanExpiredSessions(ctx, sessions, logger)

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: httpapi.NewRouter(cfg, httpapi.Deps{
			Pool: pool, Logger: logger, Sessions: sessions, Auth: authHandler, Users: users,
		}),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("server listening", "addr", srv.Addr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server error", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err)
	}
	logger.Info("server stopped")
}

func cleanExpiredSessions(ctx context.Context, sessions *auth.SessionStore, logger *slog.Logger) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if n, err := sessions.DeleteExpired(ctx); err != nil && ctx.Err() == nil {
			logger.Error("clean expired sessions", "err", err)
		} else if n > 0 {
			logger.Info("cleaned expired sessions", "count", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
