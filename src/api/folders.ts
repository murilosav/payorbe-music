import type { Env } from "../index";
import { json, generateAccessToken } from "./helpers";
import { validateRequired, validateString, validateSlug, validate } from "./validation";

export async function handleFolders(request: Request, env: Env, path: string): Promise<Response | null> {
	// GET /api/folders
	if (path === "/api/folders" && request.method === "GET") {
		const { results } = await env.DB.prepare(
			`SELECT f.*,
				(SELECT COUNT(*) FROM playlist_folders WHERE folder_id = f.id) as playlist_count
			FROM folders f ORDER BY f.name`
		).all();
		return json(results);
	}

	// POST /api/folders
	if (path === "/api/folders" && request.method === "POST") {
		const body = await request.json<{ name: string; slug: string; description?: string; product_id?: string }>();
		const invalid = validate(
			validateRequired(body, ["name", "slug"]),
			validateString(body.name, "name", 200),
			validateSlug(body.slug),
			validateString(body.description, "description", 2000),
		);
		if (invalid) return invalid;

		const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
		const [existingFolder, existingPlaylist] = await Promise.all([
			env.DB.prepare("SELECT id FROM folders WHERE slug = ?").bind(slug).first(),
			env.DB.prepare("SELECT id FROM playlists WHERE slug = ?").bind(slug).first(),
		]);
		if (existingFolder || existingPlaylist) return json({ error: "Slug j\u00e1 em uso" }, 409);

		const accessToken = generateAccessToken();
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
		await env.DB.prepare("DELETE FROM playlist_folders WHERE folder_id = ?").bind(id).run();
		await env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();
		return json({ success: true });
	}

	// PATCH /api/playlists/:id/folder - Add playlist to folder or remove from all
	const moveMatch = path.match(/^\/api\/playlists\/(\d+)\/folder$/);
	if (moveMatch && request.method === "PATCH") {
		const id = parseInt(moveMatch[1]);
		const body = await request.json<{ folder_id: number | null }>();
		if (body.folder_id) {
			// Add to folder (keep existing associations)
			await env.DB.prepare(
				"INSERT OR IGNORE INTO playlist_folders (playlist_id, folder_id) VALUES (?, ?)"
			).bind(id, body.folder_id).run();
		} else {
			// Remove from all folders
			await env.DB.prepare("DELETE FROM playlist_folders WHERE playlist_id = ?").bind(id).run();
		}
		return json({ success: true });
	}

	// DELETE /api/playlists/:id/folder/:folderId - Remove playlist from specific folder
	const removeFolderMatch = path.match(/^\/api\/playlists\/(\d+)\/folder\/(\d+)$/);
	if (removeFolderMatch && request.method === "DELETE") {
		const playlistId = parseInt(removeFolderMatch[1]);
		const folderId = parseInt(removeFolderMatch[2]);
		await env.DB.prepare(
			"DELETE FROM playlist_folders WHERE playlist_id = ? AND folder_id = ?"
		).bind(playlistId, folderId).run();
		return json({ success: true });
	}

	return null;
}
