export function viewsScript(): string {
	return `
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
		var form = document.getElementById('createForm');
		var btn = document.getElementById('createToggleBtn');
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
		var playlist = playlistsCache[idx];
		var zips = zipsCache[idx] || [];
		currentPlaylist = playlist;
		currentZips = zips;

		document.getElementById('listView').style.display = 'none';
		document.getElementById('detailView').style.display = 'block';

		document.getElementById('detailName').value = playlist.name;
		document.getElementById('detailSlug').value = playlist.slug;
		document.getElementById('detailDesc').value = playlist.description || '';
		document.getElementById('detailJwtSecret').value = playlist.jwt_secret || '';

		var link = location.origin + '/' + playlist.slug;
		document.getElementById('detailLink').value = link;
		document.getElementById('detailOpenLink').href = link;

		var coverEl = document.getElementById('detailCover');
		if (playlist.cover_r2_key) {
			coverEl.innerHTML = '<img src="/api/playlists/' + playlist.id + '/cover-preview" style="width:100%;height:100%;object-fit:cover;">';
		} else {
			coverEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
		}

		document.getElementById('saveBtn').style.display = 'none';
		detailSlugManual = false;

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

	var detailSlugManual = false;

	function onDetailChange() {
		document.getElementById('saveBtn').style.display = 'inline-flex';
	}

	function onDetailNameChange() {
		onDetailChange();
		if (!detailSlugManual) {
			var name = document.getElementById('detailName').value;
			var slug = name.toLowerCase()
				.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
				.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
			document.getElementById('detailSlug').value = slug;
			updateDetailLink();
		}
	}

	function onDetailSlugChange() {
		detailSlugManual = true;
		onDetailChange();
		updateDetailLink();
	}

	function updateDetailLink() {
		var slug = document.getElementById('detailSlug').value;
		var link = location.origin + '/' + slug;
		document.getElementById('detailLink').value = link;
		document.getElementById('detailOpenLink').href = link;
	}
	`;
}
