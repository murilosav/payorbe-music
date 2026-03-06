-- Pre-generated ZIP files for instant downloads
CREATE TABLE IF NOT EXISTS playlist_zips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    folder TEXT DEFAULT '',
    part INTEGER DEFAULT 1,
    total_parts INTEGER DEFAULT 1,
    r2_key TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    song_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id)
);
