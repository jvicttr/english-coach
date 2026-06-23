-- Add new fields to trilha_sessions table for flashcards, quiz, and chat2 state tracking
ALTER TABLE trilha_sessions
ADD COLUMN IF NOT EXISTS flashcard_index INTEGER,
ADD COLUMN IF NOT EXISTS flashcard_flipped BOOLEAN,
ADD COLUMN IF NOT EXISTS quiz_data JSONB;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_trilha_sessions_user_step ON trilha_sessions(user_id, step_id);
