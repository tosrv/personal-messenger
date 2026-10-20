-- Once a user edits their display name, sign-in must stop overwriting it
-- with the name from their Google account.
ALTER TABLE users
    ADD COLUMN display_name_customized BOOLEAN NOT NULL DEFAULT false;
