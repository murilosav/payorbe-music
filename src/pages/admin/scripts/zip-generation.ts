export function zipGenerationScript(): string {
	return `
	var crcT = new Uint32Array(256);
	for (var i = 0; i < 256; i++) {
		var c = i;
		for (var j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
		crcT[i] = c;
	}

	async function blobCrc32(blob) {
		var reader = blob.stream().getReader();
		var crc = 0xFFFFFFFF;
		while (true) {
			var result = await reader.read();
			if (result.done) break;
			var value = result.value;
			for (var i = 0; i < value.length; i++) crc = crcT[(crc ^ value[i]) & 0xFF] ^ (crc >>> 8);
		}
		return (crc ^ 0xFFFFFFFF) >>> 0;
	}

	async function fetchRetry(url, opts, retries) {
		retries = retries || 3;
		for (var attempt = 0; attempt < retries; attempt++) {
			try {
				var res = await fetch(url, opts);
				if (res.ok) return res;
				if (res.status >= 500 && attempt < retries - 1) {
					await new Promise(function(r) { setTimeout(r, 2000 * (attempt + 1)); });
					continue;
				}
				throw new Error('HTTP ' + res.status + ' em ' + url);
			} catch (e) {
				if (attempt < retries - 1) {
					await new Promise(function(r) { setTimeout(r, 2000 * (attempt + 1)); });
					continue;
				}
				throw e;
			}
		}
	}

	// =============================================
	// Streaming ZIP: processes one song at a time,
	// uploads chunks to R2 via multipart upload.
	// Memory usage: ~50MB (one song + upload buffer)
	// =============================================

	async function streamingZipGenerate(playlistId, songs, onStatus, playlistName) {
		var zipFolder = (playlistName || 'Playlist').replace(/[\\/:*?"<>|]/g, '_') + '/';
		var r2Key = 'zips/playlist-' + playlistId + '/_all_part1.zip';

		// Start multipart upload
		var startRes = await fetchRetry('/api/playlists/' + playlistId + '/zip/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ key: r2Key })
		}, 3);
		var startData = await startRes.json();
		var uploadId = startData.uploadId;

		var usedNames = {};
		var MIN_PART = 10 * 1024 * 1024; // 10MB min per multipart part
		var buffer = [];
		var bufferSize = 0;
		var parts = [];
		var partNum = 1;
		var offset = 0;
		var entries = [];

		async function flush(force) {
			if (bufferSize === 0) return;
			if (bufferSize < MIN_PART && !force) return;

			var fd = new FormData();
			fd.append('chunk', new Blob(buffer));
			fd.append('uploadId', uploadId);
			fd.append('key', r2Key);
			fd.append('partNumber', String(partNum));

			buffer = [];
			bufferSize = 0;

			var res = await fetchRetry('/api/playlists/' + playlistId + '/zip/part', { method: 'POST', body: fd }, 5);
			var data = await res.json();
			parts.push({ partNumber: partNum, etag: data.etag });
			partNum++;
		}

		// Process each song one at a time (streaming)
		for (var i = 0; i < songs.length; i++) {
			// Flush buffer before loading next song to free memory
			await flush(false);

			var s = songs[i];
			onStatus('Processando ' + (i + 1) + '/' + songs.length + '...', Math.round(((i + 1) / songs.length) * 90));

			var fileRes;
			try {
				fileRes = await fetchRetry('/api/songs/' + s.id + '/file', {}, 3);
			} catch (e) {
				console.error('Falha ao baixar song ' + s.id + ':', e);
				continue;
			}
			var blob = await fileRes.blob();
			var crc = await blobCrc32(blob);

			var ext = (s.r2_key || '').split('.').pop() || 'mp3';
			var baseName = (s.artist || 'Desconhecido') + ' - ' + s.title;
			var zipName = zipFolder + (s.folder ? s.folder + '/' : '') + baseName + '.' + ext;
			if (usedNames[zipName]) {
				usedNames[zipName]++;
				zipName = zipFolder + (s.folder ? s.folder + '/' : '') + baseName + ' (' + usedNames[zipName] + ').' + ext;
			} else {
				usedNames[zipName] = 1;
			}
			var nameBytes = new TextEncoder().encode(zipName);

			// Local file header
			var header = new Uint8Array(30 + nameBytes.length);
			var hv = new DataView(header.buffer);
			hv.setUint32(0, 0x04034b50, true);
			hv.setUint16(4, 20, true);
			hv.setUint16(8, 0, true);
			hv.setUint32(14, crc, true);
			hv.setUint32(18, blob.size, true);
			hv.setUint32(22, blob.size, true);
			hv.setUint16(26, nameBytes.length, true);
			header.set(nameBytes, 30);

			entries.push({ nameBytes: nameBytes, crc: crc, fileSize: blob.size, headerOffset: offset });

			buffer.push(header);
			buffer.push(blob);
			bufferSize += header.length + blob.size;
			offset += header.length + blob.size;

			// Release blob reference for GC
			blob = null;
			fileRes = null;
		}

		onStatus('Finalizando ZIP...', 92);

		// Central directory
		var cdOffset = offset;
		var cdSize = 0;
		for (var ei = 0; ei < entries.length; ei++) {
			var e = entries[ei];
			var cd = new Uint8Array(46 + e.nameBytes.length);
			var cv = new DataView(cd.buffer);
			cv.setUint32(0, 0x02014b50, true);
			cv.setUint16(4, 20, true);
			cv.setUint16(6, 20, true);
			cv.setUint32(16, e.crc, true);
			cv.setUint32(20, e.fileSize, true);
			cv.setUint32(24, e.fileSize, true);
			cv.setUint16(28, e.nameBytes.length, true);
			cv.setUint32(42, e.headerOffset, true);
			cd.set(e.nameBytes, 46);
			buffer.push(cd);
			bufferSize += cd.length;
			cdSize += cd.length;
		}

		// EOCD
		var eocd = new Uint8Array(22);
		var ev = new DataView(eocd.buffer);
		ev.setUint32(0, 0x06054b50, true);
		ev.setUint16(8, entries.length, true);
		ev.setUint16(10, entries.length, true);
		ev.setUint32(12, cdSize, true);
		ev.setUint32(16, cdOffset, true);
		buffer.push(eocd);
		bufferSize += 22;

		onStatus('Enviando parte final...', 95);

		// Final flush
		await flush(true);

		// Complete multipart upload
		var totalSize = cdOffset + cdSize + 22;
		await fetchRetry('/api/playlists/' + playlistId + '/zip/complete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				uploadId: uploadId, key: r2Key, parts: parts,
				folder: '', zipPart: 1, totalParts: 1,
				fileSize: totalSize, songCount: entries.length
			})
		}, 3);

		return { songCount: entries.length, totalSize: totalSize };
	}

	`;
}
