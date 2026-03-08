import type { Env } from "./index";

export async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
	const json = (data: any, status = 200) =>
		new Response(JSON.stringify(data), {
			status,
			headers: { "content-type": "application/json" },
		});

	// --- Folders ---
	// GET /api/folders
	if (path === "/api/folders" && request.method === "GET") {
		const { results } = await env.DB.prepare(
			`SELECT f.*,
				(SELECT COUNT(*) FROM playlists WHERE folder_id = f.id) as playlist_count
			FROM folders f ORDER BY f.name`
		).all();
		return json(results);
	}

	// POST /api/folders
	if (path === "/api/folders" && request.method === "POST") {
		const body = await request.json<{ name: string; slug: string; description?: string; product_id?: string }>();
		if (!body.name || !body.slug) return json({ error: "name and slug required" }, 400);

		const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

		// Ensure slug is unique across folders AND playlists
		const [existingFolder, existingPlaylist] = await Promise.all([
			env.DB.prepare("SELECT id FROM folders WHERE slug = ?").bind(slug).first(),
			env.DB.prepare("SELECT id FROM playlists WHERE slug = ?").bind(slug).first(),
		]);
		if (existingFolder || existingPlaylist) return json({ error: "Slug j\u00e1 em uso" }, 409);

		const tokenBytes = new Uint8Array(32);
		crypto.getRandomValues(tokenBytes);
		const accessToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

		await env.DB.prepare(
			"INSERT INTO folders (name, slug, description, access_token, product_id) VALUES (?, ?, ?, ?, ?)"
		).bind(body.name, slug, body.description || "", accessToken, body.product_id || null).run();

		const folder = await env.DB.prepare("SELECT * FROM folders WHERE slug = ?").bind(slug).first();
		return json(folder, 201);
	}

	// PUT/DELETE /api/folders/:id
	const folderMatch = path.match(/^\/api\/folders\/(\d+)$/);
	if (folderMatch && request.method === "PUT") {
		const id = parseInt(folderMatch[1]);
		const body = await request.json<{ name?: string; slug?: string; description?: string; product_id?: string | null; jwt_secret?: string | null }>();
		const fields: string[] = [];
		const values: any[] = [];
		if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
		if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }
		if (body.product_id !== undefined) { fields.push("product_id = ?"); values.push(body.product_id); }
		if (body.jwt_secret !== undefined) { fields.push("jwt_secret = ?"); values.push(body.jwt_secret); }
		if (body.slug !== undefined) {
			const newSlug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "");
			if (!newSlug) return json({ error: "Slug inv\u00e1lido" }, 400);
			const [existingFolder, existingPlaylist] = await Promise.all([
				env.DB.prepare("SELECT id FROM folders WHERE slug = ? AND id != ?").bind(newSlug, id).first(),
				env.DB.prepare("SELECT id FROM playlists WHERE slug = ?").bind(newSlug).first(),
			]);
			if (existingFolder || existingPlaylist) return json({ error: "Slug j\u00e1 em uso" }, 409);
			fields.push("slug = ?"); values.push(newSlug);
		}
		if (fields.length === 0) return json({ error: "No fields to update" }, 400);
		values.push(id);
		await env.DB.prepare(`UPDATE folders SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
		const folder = await env.DB.prepare("SELECT * FROM folders WHERE id = ?").bind(id).first();
		return json(folder);
	}

	if (folderMatch && request.method === "DELETE") {
		const id = parseInt(folderMatch[1]);
		// Unlink playlists from folder (don't delete them)
		await env.DB.prepare("UPDATE playlists SET folder_id = NULL WHERE folder_id = ?").bind(id).run();
		await env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();
		return json({ success: true });
	}

	// PATCH /api/playlists/:id/folder - Move playlist to/from folder
	const moveMatch = path.match(/^\/api\/playlists\/(\d+)\/folder$/);
	if (moveMatch && request.method === "PATCH") {
		const id = parseInt(moveMatch[1]);
		const body = await request.json<{ folder_id: number | null }>();
		await env.DB.prepare("UPDATE playlists SET folder_id = ? WHERE id = ?")
			.bind(body.folder_id, id).run();
		return json({ success: true });
	}

	// --- Playlists ---
	// GET /api/playlists (with stats)
	if (path === "/api/playlists" && request.method === "GET") {
		const { results } = await env.DB.prepare(
			`SELECT p.*,
				(SELECT COUNT(*) FROM songs WHERE playlist_id = p.id) as song_count,
				(SELECT COALESCE(SUM(file_size), 0) FROM songs WHERE playlist_id = p.id) as total_size
			FROM playlists p ORDER BY p.created_at DESC`
		).all();
		return json(results);
	}

	// POST /api/playlists
	if (path === "/api/playlists" && request.method === "POST") {
		const body = await request.json<{ name: string; slug: string; description?: string; cover_url?: string; product_id?: string }>();
		if (!body.name || !body.slug) return json({ error: "name and slug required" }, 400);

		const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

		// Ensure slug is unique across playlists AND folders
		const [existingP, existingF] = await Promise.all([
			env.DB.prepare("SELECT id FROM playlists WHERE slug = ?").bind(slug).first(),
			env.DB.prepare("SELECT id FROM folders WHERE slug = ?").bind(slug).first(),
		]);
		if (existingP || existingF) return json({ error: "Slug j\u00e1 em uso" }, 409);

		// Generate secure random access token
		const tokenBytes = new Uint8Array(32);
		crypto.getRandomValues(tokenBytes);
		const accessToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

		await env.DB.prepare(
			"INSERT INTO playlists (name, slug, description, cover_url, access_token, product_id) VALUES (?, ?, ?, ?, ?, ?)"
		).bind(body.name, slug, body.description || "", body.cover_url || "", accessToken, body.product_id || null).run();

		const playlist = await env.DB.prepare("SELECT * FROM playlists WHERE slug = ?").bind(slug).first();
		return json(playlist, 201);
	}

	// DELETE /api/playlists/:id - Fast parallel delete
	const playlistDeleteMatch = path.match(/^\/api\/playlists\/(\d+)$/);
	if (playlistDeleteMatch && request.method === "DELETE") {
		const id = parseInt(playlistDeleteMatch[1]);
		const playlist = await env.DB.prepare("SELECT cover_r2_key FROM playlists WHERE id = ?")
			.bind(id).first<{ cover_r2_key: string }>();
		const songs = await env.DB.prepare("SELECT r2_key, cover_r2_key FROM songs WHERE playlist_id = ?").bind(id).all();

		// Also get ZIPs to delete
		const zips = await env.DB.prepare("SELECT r2_key FROM playlist_zips WHERE playlist_id = ?").bind(id).all();

		// Delete all R2 objects in parallel (songs, covers, playlist cover, ZIPs)
		const deletePromises: Promise<void>[] = [];
		if (playlist?.cover_r2_key) deletePromises.push(env.MUSIC_BUCKET.delete(playlist.cover_r2_key));
		for (const song of songs.results) {
			const s = song as { r2_key: string; cover_r2_key: string };
			if (s.r2_key) deletePromises.push(env.MUSIC_BUCKET.delete(s.r2_key));
			if (s.cover_r2_key) deletePromises.push(env.MUSIC_BUCKET.delete(s.cover_r2_key));
		}
		for (const zip of zips.results) {
			deletePromises.push(env.MUSIC_BUCKET.delete((zip as any).r2_key));
		}
		await Promise.all(deletePromises);

		// Delete from DB in parallel
		await Promise.all([
			env.DB.prepare("DELETE FROM songs WHERE playlist_id = ?").bind(id).run(),
			env.DB.prepare("DELETE FROM playlist_zips WHERE playlist_id = ?").bind(id).run(),
			env.DB.prepare("DELETE FROM playlists WHERE id = ?").bind(id).run(),
		]);
		return json({ success: true });
	}

	// PUT /api/playlists/:id - Update playlist
	if (playlistDeleteMatch && request.method === "PUT") {
		const id = parseInt(playlistDeleteMatch[1]);
		const body = await request.json<{ name?: string; slug?: string; description?: string; product_id?: string | null; jwt_secret?: string | null }>();

		const fields: string[] = [];
		const values: any[] = [];

		if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
		if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }
		if (body.product_id !== undefined) { fields.push("product_id = ?"); values.push(body.product_id); }
		if (body.jwt_secret !== undefined) { fields.push("jwt_secret = ?"); values.push(body.jwt_secret); }
		if (body.slug !== undefined) {
			const newSlug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "");
			if (!newSlug) return json({ error: "Slug inválido" }, 400);
			const [existingPlaylist, existingFolder] = await Promise.all([
				env.DB.prepare("SELECT id FROM playlists WHERE slug = ? AND id != ?").bind(newSlug, id).first(),
				env.DB.prepare("SELECT id FROM folders WHERE slug = ?").bind(newSlug).first(),
			]);
			if (existingPlaylist || existingFolder) return json({ error: "Slug já em uso" }, 409);
			fields.push("slug = ?"); values.push(newSlug);
		}

		if (fields.length === 0) return json({ error: "No fields to update" }, 400);

		values.push(id);
		await env.DB.prepare(`UPDATE playlists SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();

		const playlist = await env.DB.prepare("SELECT * FROM playlists WHERE id = ?").bind(id).first();
		return json(playlist);
	}

	// GET /api/playlists/:id/cover-preview - Get playlist cover (admin only)
	const playlistCoverPreviewMatch = path.match(/^\/api\/playlists\/(\d+)\/cover-preview$/);
	if (playlistCoverPreviewMatch && request.method === "GET") {
		const id = parseInt(playlistCoverPreviewMatch[1]);
		const playlist = await env.DB.prepare("SELECT cover_r2_key FROM playlists WHERE id = ?")
			.bind(id).first<{ cover_r2_key: string }>();
		if (!playlist || !playlist.cover_r2_key) return new Response(null, { status: 404 });

		const object = await env.MUSIC_BUCKET.get(playlist.cover_r2_key);
		if (!object) return new Response(null, { status: 404 });

		return new Response(object.body, {
			headers: {
				"Content-Type": object.httpMetadata?.contentType || "image/jpeg",
				"Cache-Control": "private, max-age=300",
			},
		});
	}

	// POST /api/playlists/:id/cover - Upload playlist cover image
	const playlistCoverMatch = path.match(/^\/api\/playlists\/(\d+)\/cover$/);
	if (playlistCoverMatch && request.method === "POST") {
		const id = parseInt(playlistCoverMatch[1]);
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		if (!file) return json({ error: "file required" }, 400);

		const playlist = await env.DB.prepare("SELECT slug, cover_r2_key FROM playlists WHERE id = ?")
			.bind(id).first<{ slug: string; cover_r2_key: string }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

		// Delete old cover if exists
		if (playlist.cover_r2_key) {
			await env.MUSIC_BUCKET.delete(playlist.cover_r2_key);
		}

		const ext = file.type === "image/png" ? "png" : "jpg";
		const coverKey = `playlists/${playlist.slug}/cover.${ext}`;
		await env.MUSIC_BUCKET.put(coverKey, file.stream(), {
			httpMetadata: { contentType: file.type || "image/jpeg" },
		});

		await env.DB.prepare("UPDATE playlists SET cover_r2_key = ? WHERE id = ?").bind(coverKey, id).run();
		return json({ success: true, cover_r2_key: coverKey });
	}

	// DELETE /api/playlists/:id/cover - Remove playlist cover
	if (playlistCoverMatch && request.method === "DELETE") {
		const id = parseInt(playlistCoverMatch[1]);
		const playlist = await env.DB.prepare("SELECT cover_r2_key FROM playlists WHERE id = ?")
			.bind(id).first<{ cover_r2_key: string }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

		if (playlist.cover_r2_key) {
			await env.MUSIC_BUCKET.delete(playlist.cover_r2_key);
			await env.DB.prepare("UPDATE playlists SET cover_r2_key = '' WHERE id = ?").bind(id).run();
		}
		return json({ success: true });
	}

	// --- ZIP Management ---
	const zipMatch = path.match(/^\/api\/playlists\/(\d+)\/zip\/(start|part|complete|upload)$/);
	if (zipMatch) {
		const id = parseInt(zipMatch[1]);
		const action = zipMatch[2];

		// POST /api/playlists/:id/zip/upload - Simple upload for ZIPs < 90MB
		if (action === "upload" && request.method === "POST") {
			const formData = await request.formData();
			const file = formData.get("file") as File;
			const folder = formData.get("folder") as string || "";
			const part = parseInt(formData.get("part") as string || "1");
			const totalParts = parseInt(formData.get("totalParts") as string || "1");
			const songCount = parseInt(formData.get("songCount") as string || "0");

			const r2Key = `zips/playlist-${id}/${folder || "_all"}_part${part}.zip`;
			await env.MUSIC_BUCKET.put(r2Key, file.stream(), {
				httpMetadata: { contentType: "application/zip" },
			});

			await env.DB.prepare(
				"DELETE FROM playlist_zips WHERE playlist_id = ? AND folder = ? AND part = ?"
			).bind(id, folder, part).run();

			await env.DB.prepare(
				"INSERT INTO playlist_zips (playlist_id, folder, part, total_parts, r2_key, file_size, song_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
			).bind(id, folder, part, totalParts, r2Key, file.size, songCount).run();

			return json({ success: true });
		}

		// POST /api/playlists/:id/zip/start - Start R2 multipart upload
		if (action === "start" && request.method === "POST") {
			const body = await request.json<{ key: string }>();
			const upload = await env.MUSIC_BUCKET.createMultipartUpload(body.key, {
				httpMetadata: { contentType: "application/zip" },
			});
			return json({ uploadId: upload.uploadId });
		}

		// POST /api/playlists/:id/zip/part - Upload chunk of multipart
		if (action === "part" && request.method === "POST") {
			const formData = await request.formData();
			const chunk = formData.get("chunk") as File;
			const uploadId = formData.get("uploadId") as string;
			const key = formData.get("key") as string;
			const partNumber = parseInt(formData.get("partNumber") as string);

			const upload = env.MUSIC_BUCKET.resumeMultipartUpload(key, uploadId);
			const uploaded = await upload.uploadPart(partNumber, chunk.stream());
			return json({ etag: uploaded.etag });
		}

		// POST /api/playlists/:id/zip/complete - Complete multipart upload
		if (action === "complete" && request.method === "POST") {
			const body = await request.json<{
				uploadId: string; key: string;
				parts: { partNumber: number; etag: string }[];
				folder: string; zipPart: number; totalParts: number;
				fileSize: number; songCount: number;
			}>();

			const upload = env.MUSIC_BUCKET.resumeMultipartUpload(body.key, body.uploadId);
			await upload.complete(body.parts);

			await env.DB.prepare(
				"DELETE FROM playlist_zips WHERE playlist_id = ? AND folder = ? AND part = ?"
			).bind(id, body.folder || "", body.zipPart || 1).run();

			await env.DB.prepare(
				"INSERT INTO playlist_zips (playlist_id, folder, part, total_parts, r2_key, file_size, song_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
			).bind(id, body.folder || "", body.zipPart || 1, body.totalParts || 1, body.key, body.fileSize || 0, body.songCount || 0).run();

			return json({ success: true });
		}
	}

	// GET /api/playlists/:id/zips - Get ZIP status
	const zipsListMatch = path.match(/^\/api\/playlists\/(\d+)\/zips$/);
	if (zipsListMatch && request.method === "GET") {
		const id = parseInt(zipsListMatch[1]);
		const { results } = await env.DB.prepare(
			"SELECT * FROM playlist_zips WHERE playlist_id = ? ORDER BY folder, part"
		).bind(id).all();
		return json(results);
	}

	// DELETE /api/playlists/:id/zips - Delete all ZIPs for a playlist
	if (zipsListMatch && request.method === "DELETE") {
		const id = parseInt(zipsListMatch[1]);
		const { results } = await env.DB.prepare(
			"SELECT r2_key FROM playlist_zips WHERE playlist_id = ?"
		).bind(id).all();

		const deletes = results.map((z: any) => env.MUSIC_BUCKET.delete(z.r2_key));
		deletes.push(env.DB.prepare("DELETE FROM playlist_zips WHERE playlist_id = ?").bind(id).run() as any);
		await Promise.all(deletes);
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

		// Check for duplicate
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

	// POST /api/songs/upload-complete - Complete multipart song upload and insert DB record
	if (path === "/api/songs/upload-complete" && request.method === "POST") {
		const body = await request.json<{
			uploadId: string; r2Key: string;
			parts: { partNumber: number; etag: string }[];
			playlist_id: string; title: string; artist: string;
			album: string; folder: string; duration: number; file_size: number;
		}>();

		const upload = env.MUSIC_BUCKET.resumeMultipartUpload(body.r2Key, body.uploadId);
		await upload.complete(body.parts);

		// Insert into DB
		await env.DB.prepare(
			`INSERT INTO songs (playlist_id, title, artist, album, duration, track_number, folder, r2_key, cover_r2_key, file_size)
			 VALUES (?, ?, ?, ?, ?, 0, ?, ?, '', ?)`
		).bind(parseInt(body.playlist_id), body.title, body.artist || "Desconhecido", body.album || "",
			body.duration || 0, body.folder || "", body.r2Key, body.file_size || 0).run();

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

		// Check for duplicate
		const existing = await env.DB.prepare(
			"SELECT id FROM songs WHERE playlist_id = ? AND r2_key = ?"
		).bind(parseInt(playlistId), r2Key).first();
		if (existing) {
			return json({ error: "duplicate", message: "M\u00fasica j\u00e1 existe nesta playlist" }, 409);
		}

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

	// POST /api/songs/bulk-delete - Delete multiple songs at once
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
			if (s.r2_key) deletes.push(env.MUSIC_BUCKET.delete(s.r2_key));
			if (s.cover_r2_key) deletes.push(env.MUSIC_BUCKET.delete(s.cover_r2_key));
		}
		await Promise.all(deletes);

		await env.DB.prepare(
			`DELETE FROM songs WHERE id IN (${placeholders})`
		).bind(...body.ids).run();

		return json({ success: true, deleted: results.length });
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
