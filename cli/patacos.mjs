#!/usr/bin/env node

/**
 * Patacos CLI — Upload músicas + gerar ZIP localmente, direto pro R2.
 *
 * Uso:
 *   node cli/patacos.mjs upload <playlist-slug-ou-id> <pasta-com-musicas>
 *   node cli/patacos.mjs upload <playlist-slug-ou-id> <pasta-com-musicas> --skip-zip
 *   node cli/patacos.mjs zip <playlist-slug-ou-id> <pasta-com-musicas>
 *   node cli/patacos.mjs list
 */

import { readFileSync, readdirSync, statSync, createReadStream, createWriteStream, openSync, readSync, closeSync, unlinkSync } from "node:fs";
import { join, extname, basename, relative, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Writable, Readable } from "node:stream";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";

// ─── Config ───────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const wranglerJson = JSON.parse(readFileSync(join(__dirname, "..", "wrangler.json"), "utf8"));

// Read secrets from wrangler (or env vars)
function getEnv(key) {
	return process.env[key] || "";
}

// We need these to presign URLs and talk to the API
let R2_ACCESS_KEY_ID = getEnv("R2_ACCESS_KEY_ID");
let R2_SECRET_ACCESS_KEY = getEnv("R2_SECRET_ACCESS_KEY");
let CF_ACCOUNT_ID = getEnv("CF_ACCOUNT_ID");
let R2_BUCKET_NAME = getEnv("R2_BUCKET_NAME") || wranglerJson.r2_buckets?.[0]?.bucket_name || "payorbe-music";
let API_BASE = getEnv("API_BASE") || "https://patacos.com.br";
let ADMIN_KEY = getEnv("ADMIN_KEY");

// Try to read secrets from wrangler if not in env
function loadSecretsFromWrangler() {
	try {
		const result = execSync("npx wrangler secret list --json 2>/dev/null", {
			cwd: join(__dirname, ".."),
			encoding: "utf8",
			timeout: 15000,
		});
		// This just lists names, not values. We need them from env or .env file.
	} catch {}

	// Try .env file
	try {
		const envFile = readFileSync(join(__dirname, "..", ".env"), "utf8");
		for (const line of envFile.split("\n")) {
			const match = line.match(/^(\w+)=(.+)$/);
			if (match) {
				const [, key, value] = match;
				if (!process.env[key]) process.env[key] = value.trim().replace(/^["']|["']$/g, "");
			}
		}
		R2_ACCESS_KEY_ID = R2_ACCESS_KEY_ID || getEnv("R2_ACCESS_KEY_ID");
		R2_SECRET_ACCESS_KEY = R2_SECRET_ACCESS_KEY || getEnv("R2_SECRET_ACCESS_KEY");
		CF_ACCOUNT_ID = CF_ACCOUNT_ID || getEnv("CF_ACCOUNT_ID");
		ADMIN_KEY = ADMIN_KEY || getEnv("ADMIN_KEY");
	} catch {}
}

loadSecretsFromWrangler();

// ─── AWS SigV4 (minimal, for presigned URLs) ─────────────────────────

async function hmacSha256(key, data) {
	const { subtle } = globalThis.crypto || (await import("node:crypto")).webcrypto;
	const k = typeof key === "string" ? new TextEncoder().encode(key) : key;
	const cryptoKey = await subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return new Uint8Array(await subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)));
}

function sha256Hex(data) {
	return createHash("sha256").update(data).digest("hex");
}

async function presignUrl(r2Key, contentType, expiresSeconds = 3600) {
	const endpoint = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	const bucket = R2_BUCKET_NAME;
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
	params.set("X-Amz-Expires", String(expiresSeconds));
	params.set("X-Amz-SignedHeaders", "content-type;host");
	// Sort params
	const sortedParams = new URLSearchParams([...params.entries()].sort());
	const canonicalQuerystring = sortedParams.toString();

	const host = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	const canonicalUri = `/${bucket}/${r2Key}`;

	const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
	const signedHeaders = "content-type;host";

	const canonicalRequest = [
		method, canonicalUri, canonicalQuerystring,
		canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"
	].join("\n");

	const stringToSign = [
		"AWS4-HMAC-SHA256", amzDate,
		`${dateStamp}/${region}/${service}/aws4_request`,
		sha256Hex(canonicalRequest)
	].join("\n");

	let signingKey = await hmacSha256("AWS4" + R2_SECRET_ACCESS_KEY, dateStamp);
	signingKey = await hmacSha256(signingKey, region);
	signingKey = await hmacSha256(signingKey, service);
	signingKey = await hmacSha256(signingKey, "aws4_request");
	const signature = Buffer.from(await hmacSha256(signingKey, stringToSign)).toString("hex");

	return `${endpoint}${canonicalUri}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;
}

// ─── R2 S3 multipart (for ZIP upload) ────────────────────────────────

async function s3Request(method, path, body, headers = {}) {
	const endpoint = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	const url = `${endpoint}/${R2_BUCKET_NAME}/${path}`;
	const region = "auto";
	const service = "s3";

	const now = new Date();
	const dateStamp = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
	const amzDate = dateStamp + "T" + now.toISOString().replace(/[-:]/g, "").slice(9, 15) + "Z";

	const host = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	const payloadHash = body ? sha256Hex(body) : "UNSIGNED-PAYLOAD";

	const allHeaders = {
		host,
		"x-amz-date": amzDate,
		"x-amz-content-sha256": payloadHash,
		...headers,
	};

	const sortedHeaderKeys = Object.keys(allHeaders).sort();
	const signedHeaders = sortedHeaderKeys.join(";");
	const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${allHeaders[k]}\n`).join("");

	const parsedUrl = new URL(url);
	const canonicalQuerystring = [...parsedUrl.searchParams.entries()].sort().map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

	const canonicalRequest = [
		method, parsedUrl.pathname, canonicalQuerystring,
		canonicalHeaders, signedHeaders, payloadHash
	].join("\n");

	const stringToSign = [
		"AWS4-HMAC-SHA256", amzDate,
		`${dateStamp}/${region}/${service}/aws4_request`,
		sha256Hex(canonicalRequest)
	].join("\n");

	let signingKey = await hmacSha256("AWS4" + R2_SECRET_ACCESS_KEY, dateStamp);
	signingKey = await hmacSha256(signingKey, region);
	signingKey = await hmacSha256(signingKey, service);
	signingKey = await hmacSha256(signingKey, "aws4_request");
	const signature = Buffer.from(await hmacSha256(signingKey, stringToSign)).toString("hex");

	const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;

	const fetchHeaders = { ...allHeaders, authorization };
	delete fetchHeaders.host;

	const res = await fetch(url, { method, headers: fetchHeaders, body: body || undefined });
	return res;
}

// ─── API helpers ─────────────────────────────────────────────────────

async function apiCall(method, path, body) {
	const headers = { "Authorization": `Bearer ${ADMIN_KEY}` };
	if (body && !(body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(body);
	}
	const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body || undefined });
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`API ${method} ${path}: ${res.status} ${text.slice(0, 200)}`);
	}
	return res.json();
}

// ─── File scanning ───────────────────────────────────────────────────

const AUDIO_EXTS = new Set([".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg", ".wma", ".opus"]);

function scanDir(dir, baseDir) {
	baseDir = baseDir || dir;
	const results = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...scanDir(fullPath, baseDir));
		} else if (AUDIO_EXTS.has(extname(entry.name).toLowerCase())) {
			const rel = relative(baseDir, fullPath);
			const folder = dirname(rel) === "." ? "" : dirname(rel);
			results.push({ path: fullPath, name: entry.name, folder, size: statSync(fullPath).size });
		}
	}
	return results;
}

// ─── ID3 parsing (minimal, for title/artist/track) ──────────────────

function parseId3(filePath) {
	const buf = Buffer.alloc(4096);
	const fd = openSync(filePath, "r");
	readSync(fd, buf, 0, 4096, 0);
	closeSync(fd);

	const meta = { title: "", artist: "", album: "", trackNumber: 0 };

	// ID3v2
	if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
		const version = buf[3];
		const headerSize = (buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f);
		let pos = 10;
		const end = Math.min(pos + headerSize, buf.length - 10);

		while (pos < end) {
			const frameId = buf.toString("ascii", pos, pos + 4);
			if (frameId === "\0\0\0\0" || frameId.charCodeAt(0) === 0) break;
			const frameSize = version === 4
				? (buf[pos + 4] << 21 | buf[pos + 5] << 14 | buf[pos + 6] << 7 | buf[pos + 7])
				: buf.readUInt32BE(pos + 4);
			if (frameSize <= 0 || frameSize > end - pos) break;

			const data = buf.slice(pos + 10, pos + 10 + frameSize);

			if (frameId === "TIT2") meta.title = readTextFrame(data);
			else if (frameId === "TPE1") meta.artist = readTextFrame(data);
			else if (frameId === "TALB") meta.album = readTextFrame(data);
			else if (frameId === "TRCK") {
				const t = readTextFrame(data);
				meta.trackNumber = parseInt(t) || 0;
			}

			pos += 10 + frameSize;
		}
	}

	if (!meta.title) {
		meta.title = basename(filePath, extname(filePath));
	}

	return meta;
}

function readTextFrame(data) {
	if (data.length < 2) return "";
	const encoding = data[0];
	const textData = data.slice(1);
	if (encoding === 0) return textData.toString("latin1").replace(/\0/g, "");
	if (encoding === 1) return textData.swap16 ? decodeUtf16(textData) : textData.toString("utf16le").replace(/\0/g, "");
	if (encoding === 2) return textData.toString("utf16le").replace(/\0/g, "");
	if (encoding === 3) return textData.toString("utf8").replace(/\0/g, "");
	return textData.toString("latin1").replace(/\0/g, "");
}

function decodeUtf16(buf) {
	// Check BOM
	if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
		return buf.slice(2).toString("utf16le").replace(/\0/g, "");
	}
	if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
		// Big endian — swap
		const swapped = Buffer.alloc(buf.length - 2);
		for (let i = 2; i < buf.length - 1; i += 2) {
			swapped[i - 2] = buf[i + 1];
			swapped[i - 1] = buf[i];
		}
		return swapped.toString("utf16le").replace(/\0/g, "");
	}
	return buf.toString("utf16le").replace(/\0/g, "");
}

// ─── CRC32 for ZIP ──────────────────────────────────────────────────

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
	let c = i;
	for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
	crcTable[i] = c;
}

function crc32Stream(filePath) {
	return new Promise((resolve, reject) => {
		let crc = 0xFFFFFFFF;
		const stream = createReadStream(filePath);
		stream.on("data", (chunk) => {
			for (let i = 0; i < chunk.length; i++) crc = crcTable[(crc ^ chunk[i]) & 0xFF] ^ (crc >>> 8);
		});
		stream.on("end", () => resolve((crc ^ 0xFFFFFFFF) >>> 0));
		stream.on("error", reject);
	});
}

// ─── ZIP64 builder (supports >4GB) ──────────────────────────────────

const ZIP64_THRESHOLD = 0xFFFFFFFF;

function makeLocalFileHeader(nameBytes, crc, fileSize) {
	const needZ64 = fileSize > ZIP64_THRESHOLD;
	const extraLen = needZ64 ? 20 : 0;
	const header = Buffer.alloc(30 + nameBytes.length + extraLen);
	header.writeUInt32LE(0x04034b50, 0);
	header.writeUInt16LE(needZ64 ? 45 : 20, 4);
	header.writeUInt32LE(crc, 14);
	header.writeUInt32LE(needZ64 ? 0xFFFFFFFF : fileSize, 18);
	header.writeUInt32LE(needZ64 ? 0xFFFFFFFF : fileSize, 22);
	header.writeUInt16LE(nameBytes.length, 26);
	header.writeUInt16LE(extraLen, 28);
	nameBytes.copy(header, 30);
	if (needZ64) {
		const ex = 30 + nameBytes.length;
		header.writeUInt16LE(0x0001, ex);
		header.writeUInt16LE(16, ex + 2);
		header.writeBigUInt64LE(BigInt(fileSize), ex + 4);
		header.writeBigUInt64LE(BigInt(fileSize), ex + 12);
	}
	return header;
}

function makeCentralDirEntry(nameBytes, crc, fileSize, headerOffset) {
	const needZ64 = fileSize > ZIP64_THRESHOLD || headerOffset > ZIP64_THRESHOLD;
	const extraLen = needZ64 ? 28 : 0;
	const cd = Buffer.alloc(46 + nameBytes.length + extraLen);
	cd.writeUInt32LE(0x02014b50, 0);
	cd.writeUInt16LE(needZ64 ? 45 : 20, 4);
	cd.writeUInt16LE(needZ64 ? 45 : 20, 6);
	cd.writeUInt32LE(crc, 16);
	cd.writeUInt32LE(needZ64 ? 0xFFFFFFFF : fileSize, 20);
	cd.writeUInt32LE(needZ64 ? 0xFFFFFFFF : fileSize, 24);
	cd.writeUInt16LE(nameBytes.length, 28);
	cd.writeUInt16LE(extraLen, 30);
	cd.writeUInt32LE(needZ64 ? 0xFFFFFFFF : headerOffset, 42);
	nameBytes.copy(cd, 46);
	if (needZ64) {
		const ex = 46 + nameBytes.length;
		cd.writeUInt16LE(0x0001, ex);
		cd.writeUInt16LE(24, ex + 2);
		cd.writeBigUInt64LE(BigInt(fileSize), ex + 4);
		cd.writeBigUInt64LE(BigInt(fileSize), ex + 12);
		cd.writeBigUInt64LE(BigInt(headerOffset), ex + 20);
	}
	return cd;
}

function makeEocd(entryCount, cdSize, cdOffset) {
	const needZ64 = cdOffset > ZIP64_THRESHOLD || cdSize > ZIP64_THRESHOLD || entryCount > 0xFFFF;
	if (needZ64) {
		const z64eocd = Buffer.alloc(56);
		z64eocd.writeUInt32LE(0x06064b50, 0);
		z64eocd.writeBigUInt64LE(BigInt(44), 4);
		z64eocd.writeUInt16LE(45, 12);
		z64eocd.writeUInt16LE(45, 14);
		z64eocd.writeBigUInt64LE(BigInt(entryCount), 24);
		z64eocd.writeBigUInt64LE(BigInt(entryCount), 32);
		z64eocd.writeBigUInt64LE(BigInt(cdSize), 40);
		z64eocd.writeBigUInt64LE(BigInt(cdOffset), 48);

		const z64loc = Buffer.alloc(20);
		z64loc.writeUInt32LE(0x07064b50, 0);
		z64loc.writeBigUInt64LE(BigInt(cdOffset + cdSize), 8);
		z64loc.writeUInt32LE(1, 16);

		const eocd = Buffer.alloc(22);
		eocd.writeUInt32LE(0x06054b50, 0);
		eocd.writeUInt16LE(0xFFFF, 8);
		eocd.writeUInt16LE(0xFFFF, 10);
		eocd.writeUInt32LE(0xFFFFFFFF, 12);
		eocd.writeUInt32LE(0xFFFFFFFF, 16);

		return Buffer.concat([z64eocd, z64loc, eocd]);
	}
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(entryCount, 8);
	eocd.writeUInt16LE(entryCount, 10);
	eocd.writeUInt32LE(cdSize, 12);
	eocd.writeUInt32LE(cdOffset, 16);
	return eocd;
}

// ─── Upload with presigned URL ──────────────────────────────────────

async function uploadFilePresigned(file, r2Key, contentType) {
	const url = await presignUrl(r2Key, contentType);
	const fileData = readFileSync(file.path);
	const res = await fetch(url, {
		method: "PUT",
		headers: { "Content-Type": contentType },
		body: fileData,
	});
	if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${await res.text()}`);
}

// ─── Upload ZIP to R2 via S3 multipart ──────────────────────────────

async function uploadZipToR2(zipFilePath, totalSize, r2Key) {
	// Start multipart
	const startRes = await s3Request("POST", r2Key + "?uploads=", null, {
		"content-type": "application/zip"
	});
	const startXml = await startRes.text();
	const uploadIdMatch = startXml.match(/<UploadId>(.+?)<\/UploadId>/);
	if (!uploadIdMatch) throw new Error("Failed to start multipart upload: " + startXml.slice(0, 200));
	const uploadId = uploadIdMatch[1];

	const PART_SIZE = 50 * 1024 * 1024; // 50MB parts
	const CONCURRENCY = 10;
	const totalParts = Math.ceil(totalSize / PART_SIZE);
	const results = new Array(totalParts);
	let nextPart = 0;
	let uploadedParts = 0;

	async function uploadWorker() {
		while (true) {
			const partIdx = nextPart++;
			if (partIdx >= totalParts) break;

			const partNum = partIdx + 1;
			const offset = partIdx * PART_SIZE;
			const length = Math.min(PART_SIZE, totalSize - offset);
			const body = Buffer.alloc(length);
			const fd = openSync(zipFilePath, "r");
			readSync(fd, body, 0, length, offset);
			closeSync(fd);

			let lastErr;
			for (let attempt = 0; attempt < 3; attempt++) {
				if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
				const res = await s3Request(
					"PUT",
					`${r2Key}?partNumber=${partNum}&uploadId=${encodeURIComponent(uploadId)}`,
					body,
					{ "content-length": String(body.length) }
				);
				if (res.ok) {
					results[partIdx] = { partNumber: partNum, etag: res.headers.get("etag") };
					uploadedParts++;
					progressBar(uploadedParts, totalParts, `Parte ${partNum}/${totalParts}`, Date.now());
					lastErr = null;
					break;
				}
				lastErr = new Error(`Upload part ${partNum} failed: ${res.status}`);
			}
			if (lastErr) throw lastErr;
		}
	}

	const workers = [];
	for (let i = 0; i < Math.min(CONCURRENCY, totalParts); i++) workers.push(uploadWorker());
	await Promise.all(workers);

	// Complete
	const xmlParts = results.map(p =>
		`<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`
	).join("");
	const completeXml = `<CompleteMultipartUpload>${xmlParts}</CompleteMultipartUpload>`;

	const completeRes = await s3Request(
		"POST",
		`${r2Key}?uploadId=${encodeURIComponent(uploadId)}`,
		completeXml,
		{ "content-type": "application/xml" }
	);
	if (!completeRes.ok) throw new Error("Complete multipart failed: " + await completeRes.text());

	return results.length;
}

// ─── Progress bar ───────────────────────────────────────────────────

function progressBar(current, total, label, startTime) {
	const pct = Math.round((current / total) * 100);
	const filled = Math.round(pct / 2.5);
	const bar = "█".repeat(filled) + "░".repeat(40 - filled);
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
	const speed = current > 0 ? (current / ((Date.now() - startTime) / 1000)).toFixed(1) : "0";
	process.stdout.write(`\r  ${bar} ${pct}% | ${current}/${total} | ${speed}/s | ${elapsed}s | ${label}`);
}

function formatSize(bytes) {
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
	if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
	return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

// ─── Main commands ──────────────────────────────────────────────────

async function getPlaylist(slugOrId) {
	try {
		const playlists = await apiCall("GET", "/api/playlists");
		const match = playlists.find(p =>
			p.slug === slugOrId || String(p.id) === String(slugOrId) || p.name === slugOrId
		);
		if (!match) throw new Error(`Playlist "${slugOrId}" não encontrada`);
		return match;
	} catch (e) {
		throw new Error(`Erro ao buscar playlist: ${e.message}`);
	}
}

async function cmdUpload(slugOrId, dirPath, skipZip) {
	console.log("\n  PATACOS CLI — Upload\n");

	if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !CF_ACCOUNT_ID) {
		console.error("  ERRO: Configure as variáveis de ambiente:");
		console.error("    R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CF_ACCOUNT_ID, ADMIN_KEY");
		console.error("  Ou crie um arquivo .env na raiz do projeto.");
		process.exit(1);
	}

	// 1. Find playlist
	const playlist = await getPlaylist(slugOrId);
	console.log(`  Playlist: ${playlist.name} (ID: ${playlist.id}, slug: ${playlist.slug})`);

	// 2. Scan files
	console.log(`  Escaneando: ${dirPath}`);
	const files = scanDir(dirPath);
	if (files.length === 0) {
		console.log("  Nenhum arquivo de áudio encontrado.");
		return;
	}

	const totalSize = files.reduce((s, f) => s + f.size, 0);
	console.log(`  Encontrados: ${files.length} arquivos (${formatSize(totalSize)})`);

	// 3. Parse ID3 tags
	console.log("  Lendo ID3 tags...");
	const parsed = files.map(f => {
		const meta = parseId3(f.path);
		return { ...f, ...meta };
	});

	// 4. Upload files to R2 via presigned URLs (parallel)
	console.log("\n  Enviando músicas pro R2...");
	const MAX_CONCURRENT = 20;
	let uploadIdx = 0;
	let completed = 0;
	let errors = 0;
	let bytesUploaded = 0;
	const startTime = Date.now();
	const registered = [];

	async function uploadOneFile(f) {
		const ext = extname(f.name).toLowerCase();
		const contentType = ext === ".mp3" ? "audio/mpeg" : ext === ".flac" ? "audio/flac" : ext === ".wav" ? "audio/wav" : ext === ".m4a" ? "audio/mp4" : "audio/mpeg";

		const presignData = await apiCall("POST", "/api/presign/upload", {
			playlist_id: String(playlist.id),
			filename: f.name,
			folder: f.folder,
			content_type: contentType,
		});
		const fileData = readFileSync(f.path);

		let lastErr;
		for (let attempt = 0; attempt < 3; attempt++) {
			if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
			const putRes = await fetch(presignData.url, {
				method: "PUT",
				headers: { "Content-Type": presignData.contentType },
				body: fileData,
			});
			if (putRes.ok) {
				await apiCall("POST", "/api/songs/register", {
					playlist_id: String(playlist.id),
					r2_key: presignData.r2Key,
					title: f.title,
					artist: f.artist || "Desconhecido",
					album: f.album || "",
					folder: f.folder,
					duration: 0,
					track_number: f.trackNumber || 0,
					file_size: f.size,
				});
				return;
			}
			lastErr = new Error(`R2 PUT ${putRes.status}`);
			if (putRes.status < 500) throw lastErr;
		}
		throw lastErr;
	}

	async function uploadWorker() {
		while (uploadIdx < parsed.length) {
			const i = uploadIdx++;
			const f = parsed[i];
			try {
				await uploadOneFile(f);
				registered.push(f);
				bytesUploaded += f.size;
			} catch (err) {
				if (err.message && err.message.includes("409")) { bytesUploaded += f.size; registered.push(f); completed++; progressBar(completed, parsed.length, "Já existe", startTime); continue; }
				errors++;
				process.stdout.write(`\n  ERRO: ${f.name}: ${err.message}\n`);
			}
			completed++;
			progressBar(completed, parsed.length, f.name.slice(0, 30), startTime);
		}
	}

	const avgSize = totalSize / files.length;
	const concurrency = avgSize > 50 * 1024 * 1024 ? 4 : avgSize > 20 * 1024 * 1024 ? 8 : MAX_CONCURRENT;
	const workers = [];
	for (let w = 0; w < Math.min(concurrency, parsed.length); w++) workers.push(uploadWorker());
	await Promise.all(workers);

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	console.log(`\n\n  Upload concluído! ${registered.length}/${parsed.length} músicas em ${elapsed}s`);
	if (errors > 0) console.log(`  ${errors} erro(s)`);
	console.log(`  ${formatSize(bytesUploaded)} enviados (${(bytesUploaded / (Date.now() - startTime) * 1000 / 1024 / 1024).toFixed(1)} MB/s)\n`);

	// 5. Generate ZIP locally (only registered files)
	if (!skipZip && registered.length > 0) {
		await cmdZipLocal(playlist, registered);
	}
}

async function cmdZipLocal(playlistOrSlug, files) {
	let playlist;
	if (typeof playlistOrSlug === "string") {
		playlist = await getPlaylist(playlistOrSlug);
	} else {
		playlist = playlistOrSlug;
	}

	let fileList;
	if (files) {
		fileList = files;
	} else {
		// Need dir path from args
		const dirPath = process.argv[4];
		if (!dirPath) {
			console.error("  Uso: patacos zip <playlist> <pasta>");
			process.exit(1);
		}
		console.log(`\n  PATACOS CLI — Gerar ZIP\n`);
		console.log(`  Playlist: ${playlist.name}`);
		console.log(`  Escaneando: ${dirPath}`);
		const scanned = scanDir(dirPath);
		fileList = scanned.map(f => ({ ...f, ...parseId3(f.path) }));
		console.log(`  Encontrados: ${fileList.length} arquivos (${formatSize(fileList.reduce((s, f) => s + f.size, 0))})`);
	}

	if (fileList.length === 0) {
		console.log("  Nenhum arquivo para zipar.");
		return;
	}

	console.log("  Gerando ZIP localmente...");
	const zipStart = Date.now();
	const tmpZipPath = join("/tmp", `patacos-zip-${Date.now()}.zip`);

	// Build ZIP directly to disk
	const entries = [];
	let offset = 0;
	const ws = createWriteStream(tmpZipPath);
	const writeToFile = (buf) => new Promise((resolve, reject) => {
		if (!ws.write(buf)) ws.once("drain", resolve);
		else resolve();
	});

	for (let i = 0; i < fileList.length; i++) {
		const f = fileList[i];
		progressBar(i + 1, fileList.length, `CRC32 ${f.name.slice(0, 25)}`, zipStart);

		const crc = await crc32Stream(f.path);
		const ext = extname(f.name);
		const zipFolder = playlist.name.replace(/[\\/:*?"<>|]/g, "_") + "/";
		const zipName = zipFolder + (f.folder ? f.folder + "/" : "") + basename(f.name);
		const nameBytes = Buffer.from(zipName, "utf8");

		const header = makeLocalFileHeader(nameBytes, crc, f.size);
		await writeToFile(header);

		// Stream file data to disk
		await new Promise((resolve, reject) => {
			const rs = createReadStream(f.path);
			rs.on("data", (chunk) => {
				if (!ws.write(chunk)) rs.pause();
			});
			ws.on("drain", () => rs.resume());
			rs.on("end", resolve);
			rs.on("error", reject);
		});

		entries.push({ nameBytes, crc, fileSize: f.size, headerOffset: offset });
		offset += header.length + f.size;
	}

	// Central directory
	const cdOffset = offset;
	let cdSize = 0;
	for (const e of entries) {
		const cd = makeCentralDirEntry(e.nameBytes, e.crc, e.fileSize, e.headerOffset);
		await writeToFile(cd);
		cdSize += cd.length;
	}

	// EOCD
	const eocdBuf = makeEocd(entries.length, cdSize, cdOffset);
	await writeToFile(eocdBuf);
	const totalZipSize = cdOffset + cdSize + eocdBuf.length;

	// Close the file
	await new Promise((resolve) => ws.end(resolve));

	const zipElapsed = ((Date.now() - zipStart) / 1000).toFixed(1);
	console.log(`\n  ZIP gerado: ${formatSize(totalZipSize)} em ${zipElapsed}s (em disco: ${tmpZipPath})`);

	// Upload ZIP to R2 directly via S3 API (parallel, 50MB parts)
	console.log("  Enviando ZIP pro R2 (6 conexões paralelas, partes de 50MB)...");
	const uploadStart = Date.now();
	const r2Key = `zips/playlist-${playlist.id}/_all_part1.zip`;

	const numParts = await uploadZipToR2(tmpZipPath, totalZipSize, r2Key);

	// Cleanup temp file
	try { unlinkSync(tmpZipPath); } catch {}

	const uploadElapsed = ((Date.now() - uploadStart) / 1000).toFixed(1);
	console.log(`  ZIP enviado (${numParts} partes) em ${uploadElapsed}s`);

	// Register ZIP in DB via API
	try {
		await apiCall("DELETE", `/api/playlists/${playlist.id}/zips`);
	} catch {}

	// We need to register via the zip/complete endpoint or directly
	// Use the API to register the ZIP metadata
	await apiCall("POST", `/api/playlists/${playlist.id}/zip/complete`, {
		uploadId: "direct-s3",
		key: r2Key,
		parts: [],
		folder: "",
		zipPart: 1,
		totalParts: 1,
		fileSize: totalZipSize,
		songCount: entries.length,
	});

	console.log(`\n  Pronto! ZIP com ${entries.length} músicas (${formatSize(totalZipSize)}) registrado.\n`);
}

async function cmdList() {
	console.log("\n  PATACOS CLI — Playlists\n");
	const playlists = await apiCall("GET", "/api/playlists");
	for (const p of playlists) {
		const songs = p.song_count || 0;
		console.log(`  ${p.id}. ${p.name} (${p.slug}) — ${songs} músicas`);
	}
	console.log();
}

// ─── Entry point ────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "help" || cmd === "--help") {
	console.log(`
  PATACOS CLI — Upload de músicas e ZIP pro R2

  Uso:
    node cli/patacos.mjs upload <playlist> <pasta>  Upload músicas + gerar ZIP
    node cli/patacos.mjs upload <playlist> <pasta> --skip-zip  Upload sem ZIP
    node cli/patacos.mjs zip <playlist> <pasta>     Gerar e enviar só o ZIP
    node cli/patacos.mjs list                       Listar playlists

  Configuração (crie .env na raiz ou exporte):
    R2_ACCESS_KEY_ID=...
    R2_SECRET_ACCESS_KEY=...
    CF_ACCOUNT_ID=...
    ADMIN_KEY=...            (session ID do cookie admin)
    API_BASE=https://patacos.com.br

  <playlist> pode ser slug, ID ou nome.
`);
	process.exit(0);
}

if (cmd === "list") {
	cmdList().catch(e => { console.error("Erro:", e.message); process.exit(1); });
} else if (cmd === "upload") {
	const slugOrId = args[1];
	const dirPath = args[2];
	const skipZip = args.includes("--skip-zip");
	if (!slugOrId || !dirPath) {
		console.error("  Uso: patacos upload <playlist> <pasta>");
		process.exit(1);
	}
	cmdUpload(slugOrId, dirPath, skipZip).catch(e => { console.error("Erro:", e.message); process.exit(1); });
} else if (cmd === "zip") {
	const slugOrId = args[1];
	const dirPath = args[2];
	if (!slugOrId || !dirPath) {
		console.error("  Uso: patacos zip <playlist> <pasta>");
		process.exit(1);
	}
	cmdZipLocal(slugOrId).catch(e => { console.error("Erro:", e.message); process.exit(1); });
} else {
	console.error(`  Comando desconhecido: ${cmd}`);
	process.exit(1);
}
