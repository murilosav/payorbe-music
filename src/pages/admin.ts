export function renderAdminPage(): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Admin - Patacos</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<style>
	* { margin:0; padding:0; box-sizing:border-box; }
	body { font-family:'Inter',-apple-system,sans-serif; background:#fafafa; color:#1a1a1a; -webkit-font-smoothing:antialiased; }
	.container { max-width:800px; margin:0 auto; padding:20px; }

	/* Toast */
	.toast-container { position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
	.toast { padding:12px 20px; border-radius:10px; font-size:13px; font-weight:500; transform:translateX(120%); transition:transform 0.3s ease; box-shadow:0 4px 16px rgba(0,0,0,0.12); max-width:340px; pointer-events:auto; }
	.toast.show { transform:translateX(0); }
	.toast-success { background:#16a34a; color:#fff; }
	.toast-error { background:#dc2626; color:#fff; }
	.toast-info { background:#1a1a1a; color:#fff; }

	/* Header */
	.header { display:flex; justify-content:space-between; align-items:center; padding:24px 0 20px; }
	.header h1 { font-size:22px; font-weight:700; }
	.header-actions { display:flex; gap:16px; align-items:center; }
	.header-actions a { color:#888; font-size:13px; text-decoration:none; }
	.header-actions a:hover { color:#333; }
	.header-actions a.danger { color:#dc2626; }

	/* Card */
	.card { background:#fff; border:1px solid #eee; border-radius:12px; padding:20px; margin-bottom:12px; }

	/* Buttons */
	.btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; transition:all 0.15s; }
	.btn:disabled { opacity:0.5; cursor:not-allowed; }
	.btn-primary { background:#1a1a1a; color:#fff; }
	.btn-primary:hover:not(:disabled) { background:#333; }
	.btn-danger { background:#ef4444; color:#fff; }
	.btn-danger:hover:not(:disabled) { background:#dc2626; }
	.btn-ghost { background:#f0f0f0; color:#333; }
	.btn-ghost:hover:not(:disabled) { background:#e0e0e0; }
	.btn-sm { padding:5px 12px; font-size:12px; }

	/* Forms */
	input[type="text"], select { width:100%; padding:10px 14px; border:1px solid #ddd; border-radius:8px; font-size:14px; font-family:inherit; outline:none; transition:border-color 0.2s; }
	input[type="text"]:focus, select:focus { border-color:#999; }
	.form-group { margin-bottom:12px; }
	.form-group label { display:block; font-size:11px; font-weight:600; color:#999; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px; }
	.form-row { display:flex; gap:12px; }
	.form-row .form-group { flex:1; }

	/* Badges */
	.badge { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; }
	.badge-success { background:#f0fdf4; color:#16a34a; }
	.badge-warning { background:#fffbeb; color:#d97706; }
	.badge-muted { background:#f5f5f5; color:#999; }

	/* Playlist cards (list view) */
	.pl-card { background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; margin-bottom:10px; transition:border-color 0.15s; }
	.pl-card:hover { border-color:#ccc; }
	.pl-card-top { display:flex; align-items:center; gap:14px; }
	.pl-cover { width:52px; height:52px; border-radius:10px; overflow:hidden; background:#f0f0f0; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
	.pl-cover img { width:100%; height:100%; object-fit:cover; }
	.pl-info { flex:1; min-width:0; }
	.pl-name { font-weight:600; font-size:15px; margin-bottom:3px; }
	.pl-stats { font-size:12px; color:#888; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
	.pl-actions { display:flex; gap:6px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end; }

	/* Detail view */
	.back-btn { display:inline-flex; align-items:center; gap:6px; font-size:14px; color:#888; cursor:pointer; background:none; border:none; font-family:inherit; padding:8px 0; margin-bottom:16px; }
	.back-btn:hover { color:#333; }
	.section { margin-bottom:16px; }
	.section-title { font-size:13px; font-weight:600; color:#555; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; text-transform:uppercase; letter-spacing:0.5px; }

	/* Songs */
	.song-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #f5f5f5; font-size:13px; }
	.song-row:last-child { border-bottom:none; }
	.song-row input[type="checkbox"] { width:16px; height:16px; cursor:pointer; flex-shrink:0; accent-color:#1a1a1a; }
	.song-info { flex:1; min-width:0; }
	.song-title { font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
	.song-meta { font-size:11px; color:#aaa; }
	.song-size { font-size:12px; color:#999; flex-shrink:0; }
	.select-all-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:2px solid #eee; font-size:13px; font-weight:500; color:#666; }

	/* Upload */
	.upload-area { border:2px dashed #ddd; border-radius:12px; padding:24px; text-align:center; cursor:default; transition:all 0.2s; color:#888; }
	.upload-area:hover { border-color:#999; color:#555; }
	.upload-area.dragover { border-color:#1a1a1a; background:#f5f5f5; }
	.upload-banner { position:fixed; top:0; left:0; right:0; background:#1a1a1a; color:#fff; z-index:999; padding:0; transition:transform 0.3s; transform:translateY(-100%); }
	.upload-banner.active { transform:translateY(0); }
	.upload-banner-content { max-width:800px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; gap:16px; }
	.upload-banner .spinner { width:20px; height:20px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; }
	@keyframes spin { to { transform:rotate(360deg); } }
	.upload-banner-text { flex:1; font-size:14px; }
	.upload-banner-pct { font-size:14px; font-weight:600; font-variant-numeric:tabular-nums; }
	.upload-banner-bar { position:absolute; bottom:0; left:0; height:3px; background:#4ade80; transition:width 0.3s; }
	.upload-banner.done { background:#16a34a; }
	.upload-banner.has-errors { background:#dc2626; }
	.upload-item { display:flex; align-items:center; gap:10px; padding:8px 12px; font-size:13px; border-bottom:1px solid #f5f5f5; border-radius:6px; transition:background 0.2s; }
	.upload-item.uploading { background:#f8f8f8; }
	.upload-item .status-icon { width:20px; height:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
	.upload-item .status-icon.waiting { color:#ddd; }
	.upload-item .status-icon.uploading { color:#1a1a1a; }
	.upload-item .status-icon.done { color:#22c55e; }
	.upload-item .status-icon.error { color:#ef4444; }
	.upload-item .file-info { flex:1; min-width:0; }
	.upload-item .file-name { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
	.upload-item .file-folder { font-size:11px; color:#aaa; }
	.upload-item .file-status { font-size:12px; color:#888; flex-shrink:0; }
	/* Pagination */
	.pagination { display:flex; align-items:center; justify-content:center; gap:8px; padding:16px 0 4px; font-size:13px; }
	.pagination button { padding:6px 14px; border:1px solid #ddd; background:#fff; border-radius:6px; font-size:12px; cursor:pointer; font-family:inherit; transition:all 0.15s; }
	.pagination button:hover:not(:disabled) { border-color:#999; }
	.pagination button:disabled { opacity:0.4; cursor:not-allowed; }
	.pagination span { color:#888; }

	.progress-bar { width:100%; height:4px; background:#eee; border-radius:2px; overflow:hidden; }
	.progress-fill { height:100%; background:#1a1a1a; width:0%; transition:width 0.3s; }
	</style>
</head>
<body>
	<div class="toast-container" id="toastContainer"></div>

	<div class="upload-banner" id="uploadBanner">
		<div class="upload-banner-content">
			<div class="spinner" id="bannerSpinner"></div>
			<span class="upload-banner-text" id="bannerText">Enviando...</span>
			<span class="upload-banner-pct" id="bannerPct">0%</span>
		</div>
		<div class="upload-banner-bar" id="bannerBar" style="width:0%"></div>
	</div>

	<div class="container">
		<div class="header">
			<h1>Patacos Admin</h1>
			<div class="header-actions">
				<a href="/admin/logout" class="danger">Sair</a>
			</div>
		</div>

		<!-- ==================== LIST VIEW ==================== -->
		<div id="listView">
			<!-- Create Folder Form -->
			<div class="card" id="createFolderForm" style="display:none;">
				<div style="font-weight:600;margin-bottom:12px;">Nova Pasta</div>
				<div class="form-row">
					<div class="form-group"><label>Nome</label><input type="text" id="folderName" placeholder="Ex: Pacote Rock"></div>
					<div class="form-group"><label>Slug (URL)</label><input type="text" id="folderSlug" placeholder="Ex: pacote-rock"></div>
				</div>
				<div class="form-group"><label>Descri\u00e7\u00e3o</label><input type="text" id="folderDesc" placeholder="Descri\u00e7\u00e3o da pasta"></div>
				<div style="display:flex;gap:8px;">
					<button class="btn btn-primary" onclick="createFolder()">Criar Pasta</button>
					<button class="btn btn-ghost" onclick="toggleCreateFolderForm()">Cancelar</button>
				</div>
			</div>

			<!-- Create Playlist Form -->
			<div class="card" id="createForm" style="display:none;">
				<div style="font-weight:600;margin-bottom:12px;">Nova Playlist</div>
				<div class="form-row">
					<div class="form-group"><label>Nome</label><input type="text" id="playlistName" placeholder="Ex: Gospel Hits 2026"></div>
					<div class="form-group"><label>Slug (URL)</label><input type="text" id="playlistSlug" placeholder="Ex: gospel-hits"></div>
				</div>
				<div class="form-group"><label>Descri\u00e7\u00e3o</label><input type="text" id="playlistDesc" placeholder="Descri\u00e7\u00e3o da playlist"></div>
				<div style="display:flex;gap:8px;">
					<button class="btn btn-primary" onclick="createPlaylist()">Criar Playlist</button>
					<button class="btn btn-ghost" onclick="toggleCreateForm()">Cancelar</button>
				</div>
			</div>

			<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
				<span style="font-size:14px;color:#888;" id="playlistCount"></span>
				<div style="display:flex;gap:8px;">
					<button class="btn btn-ghost" onclick="toggleCreateFolderForm()" id="createFolderToggleBtn">+ Nova Pasta</button>
					<button class="btn btn-primary" onclick="toggleCreateForm()" id="createToggleBtn">+ Nova Playlist</button>
				</div>
			</div>

			<div id="playlistsList"></div>
		</div>

		<!-- ==================== DETAIL VIEW ==================== -->
		<div id="detailView" style="display:none;">
			<button class="back-btn" onclick="closeDetail()">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
				Voltar
			</button>

			<!-- Info -->
			<div class="card section">
				<div class="section-title">
					<span>Informa\u00e7\u00f5es</span>
					<button class="btn btn-primary btn-sm" onclick="savePlaylist()" id="saveBtn" style="display:none;">Salvar</button>
				</div>
				<div style="display:flex;gap:16px;align-items:flex-start;">
					<div class="pl-cover" id="detailCover" style="width:64px;height:64px;cursor:pointer;" onclick="document.getElementById('detailCoverInput').click()" title="Alterar capa">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
					</div>
					<input type="file" id="detailCoverInput" accept="image/*" style="display:none;" onchange="uploadDetailCover(this.files[0])">
					<div style="flex:1;">
						<div class="form-row">
							<div class="form-group"><label>Nome</label><input type="text" id="detailName" oninput="onDetailChange()"></div>
							<div class="form-group"><label>Slug</label><input type="text" id="detailSlug" disabled style="background:#f8f8f8;color:#888;"></div>
						</div>
						<div class="form-row">
							<div class="form-group" style="flex:2;"><label>Descri\u00e7\u00e3o</label><input type="text" id="detailDesc" oninput="onDetailChange()"></div>
							<div class="form-group" style="flex:1;"><label>Pasta</label><select id="detailFolder" onchange="movePlaylistToFolder()"><option value="">Sem pasta</option></select></div>
						</div>
					</div>
				</div>
				<div style="display:flex;align-items:center;gap:6px;margin-top:12px;">
					<input type="text" id="detailLink" readonly onclick="this.select()" style="flex:1;font-size:11px;padding:6px 10px;background:#f8f8f8;border:1px solid #eee;color:#666;cursor:text;">
					<button class="btn btn-ghost btn-sm" onclick="copyDetailLink()">Copiar</button>
					<a id="detailOpenLink" href="#" target="_blank" class="btn btn-ghost btn-sm" style="text-decoration:none;">Abrir</a>
				</div>
			</div>

			<!-- ZIP -->
			<div class="card section">
				<div class="section-title">
					<span>Download ZIP</span>
					<div style="display:flex;gap:8px;align-items:center;">
						<span id="zipBadge"></span>
						<button class="btn btn-primary btn-sm" onclick="regenerateDetailZip()" id="zipBtn">Gerar ZIP</button>
					</div>
				</div>
				<div id="zipInfo" style="font-size:13px;color:#888;"></div>
				<div id="zipProgress" style="display:none;">
					<div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
						<div class="spinner" style="width:14px;height:14px;border:2px solid rgba(0,0,0,0.1);border-top-color:#1a1a1a;border-radius:50;animation:spin 0.8s linear infinite;"></div>
						<span id="zipStatus" style="font-size:12px;color:#666;">Preparando...</span>
					</div>
					<div class="progress-bar" style="height:4px;margin-top:6px;"><div class="progress-fill" id="zipBar"></div></div>
				</div>
			</div>

			<!-- Upload -->
			<div class="card section">
				<div class="section-title"><span>Upload de M\u00fasicas</span></div>
				<div style="display:flex;gap:8px;margin-bottom:12px;">
					<button class="btn btn-primary" onclick="document.getElementById('folderInput').click()" style="flex:1;">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
						Selecionar Pasta
					</button>
					<button class="btn btn-ghost" onclick="document.getElementById('fileInput').click()" style="flex:1;">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
						Selecionar Arquivos
					</button>
				</div>
				<input type="file" id="folderInput" webkitdirectory multiple style="display:none" onchange="handleFolderSelect(this.files)">
				<input type="file" id="fileInput" multiple accept="audio/*,.mp3,.mp4,.m4a,.wav,.flac,.ogg" style="display:none" onchange="handleFilesFromInput(this.files)">
				<div id="folderSelectBox" style="display:none;margin-bottom:12px;">
					<div class="form-group" style="margin:0;">
						<label>Pasta destino</label>
						<select id="targetFolder">
							<option value="">Selecione uma pasta</option>
						</select>
					</div>
				</div>
				<div class="upload-area" id="uploadArea">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
					<p style="font-size:13px;">Arraste pasta ou arquivos aqui</p>
					<p style="font-size:11px;margin-top:2px;color:#bbb;">MP3, MP4, M4A, WAV, FLAC, OGG</p>
				</div>
				<div id="uploadSummary" style="display:none;margin-top:12px;" class="card">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
						<div>
							<strong id="summaryTitle"></strong>
							<p style="font-size:13px;color:#888;" id="summaryInfo"></p>
						</div>
						<button class="btn btn-primary" onclick="startUpload()">Enviar Tudo</button>
					</div>
					<div id="folderPreview" style="max-height:300px;overflow-y:auto;"></div>
				</div>
				<div id="uploadProgress" style="display:none;margin-top:12px;">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
						<span style="font-size:14px;font-weight:500;" id="progressText">Enviando...</span>
						<span style="font-size:13px;color:#888;" id="progressCount">0/0</span>
					</div>
					<div class="progress-bar" style="height:6px;"><div class="progress-fill" id="uploadProgressFill"></div></div>
				</div>
				<div id="uploadQueue" style="margin-top:8px;"></div>
			</div>

			<!-- Songs -->
			<div class="card section">
				<div class="section-title">
					<span id="songsTitle">M\u00fasicas</span>
					<div style="display:flex;gap:8px;align-items:center;">
						<button class="btn btn-danger btn-sm" id="bulkDeleteBtn" style="display:none;" onclick="bulkDeleteSongs()">Excluir selecionadas</button>
					</div>
				</div>
				<div id="songsList"></div>
			</div>
		</div>
	</div>

	<script>
	// ===== State =====
	let playlistsCache = [];
	let zipsCache = [];
	let foldersCache = [];
	let currentPlaylist = null;
	let currentZips = [];
	let currentSongs = [];
	let currentFolders = [];
	let songsPage = 1;
	var SONGS_PER_PAGE = 50;
	let pendingFiles = [];

	// ===== Toast =====
	function toast(msg, type) {
		const c = document.getElementById('toastContainer');
		const el = document.createElement('div');
		el.className = 'toast toast-' + (type || 'success');
		el.textContent = msg;
		c.appendChild(el);
		requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
		setTimeout(() => {
			el.classList.remove('show');
			setTimeout(() => el.remove(), 300);
		}, 3000);
	}

	// ===== View Management =====
	function toggleCreateFolderForm() {
		var form = document.getElementById('createFolderForm');
		var btn = document.getElementById('createFolderToggleBtn');
		if (form.style.display === 'none') {
			form.style.display = 'block';
			btn.style.display = 'none';
			document.getElementById('folderName').focus();
		} else {
			form.style.display = 'none';
			btn.style.display = 'inline-flex';
		}
	}

	function toggleCreateForm() {
		const form = document.getElementById('createForm');
		const btn = document.getElementById('createToggleBtn');
		if (form.style.display === 'none') {
			form.style.display = 'block';
			btn.style.display = 'none';
			document.getElementById('playlistName').focus();
		} else {
			form.style.display = 'none';
			btn.style.display = 'inline-flex';
		}
	}

	function openDetail(idx) {
		const playlist = playlistsCache[idx];
		const zips = zipsCache[idx] || [];
		currentPlaylist = playlist;
		currentZips = zips;

		document.getElementById('listView').style.display = 'none';
		document.getElementById('detailView').style.display = 'block';

		// Fill info
		document.getElementById('detailName').value = playlist.name;
		document.getElementById('detailSlug').value = playlist.slug;
		document.getElementById('detailDesc').value = playlist.description || '';

		const link = location.origin + '/' + playlist.slug + '?token=' + (playlist.access_token || '');
		document.getElementById('detailLink').value = link;
		document.getElementById('detailOpenLink').href = link;

		// Cover
		const coverEl = document.getElementById('detailCover');
		if (playlist.cover_r2_key) {
			coverEl.innerHTML = '<img src="/api/playlists/' + playlist.id + '/cover-preview" style="width:100%;height:100%;object-fit:cover;">';
		} else {
			coverEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
		}

		document.getElementById('saveBtn').style.display = 'none';

		// Fill folder dropdown
		var folderSel = document.getElementById('detailFolder');
		folderSel.innerHTML = '<option value="">Sem pasta</option>' +
			foldersCache.map(function(f) {
				return '<option value="' + f.id + '"' + (playlist.folder_id === f.id ? ' selected' : '') + '>' + f.name + '</option>';
			}).join('');

		// Reset upload
		pendingFiles = [];
		document.getElementById('uploadSummary').style.display = 'none';
		document.getElementById('uploadProgress').style.display = 'none';
		document.getElementById('uploadQueue').innerHTML = '';

		loadDetailSongs();
		updateZipStatus();
		window.scrollTo(0, 0);
	}

	function closeDetail() {
		currentPlaylist = null;
		currentZips = [];
		document.getElementById('detailView').style.display = 'none';
		document.getElementById('listView').style.display = 'block';
		loadPlaylists();
	}

	function onDetailChange() {
		document.getElementById('saveBtn').style.display = 'inline-flex';
	}

	// ===== Playlist List =====
	function renderPlaylistCard(p, idx) {
		var zips = zipsCache[idx] || [];
		var songCount = p.song_count || 0;
		var totalSizeMB = ((p.total_size || 0) / (1024 * 1024)).toFixed(0);
		var totalZipSize = zips.reduce(function(s, z) { return s + (z.file_size || 0); }, 0);
		var zipSizeMB = (totalZipSize / (1024 * 1024)).toFixed(0);
		var zipSongCount = zips.reduce(function(s, z) { return s + (z.song_count || 0); }, 0);

		var zipBadge = '';
		if (songCount === 0) zipBadge = '<span class="badge badge-muted">Vazia</span>';
		else if (zips.length === 0) zipBadge = '<span class="badge badge-muted">Sem ZIP</span>';
		else if (zipSongCount < songCount) zipBadge = '<span class="badge badge-warning">ZIP desatualizado</span>';
		else zipBadge = '<span class="badge badge-success">ZIP ' + zipSizeMB + ' MB</span>';

		var hasCover = !!p.cover_r2_key;
		var coverHtml = hasCover
			? '<img src="/api/playlists/' + p.id + '/cover-preview" style="width:100%;height:100%;object-fit:cover;">'
			: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

		return '<div class="pl-card" style="margin-left:0;">' +
			'<div class="pl-card-top">' +
				'<div class="pl-cover">' + coverHtml + '</div>' +
				'<div class="pl-info">' +
					'<div class="pl-name">' + p.name + '</div>' +
					'<div class="pl-stats">' +
						'<span>' + songCount + ' m\u00fasica' + (songCount !== 1 ? 's' : '') + '</span>' +
						'<span>&middot;</span><span>' + totalSizeMB + ' MB</span>' +
						'<span>&middot;</span>' + zipBadge +
					'</div>' +
				'</div>' +
				'<div class="pl-actions">' +
					'<button class="btn btn-primary btn-sm" onclick="openDetail('+idx+')">Gerenciar</button>' +
					'<button class="btn btn-danger btn-sm" onclick="deletePlaylist('+p.id+', \\''+p.name.replace(/'/g, "\\\\'")+'\\')">Excluir</button>' +
				'</div>' +
			'</div>' +
		'</div>';
	}

	async function loadPlaylists() {
		var [plRes, flRes] = await Promise.all([
			fetch('/api/playlists'),
			fetch('/api/folders')
		]);
		playlistsCache = await plRes.json();
		foldersCache = await flRes.json();

		// Fetch ZIP status for all playlists in parallel
		zipsCache = await Promise.all(playlistsCache.map(function(p) {
			return fetch('/api/playlists/' + p.id + '/zips').then(function(r) { return r.json(); }).catch(function() { return []; });
		}));

		var totalItems = playlistsCache.length + foldersCache.length;
		document.getElementById('playlistCount').textContent = foldersCache.length + ' pasta' + (foldersCache.length !== 1 ? 's' : '') + ' \u00b7 ' + playlistsCache.length + ' playlist' + (playlistsCache.length !== 1 ? 's' : '');

		var container = document.getElementById('playlistsList');
		var html = '';

		// Render folders with their playlists
		for (var fi = 0; fi < foldersCache.length; fi++) {
			var folder = foldersCache[fi];
			var folderLink = location.origin + '/' + folder.slug + '?token=' + (folder.access_token || '');
			var folderPlaylists = [];
			for (var pi = 0; pi < playlistsCache.length; pi++) {
				if (playlistsCache[pi].folder_id === folder.id) folderPlaylists.push(pi);
			}

			html += '<div style="margin-bottom:16px;">' +
				'<div class="pl-card" style="background:#f8f8ff;border-color:#e0e0f0;">' +
					'<div class="pl-card-top">' +
						'<div style="font-size:24px;width:52px;text-align:center;">\ud83d\udcc1</div>' +
						'<div class="pl-info">' +
							'<div class="pl-name">' + folder.name + '</div>' +
							'<div class="pl-stats">' +
								'<span>' + folderPlaylists.length + ' playlist' + (folderPlaylists.length !== 1 ? 's' : '') + '</span>' +
								(folder.description ? '<span>&middot;</span><span>' + folder.description + '</span>' : '') +
							'</div>' +
						'</div>' +
						'<div class="pl-actions">' +
							'<button class="btn btn-ghost btn-sm" onclick="copyLink(\\''+folderLink+'\\')">Link da Pasta</button>' +
							'<button class="btn btn-danger btn-sm" onclick="deleteFolder('+folder.id+', \\''+folder.name.replace(/'/g, "\\\\'")+'\\')">Excluir</button>' +
						'</div>' +
					'</div>' +
				'</div>';

			// Playlists inside this folder (indented)
			for (var fpi = 0; fpi < folderPlaylists.length; fpi++) {
				var pIdx = folderPlaylists[fpi];
				html += '<div style="margin-left:32px;">' + renderPlaylistCard(playlistsCache[pIdx], pIdx) + '</div>';
			}

			if (folderPlaylists.length === 0) {
				html += '<div style="margin-left:32px;padding:12px 16px;color:#aaa;font-size:13px;font-style:italic;">Nenhuma playlist nesta pasta. Arraste playlists para c\u00e1 via "Gerenciar".</div>';
			}

			html += '</div>';
		}

		// Standalone playlists (not in any folder)
		var standalone = [];
		for (var pi = 0; pi < playlistsCache.length; pi++) {
			if (!playlistsCache[pi].folder_id) standalone.push(pi);
		}

		if (standalone.length > 0) {
			if (foldersCache.length > 0) {
				html += '<div style="font-size:12px;font-weight:600;color:#aaa;padding:12px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Sem pasta</div>';
			}
			for (var si = 0; si < standalone.length; si++) {
				html += renderPlaylistCard(playlistsCache[standalone[si]], standalone[si]);
			}
		}

		if (playlistsCache.length === 0 && foldersCache.length === 0) {
			html = '<div style="text-align:center;padding:48px;color:#aaa;font-size:14px;">Nenhuma pasta ou playlist criada ainda.</div>';
		}

		container.innerHTML = html;
	}

	// ===== Playlist CRUD =====
	async function createPlaylist() {
		var name = document.getElementById('playlistName').value.trim();
		var slug = document.getElementById('playlistSlug').value.trim();
		var desc = document.getElementById('playlistDesc').value.trim();

		if (!name || !slug) { toast('Nome e slug s\u00e3o obrigat\u00f3rios.', 'error'); return; }

		var res = await fetch('/api/playlists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: name, slug: slug, description: desc })
		});

		if (res.ok) {
			toast('Playlist criada com sucesso!');
			document.getElementById('playlistName').value = '';
			document.getElementById('playlistSlug').value = '';
			document.getElementById('playlistDesc').value = '';
			toggleCreateForm();
			loadPlaylists();
		} else {
			var err = await res.json();
			toast(err.error || 'Erro ao criar playlist.', 'error');
		}
	}

	async function savePlaylist() {
		if (!currentPlaylist) return;
		var name = document.getElementById('detailName').value.trim();
		var desc = document.getElementById('detailDesc').value.trim();

		if (!name) { toast('Nome n\u00e3o pode ser vazio.', 'error'); return; }

		var res = await fetch('/api/playlists/' + currentPlaylist.id, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: name, description: desc })
		});

		if (res.ok) {
			var updated = await res.json();
			currentPlaylist.name = updated.name;
			currentPlaylist.description = updated.description;
			document.getElementById('saveBtn').style.display = 'none';
			toast('Playlist atualizada!');
		} else {
			toast('Erro ao salvar.', 'error');
		}
	}

	async function deletePlaylist(id, name) {
		if (!confirm('Excluir "' + name + '" e todas as suas m\u00fasicas?')) return;
		await fetch('/api/playlists/' + id, { method: 'DELETE' });
		toast('Playlist exclu\u00edda.');
		loadPlaylists();
	}

	async function uploadDetailCover(file) {
		if (!file || !currentPlaylist) return;
		var fd = new FormData();
		fd.append('file', file);
		var res = await fetch('/api/playlists/' + currentPlaylist.id + '/cover', { method: 'POST', body: fd });
		if (res.ok) {
			currentPlaylist.cover_r2_key = 'updated';
			document.getElementById('detailCover').innerHTML = '<img src="/api/playlists/' + currentPlaylist.id + '/cover-preview?' + Date.now() + '" style="width:100%;height:100%;object-fit:cover;">';
			toast('Capa atualizada!');
		} else {
			toast('Erro ao enviar capa.', 'error');
		}
	}

	function copyLink(link) {
		navigator.clipboard.writeText(link).then(function() {
			toast('Link copiado!', 'info');
		}).catch(function() {
			prompt('Copie o link:', link);
		});
	}

	function copyDetailLink() {
		var link = document.getElementById('detailLink').value;
		copyLink(link);
	}

	// Auto-generate slug from name
	document.getElementById('playlistName').addEventListener('input', function(e) {
		var slug = e.target.value.toLowerCase()
			.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
		document.getElementById('playlistSlug').value = slug;
	});

	// Auto-generate folder slug from folder name
	document.getElementById('folderName').addEventListener('input', function(e) {
		var slug = e.target.value.toLowerCase()
			.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
		document.getElementById('folderSlug').value = slug;
	});

	// ===== Folders =====
	async function createFolder() {
		var name = document.getElementById('folderName').value.trim();
		var slug = document.getElementById('folderSlug').value.trim();
		var desc = document.getElementById('folderDesc') ? document.getElementById('folderDesc').value.trim() : '';
		if (!name || !slug) { showToast('Preencha nome e slug', 'error'); return; }
		try {
			var res = await fetch('/api/folders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name, slug: slug, description: desc })
			});
			var data = await res.json();
			if (!res.ok) { showToast(data.error || 'Erro ao criar pasta', 'error'); return; }
			showToast('Pasta criada!');
			document.getElementById('folderName').value = '';
			document.getElementById('folderSlug').value = '';
			if (document.getElementById('folderDesc')) document.getElementById('folderDesc').value = '';
			toggleCreateFolderForm();
			loadPlaylists();
		} catch (e) { showToast('Erro: ' + e.message, 'error'); }
	}

	async function deleteFolder(id, name) {
		if (!confirm('Excluir pasta "' + name + '"? As playlists dentro dela ficar\u00e3o sem pasta.')) return;
		try {
			var res = await fetch('/api/folders/' + id, { method: 'DELETE' });
			if (!res.ok) { var d = await res.json(); showToast(d.error || 'Erro ao excluir', 'error'); return; }
			showToast('Pasta exclu\u00edda!');
			loadPlaylists();
		} catch (e) { showToast('Erro: ' + e.message, 'error'); }
	}

	async function movePlaylistToFolder() {
		if (!currentPlaylist) return;
		var sel = document.getElementById('detailFolder');
		var folderId = sel.value ? parseInt(sel.value) : null;
		try {
			var res = await fetch('/api/playlists/' + currentPlaylist.id + '/folder', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folder_id: folderId })
			});
			if (!res.ok) { showToast('Erro ao mover playlist', 'error'); return; }
			currentPlaylist.folder_id = folderId;
			showToast(folderId ? 'Playlist movida para pasta!' : 'Playlist removida da pasta!');
			loadPlaylists();
		} catch (e) { showToast('Erro: ' + e.message, 'error'); }
	}

	// ===== Songs =====
	async function loadDetailSongs() {
		if (!currentPlaylist) return;
		var res = await fetch('/api/playlists/' + currentPlaylist.slug + '/songs');
		currentSongs = await res.json();

		// Extract unique folders
		var folderSet = {};
		for (var i = 0; i < currentSongs.length; i++) {
			if (currentSongs[i].folder) folderSet[currentSongs[i].folder] = true;
		}
		currentFolders = Object.keys(folderSet).sort();

		// Update folder dropdown for file uploads
		updateFolderDropdown();

		songsPage = 1;
		renderSongsPage();
	}

	function updateFolderDropdown() {
		var box = document.getElementById('folderSelectBox');
		var sel = document.getElementById('targetFolder');
		if (currentFolders.length > 0) {
			box.style.display = 'block';
			sel.innerHTML = '<option value="">Selecione uma pasta</option>' +
				currentFolders.map(function(f) { return '<option value="' + f + '">' + f + '</option>'; }).join('');
		} else {
			box.style.display = 'none';
		}
	}

	function renderSongsPage() {
		var songs = currentSongs;
		document.getElementById('songsTitle').textContent = 'M\u00fasicas (' + songs.length + ')';

		if (songs.length === 0) {
			document.getElementById('songsList').innerHTML = '<div style="text-align:center;padding:24px;color:#aaa;font-size:13px;">Nenhuma m\u00fasica ainda. Use o upload acima.</div>';
			document.getElementById('bulkDeleteBtn').style.display = 'none';
			return;
		}

		var totalPages = Math.ceil(songs.length / SONGS_PER_PAGE);
		if (songsPage > totalPages) songsPage = totalPages;
		var start = (songsPage - 1) * SONGS_PER_PAGE;
		var end = Math.min(start + SONGS_PER_PAGE, songs.length);
		var pageSongs = songs.slice(start, end);

		var html = '<div class="select-all-row">' +
			'<input type="checkbox" id="selectAll" onchange="toggleSelectAll()">' +
			'<label for="selectAll" style="cursor:pointer;">Selecionar todas da p\u00e1gina</label>' +
			'</div>';

		// Group page songs by folder
		var grouped = {};
		for (var i = 0; i < pageSongs.length; i++) {
			var f = pageSongs[i].folder || '';
			if (!grouped[f]) grouped[f] = [];
			grouped[f].push(pageSongs[i]);
		}

		var folders = Object.keys(grouped).sort();
		for (var fi = 0; fi < folders.length; fi++) {
			var folder = folders[fi];
			var items = grouped[folder];
			if (folder) {
				html += '<div style="font-size:12px;font-weight:600;color:#888;padding:10px 0 4px;display:flex;align-items:center;gap:6px;">' +
					'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
					folder + ' (' + items.length + ')' +
					'</div>';
			}
			for (var si = 0; si < items.length; si++) {
				var s = items[si];
				var sizeMB = (s.file_size / (1024 * 1024)).toFixed(1);
				html += '<div class="song-row">' +
					'<input type="checkbox" class="song-check" value="' + s.id + '" onchange="updateBulkBtn()">' +
					'<div class="song-info">' +
						'<div class="song-title">' + s.title + '</div>' +
						'<div class="song-meta">' + s.artist + (s.album ? ' - ' + s.album : '') + '</div>' +
					'</div>' +
					'<span class="song-size">' + sizeMB + ' MB</span>' +
				'</div>';
			}
		}

		// Pagination controls
		if (totalPages > 1) {
			html += '<div class="pagination">' +
				'<button onclick="goSongsPage(' + (songsPage - 1) + ')"' + (songsPage <= 1 ? ' disabled' : '') + '>Anterior</button>' +
				'<span>P\u00e1gina ' + songsPage + ' de ' + totalPages + ' (' + songs.length + ' m\u00fasicas)</span>' +
				'<button onclick="goSongsPage(' + (songsPage + 1) + ')"' + (songsPage >= totalPages ? ' disabled' : '') + '>Pr\u00f3xima</button>' +
			'</div>';
		}

		document.getElementById('songsList').innerHTML = html;
		document.getElementById('bulkDeleteBtn').style.display = 'none';
	}

	function goSongsPage(page) {
		songsPage = page;
		renderSongsPage();
		// Scroll to songs section
		document.getElementById('songsTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function toggleSelectAll() {
		var checked = document.getElementById('selectAll').checked;
		var boxes = document.querySelectorAll('.song-check');
		for (var i = 0; i < boxes.length; i++) boxes[i].checked = checked;
		updateBulkBtn();
	}

	function updateBulkBtn() {
		var ids = getSelectedSongIds();
		var btn = document.getElementById('bulkDeleteBtn');
		if (ids.length > 0) {
			btn.style.display = 'inline-flex';
			btn.textContent = 'Excluir ' + ids.length + ' selecionada' + (ids.length !== 1 ? 's' : '');
		} else {
			btn.style.display = 'none';
		}
	}

	function getSelectedSongIds() {
		var boxes = document.querySelectorAll('.song-check:checked');
		var ids = [];
		for (var i = 0; i < boxes.length; i++) ids.push(parseInt(boxes[i].value));
		return ids;
	}

	async function bulkDeleteSongs() {
		var ids = getSelectedSongIds();
		if (ids.length === 0) return;
		if (!confirm('Excluir ' + ids.length + ' m\u00fasica' + (ids.length !== 1 ? 's' : '') + '?')) return;

		var res = await fetch('/api/songs/bulk-delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids: ids })
		});

		if (res.ok) {
			toast(ids.length + ' m\u00fasica' + (ids.length !== 1 ? 's' : '') + ' exclu\u00edda' + (ids.length !== 1 ? 's' : '') + '.');
			loadDetailSongs();
			loadDetailZips();
		} else {
			toast('Erro ao excluir.', 'error');
		}
	}

	// ===== ZIP Status =====
	async function loadDetailZips() {
		if (!currentPlaylist) return;
		var res = await fetch('/api/playlists/' + currentPlaylist.id + '/zips');
		currentZips = await res.json();
		updateZipStatus();
	}

	function updateZipStatus() {
		var zips = currentZips;
		var songCount = currentPlaylist.song_count || 0;
		var totalZipSize = zips.reduce(function(s, z) { return s + (z.file_size || 0); }, 0);
		var zipSizeMB = (totalZipSize / (1024 * 1024)).toFixed(0);
		var zipSongCount = zips.reduce(function(s, z) { return s + (z.song_count || 0); }, 0);

		var badgeEl = document.getElementById('zipBadge');
		var infoEl = document.getElementById('zipInfo');
		var btn = document.getElementById('zipBtn');

		if (songCount === 0) {
			badgeEl.innerHTML = '<span class="badge badge-muted">Sem m\u00fasicas</span>';
			infoEl.textContent = 'Adicione m\u00fasicas primeiro.';
			btn.textContent = 'Gerar ZIP';
			btn.disabled = true;
		} else if (zips.length === 0) {
			badgeEl.innerHTML = '<span class="badge badge-muted">N\u00e3o gerado</span>';
			infoEl.textContent = songCount + ' m\u00fasica' + (songCount !== 1 ? 's' : '') + ' sem ZIP.';
			btn.textContent = 'Gerar ZIP';
			btn.disabled = false;
		} else if (zipSongCount < songCount) {
			var diff = songCount - zipSongCount;
			badgeEl.innerHTML = '<span class="badge badge-warning">Desatualizado</span>';
			infoEl.textContent = 'ZIP tem ' + zipSongCount + ' m\u00fasicas, mas a playlist tem ' + songCount + '. ' + diff + ' m\u00fasica' + (diff !== 1 ? 's' : '') + ' adicionada' + (diff !== 1 ? 's' : '') + ' desde o \u00faltimo ZIP.';
			btn.textContent = 'Regerar ZIP';
			btn.disabled = false;
		} else {
			badgeEl.innerHTML = '<span class="badge badge-success">Pronto</span>';
			infoEl.textContent = 'ZIP com ' + zipSongCount + ' m\u00fasicas (' + zipSizeMB + ' MB). Pronto para download.';
			btn.textContent = 'Regerar ZIP';
			btn.disabled = false;
		}
	}

	async function regenerateDetailZip() {
		if (!currentPlaylist) return;
		var playlistId = currentPlaylist.id;
		var slug = currentPlaylist.slug;
		var btn = document.getElementById('zipBtn');
		var progress = document.getElementById('zipProgress');
		var status = document.getElementById('zipStatus');
		var bar = document.getElementById('zipBar');

		btn.disabled = true;
		btn.textContent = 'Gerando...';
		progress.style.display = 'block';
		status.textContent = 'Buscando m\u00fasicas...';

		try {
			var songsRes = await fetchRetry('/api/playlists/' + slug + '/songs', {}, 3);
			var songs = await songsRes.json();
			if (songs.length === 0) { status.textContent = 'Nenhuma m\u00fasica.'; btn.disabled = false; return; }

			await fetch('/api/playlists/' + playlistId + '/zips', { method: 'DELETE' });

			var grouped = {};
			for (var i = 0; i < songs.length; i++) {
				var f = songs[i].folder || '';
				if (!grouped[f]) grouped[f] = [];
				grouped[f].push(songs[i]);
			}

			var folders = Object.keys(grouped);
			var totalDone = 0;

			for (var fi = 0; fi < folders.length; fi++) {
				var folder = folders[fi];
				var folderSongs = grouped[folder];
				var entries = [];

				var PARALLEL_DL = 8;
				var dlIdx = 0;
				async function dlWorker() {
					while (dlIdx < folderSongs.length) {
						var i = dlIdx++;
						var s = folderSongs[i];
						var ext = (s.r2_key || '').split('.').pop() || 'mp3';
						var zipName = (s.artist || 'Desconhecido') + ' - ' + s.title + '.' + ext;
						var nameBytes = new TextEncoder().encode(zipName);

						status.textContent = 'Baixando' + (folder ? ' (' + folder + ')' : '') + '... ' + (i + 1) + '/' + folderSongs.length;
						var pct = Math.round(((totalDone + i) / songs.length) * 60);
						bar.style.width = pct + '%';

						var fileRes = await fetchRetry('/api/songs/' + s.id + '/file', {}, 3);
						var blob = await fileRes.blob();
						var crc = await fileCrc32(blob);

						entries.push({ nameBytes: nameBytes, crc: crc, fileSize: blob.size, file: blob });
					}
				}

				var workers = [];
				for (var w = 0; w < Math.min(PARALLEL_DL, folderSongs.length); w++) workers.push(dlWorker());
				await Promise.all(workers);
				totalDone += folderSongs.length;

				status.textContent = 'Montando ZIP' + (folder ? ' (' + folder + ')' : '') + '...';
				bar.style.width = '70%';
				var zipBlob = buildZipBlob(entries);

				var sizeMB = (zipBlob.size / (1024 * 1024)).toFixed(0);
				status.textContent = 'Enviando ZIP' + (folder ? ' (' + folder + ')' : '') + ' (' + sizeMB + ' MB)...';
				await uploadZipToR2(playlistId, folder, 1, 1, zipBlob, entries.length, function(done, total) {
					var pct = 70 + Math.round((done / total) * 30);
					bar.style.width = pct + '%';
					status.textContent = 'Enviando ZIP' + (folder ? ' (' + folder + ')' : '') + ' ' + Math.round((done / total) * 100) + '%';
				});
			}

			if (folders.length > 1) {
				status.textContent = 'Gerando ZIP completo...';
				var allEntries = [];
				var dlIdx2 = 0;
				async function dlAllWorker() {
					while (dlIdx2 < songs.length) {
						var i = dlIdx2++;
						var s = songs[i];
						var ext = (s.r2_key || '').split('.').pop() || 'mp3';
						var zipName = (s.folder ? s.folder + '/' : '') + (s.artist || 'Desconhecido') + ' - ' + s.title + '.' + ext;
						var nameBytes = new TextEncoder().encode(zipName);

						var fileRes = await fetchRetry('/api/songs/' + s.id + '/file', {}, 3);
						var blob = await fileRes.blob();
						var crc = await fileCrc32(blob);

						allEntries[i] = { nameBytes: nameBytes, crc: crc, fileSize: blob.size, file: blob };
					}
				}
				var workers2 = [];
				for (var w = 0; w < Math.min(3, songs.length); w++) workers2.push(dlAllWorker());
				await Promise.all(workers2);

				var zipBlob2 = buildZipBlob(allEntries.filter(Boolean));
				var sizeMB2 = (zipBlob2.size / (1024 * 1024)).toFixed(0);
				status.textContent = 'Enviando ZIP completo (' + sizeMB2 + ' MB)...';
				await uploadZipToR2(playlistId, '', 1, 1, zipBlob2, allEntries.length, function(done, total) {
					status.textContent = 'Enviando ZIP completo ' + Math.round((done / total) * 100) + '%';
				});
			}

			toast('ZIP gerado com sucesso!');
			bar.style.width = '100%';
			status.textContent = 'Conclu\u00eddo!';
			setTimeout(function() { progress.style.display = 'none'; }, 2000);
			loadDetailZips();
			// Update song count in currentPlaylist
			currentPlaylist.song_count = songs.length;
		} catch (err) {
			status.textContent = 'Erro: ' + err.message;
			status.style.color = '#ef4444';
			toast('Erro ao gerar ZIP.', 'error');
		}
		btn.disabled = false;
	}

	// ===== Upload =====
	var AUDIO_EXT = ['.mp3','.mp4','.m4a','.wav','.flac','.ogg','.aac','.wma','.opus'];
	function isAudioFile(name) {
		return AUDIO_EXT.some(function(ext) { return name.toLowerCase().endsWith(ext); });
	}

	// Drag and drop
	var uploadArea = document.getElementById('uploadArea');
	uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('dragover'); });
	uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('dragover'); });
	uploadArea.addEventListener('drop', async function(e) {
		e.preventDefault();
		uploadArea.classList.remove('dragover');
		var items = e.dataTransfer.items;
		if (items && items.length > 0) {
			var entries = [];
			for (var i = 0; i < items.length; i++) {
				var entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
				if (entry) entries.push(entry);
			}
			if (entries.length > 0 && entries.some(function(e) { return e.isDirectory; })) {
				var files = [];
				for (var j = 0; j < entries.length; j++) {
					await readEntryRecursive(entries[j], '', files);
				}
				preparePending(files);
				return;
			}
		}
		handleFiles(e.dataTransfer.files, '');
	});

	function readEntryRecursive(entry, basePath, result) {
		return new Promise(function(resolve) {
			if (entry.isFile) {
				entry.file(function(file) {
					if (isAudioFile(file.name)) result.push({ file: file, folder: basePath });
					resolve();
				});
			} else if (entry.isDirectory) {
				var reader = entry.createReader();
				var folderName = basePath ? basePath + ' / ' + entry.name : entry.name;
				reader.readEntries(async function(entries) {
					for (var i = 0; i < entries.length; i++) {
						await readEntryRecursive(entries[i], folderName, result);
					}
					resolve();
				});
			} else { resolve(); }
		});
	}

	function handleFolderSelect(fileList) {
		if (!currentPlaylist) { toast('Abra uma playlist primeiro.', 'error'); return; }
		var files = [];
		for (var i = 0; i < fileList.length; i++) {
			var file = fileList[i];
			if (!isAudioFile(file.name)) continue;
			var parts = file.webkitRelativePath.split('/');
			var folder = '';
			if (parts.length > 2) folder = parts.slice(1, -1).join(' / ');
			else if (parts.length === 2) folder = parts[0];
			files.push({ file: file, folder: folder });
		}
		preparePending(files);
	}

	function handleFilesFromInput(fileList) {
		if (!currentPlaylist) { toast('Abra uma playlist primeiro.', 'error'); return; }
		// If playlist has folders, require folder selection
		var folder = '';
		if (currentFolders.length > 0) {
			folder = document.getElementById('targetFolder').value;
			if (!folder) {
				toast('Selecione uma pasta destino primeiro.', 'error');
				return;
			}
		}
		handleFiles(fileList, folder);
	}

	function handleFiles(fileList, folder) {
		if (!currentPlaylist) { toast('Abra uma playlist primeiro.', 'error'); return; }
		var files = [];
		for (var i = 0; i < fileList.length; i++) {
			if (!isAudioFile(fileList[i].name)) continue;
			files.push({ file: fileList[i], folder: folder || '' });
		}
		if (files.length === 0) { toast('Nenhum arquivo de \u00e1udio encontrado.', 'error'); return; }

		// Enforce folder rule: if playlist has folders, no loose songs
		if (currentFolders.length > 0) {
			var loose = files.filter(function(f) { return !f.folder; });
			if (loose.length > 0) {
				toast('Esta playlist usa pastas. Todas as m\u00fasicas devem estar dentro de uma pasta.', 'error');
				return;
			}
		}

		preparePending(files);
	}

	// ID3 Parser
	async function parseID3(file) {
		var meta = { title: '', artist: '', album: '', cover: null, duration: 0 };
		try {
			var buffer = await file.slice(0, 131072).arrayBuffer();
			var view = new DataView(buffer);
			if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) return meta;

			var version = view.getUint8(3);
			var tagSize = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
			var offset = 10;
			var end = Math.min(10 + tagSize, buffer.byteLength);

			while (offset < end - 10) {
				var frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
				if (frameId.charCodeAt(0) === 0) break;

				var frameSize;
				if (version === 4) {
					frameSize = (view.getUint8(offset+4) << 21) | (view.getUint8(offset+5) << 14) | (view.getUint8(offset+6) << 7) | view.getUint8(offset+7);
				} else {
					frameSize = (view.getUint8(offset+4) << 24) | (view.getUint8(offset+5) << 16) | (view.getUint8(offset+6) << 8) | view.getUint8(offset+7);
				}

				if (frameSize <= 0 || offset + 10 + frameSize > end) break;
				var frameData = new Uint8Array(buffer, offset + 10, frameSize);

				if (frameId === 'TIT2' || frameId === 'TPE1' || frameId === 'TALB') {
					var text = decodeID3Text(frameData);
					if (frameId === 'TIT2') meta.title = text;
					else if (frameId === 'TPE1') meta.artist = text;
					else if (frameId === 'TALB') meta.album = text;
				}

				if (frameId === 'APIC') {
					var enc = frameData[0];
					var idx = 1;
					var mime = '';
					while (idx < frameData.length && frameData[idx] !== 0) { mime += String.fromCharCode(frameData[idx]); idx++; }
					idx++; idx++;
					if (enc === 1 || enc === 2) {
						while (idx < frameData.length - 1 && !(frameData[idx] === 0 && frameData[idx+1] === 0)) idx++;
						idx += 2;
					} else {
						while (idx < frameData.length && frameData[idx] !== 0) idx++;
						idx++;
					}
					if (idx < frameData.length) {
						meta.cover = new Blob([frameData.slice(idx)], { type: mime || 'image/jpeg' });
					}
				}
				offset += 10 + frameSize;
			}
		} catch (e) {}
		return meta;
	}

	function decodeID3Text(data) {
		var enc = data[0];
		var textBytes = data.slice(1);
		if (enc === 1 || enc === 2) {
			var arr = [];
			var hasBom = textBytes[0] === 0xFF && textBytes[1] === 0xFE;
			var start = hasBom ? 2 : 0;
			for (var i = start; i < textBytes.length - 1; i += 2) {
				var code = textBytes[i] | (textBytes[i+1] << 8);
				if (code === 0) break;
				arr.push(code);
			}
			return String.fromCharCode.apply(null, arr);
		}
		var bytes = [];
		for (var i = 0; i < textBytes.length; i++) {
			if (textBytes[i] === 0) break;
			bytes.push(textBytes[i]);
		}
		if (enc === 3) return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
		return new TextDecoder('iso-8859-1').decode(new Uint8Array(bytes));
	}

	var PARSE_CONCURRENT = 20;
	async function parseID3Batch(files, onProgress) {
		var results = new Array(files.length);
		var nextIdx = 0;
		var done = 0;

		async function worker() {
			while (nextIdx < files.length) {
				var i = nextIdx++;
				var meta = await parseID3(files[i].file);
				var fallbackTitle = files[i].file.name.replace(/\\.[^.]+$/, '').replace(/^\\d+[\\s._-]+/, '');
				results[i] = {
					file: files[i].file,
					folder: files[i].folder,
					title: meta.title || fallbackTitle,
					artist: meta.artist || 'Desconhecido',
					album: meta.album || '',
					cover: meta.cover,
					duration: meta.duration || 0,
				};
				done++;
				if (onProgress) onProgress(done, files.length);
			}
		}

		var workers = [];
		for (var w = 0; w < Math.min(PARSE_CONCURRENT, files.length); w++) workers.push(worker());
		await Promise.all(workers);
		return results;
	}

	async function preparePending(files) {
		// Filter out duplicates against existing songs
		if (currentSongs.length > 0) {
			var existingKeys = {};
			for (var i = 0; i < currentSongs.length; i++) {
				var s = currentSongs[i];
				// Key by filename (last part of r2_key) + folder
				var fname = (s.r2_key || '').split('/').pop();
				existingKeys[s.folder + '/' + fname] = true;
			}
			var original = files.length;
			files = files.filter(function(f) {
				var key = (f.folder || '') + '/' + f.file.name;
				return !existingKeys[key];
			});
			var skipped = original - files.length;
			if (skipped > 0) {
				toast(skipped + ' m\u00fasica' + (skipped !== 1 ? 's' : '') + ' duplicada' + (skipped !== 1 ? 's' : '') + ' ignorada' + (skipped !== 1 ? 's' : '') + '.', 'info');
			}
			if (files.length === 0) {
				toast('Todas as m\u00fasicas j\u00e1 existem nesta playlist.', 'info');
				return;
			}
		}

		document.getElementById('uploadSummary').style.display = 'block';
		document.getElementById('summaryTitle').textContent = 'Lendo metadados...';
		document.getElementById('summaryInfo').textContent = '0/' + files.length + ' processados';
		document.getElementById('folderPreview').innerHTML = '<div style="padding:16px;text-align:center;"><div class="progress-bar" style="height:6px;margin-bottom:8px;"><div class="progress-fill" id="parseProgressFill" style="width:0%"></div></div><p style="color:#888;font-size:13px;" id="parseStatus">Lendo metadados...</p></div>';
		document.getElementById('uploadQueue').innerHTML = '';
		document.getElementById('uploadProgress').style.display = 'none';

		pendingFiles = await parseID3Batch(files, function(done, total) {
			var pct = Math.round((done / total) * 100);
			var el = document.getElementById('parseProgressFill');
			if (el) el.style.width = pct + '%';
			var st = document.getElementById('parseStatus');
			if (st) st.textContent = done + '/' + total + ' processados...';
			document.getElementById('summaryInfo').textContent = done + '/' + total + ' processados';
		});

		var grouped = {};
		for (var i = 0; i < pendingFiles.length; i++) {
			var key = pendingFiles[i].folder || '(raiz)';
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(pendingFiles[i]);
		}

		var totalSize = pendingFiles.reduce(function(sum, f) { return sum + f.file.size; }, 0);
		var sizeMB = totalSize < 1024 * 1024 * 1024
			? (totalSize / (1024 * 1024)).toFixed(0) + ' MB'
			: (totalSize / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
		var withCover = pendingFiles.filter(function(f) { return f.cover; }).length;
		var withArtist = pendingFiles.filter(function(f) { return f.artist !== 'Desconhecido'; }).length;
		var folderCount = Object.keys(grouped).length;

		document.getElementById('summaryTitle').textContent = folderCount + ' pasta' + (folderCount !== 1 ? 's' : '') + ' | ' + pendingFiles.length + ' m\u00fasicas';
		document.getElementById('summaryInfo').textContent = sizeMB + ' total | ' + withCover + ' com capa | ' + withArtist + ' com artista';

		var previewHtml = '';
		var isLargeBatch = pendingFiles.length > 100;
		var entries = Object.entries(grouped);

		for (var ei = 0; ei < entries.length; ei++) {
			var folder = entries[ei][0];
			var items = entries[ei][1];
			previewHtml += '<div style="margin-bottom:' + (isLargeBatch ? '4px' : '12px') + ';">';
			var folderSize = (items.reduce(function(s, it) { return s + it.file.size; }, 0) / (1024 * 1024)).toFixed(0);
			var folderCovers = items.filter(function(it) { return it.cover; }).length;
			previewHtml += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 0;font-size:13px;color:#555;">';
			previewHtml += '<span style="display:flex;align-items:center;gap:6px;font-weight:' + (isLargeBatch ? '400' : '600') + ';"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> ' + folder + '</span>';
			previewHtml += '<span style="color:#aaa;font-size:12px;">' + items.length + ' m\u00fasicas | ' + folderSize + ' MB | ' + folderCovers + ' capas</span>';
			previewHtml += '</div>';

			if (!isLargeBatch) {
				for (var ii = 0; ii < items.length; ii++) {
					var item = items[ii];
					var itemSize = (item.file.size / (1024 * 1024)).toFixed(1);
					var coverDot = item.cover ? '<span style="color:#22c55e;">&#9679;</span> ' : '<span style="color:#ddd;">&#9679;</span> ';
					previewHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0 4px 20px;font-size:13px;color:#666;border-bottom:1px solid #f5f5f5;">';
					previewHtml += '<span>' + coverDot + '<strong>' + item.title + '</strong> - ' + item.artist + '</span>';
					previewHtml += '<span style="color:#aaa;">' + itemSize + ' MB</span>';
					previewHtml += '</div>';
				}
			}
			previewHtml += '</div>';
		}

		document.getElementById('folderPreview').innerHTML = previewHtml;
	}

	var MAX_CONCURRENT = 10;

	async function startUpload() {
		var playlistId = currentPlaylist ? String(currentPlaylist.id) : null;
		if (!playlistId) { toast('Nenhuma playlist selecionada.', 'error'); return; }
		if (pendingFiles.length === 0) return;

		document.getElementById('uploadSummary').style.display = 'none';
		document.getElementById('uploadProgress').style.display = 'block';

		var queue = document.getElementById('uploadQueue');
		queue.innerHTML = '';

		var total = pendingFiles.length;
		var completed = 0;
		var errors = 0;
		var startTime = Date.now();
		var uploadedFiles = [];

		var banner = document.getElementById('uploadBanner');
		banner.className = 'upload-banner active';
		document.getElementById('bannerSpinner').style.display = 'block';

		var isLarge = total > 200;
		var MAX_VISIBLE = isLarge ? 30 : total;
		var items = new Array(total);

		if (!isLarge) {
			for (var i = 0; i < total; i++) {
				items[i] = createQueueItem(pendingFiles[i]);
				queue.appendChild(items[i]);
			}
		}

		function createQueueItem(pending) {
			var item = document.createElement('div');
			item.className = 'upload-item';
			var folderLabel = pending.folder ? '<span class="file-folder">' + pending.folder + '</span>' : '';
			var sizeMB = (pending.file.size / (1024 * 1024)).toFixed(1);
			item.innerHTML =
				'<div class="status-icon waiting"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg></div>' +
				'<div class="file-info"><span class="file-name">' + pending.title + '</span>' + folderLabel + '</div>' +
				'<span class="file-status">' + sizeMB + ' MB</span>';
			return item;
		}

		function ensureItemVisible(index) {
			if (isLarge && !items[index]) {
				items[index] = createQueueItem(pendingFiles[index]);
				queue.appendChild(items[index]);
				while (queue.children.length > MAX_VISIBLE) queue.removeChild(queue.firstChild);
			}
		}

		function updateProgress() {
			var pct = Math.round((completed / total) * 100);
			document.getElementById('uploadProgressFill').style.width = pct + '%';
			document.getElementById('progressCount').textContent = completed + '/' + total;
			document.getElementById('bannerPct').textContent = pct + '%';
			document.getElementById('bannerBar').style.width = pct + '%';

			var elapsed = (Date.now() - startTime) / 1000;
			var remaining = completed > 0 ? Math.round((elapsed / completed) * (total - completed)) : 0;
			var eta = remaining > 60 ? Math.round(remaining / 60) + 'min' : remaining + 's';

			document.getElementById('bannerText').textContent = completed + '/' + total + ' enviadas - ' + eta + ' restante';
			document.getElementById('progressText').textContent = completed + '/' + total + ' enviadas - ~' + eta + ' restante';
		}
		updateProgress();

		async function uploadOne(index) {
			var pending = pendingFiles[index];
			ensureItemVisible(index);
			var item = items[index];

			item.className = 'upload-item uploading';
			item.querySelector('.status-icon').className = 'status-icon uploading';
			item.querySelector('.status-icon').innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;border-color:rgba(0,0,0,0.15);border-top-color:#1a1a1a;border-radius:50%;animation:spin 0.8s linear infinite;"></div>';
			item.querySelector('.file-status').textContent = 'Enviando...';

			var success = false;
			for (var attempt = 0; attempt < 3 && !success; attempt++) {
				try {
					if (attempt > 0) {
						item.querySelector('.file-status').textContent = 'Tentativa ' + (attempt + 1) + '/3...';
						await new Promise(function(r) { setTimeout(r, 1000 * attempt); });
					}

					var formData = new FormData();
					formData.append('file', pending.file);
					formData.append('playlist_id', playlistId);
					formData.append('title', pending.title);
					formData.append('artist', pending.artist || 'Desconhecido');
					formData.append('album', pending.album || '');
					formData.append('duration', String(pending.duration || 0));
					formData.append('folder', pending.folder);
					if (pending.cover) formData.append('cover', pending.cover, 'cover.jpg');

					var res = await fetch('/api/songs/upload', { method: 'POST', body: formData });
					if (res.ok) {
						uploadedFiles.push(pending);
						item.className = 'upload-item';
						item.querySelector('.status-icon').className = 'status-icon done';
						item.querySelector('.status-icon').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>';
						item.querySelector('.file-status').textContent = 'Enviado';
						item.querySelector('.file-status').style.color = '#22c55e';
						success = true;
					} else if (res.status === 409) {
						// Duplicate - skip without error
						item.className = 'upload-item';
						item.querySelector('.status-icon').className = 'status-icon done';
						item.querySelector('.status-icon').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>';
						item.querySelector('.file-status').textContent = 'J\u00e1 existe';
						item.querySelector('.file-status').style.color = '#d97706';
						success = true;
					} else {
						var err = await res.json();
						throw new Error(err.error);
					}
				} catch (err) {
					if (attempt === 2) {
						item.className = 'upload-item';
						item.querySelector('.status-icon').className = 'status-icon error';
						item.querySelector('.status-icon').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
						item.querySelector('.file-status').textContent = err.message;
						item.querySelector('.file-status').style.color = '#ef4444';
						errors++;
					}
				}
			}
			completed++;
			updateProgress();
		}

		var nextIndex = 0;
		async function runWorker() {
			while (nextIndex < total) {
				var idx = nextIndex++;
				await uploadOne(idx);
			}
		}

		var workers = [];
		for (var w = 0; w < Math.min(MAX_CONCURRENT, total); w++) workers.push(runWorker());
		await Promise.all(workers);

		var elapsed = Math.round((Date.now() - startTime) / 1000);
		var elapsedStr = elapsed > 60 ? Math.round(elapsed / 60) + 'min ' + (elapsed % 60) + 's' : elapsed + 's';

		document.getElementById('bannerSpinner').style.display = 'none';
		if (errors > 0) {
			banner.className = 'upload-banner active has-errors';
			document.getElementById('bannerText').textContent = 'Conclu\u00eddo com ' + errors + ' erro(s) de ' + total + ' em ' + elapsedStr;
			document.getElementById('progressText').textContent = 'Conclu\u00eddo com ' + errors + ' erro(s) em ' + elapsedStr;
		} else {
			banner.className = 'upload-banner active done';
			document.getElementById('bannerText').textContent = total + ' m\u00fasica' + (total !== 1 ? 's' : '') + ' enviada' + (total !== 1 ? 's' : '') + ' em ' + elapsedStr + '!';
			document.getElementById('progressText').textContent = 'Upload conclu\u00eddo em ' + elapsedStr + '!';
		}
		document.getElementById('bannerPct').textContent = '100%';
		document.getElementById('bannerBar').style.width = '100%';

		// Update song count
		currentPlaylist.song_count = (currentPlaylist.song_count || 0) + uploadedFiles.length;

		if (uploadedFiles.length > 0) {
			await generateZipsFromFiles(playlistId, uploadedFiles);
		}

		if (errors === 0) {
			setTimeout(function() { banner.className = 'upload-banner'; }, 8000);
		}

		pendingFiles = [];
		loadDetailSongs();
		loadDetailZips();
	}

	// ===== ZIP Generation =====
	var crcT = new Uint32Array(256);
	for (var i = 0; i < 256; i++) {
		var c = i;
		for (var j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
		crcT[i] = c;
	}

	async function fileCrc32(file) {
		var reader = file.stream().getReader();
		var crc = 0xFFFFFFFF;
		while (true) {
			var result = await reader.read();
			if (result.done) break;
			var value = result.value;
			for (var i = 0; i < value.length; i++) crc = crcT[(crc ^ value[i]) & 0xFF] ^ (crc >>> 8);
		}
		return (crc ^ 0xFFFFFFFF) >>> 0;
	}

	function buildZipBlob(entries) {
		var blobParts = [];
		var centralDir = [];
		var offset = 0;

		for (var ei = 0; ei < entries.length; ei++) {
			var e = entries[ei];
			var header = new Uint8Array(30 + e.nameBytes.length);
			var hv = new DataView(header.buffer);
			hv.setUint32(0, 0x04034b50, true);
			hv.setUint16(4, 20, true);
			hv.setUint16(8, 0, true);
			hv.setUint32(14, e.crc, true);
			hv.setUint32(18, e.fileSize, true);
			hv.setUint32(22, e.fileSize, true);
			hv.setUint16(26, e.nameBytes.length, true);
			header.set(e.nameBytes, 30);

			var headerOffset = offset;
			blobParts.push(header);
			offset += header.length;
			blobParts.push(e.file);
			offset += e.fileSize;

			var cd = new Uint8Array(46 + e.nameBytes.length);
			var cv = new DataView(cd.buffer);
			cv.setUint32(0, 0x02014b50, true);
			cv.setUint16(4, 20, true);
			cv.setUint16(6, 20, true);
			cv.setUint32(16, e.crc, true);
			cv.setUint32(20, e.fileSize, true);
			cv.setUint32(24, e.fileSize, true);
			cv.setUint16(28, e.nameBytes.length, true);
			cv.setUint32(42, headerOffset, true);
			cd.set(e.nameBytes, 46);
			centralDir.push(cd);
		}

		var cdOffset = offset;
		var cdSize = 0;
		for (var ci = 0; ci < centralDir.length; ci++) { blobParts.push(centralDir[ci]); cdSize += centralDir[ci].length; }

		var eocd = new Uint8Array(22);
		var ev = new DataView(eocd.buffer);
		ev.setUint32(0, 0x06054b50, true);
		ev.setUint16(8, entries.length, true);
		ev.setUint16(10, entries.length, true);
		ev.setUint32(12, cdSize, true);
		ev.setUint32(16, cdOffset, true);
		blobParts.push(eocd);

		return new Blob(blobParts, { type: 'application/zip' });
	}

	async function fetchRetry(url, opts, retries) {
		retries = retries || 3;
		for (var attempt = 0; attempt < retries; attempt++) {
			var res = await fetch(url, opts);
			if (res.ok) return res;
			if (res.status >= 500 && attempt < retries - 1) {
				await new Promise(function(r) { setTimeout(r, 1000 * (attempt + 1)); });
				continue;
			}
			throw new Error('HTTP ' + res.status + ' em ' + url);
		}
	}

	async function uploadZipToR2(playlistId, folder, part, totalParts, blob, songCount, onProgress) {
		var CHUNK = 30 * 1024 * 1024;
		var PARALLEL = 4;

		if (blob.size < 90 * 1024 * 1024) {
			var fd = new FormData();
			fd.append('file', blob, 'songs.zip');
			fd.append('folder', folder);
			fd.append('part', String(part));
			fd.append('totalParts', String(totalParts));
			fd.append('songCount', String(songCount));
			await fetchRetry('/api/playlists/' + playlistId + '/zip/upload', { method: 'POST', body: fd }, 3);
			if (onProgress) onProgress(1, 1);
		} else {
			var r2Key = 'zips/playlist-' + playlistId + '/' + (folder || '_all') + '_part' + part + '.zip';
			var startRes = await fetchRetry('/api/playlists/' + playlistId + '/zip/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: r2Key })
			}, 3);
			var startData = await startRes.json();
			var uploadId = startData.uploadId;

			var totalChunks = Math.ceil(blob.size / CHUNK);
			var parts = new Array(totalChunks);
			var uploaded = 0;

			var nextIdx = 0;
			async function uploadWorker() {
				while (nextIdx < totalChunks) {
					var i = nextIdx++;
					var chunk = blob.slice(i * CHUNK, Math.min((i + 1) * CHUNK, blob.size));
					var fd = new FormData();
					fd.append('chunk', chunk);
					fd.append('uploadId', uploadId);
					fd.append('key', r2Key);
					fd.append('partNumber', String(i + 1));
					var res = await fetchRetry('/api/playlists/' + playlistId + '/zip/part', { method: 'POST', body: fd }, 5);
					var data = await res.json();
					parts[i] = { partNumber: i + 1, etag: data.etag };
					uploaded++;
					if (onProgress) onProgress(uploaded, totalChunks);
				}
			}

			var workers = [];
			for (var w = 0; w < Math.min(PARALLEL, totalChunks); w++) workers.push(uploadWorker());
			await Promise.all(workers);

			await fetchRetry('/api/playlists/' + playlistId + '/zip/complete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uploadId: uploadId, key: r2Key, parts: parts.filter(Boolean), folder: folder, zipPart: part, totalParts: totalParts, fileSize: blob.size, songCount: songCount })
			}, 3);
		}
	}

	async function generateZipsFromFiles(playlistId, files) {
		var banner = document.getElementById('uploadBanner');
		var bannerText = document.getElementById('bannerText');
		var bannerPct = document.getElementById('bannerPct');
		var bannerBar = document.getElementById('bannerBar');
		document.getElementById('bannerSpinner').style.display = 'block';
		banner.className = 'upload-banner active';

		var grouped = {};
		for (var i = 0; i < files.length; i++) {
			var folder = files[i].folder || '';
			if (!grouped[folder]) grouped[folder] = [];
			grouped[folder].push(files[i]);
		}

		var folders = Object.keys(grouped);
		var totalProcessed = 0;
		var totalFiles = files.length;

		for (var fi = 0; fi < folders.length; fi++) {
			var folder = folders[fi];
			var folderFiles = grouped[folder];
			bannerText.textContent = 'Gerando ZIP' + (folder ? ' (' + folder + ')' : '') + '... Calculando checksums';

			var entries = new Array(folderFiles.length);
			var CRC_PARALLEL = 10;
			var crcIdx = 0;
			var crcDone = 0;

			async function crcWorker() {
				while (crcIdx < folderFiles.length) {
					var i = crcIdx++;
					var f = folderFiles[i];
					var ext = f.file.name.split('.').pop() || 'mp3';
					var zipName = (f.artist || 'Desconhecido') + ' - ' + f.title + '.' + ext;
					var nameBytes = new TextEncoder().encode(zipName);
					var crc = await fileCrc32(f.file);

					entries[i] = { nameBytes: nameBytes, crc: crc, fileSize: f.file.size, file: f.file };
					crcDone++;
					totalProcessed++;

					var pct = Math.round((totalProcessed / totalFiles) * 70);
					bannerPct.textContent = pct + '%';
					bannerBar.style.width = pct + '%';
					bannerText.textContent = 'Gerando ZIP' + (folder ? ' (' + folder + ')' : '') + '... ' + crcDone + '/' + folderFiles.length + ' checksums';
				}
			}

			var crcWorkers = [];
			for (var w = 0; w < Math.min(CRC_PARALLEL, folderFiles.length); w++) crcWorkers.push(crcWorker());
			await Promise.all(crcWorkers);

			bannerText.textContent = 'Montando ZIP' + (folder ? ' (' + folder + ')' : '') + '...';
			var zipBlob = buildZipBlob(entries);
			var sizeMB = (zipBlob.size / (1024 * 1024)).toFixed(0);

			bannerText.textContent = 'Enviando ZIP' + (folder ? ' (' + folder + ')' : '') + ' (' + sizeMB + ' MB)...';
			await uploadZipToR2(playlistId, folder, 1, 1, zipBlob, entries.length, function(done, total) {
				var pct = 70 + Math.round((done / total) * 30);
				bannerPct.textContent = pct + '%';
				bannerBar.style.width = pct + '%';
				bannerText.textContent = 'Enviando ZIP' + (folder ? ' (' + folder + ')' : '') + ' ' + Math.round((done / total) * 100) + '% (' + sizeMB + ' MB)';
			});
		}

		if (folders.length > 1) {
			bannerText.textContent = 'Gerando ZIP completo... Calculando checksums';
			var allEntries = new Array(files.length);
			var allIdx = 0;
			var allDone = 0;

			async function allCrcWorker() {
				while (allIdx < files.length) {
					var i = allIdx++;
					var f = files[i];
					var ext = f.file.name.split('.').pop() || 'mp3';
					var zipName = (f.folder ? f.folder + '/' : '') + (f.artist || 'Desconhecido') + ' - ' + f.title + '.' + ext;
					var nameBytes = new TextEncoder().encode(zipName);
					var crc = await fileCrc32(f.file);
					allEntries[i] = { nameBytes: nameBytes, crc: crc, fileSize: f.file.size, file: f.file };
					allDone++;
					bannerText.textContent = 'ZIP completo: ' + allDone + '/' + files.length + ' checksums';
				}
			}
			var allWorkers = [];
			for (var w = 0; w < Math.min(10, files.length); w++) allWorkers.push(allCrcWorker());
			await Promise.all(allWorkers);

			var zipBlob2 = buildZipBlob(allEntries.filter(Boolean));
			var sizeMB2 = (zipBlob2.size / (1024 * 1024)).toFixed(0);
			bannerText.textContent = 'Enviando ZIP completo (' + sizeMB2 + ' MB)...';
			await uploadZipToR2(playlistId, '', 1, 1, zipBlob2, allEntries.length, function(done, total) {
				bannerText.textContent = 'Enviando ZIP completo ' + Math.round((done / total) * 100) + '% (' + sizeMB2 + ' MB)';
			});
		}

		document.getElementById('bannerSpinner').style.display = 'none';
		banner.className = 'upload-banner active done';
		bannerPct.textContent = '100%';
		bannerBar.style.width = '100%';
		bannerText.textContent = 'Upload e ZIP conclu\u00eddos!';
	}

	// ===== Init =====
	loadPlaylists();
	</script>
</body>
</html>`;
}
