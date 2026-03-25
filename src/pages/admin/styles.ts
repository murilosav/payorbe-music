export function adminStyles(): string {
	return `
	* { margin:0; padding:0; box-sizing:border-box; }
	body { font-family:'Inter',-apple-system,sans-serif; background:#fafafa; color:#1a1a1a; -webkit-font-smoothing:antialiased; }
	.container { max-width:800px; margin:0 auto; padding:20px; }

	/* Toast */
	.toast-container { position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
	.toast { padding:12px 20px; border-radius:10px; font-size:13px; font-weight:500; transform:translateX(120%); transition:transform 0.3s ease; box-shadow:0 4px 16px rgba(0,0,0,0.12); max-width:340px; pointer-events:auto; }
	.toast.show { transform:translateX(0); }
	.toast-success { background:#16a34a; color:#fff; }
	.toast-error { background:#dc2626; color:#fff; }
	.toast-info { background:#1a1a1a; color:#fff; }

	/* Header */
	.header { display:flex; justify-content:space-between; align-items:center; padding:24px 0 20px; }
	.header h1 { font-size:22px; font-weight:700; }
	.header-actions { display:flex; gap:16px; align-items:center; }
	.header-actions a { color:#888; font-size:13px; text-decoration:none; }
	.header-actions a:hover { color:#333; }
	.header-actions a.danger { color:#dc2626; }

	/* Card */
	.card { background:#fff; border:1px solid #eee; border-radius:12px; padding:20px; margin-bottom:12px; }

	/* Buttons */
	.btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; transition:all 0.15s; }
	.btn:disabled { opacity:0.5; cursor:not-allowed; }
	.btn-primary { background:#1a1a1a; color:#fff; }
	.btn-primary:hover:not(:disabled) { background:#333; }
	.btn-danger { background:#ef4444; color:#fff; }
	.btn-danger:hover:not(:disabled) { background:#dc2626; }
	.btn-ghost { background:#f0f0f0; color:#333; }
	.btn-ghost:hover:not(:disabled) { background:#e0e0e0; }
	.btn-sm { padding:5px 12px; font-size:12px; }

	/* Forms */
	input[type="text"], input[type="number"], select { width:100%; padding:10px 14px; border:1px solid #ddd; border-radius:8px; font-size:14px; font-family:inherit; outline:none; transition:border-color 0.2s; }
	input[type="text"]:focus, input[type="number"]:focus, select:focus { border-color:#999; }
	.form-group { margin-bottom:12px; }
	.form-group label { display:block; font-size:11px; font-weight:600; color:#999; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px; }
	.form-row { display:flex; gap:12px; }
	.form-row .form-group { flex:1; }

	/* Badges */
	.badge { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; }
	.badge-success { background:#f0fdf4; color:#16a34a; }
	.badge-warning { background:#fffbeb; color:#d97706; }
	.badge-muted { background:#f5f5f5; color:#999; }

	/* Playlist cards (list view) */
	.pl-card { background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; margin-bottom:10px; transition:border-color 0.15s; }
	.pl-card:hover { border-color:#ccc; }
	.pl-card-top { display:flex; align-items:center; gap:14px; }
	.pl-cover { width:52px; height:52px; border-radius:10px; overflow:hidden; background:#f0f0f0; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
	.pl-cover img { width:100%; height:100%; object-fit:cover; }
	.pl-info { flex:1; min-width:0; }
	.pl-name { font-weight:600; font-size:15px; margin-bottom:3px; }
	.pl-stats { font-size:12px; color:#888; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
	.pl-actions { display:flex; gap:6px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end; }

	/* Detail view */
	.back-btn { display:inline-flex; align-items:center; gap:6px; font-size:14px; color:#888; cursor:pointer; background:none; border:none; font-family:inherit; padding:8px 0; margin-bottom:16px; }
	.back-btn:hover { color:#333; }
	.section { margin-bottom:16px; }
	.section-title { font-size:13px; font-weight:600; color:#555; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; text-transform:uppercase; letter-spacing:0.5px; }

	/* Songs */
	.song-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #f5f5f5; font-size:13px; }
	.song-row:last-child { border-bottom:none; }
	.song-row input[type="checkbox"] { width:16px; height:16px; cursor:pointer; flex-shrink:0; accent-color:#1a1a1a; }
	.song-info { flex:1; min-width:0; }
	.song-title { font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
	.song-meta { font-size:11px; color:#aaa; }
	.song-size { font-size:12px; color:#999; flex-shrink:0; }
	.select-all-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:2px solid #eee; font-size:13px; font-weight:500; color:#666; }

	/* Upload */
	.upload-area { border:2px dashed #ddd; border-radius:12px; padding:24px; text-align:center; cursor:default; transition:all 0.2s; color:#888; }
	.upload-area:hover { border-color:#999; color:#555; }
	.upload-area.dragover { border-color:#1a1a1a; background:#f5f5f5; }
	.upload-banner { position:fixed; top:0; left:0; right:0; background:#1a1a1a; color:#fff; z-index:999; padding:0; transition:transform 0.3s; transform:translateY(-100%); }
	.upload-banner.active { transform:translateY(0); }
	.upload-banner-content { max-width:800px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; gap:16px; }
	.upload-banner .spinner { width:20px; height:20px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; }
	@keyframes spin { to { transform:rotate(360deg); } }
	.upload-banner-text { flex:1; font-size:14px; }
	.upload-banner-pct { font-size:14px; font-weight:600; font-variant-numeric:tabular-nums; }
	.upload-banner-bar { position:absolute; bottom:0; left:0; height:3px; background:#4ade80; transition:width 0.3s; }
	.upload-banner.done { background:#16a34a; }
	.upload-banner.has-errors { background:#dc2626; }
	.upload-item { display:flex; align-items:center; gap:10px; padding:8px 12px; font-size:13px; border-bottom:1px solid #f5f5f5; border-radius:6px; transition:background 0.2s; }
	.upload-item.uploading { background:#f8f8f8; }
	.upload-item .status-icon { width:20px; height:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
	.upload-item .status-icon.waiting { color:#ddd; }
	.upload-item .status-icon.uploading { color:#1a1a1a; }
	.upload-item .status-icon.done { color:#22c55e; }
	.upload-item .status-icon.error { color:#ef4444; }
	.upload-item .file-info { flex:1; min-width:0; }
	.upload-item .file-name { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
	.upload-item .file-folder { font-size:11px; color:#aaa; }
	.upload-item .file-status { font-size:12px; color:#888; flex-shrink:0; }

	/* Pagination */
	.pagination { display:flex; align-items:center; justify-content:center; gap:8px; padding:16px 0 4px; font-size:13px; }
	.pagination button { padding:6px 14px; border:1px solid #ddd; background:#fff; border-radius:6px; font-size:12px; cursor:pointer; font-family:inherit; transition:all 0.15s; }
	.pagination button:hover:not(:disabled) { border-color:#999; }
	.pagination button:disabled { opacity:0.4; cursor:not-allowed; }
	.pagination span { color:#888; }

	.progress-bar { width:100%; height:4px; background:#eee; border-radius:2px; overflow:hidden; }
	.progress-fill { height:100%; background:#1a1a1a; width:0%; transition:width 0.3s; }

	/* Drag & Drop folders */
	.pl-card[draggable="true"] { cursor:grab; position:relative; }
	.pl-card[draggable="true"]:active { cursor:grabbing; }
	.pl-card.dragging { opacity:0.35; transform:scale(0.98); }
	.drag-handle { color:#ccc; margin-right:2px; flex-shrink:0; cursor:grab; }
	.folder-drop-zone { transition:all 0.2s; border-radius:14px; border:2px solid transparent; }
	.folder-drop-zone.drag-over { border-color:#4ade80; background:#f0fdf4; }
	.folder-drop-zone.drag-over .folder-drop-hint { display:block; }
	.folder-drop-hint { display:none; font-size:12px; color:#16a34a; padding:8px 20px; font-weight:500; text-align:center; }
	.standalone-zone { transition:all 0.2s; min-height:20px; padding:4px 0; border-radius:14px; border:2px solid transparent; }
	.standalone-zone.drag-over { background:#fef3c7; border-color:#d97706; }

	/* Folder card */
	.folder-card { background:linear-gradient(135deg, #f8f8ff 0%, #f0f0ff 100%); border:1px solid #e0e0f0; border-radius:12px; margin-bottom:4px; }
	.folder-card .pl-card-top { padding:16px; }
	.folder-children { padding:0 0 8px 24px; }
	.folder-children .pl-card { border-left:2px solid #e8e8f0; margin-left:8px; border-top-left-radius:0; border-bottom-left-radius:0; }
	.folder-empty { padding:12px 20px 12px 44px; color:#bbb; font-size:13px; font-style:italic; }

	/* Folder edit panel */
	.folder-edit-panel { background:#fff; border:1px solid #e8e8f0; border-radius:10px; margin:0 16px 12px; padding:16px; display:none; }
	.folder-edit-panel.open { display:block; }
	.folder-edit-panel .form-row { display:flex; gap:10px; margin-bottom:10px; }
	.folder-edit-panel .form-group { flex:1; margin-bottom:0; }
	.folder-edit-panel .form-group label { font-size:10px; }
	.folder-edit-panel input, .folder-edit-panel textarea { font-size:13px; }
	.folder-edit-panel .edit-actions { display:flex; gap:8px; justify-content:flex-end; }

	/* Detail sections */
	.detail-section { background:#fff; border:1px solid #eee; border-radius:12px; padding:20px; margin-bottom:12px; }
	.detail-section-title { font-size:11px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; }
	.detail-divider { height:1px; background:#f0f0f0; margin:16px 0; }
	.link-row { display:flex; align-items:center; gap:6px; padding:10px 14px; background:#f8f8f8; border-radius:8px; }
	.link-row input { flex:1; font-size:12px; padding:0; background:transparent; border:none; color:#555; font-family:monospace; outline:none; }

	/* Responsive */
	.modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px; }
	.modal { background:#fff;border-radius:16px;padding:24px;width:100%;overflow-y:auto;max-height:90vh;box-shadow:0 20px 60px rgba(0,0,0,0.15); }

	@media (max-width:600px) {
		.pl-card-top { flex-wrap:wrap; }
		.pl-actions { width:100%; justify-content:flex-start; margin-top:8px; }
		.form-row { flex-direction:column; gap:0; }
		.folder-children { padding-left:12px; }
		.folder-children .pl-card { margin-left:4px; }
		.folder-edit-panel { margin:0 8px 12px; }
	}
	`;
}
