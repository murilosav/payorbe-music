import { describe, it, expect } from "vitest";
import { json, generateAccessToken } from "../api/helpers";

describe("json helper", () => {
	it("returns JSON response with default 200 status", async () => {
		const res = json({ ok: true });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/json");
		const body = await res.json();
		expect(body).toEqual({ ok: true });
	});

	it("returns custom status", () => {
		const res = json({ error: "not found" }, 404);
		expect(res.status).toBe(404);
	});

	it("serializes arrays", async () => {
		const res = json([1, 2, 3]);
		const body = await res.json();
		expect(body).toEqual([1, 2, 3]);
	});
});

describe("generateAccessToken", () => {
	it("returns 64-character hex string", () => {
		const token = generateAccessToken();
		expect(token).toMatch(/^[0-9a-f]{64}$/);
	});

	it("generates unique tokens", () => {
		const tokens = new Set(Array.from({ length: 10 }, () => generateAccessToken()));
		expect(tokens.size).toBe(10);
	});
});
