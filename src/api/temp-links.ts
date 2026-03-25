import type { Env } from "../index";
import { json, generateAccessToken } from "./helpers";
import { validateRequired, validateNumber, validateString, validate } from "./validation";

export async function handleTempLinks(request: Request, env: Env, path: string): Promise<Response | null> {
	// GET /api/temp-links
	if (path === "/api/temp-links" && request.method === "GET") {
		const links = await env.DB.prepare(
			`SELECT st.token, st.slug, st.expires_at, st.max_uses, st.use_count, st.label, st.created_at,
				COALESCE(f.name, p.name) as target_name,
				CASE WHEN f.id IS NOT NULL THEN 'folder' ELSE 'playlist' END as target_type
			FROM session_tokens st
			LEFT JOIN folders f ON f.slug = st.slug AND f.access_token = st.access_token
			LEFT JOIN playlists p ON p.slug = st.slug AND p.access_token = st.access_token
			WHERE st.label IS NOT NULL AND st.expires_at > datetime('now')
			ORDER BY st.created_at DESC`
		).all();
		return json(links.results);
	}

	// POST /api/temp-links
	if (path === "/api/temp-links" && request.method === "POST") {
		const body = await request.json() as Record<string, any>;
		const { slug, expires_hours, max_uses, label } = body;

		const invalid = validate(
			validateRequired(body, ["slug", "expires_hours"]),
			validateNumber(expires_hours, "expires_hours"),
			validateString(slug, "slug", 100),
			validateString(label, "label", 200),
			max_uses !== undefined ? validateNumber(max_uses, "max_uses") : null,
		);
		if (invalid) return invalid;

		// Find the folder or playlist
		const [folder, playlist] = await Promise.all([
			env.DB.prepare("SELECT id, slug, access_token FROM folders WHERE slug = ?").bind(slug).first<any>(),
			env.DB.prepare("SELECT id, slug, access_token FROM playlists WHERE slug = ?").bind(slug).first<any>(),
		]);

		const entity = folder || playlist;
		if (!entity) return json({ error: "Slug não encontrado" }, 404);

		const tokenBytes = new Uint8Array(32);
		crypto.getRandomValues(tokenBytes);
		const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

		const expiresAt = new Date(Date.now() + expires_hours * 3600 * 1000).toISOString();

		await env.DB.prepare(
			`INSERT INTO session_tokens (token, slug, access_token, created_at, expires_at, max_uses, label)
			 VALUES (?, ?, ?, datetime('now'), ?, ?, ?)`
		).bind(token, entity.slug, entity.access_token, expiresAt, max_uses || null, label || "Link manual").run();

		return json({ token, slug: entity.slug, expires_at: expiresAt, max_uses: max_uses || null });
	}

	// DELETE /api/temp-links/:token
	if (path.startsWith("/api/temp-links/") && request.method === "DELETE") {
		const token = path.slice("/api/temp-links/".length);
		await env.DB.prepare("DELETE FROM session_tokens WHERE token = ? AND label IS NOT NULL").bind(token).run();
		return json({ ok: true });
	}

	return null;
}
