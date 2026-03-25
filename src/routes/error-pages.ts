export function renderAccessDenied(customMsg?: string): string {
	const msg = customMsg || "Este link \u00e9 inv\u00e1lido ou expirou. Entre em contato com o vendedor.";
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Acesso Negado</title>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
	<style>
	*{margin:0;padding:0;box-sizing:border-box}
	body{font-family:'Inter',sans-serif;background:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh}
	.card{text-align:center;padding:48px}
	h1{font-size:20px;margin-bottom:8px;color:#1a1a1a}
	p{font-size:14px;color:#888}
	</style>
</head>
<body><div class="card"><h1>Acesso Negado</h1><p>${msg}</p></div></body>
</html>`;
}

export function renderJwtError(type: "expired" | "invalid" | "limit" | "product"): string {
	const messages: Record<string, { title: string; desc: string }> = {
		expired: { title: "Link Expirado", desc: "Seu link de acesso expirou. Entre em contato com o vendedor para obter um novo link." },
		invalid: { title: "Link Inv\u00e1lido", desc: "Este link de acesso \u00e9 inv\u00e1lido. Verifique se copiou o link corretamente." },
		limit: { title: "Limite de Acessos Atingido", desc: "Voc\u00ea j\u00e1 atingiu o n\u00famero m\u00e1ximo de acessos permitidos para este link." },
		product: { title: "Produto N\u00e3o Encontrado", desc: "O produto associado a este link n\u00e3o foi encontrado. Entre em contato com o vendedor." },
	};
	const msg = messages[type] || messages.invalid;
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${msg.title} - Patacos</title>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
	<style>
	*{margin:0;padding:0;box-sizing:border-box}
	body{font-family:'Inter',sans-serif;background:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh}
	.card{text-align:center;padding:48px;max-width:400px}
	h1{font-size:20px;margin-bottom:8px;color:#1a1a1a}
	p{font-size:14px;color:#888;line-height:1.6}
	</style>
</head>
<body><div class="card"><h1>${msg.title}</h1><p>${msg.desc}</p></div></body>
</html>`;
}

export function renderZipUnavailable(): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>ZIP Indispon\u00edvel</title>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
	<style>
	*{margin:0;padding:0;box-sizing:border-box}
	body{font-family:'Inter',sans-serif;background:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh}
	.card{text-align:center;padding:48px}
	h1{font-size:20px;margin-bottom:8px;color:#1a1a1a}
	p{font-size:14px;color:#888}
	</style>
</head>
<body><div class="card"><h1>ZIP Indispon\u00edvel</h1><p>O arquivo ZIP ainda est\u00e1 sendo preparado. Tente novamente em alguns minutos.</p></div></body>
</html>`;
}
