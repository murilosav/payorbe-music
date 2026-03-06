export function renderAdminPage(): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Admin - PayOrbe Music</title>
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
	.container { max-width: 800px; margin: 0 auto; padding: 20px; }
	h1 { font-size: 24px; font-weight: 700; margin-bottom: 24px; padding-top: 24px; }
	h2 { font-size: 18px; font-weight: 600; margin: 32px 0 16px; color: #333; }

	.card {
		background: #fff;
		border: 1px solid #eee;
		border-radius: 12px;
		padding: 24px;
		margin-bottom: 16px;
	}

	.form-group { margin-bottom: 16px; }
	label {
		display: block;
		font-size: 13px;
		font-weight: 500;
		color: #555;
		margin-bottom: 6px;
	}
	input[type="text"], input[type="number"], select {
		width: 100%;
		padding: 10px 14px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 14px;
		font-family: inherit;
		outline: none;
		transition: border-color 0.2s;
	}
	input:focus, select:focus { border-color: #999; }

	.form-row { display: flex; gap: 12px; }
	.form-row .form-group { flex: 1; }

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
		font-family: inherit;
		transition: all 0.2s;
	}
	.btn-primary { background: #1a1a1a; color: #fff; }
	.btn-primary:hover { background: #333; }
	.btn-danger { background: #ff4444; color: #fff; }
	.btn-danger:hover { background: #cc0000; }
	.btn-sm { padding: 6px 14px; font-size: 13px; }

	.playlist-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border: 1px solid #eee;
		border-radius: 8px;
		margin-bottom: 8px;
		background: #fff;
	}
	.playlist-item-info { flex: 1; }
	.playlist-item-name { font-weight: 600; font-size: 15px; }
	.playlist-item-slug { font-size: 12px; color: #888; }
	.playlist-item-actions { display: flex; gap: 8px; }

	.song-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		border-bottom: 1px solid #f5f5f5;
		font-size: 14px;
	}
	.song-item:last-child { border-bottom: none; }

	.upload-area {
		border: 2px dashed #ddd;
		border-radius: 12px;
		padding: 32px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;
		color: #888;
		margin-bottom: 16px;
	}
	.upload-area:hover { border-color: #999; color: #555; }
	.upload-area.dragover { border-color: #1a1a1a; background: #f5f5f5; }

	.progress-bar {
		width: 100%;
		height: 4px;
		background: #eee;
		border-radius: 2px;
		overflow: hidden;
		margin-top: 8px;
	}
	.progress-fill {
		height: 100%;
		background: #1a1a1a;
		width: 0%;
		transition: width 0.3s;
	}

	.upload-queue { margin-top: 12px; }
	.upload-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		font-size: 13px;
		border-bottom: 1px solid #f5f5f5;
	}
	.upload-item .status { color: #888; }
	.upload-item .status.done { color: #22c55e; }
	.upload-item .status.error { color: #ef4444; }

	.tabs {
		display: flex;
		gap: 4px;
		border-bottom: 1px solid #eee;
		margin-bottom: 24px;
	}
	.tab {
		padding: 10px 20px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		color: #888;
		border-bottom: 2px solid transparent;
		transition: all 0.2s;
	}
	.tab.active { color: #1a1a1a; border-bottom-color: #1a1a1a; }
	.tab:hover { color: #555; }
	.tab-content { display: none; }
	.tab-content.active { display: block; }

	.msg {
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 13px;
		margin-bottom: 16px;
		display: none;
	}
	.msg.success { display: block; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
	.msg.error { display: block; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
	</style>
</head>
<body>
	<div class="container">
		<div style="display:flex;justify-content:space-between;align-items:center;">
			<h1>Admin - PayOrbe Music</h1>
			<a href="/" style="color:#888;font-size:13px;text-decoration:none;">Voltar ao site</a>
		</div>

		<div class="tabs">
			<div class="tab active" onclick="switchTab('playlists')">Playlists</div>
			<div class="tab" onclick="switchTab('upload')">Upload de Musicas</div>
			<div class="tab" onclick="switchTab('songs')">Gerenciar Musicas</div>
		</div>

		<!-- Playlists Tab -->
		<div class="tab-content active" id="tab-playlists">
			<div class="card">
				<h2 style="margin-top:0">Criar Playlist</h2>
				<div id="playlistMsg" class="msg"></div>
				<div class="form-row">
					<div class="form-group">
						<label>Nome</label>
						<input type="text" id="playlistName" placeholder="Ex: Gospel Hits 2026">
					</div>
					<div class="form-group">
						<label>Slug (URL)</label>
						<input type="text" id="playlistSlug" placeholder="Ex: gospel-hits">
					</div>
				</div>
				<div class="form-group">
					<label>Descricao (opcional)</label>
					<input type="text" id="playlistDesc" placeholder="Descricao da playlist">
				</div>
				<button class="btn btn-primary" onclick="createPlaylist()">Criar Playlist</button>
			</div>

			<h2>Playlists Existentes</h2>
			<div id="playlistsList"></div>
		</div>

		<!-- Upload Tab -->
		<div class="tab-content" id="tab-upload">
			<div class="card">
				<div class="form-group">
					<label>Playlist</label>
					<select id="uploadPlaylist"></select>
				</div>
				<div class="form-group">
					<label>Pasta (opcional)</label>
					<input type="text" id="uploadFolder" placeholder="Ex: CD 01 - Adoracao">
				</div>
				<div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
					<p>Clique ou arraste arquivos de musica aqui</p>
					<p style="font-size:12px;margin-top:4px;">MP3, MP4, WAV, FLAC, OGG</p>
				</div>
				<input type="file" id="fileInput" multiple accept="audio/*,.mp3,.mp4,.m4a,.wav,.flac,.ogg" style="display:none" onchange="handleFiles(this.files)">
				<div class="upload-queue" id="uploadQueue"></div>
			</div>
		</div>

		<!-- Songs Tab -->
		<div class="tab-content" id="tab-songs">
			<div class="card">
				<div class="form-group">
					<label>Filtrar por Playlist</label>
					<select id="songsPlaylistFilter" onchange="loadSongs()">
						<option value="">Selecione uma playlist</option>
					</select>
				</div>
				<div id="songsList"></div>
			</div>
		</div>
	</div>

	<script>
	// Tab switching
	function switchTab(tab) {
		document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
		document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
		document.querySelector('.tab-content#tab-' + tab).classList.add('active');
		event.target.classList.add('active');

		if (tab === 'upload') loadPlaylistsForSelect();
		if (tab === 'songs') loadPlaylistsForFilter();
	}

	// Playlists
	async function loadPlaylists() {
		const res = await fetch('/api/playlists');
		const data = await res.json();
		const container = document.getElementById('playlistsList');
		if (data.length === 0) {
			container.innerHTML = '<p style="color:#888;font-size:14px;padding:16px;">Nenhuma playlist criada.</p>';
			return;
		}
		container.innerHTML = data.map(p => \`
			<div class="playlist-item">
				<div class="playlist-item-info">
					<div class="playlist-item-name">\${p.name}</div>
					<div class="playlist-item-slug">
						<a href="/\${p.slug}" target="_blank" style="color:#666;text-decoration:none;">/\${p.slug}</a>
					</div>
				</div>
				<div class="playlist-item-actions">
					<button class="btn btn-danger btn-sm" onclick="deletePlaylist(\${p.id}, '\${p.name}')">Excluir</button>
				</div>
			</div>
		\`).join('');
	}

	async function createPlaylist() {
		const name = document.getElementById('playlistName').value.trim();
		const slug = document.getElementById('playlistSlug').value.trim();
		const desc = document.getElementById('playlistDesc').value.trim();
		const msg = document.getElementById('playlistMsg');

		if (!name || !slug) {
			msg.className = 'msg error';
			msg.textContent = 'Nome e slug sao obrigatorios.';
			return;
		}

		const res = await fetch('/api/playlists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, slug, description: desc })
		});

		if (res.ok) {
			msg.className = 'msg success';
			msg.textContent = 'Playlist criada com sucesso!';
			document.getElementById('playlistName').value = '';
			document.getElementById('playlistSlug').value = '';
			document.getElementById('playlistDesc').value = '';
			loadPlaylists();
		} else {
			const err = await res.json();
			msg.className = 'msg error';
			msg.textContent = err.error || 'Erro ao criar playlist.';
		}
	}

	async function deletePlaylist(id, name) {
		if (!confirm('Excluir playlist "' + name + '" e todas as suas musicas?')) return;
		await fetch('/api/playlists/' + id, { method: 'DELETE' });
		loadPlaylists();
	}

	// Upload
	async function loadPlaylistsForSelect() {
		const res = await fetch('/api/playlists');
		const data = await res.json();
		const select = document.getElementById('uploadPlaylist');
		select.innerHTML = data.map(p => '<option value="' + p.id + '">' + p.name + '</option>').join('');
	}

	async function loadPlaylistsForFilter() {
		const res = await fetch('/api/playlists');
		const data = await res.json();
		const select = document.getElementById('songsPlaylistFilter');
		select.innerHTML = '<option value="">Selecione uma playlist</option>' +
			data.map(p => '<option value="' + p.slug + '">' + p.name + '</option>').join('');
	}

	// Drag and drop
	const uploadArea = document.getElementById('uploadArea');
	uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
	uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
	uploadArea.addEventListener('drop', (e) => {
		e.preventDefault();
		uploadArea.classList.remove('dragover');
		handleFiles(e.dataTransfer.files);
	});

	async function handleFiles(files) {
		const queue = document.getElementById('uploadQueue');
		const playlistId = document.getElementById('uploadPlaylist').value;
		const folder = document.getElementById('uploadFolder').value.trim();

		if (!playlistId) { alert('Selecione uma playlist primeiro.'); return; }

		for (const file of files) {
			const item = document.createElement('div');
			item.className = 'upload-item';
			const title = file.name.replace(/\\.[^.]+$/, '').replace(/^\\d+[\\s._-]+/, '');
			item.innerHTML = \`
				<span>\${file.name}</span>
				<span class="status">Enviando...</span>
			\`;
			queue.appendChild(item);

			try {
				const formData = new FormData();
				formData.append('file', file);
				formData.append('playlist_id', playlistId);
				formData.append('title', title);
				formData.append('artist', 'Desconhecido');
				formData.append('folder', folder);

				const res = await fetch('/api/songs/upload', { method: 'POST', body: formData });
				if (res.ok) {
					item.querySelector('.status').className = 'status done';
					item.querySelector('.status').textContent = 'Enviado!';
				} else {
					const err = await res.json();
					throw new Error(err.error);
				}
			} catch (err) {
				item.querySelector('.status').className = 'status error';
				item.querySelector('.status').textContent = 'Erro: ' + err.message;
			}
		}
	}

	// Songs management
	async function loadSongs() {
		const slug = document.getElementById('songsPlaylistFilter').value;
		const container = document.getElementById('songsList');
		if (!slug) { container.innerHTML = ''; return; }

		const res = await fetch('/api/playlists/' + slug + '/songs');
		const data = await res.json();

		if (data.length === 0) {
			container.innerHTML = '<p style="color:#888;font-size:14px;padding:16px;">Nenhuma musica nesta playlist.</p>';
			return;
		}

		container.innerHTML = data.map(s => \`
			<div class="song-item">
				<div>
					<strong>\${s.title}</strong> - \${s.artist}
					\${s.folder ? '<span style="color:#aaa;font-size:12px;"> (\${s.folder})</span>' : ''}
				</div>
				<button class="btn btn-danger btn-sm" onclick="deleteSong(\${s.id})">Excluir</button>
			</div>
		\`).join('');
	}

	async function deleteSong(id) {
		if (!confirm('Excluir esta musica?')) return;
		await fetch('/api/songs/' + id, { method: 'DELETE' });
		loadSongs();
	}

	// Auto-generate slug from name
	document.getElementById('playlistName').addEventListener('input', (e) => {
		const slug = e.target.value.toLowerCase()
			.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
		document.getElementById('playlistSlug').value = slug;
	});

	// Initial load
	loadPlaylists();
	</script>
</body>
</html>`;
}
