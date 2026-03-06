-- Migration number: 0002 	 2026-03-05
-- Create playlists table for organizing music collections
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Create songs table for storing music metadata
CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    artist TEXT DEFAULT 'Desconhecido',
    album TEXT DEFAULT '',
    duration INTEGER DEFAULT 0,
    track_number INTEGER DEFAULT 0,
    folder TEXT DEFAULT '',
    r2_key TEXT NOT NULL,
    cover_r2_key TEXT DEFAULT '',
    file_size INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_songs_playlist ON songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlists_slug ON playlists(slug);
