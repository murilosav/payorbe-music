-- Add position column to playlist_folders for ordering within a folder
ALTER TABLE playlist_folders ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

-- Backfill: order by playlist name within each folder
UPDATE playlist_folders
SET position = (
  SELECT COUNT(*)
  FROM playlist_folders pf2
  JOIN playlists p2 ON p2.id = pf2.playlist_id
  WHERE pf2.folder_id = playlist_folders.folder_id
    AND (
      p2.name < (SELECT name FROM playlists WHERE id = playlist_folders.playlist_id)
      OR (p2.name = (SELECT name FROM playlists WHERE id = playlist_folders.playlist_id) AND pf2.playlist_id < playlist_folders.playlist_id)
    )
);

CREATE INDEX IF NOT EXISTS idx_playlist_folders_folder_position
  ON playlist_folders (folder_id, position);
