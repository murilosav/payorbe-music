export function toastScript(): string {
	return `
	function toast(msg, type) {
		const c = document.getElementById('toastContainer');
		const el = document.createElement('div');
		el.className = 'toast toast-' + (type || 'success');
		el.textContent = msg;
		c.appendChild(el);
		requestAnimationFrame(function() { requestAnimationFrame(function() { el.classList.add('show'); }); });
		setTimeout(function() {
			el.classList.remove('show');
			setTimeout(function() { el.remove(); }, 300);
		}, 3000);
	}
	`;
}
