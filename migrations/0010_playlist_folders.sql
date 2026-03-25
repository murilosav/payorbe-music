-- Many-to-many: playlist can belong to multiple folders
CREATE TABLE IF NOT EXISTS playlist_folders (
  playlist_id INTEGER NOT NULL,
  folder_id INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, folder_id)
);

-- Migrate existing folder_id data
INSERT OR IGNORE INTO playlist_folders (playlist_id, folder_id)
SELECT id, folder_id FROM playlists WHERE folder_id IS NOT NULL;
