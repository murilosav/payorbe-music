export function songsScript(): string {
	return `
	async function loadDetailSongs() {
		if (!currentPlaylist) return;
		var res = await fetch('/api/playlists/' + currentPlaylist.slug + '/songs');
		currentSongs = await res.json();

		var folderSet = {};
		for (var i = 0; i < currentSongs.length; i++) {
			if (currentSongs[i].folder) folderSet[currentSongs[i].folder] = true;
		}
		currentFolders = Object.keys(folderSet).sort();
		updateFolderDropdown();
		updateSongFolderFilter();
		songFilterQuery = '';
		songFilterFolder = '';
		var searchEl = document.getElementById('songSearch');
		if (searchEl) searchEl.value = '';
		var filterEl = document.getElementById('songFolderFilter');
		if (filterEl) filterEl.value = '';
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

	function updateSongFolderFilter() {
		var filtersEl = document.getElementById('songFilters');
		var sel = document.getElementById('songFolderFilter');
		if (currentSongs.length > 0) {
			filtersEl.style.display = 'block';
			sel.innerHTML = '<option value="">Todas as pastas</option>' +
				currentFolders.map(function(f) { return '<option value="' + f + '">' + f + ' (' + currentSongs.filter(function(s){ return s.folder === f; }).length + ')</option>'; }).join('');
			if (currentFolders.length === 0) sel.style.display = 'none';
			else sel.style.display = '';
		} else {
			filtersEl.style.display = 'none';
		}
	}

	function renderSongsPage() {
		var songs = typeof getFilteredSongs === 'function' ? getFilteredSongs() : currentSongs;
		var totalSongs = currentSongs.length;
		var filteredCount = songs.length;
		var isFiltered = filteredCount !== totalSongs;

		document.getElementById('songsTitle').textContent = 'M\\u00fasicas (' + totalSongs + ')' + (isFiltered ? ' \\u2014 ' + filteredCount + ' filtrada' + (filteredCount !== 1 ? 's' : '') : '');

		if (songs.length === 0) {
			document.getElementById('songsList').innerHTML = '<div style="text-align:center;padding:24px;color:#aaa;font-size:13px;">' +
				(totalSongs === 0 ? 'Nenhuma m\\u00fasica ainda. Use o upload acima.' : 'Nenhum resultado para o filtro atual.') + '</div>';
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
			'<label for="selectAll" style="cursor:pointer;">Selecionar todas da p\\u00e1gina</label>' +
			'</div>';

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
				var trackLabel = s.track_number > 0 ? '<span style="color:#bbb;font-size:11px;margin-right:4px;">#' + s.track_number + '</span>' : '';
				html += '<div class="song-row">' +
					'<input type="checkbox" class="song-check" value="' + s.id + '" onchange="updateBulkBtn()">' +
					'<div class="song-info">' +
						'<div class="song-title">' + trackLabel + s.title + '</div>' +
						'<div class="song-meta">' + s.artist + (s.album ? ' - ' + s.album : '') + '</div>' +
					'</div>' +
					'<span class="song-size">' + sizeMB + ' MB</span>' +
				'</div>';
			}
		}

		if (totalPages > 1) {
			html += '<div class="pagination">' +
				'<button onclick="goSongsPage(' + (songsPage - 1) + ')"' + (songsPage <= 1 ? ' disabled' : '') + '>Anterior</button>' +
				'<span>P\\u00e1gina ' + songsPage + ' de ' + totalPages + ' (' + filteredCount + ' m\\u00fasicas)</span>' +
				'<button onclick="goSongsPage(' + (songsPage + 1) + ')"' + (songsPage >= totalPages ? ' disabled' : '') + '>Pr\\u00f3xima</button>' +
			'</div>';
		}

		document.getElementById('songsList').innerHTML = html;
		document.getElementById('bulkDeleteBtn').style.display = 'none';
	}

	function goSongsPage(page) {
		songsPage = page;
		renderSongsPage();
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
		var delBtn = document.getElementById('bulkDeleteBtn');
		var renBtn = document.getElementById('bulkRenameBtn');
		if (ids.length > 0) {
			delBtn.style.display = 'inline-flex';
			delBtn.textContent = 'Excluir ' + ids.length + ' selecionada' + (ids.length !== 1 ? 's' : '');
			renBtn.style.display = 'inline-flex';
			renBtn.textContent = 'Renomear ' + ids.length + ' selecionada' + (ids.length !== 1 ? 's' : '');
		} else {
			delBtn.style.display = 'none';
			renBtn.style.display = 'none';
			hideBulkRename();
		}
	}

	function showBulkRename() {
		document.getElementById('bulkRenameBox').style.display = 'block';
		var input = document.getElementById('bulkRenamePrefix');
		input.value = '';
		input.focus();
	}

	function hideBulkRename() {
		document.getElementById('bulkRenameBox').style.display = 'none';
	}

	async function applyBulkRename() {
		var prefix = document.getElementById('bulkRenamePrefix').value.trim();
		if (!prefix) { toast('Digite um nome.', 'error'); return; }
		var ids = getSelectedSongIds();
		if (ids.length === 0) { toast('Nenhuma m\\u00fasica selecionada.', 'error'); return; }

		var res = await fetch('/api/songs/bulk-rename', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids: ids, prefix: prefix })
		});

		if (res.ok) {
			toast(ids.length + ' m\\u00fasica' + (ids.length !== 1 ? 's' : '') + ' renomeada' + (ids.length !== 1 ? 's' : '') + '.');
			hideBulkRename();
			loadDetailSongs();
		} else {
			toast('Erro ao renomear.', 'error');
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
		if (!confirm('Excluir ' + ids.length + ' m\\u00fasica' + (ids.length !== 1 ? 's' : '') + '?')) return;

		var res = await fetch('/api/songs/bulk-delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids: ids })
		});

		if (res.ok) {
			toast(ids.length + ' m\\u00fasica' + (ids.length !== 1 ? 's' : '') + ' exclu\\u00edda' + (ids.length !== 1 ? 's' : '') + '.');
			loadDetailSongs();
			loadDetailZips();
		} else {
			toast('Erro ao excluir.', 'error');
		}
	}
	`;
}
