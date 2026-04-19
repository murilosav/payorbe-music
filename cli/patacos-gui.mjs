#!/usr/bin/env node

/**
 * Patacos GUI — Interface gráfica local para upload de músicas.
 * Roda em http://localhost:3456
 */

import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync, createReadStream, createWriteStream, openSync, readSync, closeSync, unlinkSync } from "node:fs";
import { join, extname, basename, relative, dirname } from "node:path";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ─── Load env ────────────────────────────────────────────────────────
try {
	const envFile = readFileSync(join(PROJECT_ROOT, ".env"), "utf8");
	for (const line of envFile.split("\n")) {
		const match = line.match(/^(\w+)=(.+)$/);
		if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
	}
} catch {}

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "payorbe-music";
const API_BASE = process.env.API_BASE || "https://patacos.com.br";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const PORT = parseInt(process.env.PORT || "3456");

// ─── Crypto helpers ──────────────────────────────────────────────────
async function hmacSha256(key, data) {
	const { subtle } = globalThis.crypto;
	const k = typeof key === "string" ? new TextEncoder().encode(key) : key;
	const cryptoKey = await subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return new Uint8Array(await subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)));
}

function sha256Hex(data) { return createHash("sha256").update(data).digest("hex"); }

async function presignUrl(r2Key, contentType) {
	const endpoint = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	const method = "PUT";
	const region = "auto";
	const service = "s3";
	const now = new Date();
	const dateStamp = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
	const amzDate = dateStamp + "T" + now.toISOString().replace(/[-:]/g, "").slice(9, 15) + "Z";
	const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/${region}/${service}/aws4_request`;
	const params = new URLSearchParams();
	params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
	params.set("X-Amz-Credential", credential);
	params.set("X-Amz-Date", amzDate);
	params.set("X-Amz-Expires", "3600");
	params.set("X-Amz-SignedHeaders", "content-type;host");
	const sortedParams = new URLSearchParams([...params.entries()].sort());
	const host = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	const canonicalUri = `/${R2_BUCKET_NAME}/${r2Key}`;
	const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
	const canonicalRequest = [method, canonicalUri, sortedParams.toString(), canonicalHeaders, "content-type;host", "UNSIGNED-PAYLOAD"].join("\n");
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, `${dateStamp}/${region}/${service}/aws4_request`, sha256Hex(canonicalRequest)].join("\n");
	let signingKey = await hmacSha256("AWS4" + R2_SECRET_ACCESS_KEY, dateStamp);
	signingKey = await hmacSha256(signingKey, region);
	signingKey = await hmacSha256(signingKey, service);
	signingKey = await hmacSha256(signingKey, "aws4_request");
	const signature = Buffer.from(await hmacSha256(signingKey, stringToSign)).toString("hex");
	return `${endpoint}${canonicalUri}?${sortedParams.toString()}&X-Amz-Signature=${signature}`;
}

async function s3Request(method, path, body, headers = {}) {
	const endpoint = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	const url = `${endpoint}/${R2_BUCKET_NAME}/${path}`;
	const region = "auto"; const service = "s3";
	const now = new Date();
	const dateStamp = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
	const amzDate = dateStamp + "T" + now.toISOString().replace(/[-:]/g, "").slice(9, 15) + "Z";
	const host = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	const payloadHash = body ? sha256Hex(body) : "UNSIGNED-PAYLOAD";
	const allHeaders = { host, "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash, ...headers };
	const sortedHeaderKeys = Object.keys(allHeaders).sort();
	const signedHeaders = sortedHeaderKeys.join(";");
	const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${allHeaders[k]}\n`).join("");
	const parsedUrl = new URL(url);
	const canonicalQuerystring = [...parsedUrl.searchParams.entries()].sort().map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
	const canonicalRequest = [method, parsedUrl.pathname, canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join("\n");
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, `${dateStamp}/${region}/${service}/aws4_request`, sha256Hex(canonicalRequest)].join("\n");
	let signingKey = await hmacSha256("AWS4" + R2_SECRET_ACCESS_KEY, dateStamp);
	signingKey = await hmacSha256(signingKey, region);
	signingKey = await hmacSha256(signingKey, service);
	signingKey = await hmacSha256(signingKey, "aws4_request");
	const signature = Buffer.from(await hmacSha256(signingKey, stringToSign)).toString("hex");
	const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;
	const fetchHeaders = { ...allHeaders, authorization };
	delete fetchHeaders.host;
	return fetch(url, { method, headers: fetchHeaders, body: body || undefined });
}

// ─── API / files / ID3 / CRC32 / ZIP helpers ────────────────────────
async function apiCall(method, path, body) {
	const headers = { "Authorization": `Bearer ${ADMIN_KEY}` };
	if (body) { headers["Content-Type"] = "application/json"; body = JSON.stringify(body); }
	const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body || undefined });
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
	return res.json();
}

const AUDIO_EXTS = new Set([".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg", ".wma", ".opus"]);
function scanDir(dir, baseDir) {
	baseDir = baseDir || dir;
	const results = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) results.push(...scanDir(fullPath, baseDir));
		else if (AUDIO_EXTS.has(extname(entry.name).toLowerCase()))
			results.push({ path: fullPath, name: entry.name, folder: dirname(relative(baseDir, fullPath)) === "." ? "" : dirname(relative(baseDir, fullPath)), size: statSync(fullPath).size });
	}
	return results;
}

function parseId3(filePath) {
	const buf = Buffer.alloc(4096);
	const fd = openSync(filePath, "r");
	readSync(fd, buf, 0, 4096, 0);
	closeSync(fd);
	const meta = { title: "", artist: "", album: "", trackNumber: 0 };
	if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
		const version = buf[3];
		const headerSize = (buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f);
		let pos = 10;
		const end = Math.min(pos + headerSize, buf.length - 10);
		while (pos < end) {
			const frameId = buf.toString("ascii", pos, pos + 4);
			if (frameId === "\0\0\0\0") break;
			const frameSize = version === 4 ? (buf[pos+4]<<21|buf[pos+5]<<14|buf[pos+6]<<7|buf[pos+7]) : buf.readUInt32BE(pos+4);
			if (frameSize <= 0 || frameSize > end - pos) break;
			const data = buf.slice(pos + 10, pos + 10 + frameSize);
			if (frameId === "TIT2") meta.title = readTF(data);
			else if (frameId === "TPE1") meta.artist = readTF(data);
			else if (frameId === "TALB") meta.album = readTF(data);
			else if (frameId === "TRCK") meta.trackNumber = parseInt(readTF(data)) || 0;
			pos += 10 + frameSize;
		}
	}
	if (!meta.title) meta.title = basename(filePath, extname(filePath));
	return meta;
}
function readTF(d) {
	if (d.length < 2) return "";
	const e = d[0], t = d.slice(1);
	if (e === 0) return t.toString("latin1").replace(/\0/g, "");
	if (e === 1 || e === 2) { if (t[0]===0xFF&&t[1]===0xFE) return t.slice(2).toString("utf16le").replace(/\0/g,""); if (t[0]===0xFE&&t[1]===0xFF){const s=Buffer.alloc(t.length-2);for(let i=2;i<t.length-1;i+=2){s[i-2]=t[i+1];s[i-1]=t[i];}return s.toString("utf16le").replace(/\0/g,"");} return t.toString("utf16le").replace(/\0/g,""); }
	if (e === 3) return t.toString("utf8").replace(/\0/g, "");
	return t.toString("latin1").replace(/\0/g, "");
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[i] = c; }
function crc32Stream(filePath) {
	return new Promise((resolve, reject) => {
		let crc = 0xFFFFFFFF;
		const s = createReadStream(filePath);
		s.on("data", ch => { for (let i = 0; i < ch.length; i++) crc = crcTable[(crc ^ ch[i]) & 0xFF] ^ (crc >>> 8); });
		s.on("end", () => resolve((crc ^ 0xFFFFFFFF) >>> 0));
		s.on("error", reject);
	});
}

const USE_ZIP64_THRESHOLD = 0xFFFFFFFF;

function makeHeader(nameBytes, crc, fileSize) {
	const needZ64 = fileSize > USE_ZIP64_THRESHOLD;
	const extraLen = needZ64 ? 20 : 0; // 2+2+8+8
	const h = Buffer.alloc(30 + nameBytes.length + extraLen);
	h.writeUInt32LE(0x04034b50, 0);
	h.writeUInt16LE(needZ64 ? 45 : 20, 4); // version needed
	h.writeUInt32LE(crc, 14);
	h.writeUInt32LE(needZ64 ? 0xFFFFFFFF : fileSize, 18); // compressed
	h.writeUInt32LE(needZ64 ? 0xFFFFFFFF : fileSize, 22); // uncompressed
	h.writeUInt16LE(nameBytes.length, 26);
	h.writeUInt16LE(extraLen, 28);
	nameBytes.copy(h, 30);
	if (needZ64) {
		const ex = 30 + nameBytes.length;
		h.writeUInt16LE(0x0001, ex); // ZIP64 extra field tag
		h.writeUInt16LE(16, ex + 2); // size of extra data
		h.writeBigUInt64LE(BigInt(fileSize), ex + 4);  // uncompressed
		h.writeBigUInt64LE(BigInt(fileSize), ex + 12);  // compressed
	}
	return h;
}
function makeCDE(nameBytes, crc, fileSize, offset) {
	const needZ64 = fileSize > USE_ZIP64_THRESHOLD || offset > USE_ZIP64_THRESHOLD;
	const extraLen = needZ64 ? 28 : 0; // 2+2+8+8+8
	const c = Buffer.alloc(46 + nameBytes.length + extraLen);
	c.writeUInt32LE(0x02014b50, 0);
	c.writeUInt16LE(needZ64 ? 45 : 20, 4);  // version made by
	c.writeUInt16LE(needZ64 ? 45 : 20, 6);  // version needed
	c.writeUInt32LE(crc, 16);
	c.writeUInt32LE(needZ64 ? 0xFFFFFFFF : fileSize, 20);
	c.writeUInt32LE(needZ64 ? 0xFFFFFFFF : fileSize, 24);
	c.writeUInt16LE(nameBytes.length, 28);
	c.writeUInt16LE(extraLen, 30); // extra field length
	c.writeUInt32LE(needZ64 ? 0xFFFFFFFF : offset, 42);
	nameBytes.copy(c, 46);
	if (needZ64) {
		const ex = 46 + nameBytes.length;
		c.writeUInt16LE(0x0001, ex);
		c.writeUInt16LE(24, ex + 2);
		c.writeBigUInt64LE(BigInt(fileSize), ex + 4);   // uncompressed
		c.writeBigUInt64LE(BigInt(fileSize), ex + 12);  // compressed
		c.writeBigUInt64LE(BigInt(offset), ex + 20);    // header offset
	}
	return c;
}
function makeEOCD(count, cdSize, cdOffset) {
	const needZ64 = cdOffset > USE_ZIP64_THRESHOLD || cdSize > USE_ZIP64_THRESHOLD || count > 0xFFFF;
	if (needZ64) {
		// ZIP64 End of Central Directory Record + Locator + EOCD
		const z64eocd = Buffer.alloc(56);
		z64eocd.writeUInt32LE(0x06064b50, 0); // zip64 EOCD signature
		z64eocd.writeBigUInt64LE(BigInt(44), 4); // size of remaining record
		z64eocd.writeUInt16LE(45, 12); // version made by
		z64eocd.writeUInt16LE(45, 14); // version needed
		z64eocd.writeUInt32LE(0, 16); // disk number
		z64eocd.writeUInt32LE(0, 20); // disk with CD
		z64eocd.writeBigUInt64LE(BigInt(count), 24);
		z64eocd.writeBigUInt64LE(BigInt(count), 32);
		z64eocd.writeBigUInt64LE(BigInt(cdSize), 40);
		z64eocd.writeBigUInt64LE(BigInt(cdOffset), 48);

		const z64loc = Buffer.alloc(20);
		z64loc.writeUInt32LE(0x07064b50, 0); // zip64 EOCD locator
		z64loc.writeUInt32LE(0, 4); // disk with z64 EOCD
		z64loc.writeBigUInt64LE(BigInt(cdOffset + cdSize), 8); // offset of z64 EOCD
		z64loc.writeUInt32LE(1, 16); // total disks

		const eocd = Buffer.alloc(22);
		eocd.writeUInt32LE(0x06054b50, 0);
		eocd.writeUInt16LE(0xFFFF, 8);
		eocd.writeUInt16LE(0xFFFF, 10);
		eocd.writeUInt32LE(0xFFFFFFFF, 12);
		eocd.writeUInt32LE(0xFFFFFFFF, 16);

		return Buffer.concat([z64eocd, z64loc, eocd]);
	}
	const e = Buffer.alloc(22);
	e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(count, 8); e.writeUInt16LE(count, 10);
	e.writeUInt32LE(cdSize, 12); e.writeUInt32LE(cdOffset, 16); return e;
}

// ─── SSE job runner ──────────────────────────────────────────────────
const jobs = new Map();
let jobId = 0;

function formatSize(b) {
	if (b < 1024*1024) return (b/1024).toFixed(0) + " KB";
	if (b < 1024*1024*1024) return (b/(1024*1024)).toFixed(1) + " MB";
	return (b/(1024*1024*1024)).toFixed(2) + " GB";
}

async function runUploadJob(id, playlistSlug, dirPath, skipZip, flatFolder) {
	const job = { id, status: "running", events: [], done: false };
	jobs.set(id, job);
	const emit = (type, data) => { job.events.push({ type, data }); };

	try {
		// Find playlist
		const plData = await apiCall("GET", "/api/playlists");
		const plList = Array.isArray(plData) ? plData : (plData.results || []);
		const playlist = plList.find(p => p.slug === playlistSlug || String(p.id) === playlistSlug || p.name === playlistSlug);
		if (!playlist) throw new Error(`Playlist "${playlistSlug}" não encontrada`);
		emit("info", `Playlist: ${playlist.name} (${playlist.slug})`);

		// Scan
		emit("info", `Escaneando: ${dirPath}`);
		const files = scanDir(dirPath);
		if (files.length === 0) { emit("done", "Nenhum arquivo de áudio encontrado."); job.done = true; return; }
		const totalSize = files.reduce((s, f) => s + f.size, 0);
		emit("info", `${files.length} arquivos (${formatSize(totalSize)})`);

		// Flatten folders if requested + deduplicate by filename
		if (flatFolder) {
			files.forEach(f => { f.folder = ""; });
			const seen = new Map();
			const dupes = [];
			for (const f of files) {
				if (seen.has(f.name)) { dupes.push(f.name); }
				else seen.set(f.name, f);
			}
			if (dupes.length > 0) {
				emit("info", `${dupes.length} arquivos com nomes duplicados removidos (subpastas diferentes, mesmo filename)`);
			}
			files.length = 0;
			files.push(...seen.values());
		}

		// Parse ID3
		const parsed = files.map(f => ({ ...f, ...parseId3(f.path) }));

		// Upload
		emit("phase", "upload");
		const MAX = 20;
		let idx = 0, completed = 0, errors = 0, bytesUp = 0, skipped = 0;
		const startTime = Date.now();
		const registered = []; // track files actually registered for ZIP

		async function uploadOneFile(f, playlist) {
			const ext = extname(f.name).toLowerCase();
			const ct = ext === ".mp3" ? "audio/mpeg" : ext === ".flac" ? "audio/flac" : ext === ".wav" ? "audio/wav" : ext === ".m4a" ? "audio/mp4" : "audio/mpeg";

			// Get presigned URL from Worker API
			const presignData = await apiCall("POST", "/api/presign/upload", {
				playlist_id: String(playlist.id),
				filename: f.name,
				folder: f.folder,
				content_type: ct,
			});

			const fileData = readFileSync(f.path);

			// Retry up to 3 times on R2 errors
			let lastErr;
			for (let attempt = 0; attempt < 3; attempt++) {
				if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
				const res = await fetch(presignData.url, { method: "PUT", headers: { "Content-Type": presignData.contentType }, body: fileData });
				if (res.ok) {
					await apiCall("POST", "/api/songs/register", {
						playlist_id: String(playlist.id), r2_key: presignData.r2Key, title: f.title,
						artist: f.artist || "Desconhecido", album: f.album || "",
						folder: f.folder, duration: 0, track_number: f.trackNumber || 0, file_size: f.size,
					});
					return;
				}
				lastErr = new Error("R2 " + res.status);
				if (res.status < 500) throw lastErr; // Don't retry 4xx
			}
			throw lastErr;
		}

		async function worker() {
			while (idx < parsed.length) {
				const i = idx++;
				const f = parsed[i];
				try {
					await uploadOneFile(f, playlist);
					bytesUp += f.size;
					registered.push(f);
				} catch (err) {
					if (err.message && err.message.includes("409")) {
						bytesUp += f.size;
						skipped++;
						registered.push(f); // already in R2, include in ZIP
					} else {
						errors++;
						emit("error", `${f.name}: ${err.message}`);
					}
				}
				completed++;
				const pct = Math.round((completed / parsed.length) * 100);
				const elapsed = (Date.now() - startTime) / 1000;
				const speed = bytesUp > 0 ? formatSize(bytesUp / elapsed) + "/s" : "";
				emit("progress", JSON.stringify({ phase: "upload", current: completed, total: parsed.length, pct, speed, file: f.name }));
			}
		}

		// Less concurrency for large files to avoid R2 timeouts
		const avgSize = totalSize / files.length;
		const concurrency = avgSize > 50 * 1024 * 1024 ? 4 : avgSize > 20 * 1024 * 1024 ? 8 : MAX;
		const workers = [];
		for (let w = 0; w < Math.min(concurrency, parsed.length); w++) workers.push(worker());
		await Promise.all(workers);

		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		const newCount = completed - errors - skipped;
		emit("info", `Upload: ${newCount} novas, ${skipped} já existiam, ${errors} erros — ${elapsed}s`);

		// ZIP
		if (!skipZip && registered.length > 0) {
			emit("phase", "zip");
			emit("info", `Gerando ZIP localmente (${registered.length} arquivos, direto em disco)...`);
			const zipStart = Date.now();
			const tmpZipPath = `/tmp/patacos-zip-${Date.now()}.zip`;
			const entries = []; let offset = 0;
			const ws = createWriteStream(tmpZipPath);
			const writeToFile = (buf) => new Promise((resolve) => {
				if (!ws.write(buf)) ws.once("drain", resolve);
				else resolve();
			});

			for (let i = 0; i < registered.length; i++) {
				const f = registered[i];
				const crc = await crc32Stream(f.path);
				const zipFolder = playlist.name.replace(/[\\/:*?"<>|]/g, "_") + "/";
				const zipName = zipFolder + (f.folder ? f.folder + "/" : "") + basename(f.name);
				const nameBytes = Buffer.from(zipName, "utf8");
				const header = makeHeader(nameBytes, crc, f.size);
				await writeToFile(header);

				// Stream file data to disk instead of loading into memory
				await new Promise((resolve, reject) => {
					const rs = createReadStream(f.path);
					rs.on("data", (chunk) => { if (!ws.write(chunk)) rs.pause(); });
					ws.on("drain", () => rs.resume());
					rs.on("end", resolve);
					rs.on("error", reject);
				});

				entries.push({ nameBytes, crc, fileSize: f.size, headerOffset: offset });
				offset += header.length + f.size;
				if (i % 10 === 0) emit("progress", JSON.stringify({ phase: "zip-build", current: i + 1, total: registered.length, pct: Math.round(((i+1)/registered.length)*50) }));
			}

			const cdOffset = offset; let cdSize = 0;
			for (const e of entries) { const cd = makeCDE(e.nameBytes, e.crc, e.fileSize, e.headerOffset); await writeToFile(cd); cdSize += cd.length; }
			const eocdBuf = makeEOCD(entries.length, cdSize, cdOffset);
			await writeToFile(eocdBuf);
			const totalZipSize = cdOffset + cdSize + eocdBuf.length;
			await new Promise((resolve) => ws.end(resolve));

			const zipElapsed = ((Date.now() - zipStart) / 1000).toFixed(1);
			emit("info", `ZIP gerado: ${formatSize(totalZipSize)} em ${zipElapsed}s (em disco)`);

			// Upload ZIP to R2 — 6 parallel connections, 50MB parts
			emit("info", "Enviando ZIP pro R2 (10 conexões, partes de 50MB)...");
			const r2Key = `zips/playlist-${playlist.id}/_all_part1.zip`;

			const startRes = await s3Request("POST", r2Key + "?uploads=", null, { "content-type": "application/zip" });
			const startXml = await startRes.text();
			const uploadIdMatch = startXml.match(/<UploadId>(.+?)<\/UploadId>/);
			if (!uploadIdMatch) throw new Error("Multipart start failed");
			const uploadId = uploadIdMatch[1];

			const PART_SIZE = 50 * 1024 * 1024; // 50MB
			const UPLOAD_CONCURRENCY = 10;
			const totalPartsCount = Math.ceil(totalZipSize / PART_SIZE);
			const partResults = new Array(totalPartsCount);
			let nextPartIdx = 0;
			let uploadedPartsCount = 0;

			async function zipUploadWorker() {
				while (true) {
					const partIdx = nextPartIdx++;
					if (partIdx >= totalPartsCount) break;
					const partNum = partIdx + 1;
					const readOffset = partIdx * PART_SIZE;
					const length = Math.min(PART_SIZE, totalZipSize - readOffset);
					const body = Buffer.alloc(length);
					const fd = openSync(tmpZipPath, "r");
					readSync(fd, body, 0, length, readOffset);
					closeSync(fd);

					let lastErr;
					for (let attempt = 0; attempt < 3; attempt++) {
						if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
						const res = await s3Request("PUT", `${r2Key}?partNumber=${partNum}&uploadId=${encodeURIComponent(uploadId)}`, body, { "content-length": String(body.length) });
						if (res.ok) {
							partResults[partIdx] = { partNumber: partNum, etag: res.headers.get("etag") };
							uploadedPartsCount++;
							emit("progress", JSON.stringify({ phase: "zip-upload", current: uploadedPartsCount, total: totalPartsCount, pct: 50 + Math.round((uploadedPartsCount / totalPartsCount) * 50) }));
							lastErr = null;
							break;
						}
						lastErr = new Error(`Part ${partNum}: ${res.status}`);
					}
					if (lastErr) throw lastErr;
				}
			}

			const uploadWorkers = [];
			for (let i = 0; i < Math.min(UPLOAD_CONCURRENCY, totalPartsCount); i++) uploadWorkers.push(zipUploadWorker());
			await Promise.all(uploadWorkers);

			// Cleanup temp file
			try { unlinkSync(tmpZipPath); } catch {}

			const xmlParts = partResults.map(p => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`).join("");
			const completeRes = await s3Request("POST", `${r2Key}?uploadId=${encodeURIComponent(uploadId)}`, `<CompleteMultipartUpload>${xmlParts}</CompleteMultipartUpload>`, { "content-type": "application/xml" });
			if (!completeRes.ok) throw new Error("Complete failed: " + await completeRes.text());

			try { await apiCall("DELETE", `/api/playlists/${playlist.id}/zips`); } catch {}
			await apiCall("POST", `/api/playlists/${playlist.id}/zip/complete`, {
				uploadId: "direct-s3", key: r2Key, parts: [], folder: "", zipPart: 1, totalParts: 1, fileSize: totalZipSize, songCount: entries.length,
			});

			emit("info", `ZIP enviado e registrado! (${entries.length} músicas, ${formatSize(totalZipSize)})`);
		}

		emit("done", "Tudo pronto!");
	} catch (err) {
		emit("error", err.message);
		emit("done", "Erro: " + err.message);
	}
	job.done = true;
}

// ─── HTML GUI ────────────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Patacos — Upload Manager</title>
<link rel="icon" href="/favicon.ico" type="image/x-icon">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; }
.container { max-width: 720px; margin: 0 auto; padding: 40px 20px; }
h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; color: #fff; }
.subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
.card { background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
.card h2 { font-size: 15px; font-weight: 600; color: #a3a3a3; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
label { display: block; font-size: 13px; color: #a3a3a3; margin-bottom: 6px; font-weight: 500; }
select, input[type="text"] {
	width: 100%; padding: 10px 14px; background: #1a1a1a; border: 1px solid #333;
	border-radius: 8px; color: #fff; font-size: 14px; font-family: inherit; outline: none;
	transition: border-color 0.2s;
}
select:focus, input:focus { border-color: #555; }
select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
.row { display: flex; gap: 12px; margin-bottom: 16px; }
.row > * { flex: 1; }
.path-input { display: flex; gap: 8px; margin-bottom: 16px; }
.path-input input { flex: 1; }
.btn-browse {
	padding: 10px 16px; background: #262626; border: 1px solid #333; border-radius: 8px;
	color: #a3a3a3; font-size: 13px; cursor: pointer; white-space: nowrap; font-family: inherit;
	transition: all 0.2s;
}
.btn-browse:hover { background: #333; color: #fff; }
.actions { display: flex; gap: 10px; margin-top: 8px; }
.btn {
	flex: 1; padding: 12px 20px; border: none; border-radius: 10px; font-size: 14px;
	font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s;
}
.btn-primary { background: #fff; color: #000; }
.btn-primary:hover { background: #e5e5e5; }
.btn-primary:disabled { background: #333; color: #666; cursor: not-allowed; }
.btn-secondary { background: #1a1a1a; color: #a3a3a3; border: 1px solid #333; }
.btn-secondary:hover { background: #262626; color: #fff; }
.check { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.check input { accent-color: #fff; }
.check label { margin: 0; cursor: pointer; }
#log { display: none; margin-top: 16px; }
#log.active { display: block; }
.log-card { background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 12px; overflow: hidden; }
.log-header { padding: 16px 20px; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; align-items: center; }
.log-header h2 { margin: 0; font-size: 14px; }
.log-status { font-size: 12px; padding: 4px 10px; border-radius: 20px; font-weight: 600; }
.log-status.running { background: #172554; color: #60a5fa; }
.log-status.done { background: #052e16; color: #4ade80; }
.log-status.error { background: #450a0a; color: #f87171; }
.progress-wrap { padding: 0 20px; padding-top: 16px; }
.progress-bar { height: 6px; background: #1a1a1a; border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
.progress-fill { height: 100%; background: #fff; border-radius: 3px; transition: width 0.3s; width: 0%; }
.progress-text { font-size: 12px; color: #666; display: flex; justify-content: space-between; }
.log-entries { max-height: 300px; overflow-y: auto; padding: 12px 20px; font-family: 'SF Mono', 'Menlo', monospace; font-size: 12px; line-height: 1.8; }
.log-entry { color: #525252; }
.log-entry.info { color: #a3a3a3; }
.log-entry.error { color: #f87171; }
.log-entry.success { color: #4ade80; }
.playlist-info { display: flex; gap: 16px; padding: 12px 0; font-size: 13px; color: #666; }
.playlist-info span { display: flex; align-items: center; gap: 4px; }
</style>
</head>
<body>
<div class="container">
	<h1>Patacos</h1>
	<p class="subtitle">Upload Manager — roda localmente no seu Mac</p>

	<div class="card">
		<h2>Configurar</h2>
		<label>Playlist</label>
		<select id="playlist" style="margin-bottom:12px;">
			<option value="">Carregando...</option>
		</select>
		<div class="playlist-info" id="playlistInfo" style="display:none;"></div>

		<label>Pasta com as m\u00fasicas</label>
		<div class="path-input">
			<input type="text" id="dirPath" placeholder="Clique em Selecionar ou cole o caminho">
			<button class="btn-browse" onclick="pickFolder()">Selecionar</button>
		</div>
		<p style="font-size:12px;color:#525252;margin-bottom:16px;">Subpastas viram categorias no ZIP.</p>

		<div class="check">
			<input type="checkbox" id="flatFolder" checked>
			<label for="flatFolder">Ignorar subpastas (tudo na raiz)</label>
		</div>
		<div class="check">
			<input type="checkbox" id="skipZip">
			<label for="skipZip">Pular gera\u00e7\u00e3o de ZIP (s\u00f3 upload)</label>
		</div>

		<div class="actions">
			<button class="btn btn-primary" id="btnUpload" onclick="startUpload()">Enviar M\u00fasicas + ZIP</button>
			<button class="btn btn-secondary" id="btnZipOnly" onclick="startZipOnly()">S\u00f3 ZIP</button>
		</div>
	</div>

	<div id="log">
		<div class="log-card">
			<div class="log-header">
				<h2>Progresso</h2>
				<span class="log-status running" id="logStatus">Executando</span>
			</div>
			<div class="progress-wrap">
				<div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
				<div class="progress-text">
					<span id="progressLeft">0/0</span>
					<span id="progressRight"></span>
				</div>
			</div>
			<div class="log-entries" id="logEntries"></div>
		</div>
	</div>
</div>

<script>
let playlists = [];

async function loadPlaylists() {
	const res = await fetch('/api/playlists');
	var data = await res.json();
	playlists = Array.isArray(data) ? data : (data.results || []);
	const sel = document.getElementById('playlist');
	sel.innerHTML = playlists.map(p =>
		'<option value="' + p.slug + '">' + p.name + ' (' + (p.song_count || 0) + ' m\u00fasicas)</option>'
	).join('');
	sel.onchange = updateInfo;
	updateInfo();
}

function updateInfo() {
	const slug = document.getElementById('playlist').value;
	const p = playlists.find(x => x.slug === slug);
	const info = document.getElementById('playlistInfo');
	if (p) {
		info.style.display = 'flex';
		info.innerHTML = '<span>ID: ' + p.id + '</span><span>Slug: ' + p.slug + '</span><span>M\u00fasicas: ' + (p.song_count||0) + '</span>';
	}
}

function addLog(text, cls) {
	const el = document.getElementById('logEntries');
	const d = document.createElement('div');
	d.className = 'log-entry ' + (cls || '');
	const time = new Date().toLocaleTimeString('pt-BR');
	d.textContent = time + '  ' + text;
	el.appendChild(d);
	el.scrollTop = el.scrollHeight;
}

async function startUpload() {
	const slug = document.getElementById('playlist').value;
	const dir = document.getElementById('dirPath').value.trim();
	const skipZip = document.getElementById('skipZip').checked;
	const flatFolder = document.getElementById('flatFolder').checked;
	if (!slug || !dir) { alert('Selecione playlist e pasta.'); return; }

	document.getElementById('btnUpload').disabled = true;
	document.getElementById('log').className = 'active';
	document.getElementById('logEntries').innerHTML = '';
	document.getElementById('logStatus').className = 'log-status running';
	document.getElementById('logStatus').textContent = 'Executando';
	document.getElementById('progressFill').style.width = '0%';

	const res = await fetch('/run', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ playlist: slug, dir, skipZip, flatFolder, mode: 'upload' })
	});
	const { jobId } = await res.json();
	pollJob(jobId);
}

async function startZipOnly() {
	const slug = document.getElementById('playlist').value;
	const dir = document.getElementById('dirPath').value.trim();
	const flatFolder = document.getElementById('flatFolder').checked;
	if (!slug || !dir) { alert('Selecione playlist e pasta.'); return; }

	document.getElementById('btnUpload').disabled = true;
	document.getElementById('log').className = 'active';
	document.getElementById('logEntries').innerHTML = '';
	document.getElementById('logStatus').className = 'log-status running';
	document.getElementById('logStatus').textContent = 'Executando';

	const res = await fetch('/run', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ playlist: slug, dir, skipZip: true, flatFolder, mode: 'zip' })
	});
	const { jobId } = await res.json();
	pollJob(jobId);
}

let lastEventIdx = 0;
async function pollJob(jid) {
	lastEventIdx = 0;
	const poll = async () => {
		const res = await fetch('/job/' + jid + '?from=' + lastEventIdx);
		const data = await res.json();

		for (const ev of data.events) {
			lastEventIdx++;
			if (ev.type === 'info') addLog(ev.data, 'info');
			else if (ev.type === 'error') addLog(ev.data, 'error');
			else if (ev.type === 'progress') {
				const p = JSON.parse(ev.data);
				document.getElementById('progressFill').style.width = p.pct + '%';
				document.getElementById('progressLeft').textContent = (p.current || 0) + '/' + (p.total || '?');
				document.getElementById('progressRight').textContent = p.speed || p.phase || '';
			} else if (ev.type === 'phase') {
				addLog('--- ' + (ev.data === 'upload' ? 'UPLOAD' : 'ZIP') + ' ---', 'info');
			} else if (ev.type === 'done') {
				const isErr = ev.data.startsWith('Erro');
				addLog(ev.data, isErr ? 'error' : 'success');
				document.getElementById('logStatus').className = 'log-status ' + (isErr ? 'error' : 'done');
				document.getElementById('logStatus').textContent = isErr ? 'Erro' : 'Conclu\u00eddo';
				document.getElementById('progressFill').style.width = '100%';
				document.getElementById('btnUpload').disabled = false;
				loadPlaylists();
				return;
			}
		}
		setTimeout(poll, 500);
	};
	poll();
}

async function pickFolder() {
	const res = await fetch('/pick-folder');
	const data = await res.json();
	if (data.path) document.getElementById('dirPath').value = data.path;
}

loadPlaylists();
</script>
</body>
</html>`;

// ─── HTTP Server ─────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
	const url = new URL(req.url, `http://localhost:${PORT}`);

	if (url.pathname === "/" && req.method === "GET") {
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(HTML);
		return;
	}

	if (url.pathname === "/favicon.ico" && req.method === "GET") {
		try {
			const favicon = readFileSync(join(PROJECT_ROOT, "src/assets/favicon.ico"));
			res.writeHead(200, {
				"Content-Type": "image/x-icon",
				"Cache-Control": "public, max-age=604800, immutable",
			});
			res.end(favicon);
		} catch {
			res.writeHead(404);
			res.end();
		}
		return;
	}

	if (url.pathname === "/pick-folder" && req.method === "GET") {
		try {
			const result = execSync(`osascript -e 'POSIX path of (choose folder with prompt "Selecione a pasta com as músicas")'`, { encoding: "utf8", timeout: 60000 }).trim();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ path: result }));
		} catch {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ path: "" }));
		}
		return;
	}

	if (url.pathname === "/api/playlists" && req.method === "GET") {
		try {
			const data = await apiCall("GET", "/api/playlists");
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(data));
		} catch (err) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: err.message }));
		}
		return;
	}

	if (url.pathname === "/run" && req.method === "POST") {
		let body = "";
		for await (const chunk of req) body += chunk;
		const data = JSON.parse(body);
		const id = ++jobId;

		if (data.mode === "zip") {
			// ZIP only — reuses the upload job but with skipZip false and mode zip
			runUploadJob(id, data.playlist, data.dir, false, data.flatFolder);
		} else {
			runUploadJob(id, data.playlist, data.dir, data.skipZip, data.flatFolder);
		}

		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ jobId: id }));
		return;
	}

	const jobMatch = url.pathname.match(/^\/job\/(\d+)$/);
	if (jobMatch && req.method === "GET") {
		const id = parseInt(jobMatch[1]);
		const job = jobs.get(id);
		if (!job) {
			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Job not found" }));
			return;
		}
		const from = parseInt(url.searchParams.get("from") || "0");
		const events = job.events.slice(from);
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ events, done: job.done }));
		return;
	}

	res.writeHead(404);
	res.end("Not found");
});

server.listen(PORT, () => {
	console.log(`\n  ╔══════════════════════════════════════════╗`);
	console.log(`  ║  PATACOS — Upload Manager                ║`);
	console.log(`  ║  http://localhost:${PORT}                   ║`);
	console.log(`  ╚══════════════════════════════════════════╝\n`);

	// Open browser
	try { execSync(`open http://localhost:${PORT}`); } catch {}
});
