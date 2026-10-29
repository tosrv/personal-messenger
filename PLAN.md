# Phase 2 plan (branch `claude/fase-2`)

Design: [ADR 0009](docs/adr/0009-realtime-events-phase-2.md), [ADR 0010](docs/adr/0010-presence-and-receipt-privacy.md). Assumptions and results: [NOTES.md](NOTES.md).

- [x] 0. ADRs 0009 and 0010
- [x] 1. Typing indicator: WebSocket only, throttled in the client, shown with a timeout
- [x] 2. Read receipts
- [ ] 3. Online status / last seen, with a privacy toggle in profile settings
- [ ] 4. In-app notifications: tab title badge, optional sound, Notification API while the tab is hidden (no Web Push)
- [ ] 5. Update docs/realtime.md and README, write the summary in NOTES.md

After each feature: Go `gofmt`, `go vet`, tests (with `TEST_DATABASE_URL`) and build; web `npm run check` and `npm run build`; then commit.
