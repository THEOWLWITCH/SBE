import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const DEFAULT_MODULES = { conv: true, activity: true, academic: true };

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 200, headers: CORS });

  let store;
  try { store = getStore("inst-modules"); }
  catch (e) { return new Response(JSON.stringify({ error: "storage unavailable" }), { status: 503, headers: CORS }); }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const inst = url.searchParams.get("inst");
    if (!inst) return new Response(JSON.stringify({ error: "missing inst" }), { status: 400, headers: CORS });
    const data = await store.get(inst, { type: "json" }).catch(() => null);
    return new Response(JSON.stringify(data ?? DEFAULT_MODULES), { headers: CORS });
  }

  if (req.method === "POST") {
    const token = process.env.SBE_ADMIN_TOKEN;
    if (!token) return new Response(JSON.stringify({ error: "SBE_ADMIN_TOKEN not configured" }), { status: 503, headers: CORS });

    let body;
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ error: "invalid JSON" }), { status: 400, headers: CORS }); }

    if (body.adminToken !== token)
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403, headers: CORS });

    const { inst, modules } = body;
    if (!inst || typeof modules !== "object")
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: CORS });

    const safe = {
      conv:     modules.conv     !== false,
      activity: modules.activity !== false,
      academic: modules.academic !== false,
    };
    await store.setJSON(inst, safe);
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  return new Response("method not allowed", { status: 405, headers: CORS });
};

export const config = { path: "/api/inst-config" };
