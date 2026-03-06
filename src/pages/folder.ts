export function renderFolderPage(folder: any, playlists: any[], allSongs: Map<number, any[]>, allZips: Map<number, any[]>, token: string): string {
	const totalSongs = playlists.reduce((sum, p) => sum + (allSongs.get(p.id) || []).length, 0);
	const totalZipSize = playlists.reduce((sum, p) => {
		return sum + (allZips.get(p.id) || []).reduce((s: number, z: any) => s + (z.file_size || 0), 0);
	}, 0);

	function formatSize(bytes: number): string {
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
		if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(0) + " MB";
		return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
	}

	// Collect preview songs (up to 20, prioritize ones with covers)
	const allSongsList: any[] = [];
	for (const p of playlists) {
		for (const s of (allSongs.get(p.id) || [])) {
			allSongsList.push({ ...s, playlistId: p.id, playlistCover: p.cover_r2_key });
		}
	}
	const withCover = allSongsList.filter(s => s.cover_r2_key);
	const withoutCover = allSongsList.filter(s => !s.cover_r2_key);
	const previewSongs = [...withCover, ...withoutCover].slice(0, 20);

	const previewGrid = previewSongs.map(song => {
		const coverSrc = song.cover_r2_key
			? `/cover/${song.id}?token=${esc(token)}`
			: song.playlistCover
				? `/playlist-cover/${song.playlistId}?token=${esc(token)}`
				: "";
		return `<div class="preview-card">
			<div class="preview-cover">
				${coverSrc
					? `<img src="${coverSrc}" alt="${esc(song.title)}" loading="lazy">`
					: `<div class="cover-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`}
			</div>
			<span class="preview-title">${esc(song.title)}</span>
			<span class="preview-artist">${esc(song.artist)}</span>
		</div>`;
	}).join("");

	// Playlist cards
	const playlistCards = playlists.map(p => {
		const songs = allSongs.get(p.id) || [];
		const zips = allZips.get(p.id) || [];
		const zipSize = zips.reduce((s: number, z: any) => s + (z.file_size || 0), 0);
		const coverUrl = p.cover_r2_key ? `/playlist-cover/${p.id}?token=${esc(token)}` : "";

		// ZIP buttons
		const zipsByFolder = new Map<string, any[]>();
		for (const z of zips) {
			const f = z.folder || "";
			if (!zipsByFolder.has(f)) zipsByFolder.set(f, []);
			zipsByFolder.get(f)!.push(z);
		}

		const mainZips = zipsByFolder.get("") || [];
		let downloadHtml = "";
		if (mainZips.length > 0) {
			downloadHtml = mainZips.map((z: any) =>
				`<a href="/download-zip/${esc(p.slug)}/?token=${esc(token)}&part=${z.part}" class="btn btn-download">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
					Baixar ZIP <span class="zip-size">(${formatSize(zipSize)})</span>
				</a>`
			).join("");
		} else if (zips.length > 0) {
			// Has subfolder-level zips
			const folderEntries = [...zipsByFolder.entries()].filter(([k]) => k !== "");
			downloadHtml = folderEntries.map(([subf, subZips]) => {
				const subSize = subZips.reduce((s: number, z: any) => s + (z.file_size || 0), 0);
				return subZips.map((z: any) =>
					`<a href="/download-zip/${esc(p.slug)}/${encodeURIComponent(subf)}?token=${esc(token)}&part=${z.part}" class="btn btn-download btn-sm">
						${esc(subf)} <span class="zip-size">(${formatSize(subSize)})</span>
					</a>`
				).join("");
			}).join("");
		} else {
			downloadHtml = `<span class="no-zip">ZIP indispon\u00edvel</span>`;
		}

		// Song list grouped by subfolder
		const grouped = new Map<string, any[]>();
		for (const s of songs) {
			const f = s.folder || "";
			if (!grouped.has(f)) grouped.set(f, []);
			grouped.get(f)!.push(s);
		}

		let songListHtml = "";
		for (const [subfolder, items] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
			if (subfolder) {
				songListHtml += `<div class="subfolder-header">\ud83d\udcc1 ${esc(subfolder)} <span>(${items.length})</span></div>`;
			}
			for (const s of items) {
				songListHtml += `<div class="song-row">
					<span class="song-title">${esc(s.title)}</span>
					<span class="song-artist">${esc(s.artist)}</span>
				</div>`;
			}
		}

		// Cover grid (up to 4 covers from songs)
		const coverSongs = songs.filter((s: any) => s.cover_r2_key).slice(0, 4);
		let coverGridImages = coverSongs.map((s: any) =>
			`<img src="/cover/${s.id}?token=${esc(token)}" alt="" loading="lazy">`
		);
		if (coverGridImages.length < 4 && coverUrl) {
			while (coverGridImages.length < 4) {
				coverGridImages.push(`<img src="${coverUrl}" alt="" loading="lazy">`);
			}
		}

		const coverHtml = coverUrl
			? `<img src="${coverUrl}" class="pl-cover-img" alt="${esc(p.name)}">`
			: coverGridImages.length >= 4
				? `<div class="pl-cover-grid">${coverGridImages.join("")}</div>`
				: `<div class="pl-cover-placeholder"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`;

		return `<div class="playlist-card">
			<div class="pl-top">
				<div class="pl-cover">${coverHtml}</div>
				<div class="pl-info">
					<h3>${esc(p.name)}</h3>
					<p class="pl-meta">${songs.length} m\u00fasica${songs.length !== 1 ? "s" : ""}${p.description ? " \u2022 " + esc(p.description) : ""}</p>
				</div>
				<div class="pl-downloads">${downloadHtml}</div>
			</div>
			<details class="songs-details">
				<summary>${songs.length} m\u00fasica${songs.length !== 1 ? "s" : ""} \u2014 ver lista</summary>
				<div class="songs-list">${songListHtml}</div>
			</details>
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
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #fafafa; color: #1a1a1a; -webkit-font-smoothing: antialiased; }
	.container { max-width: 860px; margin: 0 auto; padding: 0 20px 60px; }

	/* Header */
	header { padding: 48px 0 32px; border-bottom: 1px solid #eee; margin-bottom: 32px; }
	.brand { font-size: 13px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; display: block; margin-bottom: 16px; }
	header h1 { font-size: 36px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 8px; }
	.welcome { color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 12px; }
	.description { color: #666; font-size: 15px; margin-bottom: 12px; line-height: 1.5; }
	.stats { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #999; }
	.dot { width: 3px; height: 3px; background: #ccc; border-radius: 50%; }

	/* Preview */
	.preview-section { margin-bottom: 40px; }
	.preview-section h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #555; }
	.preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
	.preview-card { display: flex; flex-direction: column; gap: 6px; }
	.preview-cover { aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: #f0f0f0; display: flex; align-items: center; justify-content: center; }
	.preview-cover img { width: 100%; height: 100%; object-fit: cover; }
	.cover-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #ccc; }
	.preview-title { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.preview-artist { font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.preview-note { margin-top: 16px; font-size: 13px; color: #aaa; text-align: center; }

	/* Playlists */
	.playlists-section h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #555; }
	.playlist-card { background: #fff; border: 1px solid #eee; border-radius: 14px; margin-bottom: 14px; overflow: hidden; transition: border-color 0.2s; }
	.playlist-card:hover { border-color: #ddd; }
	.pl-top { display: flex; align-items: center; gap: 16px; padding: 18px 20px; }
	.pl-cover { width: 64px; height: 64px; border-radius: 10px; overflow: hidden; flex-shrink: 0; background: #f0f0f0; display: flex; align-items: center; justify-content: center; }
	.pl-cover-img { width: 100%; height: 100%; object-fit: cover; }
	.pl-cover-grid { width: 100%; height: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; }
	.pl-cover-grid img { width: 100%; height: 100%; object-fit: cover; }
	.pl-cover-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
	.pl-info { flex: 1; min-width: 0; }
	.pl-info h3 { font-size: 16px; font-weight: 600; margin-bottom: 3px; }
	.pl-meta { font-size: 13px; color: #888; }
	.pl-downloads { display: flex; flex-wrap: wrap; gap: 8px; flex-shrink: 0; }
	.no-zip { font-size: 12px; color: #bbb; }

	/* Song details */
	.songs-details { border-top: 1px solid #f0f0f0; }
	.songs-details summary { padding: 12px 20px; font-size: 13px; color: #888; cursor: pointer; user-select: none; transition: background 0.15s; list-style: none; }
	.songs-details summary::-webkit-details-marker { display: none; }
	.songs-details summary::before { content: '\u25B6'; display: inline-block; margin-right: 8px; font-size: 10px; transition: transform 0.2s; }
	.songs-details[open] summary::before { transform: rotate(90deg); }
	.songs-details summary:hover { background: #fafafa; }
	.songs-list { max-height: 400px; overflow-y: auto; }
	.subfolder-header { padding: 8px 20px; background: #f8f8f8; font-size: 12px; font-weight: 600; color: #777; border-top: 1px solid #f0f0f0; }
	.subfolder-header span { font-weight: 400; color: #aaa; }
	.song-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 20px; font-size: 13px; border-top: 1px solid #f8f8f8; }
	.song-title { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
	.song-artist { color: #aaa; font-size: 12px; flex-shrink: 0; margin-left: 12px; }

	/* Buttons */
	.btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-family: inherit; text-decoration: none; }
	.btn-primary { background: #1a1a1a; color: #fff; }
	.btn-primary:hover { background: #333; }
	.btn-download { background: #f0f0f0; color: #333; padding: 10px 16px; font-size: 13px; }
	.btn-download:hover { background: #e5e5e5; }
	.btn-sm { padding: 8px 14px; font-size: 12px; }
	.zip-size { font-size: 11px; opacity: 0.6; }

	@media (max-width: 640px) {
		header h1 { font-size: 26px; }
		.preview-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
		.pl-top { flex-wrap: wrap; gap: 12px; }
		.pl-downloads { width: 100%; }
		.pl-downloads .btn { flex: 1; justify-content: center; }
	}
	</style>
</head>
<body>
	<div class="container">
		<header>
			<span class="brand">Patacos</span>
			<h1>${esc(folder.name)}</h1>
			<p class="welcome">Obrigado pela sua compra! Aqui est\u00e3o suas m\u00fasicas prontas para download. Esperamos que voc\u00ea aproveite cada faixa.</p>
			${folder.description ? `<p class="description">${esc(folder.description)}</p>` : ""}
			<div class="stats">
				<span>${playlists.length} playlist${playlists.length !== 1 ? "s" : ""}</span>
				<span class="dot"></span>
				<span>${totalSongs} m\u00fasica${totalSongs !== 1 ? "s" : ""}</span>
				${totalZipSize > 0 ? `<span class="dot"></span><span>${formatSize(totalZipSize)} total</span>` : ""}
			</div>
		</header>

		${previewSongs.length > 0 ? `
		<section class="preview-section">
			<h2>Uma amostra do que voc\u00ea adquiriu</h2>
			<div class="preview-grid">${previewGrid}</div>
			${allSongsList.length > 20 ? `<p class="preview-note">Mostrando ${previewSongs.length} de ${allSongsList.length} m\u00fasicas. Baixe para ter acesso a todas.</p>` : ""}
		</section>
		` : ""}

		<section class="playlists-section">
			<h2>Playlists para Download</h2>
			${playlistCards}
		</section>
	</div>
</body>
</html>`;
}

function esc(str: string): string {
	if (!str) return "";
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
