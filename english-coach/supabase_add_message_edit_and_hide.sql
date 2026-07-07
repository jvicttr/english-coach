-- Marca de mensagem editada
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;

-- Oculta mensagens "so para mim" — sem afetar a visao de quem enviou
CREATE TABLE IF NOT EXISTS message_hidden_for (
  message_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  hidden_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_for_user ON message_hidden_for(user_id);
