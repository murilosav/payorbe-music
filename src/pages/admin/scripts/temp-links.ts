export function tempLinksScript(): string {
	return `
	var tempLinksCache = [];

	async function openTempLinks(slug, name) {
		await loadTempLinks();
		var html = '<div class="modal-overlay" id="tempLinksModal" onclick="if(event.target===this)closeTempLinks()">' +
			'<div class="modal" style="max-width:640px;">' +
				'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
					'<h3 style="font-size:16px;font-weight:600;">Links Tempor\\u00e1rios \\u2014 ' + escHtml(name) + '</h3>' +
					'<button class="btn btn-ghost btn-sm" onclick="closeTempLinks()">\\u2715</button>' +
				'</div>' +
				'<div style="background:#f8f8f8;border-radius:10px;padding:16px;margin-bottom:16px;">' +
					'<div style="font-weight:500;font-size:13px;margin-bottom:10px;">Gerar novo link</div>' +
					'<div class="form-row" style="gap:8px;">' +
						'<div class="form-group" style="flex:1;"><label>Expira em</label>' +
							'<select id="tlExpires" style="width:100%;">' +
								'<option value="1">1 hora</option>' +
								'<option value="6">6 horas</option>' +
								'<option value="12">12 horas</option>' +
								'<option value="24" selected>24 horas</option>' +
								'<option value="48">2 dias</option>' +
								'<option value="72">3 dias</option>' +
								'<option value="168">7 dias</option>' +
								'<option value="720">30 dias</option>' +
							'</select></div>' +
						'<div class="form-group" style="flex:1;"><label>Limite de acessos</label><input type="number" id="tlMaxUses" placeholder="Ilimitado" min="1"></div>' +
						'<div class="form-group" style="flex:1;"><label>R\\u00f3tulo</label><input type="text" id="tlLabel" placeholder="Ex: Cliente X"></div>' +
					'</div>' +
					'<input type="hidden" id="tlSlug" value="' + escHtml(slug) + '">' +
					'<button class="btn btn-primary btn-sm" onclick="generateTempLink()" style="margin-top:8px;">Gerar Link</button>' +
				'</div>' +
				'<div id="tempLinksList">' + renderTempLinksList(slug) + '</div>' +
			'</div></div>';
		document.body.insertAdjacentHTML('beforeend', html);
	}

	function closeTempLinks() {
		var el = document.getElementById('tempLinksModal');
		if (el) el.remove();
	}

	async function loadTempLinks() {
		try {
			var res = await fetch('/api/temp-links');
			tempLinksCache = await res.json();
		} catch (e) { tempLinksCache = []; }
	}

	function renderTempLinksList(slug) {
		var links = tempLinksCache.filter(function(l) { return l.slug === slug; });
		if (links.length === 0) return '<div style="text-align:center;padding:20px;color:#aaa;font-size:13px;">Nenhum link ativo.</div>';

		var html = '<div style="font-size:12px;font-weight:600;color:#888;margin-bottom:8px;">Links ativos</div>';
		for (var i = 0; i < links.length; i++) {
			var l = links[i];
			var exp = new Date(l.expires_at);
			var now = Date.now();
			var diffH = Math.max(0, Math.floor((exp.getTime() - now) / 3600000));
			var diffM = Math.max(0, Math.floor(((exp.getTime() - now) % 3600000) / 60000));
			var timeStr = diffH >= 24 ? Math.floor(diffH / 24) + 'd ' + (diffH % 24) + 'h' : diffH + 'h' + diffM + 'min';
			var usesStr = l.max_uses ? l.use_count + '/' + l.max_uses + ' acessos' : l.use_count + ' acessos';
			var linkUrl = location.origin + '/' + l.slug + '?token=' + l.token;

			html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #eee;">' +
				'<div style="flex:1;min-width:0;">' +
					'<div style="font-size:13px;font-weight:500;">' + escHtml(l.label || 'Link manual') + '</div>' +
					'<div style="font-size:11px;color:#888;margin-top:2px;">' + usesStr + ' \\u00b7 expira em ' + timeStr + '</div>' +
				'</div>' +
				'<button class="btn btn-ghost btn-sm" onclick="copyTempLink(\\'' + l.token + '\\')">Copiar</button>' +
				'<button class="btn btn-danger btn-sm" onclick="revokeTempLink(\\'' + l.token + '\\', \\'' + escHtml(l.slug) + '\\')">Revogar</button>' +
			'</div>';
		}
		return html;
	}

	async function generateTempLink() {
		var slug = document.getElementById('tlSlug').value;
		var expiresHours = parseInt(document.getElementById('tlExpires').value);
		var maxUses = parseInt(document.getElementById('tlMaxUses').value) || 0;
		var label = document.getElementById('tlLabel').value.trim();
		try {
			var res = await fetch('/api/temp-links', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: slug, expires_hours: expiresHours, max_uses: maxUses || null, label: label || null })
			});
			var data = await res.json();
			if (!res.ok) { toast(data.error || 'Erro ao gerar link', 'error'); return; }
			var linkUrl = location.origin + '/' + slug + '?token=' + data.token;
			await navigator.clipboard.writeText(linkUrl);
			toast('Link gerado e copiado!');
			await loadTempLinks();
			var el = document.getElementById('tempLinksList');
			if (el) el.innerHTML = renderTempLinksList(slug);
			document.getElementById('tlMaxUses').value = '';
			document.getElementById('tlLabel').value = '';
		} catch (e) { toast('Erro: ' + e.message, 'error'); }
	}

	async function copyTempLink(token) {
		var link = tempLinksCache.find(function(l) { return l.token === token; });
		if (!link) return;
		var url = location.origin + '/' + link.slug + '?token=' + token;
		await navigator.clipboard.writeText(url);
		toast('Link copiado!');
	}

	async function revokeTempLink(token, slug) {
		if (!confirm('Revogar este link? Quem tiver ele n\\u00e3o poder\\u00e1 mais acessar.')) return;
		try {
			await fetch('/api/temp-links/' + token, { method: 'DELETE' });
			toast('Link revogado!');
			await loadTempLinks();
			var el = document.getElementById('tempLinksList');
			if (el) el.innerHTML = renderTempLinksList(slug);
		} catch (e) { toast('Erro: ' + e.message, 'error'); }
	}

	function escHtml(s) {
		if (!s) return '';
		return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
	}
	`;
}
