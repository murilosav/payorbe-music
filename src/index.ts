import { handleApi } from "./api";
import { renderPlaylistPage } from "./pages/playlist";
import { renderHomePage } from "./pages/home";
import { renderAdminPage } from "./pages/admin";
import { verifyAuth, handleLogin, handleLogout } from "./auth";

export interface Env {
	DB: D1Database;
	MUSIC_BUCKET: R2Bucket;
	ADMIN_KEY?: string;
}

// Verify that a song belongs to a playlist with the given access token
async function verifySongAccess(env: Env, songId: number, token: string): Promise<{ r2_key: string; title: string; artist: string; cover_r2_key: string } | null> {
	const song = await env.DB.prepare(
		`SELECT s.r2_key, s.title, s.artist, s.cover_r2_key
		 FROM songs s
		 JOIN playlists p ON s.playlist_id = p.id
		 WHERE s.id = ? AND p.access_token = ?`
	).bind(songId, token).first<{ r2_key: string; title: string; artist: string; cover_r2_key: string }>();
	return song || null;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const token = url.searchParams.get("token") || "";

		// CORS headers
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			// Auth routes (public)
			if (path === "/admin/login") {
				return handleLogin(request, env);
			}
			if (path === "/admin/logout") {
				return handleLogout(request, env);
			}

			// Protected: API routes (admin only)
			if (path.startsWith("/api/")) {
				const isAuthed = await verifyAuth(request, env);
				if (!isAuthed) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "content-type": "application/json" },
					});
				}
				const response = await handleApi(request, env, path);
				const newHeaders = new Headers(response.headers);
				Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
				return new Response(response.body, { status: response.status, headers: newHeaders });
			}

			// Stream a song (requires valid playlist token)
			if (path.startsWith("/stream/")) {
				const songId = parseInt(path.split("/")[2]);
				if (isNaN(songId) || !token) return new Response("Access denied", { status: 403 });

				const song = await verifySongAccess(env, songId, token);
				if (!song) return new Response("Access denied", { status: 403 });

				const object = await env.MUSIC_BUCKET.get(song.r2_key);
				if (!object) return new Response("File not found", { status: 404 });

				const headers = new Headers();
				headers.set("Content-Type", object.httpMetadata?.contentType || "audio/mpeg");
				headers.set("Accept-Ranges", "bytes");
				headers.set("Cache-Control", "private, max-age=3600");

				const range = request.headers.get("Range");
				if (range && object.size) {
					const match = range.match(/bytes=(\d+)-(\d*)/);
					if (match) {
						const start = parseInt(match[1]);
						const end = match[2] ? parseInt(match[2]) : object.size - 1;
						const sliced = await env.MUSIC_BUCKET.get(song.r2_key, {
							range: { offset: start, length: end - start + 1 },
						});
						if (!sliced) return new Response("Range not satisfiable", { status: 416 });
						headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
						headers.set("Content-Length", String(end - start + 1));
						return new Response(sliced.body, { status: 206, headers });
					}
				}

				if (object.size) headers.set("Content-Length", String(object.size));
				return new Response(object.body, { headers });
			}

			// Download a song (requires valid playlist token)
			if (path.startsWith("/download/")) {
				const songId = parseInt(path.split("/")[2]);
				if (isNaN(songId) || !token) return new Response("Access denied", { status: 403 });

				const song = await verifySongAccess(env, songId, token);
				if (!song) return new Response("Access denied", { status: 403 });

				const object = await env.MUSIC_BUCKET.get(song.r2_key);
				if (!object) return new Response("File not found", { status: 404 });

				const ext = song.r2_key.split(".").pop() || "mp3";
				const filename = `${song.artist} - ${song.title}.${ext}`;

				return new Response(object.body, {
					headers: {
						"Content-Type": "application/octet-stream",
						"Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
					},
				});
			}

			// Song cover image (requires valid playlist token)
			if (path.startsWith("/cover/")) {
				const songId = parseInt(path.split("/")[2]);
				if (isNaN(songId) || !token) return new Response("Access denied", { status: 403 });

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

			// Protected: Admin page
			if (path === "/admin") {
				const isAuthed = await verifyAuth(request, env);
				if (!isAuthed) {
					return new Response(null, {
						status: 302,
						headers: { "Location": "/admin/login" },
					});
				}
				return new Response(renderAdminPage(), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			// Home page (only for admin - redirects to login)
			if (path === "/") {
				const isAuthed = await verifyAuth(request, env);
				if (!isAuthed) {
					return new Response(null, {
						status: 302,
						headers: { "Location": "/admin/login" },
					});
				}
				const playlists = await env.DB.prepare("SELECT * FROM playlists ORDER BY created_at DESC").all();
				return new Response(renderHomePage(playlists.results), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			// Playlist page: /:slug?token=xxxxx
			const slugParts = path.slice(1).split("/");
			const slug = slugParts[0];
			if (slug) {
				const playlist = await env.DB.prepare("SELECT * FROM playlists WHERE slug = ? AND access_token = ?").bind(slug, token).first();
				if (!playlist) {
					return new Response(renderAccessDenied(), {
						status: 403,
						headers: { "content-type": "text/html; charset=utf-8" },
					});
				}

				const songs = await env.DB.prepare(
					"SELECT * FROM songs WHERE playlist_id = ? ORDER BY folder, track_number, title"
				).bind(playlist.id).all();

				return new Response(renderPlaylistPage(playlist, songs.results, token), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			return new Response("Not found", { status: 404 });
		} catch (err: any) {
			console.error(err);
			return new Response(JSON.stringify({ error: err.message }), {
				status: 500,
				headers: { "content-type": "application/json" },
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
	<title>Acesso Negado - Patacos</title>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
	<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body { font-family: 'Inter', sans-serif; background: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
	.card { text-align: center; padding: 48px; }
	h1 { font-size: 20px; margin-bottom: 8px; color: #1a1a1a; }
	p { font-size: 14px; color: #888; }
	</style>
</head>
<body>
	<div class="card">
		<h1>Acesso Negado</h1>
		<p>Este link e invalido ou expirou. Entre em contato com o vendedor.</p>
	</div>
</body>
</html>`;
}
