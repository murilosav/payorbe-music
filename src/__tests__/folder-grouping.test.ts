import { describe, it, expect } from "vitest";

// Test the folder page grouping logic (extracted from index.ts)
// This tests the Map grouping that replaced the N+1 query pattern

function groupByPlaylistId(rows: Array<{ playlist_id: number; [key: string]: any }>): Map<number, any[]> {
	const map = new Map<number, any[]>();
	for (const row of rows) {
		if (!map.has(row.playlist_id)) map.set(row.playlist_id, []);
		map.get(row.playlist_id)!.push(row);
	}
	return map;
}

describe("folder page grouping", () => {
	it("groups songs by playlist_id", () => {
		const songs = [
			{ playlist_id: 1, title: "Song A" },
			{ playlist_id: 1, title: "Song B" },
			{ playlist_id: 2, title: "Song C" },
			{ playlist_id: 3, title: "Song D" },
		];

		const grouped = groupByPlaylistId(songs);
		expect(grouped.size).toBe(3);
		expect(grouped.get(1)).toHaveLength(2);
		expect(grouped.get(2)).toHaveLength(1);
		expect(grouped.get(3)).toHaveLength(1);
	});

	it("handles empty array", () => {
		const grouped = groupByPlaylistId([]);
		expect(grouped.size).toBe(0);
	});

	it("handles single playlist", () => {
		const songs = [
			{ playlist_id: 5, title: "A" },
			{ playlist_id: 5, title: "B" },
		];
		const grouped = groupByPlaylistId(songs);
		expect(grouped.size).toBe(1);
		expect(grouped.get(5)).toHaveLength(2);
	});

	it("ensures playlists without songs get empty arrays when initialized", () => {
		const songs = [{ playlist_id: 1, title: "A" }];
		const grouped = groupByPlaylistId(songs);

		// Simulate: ensure all playlist IDs have entries
		const playlistIds = [1, 2, 3];
		for (const id of playlistIds) {
			if (!grouped.has(id)) grouped.set(id, []);
		}

		expect(grouped.get(1)).toHaveLength(1);
		expect(grouped.get(2)).toEqual([]);
		expect(grouped.get(3)).toEqual([]);
	});
});
