export function playlistListScript(): string {
	return `
	function renderPlaylistCard(p, idx, inFolderId) {
		var zips = zipsCache[idx] || [];
		var songCount = p.song_count || 0;
		var totalSizeMB = ((p.total_size || 0) / (1024 * 1024)).toFixed(0);
		var totalZipSize = zips.reduce(function(s, z) { return s + (z.file_size || 0); }, 0);
		var zipSizeMB = (totalZipSize / (1024 * 1024)).toFixed(0);
		var zipSongCount = zips.reduce(function(s, z) { return s + (z.song_count || 0); }, 0);

		var downloads = p.download_count || 0;

		var zipBadge = '';
		if (songCount === 0) zipBadge = '<span class="badge badge-muted">Vazia</span>';
		else if (zips.length === 0) zipBadge = '<span class="badge badge-muted">Sem ZIP</span>';
		else if (zipSongCount < songCount) zipBadge = '<span class="badge badge-warning">ZIP desatualizado</span>';
		else zipBadge = '<span class="badge badge-success">ZIP ' + zipSizeMB + ' MB</span>';

		var hasCover = !!p.cover_r2_key;
		var coverHtml = hasCover
			? '<img src="/api/playlists/' + p.id + '/cover-preview" style="width:100%;height:100%;object-fit:cover;">'
			: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

		var hasJwt = !!p.jwt_secret;
		var safeName = (p.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

		return '<div class="pl-card" draggable="true" ondragstart="onDragStart(event,'+idx+')" ondragend="onDragEnd(event)">' +
			'<div class="pl-card-top">' +
				'<div class="drag-handle" title="Arraste para mover"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg></div>' +
				'<div class="pl-cover">' + coverHtml + '</div>' +
				'<div class="pl-info">' +
					'<div class="pl-name">' + p.name + '</div>' +
					'<div class="pl-stats">' +
						'<span>' + songCount + ' m\\u00fasica' + (songCount !== 1 ? 's' : '') + '</span>' +
						'<span>&middot;</span><span>' + totalSizeMB + ' MB</span>' +
						'<span>&middot;</span>' + zipBadge +
						(downloads > 0 ? '<span>&middot;</span><span style="color:#6366f1;font-weight:500;">' + downloads + ' download' + (downloads !== 1 ? 's' : '') + '</span>' : '') +
						(hasJwt ? '<span>&middot;</span><span class="badge badge-success" style="font-size:10px;padding:2px 8px;">JWT</span>' : '') +
					'</div>' +
				'</div>' +
				'<div class="pl-actions">' +
					(inFolderId ? '<button class="btn btn-ghost btn-sm" style="color:#ef4444;font-size:11px;" onclick="removeFromFolder('+p.id+','+inFolderId+')" title="Remover desta pasta">\\u2716</button>' : '') +
					'<button class="btn btn-primary btn-sm" onclick="openDetail('+idx+')">Gerenciar</button>' +
					'<button class="btn btn-danger btn-sm" data-id="'+p.id+'" data-name="'+safeName+'" onclick="deletePlaylist(+this.dataset.id, this.dataset.name)">Excluir</button>' +
				'</div>' +
			'</div>' +
		'</div>';
	}

	async function loadPlaylists() {
		var results = await Promise.all([
			fetch('/api/playlists?limit=100'),
			fetch('/api/folders')
		]);
		var playlistsData = await results[0].json();
		playlistsCache = playlistsData.results || playlistsData;
		foldersCache = await results[1].json();

		zipsCache = await Promise.all(playlistsCache.map(function(p) {
			return fetch('/api/playlists/' + p.id + '/zips').then(function(r) { return r.json(); }).catch(function() { return []; });
		}));

		document.getElementById('playlistCount').textContent = foldersCache.length + ' pasta' + (foldersCache.length !== 1 ? 's' : '') + ' \\u00b7 ' + playlistsCache.length + ' playlist' + (playlistsCache.length !== 1 ? 's' : '');

		var container = document.getElementById('playlistsList');
		var html = '';

		for (var fi = 0; fi < foldersCache.length; fi++) {
			var folder = foldersCache[fi];
			var folderLink = location.origin + '/' + folder.slug;
			var folderPlaylists = [];
			for (var pi = 0; pi < playlistsCache.length; pi++) {
				var fids = playlistsCache[pi].folder_ids || [];
				if (fids.indexOf(folder.id) !== -1) folderPlaylists.push(pi);
			}

			var hasJwt = !!(folder.jwt_secret);
			var safeFolderName = (folder.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
			html += '<div class="folder-drop-zone" data-folder-id="'+folder.id+'" ondragover="onFolderDragOver(event)" ondragleave="onFolderDragLeave(event)" ondrop="onFolderDrop(event,'+folder.id+')" style="margin-bottom:16px;">' +
				'<div class="folder-card">' +
					'<div class="pl-card-top">' +
						'<div style="font-size:22px;width:44px;text-align:center;flex-shrink:0;">\\ud83d\\udcc1</div>' +
						'<div class="pl-info">' +
							'<div class="pl-name">' + folder.name + '</div>' +
							'<div class="pl-stats">' +
								'<span>' + folderPlaylists.length + ' playlist' + (folderPlaylists.length !== 1 ? 's' : '') + '</span>' +
								(folder.description ? '<span>&middot;</span><span>' + folder.description + '</span>' : '') +
								'<span>&middot;</span><span style="color:#bbb;font-family:monospace;font-size:11px;">/' + folder.slug + '</span>' +
								(hasJwt ? '<span>&middot;</span><span class="badge badge-success" style="font-size:10px;padding:2px 8px;">JWT</span>' : '') +
							'</div>' +
						'</div>' +
						'<div class="pl-actions">' +
							'<button class="btn btn-ghost btn-sm" onclick="toggleFolderEdit('+folder.id+')">' +
								'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
								' Editar</button>' +
							'<button class="btn btn-ghost btn-sm" style="color:#6366f1;" onclick="openTempLinks(\\''+folder.slug+'\\', \\''+safeFolderName+'\\')">Gerar Link</button>' +
							'<button class="btn btn-ghost btn-sm" onclick="copyLink(\\''+folderLink+'\\')">Link</button>' +
							'<button class="btn btn-danger btn-sm" data-id="'+folder.id+'" data-name="'+safeFolderName+'" onclick="deleteFolder(+this.dataset.id, this.dataset.name)">Excluir</button>' +
						'</div>' +
					'</div>' +
				'</div>' +
				'<div id="folderEdit'+folder.id+'" class="folder-edit-panel">' +
					'<div class="form-row">' +
						'<div class="form-group" style="flex:2;"><label>Nome</label><input type="text" id="feditName'+folder.id+'" value="'+folder.name.replace(/"/g, '&quot;')+'"></div>' +
						'<div class="form-group" style="flex:1;"><label>Slug</label><input type="text" id="feditSlug'+folder.id+'" value="'+folder.slug+'"></div>' +
					'</div>' +
					'<div class="form-row">' +
						'<div class="form-group"><label>Descri\\u00e7\\u00e3o</label><input type="text" id="feditDesc'+folder.id+'" value="'+(folder.description||'').replace(/"/g, '&quot;')+'"></div>' +
					'</div>' +
					'<div class="form-group"><label>JWT Secrets (1 por linha)</label>' +
						'<textarea id="feditJwt'+folder.id+'" placeholder="Cole as chaves secretas do checkout" rows="2" style="font-size:12px;font-family:monospace;width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;resize:vertical;line-height:1.5;">'+(folder.jwt_secret||'')+'</textarea>' +
					'</div>' +
					'<div class="edit-actions">' +
						'<button class="btn btn-ghost btn-sm" onclick="toggleFolderEdit('+folder.id+')">Cancelar</button>' +
						'<button class="btn btn-primary btn-sm" onclick="saveFolder('+folder.id+')">Salvar</button>' +
					'</div>' +
				'</div>' +
				'<div class="folder-drop-hint">Solte aqui para mover para esta pasta</div>' +
				'<div class="folder-children">';

			for (var fpi = 0; fpi < folderPlaylists.length; fpi++) {
				html += renderPlaylistCard(playlistsCache[folderPlaylists[fpi]], folderPlaylists[fpi], folder.id);
			}

			if (folderPlaylists.length === 0) {
				html += '<div class="folder-empty">Arraste playlists para c\\u00e1</div>';
			}

			html += '</div></div>';
		}

		var standalone = [];
		for (var pi = 0; pi < playlistsCache.length; pi++) {
			var fids = playlistsCache[pi].folder_ids || [];
			if (fids.length === 0) standalone.push(pi);
		}

		if (foldersCache.length > 0) {
			html += '<div class="standalone-zone" ondragover="onStandaloneDragOver(event)" ondragleave="onStandaloneDragLeave(event)" ondrop="onStandaloneDrop(event)">';
			html += '<div style="font-size:12px;font-weight:600;color:#aaa;padding:12px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Sem pasta' + (standalone.length > 0 ? '' : ' \\u2014 arraste playlists para c\\u00e1 para remover de uma pasta') + '</div>';
			for (var si = 0; si < standalone.length; si++) {
				html += renderPlaylistCard(playlistsCache[standalone[si]], standalone[si]);
			}
			html += '</div>';
		} else if (standalone.length > 0) {
			for (var si = 0; si < standalone.length; si++) {
				html += renderPlaylistCard(playlistsCache[standalone[si]], standalone[si]);
			}
		}

		if (playlistsCache.length === 0 && foldersCache.length === 0) {
			html = '<div style="text-align:center;padding:48px;color:#aaa;font-size:14px;">Nenhuma pasta ou playlist criada ainda.</div>';
		}

		container.innerHTML = html;
	}
	`;
}
