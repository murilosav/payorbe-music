export function renderFolderPage(folder: any, playlists: any[], allSongs: Map<number, any[]>, allZips: Map<number, any[]>, token: string): string {
	const playlistSections = playlists.map(p => {
		const songs = allSongs.get(p.id) || [];
		const zips = allZips.get(p.id) || [];
		const totalSize = zips.reduce((s: number, z: any) => s + (z.file_size || 0), 0);
		const sizeMB = (totalSize / (1024 * 1024)).toFixed(0);
		const hasZip = zips.length > 0;
		const coverUrl = p.cover_r2_key ? `/playlist-cover/${p.id}?token=${esc(token)}` : "";

		// Group songs by folder
		const grouped = new Map<string, any[]>();
		for (const s of songs) {
			const f = s.folder || "";
			if (!grouped.has(f)) grouped.set(f, []);
			grouped.get(f)!.push(s);
		}

		// ZIP download buttons per subfolder
		const zipsByFolder = new Map<string, any[]>();
		for (const z of zips) {
			const f = z.folder || "";
			if (!zipsByFolder.has(f)) zipsByFolder.set(f, []);
			zipsByFolder.get(f)!.push(z);
		}

		let songsHtml = "";
		for (const [subfolder, items] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
			if (subfolder) {
				const folderZips = zipsByFolder.get(subfolder) || [];
				const folderSize = folderZips.reduce((s: number, z: any) => s + (z.file_size || 0), 0);
				const folderSizeMB = (folderSize / (1024 * 1024)).toFixed(0);
				songsHtml += `<div class="subfolder-header">
					<span>\ud83d\udcc1 ${esc(subfolder)} (${items.length})</span>
					${folderZips.length > 0 ? folderZips.map((z: any) =>
						`<a href="/download-zip/${esc(p.slug)}/${encodeURIComponent(subfolder)}?token=${esc(token)}&part=${z.part}" class="dl-btn dl-btn-sm">Baixar ${folderSizeMB} MB</a>`
					).join("") : ""}
				</div>`;
			}
			for (const s of items) {
				songsHtml += `<div class="song-row">
					<span class="song-name">${esc(s.title)}</span>
					<span class="song-artist">${esc(s.artist)}</span>
				</div>`;
			}
		}

		// Main ZIP download (all songs in playlist)
		const mainZips = zipsByFolder.get("") || [];
		let downloadBtn = "";
		if (mainZips.length > 0) {
			downloadBtn = mainZips.map((z: any) =>
				`<a href="/download-zip/${esc(p.slug)}/?token=${esc(token)}&part=${z.part}" class="dl-btn">Baixar Tudo (${sizeMB} MB)</a>`
			).join("");
		} else if (hasZip) {
			// Has folder-level zips but no "all" zip - show individual folder downloads
			downloadBtn = `<span class="dl-note">Baixe por pasta abaixo</span>`;
		}

		return `<div class="playlist-section">
			<div class="playlist-header">
				<div class="playlist-info">
					${coverUrl ? `<img src="${coverUrl}" class="playlist-thumb" alt="">` : `<div class="playlist-thumb placeholder">\ud83c\udfb5</div>`}
					<div>
						<h2>${esc(p.name)}</h2>
						<p class="playlist-meta">${songs.length} m\u00fasica${songs.length !== 1 ? "s" : ""}${p.description ? " \u2022 " + esc(p.description) : ""}</p>
					</div>
				</div>
				<div class="playlist-actions">${downloadBtn}</div>
			</div>
			<div class="songs-list">${songsHtml}</div>
		</div>`;
	}).join("");

	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${esc(folder.name)} - Patacos</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<style>
	* { margin:0; padding:0; box-sizing:border-box; }
	body { font-family:'Inter',-apple-system,sans-serif; background:#fafafa; color:#1a1a1a; -webkit-font-smoothing:antialiased; }
	.container { max-width:720px; margin:0 auto; padding:24px 20px 48px; }
	.folder-header { text-align:center; padding:32px 0 24px; }
	.folder-header h1 { font-size:28px; font-weight:700; margin-bottom:6px; }
	.folder-header p { color:#888; font-size:14px; }
	.folder-header .count { font-size:13px; color:#aaa; margin-top:8px; }
	.playlist-section { background:#fff; border:1px solid #eee; border-radius:12px; margin-bottom:16px; overflow:hidden; }
	.playlist-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; gap:12px; flex-wrap:wrap; }
	.playlist-info { display:flex; align-items:center; gap:14px; flex:1; min-width:0; }
	.playlist-thumb { width:52px; height:52px; border-radius:10px; object-fit:cover; flex-shrink:0; }
	.playlist-thumb.placeholder { background:#f0f0f0; display:flex; align-items:center; justify-content:center; font-size:22px; }
	.playlist-info h2 { font-size:17px; font-weight:600; }
	.playlist-meta { font-size:13px; color:#888; margin-top:2px; }
	.playlist-actions { display:flex; gap:8px; flex-shrink:0; flex-wrap:wrap; }
	.dl-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; background:#1a1a1a; color:#fff; border-radius:8px; font-size:13px; font-weight:500; text-decoration:none; transition:background 0.15s; }
	.dl-btn:hover { background:#333; }
	.dl-btn-sm { padding:6px 14px; font-size:12px; background:#f0f0f0; color:#333; }
	.dl-btn-sm:hover { background:#e0e0e0; }
	.dl-note { font-size:12px; color:#aaa; }
	.songs-list { border-top:1px solid #f0f0f0; }
	.subfolder-header { display:flex; justify-content:space-between; align-items:center; padding:10px 20px; background:#fafafa; font-size:13px; font-weight:600; color:#666; border-top:1px solid #f0f0f0; gap:8px; flex-wrap:wrap; }
	.song-row { display:flex; justify-content:space-between; align-items:center; padding:8px 20px; font-size:13px; border-top:1px solid #f8f8f8; }
	.song-row:first-child { border-top:none; }
	.song-name { font-weight:500; }
	.song-artist { color:#999; font-size:12px; }
	@media (max-width:600px) {
		.playlist-header { flex-direction:column; align-items:flex-start; }
		.playlist-actions { width:100%; }
		.dl-btn { width:100%; justify-content:center; }
	}
	</style>
</head>
<body>
	<div class="container">
		<div class="folder-header">
			<h1>${esc(folder.name)}</h1>
			${folder.description ? `<p>${esc(folder.description)}</p>` : ""}
			<div class="count">${playlists.length} playlist${playlists.length !== 1 ? "s" : ""}</div>
		</div>
		${playlistSections}
	</div>
</body>
</html>`;
}

function esc(str: string): string {
	if (!str) return "";
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
