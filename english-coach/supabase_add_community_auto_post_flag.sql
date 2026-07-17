-- Marca posts gerados automaticamente pelo sistema (ex: post de boas-vindas ao criar conta)
-- para que eles não contem no limite de posts gratuitos nem no badge de "primeiro post".
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_auto_post BOOLEAN NOT NULL DEFAULT false;
