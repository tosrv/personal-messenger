-- Guest mode (ADR 0008): visitors can chat with the owner without a Google
-- account. Guests have no Google identity or email; every other user must.
ALTER TABLE users
    ALTER COLUMN google_sub DROP NOT NULL,
    ALTER COLUMN email DROP NOT NULL,
    ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT users_identity_check
        CHECK (is_guest OR (google_sub IS NOT NULL AND email IS NOT NULL));

-- Finds abandoned guests for cleanup.
CREATE INDEX users_guest_created_at_idx ON users (created_at) WHERE is_guest;
