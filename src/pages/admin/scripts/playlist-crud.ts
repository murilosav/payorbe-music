export function playlistCrudScript(): string {
	return `
	async function createPlaylist() {
		var name = document.getElementById('playlistName').value.trim();
		var slug = document.getElementById('playlistSlug').value.trim();
		var desc = document.getElementById('playlistDesc').value.trim();

		if (!name || !slug) { toast('Nome e slug s\\u00e3o obrigat\\u00f3rios.', 'error'); return; }

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
		var slug = document.getElementById('detailSlug').value.trim();
		var desc = document.getElementById('detailDesc').value.trim();
		var jwtSecret = document.getElementById('detailJwtSecret').value.trim();

		if (!name) { toast('Nome n\\u00e3o pode ser vazio.', 'error'); return; }
		if (!slug) { toast('Slug n\\u00e3o pode ser vazio.', 'error'); return; }

		var res = await fetch('/api/playlists/' + currentPlaylist.id, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: name, slug: slug, description: desc, jwt_secret: jwtSecret || null })
		});

		if (res.ok) {
			var updated = await res.json();
			currentPlaylist.name = updated.name;
			currentPlaylist.slug = updated.slug;
			currentPlaylist.description = updated.description;
			var link = location.origin + '/' + updated.slug;
			document.getElementById('detailLink').value = link;
			document.getElementById('detailOpenLink').href = link;
			document.getElementById('saveBtn').style.display = 'none';
			toast('Playlist atualizada!');
		} else {
			var err = await res.json();
			toast(err.error || 'Erro ao salvar.', 'error');
		}
	}

	async function deletePlaylist(id, name) {
		if (!confirm('Excluir "' + name + '" e todas as suas m\\u00fasicas?')) return;
		toast('Excluindo "' + name + '"...', 'info');
		var res = await fetch('/api/playlists/' + id, { method: 'DELETE' });
		if (res.ok) {
			toast('Playlist exclu\\u00edda!');
		} else {
			toast('Erro ao excluir playlist.', 'error');
		}
		await loadPlaylists();
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

	document.getElementById('folderName').addEventListener('input', function(e) {
		var slug = e.target.value.toLowerCase()
			.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
		document.getElementById('folderSlug').value = slug;
	});
	`;
}
