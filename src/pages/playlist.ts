export function renderPlaylistPage(
	playlist: any,
	folderStats: Array<{ folder: string; count: number }>,
	previewSongs: any[],
	totalCount: number,
	accessToken: string,
	zips: any[] = [],
	expiresAt?: string,
): string {
	// Build ZIP availability map: folder → [{ part, total_parts, file_size }]
	const zipsByFolder = new Map<string, any[]>();
	for (const zip of zips) {
		const f = zip.folder || "";
		if (!zipsByFolder.has(f)) zipsByFolder.set(f, []);
		zipsByFolder.get(f)!.push(zip);
	}

	// Playlist cover as fallback for songs without individual covers
	const playlistCoverUrl = playlist.cover_r2_key
		? `/playlist-cover/${playlist.id}?token=${esc(accessToken)}`
		: "";

	// Group preview songs by folder for cover images
	const previewByFolder = new Map<string, any[]>();
	for (const song of previewSongs) {
		const f = song.folder || "";
		if (!previewByFolder.has(f)) previewByFolder.set(f, []);
		previewByFolder.get(f)!.push(song);
	}

	// Get up to 20 songs for preview grid, prioritizing ones with covers
	const withCover = previewSongs.filter((s: any) => s.cover_r2_key);
	const withoutCover = previewSongs.filter((s: any) => !s.cover_r2_key);
	const displaySongs = [...withCover, ...withoutCover].slice(0, 20);

	const previewGrid = displaySongs.map((song: any) => `
		<div class="preview-card">
			<div class="preview-cover">
				${song.cover_r2_key
					? `<img src="/cover/${song.id}?token=${esc(accessToken)}" alt="${esc(song.title)}" loading="lazy">`
					: playlistCoverUrl
						? `<img src="${playlistCoverUrl}" alt="${esc(song.title)}" loading="lazy">`
						: `<div class="cover-placeholder">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
						</div>`
				}
			</div>
			<span class="preview-title">${esc(song.title)}</span>
			<span class="preview-artist">${esc(song.artist)}</span>
		</div>
	`).join("");

	// Helper to format file size
	function formatSize(bytes: number): string {
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
		if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(0) + " MB";
		return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
	}

	// Generate download buttons for a folder
	function renderDownloadButtons(folderName: string, isHero: boolean): string {
		const folderZips = zipsByFolder.get(folderName) || [];
		const baseUrl = folderName
			? `/download-zip/${esc(playlist.slug)}/${encodeURIComponent(folderName)}?token=${esc(accessToken)}`
			: `/download-zip/${esc(playlist.slug)}?token=${esc(accessToken)}`;

		if (folderZips.length === 0) {
			const cls = isHero ? "btn btn-primary btn-hero btn-disabled" : "btn btn-download btn-disabled";
			return `<span class="${cls}">ZIP indisponível</span>`;
		}

		if (folderZips.length === 1 && folderZips[0].total_parts === 1) {
			const z = folderZips[0];
			const cls = isHero ? "btn btn-primary btn-hero" : "btn btn-download";
			const label = isHero ? "Baixar Todas as Músicas (ZIP)" : "Baixar ZIP";
			return `<a href="${baseUrl}" class="${cls}">
				<svg width="${isHero ? 20 : 16}" height="${isHero ? 20 : 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
				${label}
				<span class="zip-size">(${formatSize(z.file_size)})</span>
			</a>`;
		}

		// Multiple parts
		return folderZips.map(z => {
			const cls = isHero ? "btn btn-primary" : "btn btn-download";
			return `<a href="${baseUrl}&part=${z.part}" class="${cls}">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
				Parte ${z.part} de ${z.total_parts}
				<span class="zip-size">(${formatSize(z.file_size)})</span>
			</a>`;
		}).join("");
	}

	// Folder sections — use folderStats for accurate counts, previewSongs for covers
	const folderCards = folderStats.map(({ folder: folderName, count: songCount }) => {
		const folderPreview = previewByFolder.get(folderName) || [];
		const coverSongs = folderPreview.filter((s: any) => s.cover_r2_key).slice(0, 4);
		const displayName = folderName || playlist.name;

		// Mini cover grid (up to 4 covers, using playlist cover as fallback)
		let coverGridImages = coverSongs.map((s: any) =>
			`<img src="/cover/${s.id}?token=${esc(accessToken)}" alt="" loading="lazy">`
		);
		if (coverGridImages.length < 4 && playlistCoverUrl) {
			while (coverGridImages.length < 4) {
				coverGridImages.push(`<img src="${playlistCoverUrl}" alt="" loading="lazy">`);
			}
		}
		const coverGrid = coverGridImages.length > 0
			? `<div class="folder-covers">${coverGridImages.join("")}</div>`
			: `<div class="folder-covers folder-covers-empty">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
			</div>`;

		return `
			<div class="folder-card">
				${coverGrid}
				<div class="folder-details">
					<h3>${esc(displayName)}</h3>
					<span class="folder-count">${songCount} música${songCount !== 1 ? "s" : ""}</span>
				</div>
				<div class="folder-downloads">
					${renderDownloadButtons(folderName, false)}
				</div>
			</div>
		`;
	}).join("");

	const totalSongs = totalCount;
	const totalFolders = folderStats.length;

	// For hero button: use "" folder (all songs ZIP) or the single folder's ZIP
	const heroFolder = totalFolders === 1 ? folderStats[0].folder : "";

	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${esc(playlist.name)} - Patacos</title>
	<link rel="icon" href="/favicon.ico" type="image/x-icon">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<style>${getStyles()}</style>
</head>
<body>
	<div class="container">
		<header>
			<span class="brand">Patacos</span>
			<h1>${esc(playlist.name)}</h1>
			<p class="welcome">Obrigado pela sua compra! Aqui estão suas músicas prontas para download. Esperamos que você aproveite cada faixa.</p>
			${playlist.description ? `<p class="description">${esc(playlist.description)}</p>` : ""}
			<div class="stats">
				<span>${totalSongs} música${totalSongs !== 1 ? "s" : ""}</span>
				${totalFolders > 1 ? `<span class="dot"></span><span>${totalFolders} pastas</span>` : ""}
			</div>
			${expiresAt ? `<div class="expiry-notice" id="expiryNotice" data-expires="${esc(expiresAt)}"></div>` : ""}
			<div class="hero-downloads">
				${renderDownloadButtons(heroFolder, true)}
			</div>
		</header>

		${previewSongs.length > 0 ? `
		<section class="preview-section">
			<h2>Uma amostra do que você adquiriu</h2>
			<div class="preview-grid">
				${previewGrid}
			</div>
			${totalSongs > 20 ? `<p class="preview-note">Mostrando ${displaySongs.length} de ${totalSongs} músicas. Baixe para ter acesso a todas.</p>` : ""}
		</section>
		` : ""}

		<section class="folders-section">
			<div class="folders-header">
				<h2>${totalFolders > 1 ? "Pastas para Download" : "Download"}</h2>
			</div>
			<div class="folders-grid">
				${folderCards}
			</div>
		</section>
	</div>
${expiresAt ? `<script>${expiryScript()}</script>` : ""}
</body>
</html>`;
}

function expiryScript(): string {
	return `(function(){
		var el = document.getElementById('expiryNotice');
		if (!el) return;
		var exp = new Date(el.dataset.expires);
		function update() {
			var now = Date.now();
			var diff = exp.getTime() - now;
			if (diff <= 0) { el.innerHTML = '<strong>Link expirado.</strong> Solicite um novo acesso.'; el.className = 'expiry-notice expiry-expired'; return; }
			var h = Math.floor(diff / 3600000);
			var m = Math.floor((diff % 3600000) / 60000);
			var icon = '';
			var cls = h < 6 ? 'expiry-notice expiry-urgent' : 'expiry-notice';
			if (h >= 24) {
				var d = Math.floor(h / 24); h = h % 24;
				el.innerHTML = icon + ' Este link expira em <strong>' + d + ' dia' + (d !== 1 ? 's' : '') + (h > 0 ? ' e ' + h + 'h' : '') + '</strong>. Baixe suas m\\u00fasicas antes disso.';
			} else {
				el.innerHTML = icon + ' Este link expira em <strong>' + h + 'h' + (m > 0 ? m + 'min' : '') + '</strong>. Baixe suas m\\u00fasicas antes disso.';
			}
			el.className = cls;
		}
		update();
		setInterval(update, 60000);
	})();`;
}

function esc(str: string): string {
	if (!str) return "";
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getStyles(): string {
	return `
	* { margin: 0; padding: 0; box-sizing: border-box; }

	body {
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
		background: #fafafa;
		color: #1a1a1a;
		-webkit-font-smoothing: antialiased;
	}

	.container {
		max-width: 860px;
		margin: 0 auto;
		padding: 0 20px 60px;
	}

	/* Header */
	header {
		padding: 48px 0 32px;
		border-bottom: 1px solid #eee;
		margin-bottom: 32px;
	}

	.brand {
		font-size: 13px;
		color: #aaa;
		text-transform: uppercase;
		letter-spacing: 1px;
		font-weight: 500;
		display: block;
		margin-bottom: 16px;
	}

	header h1 {
		font-size: 36px;
		font-weight: 700;
		letter-spacing: -0.5px;
		margin-bottom: 8px;
	}

	.welcome {
		color: #555;
		font-size: 15px;
		line-height: 1.6;
		margin-bottom: 12px;
	}

	.description {
		color: #666;
		font-size: 15px;
		margin-bottom: 12px;
		line-height: 1.5;
	}

	.stats {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #999;
	}

	.dot { width: 3px; height: 3px; background: #ccc; border-radius: 50%; }

	.expiry-notice { margin-top: 14px; padding: 10px 16px; background: #f0f4ff; border: 1px solid #d0d9f0; border-radius: 10px; font-size: 13px; color: #444; line-height: 1.5; }
	.expiry-urgent { background: #fff8f0; border-color: #f0d8b0; color: #8a6d3b; }
	.expiry-expired { background: #fdf0f0; border-color: #f0c0c0; color: #a94442; }

	.hero-downloads {
		margin-top: 20px;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.btn-hero {
		padding: 14px 28px;
		font-size: 16px;
	}

	/* Preview section */
	.preview-section {
		margin-bottom: 40px;
	}

	.preview-section h2 {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 16px;
		color: #555;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 16px;
	}

	.preview-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.preview-cover {
		aspect-ratio: 1;
		border-radius: 10px;
		overflow: hidden;
		background: #f0f0f0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.preview-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: #ccc;
	}

	.preview-title {
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.preview-artist {
		font-size: 12px;
		color: #888;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.preview-note {
		margin-top: 16px;
		font-size: 13px;
		color: #aaa;
		text-align: center;
	}

	/* Folders section */
	.folders-section {
		margin-bottom: 32px;
	}

	.folders-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.folders-header h2 {
		font-size: 16px;
		font-weight: 600;
		color: #555;
	}

	.folders-grid {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.folder-card {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px;
		background: #fff;
		border: 1px solid #eee;
		border-radius: 12px;
		transition: border-color 0.2s;
	}

	.folder-card:hover { border-color: #ddd; }

	.folder-covers {
		width: 64px;
		height: 64px;
		border-radius: 8px;
		overflow: hidden;
		flex-shrink: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: #f0f0f0;
	}

	.folder-covers img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.folder-covers-empty {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.folder-details {
		flex: 1;
		min-width: 0;
	}

	.folder-details h3 {
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.folder-count {
		font-size: 13px;
		color: #888;
	}

	.folder-downloads {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		flex-shrink: 0;
	}

	.zip-size {
		font-size: 11px;
		opacity: 0.7;
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		border: none;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
		text-decoration: none;
	}

	.btn-primary {
		background: #1a1a1a;
		color: #fff;
	}

	.btn-primary:hover { background: #333; }

	.btn-download {
		background: #f0f0f0;
		color: #333;
		padding: 10px 16px;
		font-size: 13px;
	}

	.btn-download:hover { background: #e5e5e5; }

	.btn-disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}

	/* Responsive */
	@media (max-width: 640px) {
		header h1 { font-size: 26px; }
		.preview-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
		.folder-card { flex-wrap: wrap; }
		.folder-downloads { width: 100%; }
		.folder-downloads .btn { flex: 1; justify-content: center; }
		.hero-downloads { flex-direction: column; }
		.hero-downloads .btn { text-align: center; justify-content: center; }
	}
	`;
}
