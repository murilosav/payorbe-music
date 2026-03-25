import type { Env } from "./index";

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
	let c = i;
	for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
	crcTable[i] = c;
}

function crc32(data: Uint8Array): number {
	let crc = 0xFFFFFFFF;
	for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
	return (crc ^ 0xFFFFFFFF) >>> 0;
}

function concatBuffers(buffers: Uint8Array[]): Uint8Array {
	let totalSize = 0;
	for (const b of buffers) totalSize += b.length;
	const result = new Uint8Array(totalSize);
	let pos = 0;
	for (const b of buffers) {
		result.set(b, pos);
		pos += b.length;
	}
	return result;
}

export async function generateZipForPlaylist(playlistId: number, env: Env): Promise<void> {
	await env.DB.prepare("UPDATE playlists SET zip_status = ? WHERE id = ?")
		.bind(`generating:${Date.now()}`, playlistId).run();

	try {
		// Get all songs
		const { results: songs } = await env.DB.prepare(
			"SELECT id, title, artist, folder, r2_key, file_size FROM songs WHERE playlist_id = ? ORDER BY folder, track_number, title"
		).bind(playlistId).all();

		if (songs.length === 0) {
			await env.DB.prepare("UPDATE playlists SET zip_status = '' WHERE id = ?").bind(playlistId).run();
			return;
		}

		// Delete old zips
		const { results: oldZips } = await env.DB.prepare(
			"SELECT r2_key FROM playlist_zips WHERE playlist_id = ?"
		).bind(playlistId).all();
		if (oldZips.length > 0) {
			await Promise.all(oldZips.map(z => env.MUSIC_BUCKET.delete((z as any).r2_key).catch(() => {})));
		}
		await env.DB.prepare("DELETE FROM playlist_zips WHERE playlist_id = ?").bind(playlistId).run();

		// Start multipart upload for ZIP
		const r2Key = `zips/playlist-${playlistId}/_all_part1.zip`;
		const mpu = await env.MUSIC_BUCKET.createMultipartUpload(r2Key, {
			httpMetadata: { contentType: "application/zip" },
		});

		const MIN_PART_SIZE = 10 * 1024 * 1024; // 10MB min per R2 multipart part
		const entries: Array<{ nameBytes: Uint8Array; crc: number; fileSize: number; headerOffset: number }> = [];
		let buffer: Uint8Array[] = [];
		let bufferSize = 0;
		let offset = 0;
		const parts: Array<{ partNumber: number; etag: string }> = [];
		let partNumber = 1;

		async function flushBuffer(force = false): Promise<void> {
			if (bufferSize === 0) return;
			if (bufferSize < MIN_PART_SIZE && !force) return;

			const data = concatBuffers(buffer);
			buffer = [];
			bufferSize = 0;

			const uploaded = await mpu.uploadPart(partNumber, data);
			parts.push({ partNumber, etag: uploaded.etag });
			partNumber++;
		}

		// Process each song one at a time (keeps memory low)
		for (const song of songs) {
			const s = song as any;

			// Flush before reading song to minimize peak memory
			await flushBuffer(false);

			const object = await env.MUSIC_BUCKET.get(s.r2_key);
			if (!object) continue;

			// Read song into memory (one at a time, typically 5-50MB)
			const data = new Uint8Array(await object.arrayBuffer());
			const songCrc = crc32(data);

			const ext = (s.r2_key || "").split(".").pop() || "mp3";
			const zipName = (s.folder ? s.folder + "/" : "") + (s.artist || "Desconhecido") + " - " + s.title + "." + ext;
			const nameBytes = new TextEncoder().encode(zipName);

			// Local file header (30 bytes + filename)
			const header = new Uint8Array(30 + nameBytes.length);
			const hv = new DataView(header.buffer);
			hv.setUint32(0, 0x04034b50, true);
			hv.setUint16(4, 20, true);
			hv.setUint16(6, 0, true);
			hv.setUint16(8, 0, true);  // store (no compression)
			hv.setUint16(10, 0, true);
			hv.setUint16(12, 0, true);
			hv.setUint32(14, songCrc, true);
			hv.setUint32(18, data.length, true);
			hv.setUint32(22, data.length, true);
			hv.setUint16(26, nameBytes.length, true);
			hv.setUint16(28, 0, true);
			header.set(nameBytes, 30);

			entries.push({ nameBytes, crc: songCrc, fileSize: data.length, headerOffset: offset });

			buffer.push(header);
			buffer.push(data);
			bufferSize += header.length + data.length;
			offset += header.length + data.length;
		}

		// Build central directory
		const cdOffset = offset;
		let cdSize = 0;

		for (const entry of entries) {
			const cd = new Uint8Array(46 + entry.nameBytes.length);
			const cv = new DataView(cd.buffer);
			cv.setUint32(0, 0x02014b50, true);
			cv.setUint16(4, 20, true);
			cv.setUint16(6, 20, true);
			cv.setUint16(8, 0, true);
			cv.setUint16(10, 0, true);
			cv.setUint16(12, 0, true);
			cv.setUint16(14, 0, true);
			cv.setUint32(16, entry.crc, true);
			cv.setUint32(20, entry.fileSize, true);
			cv.setUint32(24, entry.fileSize, true);
			cv.setUint16(28, entry.nameBytes.length, true);
			cv.setUint16(30, 0, true);
			cv.setUint16(32, 0, true);
			cv.setUint16(34, 0, true);
			cv.setUint16(36, 0, true);
			cv.setUint32(38, 0, true);
			cv.setUint32(42, entry.headerOffset, true);
			cd.set(entry.nameBytes, 46);

			buffer.push(cd);
			bufferSize += cd.length;
			cdSize += cd.length;
		}

		// EOCD
		const eocd = new Uint8Array(22);
		const ev = new DataView(eocd.buffer);
		ev.setUint32(0, 0x06054b50, true);
		ev.setUint16(4, 0, true);
		ev.setUint16(6, 0, true);
		ev.setUint16(8, entries.length, true);
		ev.setUint16(10, entries.length, true);
		ev.setUint32(12, cdSize, true);
		ev.setUint32(16, cdOffset, true);
		ev.setUint16(20, 0, true);
		buffer.push(eocd);
		bufferSize += 22;

		// Final flush
		await flushBuffer(true);

		// Complete multipart upload
		await mpu.complete(parts);

		const totalSize = cdOffset + cdSize + 22;

		await env.DB.prepare(
			"INSERT INTO playlist_zips (playlist_id, folder, part, total_parts, r2_key, file_size, song_count) VALUES (?, '', 1, 1, ?, ?, ?)"
		).bind(playlistId, r2Key, totalSize, entries.length).run();

		await env.DB.prepare("UPDATE playlists SET zip_status = 'ready' WHERE id = ?").bind(playlistId).run();

	} catch (err: any) {
		console.error("ZIP generation error:", err);
		const errorMsg = (err.message || "Erro desconhecido").slice(0, 100);
		await env.DB.prepare("UPDATE playlists SET zip_status = ? WHERE id = ?")
			.bind(`error:${errorMsg}`, playlistId).run();
	}
}
