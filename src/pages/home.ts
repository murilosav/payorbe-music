export function renderHomePage(playlists: any[]): string {
	const playlistCards = playlists.map(p => `
		<a href="/${esc(p.slug)}" class="playlist-card">
			<div class="playlist-card-cover">
				${p.cover_url
					? `<img src="${esc(p.cover_url)}" alt="${esc(p.name)}">`
					: `<div class="playlist-placeholder">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M9 18V5l12-2v13"></path>
							<circle cx="6" cy="18" r="3"></circle>
							<circle cx="18" cy="16" r="3"></circle>
						</svg>
					</div>`
				}
			</div>
			<div class="playlist-card-info">
				<h3>${esc(p.name)}</h3>
				${p.description ? `<p>${esc(p.description)}</p>` : ""}
			</div>
		</a>
	`).join("");

	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Patacos</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body {
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
		background: #fafafa;
		color: #1a1a1a;
		-webkit-font-smoothing: antialiased;
	}
	.container { max-width: 960px; margin: 0 auto; padding: 0 20px; }
	header {
		padding: 48px 0 40px;
		text-align: center;
	}
	header h1 {
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.5px;
		margin-bottom: 8px;
	}
	header p {
		color: #888;
		font-size: 15px;
	}
	.playlists-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 24px;
		padding-bottom: 48px;
	}
	.playlist-card {
		text-decoration: none;
		color: inherit;
		transition: transform 0.2s;
	}
	.playlist-card:hover { transform: translateY(-4px); }
	.playlist-card-cover {
		aspect-ratio: 1;
		border-radius: 12px;
		overflow: hidden;
		background: #f0f0f0;
		margin-bottom: 12px;
	}
	.playlist-card-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.playlist-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ccc;
	}
	.playlist-card-info h3 {
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 4px;
	}
	.playlist-card-info p {
		font-size: 13px;
		color: #888;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.empty-state {
		text-align: center;
		padding: 80px 20px;
		color: #aaa;
	}
	.empty-state svg { margin-bottom: 16px; }
	.empty-state p { font-size: 15px; }
	</style>
</head>
<body>
	<div class="container">
		<header>
			<h1>Patacos</h1>
			<p>Suas playlists de musica</p>
		</header>
		${playlists.length > 0 ? `
			<div class="playlists-grid">
				${playlistCards}
			</div>
		` : `
			<div class="empty-state">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M9 18V5l12-2v13"></path>
					<circle cx="6" cy="18" r="3"></circle>
					<circle cx="18" cy="16" r="3"></circle>
				</svg>
				<p>Nenhuma playlist criada ainda.<br>Acesse <a href="/admin">/admin</a> para gerenciar.</p>
			</div>
		`}
	</div>
</body>
</html>`;
}

function esc(str: string): string {
	if (!str) return "";
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
