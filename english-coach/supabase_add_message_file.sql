-- Anexo de arquivo (PDF) nas mensagens diretas
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_name TEXT;
