import { handleApi } from "./api";
import { renderPlaylistPage } from "./pages/playlist";
import { renderHomePage } from "./pages/home";
import { renderAdminPage } from "./pages/admin";
import { verifyAuth, handleLogin, handleLogout } from "./auth";
import { createZipStream } from "./zip";

export interface Env {
	DB: D1Database;
	MUSIC_BUCKET: R2Bucket;
	ADMIN_KEY?: string;
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

		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
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

				return new Response(object.body, {
					headers: {
						"Content-Type": "application/octet-stream",
						"Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
					},
				});
			}

			// Download ZIP - entire playlist or specific folder
			if (path.startsWith("/download-zip/")) {
				if (!token) return new Response("Access denied", { status: 403 });

				const parts = path.slice("/download-zip/".length).split("/");
				const slug = parts[0];
				const folder = decodeURIComponent(parts.slice(1).join("/") || "");

				const playlist = await env.DB.prepare(
					"SELECT id, name FROM playlists WHERE slug = ? AND access_token = ?"
				).bind(slug, token).first<{ id: number; name: string }>();
				if (!playlist) return new Response("Access denied", { status: 403 });

				let songs;
				let zipName: string;
				if (folder) {
					songs = await env.DB.prepare(
						"SELECT id, title, artist, r2_key FROM songs WHERE playlist_id = ? AND folder = ? ORDER BY track_number, title"
					).bind(playlist.id, folder).all();
					zipName = `${playlist.name} - ${folder}.zip`;
				} else {
					songs = await env.DB.prepare(
						"SELECT id, title, artist, r2_key, folder FROM songs WHERE playlist_id = ? ORDER BY folder, track_number, title"
					).bind(playlist.id).all();
					zipName = `${playlist.name}.zip`;
				}

				if (!songs.results.length) return new Response("No songs found", { status: 404 });

				// Build ZIP entries (lazy - streams from R2 on demand)
				const entries = songs.results.map((s: any) => {
					const ext = s.r2_key.split(".").pop() || "mp3";
					const name = folder
						? `${s.artist} - ${s.title}.${ext}`
						: `${s.folder ? s.folder + "/" : ""}${s.artist} - ${s.title}.${ext}`;
					return {
						name,
						size: 0, // not used for streaming
						get data() {
							return env.MUSIC_BUCKET.get(s.r2_key).then(obj => obj!.body);
						},
					};
				});

				// Create streaming ZIP - fetch R2 objects lazily
				const zipEntries = [];
				for (const entry of entries) {
					const body = await entry.data;
					if (body) {
						zipEntries.push({ name: entry.name, data: body, size: 0 });
					}
				}

				const zipStream = createZipStream(zipEntries);

				return new Response(zipStream, {
					headers: {
						"Content-Type": "application/zip",
						"Content-Disposition": `attachment; filename="${encodeURIComponent(zipName)}"`,
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

			// Home page (admin only)
			if (path === "/") {
				if (!(await verifyAuth(request, env))) {
					return new Response(null, { status: 302, headers: { "Location": "/admin/login" } });
				}
				const playlists = await env.DB.prepare("SELECT * FROM playlists ORDER BY created_at DESC").all();
				return new Response(renderHomePage(playlists.results), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			// Playlist page: /:slug?token=xxxxx
			const slug = path.slice(1).split("/")[0];
			if (slug) {
				const playlist = await env.DB.prepare(
					"SELECT * FROM playlists WHERE slug = ? AND access_token = ?"
				).bind(slug, token).first();
				if (!playlist) {
					return new Response(renderAccessDenied(), {
						status: 403, headers: { "content-type": "text/html; charset=utf-8" },
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
<body><div class="card"><h1>Acesso Negado</h1><p>Este link e invalido ou expirou. Entre em contato com o vendedor.</p></div></body>
</html>`;
}
