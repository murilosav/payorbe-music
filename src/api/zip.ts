import type { Env } from "../index";
import { json } from "./helpers";
import { generateZipForPlaylist } from "../queue";

export async function handleZip(request: Request, env: Env, path: string, ctx?: ExecutionContext): Promise<Response | null> {
	// POST /api/playlists/:id/zip/(start|part|complete|upload)
	const zipMatch = path.match(/^\/api\/playlists\/(\d+)\/zip\/(start|part|complete|upload)$/);
	if (zipMatch) {
		const id = parseInt(zipMatch[1]);
		const action = zipMatch[2];

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

		if (action === "start" && request.method === "POST") {
			const body = await request.json<{ key: string }>();
			const upload = await env.MUSIC_BUCKET.createMultipartUpload(body.key, {
				httpMetadata: { contentType: "application/zip" },
			});
			return json({ uploadId: upload.uploadId });
		}

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

		if (action === "complete" && request.method === "POST") {
			const body = await request.json<{
				uploadId: string; key: string;
				parts: { partNumber: number; etag: string }[];
				folder: string; zipPart: number; totalParts: number;
				fileSize: number; songCount: number;
			}>();

			// If uploaded via S3 API directly (CLI), skip R2 multipart complete
			if (body.uploadId !== "direct-s3") {
				const upload = env.MUSIC_BUCKET.resumeMultipartUpload(body.key, body.uploadId);
				await upload.complete(body.parts);
			}

			await env.DB.prepare(
				"DELETE FROM playlist_zips WHERE playlist_id = ? AND folder = ? AND part = ?"
			).bind(id, body.folder || "", body.zipPart || 1).run();

			await env.DB.prepare(
				"INSERT INTO playlist_zips (playlist_id, folder, part, total_parts, r2_key, file_size, song_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
			).bind(id, body.folder || "", body.zipPart || 1, body.totalParts || 1, body.key, body.fileSize || 0, body.songCount || 0).run();

			return json({ success: true });
		}
	}

	// POST /api/playlists/:id/generate-zip - Trigger server-side ZIP generation via Queue
	const genMatch = path.match(/^\/api\/playlists\/(\d+)\/generate-zip$/);
	if (genMatch && request.method === "POST") {
		const id = parseInt(genMatch[1]);
		const playlist = await env.DB.prepare("SELECT id, zip_status FROM playlists WHERE id = ?")
			.bind(id).first<{ id: number; zip_status: string }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

		// Block if currently generating (unless stale >15 min)
		const raw = playlist.zip_status || "";
		if (raw.startsWith("generating:")) {
			const startedAt = parseInt(raw.split(":")[1]);
			if (!isNaN(startedAt) && Date.now() - startedAt < 15 * 60 * 1000) {
				return json({ error: "ZIP já está sendo gerado. Aguarde ou tente novamente em alguns minutos." }, 409);
			}
		}

		// Run ZIP generation in background via waitUntil
		if (ctx) {
			ctx.waitUntil(generateZipForPlaylist(id, env));
		} else {
			await generateZipForPlaylist(id, env);
		}
		await env.DB.prepare("UPDATE playlists SET zip_status = 'queued' WHERE id = ?").bind(id).run();
		return json({ status: "queued" });
	}

	// GET /api/playlists/:id/zip-status - Check ZIP generation status
	const statusMatch = path.match(/^\/api\/playlists\/(\d+)\/zip-status$/);
	if (statusMatch && request.method === "GET") {
		const id = parseInt(statusMatch[1]);
		const playlist = await env.DB.prepare("SELECT zip_status FROM playlists WHERE id = ?")
			.bind(id).first<{ zip_status: string }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

		const raw = playlist.zip_status || "";

		// Auto-detect stale 'generating' status (>15 min = likely crashed worker)
		if (raw.startsWith("generating:")) {
			const startedAt = parseInt(raw.split(":")[1]);
			if (!isNaN(startedAt) && Date.now() - startedAt > 15 * 60 * 1000) {
				await env.DB.prepare("UPDATE playlists SET zip_status = 'error:Timeout — geração travou' WHERE id = ?").bind(id).run();
				return json({ status: "error", error: "Timeout — geração travou" });
			}
			return json({ status: "generating" });
		}

		// Parse error message
		if (raw.startsWith("error:")) {
			return json({ status: "error", error: raw.slice(6) });
		}

		return json({ status: raw });
	}

	// GET /api/playlists/:id/zips
	const zipsListMatch = path.match(/^\/api\/playlists\/(\d+)\/zips$/);
	if (zipsListMatch && request.method === "GET") {
		const id = parseInt(zipsListMatch[1]);
		const { results } = await env.DB.prepare(
			"SELECT * FROM playlist_zips WHERE playlist_id = ? ORDER BY folder, part"
		).bind(id).all();
		return json(results);
	}

	// DELETE /api/playlists/:id/zips
	if (zipsListMatch && request.method === "DELETE") {
		const id = parseInt(zipsListMatch[1]);
		const { results } = await env.DB.prepare(
			"SELECT r2_key FROM playlist_zips WHERE playlist_id = ?"
		).bind(id).all();

		const r2Deletes = results.map((z: any) => z.r2_key ? env.MUSIC_BUCKET.delete(z.r2_key).catch(() => {}) : Promise.resolve());
		await Promise.all(r2Deletes);
		await env.DB.prepare("DELETE FROM playlist_zips WHERE playlist_id = ?").bind(id).run();
		return json({ success: true });
	}

	return null;
}
