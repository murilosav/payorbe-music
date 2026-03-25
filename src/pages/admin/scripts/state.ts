export function stateScript(): string {
	return `
	let playlistsCache = [];
	let zipsCache = [];
	let foldersCache = [];
	let currentPlaylist = null;
	let currentZips = [];
	let currentSongs = [];
	let currentFolders = [];
	let songsPage = 1;
	var SONGS_PER_PAGE = 50;
	let pendingFiles = [];
	`;
}
