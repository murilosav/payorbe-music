-- Add temp link support to session_tokens
ALTER TABLE session_tokens ADD COLUMN max_uses INTEGER;
ALTER TABLE session_tokens ADD COLUMN use_count INTEGER DEFAULT 0;
ALTER TABLE session_tokens ADD COLUMN label TEXT;
