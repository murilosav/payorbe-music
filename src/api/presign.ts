import type { Env } from "../index";
import { AwsClient } from "aws4fetch";
import { json } from "./helpers";

export async function handlePresign(request: Request, env: Env, path: string): Promise<Response | null> {
	// POST /api/presign/upload - Generate presigned PUT URL for direct R2 upload
	if (path === "/api/presign/upload" && request.method === "POST") {
		const body = await request.json<{
			playlist_id: string;
			filename: string;
			folder: string;
			content_type: string;
		}>();

		if (!body.playlist_id || !body.filename) {
			return json({ error: "playlist_id and filename required" }, 400);
		}

		const playlist = await env.DB.prepare("SELECT slug FROM playlists WHERE id = ?")
			.bind(parseInt(body.playlist_id)).first<{ slug: string }>();
		if (!playlist) return json({ error: "Playlist not found" }, 404);

		const folderPath = body.folder ? `${body.folder}/` : "";
		const r2Key = `playlists/${playlist.slug}/${folderPath}${body.filename}`;

		// Check for duplicate
		const existing = await env.DB.prepare(
			"SELECT id FROM songs WHERE playlist_id = ? AND r2_key = ?"
		).bind(parseInt(body.playlist_id), r2Key).first();
		if (existing) return json({ error: "duplicate", message: "Música já existe nesta playlist" }, 409);

		const contentType = body.content_type || "audio/mpeg";
		const r2Client = new AwsClient({
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		});

		const endpoint = `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
		const url = new URL(`${endpoint}/${env.R2_BUCKET_NAME}/${r2Key}`);
		url.searchParams.set("X-Amz-Expires", "3600");

		const signed = await r2Client.sign(
			new Request(url, { method: "PUT", headers: { "Content-Type": contentType } }),
			{ aws: { signQuery: true } }
		);

		return json({ url: signed.url, r2Key, contentType });
	}

	// POST /api/songs/register - Register song in DB after direct R2 upload
	if (path === "/api/songs/register" && request.method === "POST") {
		const body = await request.json<{
			playlist_id: string;
			r2_key: string;
			title: string;
			artist: string;
			album: string;
			folder: string;
			duration: number;
			track_number: number;
			file_size: number;
		}>();

		if (!body.playlist_id || !body.r2_key || !body.title) {
			return json({ error: "playlist_id, r2_key, and title required" }, 400);
		}

		try {
			await env.DB.prepare(
				`INSERT INTO songs (playlist_id, title, artist, album, duration, track_number, folder, r2_key, cover_r2_key, file_size)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)`
			).bind(
				parseInt(body.playlist_id), body.title, body.artist || "Desconhecido",
				body.album || "", body.duration || 0, body.track_number || 0,
				body.folder || "", body.r2_key, body.file_size || 0
			).run();
		} catch (dbErr: any) {
			// Duplicate (race condition) — return existing
			const existing = await env.DB.prepare("SELECT * FROM songs WHERE r2_key = ?").bind(body.r2_key).first();
			if (existing) return json(existing, 200);
			return json({ error: dbErr.message }, 500);
		}

		const song = await env.DB.prepare("SELECT * FROM songs WHERE r2_key = ?").bind(body.r2_key).first();
		return json(song, 201);
	}

	return null;
}
