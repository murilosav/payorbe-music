export function renderPlaylistPage(playlist: any, songs: any[], accessToken: string): string {
	// Group songs by folder
	const folders = new Map<string, any[]>();
	for (const song of songs) {
		const folder = song.folder || "";
		if (!folders.has(folder)) folders.set(folder, []);
		folders.get(folder)!.push(song);
	}

	// Get up to 20 songs for preview, prioritizing ones with covers
	const withCover = songs.filter((s: any) => s.cover_r2_key);
	const withoutCover = songs.filter((s: any) => !s.cover_r2_key);
	const previewSongs = [...withCover, ...withoutCover].slice(0, 20);

	const previewGrid = previewSongs.map((song: any) => `
		<div class="preview-card">
			<div class="preview-cover">
				${song.cover_r2_key
					? `<img src="/cover/${song.id}?token=${esc(accessToken)}" alt="${esc(song.title)}" loading="lazy">`
					: `<div class="cover-placeholder">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
					</div>`
				}
			</div>
			<span class="preview-title">${esc(song.title)}</span>
			<span class="preview-artist">${esc(song.artist)}</span>
		</div>
	`).join("");

	// Folder sections
	const folderCards = Array.from(folders.entries()).map(([folderName, folderSongs]) => {
		const coverSongs = folderSongs.filter((s: any) => s.cover_r2_key).slice(0, 4);
		const displayName = folderName || playlist.name;
		const downloadUrl = folderName
			? `/download-zip/${esc(playlist.slug)}/${encodeURIComponent(folderName)}?token=${esc(accessToken)}`
			: `/download-zip/${esc(playlist.slug)}?token=${esc(accessToken)}`;

		// Mini cover grid (up to 4 covers)
		const coverGrid = coverSongs.length > 0
			? `<div class="folder-covers">${coverSongs.map((s: any) =>
				`<img src="/cover/${s.id}?token=${esc(accessToken)}" alt="" loading="lazy">`
			).join("")}</div>`
			: `<div class="folder-covers folder-covers-empty">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
			</div>`;

		return `
			<div class="folder-card">
				${coverGrid}
				<div class="folder-details">
					<h3>${esc(displayName)}</h3>
					<span class="folder-count">${folderSongs.length} musica${folderSongs.length !== 1 ? "s" : ""}</span>
				</div>
				<a href="${downloadUrl}" class="btn btn-download">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
					Baixar ZIP
				</a>
			</div>
		`;
	}).join("");

	const totalSongs = songs.length;
	const totalFolders = folders.size;
	const downloadAllUrl = `/download-zip/${esc(playlist.slug)}?token=${esc(accessToken)}`;

	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${esc(playlist.name)} - Patacos</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<style>${getStyles()}</style>
</head>
<body>
	<div class="container">
		<header>
			<span class="brand">Patacos</span>
			<h1>${esc(playlist.name)}</h1>
			${playlist.description ? `<p class="description">${esc(playlist.description)}</p>` : ""}
			<div class="stats">
				<span>${totalSongs} musica${totalSongs !== 1 ? "s" : ""}</span>
				${totalFolders > 1 ? `<span class="dot"></span><span>${totalFolders} pastas</span>` : ""}
			</div>
		</header>

		${previewSongs.length > 0 ? `
		<section class="preview-section">
			<h2>Preview</h2>
			<div class="preview-grid">
				${previewGrid}
			</div>
			${songs.length > 20 ? `<p class="preview-note">Mostrando ${previewSongs.length} de ${songs.length} musicas. Baixe para ter acesso a todas.</p>` : ""}
		</section>
		` : ""}

		<section class="folders-section">
			<div class="folders-header">
				<h2>${totalFolders > 1 ? "Pastas para Download" : "Download"}</h2>
				${totalFolders > 1 ? `
					<a href="${downloadAllUrl}" class="btn btn-primary">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
						Baixar Tudo (ZIP)
					</a>
				` : ""}
			</div>
			<div class="folders-grid">
				${folderCards}
			</div>
		</section>
	</div>
</body>
</html>`;
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
		flex-shrink: 0;
		padding: 10px 16px;
		font-size: 13px;
	}

	.btn-download:hover { background: #e5e5e5; }

	/* Responsive */
	@media (max-width: 640px) {
		header h1 { font-size: 26px; }
		.preview-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
		.folder-card { flex-wrap: wrap; }
		.folders-header { flex-direction: column; gap: 12px; align-items: stretch; }
		.folders-header .btn { text-align: center; justify-content: center; }
	}
	`;
}
