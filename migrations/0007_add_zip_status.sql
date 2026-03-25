-- Add zip_status column to playlists for tracking server-side ZIP generation
ALTER TABLE playlists ADD COLUMN zip_status TEXT DEFAULT '';
