import type { Env } from "./index";

export async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
	const json = (data: any, status = 200) =>
		new Response(JSON.stringify(data), {
			status,
			headers: { "content-type": "application/json" },
		});

	// --- Playlists ---
	// GET /api/playlists
	if (path === "/api/playlists" && request.method === "GET") {
		const { results } = await env.DB.prepare("SELECT * FROM playlists ORDER BY created_at DESC").all();
		return json(results);
	}

	// POST /api/playlists
	if (path === "/api/playlists" && request.method === "POST") {
		const body = await request.json<{ name: string; slug: string; description?: string; cover_url?: string }>();
		if (!body.name || !body.slug) return json({ error: "name and slug required" }, 400);

		const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
		await env.DB.prepare(
			"INSERT INTO playlists (name, slug, description, cover_url) VALUES (?, ?, ?, ?)"
		).bind(body.name, slug, body.description || "", body.cover_url || "").run();

		const playlist = await env.DB.prepare("SELECT * FROM playlists WHERE slug = ?").bind(slug).first();
		return json(playlist, 201);
	}

	// DELETE /api/playlists/:id - Fast parallel delete
	const playlistDeleteMatch = path.match(/^\/api\/playlists\/(\d+)$/);
	if (playlistDeleteMatch && request.method === "DELETE") {
		const id = parseInt(playlistDeleteMatch[1]);
		const songs = await env.DB.prepare("SELECT r2_key, cover_r2_key FROM songs WHERE playlist_id = ?").bind(id).all();

		// Delete all R2 objects in parallel
		const deletePromises: Promise<void>[] = [];
		for (const song of songs.results) {
			const s = song as { r2_key: string; cover_r2_key: string };
			if (s.r2_key) deletePromises.push(env.MUSIC_BUCKET.delete(s.r2_key));
			if (s.cover_r2_key) deletePromises.push(env.MUSIC_BUCKET.delete(s.cover_r2_key));
		}
		await Promise.all(deletePromises);

		// Delete from DB in parallel
		await Promise.all([
			env.DB.prepare("DELETE FROM songs WHERE playlist_id = ?").bind(id).run(),
			env.DB.prepare("DELETE FROM playlists WHERE id = ?").bind(id).run(),
		]);
		return json({ success: true });
	}

	// --- Songs ---
	// GET /api/playlists/:slug/songs
	const songsMatch = path.match(/^\/api\/playlists\/([a-z0-9-]+)\/songs$/);
	if (songsMatch && request.method === "GET") {
		const playlist = await env.DB.prepare("SELECT id FROM playlists WHERE slug = ?").bind(songsMatch[1]).first<{ id: number }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

		const { results } = await env.DB.prepare(
			"SELECT * FROM songs WHERE playlist_id = ? ORDER BY folder, track_number, title"
		).bind(playlist.id).all();
		return json(results);
	}

	// POST /api/songs/upload - Upload a song file (with optional cover)
	if (path === "/api/songs/upload" && request.method === "POST") {
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const coverFile = formData.get("cover") as File | null;
		const playlistId = formData.get("playlist_id") as string;
		const title = formData.get("title") as string;
		const artist = formData.get("artist") as string || "Desconhecido";
		const album = formData.get("album") as string || "";
		const folder = formData.get("folder") as string || "";
		const trackNumber = parseInt(formData.get("track_number") as string || "0");
		const duration = parseInt(formData.get("duration") as string || "0");

		if (!file || !playlistId || !title) {
			return json({ error: "file, playlist_id, and title are required" }, 400);
		}

		const playlist = await env.DB.prepare("SELECT slug FROM playlists WHERE id = ?")
			.bind(parseInt(playlistId)).first<{ slug: string }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

		const folderPath = folder ? `${folder}/` : "";
		const r2Key = `playlists/${playlist.slug}/${folderPath}${file.name}`;

		// Upload song to R2
		const uploadPromises: Promise<any>[] = [
			env.MUSIC_BUCKET.put(r2Key, file.stream(), {
				httpMetadata: { contentType: file.type || "audio/mpeg" },
			}),
		];

		// Upload cover to R2 if provided
		let coverR2Key = "";
		if (coverFile && coverFile.size > 0) {
			const ext = coverFile.type === "image/png" ? "png" : "jpg";
			coverR2Key = r2Key.replace(/\.[^.]+$/, `_cover.${ext}`);
			uploadPromises.push(
				env.MUSIC_BUCKET.put(coverR2Key, coverFile.stream(), {
					httpMetadata: { contentType: coverFile.type || "image/jpeg" },
				})
			);
		}

		await Promise.all(uploadPromises);

		// Insert into DB
		await env.DB.prepare(
			`INSERT INTO songs (playlist_id, title, artist, album, duration, track_number, folder, r2_key, cover_r2_key, file_size)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).bind(parseInt(playlistId), title, artist, album, duration, trackNumber, folder, r2Key, coverR2Key, file.size).run();

		const song = await env.DB.prepare("SELECT * FROM songs WHERE r2_key = ?").bind(r2Key).first();
		return json(song, 201);
	}

	// POST /api/songs/:id/cover - Upload cover image for a song
	const coverMatch = path.match(/^\/api\/songs\/(\d+)\/cover$/);
	if (coverMatch && request.method === "POST") {
		const songId = parseInt(coverMatch[1]);
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		if (!file) return json({ error: "file required" }, 400);

		const song = await env.DB.prepare("SELECT r2_key FROM songs WHERE id = ?").bind(songId).first<{ r2_key: string }>();
		if (!song) return json({ error: "Song not found" }, 404);

		const coverKey = song.r2_key.replace(/\.[^.]+$/, "_cover." + (file.name.split(".").pop() || "jpg"));
		await env.MUSIC_BUCKET.put(coverKey, file.stream(), {
			httpMetadata: { contentType: file.type || "image/jpeg" },
		});

		await env.DB.prepare("UPDATE songs SET cover_r2_key = ? WHERE id = ?").bind(coverKey, songId).run();
		return json({ success: true, cover_r2_key: coverKey });
	}

	// DELETE /api/songs/:id
	const songDeleteMatch = path.match(/^\/api\/songs\/(\d+)$/);
	if (songDeleteMatch && request.method === "DELETE") {
		const songId = parseInt(songDeleteMatch[1]);
		const song = await env.DB.prepare("SELECT r2_key, cover_r2_key FROM songs WHERE id = ?")
			.bind(songId).first<{ r2_key: string; cover_r2_key: string }>();
		if (!song) return json({ error: "Song not found" }, 404);

		const deletes: Promise<void>[] = [];
		if (song.r2_key) deletes.push(env.MUSIC_BUCKET.delete(song.r2_key));
		if (song.cover_r2_key) deletes.push(env.MUSIC_BUCKET.delete(song.cover_r2_key));
		deletes.push(env.DB.prepare("DELETE FROM songs WHERE id = ?").bind(songId).run() as any);
		await Promise.all(deletes);
		return json({ success: true });
	}

	// PUT /api/songs/:id - Update song metadata
	const songUpdateMatch = path.match(/^\/api\/songs\/(\d+)$/);
	if (songUpdateMatch && request.method === "PUT") {
		const songId = parseInt(songUpdateMatch[1]);
		const body = await request.json<{ title?: string; artist?: string; album?: string; duration?: number; track_number?: number; folder?: string }>();

		const fields: string[] = [];
		const values: any[] = [];

		if (body.title !== undefined) { fields.push("title = ?"); values.push(body.title); }
		if (body.artist !== undefined) { fields.push("artist = ?"); values.push(body.artist); }
		if (body.album !== undefined) { fields.push("album = ?"); values.push(body.album); }
		if (body.duration !== undefined) { fields.push("duration = ?"); values.push(body.duration); }
		if (body.track_number !== undefined) { fields.push("track_number = ?"); values.push(body.track_number); }
		if (body.folder !== undefined) { fields.push("folder = ?"); values.push(body.folder); }

		if (fields.length === 0) return json({ error: "No fields to update" }, 400);

		values.push(songId);
		await env.DB.prepare(`UPDATE songs SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();

		const song = await env.DB.prepare("SELECT * FROM songs WHERE id = ?").bind(songId).first();
		return json(song);
	}

	return new Response(JSON.stringify({ error: "Not found" }), {
		status: 404,
		headers: { "content-type": "application/json" },
	});
}
