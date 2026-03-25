import { describe, it, expect } from "vitest";
import {
	validateRequired,
	validateNumber,
	validatePositiveInt,
	validateString,
	validateSlug,
	validate,
} from "../api/validation";

function status(res: Response | null): number | null {
	return res ? res.status : null;
}

async function errorMsg(res: Response | null): Promise<string> {
	if (!res) return "";
	const body = await res.json() as { error: string };
	return body.error;
}

describe("validateRequired", () => {
	it("returns null when all fields present", () => {
		expect(validateRequired({ name: "Test", slug: "test" }, ["name", "slug"])).toBeNull();
	});

	it("returns 400 when field is missing", () => {
		const res = validateRequired({ name: "Test" }, ["name", "slug"]);
		expect(status(res)).toBe(400);
	});

	it("returns 400 when field is empty string", () => {
		const res = validateRequired({ name: "", slug: "test" }, ["name", "slug"]);
		expect(status(res)).toBe(400);
	});

	it("returns 400 when field is null", () => {
		const res = validateRequired({ name: null, slug: "test" }, ["name", "slug"]);
		expect(status(res)).toBe(400);
	});

	it("lists all missing fields in error message", async () => {
		const res = validateRequired({}, ["name", "slug"]);
		const msg = await errorMsg(res);
		expect(msg).toContain("name");
		expect(msg).toContain("slug");
	});
});

describe("validateNumber", () => {
	it("returns null for valid number", () => {
		expect(validateNumber(42, "age")).toBeNull();
	});

	it("returns null for undefined (optional)", () => {
		expect(validateNumber(undefined, "age")).toBeNull();
	});

	it("returns 400 for string value", () => {
		expect(status(validateNumber("not a number", "age"))).toBe(400);
	});

	it("returns 400 for NaN", () => {
		expect(status(validateNumber(NaN, "age"))).toBe(400);
	});
});

describe("validatePositiveInt", () => {
	it("returns null for valid positive integer", () => {
		expect(validatePositiveInt(5, "count")).toBeNull();
	});

	it("returns null for zero", () => {
		expect(validatePositiveInt(0, "count")).toBeNull();
	});

	it("returns 400 for negative number", () => {
		expect(status(validatePositiveInt(-1, "count"))).toBe(400);
	});

	it("returns 400 for float", () => {
		expect(status(validatePositiveInt(1.5, "count"))).toBe(400);
	});

	it("parses string integers", () => {
		expect(validatePositiveInt("5", "count")).toBeNull();
	});
});

describe("validateString", () => {
	it("returns null for valid string", () => {
		expect(validateString("hello", "name")).toBeNull();
	});

	it("returns null for undefined (optional)", () => {
		expect(validateString(undefined, "name")).toBeNull();
	});

	it("returns 400 for non-string", () => {
		expect(status(validateString(123, "name"))).toBe(400);
	});

	it("returns 400 for string exceeding maxLength", () => {
		expect(status(validateString("a".repeat(501), "name", 500))).toBe(400);
	});

	it("respects custom maxLength", () => {
		expect(status(validateString("abcdef", "name", 5))).toBe(400);
		expect(validateString("abcde", "name", 5)).toBeNull();
	});
});

describe("validateSlug", () => {
	it("returns null for valid slug", () => {
		expect(validateSlug("my-playlist")).toBeNull();
	});

	it("returns null for undefined (optional)", () => {
		expect(validateSlug(undefined)).toBeNull();
	});

	it("returns 400 for empty string", () => {
		expect(status(validateSlug(""))).toBe(400);
	});

	it("returns 400 for slug with only special chars", () => {
		expect(status(validateSlug("---"))).toBe(400);
	});

	it("returns 400 for slug over 100 chars", () => {
		expect(status(validateSlug("a".repeat(101)))).toBe(400);
	});
});

describe("validate (combinator)", () => {
	it("returns null when all checks pass", () => {
		expect(validate(null, null, null)).toBeNull();
	});

	it("returns first error", () => {
		const err1 = validateNumber("bad", "x");
		const err2 = validateNumber("bad", "y");
		const result = validate(null, err1, err2);
		expect(result).toBe(err1);
	});
});
