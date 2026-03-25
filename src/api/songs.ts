import type { Env } from "../index";
import { json } from "./helpers";

export async function handleSongs(request: Request, env: Env, path: string): Promise<Response | null> {
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

	// GET /api/songs/:id/file - Download song file (admin only, for ZIP generation)
	const songFileMatch = path.match(/^\/api\/songs\/(\d+)\/file$/);
	if (songFileMatch && request.method === "GET") {
		const songId = parseInt(songFileMatch[1]);
		const song = await env.DB.prepare("SELECT r2_key FROM songs WHERE id = ?")
			.bind(songId).first<{ r2_key: string }>();
		if (!song) return new Response(null, { status: 404 });

		const object = await env.MUSIC_BUCKET.get(song.r2_key);
		if (!object) return new Response(null, { status: 404 });

		return new Response(object.body, {
			headers: {
				"Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
				"Cache-Control": "private, no-store",
			},
		});
	}

	// POST /api/songs/upload-start - Start multipart upload for large files
	if (path === "/api/songs/upload-start" && request.method === "POST") {
		const body = await request.json<{
			playlist_id: string; filename: string; title: string; artist: string;
			album: string; folder: string; duration: number; file_size: number; content_type: string;
		}>();

		if (!body.playlist_id || !body.filename || !body.title) {
			return json({ error: "playlist_id, filename, and title are required" }, 400);
		}

		const playlist = await env.DB.prepare("SELECT slug FROM playlists WHERE id = ?")
			.bind(parseInt(body.playlist_id)).first<{ slug: string }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

		const folderPath = body.folder ? `${body.folder}/` : "";
		const r2Key = `playlists/${playlist.slug}/${folderPath}${body.filename}`;

		const existing = await env.DB.prepare(
			"SELECT id FROM songs WHERE playlist_id = ? AND r2_key = ?"
		).bind(parseInt(body.playlist_id), r2Key).first();
		if (existing) {
			return json({ error: "duplicate", message: "M\u00fasica j\u00e1 existe nesta playlist" }, 409);
		}

		const upload = await env.MUSIC_BUCKET.createMultipartUpload(r2Key, {
			httpMetadata: { contentType: body.content_type || "audio/mpeg" },
		});

		return json({ uploadId: upload.uploadId, r2Key: r2Key });
	}

	// POST /api/songs/upload-part - Upload a chunk of multipart song
	if (path === "/api/songs/upload-part" && request.method === "POST") {
		const formData = await request.formData();
		const chunk = formData.get("chunk") as File;
		const uploadId = formData.get("uploadId") as string;
		const key = formData.get("key") as string;
		const partNumber = parseInt(formData.get("partNumber") as string);

		const upload = env.MUSIC_BUCKET.resumeMultipartUpload(key, uploadId);
		const uploaded = await upload.uploadPart(partNumber, chunk.stream());
		return json({ etag: uploaded.etag });
	}

	// POST /api/songs/upload-complete - Complete multipart song upload
	if (path === "/api/songs/upload-complete" && request.method === "POST") {
		const body = await request.json<{
			uploadId: string; r2Key: string;
			parts: { partNumber: number; etag: string }[];
			playlist_id: string; title: string; artist: string;
			album: string; folder: string; duration: number; file_size: number;
			track_number?: number;
		}>();

		const upload = env.MUSIC_BUCKET.resumeMultipartUpload(body.r2Key, body.uploadId);
		await upload.complete(body.parts);

		try {
			await env.DB.prepare(
				`INSERT INTO songs (playlist_id, title, artist, album, duration, track_number, folder, r2_key, cover_r2_key, file_size)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)`
			).bind(parseInt(body.playlist_id), body.title, body.artist || "Desconhecido", body.album || "",
				body.duration || 0, body.track_number || 0, body.folder || "", body.r2Key, body.file_size || 0).run();
		} catch (dbErr: any) {
			// DB insert failed — clean up the R2 file to avoid orphans
			await env.MUSIC_BUCKET.delete(body.r2Key).catch(() => {});
			// If it's a duplicate (race condition), return the existing song
			const existing = await env.DB.prepare("SELECT * FROM songs WHERE r2_key = ?").bind(body.r2Key).first();
			if (existing) return json(existing, 200);
			return json({ error: dbErr.message }, 500);
		}

		const song = await env.DB.prepare("SELECT * FROM songs WHERE r2_key = ?").bind(body.r2Key).first();
		return json(song, 201);
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

		const existing = await env.DB.prepare(
			"SELECT id FROM songs WHERE playlist_id = ? AND r2_key = ?"
		).bind(parseInt(playlistId), r2Key).first();
		if (existing) {
			return json({ error: "duplicate", message: "M\u00fasica j\u00e1 existe nesta playlist" }, 409);
		}

		const uploadPromises: Promise<any>[] = [
			env.MUSIC_BUCKET.put(r2Key, file.stream(), {
				httpMetadata: { contentType: file.type || "audio/mpeg" },
			}),
		];

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

		try {
			await env.DB.prepare(
				`INSERT INTO songs (playlist_id, title, artist, album, duration, track_number, folder, r2_key, cover_r2_key, file_size)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(parseInt(playlistId), title, artist, album, duration, trackNumber, folder, r2Key, coverR2Key, file.size).run();
		} catch (dbErr: any) {
			// DB insert failed — clean up R2 files to avoid orphans
			const cleanups: Promise<void>[] = [env.MUSIC_BUCKET.delete(r2Key).catch(() => {})];
			if (coverR2Key) cleanups.push(env.MUSIC_BUCKET.delete(coverR2Key).catch(() => {}));
			await Promise.all(cleanups);
			// If it's a duplicate (race condition), return the existing song
			const existing = await env.DB.prepare("SELECT * FROM songs WHERE r2_key = ?").bind(r2Key).first();
			if (existing) return json(existing, 200);
			return json({ error: dbErr.message }, 500);
		}

		const song = await env.DB.prepare("SELECT * FROM songs WHERE r2_key = ?").bind(r2Key).first();
		return json(song, 201);
	}

	// POST /api/songs/:id/cover
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

	// POST /api/songs/bulk-delete
	if (path === "/api/songs/bulk-delete" && request.method === "POST") {
		const body = await request.json<{ ids: number[] }>();
		if (!body.ids || body.ids.length === 0) return json({ error: "ids required" }, 400);

		const placeholders = body.ids.map(() => "?").join(",");
		const { results } = await env.DB.prepare(
			`SELECT r2_key, cover_r2_key FROM songs WHERE id IN (${placeholders})`
		).bind(...body.ids).all();

		const deletes: Promise<void>[] = [];
		for (const song of results) {
			const s = song as { r2_key: string; cover_r2_key: string };
			if (s.r2_key) deletes.push(env.MUSIC_BUCKET.delete(s.r2_key).catch(() => {}));
			if (s.cover_r2_key) deletes.push(env.MUSIC_BUCKET.delete(s.cover_r2_key).catch(() => {}));
		}
		await Promise.all(deletes);

		await env.DB.prepare(
			`DELETE FROM songs WHERE id IN (${placeholders})`
		).bind(...body.ids).run();

		return json({ success: true, deleted: results.length });
	}

	// GET /api/songs/duplicates — find songs with same filename across playlists
	if (path === "/api/songs/duplicates" && request.method === "GET") {
		const { results } = await env.DB.prepare(`
			SELECT s.id, s.title, s.artist, s.r2_key, s.file_size, s.playlist_id,
				p.name as playlist_name, p.slug as playlist_slug
			FROM songs s
			JOIN playlists p ON s.playlist_id = p.id
			ORDER BY s.r2_key, s.id
		`).all();

		// Group by filename (basename of r2_key)
		const byName: Record<string, any[]> = {};
		for (const row of results) {
			const r = row as any;
			const parts = (r.r2_key as string).split("/");
			const filename = parts[parts.length - 1];
			if (!byName[filename]) byName[filename] = [];
			byName[filename].push({
				id: r.id, title: r.title, artist: r.artist, r2_key: r.r2_key,
				file_size: r.file_size, playlist_id: r.playlist_id,
				playlist_name: r.playlist_name, playlist_slug: r.playlist_slug,
			});
		}

		// Only keep groups with duplicates across different playlists
		const duplicates: { filename: string; songs: any[] }[] = [];
		for (const [filename, songs] of Object.entries(byName)) {
			const uniquePlaylists = new Set(songs.map((s: any) => s.playlist_id));
			if (uniquePlaylists.size > 1) {
				duplicates.push({ filename, songs });
			}
		}

		return json({ duplicates, totalDuplicates: duplicates.reduce((sum, d) => sum + d.songs.length - 1, 0) });
	}

	// POST /api/songs/duplicates/delete — remove duplicate songs, keep first occurrence
	if (path === "/api/songs/duplicates/delete" && request.method === "POST") {
		const body = await request.json<{ ids: number[] }>();
		if (!body.ids || body.ids.length === 0) return json({ error: "ids required" }, 400);

		// Delete R2 files + DB rows
		const placeholders = body.ids.map(() => "?").join(",");
		const { results } = await env.DB.prepare(
			`SELECT r2_key, cover_r2_key FROM songs WHERE id IN (${placeholders})`
		).bind(...body.ids).all();

		const deletes: Promise<void>[] = [];
		for (const song of results) {
			const s = song as { r2_key: string; cover_r2_key: string };
			if (s.r2_key) deletes.push(env.MUSIC_BUCKET.delete(s.r2_key).catch(() => {}));
			if (s.cover_r2_key) deletes.push(env.MUSIC_BUCKET.delete(s.cover_r2_key).catch(() => {}));
		}
		await Promise.all(deletes);

		await env.DB.prepare(
			`DELETE FROM songs WHERE id IN (${placeholders})`
		).bind(...body.ids).run();

		return json({ success: true, deleted: body.ids.length });
	}

	// POST /api/songs/bulk-rename
	if (path === "/api/songs/bulk-rename" && request.method === "POST") {
		const body = await request.json<{ ids: number[]; prefix: string }>();
		if (!body.ids || body.ids.length === 0 || !body.prefix) return json({ error: "ids and prefix required" }, 400);

		const pad = body.ids.length >= 100 ? 3 : 2;
		for (let i = 0; i < body.ids.length; i++) {
			const num = String(i + 1).padStart(pad, "0");
			const title = `${body.prefix} ${num}`;
			await env.DB.prepare("UPDATE songs SET title = ? WHERE id = ?").bind(title, body.ids[i]).run();
		}

		return json({ success: true, renamed: body.ids.length });
	}

	// DELETE /api/songs/:id
	const songMatch = path.match(/^\/api\/songs\/(\d+)$/);
	if (songMatch && request.method === "DELETE") {
		const songId = parseInt(songMatch[1]);
		const song = await env.DB.prepare("SELECT r2_key, cover_r2_key FROM songs WHERE id = ?")
			.bind(songId).first<{ r2_key: string; cover_r2_key: string }>();
		if (!song) return json({ error: "Song not found" }, 404);

		const r2Deletes: Promise<void>[] = [];
		if (song.r2_key) r2Deletes.push(env.MUSIC_BUCKET.delete(song.r2_key).catch(() => {}));
		if (song.cover_r2_key) r2Deletes.push(env.MUSIC_BUCKET.delete(song.cover_r2_key).catch(() => {}));
		await Promise.all(r2Deletes);
		await env.DB.prepare("DELETE FROM songs WHERE id = ?").bind(songId).run();
		return json({ success: true });
	}

	// PUT /api/songs/:id
	if (songMatch && request.method === "PUT") {
		const songId = parseInt(songMatch[1]);
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

	return null;
}
