export function uploadEngineScript(): string {
	return `
	var uploadState = {
		running: false, paused: false, cancelled: false,
		failedFiles: [], uploadedFiles: [],
		total: 0, completed: 0, errors: 0,
		bytesUploaded: 0, bytesTotal: 0, startTime: 0, pauseResolve: null,
	};

	function toggleUploadPause() {
		if (!uploadState.running) return;
		uploadState.paused = !uploadState.paused;
		var btn = document.getElementById('bannerPauseBtn');
		if (uploadState.paused) {
			btn.textContent = 'Retomar';
			btn.style.background = 'rgba(74,222,128,0.4)';
			document.getElementById('bannerText').textContent = 'PAUSADO - ' + uploadState.completed + '/' + uploadState.total;
			document.getElementById('bannerSpinner').style.display = 'none';
		} else {
			btn.textContent = 'Pausar';
			btn.style.background = 'rgba(255,255,255,0.2)';
			document.getElementById('bannerSpinner').style.display = 'block';
			if (uploadState.pauseResolve) { uploadState.pauseResolve(); uploadState.pauseResolve = null; }
		}
	}

	function cancelUpload() {
		if (!uploadState.running) return;
		if (!confirm('Cancelar upload? M\\u00fasicas j\\u00e1 enviadas ser\\u00e3o mantidas.')) return;
		uploadState.cancelled = true;
		uploadState.paused = false;
		if (uploadState.pauseResolve) { uploadState.pauseResolve(); uploadState.pauseResolve = null; }
	}

	function waitIfPaused() {
		if (!uploadState.paused) return Promise.resolve();
		return new Promise(function(resolve) { uploadState.pauseResolve = resolve; });
	}

	async function retryFailed() {
		if (uploadState.failedFiles.length === 0) return;
		var retryFiles = uploadState.failedFiles.slice();
		uploadState.failedFiles = [];
		pendingFiles = retryFiles;
		toast('Retentando ' + retryFiles.length + ' m\\u00fasica' + (retryFiles.length !== 1 ? 's' : '') + '...', 'info');
		await startUpload();
	}

	function formatBytes(bytes) {
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
		if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
		return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
	}

	var BATCH_SIZE = 500;

	async function startUpload() {
		var playlistId = currentPlaylist ? String(currentPlaylist.id) : null;
		if (!playlistId) { toast('Nenhuma playlist selecionada.', 'error'); return; }
		if (pendingFiles.length === 0) return;

		var songCountBeforeUpload = currentSongs.length;
		var turbo = document.getElementById('turboMode').checked;
		var skipCovers = document.getElementById('skipCovers').checked;

		var allFiles = pendingFiles.slice();
		var totalFiles = allFiles.length;
		var totalBytes = allFiles.reduce(function(s, f) { return s + f.file.size; }, 0);

		// Adaptive concurrency
		var avgSize = totalBytes / totalFiles;
		var MAX_CONCURRENT;
		if (avgSize > 50 * 1024 * 1024) MAX_CONCURRENT = turbo ? 4 : 2;
		else if (avgSize > 20 * 1024 * 1024) MAX_CONCURRENT = turbo ? 8 : 4;
		else if (avgSize > 10 * 1024 * 1024) MAX_CONCURRENT = turbo ? 15 : 6;
		else MAX_CONCURRENT = turbo ? 30 : 10;

		// Reset state
		uploadState.running = true;
		uploadState.paused = false;
		uploadState.cancelled = false;
		uploadState.failedFiles = [];
		uploadState.uploadedFiles = [];
		uploadState.total = totalFiles;
		uploadState.completed = 0;
		uploadState.errors = 0;
		uploadState.bytesUploaded = 0;
		uploadState.bytesTotal = totalBytes;
		uploadState.startTime = Date.now();

		document.getElementById('uploadSummary').style.display = 'none';
		document.getElementById('uploadProgress').style.display = 'block';

		var queue = document.getElementById('uploadQueue');
		queue.innerHTML = '';

		var banner = document.getElementById('uploadBanner');
		banner.className = 'upload-banner active';
		document.getElementById('bannerSpinner').style.display = 'block';
		document.getElementById('bannerPauseBtn').style.display = 'inline-block';
		document.getElementById('bannerCancelBtn').style.display = 'inline-block';

		var isLarge = totalFiles > 200;

		function updateProgress() {
			var pct = totalBytes > 0 ? Math.round((uploadState.bytesUploaded / totalBytes) * 100) : 0;
			document.getElementById('uploadProgressFill').style.width = pct + '%';
			document.getElementById('progressCount').textContent = uploadState.completed + '/' + totalFiles;
			document.getElementById('bannerPct').textContent = pct + '%';
			document.getElementById('bannerBar').style.width = pct + '%';

			var elapsed = (Date.now() - uploadState.startTime) / 1000;
			var speed = uploadState.completed > 0 ? (uploadState.completed / elapsed).toFixed(1) : '0';
			var bytesSpeed = elapsed > 0 ? uploadState.bytesUploaded / elapsed : 0;
			var remaining = bytesSpeed > 0 ? Math.round((totalBytes - uploadState.bytesUploaded) / bytesSpeed) : 0;
			var eta = remaining > 60 ? Math.round(remaining / 60) + 'min' : remaining + 's';

			var line = uploadState.completed + '/' + totalFiles + ' \\u2022 ' +
				formatBytes(uploadState.bytesUploaded) + '/' + formatBytes(totalBytes) + ' \\u2022 ' +
				speed + '/s \\u2022 ~' + eta;
			document.getElementById('bannerText').textContent = line;
			document.getElementById('progressText').textContent = line;
		}

		var totalBatches = Math.ceil(totalFiles / BATCH_SIZE);

		for (var batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
			if (uploadState.cancelled) break;

			var batchStart = batchIdx * BATCH_SIZE;
			var batchEnd = Math.min(batchStart + BATCH_SIZE, totalFiles);
			var batch = allFiles.slice(batchStart, batchEnd);

			if (totalBatches > 1) {
				toast('Lote ' + (batchIdx + 1) + '/' + totalBatches + ' (' + batch.length + ' m\\u00fasicas)', 'info');
			}

			var items = new Array(batch.length);
			queue.innerHTML = '';

			if (!isLarge) {
				for (var i = 0; i < batch.length; i++) {
					items[i] = createQueueItem(batch[i]);
					queue.appendChild(items[i]);
				}
			}

			function createQueueItem(pending) {
				var item = document.createElement('div');
				item.className = 'upload-item';
				var folderLabel = pending.folder ? '<span class="file-folder">' + pending.folder + '</span>' : '';
				var sizeMB = (pending.file.size / (1024 * 1024)).toFixed(1);
				item.innerHTML =
					'<div class="status-icon waiting"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg></div>' +
					'<div class="file-info"><span class="file-name">' + pending.title + '</span>' + folderLabel + '</div>' +
					'<span class="file-status">' + sizeMB + ' MB</span>';
				return item;
			}

			function ensureItemVisible(index) {
				if (isLarge && !items[index]) {
					items[index] = createQueueItem(batch[index]);
					queue.appendChild(items[index]);
					while (queue.children.length > 30) queue.removeChild(queue.firstChild);
				}
			}

			updateProgress();

			async function uploadOne(index) {
				if (uploadState.cancelled) return;
				await waitIfPaused();
				if (uploadState.cancelled) return;

				var pending = batch[index];
				ensureItemVisible(index);
				var item = items[index];

				item.className = 'upload-item uploading';
				item.querySelector('.status-icon').className = 'status-icon uploading';
				item.querySelector('.status-icon').innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;border-color:rgba(0,0,0,0.15);border-top-color:#1a1a1a;border-radius:50%;animation:spin 0.8s linear infinite;"></div>';
				var sizeMB = (pending.file.size / (1024 * 1024)).toFixed(0);
				item.querySelector('.file-status').textContent = 'Presigning...';

				var success = false;
				var MAX_RETRIES = 5;

				for (var attempt = 0; attempt < MAX_RETRIES && !success; attempt++) {
					if (uploadState.cancelled) return;
					await waitIfPaused();
					if (uploadState.cancelled) return;

					try {
						if (attempt > 0) {
							var delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
							item.querySelector('.file-status').textContent = 'Tentativa ' + (attempt + 1) + '/' + MAX_RETRIES + '...';
							await new Promise(function(r) { setTimeout(r, delay); });
						}

						// Step 1: Get presigned URL from Worker
						item.querySelector('.file-status').textContent = 'Preparando (' + sizeMB + ' MB)...';
						var presignRes = await fetch('/api/presign/upload', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								playlist_id: playlistId,
								filename: pending.file.name,
								folder: pending.folder,
								content_type: pending.file.type || 'audio/mpeg'
							})
						});

						if (presignRes.status === 409) {
							uploadState.bytesUploaded += pending.file.size;
							item.className = 'upload-item';
							item.querySelector('.status-icon').className = 'status-icon done';
							item.querySelector('.status-icon').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>';
							item.querySelector('.file-status').textContent = 'J\\u00e1 existe';
							item.querySelector('.file-status').style.color = '#d97706';
							success = true; break;
						}
						if (!presignRes.ok) {
							var errT = await presignRes.text();
							var errM = 'Erro ' + presignRes.status;
							try { errM = JSON.parse(errT).error || errM; } catch(e) {}
							throw new Error('Presign: ' + errM);
						}

						var presignData = await presignRes.json();

						// Step 2: Upload file directly to R2 via presigned URL
						item.querySelector('.file-status').textContent = 'Enviando direto (' + sizeMB + ' MB)...';
						var putRes = await fetch(presignData.url, {
							method: 'PUT',
							headers: { 'Content-Type': presignData.contentType },
							body: pending.file,
						});

						if (!putRes.ok) {
							throw new Error('R2 PUT: HTTP ' + putRes.status);
						}

						// Step 3: Register song in DB
						item.querySelector('.file-status').textContent = 'Registrando...';
						var registerRes = await fetch('/api/songs/register', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								playlist_id: playlistId,
								r2_key: presignData.r2Key,
								title: pending.title,
								artist: pending.artist || 'Desconhecido',
								album: pending.album || '',
								folder: pending.folder,
								duration: pending.duration || 0,
								track_number: pending.trackNumber || 0,
								file_size: pending.file.size
							})
						});

						if (!registerRes.ok) {
							var regErr = await registerRes.text();
							var regMsg = 'Erro ' + registerRes.status;
							try { regMsg = JSON.parse(regErr).error || regMsg; } catch(e) {}
							throw new Error('Register: ' + regMsg);
						}

						var songData = await registerRes.json();

						// Step 4: Upload cover if present (through Worker, it's tiny)
						if (pending.cover && !skipCovers && songData.id) {
							try {
								var coverFd = new FormData();
								coverFd.append('file', new File([pending.cover], 'cover.jpg', { type: pending.cover.type || 'image/jpeg' }));
								await fetch('/api/songs/' + songData.id + '/cover', { method: 'POST', body: coverFd });
							} catch(coverErr) {
								// Cover upload failure is non-fatal
							}
						}

						uploadState.uploadedFiles.push(pending);
						uploadState.bytesUploaded += pending.file.size;
						item.className = 'upload-item';
						item.querySelector('.status-icon').className = 'status-icon done';
						item.querySelector('.status-icon').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>';
						item.querySelector('.file-status').textContent = 'Enviado (direto)';
						item.querySelector('.file-status').style.color = '#22c55e';
						success = true;

					} catch (err) {
						if (err.name === 'AbortError') err = new Error('Timeout');
						if (attempt === MAX_RETRIES - 1) {
							uploadState.failedFiles.push(pending);
							uploadState.bytesUploaded += pending.file.size;
							item.className = 'upload-item';
							item.querySelector('.status-icon').className = 'status-icon error';
							item.querySelector('.status-icon').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
							item.querySelector('.file-status').textContent = err.message;
							item.querySelector('.file-status').style.color = '#ef4444';
							uploadState.errors++;
						}
					}
				}
				uploadState.completed++;
				updateProgress();
			}

			var nextIndex = 0;
			async function runWorker() {
				while (nextIndex < batch.length) {
					if (uploadState.cancelled) return;
					var idx = nextIndex++;
					await uploadOne(idx);
				}
			}

			var workers = [];
			for (var w = 0; w < Math.min(MAX_CONCURRENT, batch.length); w++) workers.push(runWorker());
			await Promise.all(workers);

			batch = null;
			items = null;
		}

		// Finished
		uploadState.running = false;
		var elapsed = Math.round((Date.now() - uploadState.startTime) / 1000);
		var elapsedStr = elapsed > 60 ? Math.round(elapsed / 60) + 'min ' + (elapsed % 60) + 's' : elapsed + 's';

		document.getElementById('bannerSpinner').style.display = 'none';
		document.getElementById('bannerPauseBtn').style.display = 'none';
		document.getElementById('bannerCancelBtn').style.display = 'none';

		if (uploadState.cancelled) {
			banner.className = 'upload-banner active has-errors';
			document.getElementById('bannerText').textContent = 'Cancelado - ' + uploadState.completed + '/' + totalFiles + ' enviadas em ' + elapsedStr;
			document.getElementById('progressText').textContent = 'Upload cancelado. ' + uploadState.completed + ' de ' + totalFiles + ' enviadas.';
		} else if (uploadState.errors > 0) {
			banner.className = 'upload-banner active has-errors';
			var failMsg = uploadState.errors + ' erro(s) de ' + totalFiles + ' em ' + elapsedStr;
			document.getElementById('bannerText').textContent = failMsg;
			document.getElementById('progressText').innerHTML = failMsg +
				' <button class="btn btn-primary btn-sm" onclick="retryFailed()" style="margin-left:8px;">Retentar ' + uploadState.failedFiles.length + ' falha(s)</button>';
		} else {
			banner.className = 'upload-banner active done';
			document.getElementById('bannerText').textContent = totalFiles + ' m\\u00fasica' + (totalFiles !== 1 ? 's' : '') + ' \\u2022 ' + formatBytes(totalBytes) + ' em ' + elapsedStr + '!';
			document.getElementById('progressText').textContent = 'Upload conclu\\u00eddo em ' + elapsedStr + '!';
		}
		document.getElementById('bannerPct').textContent = '100%';
		document.getElementById('bannerBar').style.width = '100%';

		currentPlaylist.song_count = (currentPlaylist.song_count || 0) + uploadState.uploadedFiles.length;

		pendingFiles = [];
		document.getElementById('findReplaceBar').style.display = 'none';
		loadDetailSongs();

		if (uploadState.uploadedFiles.length > 0) {
			// Auto-set playlist cover from first song with embedded cover
			if (!currentPlaylist.cover_r2_key) {
				var firstWithCover = uploadState.uploadedFiles.find(function(f) { return f.cover; });
				if (firstWithCover) {
					var coverFile = new File([firstWithCover.cover], 'cover.jpg', { type: firstWithCover.cover.type || 'image/jpeg' });
					uploadDetailCover(coverFile);
				}
			}

			// Generate ZIP with progress in the banner
			try {
				banner.className = 'upload-banner active';
				document.getElementById('bannerSpinner').style.display = 'block';
				document.getElementById('bannerText').textContent = 'Gerando ZIP... Buscando m\\u00fasicas...';
				document.getElementById('bannerPct').textContent = '0%';
				document.getElementById('bannerBar').style.width = '0%';

				var songsRes = await fetchRetry('/api/playlists/' + currentPlaylist.slug + '/songs', {}, 3);
				var zipSongs = await songsRes.json();

				if (zipSongs.length > 0) {
					await fetch('/api/playlists/' + playlistId + '/zips', { method: 'DELETE' });

					var zipResult = await streamingZipGenerate(playlistId, zipSongs, function(text, pct) {
						document.getElementById('bannerText').textContent = 'ZIP: ' + text;
						document.getElementById('bannerPct').textContent = pct + '%';
						document.getElementById('bannerBar').style.width = pct + '%';
					});

					document.getElementById('bannerSpinner').style.display = 'none';
					banner.className = 'upload-banner active done';
					document.getElementById('bannerPct').textContent = '100%';
					document.getElementById('bannerBar').style.width = '100%';
					document.getElementById('bannerText').textContent = 'Tudo pronto! ' + totalFiles + ' m\\u00fasica' + (totalFiles !== 1 ? 's' : '') + ' + ZIP (' + zipResult.songCount + ' m\\u00fasicas)';
					toast('ZIP gerado com sucesso! (' + zipResult.songCount + ' m\\u00fasicas)');
					loadDetailZips();
					currentPlaylist.song_count = zipResult.songCount;
					setTimeout(function() { banner.className = 'upload-banner'; }, 8000);
				}
			} catch (zipErr) {
				document.getElementById('bannerSpinner').style.display = 'none';
				banner.className = 'upload-banner active has-errors';
				document.getElementById('bannerText').textContent = 'Upload OK, mas erro no ZIP: ' + (zipErr.message || zipErr);
				toast('Erro ao gerar ZIP: ' + (zipErr.message || zipErr), 'error');
			}
		} else {
			if (uploadState.errors === 0 && !uploadState.cancelled) {
				setTimeout(function() { banner.className = 'upload-banner'; }, 8000);
			}
		}
	}
	`;
}
