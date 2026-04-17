import type { APIRoute } from "astro";
import { fetchStatusPayload } from "../../lib/statusPage";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const payload = await fetchStatusPayload();
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=45, s-maxage=45, stale-while-revalidate=120"
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
};
