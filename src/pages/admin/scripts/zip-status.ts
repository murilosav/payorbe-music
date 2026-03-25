export function zipStatusScript(): string {
	return `
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
			badgeEl.innerHTML = '<span class="badge badge-muted">Sem m\\u00fasicas</span>';
			infoEl.textContent = 'Adicione m\\u00fasicas primeiro.';
			btn.textContent = 'Gerar ZIP';
			btn.disabled = true;
		} else if (zips.length === 0) {
			badgeEl.innerHTML = '<span class="badge badge-muted">N\\u00e3o gerado</span>';
			infoEl.textContent = songCount + ' m\\u00fasica' + (songCount !== 1 ? 's' : '') + ' sem ZIP.';
			btn.textContent = 'Gerar ZIP';
			btn.disabled = false;
		} else if (zipSongCount < songCount) {
			var diff = songCount - zipSongCount;
			badgeEl.innerHTML = '<span class="badge badge-warning">Desatualizado</span>';
			infoEl.textContent = 'ZIP tem ' + zipSongCount + ' m\\u00fasicas, mas a playlist tem ' + songCount + '. ' + diff + ' m\\u00fasica' + (diff !== 1 ? 's' : '') + ' adicionada' + (diff !== 1 ? 's' : '') + ' desde o \\u00faltimo ZIP.';
			btn.textContent = 'Regerar ZIP';
			btn.disabled = false;
		} else {
			badgeEl.innerHTML = '<span class="badge badge-success">Pronto</span>';
			infoEl.textContent = 'ZIP com ' + zipSongCount + ' m\\u00fasicas (' + zipSizeMB + ' MB). Pronto para download.';
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
		var statusEl = document.getElementById('zipStatus');
		var bar = document.getElementById('zipBar');

		btn.disabled = true;
		btn.textContent = 'Gerando...';
		progress.style.display = 'block';
		statusEl.textContent = 'Buscando m\\u00fasicas...';
		bar.style.width = '0%';

		try {
			var songsRes = await fetchRetry('/api/playlists/' + slug + '/songs', {}, 3);
			var songs = await songsRes.json();
			if (songs.length === 0) {
				statusEl.textContent = 'Nenhuma m\\u00fasica.';
				btn.disabled = false;
				return;
			}

			// Delete old zips
			await fetch('/api/playlists/' + playlistId + '/zips', { method: 'DELETE' });

			// Streaming ZIP: processes one song at a time (low memory)
			var result = await streamingZipGenerate(playlistId, songs, function(text, pct) {
				statusEl.textContent = text;
				bar.style.width = pct + '%';
			}, currentPlaylist.name);

			toast('ZIP gerado com sucesso! (' + result.songCount + ' m\\u00fasicas)');
			bar.style.width = '100%';
			statusEl.textContent = 'Conclu\\u00eddo!';
			setTimeout(function() { progress.style.display = 'none'; }, 2000);
			loadDetailZips();
			currentPlaylist.song_count = result.songCount;
		} catch (err) {
			statusEl.textContent = 'Erro: ' + err.message;
			statusEl.style.color = '#ef4444';
			toast('Erro ao gerar ZIP: ' + err.message, 'error');
		}
		btn.disabled = false;
	}
	`;
}
