import { handleApi } from "./api";
import { renderPlaylistPage } from "./pages/playlist";
import { renderHomePage } from "./pages/home";
import { renderAdminPage } from "./pages/admin";

export interface Env {
	DB: D1Database;
	MUSIC_BUCKET: R2Bucket;
	ADMIN_KEY?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

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
			// API routes
			if (path.startsWith("/api/")) {
				const response = await handleApi(request, env, path);
				// Add CORS headers to API responses
				const newHeaders = new Headers(response.headers);
				Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
				return new Response(response.body, { status: response.status, headers: newHeaders });
			}

			// Stream a song
			if (path.startsWith("/stream/")) {
				const songId = parseInt(path.split("/")[2]);
				if (isNaN(songId)) return new Response("Invalid ID", { status: 400 });

				const song = await env.DB.prepare("SELECT r2_key, title FROM songs WHERE id = ?").bind(songId).first<{ r2_key: string; title: string }>();
				if (!song) return new Response("Song not found", { status: 404 });

				const object = await env.MUSIC_BUCKET.get(song.r2_key);
				if (!object) return new Response("File not found in storage", { status: 404 });

				const headers = new Headers();
				headers.set("Content-Type", object.httpMetadata?.contentType || "audio/mpeg");
				headers.set("Accept-Ranges", "bytes");
				headers.set("Cache-Control", "public, max-age=31536000");

				// Handle range requests for seeking
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

			// Download a song
			if (path.startsWith("/download/")) {
				const songId = parseInt(path.split("/")[2]);
				if (isNaN(songId)) return new Response("Invalid ID", { status: 400 });

				const song = await env.DB.prepare("SELECT r2_key, title, artist FROM songs WHERE id = ?").bind(songId).first<{ r2_key: string; title: string; artist: string }>();
				if (!song) return new Response("Song not found", { status: 404 });

				const object = await env.MUSIC_BUCKET.get(song.r2_key);
				if (!object) return new Response("File not found in storage", { status: 404 });

				const ext = song.r2_key.split(".").pop() || "mp3";
				const filename = `${song.artist} - ${song.title}.${ext}`;

				return new Response(object.body, {
					headers: {
						"Content-Type": "application/octet-stream",
						"Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
					},
				});
			}

			// Song cover image
			if (path.startsWith("/cover/")) {
				const songId = parseInt(path.split("/")[2]);
				if (isNaN(songId)) return new Response("Invalid ID", { status: 400 });

				const song = await env.DB.prepare("SELECT cover_r2_key FROM songs WHERE id = ?").bind(songId).first<{ cover_r2_key: string }>();
				if (!song || !song.cover_r2_key) {
					return new Response(null, { status: 404 });
				}

				const object = await env.MUSIC_BUCKET.get(song.cover_r2_key);
				if (!object) return new Response(null, { status: 404 });

				return new Response(object.body, {
					headers: {
						"Content-Type": object.httpMetadata?.contentType || "image/jpeg",
						"Cache-Control": "public, max-age=31536000",
					},
				});
			}

			// Admin page
			if (path === "/admin") {
				return new Response(renderAdminPage(), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			// Home page
			if (path === "/") {
				const playlists = await env.DB.prepare("SELECT * FROM playlists ORDER BY created_at DESC").all();
				return new Response(renderHomePage(playlists.results), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			// Playlist page (/:slug)
			const slug = path.slice(1).split("/")[0];
			if (slug) {
				const playlist = await env.DB.prepare("SELECT * FROM playlists WHERE slug = ?").bind(slug).first();
				if (!playlist) return new Response("Playlist not found", { status: 404 });

				const songs = await env.DB.prepare(
					"SELECT * FROM songs WHERE playlist_id = ? ORDER BY folder, track_number, title"
				).bind(playlist.id).all();

				return new Response(renderPlaylistPage(playlist, songs.results), {
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
