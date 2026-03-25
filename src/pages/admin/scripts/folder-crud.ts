export function folderCrudScript(): string {
	return `
	async function createFolder() {
		var name = document.getElementById('folderName').value.trim();
		var slug = document.getElementById('folderSlug').value.trim();
		var desc = document.getElementById('folderDesc').value.trim();
		if (!name || !slug) { toast('Preencha nome e slug', 'error'); return; }
		try {
			var res = await fetch('/api/folders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name, slug: slug, description: desc })
			});
			var data = await res.json();
			if (!res.ok) { toast(data.error || 'Erro ao criar pasta', 'error'); return; }
			toast('Pasta criada!');
			document.getElementById('folderName').value = '';
			document.getElementById('folderSlug').value = '';
			document.getElementById('folderDesc').value = '';
			toggleCreateFolderForm();
			loadPlaylists();
		} catch (e) { toast('Erro: ' + e.message, 'error'); }
	}

	async function deleteFolder(id, name) {
		if (!confirm('Excluir pasta "' + name + '"? As playlists dentro dela ficar\\u00e3o sem pasta.')) return;
		try {
			toast('Excluindo pasta "' + name + '"...', 'info');
			var res = await fetch('/api/folders/' + id, { method: 'DELETE' });
			if (!res.ok) { var d = await res.json(); toast(d.error || 'Erro ao excluir', 'error'); return; }
			toast('Pasta exclu\\u00edda!');
			await loadPlaylists();
		} catch (e) { toast('Erro: ' + e.message, 'error'); }
	}

	function toggleFolderEdit(id) {
		var el = document.getElementById('folderEdit' + id);
		el.classList.toggle('open');
	}

	async function saveFolder(id) {
		var name = document.getElementById('feditName' + id).value.trim();
		var slug = document.getElementById('feditSlug' + id).value.trim();
		var desc = document.getElementById('feditDesc' + id).value.trim();
		var jwtSecret = document.getElementById('feditJwt' + id).value.trim();
		if (!name || !slug) { toast('Nome e slug obrigat\\u00f3rios.', 'error'); return; }
		var res = await fetch('/api/folders/' + id, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: name, slug: slug, description: desc, jwt_secret: jwtSecret || null })
		});
		if (res.ok) {
			toast('Pasta atualizada!');
			loadPlaylists();
		} else {
			var err = await res.json();
			toast(err.error || 'Erro ao salvar pasta.', 'error');
		}
	}
	`;
}
