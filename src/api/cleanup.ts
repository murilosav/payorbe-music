import type { Env } from "../index";
import { json } from "./helpers";

export async function handleCleanup(request: Request, env: Env, path: string): Promise<Response | null> {
	if (path !== "/api/cleanup") return null;

	// GET = dry run (list orphans), POST = delete orphans
	if (request.method !== "GET" && request.method !== "POST") return null;

	// Collect all known R2 keys from DB
	const [songs, covers, playlistCovers, zips] = await Promise.all([
		env.DB.prepare("SELECT r2_key FROM songs WHERE r2_key != ''").all(),
		env.DB.prepare("SELECT cover_r2_key FROM songs WHERE cover_r2_key != ''").all(),
		env.DB.prepare("SELECT cover_r2_key FROM playlists WHERE cover_r2_key != ''").all(),
		env.DB.prepare("SELECT r2_key FROM playlist_zips").all(),
	]);

	const dbKeys = new Set<string>();
	for (const row of songs.results) dbKeys.add((row as any).r2_key);
	for (const row of covers.results) dbKeys.add((row as any).cover_r2_key);
	for (const row of playlistCovers.results) dbKeys.add((row as any).cover_r2_key);
	for (const row of zips.results) dbKeys.add((row as any).r2_key);

	// List all R2 objects (paginate with cursor)
	const orphanKeys: string[] = [];
	let cursor: string | undefined;
	let r2Total = 0;

	do {
		const listed = await env.MUSIC_BUCKET.list({
			limit: 1000,
			cursor,
		});

		for (const obj of listed.objects) {
			r2Total++;
			if (!dbKeys.has(obj.key)) {
				orphanKeys.push(obj.key);
			}
		}

		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);

	// Also check for DB records pointing to missing R2 keys (sample check, max 100)
	const missingInR2: string[] = [];
	const sampleKeys = Array.from(dbKeys).slice(0, 100);
	const headChecks = await Promise.all(
		sampleKeys.map(async (key) => {
			const obj = await env.MUSIC_BUCKET.head(key);
			return obj ? null : key;
		})
	);
	for (const key of headChecks) {
		if (key) missingInR2.push(key);
	}

	if (request.method === "GET") {
		return json({
			r2_total: r2Total,
			db_keys: dbKeys.size,
			orphan_count: orphanKeys.length,
			orphan_keys: orphanKeys.slice(0, 200),
			missing_in_r2: missingInR2,
		});
	}

	// POST = delete orphans
	let deleted = 0;
	const BATCH = 50;
	for (let i = 0; i < orphanKeys.length; i += BATCH) {
		const batch = orphanKeys.slice(i, i + BATCH);
		await Promise.all(batch.map(key => env.MUSIC_BUCKET.delete(key).catch(() => {})));
		deleted += batch.length;
	}

	return json({
		deleted,
		orphan_count: orphanKeys.length,
		missing_in_r2: missingInR2,
	});
}
