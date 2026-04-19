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
		document.querySelectorAll('.drop-before, .drop-after').forEach(function(el) { el.classList.remove('drop-before', 'drop-after'); });
	}

	function onCardDragOver(e, targetIdx, folderId) {
		if (dragPlaylistIdx === null || dragPlaylistIdx === targetIdx) return;
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer.dropEffect = 'move';
		var card = e.currentTarget;
		var rect = card.getBoundingClientRect();
		var isBefore = e.clientY < rect.top + rect.height / 2;
		document.querySelectorAll('.pl-card.drop-before, .pl-card.drop-after').forEach(function(el) {
			if (el !== card) el.classList.remove('drop-before', 'drop-after');
		});
		card.classList.toggle('drop-before', isBefore);
		card.classList.toggle('drop-after', !isBefore);
	}

	function onCardDragLeave(e) {
		if (!e.currentTarget.contains(e.relatedTarget)) {
			e.currentTarget.classList.remove('drop-before', 'drop-after');
		}
	}

	async function onCardDrop(e, targetIdx, folderId) {
		e.preventDefault();
		e.stopPropagation();
		var card = e.currentTarget;
		var isBefore = card.classList.contains('drop-before');
		card.classList.remove('drop-before', 'drop-after');
		if (dragPlaylistIdx === null || dragPlaylistIdx === targetIdx) return;

		var srcPlaylist = playlistsCache[dragPlaylistIdx];
		var tgtPlaylist = playlistsCache[targetIdx];
		if (!srcPlaylist || !tgtPlaylist) return;

		var crossFolder = (srcPlaylist.folder_ids || []).indexOf(folderId) === -1;

		var entries = [];
		for (var i = 0; i < playlistsCache.length; i++) {
			var p = playlistsCache[i];
			if ((p.folder_ids || []).indexOf(folderId) === -1) continue;
			if (p.id === srcPlaylist.id) continue;
			var pos = ((p.folder_positions || {})[folderId]) || 0;
			entries.push({ id: p.id, pos: pos, name: p.name || '' });
		}
		entries.sort(function(a, b) {
			if (a.pos !== b.pos) return a.pos - b.pos;
			return a.name.localeCompare(b.name);
		});

		var tgtIdx = -1;
		for (var j = 0; j < entries.length; j++) {
			if (entries[j].id === tgtPlaylist.id) { tgtIdx = j; break; }
		}
		if (tgtIdx === -1) return;
		var insertAt = isBefore ? tgtIdx : tgtIdx + 1;
		entries.splice(insertAt, 0, { id: srcPlaylist.id });
		var ids = entries.map(function(x) { return x.id; });

		try {
			if (crossFolder) {
				var addRes = await fetch('/api/playlists/' + srcPlaylist.id + '/folder', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ folder_id: folderId })
				});
				if (!addRes.ok) { toast('Erro ao mover playlist', 'error'); return; }
			}
			var res = await fetch('/api/folders/' + folderId + '/reorder', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playlist_ids: ids })
			});
			if (!res.ok) { toast('Erro ao reordenar', 'error'); return; }
			loadPlaylists();
		} catch (err) { toast('Erro: ' + err.message, 'error'); }
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
