export function searchScript(): string {
	return `
	function filterAdminList() {
		var query = document.getElementById('adminSearch').value.toLowerCase().trim();
		var container = document.getElementById('playlistsList');
		var folders = container.querySelectorAll('.folder-drop-zone');
		var standaloneCards = container.querySelectorAll('.standalone-zone .pl-card, .pl-card:not(.folder-drop-zone .pl-card):not(.standalone-zone .pl-card)');

		// Filter folders
		for (var i = 0; i < folders.length; i++) {
			var folderEl = folders[i];
			var folderName = folderEl.querySelector('.pl-name');
			var folderCards = folderEl.querySelectorAll('.pl-card');
			var folderVisible = false;

			if (!query) {
				folderEl.style.display = '';
				for (var j = 0; j < folderCards.length; j++) folderCards[j].style.display = '';
				continue;
			}

			// Check if folder name matches
			if (folderName && folderName.textContent.toLowerCase().indexOf(query) !== -1) {
				folderEl.style.display = '';
				for (var j = 0; j < folderCards.length; j++) folderCards[j].style.display = '';
				continue;
			}

			// Check individual playlists inside folder
			for (var j = 0; j < folderCards.length; j++) {
				var cardName = folderCards[j].querySelector('.pl-name');
				if (cardName && cardName.textContent.toLowerCase().indexOf(query) !== -1) {
					folderCards[j].style.display = '';
					folderVisible = true;
				} else {
					folderCards[j].style.display = 'none';
				}
			}
			folderEl.style.display = folderVisible ? '' : 'none';
		}

		// Filter standalone playlists
		var standaloneZone = container.querySelector('.standalone-zone');
		if (standaloneZone) {
			var sCards = standaloneZone.querySelectorAll('.pl-card');
			var anyVisible = false;
			for (var k = 0; k < sCards.length; k++) {
				var name = sCards[k].querySelector('.pl-name');
				if (!query || (name && name.textContent.toLowerCase().indexOf(query) !== -1)) {
					sCards[k].style.display = '';
					anyVisible = true;
				} else {
					sCards[k].style.display = 'none';
				}
			}
		}
	}

	var songFilterQuery = '';
	var songFilterFolder = '';

	function filterSongs() {
		songFilterQuery = (document.getElementById('songSearch').value || '').toLowerCase().trim();
		songFilterFolder = document.getElementById('songFolderFilter').value;
		songsPage = 1;
		renderSongsPage();
	}

	function getFilteredSongs() {
		var songs = currentSongs;
		if (songFilterFolder) {
			songs = songs.filter(function(s) { return s.folder === songFilterFolder; });
		}
		if (songFilterQuery) {
			songs = songs.filter(function(s) {
				return (s.title || '').toLowerCase().indexOf(songFilterQuery) !== -1 ||
					(s.artist || '').toLowerCase().indexOf(songFilterQuery) !== -1 ||
					(s.album || '').toLowerCase().indexOf(songFilterQuery) !== -1;
			});
		}
		return songs;
	}
	`;
}
