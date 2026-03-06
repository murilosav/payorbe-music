-- Migration number: 0004 	 2026-03-05
-- Add access_token to playlists for secure client access
ALTER TABLE playlists ADD COLUMN access_token TEXT DEFAULT '';

-- Add index for token lookups
CREATE INDEX IF NOT EXISTS idx_playlists_token ON playlists(access_token);

-- Add rate limit table for login attempts
CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT NOT NULL,
    attempted_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_ip ON login_attempts(ip, attempted_at);
