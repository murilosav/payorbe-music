import { describe, it, expect } from "vitest";

// Test the ZIP status parsing logic used in zip.ts
// These are pure function tests extracted from the handler logic

function parseZipStatus(raw: string): { status: string; error?: string; stale?: boolean } {
	if (raw.startsWith("generating:")) {
		const startedAt = parseInt(raw.split(":")[1]);
		if (!isNaN(startedAt) && Date.now() - startedAt > 15 * 60 * 1000) {
			return { status: "error", error: "Timeout — geração travou", stale: true };
		}
		return { status: "generating" };
	}
	if (raw.startsWith("error:")) {
		return { status: "error", error: raw.slice(6) };
	}
	return { status: raw };
}

describe("ZIP status parsing", () => {
	it("parses empty status", () => {
		expect(parseZipStatus("")).toEqual({ status: "" });
	});

	it("parses 'ready' status", () => {
		expect(parseZipStatus("ready")).toEqual({ status: "ready" });
	});

	it("parses 'queued' status", () => {
		expect(parseZipStatus("queued")).toEqual({ status: "queued" });
	});

	it("parses active generating status", () => {
		const recent = `generating:${Date.now()}`;
		expect(parseZipStatus(recent)).toEqual({ status: "generating" });
	});

	it("detects stale generating status (>15 min)", () => {
		const old = `generating:${Date.now() - 20 * 60 * 1000}`;
		const result = parseZipStatus(old);
		expect(result.status).toBe("error");
		expect(result.stale).toBe(true);
	});

	it("parses error with message", () => {
		const result = parseZipStatus("error:Out of memory");
		expect(result.status).toBe("error");
		expect(result.error).toBe("Out of memory");
	});

	it("handles generating with invalid timestamp", () => {
		const result = parseZipStatus("generating:invalid");
		expect(result.status).toBe("generating");
	});
});
