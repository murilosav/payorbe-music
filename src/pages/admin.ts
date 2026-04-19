import { adminStyles } from './admin/styles';
import { adminHtml } from './admin/html';
import { stateScript } from './admin/scripts/state';
import { toastScript } from './admin/scripts/toast';
import { viewsScript } from './admin/scripts/views';
import { playlistListScript } from './admin/scripts/playlist-list';
import { playlistCrudScript } from './admin/scripts/playlist-crud';
import { folderCrudScript } from './admin/scripts/folder-crud';
import { folderDragScript } from './admin/scripts/folder-drag';
import { songsScript } from './admin/scripts/songs';
import { zipStatusScript } from './admin/scripts/zip-status';
import { fileDetectionScript } from './admin/scripts/file-detection';
import { id3ParserScript } from './admin/scripts/id3-parser';
import { uploadPrepareScript } from './admin/scripts/upload-prepare';
import { uploadEngineScript } from './admin/scripts/upload-engine';
import { zipGenerationScript } from './admin/scripts/zip-generation';
import { searchScript } from './admin/scripts/search';
import { duplicatesScript } from './admin/scripts/duplicates';
import { tempLinksScript } from './admin/scripts/temp-links';
import { initScript } from './admin/scripts/init';

export function renderAdminPage(): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Admin - Patacos</title>
	<link rel="icon" href="/favicon.ico" type="image/x-icon">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
	<style>
	${adminStyles()}
	</style>
</head>
<body>
	${adminHtml()}
	<script>
	${stateScript()}
	${toastScript()}
	${id3ParserScript()}
	${zipGenerationScript()}
	${viewsScript()}
	${playlistListScript()}
	${playlistCrudScript()}
	${folderCrudScript()}
	${folderDragScript()}
	${searchScript()}
	${duplicatesScript()}
	${tempLinksScript()}
	${songsScript()}
	${zipStatusScript()}
	${fileDetectionScript()}
	${uploadPrepareScript()}
	${uploadEngineScript()}
	${initScript()}
	</script>
</body>
</html>`;
}
