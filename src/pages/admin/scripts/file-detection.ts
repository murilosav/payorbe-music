export function fileDetectionScript(): string {
	return `
	var AUDIO_EXT = ['.mp3','.mp4','.m4a','.wav','.flac','.ogg','.aac','.wma','.opus'];

	function isAudioFile(name) {
		return AUDIO_EXT.some(function(ext) { return name.toLowerCase().endsWith(ext); });
	}

	function isZipFile(name) {
		return name.toLowerCase().endsWith('.zip');
	}

	async function extractZipFromBuffer(buffer, fileName) {
		var results = [];
		if (typeof JSZip === 'undefined') {
			toast('Erro: biblioteca JSZip n\\u00e3o carregou. Recarregue a p\\u00e1gina.', 'error');
			return results;
		}
		var zip;
		try {
			zip = await JSZip.loadAsync(buffer);
		} catch (err) {
			toast('Erro ao abrir ' + fileName + ': arquivo ZIP inv\\u00e1lido ou corrompido.', 'error');
			console.error('JSZip.loadAsync failed for ' + fileName + ':', err);
			return results;
		}
		var entries = Object.keys(zip.files);
		var audioEntries = entries.filter(function(path) {
			return !zip.files[path].dir && isAudioFile(path);
		});
		if (audioEntries.length === 0) {
			toast(fileName + ': nenhum arquivo de \\u00e1udio encontrado no ZIP (' + entries.length + ' arquivos total).', 'error');
			return results;
		}
		toast('Extraindo ' + audioEntries.length + ' arquivos de ' + fileName + '...', 'info');
		var failed = 0;
		for (var i = 0; i < audioEntries.length; i++) {
			var path = audioEntries[i];
			try {
				var blob = await zip.files[path].async('blob');
				var fName = path.split('/').pop();
				var ext = fName.split('.').pop().toLowerCase();
				var mimeTypes = { mp3:'audio/mpeg', m4a:'audio/mp4', mp4:'audio/mp4', wav:'audio/wav', flac:'audio/flac', ogg:'audio/ogg', aac:'audio/aac', wma:'audio/x-ms-wma', opus:'audio/opus' };
				var file = new File([blob], fName, { type: mimeTypes[ext] || 'audio/mpeg' });
				var pathParts = path.split('/');
				pathParts.pop();
				if (pathParts.length > 0 && pathParts[0]) pathParts.shift();
				var folder = pathParts.join(' / ');
				results.push({ file: file, folder: folder });
			} catch (err) {
				failed++;
				console.error('Failed to extract ' + path + ' from ' + fileName + ':', err);
			}
		}
		if (failed > 0) {
			toast(fileName + ': ' + failed + ' arquivo(s) falharam na extra\\u00e7\\u00e3o.', 'error');
		}
		return results;
	}

	async function extractZipFiles(zipFile) {
		try {
			var buffer = await zipFile.arrayBuffer();
			return await extractZipFromBuffer(buffer, zipFile.name);
		} catch (err) {
			toast('Erro ao ler ' + zipFile.name + ': ' + err.message, 'error');
			return [];
		}
	}

	// Drag and drop
	var uploadArea = document.getElementById('uploadArea');
	uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('dragover'); });
	uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('dragover'); });
	uploadArea.addEventListener('drop', async function(e) {
		e.preventDefault();
		uploadArea.classList.remove('dragover');
		if (!currentPlaylist) { toast('Abra uma playlist primeiro.', 'error'); return; }

		var items = e.dataTransfer.items;
		var allFiles = [];
		var zipFiles = [];
		var hasDirectories = false;
		var entryList = [];
		var rawFiles = [];

		// Collect SYNCHRONOUSLY before any async work
		if (items && items.length > 0) {
			for (var i = 0; i < items.length; i++) {
				var entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
				if (entry) {
					if (entry.isDirectory) {
						entryList.push(entry);
						hasDirectories = true;
					}
				}
				if (items[i].kind === 'file') {
					var f = items[i].getAsFile();
					if (f) rawFiles.push(f);
				}
			}
		}
		if (rawFiles.length === 0) {
			var droppedFiles = e.dataTransfer.files;
			for (var i = 0; i < droppedFiles.length; i++) rawFiles.push(droppedFiles[i]);
		}

		// Separate ZIPs from audio
		for (var i = 0; i < rawFiles.length; i++) {
			var name = rawFiles[i].name || '';
			if (name.toLowerCase().endsWith('.zip')) zipFiles.push(rawFiles[i]);
			else if (isAudioFile(name)) allFiles.push({ file: rawFiles[i], folder: '' });
		}

		// Scan directories
		if (hasDirectories) {
			var foundZips = [];
			for (var j = 0; j < entryList.length; j++) {
				await readEntryRecursive(entryList[j], '', allFiles, foundZips);
			}
			for (var k = 0; k < foundZips.length; k++) zipFiles.push(foundZips[k]);
		}

		// Extract ZIPs
		if (zipFiles.length > 0) {
			toast(zipFiles.length + ' ZIP(s) encontrado(s), extraindo...', 'info');
			for (var zi = 0; zi < zipFiles.length; zi++) {
				var extracted = await extractZipFiles(zipFiles[zi]);
				for (var ze = 0; ze < extracted.length; ze++) allFiles.push(extracted[ze]);
			}
		}

		if (allFiles.length > 0) {
			toast(allFiles.length + ' arquivos de \\u00e1udio encontrados.', 'info');
			preparePending(allFiles);
		} else {
			toast('Nenhum arquivo de \\u00e1udio encontrado.', 'error');
		}
	});

	function readEntryRecursive(entry, basePath, result, zipCollector) {
		return new Promise(function(resolve) {
			if (entry.isFile) {
				entry.file(function(file) {
					if (isAudioFile(file.name)) result.push({ file: file, folder: basePath });
					else if (isZipFile(file.name) && zipCollector) zipCollector.push(file);
					resolve();
				});
			} else if (entry.isDirectory) {
				var reader = entry.createReader();
				var folderName = basePath ? basePath + ' / ' + entry.name : entry.name;
				var allEntries = [];
				function readBatch() {
					reader.readEntries(async function(entries) {
						if (entries.length === 0) {
							for (var i = 0; i < allEntries.length; i++) {
								await readEntryRecursive(allEntries[i], folderName, result, zipCollector);
							}
							resolve();
						} else {
							for (var j = 0; j < entries.length; j++) allEntries.push(entries[j]);
							readBatch();
						}
					});
				}
				readBatch();
			} else { resolve(); }
		});
	}

	async function handleFolderSelect(fileList) {
		if (!currentPlaylist) { toast('Abra uma playlist primeiro.', 'error'); return; }
		var files = [];
		var zipFiles = [];
		for (var i = 0; i < fileList.length; i++) {
			var file = fileList[i];
			if (isZipFile(file.name)) { zipFiles.push(file); continue; }
			if (!isAudioFile(file.name)) continue;
			var parts = file.webkitRelativePath.split('/');
			var folder = '';
			if (parts.length > 2) folder = parts.slice(1, -1).join(' / ');
			else if (parts.length === 2) folder = parts[0];
			files.push({ file: file, folder: folder });
		}
		if (zipFiles.length > 0) {
			toast(zipFiles.length + ' ZIP(s) encontrado(s), extraindo...', 'info');
			for (var j = 0; j < zipFiles.length; j++) {
				var extracted = await extractZipFiles(zipFiles[j]);
				for (var k = 0; k < extracted.length; k++) files.push(extracted[k]);
			}
		}
		if (files.length === 0) { toast('Nenhum arquivo de \\u00e1udio encontrado.', 'error'); return; }
		preparePending(files);
	}

	async function handleFilesFromInput(fileList) {
		if (!currentPlaylist) { toast('Abra uma playlist primeiro.', 'error'); return; }
		var zipFiles = [];
		var audioFiles = [];
		// Read all files into memory IMMEDIATELY before any async work
		// This prevents "file could not be read" errors when browser releases references
		var filesCopy = [];
		for (var i = 0; i < fileList.length; i++) filesCopy.push(fileList[i]);
		// Read ZIP buffers synchronously (before any await)
		var zipBuffers = [];
		for (var i = 0; i < filesCopy.length; i++) {
			if (isZipFile(filesCopy[i].name)) {
				zipFiles.push(filesCopy[i]);
			} else {
				audioFiles.push(filesCopy[i]);
			}
		}
		// Read ALL ZIP buffers in PARALLEL to prevent browser from releasing file references
		toast('Lendo ' + zipFiles.length + ' ZIP(s) para mem\\u00f3ria...', 'info');
		var zipReadPromises = zipFiles.map(function(f) {
			return f.arrayBuffer().then(function(buf) {
				return { name: f.name, buffer: buf, error: null };
			}).catch(function(e) {
				return { name: f.name, buffer: null, error: e.message };
			});
		});
		var zipData = await Promise.all(zipReadPromises);
		var failedReads = zipData.filter(function(z) { return z.error; });
		if (failedReads.length > 0) {
			toast(failedReads.length + ' ZIP(s) n\\u00e3o puderam ser lidos. Copie os arquivos para uma pasta local e tente novamente.', 'error');
			for (var fr = 0; fr < failedReads.length; fr++) console.error('Failed to read: ' + failedReads[fr].name, failedReads[fr].error);
		}
		var validZips = zipData.filter(function(z) { return z.buffer; });
		if (validZips.length > 0) {
			var allFiles = [];
			for (var j = 0; j < validZips.length; j++) {
				var extracted = await extractZipFromBuffer(validZips[j].buffer, validZips[j].name);
				for (var k = 0; k < extracted.length; k++) allFiles.push(extracted[k]);
			}
			var folder = '';
			if (currentFolders.length > 0) {
				folder = document.getElementById('targetFolder').value || '';
			}
			for (var m = 0; m < audioFiles.length; m++) {
				if (isAudioFile(audioFiles[m].name)) allFiles.push({ file: audioFiles[m], folder: folder });
			}
			if (allFiles.length > 0) { toast(allFiles.length + ' arquivos extra\\u00eddos.', 'info'); preparePending(allFiles); }
			else { toast('Nenhum arquivo de \\u00e1udio encontrado.', 'error'); }
			return;
		}
		var folder = '';
		if (currentFolders.length > 0) {
			folder = document.getElementById('targetFolder').value;
			if (!folder) { toast('Selecione uma pasta destino primeiro.', 'error'); return; }
		}
		handleFiles(fileList, folder);
	}

	function handleFiles(fileList, folder) {
		if (!currentPlaylist) { toast('Abra uma playlist primeiro.', 'error'); return; }
		var files = [];
		for (var i = 0; i < fileList.length; i++) {
			if (!isAudioFile(fileList[i].name)) continue;
			files.push({ file: fileList[i], folder: folder || '' });
		}
		if (files.length === 0) { toast('Nenhum arquivo de \\u00e1udio encontrado.', 'error'); return; }
		if (currentFolders.length > 0) {
			var loose = files.filter(function(f) { return !f.folder; });
			if (loose.length > 0) { toast('Esta playlist usa pastas. Todas as m\\u00fasicas devem estar dentro de uma pasta.', 'error'); return; }
		}
		preparePending(files);
	}
	`;
}
