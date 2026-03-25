export function initScript(): string {
	return `
	loadPlaylists();

	// Keyboard shortcuts
	document.addEventListener('keydown', function(e) {
		// Escape: go back from detail view
		if (e.key === 'Escape' && currentPlaylist) {
			var active = document.activeElement;
			if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
				active.blur();
			} else {
				closeDetail();
			}
		}
		// Ctrl+K / Cmd+K: focus search
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			var search = currentPlaylist ? document.getElementById('songSearch') : document.getElementById('adminSearch');
			if (search) search.focus();
		}
	});
	`;
}
