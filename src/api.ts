import type { Env } from "./index";
import { handleFolders } from "./api/folders";
import { handlePlaylists } from "./api/playlists";
import { handleSongs } from "./api/songs";
import { handleZip } from "./api/zip";
import { handlePresign } from "./api/presign";
import { handleTempLinks } from "./api/temp-links";
import { handleCleanup } from "./api/cleanup";

export async function handleApi(request: Request, env: Env, path: string, ctx?: ExecutionContext): Promise<Response> {
	// Try each handler in order; first non-null response wins
	const handlers = [
		(req: Request, e: Env, p: string) => handlePresign(req, e, p),
		(req: Request, e: Env, p: string) => handleFolders(req, e, p),
		(req: Request, e: Env, p: string) => handlePlaylists(req, e, p, ctx),
		(req: Request, e: Env, p: string) => handleZip(req, e, p, ctx),
		(req: Request, e: Env, p: string) => handleSongs(req, e, p),
		(req: Request, e: Env, p: string) => handleTempLinks(req, e, p),
		(req: Request, e: Env, p: string) => handleCleanup(req, e, p),
	];

	for (const handler of handlers) {
		const response = await handler(request, env, path);
		if (response) return response;
	}

	return new Response(JSON.stringify({ error: "Not found" }), {
		status: 404,
		headers: { "content-type": "application/json" },
	});
}
