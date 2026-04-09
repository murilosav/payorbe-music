import { handleApi } from "./api";
import { renderPlaylistPage } from "./pages/playlist";
import { renderFolderPage } from "./pages/folder";
import { renderHomePage } from "./pages/home";
import { renderAdminPage } from "./pages/admin";
import { verifyAuth, handleLogin, handleLogout } from "./auth";
import { verifyJwt } from "./jwt";
import { handlePlaylistCover, handleSongCover, handleDownload } from "./routes/media";
import { handleZipDownload } from "./routes/zip";
import { renderAccessDenied, renderJwtError } from "./routes/error-pages";
export interface Env {
	DB: D1Database;
	MUSIC_BUCKET: R2Bucket;
	ADMIN_KEY?: string;
	R2_ACCESS_KEY_ID: string;
	R2_SECRET_ACCESS_KEY: string;
	CF_ACCOUNT_ID: string;
	R2_BUCKET_NAME: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
			// Cleanup expired session tokens (~2% of requests)
			if (Math.random() < 0.02) {
				env.DB.prepare("DELETE FROM session_tokens WHERE expires_at < datetime('now')").run();
			}

			const isAdmin = await verifyAuth(request, env);

			// Auth routes
			if (path === "/admin/login") return handleLogin(request, env);
			if (path === "/admin/logout") return handleLogout(request, env);

			// API routes (admin only)
			if (path.startsWith("/api/")) {
				if (!isAdmin) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401, headers: { "content-type": "application/json" },
					});
				}
				const response = await handleApi(request, env, path, ctx);
				const newHeaders = new Headers(response.headers);
				Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
				return new Response(response.body, { status: response.status, headers: newHeaders });
			}

			// Media routes (covers, downloads)
			const playlistCover = await handlePlaylistCover(request, env, path, token, isAdmin);
			if (playlistCover) return playlistCover;

			const songCover = await handleSongCover(request, env, path, token, isAdmin);
			if (songCover) return songCover;

			const download = await handleDownload(request, env, path, token, isAdmin);
			if (download) return download;

			// ZIP download
			const zipDownload = await handleZipDownload(request, env, path, url, token, isAdmin);
			if (zipDownload) return zipDownload;

			// Admin page
			if (path === "/admin") {
				if (!isAdmin) {
					return new Response(null, { status: 302, headers: { "Location": "/admin/login" } });
				}
				return new Response(renderAdminPage(), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			// Home page
			if (path === "/") {
				return new Response(renderHomePage(), {
					headers: { "content-type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
				});
			}

			// Playlist or Folder page: /:slug?token=JWT or admin cookie
			const slug = path.slice(1).split("/")[0];
			if (slug) {
				return await handleSlugPage(env, request, slug, token, isAdmin);
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

async function handleSlugPage(env: Env, _request: Request, slug: string, token: string, isAdmin: boolean): Promise<Response> {
	let playlist: any = null;
	let folder: any = null;
	let accessToken = "";
	let expiresAt = "";
	let setCookie = "";

	if (isAdmin && !token) {
		[playlist, folder] = await Promise.all([
			env.DB.prepare("SELECT * FROM playlists WHERE slug = ?").bind(slug).first(),
			env.DB.prepare("SELECT * FROM folders WHERE slug = ?").bind(slug).first(),
		]);
	} else if (token) {
		const session = await env.DB.prepare(
			"SELECT access_token, expires_at, max_uses, use_count, label FROM session_tokens WHERE token = ? AND expires_at > datetime('now')"
		).bind(token).first<{ access_token: string; expires_at: string; max_uses: number | null; use_count: number; label: string | null }>();

		if (session) {
			// Shared link with max_uses: check limit using cookie to deduplicate
			if (session.max_uses !== null) {
				const cookieName = `patacos_v_${token.slice(0, 12)}`;
				const cookies = _request.headers.get("cookie") || "";
				const isRepeatVisit = cookies.includes(cookieName + "=1");

				if (!isRepeatVisit) {
					if (session.use_count >= session.max_uses) {
						return new Response(renderAccessDenied("Limite de acessos atingido para este link."), {
							status: 403, headers: { "content-type": "text/html; charset=utf-8" },
						});
					}
					// Increment use_count (non-blocking)
					env.DB.prepare("UPDATE session_tokens SET use_count = use_count + 1 WHERE token = ?")
						.bind(token).run().catch(() => {});
					// Set cookie to avoid counting refreshes (expires with the link)
					const cookieExpires = new Date(session.expires_at).toUTCString();
					setCookie = `${cookieName}=1; Path=/; Expires=${cookieExpires}; SameSite=Lax`;
				}
			}

			[playlist, folder] = await Promise.all([
				env.DB.prepare("SELECT * FROM playlists WHERE slug = ? AND access_token = ?").bind(slug, session.access_token).first(),
				env.DB.prepare("SELECT * FROM folders WHERE slug = ? AND access_token = ?").bind(slug, session.access_token).first(),
			]);
			accessToken = token;
			expiresAt = session.expires_at;
		} else if (token.startsWith("eyJ")) {
			const result = await handleJwtAccess(env, slug, token);
			if (result.error) {
				return new Response(result.error, {
					status: 403, headers: { "content-type": "text/html; charset=utf-8" },
				});
			}
			playlist = result.playlist;
			folder = result.folder;
			accessToken = result.accessToken;
		}
	}

	if (playlist) {
		const [folderStats, previewSongs, zips] = await Promise.all([
			env.DB.prepare(
				"SELECT folder, COUNT(*) as count FROM songs WHERE playlist_id = ? GROUP BY folder ORDER BY folder"
			).bind(playlist.id).all(),
			env.DB.prepare(
				"SELECT * FROM songs WHERE playlist_id = ? ORDER BY folder, track_number, title LIMIT 200"
			).bind(playlist.id).all(),
			env.DB.prepare(
				"SELECT folder, part, total_parts, file_size, song_count FROM playlist_zips WHERE playlist_id = ? ORDER BY folder, part"
			).bind(playlist.id).all(),
		]);
		const totalCount = folderStats.results.reduce((sum: number, r: any) => sum + (r.count as number), 0);
		const headers: Record<string, string> = {
			"content-type": "text/html; charset=utf-8",
			"Cache-Control": "private, max-age=300",
		};
		if (setCookie) headers["set-cookie"] = setCookie;
		return new Response(
			renderPlaylistPage(playlist, folderStats.results as any[], previewSongs.results, totalCount, accessToken, zips.results, expiresAt),
			{ headers },
		);
	}

	if (folder) {
		const [playlists, allSongsRows, allZipsRows] = await Promise.all([
			env.DB.prepare(
				"SELECT p.* FROM playlists p JOIN playlist_folders pf ON p.id = pf.playlist_id WHERE pf.folder_id = ? ORDER BY pf.position, p.name"
			).bind(folder.id).all(),
			env.DB.prepare(
				"SELECT s.* FROM songs s JOIN playlists p ON s.playlist_id = p.id JOIN playlist_folders pf ON p.id = pf.playlist_id WHERE pf.folder_id = ? ORDER BY s.playlist_id, s.folder, s.track_number, s.title"
			).bind(folder.id).all(),
			env.DB.prepare(
				"SELECT pz.* FROM playlist_zips pz JOIN playlists p ON pz.playlist_id = p.id JOIN playlist_folders pf ON p.id = pf.playlist_id WHERE pf.folder_id = ? ORDER BY pz.playlist_id, pz.folder, pz.part"
			).bind(folder.id).all(),
		]);

		const allSongs = new Map<number, any[]>();
		const allZips = new Map<number, any[]>();
		for (const s of allSongsRows.results) {
			const pid = (s as any).playlist_id;
			if (!allSongs.has(pid)) allSongs.set(pid, []);
			allSongs.get(pid)!.push(s);
		}
		for (const z of allZipsRows.results) {
			const pid = (z as any).playlist_id;
			if (!allZips.has(pid)) allZips.set(pid, []);
			allZips.get(pid)!.push(z);
		}

		// Ensure every playlist has an entry in the maps (even if empty)
		for (const p of playlists.results) {
			const pid = (p as any).id;
			if (!allSongs.has(pid)) allSongs.set(pid, []);
			if (!allZips.has(pid)) allZips.set(pid, []);
		}

		const headers: Record<string, string> = {
			"content-type": "text/html; charset=utf-8",
			"Cache-Control": "private, max-age=300",
		};
		if (setCookie) headers["set-cookie"] = setCookie;
		return new Response(renderFolderPage(folder, playlists.results, allSongs, allZips, accessToken, expiresAt), { headers });
	}

	return new Response(renderAccessDenied(), {
		status: 403, headers: { "content-type": "text/html; charset=utf-8" },
	});
}

async function handleJwtAccess(env: Env, slug: string, token: string): Promise<{ playlist?: any; folder?: any; accessToken: string; error?: string }> {
	const [playlist, folder] = await Promise.all([
		env.DB.prepare("SELECT * FROM playlists WHERE slug = ?").bind(slug).first(),
		env.DB.prepare("SELECT * FROM folders WHERE slug = ?").bind(slug).first(),
	]);

	if (!playlist && !folder) {
		return { accessToken: "", error: renderAccessDenied() };
	}

	const entity = (playlist || folder) as any;
	const jwtSecretField = (entity.jwt_secret || "").trim();
	if (!jwtSecretField) {
		return { accessToken: "", error: renderAccessDenied() };
	}

	const secrets = jwtSecretField.split("\n").map((s: string) => s.trim()).filter(Boolean);
	let payload = null;
	let lastError = "";
	for (const secret of secrets) {
		try {
			payload = await verifyJwt(token, secret);
			break;
		} catch (err: any) {
			lastError = err.message;
		}
	}

	if (!payload) {
		const msg = lastError === "Token expirado" ? "expired" : "invalid";
		return { accessToken: "", error: renderJwtError(msg) };
	}

	// Check for existing valid session for this order — reuse without incrementing access count
	const existingSession = await env.DB.prepare(
		"SELECT token FROM session_tokens WHERE slug = ? AND access_token = ? AND expires_at > datetime('now') LIMIT 1"
	).bind(slug, entity.access_token).first<{ token: string }>();

	if (existingSession) {
		return { playlist, folder, accessToken: existingSession.token };
	}

	// Check download_limit
	const existing = await env.DB.prepare(
		"SELECT access_count FROM order_accesses WHERE order_id = ?"
	).bind(payload.order_id).first<{ access_count: number }>();

	const currentCount = existing?.access_count || 0;
	if (payload.download_limit > 0 && currentCount >= payload.download_limit) {
		return { accessToken: "", error: renderJwtError("limit") };
	}

	// Upsert access count — only on first session creation
	if (existing) {
		await env.DB.prepare(
			"UPDATE order_accesses SET access_count = access_count + 1, last_accessed = datetime('now') WHERE order_id = ?"
		).bind(payload.order_id).run();
	} else {
		await env.DB.prepare(
			"INSERT INTO order_accesses (order_id, product_id, email, access_count, created_at, last_accessed) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))"
		).bind(payload.order_id, payload.product_id, payload.email).run();
	}

	// Generate temporary session token
	const sessionBytes = new Uint8Array(32);
	crypto.getRandomValues(sessionBytes);
	const sessionToken = Array.from(sessionBytes).map(b => b.toString(16).padStart(2, "0")).join("");
	const realAccessToken = entity.access_token;

	const expiresAt = payload.exp
		? new Date(payload.exp * 1000).toISOString()
		: new Date(Date.now() + 7 * 86400 * 1000).toISOString();

	await env.DB.prepare(
		"INSERT INTO session_tokens (token, slug, access_token, created_at, expires_at) VALUES (?, ?, ?, datetime('now'), ?)"
	).bind(sessionToken, slug, realAccessToken, expiresAt).run();

	return { playlist, folder, accessToken: sessionToken };
}
