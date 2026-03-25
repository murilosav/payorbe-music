-- Add download counter to playlists
ALTER TABLE playlists ADD COLUMN download_count INTEGER DEFAULT 0;
