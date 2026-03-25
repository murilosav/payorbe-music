export function json(data: any, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

export function generateAccessToken(): string {
	const tokenBytes = new Uint8Array(32);
	crypto.getRandomValues(tokenBytes);
	return Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
