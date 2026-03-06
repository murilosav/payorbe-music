-- Add cover_r2_key column to playlists for a default cover image
ALTER TABLE playlists ADD COLUMN cover_r2_key TEXT DEFAULT '';
