import type { Env } from "../index";

export async function resolveToken(env: Env, token: string): Promise<string> {
	if (!token) return "";
	const session = await env.DB.prepare(
		"SELECT access_token FROM session_tokens WHERE token = ? AND expires_at > datetime('now')"
	).bind(token).first<{ access_token: string }>();
	return session ? session.access_token : token;
}

export async function verifySongAccess(env: Env, songId: number, token: string, isAdmin: boolean): Promise<{ r2_key: string; title: string; artist: string; cover_r2_key: string } | null> {
	if (isAdmin) {
		return env.DB.prepare(
			"SELECT r2_key, title, artist, cover_r2_key FROM songs WHERE id = ?"
		).bind(songId).first();
	}
	const realToken = await resolveToken(env, token);
	const direct = await env.DB.prepare(
		`SELECT s.r2_key, s.title, s.artist, s.cover_r2_key
		 FROM songs s JOIN playlists p ON s.playlist_id = p.id
		 WHERE s.id = ? AND p.access_token = ?`
	).bind(songId, realToken).first<{ r2_key: string; title: string; artist: string; cover_r2_key: string }>();
	if (direct) return direct;
	return env.DB.prepare(
		`SELECT s.r2_key, s.title, s.artist, s.cover_r2_key
		 FROM songs s JOIN playlists p ON s.playlist_id = p.id
		 JOIN playlist_folders pf ON p.id = pf.playlist_id
		 JOIN folders f ON pf.folder_id = f.id
		 WHERE s.id = ? AND f.access_token = ?`
	).bind(songId, realToken).first();
}

export async function handlePlaylistCover(request: Request, env: Env, path: string, token: string, isAdmin: boolean): Promise<Response | null> {
	if (!path.startsWith("/playlist-cover/")) return null;

	const playlistId = parseInt(path.split("/")[2]);
	if (isNaN(playlistId)) return new Response(null, { status: 400 });
	if (!token && !isAdmin) return new Response(null, { status: 403 });

	let playlist: { cover_r2_key: string } | null = null;
	if (isAdmin) {
		playlist = await env.DB.prepare(
			"SELECT cover_r2_key FROM playlists WHERE id = ?"
		).bind(playlistId).first<{ cover_r2_key: string }>();
	} else {
		const realToken = await resolveToken(env, token);
		playlist = await env.DB.prepare(
			"SELECT cover_r2_key FROM playlists WHERE id = ? AND access_token = ?"
		).bind(playlistId, realToken).first<{ cover_r2_key: string }>();
		if (!playlist) {
			playlist = await env.DB.prepare(
				`SELECT p.cover_r2_key FROM playlists p
				 JOIN playlist_folders pf ON p.id = pf.playlist_id
				 JOIN folders f ON pf.folder_id = f.id
				 WHERE p.id = ? AND f.access_token = ?`
			).bind(playlistId, realToken).first<{ cover_r2_key: string }>();
		}
	}
	if (!playlist || !playlist.cover_r2_key) return new Response(null, { status: 404 });

	const object = await env.MUSIC_BUCKET.get(playlist.cover_r2_key);
	if (!object) return new Response(null, { status: 404 });

	return new Response(object.body, {
		headers: {
			"Content-Type": object.httpMetadata?.contentType || "image/jpeg",
			"Cache-Control": "private, max-age=86400",
		},
	});
}

export async function handleSongCover(request: Request, env: Env, path: string, token: string, isAdmin: boolean): Promise<Response | null> {
	if (!path.startsWith("/cover/")) return null;

	const songId = parseInt(path.split("/")[2]);
	if (isNaN(songId)) return new Response(null, { status: 400 });
	if (!token && !isAdmin) return new Response(null, { status: 403 });

	const song = await verifySongAccess(env, songId, token, isAdmin);
	if (!song || !song.cover_r2_key) return new Response(null, { status: 404 });

	const object = await env.MUSIC_BUCKET.get(song.cover_r2_key);
	if (!object) return new Response(null, { status: 404 });

	return new Response(object.body, {
		headers: {
			"Content-Type": object.httpMetadata?.contentType || "image/jpeg",
			"Cache-Control": "private, max-age=86400",
		},
	});
}

export async function handleDownload(request: Request, env: Env, path: string, token: string, isAdmin: boolean): Promise<Response | null> {
	if (!path.startsWith("/download/")) return null;

	const songId = parseInt(path.split("/")[2]);
	if (isNaN(songId)) return new Response("Access denied", { status: 400 });
	if (!token && !isAdmin) return new Response("Access denied", { status: 403 });

	const song = await verifySongAccess(env, songId, token, isAdmin);
	if (!song) return new Response("Access denied", { status: 403 });

	const object = await env.MUSIC_BUCKET.get(song.r2_key);
	if (!object) return new Response("File not found", { status: 404 });

	// Increment download count (non-blocking)
	env.DB.prepare("UPDATE songs SET download_count = COALESCE(download_count, 0) + 1 WHERE id = ?")
		.bind(songId).run().catch(() => {});

	const ext = song.r2_key.split(".").pop() || "mp3";
	const filename = `${song.artist} - ${song.title}.${ext}`;
	const encodedFilename = encodeURIComponent(filename).replace(/%20/g, "+");

	return new Response(object.body, {
		headers: {
			"Content-Type": "application/octet-stream",
			"Content-Disposition": `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
		},
	});
}
