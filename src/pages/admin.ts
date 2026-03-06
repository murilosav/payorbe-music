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
		cursor: default;
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

	.upload-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background: #1a1a1a;
		color: #fff;
		z-index: 999;
		padding: 0;
		transition: transform 0.3s;
		transform: translateY(-100%);
	}
	.upload-banner.active { transform: translateY(0); }
	.upload-banner-content {
		max-width: 800px;
		margin: 0 auto;
		padding: 14px 20px;
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.upload-banner .spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255,255,255,0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
	.upload-banner-text { flex: 1; font-size: 14px; }
	.upload-banner-pct { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
	.upload-banner-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		height: 3px;
		background: #4ade80;
		transition: width 0.3s;
	}
	.upload-banner.done { background: #16a34a; }
	.upload-banner.has-errors { background: #dc2626; }

	.upload-queue { margin-top: 12px; }
	.upload-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		font-size: 13px;
		border-bottom: 1px solid #f5f5f5;
		border-radius: 6px;
		transition: background 0.2s;
	}
	.upload-item.uploading { background: #f8f8f8; }
	.upload-item .status-icon {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.upload-item .status-icon.waiting { color: #ddd; }
	.upload-item .status-icon.uploading { color: #1a1a1a; }
	.upload-item .status-icon.done { color: #22c55e; }
	.upload-item .status-icon.error { color: #ef4444; }
	.upload-item .file-info { flex: 1; min-width: 0; }
	.upload-item .file-name {
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.upload-item .file-folder { font-size: 11px; color: #aaa; }
	.upload-item .file-status { font-size: 12px; color: #888; flex-shrink: 0; }

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
	<!-- Upload progress banner (fixed at top) -->
	<div class="upload-banner" id="uploadBanner">
		<div class="upload-banner-content">
			<div class="spinner" id="bannerSpinner"></div>
			<span class="upload-banner-text" id="bannerText">Enviando...</span>
			<span class="upload-banner-pct" id="bannerPct">0%</span>
		</div>
		<div class="upload-banner-bar" id="bannerBar" style="width:0%"></div>
	</div>

	<div class="container">
		<div style="display:flex;justify-content:space-between;align-items:center;">
			<h1>Admin - PayOrbe Music</h1>
			<div style="display:flex;gap:16px;align-items:center;">
				<a href="/" style="color:#888;font-size:13px;text-decoration:none;">Voltar ao site</a>
				<a href="/admin/logout" style="color:#dc2626;font-size:13px;text-decoration:none;">Sair</a>
			</div>
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

				<div style="display:flex;gap:12px;margin-bottom:16px;">
					<button class="btn btn-primary" onclick="document.getElementById('folderInput').click()" style="flex:1;">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
						Selecionar Pasta
					</button>
					<button class="btn btn-secondary" onclick="document.getElementById('fileInput').click()" style="flex:1;">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
						Selecionar Arquivos
					</button>
				</div>

				<div class="upload-area" id="uploadArea">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
					<p>Ou arraste uma pasta / arquivos aqui</p>
					<p style="font-size:12px;margin-top:4px;">MP3, MP4, M4A, WAV, FLAC, OGG</p>
				</div>

				<!-- Folder input (webkitdirectory) -->
				<input type="file" id="folderInput" webkitdirectory multiple style="display:none" onchange="handleFolderSelect(this.files)">
				<!-- File input (normal) -->
				<input type="file" id="fileInput" multiple accept="audio/*,.mp3,.mp4,.m4a,.wav,.flac,.ogg" style="display:none" onchange="handleFiles(this.files, '')">

				<div id="uploadSummary" style="display:none;margin-bottom:16px;" class="card">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
						<div>
							<strong id="summaryTitle">Pasta selecionada</strong>
							<p style="font-size:13px;color:#888;" id="summaryInfo"></p>
						</div>
						<button class="btn btn-primary" onclick="startUpload()">Enviar Tudo</button>
					</div>
					<div id="folderPreview" style="max-height:300px;overflow-y:auto;"></div>
				</div>

				<div id="uploadProgress" style="display:none;margin-bottom:16px;">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
						<span style="font-size:14px;font-weight:500;" id="progressText">Enviando...</span>
						<span style="font-size:13px;color:#888;" id="progressCount">0/0</span>
					</div>
					<div class="progress-bar" style="height:6px;">
						<div class="progress-fill" id="uploadProgressFill"></div>
					</div>
				</div>

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

	// Audio file extensions
	const AUDIO_EXT = ['.mp3','.mp4','.m4a','.wav','.flac','.ogg','.aac','.wma','.opus'];
	function isAudioFile(name) {
		return AUDIO_EXT.some(ext => name.toLowerCase().endsWith(ext));
	}

	// Pending files to upload: { file, folder, title }
	let pendingFiles = [];

	// Drag and drop (supports folders)
	const uploadArea = document.getElementById('uploadArea');
	uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
	uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
	uploadArea.addEventListener('drop', async (e) => {
		e.preventDefault();
		uploadArea.classList.remove('dragover');

		const items = e.dataTransfer.items;
		if (items && items.length > 0) {
			const entries = [];
			for (const item of items) {
				const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
				if (entry) entries.push(entry);
			}
			if (entries.length > 0 && entries.some(e => e.isDirectory)) {
				const files = [];
				for (const entry of entries) {
					await readEntryRecursive(entry, '', files);
				}
				preparePending(files);
				return;
			}
		}
		// Fallback: normal files
		handleFiles(e.dataTransfer.files, '');
	});

	// Read directory entries recursively
	function readEntryRecursive(entry, basePath, result) {
		return new Promise((resolve) => {
			if (entry.isFile) {
				entry.file((file) => {
					if (isAudioFile(file.name)) {
						result.push({ file, folder: basePath });
					}
					resolve();
				});
			} else if (entry.isDirectory) {
				const reader = entry.createReader();
				const folderName = basePath ? basePath + ' / ' + entry.name : entry.name;
				reader.readEntries(async (entries) => {
					for (const child of entries) {
						await readEntryRecursive(child, folderName, result);
					}
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	// Handle folder selection via input[webkitdirectory]
	function handleFolderSelect(fileList) {
		if (!document.getElementById('uploadPlaylist').value) {
			alert('Selecione uma playlist primeiro.');
			return;
		}

		const files = [];
		for (const file of fileList) {
			if (!isAudioFile(file.name)) continue;
			// webkitRelativePath = "FolderName/SubFolder/file.mp3"
			const parts = file.webkitRelativePath.split('/');
			// Remove root folder name and file name, keep middle folders
			let folder = '';
			if (parts.length > 2) {
				folder = parts.slice(1, -1).join(' / ');
			} else if (parts.length === 2) {
				folder = parts[0];
			}
			files.push({ file, folder });
		}
		preparePending(files);
	}

	// Handle individual file selection
	function handleFiles(fileList, folder) {
		if (!document.getElementById('uploadPlaylist').value) {
			alert('Selecione uma playlist primeiro.');
			return;
		}

		const files = [];
		for (const file of fileList) {
			if (!isAudioFile(file.name)) continue;
			files.push({ file, folder: folder || '' });
		}
		if (files.length === 0) {
			alert('Nenhum arquivo de audio encontrado.');
			return;
		}
		preparePending(files);
	}

	// Show preview before uploading
	function preparePending(files) {
		pendingFiles = files.map(f => ({
			...f,
			title: f.file.name.replace(/\\.[^.]+$/, '').replace(/^\\d+[\\s._-]+/, '')
		}));

		// Group by folder for preview
		const grouped = {};
		for (const f of pendingFiles) {
			const key = f.folder || '(raiz)';
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(f);
		}

		const totalSize = pendingFiles.reduce((sum, f) => sum + f.file.size, 0);
		const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);

		document.getElementById('summaryTitle').textContent = Object.keys(grouped).length > 1
			? Object.keys(grouped).length + ' pastas encontradas'
			: 'Pasta selecionada';
		document.getElementById('summaryInfo').textContent =
			pendingFiles.length + ' musica' + (pendingFiles.length !== 1 ? 's' : '') + ' - ' + sizeMB + ' MB total';

		let previewHtml = '';
		for (const [folder, items] of Object.entries(grouped)) {
			previewHtml += '<div style="margin-bottom:12px;">';
			previewHtml += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:13px;font-weight:600;color:#555;">';
			previewHtml += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
			previewHtml += folder + ' <span style="font-weight:400;color:#aaa;">(' + items.length + ')</span></div>';
			for (const item of items) {
				const sizeMB = (item.file.size / (1024 * 1024)).toFixed(1);
				previewHtml += '<div style="display:flex;justify-content:space-between;padding:4px 0 4px 20px;font-size:13px;color:#666;border-bottom:1px solid #f5f5f5;">';
				previewHtml += '<span>' + item.title + '</span>';
				previewHtml += '<span style="color:#aaa;">' + sizeMB + ' MB</span>';
				previewHtml += '</div>';
			}
			previewHtml += '</div>';
		}

		document.getElementById('folderPreview').innerHTML = previewHtml;
		document.getElementById('uploadSummary').style.display = 'block';
		document.getElementById('uploadQueue').innerHTML = '';
		document.getElementById('uploadProgress').style.display = 'none';
	}

	// Concurrency limit for parallel uploads
	const MAX_CONCURRENT = 5;

	// Start uploading all pending files (parallel)
	async function startUpload() {
		const playlistId = document.getElementById('uploadPlaylist').value;
		if (!playlistId) { alert('Selecione uma playlist primeiro.'); return; }
		if (pendingFiles.length === 0) return;

		document.getElementById('uploadSummary').style.display = 'none';
		document.getElementById('uploadProgress').style.display = 'block';

		const queue = document.getElementById('uploadQueue');
		queue.innerHTML = '';

		const total = pendingFiles.length;
		let completed = 0;
		let errors = 0;
		let startTime = Date.now();

		// Show banner
		const banner = document.getElementById('uploadBanner');
		banner.className = 'upload-banner active';
		document.getElementById('bannerSpinner').style.display = 'block';

		// Build all items in queue first
		const items = [];
		for (const pending of pendingFiles) {
			const item = document.createElement('div');
			item.className = 'upload-item';
			const folderLabel = pending.folder ? '<span class="file-folder">' + pending.folder + '</span>' : '';
			const sizeMB = (pending.file.size / (1024 * 1024)).toFixed(1);
			item.innerHTML =
				'<div class="status-icon waiting"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg></div>' +
				'<div class="file-info"><span class="file-name">' + pending.title + '</span>' + folderLabel + '</div>' +
				'<span class="file-status">' + sizeMB + ' MB</span>';
			queue.appendChild(item);
			items.push(item);
		}

		function updateProgress() {
			const pct = Math.round((completed / total) * 100);
			document.getElementById('uploadProgressFill').style.width = pct + '%';
			document.getElementById('progressCount').textContent = completed + '/' + total;
			document.getElementById('bannerPct').textContent = pct + '%';
			document.getElementById('bannerBar').style.width = pct + '%';

			const elapsed = (Date.now() - startTime) / 1000;
			const remaining = completed > 0 ? Math.round((elapsed / completed) * (total - completed)) : 0;
			const eta = remaining > 60 ? Math.round(remaining / 60) + 'min' : remaining + 's';

			const activeCount = document.querySelectorAll('.status-icon.uploading').length;
			document.getElementById('bannerText').textContent =
				completed + '/' + total + ' enviadas (' + activeCount + ' em paralelo) - ' + eta + ' restante';
			document.getElementById('progressText').textContent =
				completed + '/' + total + ' enviadas - ~' + eta + ' restante';
		}
		updateProgress();

		// Upload a single file
		async function uploadOne(index) {
			const pending = pendingFiles[index];
			const item = items[index];

			// Mark as uploading
			item.className = 'upload-item uploading';
			item.querySelector('.status-icon').className = 'status-icon uploading';
			item.querySelector('.status-icon').innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;border-color:rgba(0,0,0,0.15);border-top-color:#1a1a1a;"></div>';
			item.querySelector('.file-status').textContent = 'Enviando...';

			try {
				const formData = new FormData();
				formData.append('file', pending.file);
				formData.append('playlist_id', playlistId);
				formData.append('title', pending.title);
				formData.append('artist', 'Desconhecido');
				formData.append('folder', pending.folder);

				const res = await fetch('/api/songs/upload', { method: 'POST', body: formData });
				if (res.ok) {
					item.className = 'upload-item';
					item.querySelector('.status-icon').className = 'status-icon done';
					item.querySelector('.status-icon').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>';
					item.querySelector('.file-status').textContent = 'Enviado';
					item.querySelector('.file-status').style.color = '#22c55e';
				} else {
					const err = await res.json();
					throw new Error(err.error);
				}
			} catch (err) {
				item.className = 'upload-item';
				item.querySelector('.status-icon').className = 'status-icon error';
				item.querySelector('.status-icon').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
				item.querySelector('.file-status').textContent = err.message;
				item.querySelector('.file-status').style.color = '#ef4444';
				errors++;
			}

			completed++;
			updateProgress();
		}

		// Run uploads in parallel with concurrency limit
		let nextIndex = 0;
		async function runWorker() {
			while (nextIndex < total) {
				const idx = nextIndex++;
				await uploadOne(idx);
			}
		}

		const workers = [];
		for (let w = 0; w < Math.min(MAX_CONCURRENT, total); w++) {
			workers.push(runWorker());
		}
		await Promise.all(workers);

		// Final state
		const elapsed = Math.round((Date.now() - startTime) / 1000);
		const elapsedStr = elapsed > 60 ? Math.round(elapsed / 60) + 'min ' + (elapsed % 60) + 's' : elapsed + 's';

		document.getElementById('bannerSpinner').style.display = 'none';
		if (errors > 0) {
			banner.className = 'upload-banner active has-errors';
			document.getElementById('bannerText').textContent = 'Concluido com ' + errors + ' erro(s) de ' + total + ' em ' + elapsedStr;
			document.getElementById('progressText').textContent = 'Concluido com ' + errors + ' erro(s) em ' + elapsedStr;
		} else {
			banner.className = 'upload-banner active done';
			document.getElementById('bannerText').textContent = total + ' musica' + (total !== 1 ? 's' : '') + ' enviada' + (total !== 1 ? 's' : '') + ' em ' + elapsedStr + '!';
			document.getElementById('progressText').textContent = 'Upload concluido em ' + elapsedStr + '!';
		}
		document.getElementById('bannerPct').textContent = '100%';
		document.getElementById('bannerBar').style.width = '100%';

		// Auto-hide banner after 5s on success
		if (errors === 0) {
			setTimeout(() => { banner.className = 'upload-banner'; }, 5000);
		}

		pendingFiles = [];
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
