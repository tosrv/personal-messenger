# Production image: Go API + built React frontend in one container.
# Published as ghcr.io/tosrv/personal-messenger by .github/workflows/ci.yml.
# (server/Dockerfile builds the API alone for local development.)

# --- Frontend -----------------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Backend ------------------------------------------------------------------
FROM golang:1.26-alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/api ./cmd/api

# --- Runtime ------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=server /out/api /app/api
COPY server/migrations /app/migrations
COPY --from=web /web/dist /app/web
ENV APP_ENV=production \
    PORT=8080 \
    MIGRATIONS_DIR=/app/migrations \
    STATIC_DIR=/app/web
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/app/api"]
