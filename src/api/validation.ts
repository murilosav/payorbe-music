import { json } from "./helpers";

export function validateRequired(body: Record<string, any>, fields: string[]): Response | null {
	const missing = fields.filter(f => body[f] === undefined || body[f] === null || body[f] === "");
	if (missing.length > 0) {
		return json({ error: `Campos obrigatórios: ${missing.join(", ")}` }, 400);
	}
	return null;
}

export function validateNumber(value: any, field: string): Response | null {
	if (value !== undefined && value !== null && (typeof value !== "number" || isNaN(value))) {
		return json({ error: `${field} deve ser um número` }, 400);
	}
	return null;
}

export function validatePositiveInt(value: any, field: string): Response | null {
	if (value !== undefined && value !== null) {
		const n = typeof value === "string" ? parseInt(value) : value;
		if (typeof n !== "number" || isNaN(n) || n < 0 || !Number.isInteger(n)) {
			return json({ error: `${field} deve ser um inteiro positivo` }, 400);
		}
	}
	return null;
}

export function validateString(value: any, field: string, maxLength = 500): Response | null {
	if (value !== undefined && value !== null) {
		if (typeof value !== "string") {
			return json({ error: `${field} deve ser texto` }, 400);
		}
		if (value.length > maxLength) {
			return json({ error: `${field} excede ${maxLength} caracteres` }, 400);
		}
	}
	return null;
}

export function validateSlug(value: any): Response | null {
	if (value !== undefined && value !== null) {
		if (typeof value !== "string" || value.length === 0 || value.length > 100) {
			return json({ error: "Slug inválido" }, 400);
		}
		const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/(^-+|-+$)/g, "").replace(/-{2,}/g, "-");
		if (!cleaned) {
			return json({ error: "Slug inválido" }, 400);
		}
	}
	return null;
}

/** Run multiple validators, return first error or null */
export function validate(...checks: (Response | null)[]): Response | null {
	for (const check of checks) {
		if (check) return check;
	}
	return null;
}
