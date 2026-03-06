export function renderPlaylistPage(playlist: any, songs: any[], accessToken: string): string {
	// Group songs by folder
	const folders = new Map<string, any[]>();
	for (const song of songs) {
		const folder = song.folder || "Todas as Musicas";
		if (!folders.has(folder)) folders.set(folder, []);
		folders.get(folder)!.push(song);
	}

	const folderSections = Array.from(folders.entries())
		.map(([folderName, folderSongs]) => `
			<div class="folder-section" data-folder="${esc(folderName)}">
				<div class="folder-header">
					<div class="folder-info">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
						<h3>${esc(folderName)}</h3>
						<span class="song-count">${folderSongs.length} musica${folderSongs.length !== 1 ? "s" : ""}</span>
					</div>
					<div class="folder-actions">
						<label class="checkbox-wrapper">
							<input type="checkbox" class="folder-select-all" data-folder="${esc(folderName)}">
							<span class="checkmark"></span>
						</label>
						<button class="btn-icon download-folder" data-folder="${esc(folderName)}" title="Baixar pasta">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
						</button>
					</div>
				</div>
				<div class="songs-list">
					${folderSongs.map((song: any, i: number) => `
						<div class="song-card" data-song-id="${song.id}" data-folder="${esc(folderName)}">
							<label class="checkbox-wrapper song-checkbox">
								<input type="checkbox" class="song-select" data-song-id="${song.id}" data-folder="${esc(folderName)}">
								<span class="checkmark"></span>
							</label>
							<div class="song-cover" onclick="playSong(${song.id})">
								${song.cover_r2_key
									? `<img src="/cover/${song.id}?token=${accessToken}" alt="${esc(song.title)}" loading="lazy">`
									: `<div class="cover-placeholder">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><path d="M9 12l2 2 4-4"></path><path d="M9.5 9.5L15 15M14.5 9.5L9 15" stroke="none"></path><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.2"></circle><path d="M10 8.5v7l5.5-3.5z" fill="currentColor" opacity="0.6"></path></svg>
									</div>`
								}
								<div class="play-overlay">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
								</div>
							</div>
							<div class="song-info" onclick="playSong(${song.id})">
								<span class="song-title">${esc(song.title)}</span>
								<span class="song-artist">${esc(song.artist)}</span>
								${song.album ? `<span class="song-album">${esc(song.album)}</span>` : ""}
							</div>
							<div class="song-meta">
								${song.duration ? `<span class="song-duration">${formatDuration(song.duration)}</span>` : ""}
								${song.file_size ? `<span class="song-size">${formatSize(song.file_size)}</span>` : ""}
							</div>
							<button class="btn-icon download-song" onclick="downloadSong(${song.id})" title="Baixar">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
							</button>
						</div>
					`).join("")}
				</div>
			</div>
		`)
		.join("");

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
		<header class="playlist-header">
			<div class="header-content">
				<div class="playlist-info">
					<div class="breadcrumb">
						<a href="/">Patacos</a>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
						<span>${esc(playlist.name)}</span>
					</div>
					<h1>${esc(playlist.name)}</h1>
					${playlist.description ? `<p class="playlist-description">${esc(playlist.description)}</p>` : ""}
					<div class="playlist-stats">
						<span>${songs.length} musica${songs.length !== 1 ? "s" : ""}</span>
						<span class="dot"></span>
						<span>${folders.size} pasta${folders.size !== 1 ? "s" : ""}</span>
					</div>
				</div>
			</div>
		</header>

		<div class="toolbar">
			<div class="toolbar-left">
				<button class="btn btn-primary" onclick="downloadAllSongs()">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
					Baixar Todas as Musicas
				</button>
				<div class="selected-info" id="selectedInfo" style="display:none">
					<span id="selectedCount">0</span> selecionada(s)
					<button class="btn btn-secondary btn-sm" onclick="downloadSelected()">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
						Baixar Selecionadas
					</button>
				</div>
			</div>
			<div class="toolbar-right">
				<button class="btn btn-secondary btn-sm" onclick="playAll()">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
					Preview (30s)
				</button>
			</div>
		</div>

		<!-- Preview limit notice -->
		<div class="preview-notice" id="previewNotice" style="display:none">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
			<span>Preview limitado a 30 segundos. Baixe as musicas para ouvir completas.</span>
			<button class="btn btn-primary btn-sm" onclick="downloadCurrentSong()">Baixar esta musica</button>
		</div>

		<div class="content">
			${folderSections}
		</div>
	</div>

	<!-- Audio Player -->
	<div class="player" id="player">
		<div class="player-progress">
			<div class="progress-bar" id="progressBar">
				<div class="progress-fill" id="progressFill"></div>
				<div class="progress-handle" id="progressHandle"></div>
			</div>
		</div>
		<div class="player-content">
			<div class="player-song">
				<div class="player-cover" id="playerCover">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
				</div>
				<div class="player-info">
					<span class="player-title" id="playerTitle">Nenhuma musica selecionada</span>
					<span class="player-artist" id="playerArtist"></span>
				</div>
			</div>
			<div class="player-controls">
				<button class="btn-player" onclick="prevSong()" title="Anterior">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"></line></svg>
				</button>
				<button class="btn-player btn-play" id="playBtn" onclick="togglePlay()">
					<svg id="playIcon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
					<svg id="pauseIcon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
				</button>
				<button class="btn-player" onclick="nextSong()" title="Proximo">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line></svg>
				</button>
			</div>
			<div class="player-time">
				<span id="currentTime">0:00</span>
				<span>/</span>
				<span id="totalTime">0:00</span>
			</div>
			<div class="player-volume">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
				<input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1" oninput="setVolume(this.value)">
			</div>
		</div>
	</div>

	<audio id="audioEl" preload="metadata"></audio>

	<script>
	const PREVIEW_LIMIT = 30; // seconds
	const ACCESS_TOKEN = '${accessToken}';
	const allSongs = ${JSON.stringify(songs.map(s => ({ id: s.id, title: s.title, artist: s.artist, album: s.album, duration: s.duration, folder: s.folder, cover_r2_key: s.cover_r2_key })))};
	let currentIndex = -1;
	let isPlaying = false;
	let playQueue = [...allSongs];

	const audio = document.getElementById('audioEl');
	const playIcon = document.getElementById('playIcon');
	const pauseIcon = document.getElementById('pauseIcon');
	const playerTitle = document.getElementById('playerTitle');
	const playerArtist = document.getElementById('playerArtist');
	const playerCover = document.getElementById('playerCover');
	const progressFill = document.getElementById('progressFill');
	const progressBar = document.getElementById('progressBar');
	const currentTimeEl = document.getElementById('currentTime');
	const totalTimeEl = document.getElementById('totalTime');
	const previewNotice = document.getElementById('previewNotice');

	function playSong(id) {
		const idx = playQueue.findIndex(s => s.id === id);
		if (idx === -1) return;
		currentIndex = idx;
		loadAndPlay();
	}

	function loadAndPlay() {
		const song = playQueue[currentIndex];
		if (!song) return;

		audio.src = '/stream/' + song.id + '?token=' + ACCESS_TOKEN;
		audio.play();
		isPlaying = true;
		previewNotice.style.display = 'none';
		updatePlayerUI(song);
	}

	function updatePlayerUI(song) {
		playerTitle.textContent = song.title;
		playerArtist.textContent = song.artist;
		playIcon.style.display = 'none';
		pauseIcon.style.display = 'block';

		if (song.cover_r2_key) {
			playerCover.innerHTML = '<img src="/cover/' + song.id + '?token=' + ACCESS_TOKEN + '" alt="">';
		} else {
			playerCover.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>';
		}

		document.querySelectorAll('.song-card').forEach(el => el.classList.remove('playing'));
		const card = document.querySelector('.song-card[data-song-id="' + song.id + '"]');
		if (card) card.classList.add('playing');
	}

	function togglePlay() {
		if (!audio.src || currentIndex === -1) {
			if (playQueue.length > 0) { currentIndex = 0; loadAndPlay(); }
			return;
		}
		if (isPlaying) {
			audio.pause();
			isPlaying = false;
			playIcon.style.display = 'block';
			pauseIcon.style.display = 'none';
		} else {
			audio.play();
			isPlaying = true;
			playIcon.style.display = 'none';
			pauseIcon.style.display = 'block';
		}
	}

	function nextSong() {
		if (playQueue.length === 0) return;
		currentIndex = (currentIndex + 1) % playQueue.length;
		loadAndPlay();
	}

	function prevSong() {
		if (playQueue.length === 0) return;
		if (audio.currentTime > 3) { audio.currentTime = 0; return; }
		currentIndex = (currentIndex - 1 + playQueue.length) % playQueue.length;
		loadAndPlay();
	}

	function playAll() {
		playQueue = [...allSongs];
		currentIndex = 0;
		loadAndPlay();
	}

	function setVolume(val) {
		audio.volume = parseFloat(val);
	}

	function formatTime(sec) {
		if (isNaN(sec)) return '0:00';
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return m + ':' + (s < 10 ? '0' : '') + s;
	}

	// Preview limit: stop at 30 seconds and show download prompt
	audio.addEventListener('timeupdate', () => {
		if (audio.duration) {
			const pct = (audio.currentTime / Math.min(audio.duration, PREVIEW_LIMIT)) * 100;
			progressFill.style.width = Math.min(pct, 100) + '%';
			currentTimeEl.textContent = formatTime(audio.currentTime);
			totalTimeEl.textContent = formatTime(PREVIEW_LIMIT);

			// Stop at preview limit
			if (audio.currentTime >= PREVIEW_LIMIT) {
				audio.pause();
				isPlaying = false;
				playIcon.style.display = 'block';
				pauseIcon.style.display = 'none';
				previewNotice.style.display = 'flex';
			}
		}
	});

	audio.addEventListener('ended', () => nextSong());

	// Disable seeking past preview limit
	let isDragging = false;
	progressBar.addEventListener('mousedown', (e) => { isDragging = true; seek(e); });
	document.addEventListener('mousemove', (e) => { if (isDragging) seek(e); });
	document.addEventListener('mouseup', () => { isDragging = false; });
	progressBar.addEventListener('touchstart', (e) => { isDragging = true; seekTouch(e); });
	document.addEventListener('touchmove', (e) => { if (isDragging) seekTouch(e); });
	document.addEventListener('touchend', () => { isDragging = false; });

	function seek(e) {
		const rect = progressBar.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		const maxTime = Math.min(audio.duration || PREVIEW_LIMIT, PREVIEW_LIMIT);
		audio.currentTime = pct * maxTime;
	}

	function seekTouch(e) {
		if (e.touches.length > 0) {
			const rect = progressBar.getBoundingClientRect();
			const pct = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
			const maxTime = Math.min(audio.duration || PREVIEW_LIMIT, PREVIEW_LIMIT);
			audio.currentTime = pct * maxTime;
		}
	}

	// Download functions
	function downloadSong(id) {
		const a = document.createElement('a');
		a.href = '/download/' + id + '?token=' + ACCESS_TOKEN;
		a.download = '';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function downloadCurrentSong() {
		if (currentIndex >= 0 && playQueue[currentIndex]) {
			downloadSong(playQueue[currentIndex].id);
		}
	}

	function downloadAllSongs() {
		allSongs.forEach((song, i) => {
			setTimeout(() => downloadSong(song.id), i * 300);
		});
	}

	function downloadSelected() {
		const checked = document.querySelectorAll('.song-select:checked');
		checked.forEach((cb, i) => {
			setTimeout(() => downloadSong(cb.dataset.songId), i * 300);
		});
	}

	// Selection logic
	document.querySelectorAll('.song-select').forEach(cb => {
		cb.addEventListener('change', updateSelection);
	});

	document.querySelectorAll('.folder-select-all').forEach(cb => {
		cb.addEventListener('change', (e) => {
			const folder = e.target.dataset.folder;
			document.querySelectorAll('.song-select[data-folder="' + folder + '"]').forEach(s => {
				s.checked = e.target.checked;
			});
			updateSelection();
		});
	});

	document.querySelectorAll('.download-folder').forEach(btn => {
		btn.addEventListener('click', () => {
			const folder = btn.dataset.folder;
			const folderSongs = allSongs.filter(s => (s.folder || 'Todas as Musicas') === folder);
			folderSongs.forEach((song, i) => {
				setTimeout(() => downloadSong(song.id), i * 300);
			});
		});
	});

	function updateSelection() {
		const checked = document.querySelectorAll('.song-select:checked');
		const info = document.getElementById('selectedInfo');
		const count = document.getElementById('selectedCount');
		if (checked.length > 0) {
			info.style.display = 'flex';
			count.textContent = checked.length;
		} else {
			info.style.display = 'none';
		}
	}

	// Keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		if (e.target.tagName === 'INPUT') return;
		if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
		if (e.code === 'ArrowRight') nextSong();
		if (e.code === 'ArrowLeft') prevSong();
	});
	</script>
</body>
</html>`;
}

function esc(str: string): string {
	if (!str) return "";
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDuration(seconds: number): string {
	if (!seconds) return "";
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
	if (!bytes) return "";
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
	return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getStyles(): string {
	return `
	* { margin: 0; padding: 0; box-sizing: border-box; }

	body {
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
		background: #fafafa;
		color: #1a1a1a;
		padding-bottom: 100px;
		-webkit-font-smoothing: antialiased;
	}

	.container {
		max-width: 960px;
		margin: 0 auto;
		padding: 0 20px;
	}

	/* Header */
	.playlist-header {
		padding: 48px 0 32px;
		border-bottom: 1px solid #eee;
		margin-bottom: 24px;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
		font-size: 13px;
		color: #888;
	}

	.breadcrumb a {
		color: #888;
		text-decoration: none;
		transition: color 0.2s;
	}

	.breadcrumb a:hover { color: #333; }

	.playlist-header h1 {
		font-size: 32px;
		font-weight: 700;
		letter-spacing: -0.5px;
		margin-bottom: 8px;
	}

	.playlist-description {
		color: #666;
		font-size: 15px;
		margin-bottom: 12px;
	}

	.playlist-stats {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #999;
	}

	.dot {
		width: 3px;
		height: 3px;
		background: #ccc;
		border-radius: 50%;
	}

	/* Toolbar */
	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 32px;
		gap: 16px;
		flex-wrap: wrap;
	}

	.toolbar-left, .toolbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

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
	}

	.btn-primary {
		background: #1a1a1a;
		color: #fff;
	}

	.btn-primary:hover { background: #333; }

	.btn-secondary {
		background: #f0f0f0;
		color: #333;
	}

	.btn-secondary:hover { background: #e5e5e5; }

	.btn-outline {
		background: transparent;
		color: #666;
		border: 1px solid #ddd;
	}

	.btn-outline:hover { border-color: #aaa; color: #333; }

	.btn-sm { padding: 6px 14px; font-size: 13px; }

	.selected-info {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 13px;
		color: #666;
	}

	/* Folders */
	.folder-section {
		margin-bottom: 32px;
	}

	.folder-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid #eee;
		margin-bottom: 8px;
	}

	.folder-info {
		display: flex;
		align-items: center;
		gap: 10px;
		color: #555;
	}

	.folder-info h3 {
		font-size: 16px;
		font-weight: 600;
	}

	.song-count {
		font-size: 12px;
		color: #aaa;
		background: #f5f5f5;
		padding: 2px 8px;
		border-radius: 12px;
	}

	.folder-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* Song cards */
	.song-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 10px;
		transition: background 0.15s;
		cursor: default;
	}

	.song-card:hover {
		background: #f5f5f5;
	}

	.song-card.playing {
		background: #f0f0f0;
	}

	.song-card.playing .song-title {
		color: #000;
		font-weight: 600;
	}

	.song-cover {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		overflow: hidden;
		flex-shrink: 0;
		position: relative;
		cursor: pointer;
		background: #f0f0f0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.song-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-placeholder {
		color: #ccc;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.play-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0,0,0,0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s;
		border-radius: 8px;
	}

	.song-cover:hover .play-overlay { opacity: 1; }
	.song-card.playing .play-overlay { opacity: 1; background: rgba(0,0,0,0.5); }

	.song-info {
		flex: 1;
		min-width: 0;
		cursor: pointer;
	}

	.song-title {
		display: block;
		font-size: 14px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.song-artist {
		display: block;
		font-size: 12px;
		color: #888;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.song-album {
		display: block;
		font-size: 11px;
		color: #aaa;
	}

	.song-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		flex-shrink: 0;
	}

	.song-duration {
		font-size: 12px;
		color: #999;
		font-variant-numeric: tabular-nums;
	}

	.song-size {
		font-size: 11px;
		color: #bbb;
	}

	.btn-icon {
		background: none;
		border: none;
		padding: 8px;
		cursor: pointer;
		color: #aaa;
		border-radius: 6px;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-icon:hover { color: #333; background: #eee; }

	/* Checkbox */
	.checkbox-wrapper {
		display: flex;
		align-items: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.checkbox-wrapper input { display: none; }

	.checkmark {
		width: 18px;
		height: 18px;
		border: 2px solid #ddd;
		border-radius: 4px;
		transition: all 0.2s;
		position: relative;
	}

	.checkbox-wrapper input:checked + .checkmark {
		background: #1a1a1a;
		border-color: #1a1a1a;
	}

	.checkbox-wrapper input:checked + .checkmark::after {
		content: '';
		position: absolute;
		left: 5px;
		top: 1px;
		width: 5px;
		height: 10px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	/* Player */
	.player {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: #fff;
		border-top: 1px solid #eee;
		box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
		z-index: 100;
	}

	.player-progress {
		padding: 0 20px;
		height: 4px;
		cursor: pointer;
	}

	.progress-bar {
		width: 100%;
		height: 4px;
		background: #eee;
		position: relative;
		border-radius: 2px;
	}

	.progress-fill {
		height: 100%;
		background: #1a1a1a;
		border-radius: 2px;
		width: 0%;
		transition: width 0.1s linear;
	}

	.progress-handle {
		display: none;
	}

	.progress-bar:hover .progress-fill { background: #000; }

	.player-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 24px;
		max-width: 960px;
		margin: 0 auto;
		gap: 16px;
	}

	.player-song {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}

	.player-cover {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		overflow: hidden;
		background: #f5f5f5;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.player-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.player-info {
		min-width: 0;
	}

	.player-title {
		display: block;
		font-size: 14px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.player-artist {
		display: block;
		font-size: 12px;
		color: #888;
	}

	.player-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.btn-player {
		background: none;
		border: none;
		cursor: pointer;
		color: #555;
		padding: 8px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.btn-player:hover { color: #000; background: #f0f0f0; }

	.btn-play {
		width: 44px;
		height: 44px;
		background: #1a1a1a;
		color: #fff;
	}

	.btn-play:hover { background: #333; color: #fff; }

	.player-time {
		display: flex;
		gap: 4px;
		font-size: 12px;
		color: #999;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.player-volume {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #999;
		flex-shrink: 0;
	}

	.player-volume input[type="range"] {
		-webkit-appearance: none;
		width: 80px;
		height: 4px;
		background: #eee;
		border-radius: 2px;
		outline: none;
	}

	.player-volume input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 12px;
		height: 12px;
		background: #1a1a1a;
		border-radius: 50%;
		cursor: pointer;
	}

	/* Preview notice */
	.preview-notice {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		background: #fef3c7;
		border: 1px solid #fde68a;
		border-radius: 10px;
		margin-bottom: 24px;
		font-size: 13px;
		color: #92400e;
	}
	.preview-notice span { flex: 1; }

	/* Responsive */
	@media (max-width: 640px) {
		.toolbar { flex-direction: column; align-items: stretch; }
		.toolbar-left, .toolbar-right { justify-content: center; }
		.player-volume { display: none; }
		.player-time { display: none; }
		.player-content { padding: 8px 16px; }
		.song-meta { display: none; }
		.playlist-header h1 { font-size: 24px; }
	}
	`;
}
