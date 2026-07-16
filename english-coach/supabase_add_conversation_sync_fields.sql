-- Cross-device "clear saved conversations" signal for free/thematic chat and role-play,
-- whose message history itself is only cached in localStorage (per device). Storing just
-- a cleared-at timestamp per user lets every device detect a clear performed elsewhere.
ALTER TABLE user_xp
ADD COLUMN IF NOT EXISTS chat_cleared_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS roleplay_cleared_at TIMESTAMPTZ;
