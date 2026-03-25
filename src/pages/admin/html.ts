export function adminHtml(): string {
	return `
	<div class="toast-container" id="toastContainer"></div>

	<div class="upload-banner" id="uploadBanner">
		<div class="upload-banner-content">
			<div class="spinner" id="bannerSpinner"></div>
			<span class="upload-banner-text" id="bannerText">Enviando...</span>
			<div style="display:flex;align-items:center;gap:10px;">
				<span class="upload-banner-pct" id="bannerPct">0%</span>
				<button id="bannerPauseBtn" onclick="toggleUploadPause()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;display:none;">Pausar</button>
				<button id="bannerCancelBtn" onclick="cancelUpload()" style="background:rgba(255,0,0,0.3);border:none;color:#fff;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;display:none;">Cancelar</button>
			</div>
		</div>
		<div class="upload-banner-bar" id="bannerBar" style="width:0%"></div>
	</div>

	<div class="container">
		<div class="header">
			<h1>Patacos Admin</h1>
			<div class="header-actions">
				<a href="/admin/logout" class="danger">Sair</a>
			</div>
		</div>

		<!-- ==================== LIST VIEW ==================== -->
		<div id="listView">
			<!-- Create Folder Form -->
			<div class="card" id="createFolderForm" style="display:none;">
				<div style="font-weight:600;margin-bottom:12px;">Nova Pasta</div>
				<div class="form-row">
					<div class="form-group"><label>Nome</label><input type="text" id="folderName" placeholder="Ex: Pacote Rock"></div>
					<div class="form-group"><label>Slug (URL)</label><input type="text" id="folderSlug" placeholder="Ex: pacote-rock"></div>
				</div>
				<div class="form-group"><label>Descrição</label><input type="text" id="folderDesc" placeholder="Descrição da pasta"></div>
				<div style="display:flex;gap:8px;">
					<button class="btn btn-primary" onclick="createFolder()">Criar Pasta</button>
					<button class="btn btn-ghost" onclick="toggleCreateFolderForm()">Cancelar</button>
				</div>
			</div>

			<!-- Create Playlist Form -->
			<div class="card" id="createForm" style="display:none;">
				<div style="font-weight:600;margin-bottom:12px;">Nova Playlist</div>
				<div class="form-row">
					<div class="form-group"><label>Nome</label><input type="text" id="playlistName" placeholder="Ex: Gospel Hits 2026"></div>
					<div class="form-group"><label>Slug (URL)</label><input type="text" id="playlistSlug" placeholder="Ex: gospel-hits"></div>
				</div>
				<div class="form-group"><label>Descrição</label><input type="text" id="playlistDesc" placeholder="Descrição da playlist"></div>
				<div style="display:flex;gap:8px;">
					<button class="btn btn-primary" onclick="createPlaylist()">Criar Playlist</button>
					<button class="btn btn-ghost" onclick="toggleCreateForm()">Cancelar</button>
				</div>
			</div>

			<!-- Search + Actions -->
			<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;">
				<div style="display:flex;align-items:center;gap:12px;flex:1;">
					<span style="font-size:14px;color:#888;white-space:nowrap;" id="playlistCount"></span>
					<input type="text" id="adminSearch" placeholder="Buscar playlists e pastas..." oninput="filterAdminList()" style="flex:1;max-width:300px;padding:7px 12px;font-size:13px;">
				</div>
				<div style="display:flex;gap:8px;">
					<button class="btn btn-ghost" onclick="checkDuplicates()" id="dupBtn">Verificar Duplicatas</button>
					<button class="btn btn-ghost" onclick="toggleCreateFolderForm()" id="createFolderToggleBtn">+ Nova Pasta</button>
					<button class="btn btn-primary" onclick="toggleCreateForm()" id="createToggleBtn">+ Nova Playlist</button>
				</div>
			</div>

			<div id="playlistsList"></div>
		</div>

		<!-- ==================== DETAIL VIEW ==================== -->
		<div id="detailView" style="display:none;">
			<button class="back-btn" onclick="closeDetail()">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
				Voltar
			</button>

			<!-- Playlist Info -->
			<div class="detail-section">
				<div class="detail-section-title">
					<span>Informações da Playlist</span>
					<button class="btn btn-primary btn-sm" onclick="savePlaylist()" id="saveBtn" style="display:none;">Salvar Alterações</button>
				</div>
				<div style="display:flex;gap:16px;align-items:flex-start;">
					<div class="pl-cover" id="detailCover" style="width:72px;height:72px;cursor:pointer;border-radius:12px;" onclick="document.getElementById('detailCoverInput').click()" title="Alterar capa">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
					</div>
					<input type="file" id="detailCoverInput" accept="image/*" style="display:none;" onchange="uploadDetailCover(this.files[0])">
					<div style="flex:1;">
						<div class="form-row">
							<div class="form-group"><label>Nome</label><input type="text" id="detailName" oninput="onDetailNameChange()"></div>
							<div class="form-group"><label>Slug (URL)</label><input type="text" id="detailSlug" oninput="onDetailSlugChange()"></div>
						</div>
						<div class="form-group"><label>Descrição</label><input type="text" id="detailDesc" oninput="onDetailChange()"></div>
					</div>
				</div>

				<div class="detail-divider"></div>

				<!-- Link de acesso -->
				<div class="detail-section-title" style="margin-bottom:8px;"><span>Link de Acesso</span></div>
				<div class="link-row">
					<input type="text" id="detailLink" readonly onclick="this.select()">
					<button class="btn btn-ghost btn-sm" onclick="copyDetailLink()">Copiar</button>
					<a id="detailOpenLink" href="#" target="_blank" class="btn btn-ghost btn-sm" style="text-decoration:none;">Abrir</a>
				</div>

				<div class="detail-divider"></div>

				<!-- JWT Secrets -->
				<div class="detail-section-title" style="margin-bottom:8px;"><span>JWT Secrets (checkout externo)</span></div>
				<p style="font-size:12px;color:#aaa;margin-bottom:8px;">Cole as chaves secretas do checkout. Uma por linha. Permite múltiplos checkouts para a mesma playlist.</p>
				<textarea id="detailJwtSecret" oninput="onDetailChange()" placeholder="Nenhuma chave configurada" rows="3" style="font-size:13px;font-family:'SF Mono',Menlo,monospace;width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;resize:vertical;line-height:1.6;"></textarea>
			</div>

			<!-- ZIP -->
			<div class="detail-section">
				<div class="detail-section-title">
					<span>Download ZIP</span>
					<div style="display:flex;gap:8px;align-items:center;">
						<span id="zipBadge"></span>
						<button class="btn btn-primary btn-sm" onclick="regenerateDetailZip()" id="zipBtn">Gerar ZIP</button>
					</div>
				</div>
				<div id="zipInfo" style="font-size:13px;color:#888;"></div>
				<div id="zipProgress" style="display:none;">
					<div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
						<div class="spinner" style="width:14px;height:14px;border:2px solid rgba(0,0,0,0.1);border-top-color:#1a1a1a;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
						<span id="zipStatus" style="font-size:12px;color:#666;">Preparando...</span>
					</div>
					<div class="progress-bar" style="height:4px;margin-top:6px;"><div class="progress-fill" id="zipBar"></div></div>
				</div>
			</div>

			<!-- Upload -->
			<div class="detail-section">
				<div class="detail-section-title"><span>Upload de Músicas</span></div>
				<div style="display:flex;gap:8px;margin-bottom:12px;">
					<button class="btn btn-primary" onclick="document.getElementById('folderInput').click()" style="flex:1;">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
						Selecionar Pasta
					</button>
					<button class="btn btn-ghost" onclick="document.getElementById('fileInput').click()" style="flex:1;">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
						Selecionar Arquivos
					</button>
				</div>
				<input type="file" id="folderInput" webkitdirectory multiple style="display:none" onchange="handleFolderSelect(this.files)">
				<input type="file" id="fileInput" multiple style="display:none" onchange="handleFilesFromInput(this.files)">
				<div id="folderSelectBox" style="display:none;margin-bottom:12px;">
					<div class="form-group" style="margin:0;">
						<label>Pasta destino</label>
						<select id="targetFolder">
							<option value="">Selecione uma pasta</option>
						</select>
					</div>
				</div>
				<div class="upload-area" id="uploadArea">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
					<p style="font-size:13px;">Arraste pastas, arquivos ou ZIPs aqui</p>
					<p style="font-size:11px;margin-top:2px;color:#bbb;">MP3, MP4, M4A, WAV, FLAC, OGG, ZIP</p>
				</div>
				<div id="uploadSummary" style="display:none;margin-top:12px;" class="card">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
						<div>
							<strong id="summaryTitle"></strong>
							<p style="font-size:13px;color:#888;" id="summaryInfo"></p>
						</div>
						<button class="btn btn-primary" onclick="startUpload()">Enviar Tudo</button>
					</div>
					<div style="display:flex;gap:16px;align-items:center;margin-bottom:12px;padding:10px 14px;background:#f8f8f8;border-radius:8px;flex-wrap:wrap;">
						<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;white-space:nowrap;">
							<input type="checkbox" id="turboMode" checked> <strong>Turbo</strong> <span style="color:#888;">(30 paralelos)</span>
						</label>
						<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;white-space:nowrap;">
							<input type="checkbox" id="skipCovers"> Pular capas <span style="color:#888;">(2x mais rápido)</span>
						</label>
						<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;white-space:nowrap;">
							<input type="checkbox" id="mergeFolders"> Mesclar subpastas <span style="color:#888;">(ignora 1º nível)</span>
						</label>
					</div>
					<!-- Find & Replace -->
					<div id="findReplaceBar" style="display:none;gap:8px;align-items:center;margin-bottom:12px;padding:10px 14px;background:#f0f4ff;border-radius:8px;flex-wrap:wrap;">
						<div style="display:flex;gap:6px;align-items:center;flex:1;min-width:200px;">
							<input type="text" id="frFind" placeholder="Buscar..." style="flex:1;padding:6px 10px;font-size:12px;min-width:80px;">
							<input type="text" id="frReplace" placeholder="Substituir por..." style="flex:1;padding:6px 10px;font-size:12px;min-width:80px;">
							<select id="frTarget" style="padding:6px 8px;font-size:12px;min-width:auto;">
								<option value="both">Título + Artista</option>
								<option value="title">Só título</option>
								<option value="artist">Só artista</option>
							</select>
							<button class="btn btn-ghost btn-sm" onclick="applyFindReplace()">Aplicar</button>
						</div>
						<div style="display:flex;gap:6px;align-items:center;">
							<input type="text" id="frSetArtist" placeholder="Definir artista para todos..." style="padding:6px 10px;font-size:12px;width:180px;">
							<button class="btn btn-ghost btn-sm" onclick="setAllArtist()">Definir</button>
						</div>
					</div>
					<div id="folderPreview" style="max-height:300px;overflow-y:auto;"></div>
				</div>
				<div id="uploadProgress" style="display:none;margin-top:12px;">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
						<span style="font-size:14px;font-weight:500;" id="progressText">Enviando...</span>
						<span style="font-size:13px;color:#888;" id="progressCount">0/0</span>
					</div>
					<div class="progress-bar" style="height:6px;"><div class="progress-fill" id="uploadProgressFill"></div></div>
				</div>
				<div id="uploadQueue" style="margin-top:8px;"></div>
			</div>

			<!-- Songs -->
			<div class="detail-section">
				<div class="detail-section-title">
					<span id="songsTitle">Músicas</span>
					<div style="display:flex;gap:8px;align-items:center;">
						<button class="btn btn-ghost btn-sm" id="bulkRenameBtn" style="display:none;" onclick="showBulkRename()">Renomear selecionadas</button>
						<button class="btn btn-danger btn-sm" id="bulkDeleteBtn" style="display:none;" onclick="bulkDeleteSongs()">Excluir selecionadas</button>
					</div>
				</div>
				<!-- Song filters -->
				<div id="songFilters" style="display:none;margin-bottom:12px;">
					<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
						<input type="text" id="songSearch" placeholder="Buscar música ou artista..." oninput="filterSongs()" style="flex:1;min-width:200px;padding:7px 12px;font-size:13px;">
						<select id="songFolderFilter" onchange="filterSongs()" style="padding:7px 12px;font-size:13px;min-width:auto;">
							<option value="">Todas as pastas</option>
						</select>
					</div>
				</div>
				<div id="bulkRenameBox" style="display:none;margin-bottom:12px;padding:12px 14px;background:#f0f4ff;border-radius:8px;">
					<div style="font-size:13px;font-weight:600;margin-bottom:8px;">Renomear selecionadas em sequ\\u00eancia</div>
					<div style="display:flex;gap:8px;align-items:center;">
						<input type="text" id="bulkRenamePrefix" placeholder="Ex: DJ WAGNER" style="flex:1;padding:7px 12px;font-size:13px;">
						<button class="btn btn-primary btn-sm" onclick="applyBulkRename()">Aplicar</button>
						<button class="btn btn-ghost btn-sm" onclick="hideBulkRename()">Cancelar</button>
					</div>
					<p style="font-size:11px;color:#888;margin-top:6px;">Resultado: DJ WAGNER 01, DJ WAGNER 02, DJ WAGNER 03...</p>
				</div>
				<div id="songsList"></div>
			</div>
		</div>
	</div>
	`;
}
