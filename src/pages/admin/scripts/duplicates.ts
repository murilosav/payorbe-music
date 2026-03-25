export function duplicatesScript(): string {
	return `
	let duplicatesData = null;

	async function checkDuplicates() {
		var btn = document.getElementById('dupBtn');
		btn.disabled = true;
		btn.textContent = 'Verificando...';

		try {
			var res = await fetch('/api/songs/duplicates');
			duplicatesData = await res.json();
			renderDuplicatesModal();
		} catch (e) {
			toast('Erro ao verificar duplicatas', 'error');
		}

		btn.disabled = false;
		btn.textContent = 'Verificar Duplicatas';
	}

	function renderDuplicatesModal() {
		var d = duplicatesData;
		if (!d || d.duplicates.length === 0) {
			toast('Nenhuma duplicata encontrada entre playlists!');
			return;
		}

		var overlay = document.createElement('div');
		overlay.id = 'dupOverlay';
		overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
		overlay.onclick = function(e) { if (e.target === overlay) closeDupModal(); };

		var totalDups = d.totalDuplicates;
		var totalSize = 0;
		for (var i = 0; i < d.duplicates.length; i++) {
			var songs = d.duplicates[i].songs;
			for (var j = 1; j < songs.length; j++) totalSize += songs[j].file_size || 0;
		}
		var sizeMB = (totalSize / (1024*1024)).toFixed(1);

		var html = '<div style="background:#fff;border-radius:16px;max-width:700px;width:90vw;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);">';
		html += '<div style="padding:20px 24px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">';
		html += '<div><h2 style="font-size:18px;font-weight:700;margin-bottom:2px;">Duplicatas entre Playlists</h2>';
		html += '<p style="font-size:13px;color:#888;">' + d.duplicates.length + ' arquivo' + (d.duplicates.length!==1?'s':'') + ' duplicado' + (d.duplicates.length!==1?'s':'') + ' \\u2014 ' + totalDups + ' c\\u00f3pia' + (totalDups!==1?'s':'') + ' extras (' + sizeMB + ' MB)</p></div>';
		html += '<button onclick="closeDupModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#888;padding:4px;">\\u00d7</button>';
		html += '</div>';

		html += '<div style="overflow-y:auto;flex:1;padding:16px 24px;">';

		for (var i = 0; i < d.duplicates.length; i++) {
			var dup = d.duplicates[i];
			html += '<div style="margin-bottom:16px;padding:12px;background:#f8f8f8;border-radius:10px;">';
			html += '<div style="font-size:13px;font-weight:600;margin-bottom:8px;word-break:break-all;">' + escHtml(dup.filename) + '</div>';
			for (var j = 0; j < dup.songs.length; j++) {
				var s = dup.songs[j];
				var isFirst = j === 0;
				var sizeMbS = ((s.file_size||0)/(1024*1024)).toFixed(1);
				html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' + (isFirst?'':'opacity:0.7;') + '">';
				if (!isFirst) {
					html += '<input type="checkbox" class="dup-check" value="' + s.id + '" checked style="accent-color:#dc2626;">';
				} else {
					html += '<span style="width:15px;display:inline-block;text-align:center;color:#16a34a;font-weight:bold;" title="Manter esta">\\u2713</span>';
				}
				html += '<span style="font-size:12px;' + (isFirst?'font-weight:600;':'') + '">' + escHtml(s.playlist_name) + '</span>';
				html += '<span style="font-size:11px;color:#aaa;margin-left:auto;">' + sizeMbS + ' MB</span>';
				html += '</div>';
			}
			html += '</div>';
		}

		html += '</div>';

		html += '<div style="padding:16px 24px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:space-between;align-items:center;">';
		html += '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;"><input type="checkbox" id="dupSelectAll" checked onchange="toggleDupSelectAll()"> Selecionar todas as extras</label>';
		html += '<div style="display:flex;gap:8px;">';
		html += '<button class="btn btn-ghost" onclick="closeDupModal()">Cancelar</button>';
		html += '<button class="btn btn-danger" id="dupDeleteBtn" onclick="deleteDuplicates()">Remover Selecionadas</button>';
		html += '</div></div></div>';

		overlay.innerHTML = html;
		document.body.appendChild(overlay);
	}

	function escHtml(s) {
		var d = document.createElement('div');
		d.textContent = s;
		return d.innerHTML;
	}

	function closeDupModal() {
		var el = document.getElementById('dupOverlay');
		if (el) el.remove();
	}

	function toggleDupSelectAll() {
		var checked = document.getElementById('dupSelectAll').checked;
		var boxes = document.querySelectorAll('.dup-check');
		for (var i = 0; i < boxes.length; i++) boxes[i].checked = checked;
	}

	async function deleteDuplicates() {
		var boxes = document.querySelectorAll('.dup-check:checked');
		var ids = [];
		for (var i = 0; i < boxes.length; i++) ids.push(parseInt(boxes[i].value));

		if (ids.length === 0) { toast('Nenhuma duplicata selecionada.'); return; }
		if (!confirm('Remover ' + ids.length + ' m\\u00fasica' + (ids.length!==1?'s':'') + ' duplicada' + (ids.length!==1?'s':'') + '? Os arquivos ser\\u00e3o apagados do R2.')) return;

		var btn = document.getElementById('dupDeleteBtn');
		btn.disabled = true;
		btn.textContent = 'Removendo...';

		try {
			// Delete in batches of 50
			var deleted = 0;
			for (var i = 0; i < ids.length; i += 50) {
				var batch = ids.slice(i, i + 50);
				var res = await fetch('/api/songs/duplicates/delete', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ids: batch })
				});
				if (!res.ok) throw new Error('Erro ' + res.status);
				deleted += batch.length;
				btn.textContent = 'Removendo... ' + deleted + '/' + ids.length;
			}
			toast(deleted + ' duplicata' + (deleted!==1?'s':'') + ' removida' + (deleted!==1?'s':'') + '!');
			closeDupModal();
			loadPlaylists();
		} catch (e) {
			toast('Erro ao remover: ' + e.message, 'error');
			btn.disabled = false;
			btn.textContent = 'Remover Selecionadas';
		}
	}
	`;
}
