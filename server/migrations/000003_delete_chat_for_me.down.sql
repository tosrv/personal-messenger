ALTER TABLE conversation_members
    DROP COLUMN IF EXISTS deleted_at,
    DROP COLUMN IF EXISTS cleared_message_id;
