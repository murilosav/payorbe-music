import type { Env } from "../index";
import { json, generateAccessToken } from "./helpers";
import { validateRequired, validateString, validateSlug, validate } from "./validation";

export async function handlePlaylists(request: Request, env: Env, path: string, ctx?: ExecutionContext): Promise<Response | null> {
	// GET /api/playlists (with stats, paginated)
	if (path === "/api/playlists" && request.method === "GET") {
		const url = new URL(request.url);
		const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
		const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
		const offset = (page - 1) * limit;

		const [{ results }, countRow, { results: pfRows }] = await Promise.all([
			env.DB.prepare(
				`SELECT p.*,
					(SELECT COUNT(*) FROM songs WHERE playlist_id = p.id) as song_count,
					(SELECT COALESCE(SUM(file_size), 0) FROM songs WHERE playlist_id = p.id) as total_size
				FROM playlists p ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
			).bind(limit, offset).all(),
			env.DB.prepare("SELECT COUNT(*) as total FROM playlists").first<{ total: number }>(),
			env.DB.prepare("SELECT playlist_id, folder_id FROM playlist_folders").all(),
		]);

		// Build folder_ids map
		const folderMap = new Map<number, number[]>();
		for (const row of pfRows) {
			const r = row as { playlist_id: number; folder_id: number };
			if (!folderMap.has(r.playlist_id)) folderMap.set(r.playlist_id, []);
			folderMap.get(r.playlist_id)!.push(r.folder_id);
		}
		const enriched = results.map((p: any) => ({
			...p,
			folder_ids: folderMap.get(p.id) || [],
			folder_id: (folderMap.get(p.id) || [])[0] || null, // backward compat
		}));

		const total = countRow?.total || 0;
		return json({ results: enriched, total, page, limit, pages: Math.ceil(total / limit) });
	}

	// POST /api/playlists
	if (path === "/api/playlists" && request.method === "POST") {
		const body = await request.json<{ name: string; slug: string; description?: string; cover_url?: string; product_id?: string }>();
		const invalid = validate(
			validateRequired(body, ["name", "slug"]),
			validateString(body.name, "name", 200),
			validateSlug(body.slug),
			validateString(body.description, "description", 2000),
		);
		if (invalid) return invalid;

		const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
		const [existingP, existingF] = await Promise.all([
			env.DB.prepare("SELECT id FROM playlists WHERE slug = ?").bind(slug).first(),
			env.DB.prepare("SELECT id FROM folders WHERE slug = ?").bind(slug).first(),
		]);
		if (existingP || existingF) return json({ error: "Slug j\u00e1 em uso" }, 409);

		const accessToken = generateAccessToken();
		await env.DB.prepare(
			"INSERT INTO playlists (name, slug, description, cover_url, access_token, product_id) VALUES (?, ?, ?, ?, ?, ?)"
		).bind(body.name, slug, body.description || "", body.cover_url || "", accessToken, body.product_id || null).run();

		const playlist = await env.DB.prepare("SELECT * FROM playlists WHERE slug = ?").bind(slug).first();
		return json(playlist, 201);
	}

	// /api/playlists/:id
	const playlistMatch = path.match(/^\/api\/playlists\/(\d+)$/);
	if (playlistMatch && request.method === "DELETE") {
		const id = parseInt(playlistMatch[1]);
		try {
			const playlist = await env.DB.prepare("SELECT cover_r2_key FROM playlists WHERE id = ?")
				.bind(id).first<{ cover_r2_key: string }>();
			if (!playlist) return json({ error: "Playlist not found" }, 404);

			// Collect R2 keys BEFORE deleting DB records
			const songs = await env.DB.prepare("SELECT r2_key, cover_r2_key FROM songs WHERE playlist_id = ?").bind(id).all();
			const zips = await env.DB.prepare("SELECT r2_key FROM playlist_zips WHERE playlist_id = ?").bind(id).all();

			const r2Keys: string[] = [];
			if (playlist.cover_r2_key) r2Keys.push(playlist.cover_r2_key);
			for (const song of songs.results) {
				const s = song as { r2_key: string; cover_r2_key: string };
				if (s.r2_key) r2Keys.push(s.r2_key);
				if (s.cover_r2_key) r2Keys.push(s.cover_r2_key);
			}
			for (const zip of zips.results) {
				const r2Key = (zip as any).r2_key;
				if (r2Key) r2Keys.push(r2Key);
			}

			// Delete DB records FIRST (instant, playlist disappears immediately)
			await env.DB.prepare("DELETE FROM songs WHERE playlist_id = ?").bind(id).run();
			await env.DB.prepare("DELETE FROM playlist_zips WHERE playlist_id = ?").bind(id).run();
			try { await env.DB.prepare("DELETE FROM session_tokens WHERE slug = (SELECT slug FROM playlists WHERE id = ?)").bind(id).run(); } catch (_) {}
			await env.DB.prepare("DELETE FROM playlists WHERE id = ?").bind(id).run();

			// Delete R2 files in BACKGROUND (doesn't block the response)
			if (ctx && r2Keys.length > 0) {
				ctx.waitUntil((async () => {
					const BATCH = 50;
					for (let i = 0; i < r2Keys.length; i += BATCH) {
						const batch = r2Keys.slice(i, i + BATCH);
						await Promise.all(batch.map(key => env.MUSIC_BUCKET.delete(key).catch(() => {})));
					}
				})());
			}

			return json({ success: true });
		} catch (err: any) {
			console.error("Delete playlist error:", err);
			return json({ error: err.message || "Erro interno ao excluir" }, 500);
		}
	}

	if (playlistMatch && request.method === "PUT") {
		const id = parseInt(playlistMatch[1]);
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
			const [existingPlaylist, existingFolder] = await Promise.all([
				env.DB.prepare("SELECT id FROM playlists WHERE slug = ? AND id != ?").bind(newSlug, id).first(),
				env.DB.prepare("SELECT id FROM folders WHERE slug = ?").bind(newSlug).first(),
			]);
			if (existingPlaylist || existingFolder) return json({ error: "Slug j\u00e1 em uso" }, 409);
			fields.push("slug = ?"); values.push(newSlug);
		}
		if (fields.length === 0) return json({ error: "No fields to update" }, 400);

		values.push(id);
		await env.DB.prepare(`UPDATE playlists SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
		const playlist = await env.DB.prepare("SELECT * FROM playlists WHERE id = ?").bind(id).first();
		return json(playlist);
	}

	// GET /api/playlists/:id/cover-preview
	const coverPreviewMatch = path.match(/^\/api\/playlists\/(\d+)\/cover-preview$/);
	if (coverPreviewMatch && request.method === "GET") {
		const id = parseInt(coverPreviewMatch[1]);
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

	// POST /api/playlists/:id/cover
	const coverMatch = path.match(/^\/api\/playlists\/(\d+)\/cover$/);
	if (coverMatch && request.method === "POST") {
		const id = parseInt(coverMatch[1]);
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		if (!file) return json({ error: "file required" }, 400);

		const playlist = await env.DB.prepare("SELECT slug, cover_r2_key FROM playlists WHERE id = ?")
			.bind(id).first<{ slug: string; cover_r2_key: string }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

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

	if (coverMatch && request.method === "DELETE") {
		const id = parseInt(coverMatch[1]);
		const playlist = await env.DB.prepare("SELECT cover_r2_key FROM playlists WHERE id = ?")
			.bind(id).first<{ cover_r2_key: string }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

		if (playlist.cover_r2_key) {
			await env.MUSIC_BUCKET.delete(playlist.cover_r2_key);
			await env.DB.prepare("UPDATE playlists SET cover_r2_key = '' WHERE id = ?").bind(id).run();
		}
		return json({ success: true });
	}

	return null;
}
