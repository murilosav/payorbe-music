import { handleApi } from "./api";
import { renderPlaylistPage } from "./pages/playlist";
import { renderFolderPage } from "./pages/folder";
import { renderHomePage } from "./pages/home";
import { renderAdminPage } from "./pages/admin";
import { verifyAuth, handleLogin, handleLogout } from "./auth";
import { verifyJwt } from "./jwt";

export interface Env {
	DB: D1Database;
	MUSIC_BUCKET: R2Bucket;
	ADMIN_KEY?: string;
	JWT_SECRET?: string;
}

async function verifySongAccess(env: Env, songId: number, token: string): Promise<{ r2_key: string; title: string; artist: string; cover_r2_key: string } | null> {
	return env.DB.prepare(
		`SELECT s.r2_key, s.title, s.artist, s.cover_r2_key
		 FROM songs s JOIN playlists p ON s.playlist_id = p.id
		 WHERE s.id = ? AND p.access_token = ?`
	).bind(songId, token).first();
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const token = url.searchParams.get("token") || "";

		const origin = request.headers.get("Origin") || "";
		const allowedOrigins = ["https://patacos.com.br", "https://www.patacos.com.br"];
		const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
		const corsHeaders = {
			"Access-Control-Allow-Origin": corsOrigin,
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			// Auth routes
			if (path === "/admin/login") return handleLogin(request, env);
			if (path === "/admin/logout") return handleLogout(request, env);

			// Protected: API routes
			if (path.startsWith("/api/")) {
				if (!(await verifyAuth(request, env))) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401, headers: { "content-type": "application/json" },
					});
				}
				const response = await handleApi(request, env, path);
				const newHeaders = new Headers(response.headers);
				Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
				return new Response(response.body, { status: response.status, headers: newHeaders });
			}

			// Playlist cover image (requires token)
			if (path.startsWith("/playlist-cover/")) {
				const playlistId = parseInt(path.split("/")[2]);
				if (isNaN(playlistId) || !token) return new Response(null, { status: 403 });

				const playlist = await env.DB.prepare(
					"SELECT cover_r2_key FROM playlists WHERE id = ? AND access_token = ?"
				).bind(playlistId, token).first<{ cover_r2_key: string }>();
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

			// Cover image (requires token)
			if (path.startsWith("/cover/")) {
				const songId = parseInt(path.split("/")[2]);
				if (isNaN(songId) || !token) return new Response(null, { status: 403 });

				const song = await verifySongAccess(env, songId, token);
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

			// Download single song (requires token)
			if (path.startsWith("/download/")) {
				const songId = parseInt(path.split("/")[2]);
				if (isNaN(songId) || !token) return new Response("Access denied", { status: 403 });

				const song = await verifySongAccess(env, songId, token);
				if (!song) return new Response("Access denied", { status: 403 });

				const object = await env.MUSIC_BUCKET.get(song.r2_key);
				if (!object) return new Response("File not found", { status: 404 });

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

			// Download ZIP - serve pre-built ZIP from R2
			if (path.startsWith("/download-zip/")) {
				if (!token) return new Response("Access denied", { status: 403 });

				const parts = path.slice("/download-zip/".length).split("/");
				const slug = parts[0];
				const folder = decodeURIComponent(parts.slice(1).join("/") || "");
				const zipPart = parseInt(url.searchParams.get("part") || "1");

				// Check playlist token directly, or via folder token
				let playlist = await env.DB.prepare(
					"SELECT id, name FROM playlists WHERE slug = ? AND access_token = ?"
				).bind(slug, token).first<{ id: number; name: string }>();
				if (!playlist) {
					// Check if token belongs to a folder containing this playlist
					playlist = await env.DB.prepare(
						`SELECT p.id, p.name FROM playlists p
						 JOIN folders f ON p.folder_id = f.id
						 WHERE p.slug = ? AND f.access_token = ?`
					).bind(slug, token).first<{ id: number; name: string }>();
				}
				if (!playlist) return new Response("Access denied", { status: 403 });

				const zip = await env.DB.prepare(
					"SELECT r2_key, file_size, total_parts FROM playlist_zips WHERE playlist_id = ? AND folder = ? AND part = ?"
				).bind(playlist.id, folder, zipPart).first<{ r2_key: string; file_size: number; total_parts: number }>();

				if (!zip) {
					return new Response(renderZipUnavailable(), {
						status: 404, headers: { "content-type": "text/html; charset=utf-8" },
					});
				}

				const object = await env.MUSIC_BUCKET.get(zip.r2_key);
				if (!object) return new Response("ZIP not found", { status: 404 });

				let zipName = folder ? `${playlist.name} - ${folder}` : playlist.name;
				if (zip.total_parts > 1) zipName += ` (Parte ${zipPart} de ${zip.total_parts})`;
				zipName += ".zip";

				const encodedZipName = encodeURIComponent(zipName).replace(/%20/g, "+");
				return new Response(object.body, {
					headers: {
						"Content-Type": "application/zip",
						"Content-Disposition": `attachment; filename="${encodedZipName}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
						"Content-Length": String(zip.file_size),
					},
				});
			}

			// Admin page
			if (path === "/admin") {
				if (!(await verifyAuth(request, env))) {
					return new Response(null, { status: 302, headers: { "Location": "/admin/login" } });
				}
				return new Response(renderAdminPage(), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			// Home page (public)
			if (path === "/") {
				return new Response(renderHomePage(), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			// Playlist or Folder page: /:slug?token=xxxxx (static token or JWT)
			const slug = path.slice(1).split("/")[0];
			if (slug) {
				let playlist: any = null;
				let folder: any = null;
				let accessToken = token; // token used for download links

				// Detect JWT (starts with "eyJ") vs static token
				const isJwt = token.startsWith("eyJ") && env.JWT_SECRET;

				if (isJwt) {
					// JWT flow: verify token, check access limits
					let payload;
					try {
						payload = await verifyJwt(token, env.JWT_SECRET!);
					} catch (err: any) {
						const msg = err.message === "Token expirado" ? "expired" : "invalid";
						return new Response(renderJwtError(msg), {
							status: 403, headers: { "content-type": "text/html; charset=utf-8" },
						});
					}

					// Find by slug AND verify product_id matches
					[playlist, folder] = await Promise.all([
						env.DB.prepare("SELECT * FROM playlists WHERE slug = ? AND product_id = ?").bind(slug, payload.product_id).first(),
						env.DB.prepare("SELECT * FROM folders WHERE slug = ? AND product_id = ?").bind(slug, payload.product_id).first(),
					]);

					if (!playlist && !folder) {
						return new Response(renderAccessDenied(), {
							status: 403, headers: { "content-type": "text/html; charset=utf-8" },
						});
					}

					// Check download_limit
					const existing = await env.DB.prepare(
						"SELECT access_count FROM order_accesses WHERE order_id = ?"
					).bind(payload.order_id).first<{ access_count: number }>();

					const currentCount = existing?.access_count || 0;
					if (payload.download_limit > 0 && currentCount >= payload.download_limit) {
						return new Response(renderJwtError("limit"), {
							status: 403, headers: { "content-type": "text/html; charset=utf-8" },
						});
					}

					// Upsert access count
					if (existing) {
						await env.DB.prepare(
							"UPDATE order_accesses SET access_count = access_count + 1, last_accessed = datetime('now') WHERE order_id = ?"
						).bind(payload.order_id).run();
					} else {
						await env.DB.prepare(
							"INSERT INTO order_accesses (order_id, product_id, email, access_count, created_at, last_accessed) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))"
						).bind(payload.order_id, payload.product_id, payload.email).run();
					}

					// Use internal access_token for download links
					accessToken = (playlist || folder).access_token;
				} else {
					// Static token flow (existing behavior)
					[playlist, folder] = await Promise.all([
						env.DB.prepare("SELECT * FROM playlists WHERE slug = ? AND access_token = ?").bind(slug, token).first(),
						env.DB.prepare("SELECT * FROM folders WHERE slug = ? AND access_token = ?").bind(slug, token).first(),
					]);
				}

				if (playlist) {
					const [songs, zips] = await Promise.all([
						env.DB.prepare(
							"SELECT * FROM songs WHERE playlist_id = ? ORDER BY folder, track_number, title"
						).bind(playlist.id).all(),
						env.DB.prepare(
							"SELECT folder, part, total_parts, file_size, song_count FROM playlist_zips WHERE playlist_id = ? ORDER BY folder, part"
						).bind(playlist.id).all(),
					]);
					return new Response(renderPlaylistPage(playlist, songs.results, accessToken, zips.results), {
						headers: { "content-type": "text/html; charset=utf-8" },
					});
				}

				if (folder) {
					const playlists = await env.DB.prepare(
						"SELECT * FROM playlists WHERE folder_id = ? ORDER BY name"
					).bind(folder.id).all();

					const [songsResults, zipsResults] = await Promise.all([
						Promise.all(playlists.results.map((p: any) =>
							env.DB.prepare("SELECT * FROM songs WHERE playlist_id = ? ORDER BY folder, track_number, title").bind(p.id).all()
						)),
						Promise.all(playlists.results.map((p: any) =>
							env.DB.prepare("SELECT folder, part, total_parts, file_size, song_count FROM playlist_zips WHERE playlist_id = ? ORDER BY folder, part").bind(p.id).all()
						)),
					]);

					const allSongs = new Map<number, any[]>();
					const allZips = new Map<number, any[]>();
					playlists.results.forEach((p: any, i: number) => {
						allSongs.set(p.id, songsResults[i].results);
						allZips.set(p.id, zipsResults[i].results);
					});

					return new Response(renderFolderPage(folder, playlists.results, allSongs, allZips, accessToken), {
						headers: { "content-type": "text/html; charset=utf-8" },
					});
				}

				return new Response(renderAccessDenied(), {
					status: 403, headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			return new Response("Not found", { status: 404 });
		} catch (err: any) {
			console.error(err);
			return new Response(JSON.stringify({ error: err.message }), {
				status: 500, headers: { "content-type": "application/json" },
			});
		}
	},
} satisfies ExportedHandler<Env>;

function renderAccessDenied(): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Acesso Negado</title>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
	<style>
	*{margin:0;padding:0;box-sizing:border-box}
	body{font-family:'Inter',sans-serif;background:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh}
	.card{text-align:center;padding:48px}
	h1{font-size:20px;margin-bottom:8px;color:#1a1a1a}
	p{font-size:14px;color:#888}
	</style>
</head>
<body><div class="card"><h1>Acesso Negado</h1><p>Este link é inválido ou expirou. Entre em contato com o vendedor.</p></div></body>
</html>`;
}

function renderJwtError(type: "expired" | "invalid" | "limit" | "product"): string {
	const messages: Record<string, { title: string; desc: string }> = {
		expired: { title: "Link Expirado", desc: "Seu link de acesso expirou. Entre em contato com o vendedor para obter um novo link." },
		invalid: { title: "Link Inv\u00e1lido", desc: "Este link de acesso \u00e9 inv\u00e1lido. Verifique se copiou o link corretamente." },
		limit: { title: "Limite de Acessos Atingido", desc: "Voc\u00ea j\u00e1 atingiu o n\u00famero m\u00e1ximo de acessos permitidos para este link." },
		product: { title: "Produto N\u00e3o Encontrado", desc: "O produto associado a este link n\u00e3o foi encontrado. Entre em contato com o vendedor." },
	};
	const msg = messages[type] || messages.invalid;
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${msg.title} - Patacos</title>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
	<style>
	*{margin:0;padding:0;box-sizing:border-box}
	body{font-family:'Inter',sans-serif;background:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh}
	.card{text-align:center;padding:48px;max-width:400px}
	h1{font-size:20px;margin-bottom:8px;color:#1a1a1a}
	p{font-size:14px;color:#888;line-height:1.6}
	</style>
</head>
<body><div class="card"><h1>${msg.title}</h1><p>${msg.desc}</p></div></body>
</html>`;
}

function renderZipUnavailable(): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>ZIP Indisponível</title>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
	<style>
	*{margin:0;padding:0;box-sizing:border-box}
	body{font-family:'Inter',sans-serif;background:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh}
	.card{text-align:center;padding:48px}
	h1{font-size:20px;margin-bottom:8px;color:#1a1a1a}
	p{font-size:14px;color:#888}
	</style>
</head>
<body><div class="card"><h1>ZIP Indisponível</h1><p>O arquivo ZIP ainda está sendo preparado. Tente novamente em alguns minutos.</p></div></body>
</html>`;
}
