import type { Env } from "./index";

const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days

export async function generateToken(adminKey: string): Promise<string> {
	const data = new TextEncoder().encode(adminKey + ":" + Date.now());
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyAuth(request: Request, env: Env): Promise<boolean> {
	if (!env.ADMIN_KEY) return false;

	// Check Authorization header (for API calls)
	const authHeader = request.headers.get("Authorization");
	if (authHeader) {
		const token = authHeader.replace("Bearer ", "");
		if (token === env.ADMIN_KEY) return true;
	}

	// Check session cookie
	const cookie = request.headers.get("Cookie") || "";
	const match = cookie.match(/payorbe_session=([^;]+)/);
	if (match) {
		const sessionToken = match[1];
		// Verify token exists in DB
		const session = await env.DB.prepare(
			"SELECT expires_at FROM admin_sessions WHERE token = ?"
		).bind(sessionToken).first<{ expires_at: string }>();

		if (session) {
			const expiresAt = new Date(session.expires_at).getTime();
			if (Date.now() < expiresAt) return true;
			// Expired, clean up
			await env.DB.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(sessionToken).run();
		}
	}

	return false;
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
	if (request.method === "GET") {
		return new Response(renderLoginPage(), {
			headers: { "content-type": "text/html; charset=utf-8" },
		});
	}

	if (request.method === "POST") {
		// Cleanup expired sessions and old login attempts (opportunistic)
		await Promise.all([
			env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at < datetime('now')").run(),
			env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at < datetime('now', '-1 hour')").run(),
		]).catch(() => {});

		// Rate limit: max 5 attempts per IP per 15 minutes
		const ip = request.headers.get("CF-Connecting-IP") || "unknown";
		const recentAttempts = await env.DB.prepare(
			"SELECT COUNT(*) as cnt FROM login_attempts WHERE ip = ? AND attempted_at > datetime('now', '-15 minutes')"
		).bind(ip).first<{ cnt: number }>();

		if (recentAttempts && recentAttempts.cnt >= 5) {
			return new Response(renderLoginPage("Muitas tentativas. Aguarde 15 minutos."), {
				status: 429,
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}

		const formData = await request.formData();
		const password = formData.get("password") as string;

		if (!password || password !== env.ADMIN_KEY) {
			// Log failed attempt
			await env.DB.prepare("INSERT INTO login_attempts (ip) VALUES (?)").bind(ip).run();
			return new Response(renderLoginPage("Senha incorreta."), {
				status: 401,
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}

		// Clean up old attempts on successful login
		await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();

		const token = await generateToken(env.ADMIN_KEY);
		const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000).toISOString();

		// Store session
		await env.DB.prepare(
			"INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)"
		).bind(token, expiresAt).run();

		return new Response(null, {
			status: 302,
			headers: {
				"Location": "/admin",
				"Set-Cookie": `payorbe_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DURATION}`,
			},
		});
	}

	return new Response("Method not allowed", { status: 405 });
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
	const cookie = request.headers.get("Cookie") || "";
	const match = cookie.match(/payorbe_session=([^;]+)/);
	if (match) {
		await env.DB.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(match[1]).run();
	}

	return new Response(null, {
		status: 302,
		headers: {
			"Location": "/admin/login",
			"Set-Cookie": "payorbe_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
		},
	});
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderLoginPage(error?: string): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Login - PayOrbe Music</title>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body {
		font-family: 'Inter', -apple-system, sans-serif;
		background: #fafafa;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		-webkit-font-smoothing: antialiased;
	}
	.login-card {
		background: #fff;
		border: 1px solid #eee;
		border-radius: 16px;
		padding: 40px;
		width: 100%;
		max-width: 380px;
		margin: 20px;
	}
	h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; text-align: center; }
	p { font-size: 14px; color: #888; text-align: center; margin-bottom: 24px; }
	label { display: block; font-size: 13px; font-weight: 500; color: #555; margin-bottom: 6px; }
	input[type="password"] {
		width: 100%;
		padding: 12px 16px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 14px;
		font-family: inherit;
		outline: none;
		transition: border-color 0.2s;
		margin-bottom: 16px;
	}
	input:focus { border-color: #999; }
	button {
		width: 100%;
		padding: 12px;
		background: #1a1a1a;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.2s;
	}
	button:hover { background: #333; }
	.error {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 13px;
		margin-bottom: 16px;
		text-align: center;
	}
	</style>
</head>
<body>
	<div class="login-card">
		<h1>PayOrbe Music</h1>
		<p>Acesso administrativo</p>
		${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
		<form method="POST" action="/admin/login">
			<label>Senha</label>
			<input type="password" name="password" placeholder="Digite a senha de admin" autofocus required>
			<button type="submit">Entrar</button>
		</form>
	</div>
</body>
</html>`;
}
