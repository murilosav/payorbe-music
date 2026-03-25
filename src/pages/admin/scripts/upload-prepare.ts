export function uploadPrepareScript(): string {
	return `
	var PARSE_CONCURRENT = 15;

	async function parseID3Batch(files, onProgress) {
		var results = new Array(files.length);
		var nextIdx = 0;
		var done = 0;

		async function worker() {
			while (nextIdx < files.length) {
				var i = nextIdx++;
				var meta = await parseID3(files[i].file);
				var fallbackTitle = files[i].file.name.replace(/\\.[^.]+$/, '').replace(/^\\d+[\\s._-]+/, '');
				results[i] = {
					file: files[i].file,
					folder: files[i].folder,
					title: meta.title || fallbackTitle,
					artist: meta.artist || 'Desconhecido',
					album: meta.album || '',
					cover: meta.cover,
					duration: meta.duration || 0,
					trackNumber: meta.trackNumber || 0,
				};
				done++;
				if (onProgress) onProgress(done, files.length);
			}
		}

		var workers = [];
		for (var w = 0; w < Math.min(PARSE_CONCURRENT, files.length); w++) workers.push(worker());
		await Promise.all(workers);
		return results;
	}

	function applyFindReplace() {
		var find = document.getElementById('frFind').value;
		var replace = document.getElementById('frReplace').value;
		var target = document.getElementById('frTarget').value;
		if (!find) { toast('Digite o texto a buscar.', 'error'); return; }
		var count = 0;
		var regex;
		try { regex = new RegExp(find, 'gi'); } catch(e) { regex = null; }
		for (var i = 0; i < pendingFiles.length; i++) {
			var f = pendingFiles[i];
			if (target === 'title' || target === 'both') {
				var newTitle = regex ? f.title.replace(regex, replace) : f.title.split(find).join(replace);
				if (newTitle !== f.title) { f.title = newTitle; count++; }
			}
			if (target === 'artist' || target === 'both') {
				var newArtist = regex ? f.artist.replace(regex, replace) : f.artist.split(find).join(replace);
				if (newArtist !== f.artist) { f.artist = newArtist; count++; }
			}
		}
		if (count > 0) {
			toast(count + ' altera\\u00e7' + (count !== 1 ? '\\u00f5es' : '\\u00e3o') + ' aplicada' + (count !== 1 ? 's' : '') + '.', 'info');
			renderPreview();
		} else {
			toast('Nenhuma correspond\\u00eancia encontrada.', 'error');
		}
	}

	function setAllArtist() {
		var artist = document.getElementById('frSetArtist').value.trim();
		if (!artist) { toast('Digite o nome do artista.', 'error'); return; }
		for (var i = 0; i < pendingFiles.length; i++) pendingFiles[i].artist = artist;
		toast('Artista definido para todas as m\\u00fasicas.', 'info');
		renderPreview();
	}

	function renderPreview() {
		var grouped = {};
		for (var i = 0; i < pendingFiles.length; i++) {
			var key = pendingFiles[i].folder || '(raiz)';
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(pendingFiles[i]);
		}

		var totalSize = pendingFiles.reduce(function(sum, f) { return sum + f.file.size; }, 0);
		var sizeMB = totalSize < 1024 * 1024 * 1024
			? (totalSize / (1024 * 1024)).toFixed(0) + ' MB'
			: (totalSize / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
		var withCover = pendingFiles.filter(function(f) { return f.cover; }).length;
		var withArtist = pendingFiles.filter(function(f) { return f.artist !== 'Desconhecido'; }).length;
		var folderCount = Object.keys(grouped).length;
		var largeFiles = pendingFiles.filter(function(f) { return f.file.size > 90 * 1024 * 1024; }).length;

		document.getElementById('summaryTitle').textContent = folderCount + ' pasta' + (folderCount !== 1 ? 's' : '') + ' | ' + pendingFiles.length + ' m\\u00fasicas';
		var infoText = sizeMB + ' total | ' + withCover + ' com capa | ' + withArtist + ' com artista';
		if (largeFiles > 0) infoText += ' | ' + largeFiles + ' grande(s) via multipart';
		document.getElementById('summaryInfo').textContent = infoText;

		var previewHtml = '';
		var isLargeBatch = pendingFiles.length > 100;
		var entries = Object.entries(grouped);

		for (var ei = 0; ei < entries.length; ei++) {
			var folder = entries[ei][0];
			var items = entries[ei][1];
			previewHtml += '<div style="margin-bottom:' + (isLargeBatch ? '4px' : '12px') + ';">';
			var folderSize = (items.reduce(function(s, it) { return s + it.file.size; }, 0) / (1024 * 1024)).toFixed(0);
			var folderCovers = items.filter(function(it) { return it.cover; }).length;
			previewHtml += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 0;font-size:13px;color:#555;">';
			previewHtml += '<span style="display:flex;align-items:center;gap:6px;font-weight:' + (isLargeBatch ? '400' : '600') + ';"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> ' + folder + '</span>';
			previewHtml += '<span style="color:#aaa;font-size:12px;">' + items.length + ' m\\u00fasicas | ' + folderSize + ' MB | ' + folderCovers + ' capas</span>';
			previewHtml += '</div>';

			if (!isLargeBatch) {
				for (var ii = 0; ii < items.length; ii++) {
					var item = items[ii];
					var itemSize = (item.file.size / (1024 * 1024)).toFixed(1);
					var coverDot = item.cover ? '<span style="color:#22c55e;">&#9679;</span> ' : '<span style="color:#ddd;">&#9679;</span> ';
					var trackLabel = item.trackNumber > 0 ? '<span style="color:#bbb;font-size:11px;">#' + item.trackNumber + '</span> ' : '';
					previewHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0 4px 20px;font-size:13px;color:#666;border-bottom:1px solid #f5f5f5;">';
					previewHtml += '<span>' + coverDot + trackLabel + '<strong>' + item.title + '</strong> - ' + item.artist + '</span>';
					previewHtml += '<span style="color:#aaa;">' + itemSize + ' MB</span>';
					previewHtml += '</div>';
				}
			}
			previewHtml += '</div>';
		}

		document.getElementById('folderPreview').innerHTML = previewHtml;
	}

	async function preparePending(files) {
		// Filter duplicates
		if (currentSongs.length > 0) {
			var existingKeys = {};
			for (var i = 0; i < currentSongs.length; i++) {
				var s = currentSongs[i];
				var fname = (s.r2_key || '').split('/').pop();
				existingKeys[s.folder + '/' + fname] = true;
			}
			var original = files.length;
			files = files.filter(function(f) {
				var key = (f.folder || '') + '/' + f.file.name;
				return !existingKeys[key];
			});
			var skipped = original - files.length;
			if (skipped > 0) {
				toast(skipped + ' m\\u00fasica' + (skipped !== 1 ? 's' : '') + ' duplicada' + (skipped !== 1 ? 's' : '') + ' ignorada' + (skipped !== 1 ? 's' : '') + '.', 'info');
			}
			if (files.length === 0) {
				toast('Todas as m\\u00fasicas j\\u00e1 existem nesta playlist.', 'info');
				return;
			}
		}

		// Large batch warning
		if (files.length > 5000) {
			if (!confirm(files.length + ' arquivos detectados. Lotes muito grandes podem deixar o navegador lento. Continuar?')) return;
		}

		// Merge subfolders: remove first path segment
		if (document.getElementById('mergeFolders').checked) {
			for (var mi = 0; mi < files.length; mi++) {
				var f = files[mi];
				if (f.folder) {
					var parts = f.folder.split(' / ');
					if (parts.length > 1) {
						f.folder = parts.slice(1).join(' / ');
					} else {
						f.folder = '';
					}
				}
			}
		}

		toast(files.length + ' m\\u00fasicas para processar' + (currentSongs.length > 0 ? ' (ap\\u00f3s filtro de duplicatas)' : '') + '.', 'info');
		document.getElementById('uploadSummary').style.display = 'block';
		document.getElementById('summaryTitle').textContent = 'Lendo metadados...';
		document.getElementById('summaryInfo').textContent = '0/' + files.length + ' processados';
		document.getElementById('folderPreview').innerHTML = '<div style="padding:16px;text-align:center;"><div class="progress-bar" style="height:6px;margin-bottom:8px;"><div class="progress-fill" id="parseProgressFill" style="width:0%"></div></div><p style="color:#888;font-size:13px;" id="parseStatus">Lendo metadados...</p></div>';
		document.getElementById('uploadQueue').innerHTML = '';
		document.getElementById('uploadProgress').style.display = 'none';

		pendingFiles = await parseID3Batch(files, function(done, total) {
			var pct = Math.round((done / total) * 100);
			var el = document.getElementById('parseProgressFill');
			if (el) el.style.width = pct + '%';
			var st = document.getElementById('parseStatus');
			if (st) st.textContent = done + '/' + total + ' processados...';
			document.getElementById('summaryInfo').textContent = done + '/' + total + ' processados';
		});

		renderPreview();
		document.getElementById('findReplaceBar').style.display = 'flex';
	}
	`;
}
