export function folderDragScript(): string {
	return `
	var dragPlaylistIdx = null;

	function onDragStart(e, idx) {
		dragPlaylistIdx = idx;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', idx);
		e.target.closest('.pl-card').classList.add('dragging');
	}

	function onDragEnd(e) {
		e.target.closest('.pl-card').classList.remove('dragging');
		dragPlaylistIdx = null;
		document.querySelectorAll('.drag-over').forEach(function(el) { el.classList.remove('drag-over'); });
	}

	function onFolderDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		e.currentTarget.classList.add('drag-over');
	}

	function onFolderDragLeave(e) {
		if (!e.currentTarget.contains(e.relatedTarget)) {
			e.currentTarget.classList.remove('drag-over');
		}
	}

	async function onFolderDrop(e, folderId) {
		e.preventDefault();
		e.currentTarget.classList.remove('drag-over');
		if (dragPlaylistIdx === null) return;
		var playlist = playlistsCache[dragPlaylistIdx];
		if (!playlist) return;
		var fids = playlist.folder_ids || [];
		if (fids.indexOf(folderId) !== -1) return;
		await movePlaylistToFolder(playlist.id, folderId);
	}

	function onStandaloneDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		e.currentTarget.classList.add('drag-over');
	}

	function onStandaloneDragLeave(e) {
		if (!e.currentTarget.contains(e.relatedTarget)) {
			e.currentTarget.classList.remove('drag-over');
		}
	}

	async function onStandaloneDrop(e) {
		e.preventDefault();
		e.currentTarget.classList.remove('drag-over');
		if (dragPlaylistIdx === null) return;
		var playlist = playlistsCache[dragPlaylistIdx];
		var fids = playlist ? (playlist.folder_ids || []) : [];
		if (!playlist || fids.length === 0) return;
		await movePlaylistToFolder(playlist.id, null);
	}

	async function movePlaylistToFolder(playlistId, folderId) {
		try {
			var res = await fetch('/api/playlists/' + playlistId + '/folder', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folder_id: folderId })
			});
			if (!res.ok) { toast('Erro ao mover playlist', 'error'); return; }
			toast(folderId ? 'Playlist adicionada \\u00e0 pasta!' : 'Playlist removida de todas as pastas!');
			loadPlaylists();
		} catch (e) { toast('Erro: ' + e.message, 'error'); }
	}

	async function reorderInFolder(playlistId, folderId, direction) {
		// Build current ordered list of playlists in this folder
		var entries = [];
		for (var i = 0; i < playlistsCache.length; i++) {
			var p = playlistsCache[i];
			var fids = p.folder_ids || [];
			if (fids.indexOf(folderId) === -1) continue;
			var pos = ((p.folder_positions || {})[folderId]) || 0;
			entries.push({ id: p.id, pos: pos, name: p.name || '' });
		}
		entries.sort(function(a, b) {
			if (a.pos !== b.pos) return a.pos - b.pos;
			return a.name.localeCompare(b.name);
		});

		var idx = -1;
		for (var j = 0; j < entries.length; j++) {
			if (entries[j].id === playlistId) { idx = j; break; }
		}
		if (idx === -1) return;
		var target = idx + direction;
		if (target < 0 || target >= entries.length) return;

		var tmp = entries[idx];
		entries[idx] = entries[target];
		entries[target] = tmp;

		var ids = entries.map(function(e) { return e.id; });
		try {
			var res = await fetch('/api/folders/' + folderId + '/reorder', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playlist_ids: ids })
			});
			if (!res.ok) { toast('Erro ao reordenar', 'error'); return; }
			// Update local cache to avoid full reload flicker
			for (var k = 0; k < ids.length; k++) {
				for (var m = 0; m < playlistsCache.length; m++) {
					if (playlistsCache[m].id === ids[k]) {
						playlistsCache[m].folder_positions = playlistsCache[m].folder_positions || {};
						playlistsCache[m].folder_positions[folderId] = k;
						break;
					}
				}
			}
			loadPlaylists();
		} catch (e) { toast('Erro: ' + e.message, 'error'); }
	}

	async function removeFromFolder(playlistId, folderId) {
		try {
			var res = await fetch('/api/playlists/' + playlistId + '/folder/' + folderId, { method: 'DELETE' });
			if (!res.ok) { toast('Erro ao remover da pasta', 'error'); return; }
			toast('Playlist removida da pasta!');
			loadPlaylists();
		} catch (e) { toast('Erro: ' + e.message, 'error'); }
	}
	`;
}
