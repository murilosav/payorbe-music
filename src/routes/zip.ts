import type { Env } from "../index";
import { resolveToken } from "./media";
import { renderZipUnavailable } from "./error-pages";

export async function handleZipDownload(request: Request, env: Env, path: string, url: URL, token: string, isAdmin: boolean): Promise<Response | null> {
	if (!path.startsWith("/download-zip/")) return null;

	if (!token && !isAdmin) return new Response("Access denied", { status: 403 });

	const parts = path.slice("/download-zip/".length).split("/");
	const slug = parts[0];
	const folder = decodeURIComponent(parts.slice(1).join("/") || "");
	const zipPart = parseInt(url.searchParams.get("part") || "1");

	let playlist: { id: number; name: string } | null = null;
	if (isAdmin) {
		playlist = await env.DB.prepare(
			"SELECT id, name FROM playlists WHERE slug = ?"
		).bind(slug).first<{ id: number; name: string }>();
	} else {
		const realToken = await resolveToken(env, token);
		playlist = await env.DB.prepare(
			"SELECT id, name FROM playlists WHERE slug = ? AND access_token = ?"
		).bind(slug, realToken).first<{ id: number; name: string }>();
		if (!playlist) {
			playlist = await env.DB.prepare(
				`SELECT p.id, p.name FROM playlists p
				 JOIN playlist_folders pf ON p.id = pf.playlist_id
				 JOIN folders f ON pf.folder_id = f.id
				 WHERE p.slug = ? AND f.access_token = ?`
			).bind(slug, realToken).first<{ id: number; name: string }>();
		}
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

	// Parse Range header for resumable downloads
	const rangeHeader = request.headers.get("range");
	let object: R2ObjectBody | null;

	if (rangeHeader) {
		const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
		if (match) {
			const start = parseInt(match[1]);
			const end = match[2] ? parseInt(match[2]) : undefined;
			object = await env.MUSIC_BUCKET.get(zip.r2_key, {
				range: { offset: start, length: end !== undefined ? end - start + 1 : undefined },
			});
		} else {
			object = await env.MUSIC_BUCKET.get(zip.r2_key);
		}
	} else {
		object = await env.MUSIC_BUCKET.get(zip.r2_key);
	}

	if (!object) return new Response("ZIP not found", { status: 404 });

	// Increment download counter only on full downloads (not resumes)
	if (!rangeHeader) {
		env.DB.prepare("UPDATE playlists SET download_count = COALESCE(download_count, 0) + 1 WHERE id = ?")
			.bind(playlist.id).run().catch(() => {});
	}

	let zipName = playlist.name;
	if (zip.total_parts > 1) zipName += ` (Parte ${zipPart} de ${zip.total_parts})`;
	zipName += ".zip";

	const encodedZipName = encodeURIComponent(zipName).replace(/%20/g, "+");
	const totalSize = zip.file_size;

	const headers: Record<string, string> = {
		"Content-Type": "application/zip",
		"Content-Disposition": `attachment; filename="${encodedZipName}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
		"Cache-Control": "public, max-age=604800",
		"Accept-Ranges": "bytes",
	};

	if (rangeHeader) {
		const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
		if (match) {
			const start = parseInt(match[1]);
			const end = match[2] ? parseInt(match[2]) : totalSize - 1;
			headers["Content-Range"] = `bytes ${start}-${end}/${totalSize}`;
			headers["Content-Length"] = String(end - start + 1);
			return new Response(object.body, { status: 206, headers });
		}
	}

	headers["Content-Length"] = String(totalSize);
	return new Response(object.body, { headers });
}
