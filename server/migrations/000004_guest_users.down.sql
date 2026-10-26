-- Guests cannot satisfy NOT NULL identity columns, so they are removed first.
DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE is_guest);
DELETE FROM users WHERE is_guest;

DROP INDEX IF EXISTS users_guest_created_at_idx;
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_identity_check,
    DROP COLUMN IF EXISTS is_guest,
    ALTER COLUMN email SET NOT NULL,
    ALTER COLUMN google_sub SET NOT NULL;
