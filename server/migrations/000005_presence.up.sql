-- Online status / last seen (ADR 0009, ADR 0010). Additive only:
--   show_presence: the user's privacy setting; reciprocal (when off, they
--                  neither show nor see presence). Constant default, so
--                  existing rows need no rewrite.
--   last_seen_at:  when the user's last WebSocket closed; NULL = never seen.
ALTER TABLE users
    ADD COLUMN show_presence BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN last_seen_at TIMESTAMPTZ;
