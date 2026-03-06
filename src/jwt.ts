export interface JwtPayload {
	product_id: string;
	order_id: string;
	email: string;
	download_limit: number;
	iat: number;
	exp: number;
}

function base64UrlDecode(str: string): Uint8Array {
	str = str.replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	const binary = atob(str);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
	const parts = token.split(".");
	if (parts.length !== 3) throw new Error("Token inv\u00e1lido");

	// Import key
	const keyData = new TextEncoder().encode(secret);
	const key = await crypto.subtle.importKey(
		"raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
	);

	// Verify signature
	const signatureInput = new TextEncoder().encode(parts[0] + "." + parts[1]);
	const signature = base64UrlDecode(parts[2]);
	const valid = await crypto.subtle.verify("HMAC", key, signature, signatureInput);
	if (!valid) throw new Error("Assinatura inv\u00e1lida");

	// Decode payload
	const payloadJson = new TextDecoder().decode(base64UrlDecode(parts[1]));
	const payload = JSON.parse(payloadJson) as JwtPayload;

	// Check expiration
	if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
		throw new Error("Token expirado");
	}

	return payload;
}
