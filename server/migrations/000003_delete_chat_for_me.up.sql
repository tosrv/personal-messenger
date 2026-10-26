-- "Delete chat" is per user (like WhatsApp's "delete for me"): the other
-- member keeps the full history.
--   cleared_message_id: messages with id <= this are hidden from this user.
--   deleted_at:         set while the chat is removed from the user's list;
--                       a new message or reopening the chat brings it back.
ALTER TABLE conversation_members
    ADD COLUMN cleared_message_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN deleted_at TIMESTAMPTZ;
