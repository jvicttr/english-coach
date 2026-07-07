-- Oculta uma conversa "so para mim" na lista de mensagens (nao apaga para o outro usuario).
-- Se chegar mensagem nova depois de ocultar, a conversa volta a aparecer.
CREATE TABLE IF NOT EXISTS conversation_hidden_for (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  hidden_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_hidden_for_user ON conversation_hidden_for(user_id);
