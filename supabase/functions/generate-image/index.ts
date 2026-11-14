import { createClient } from "jsr:@supabase/supabase-js@2";

// Gera o personagem 3D (kind "char") ou o uniforme 3D (kind "u3d") a partir das fotos enviadas.
// Só Pro, só membros da pelada, com limite diário. As fotos NÃO são guardadas em lugar nenhum.
// Troque de motor mudando os segredos: AI_PROVIDER ("gemini"), GEMINI_API_KEY e AI_MODEL.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const DAILY = { char: 2, u3d: 4 } as Record<string, number>;
const MONTHLY = { char: 2, u3d: 8 } as Record<string, number>; // mês de Brasília (renova dia 1)

async function gemini(prompt: string, images: { mime: string; b64: string }[]) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return { error: "not_configured" };
  const model = Deno.env.get("AI_MODEL") || "gemini-2.5-flash-image";
  const parts: any[] = [{ text: prompt }, ...images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.b64 } }))];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  if (!r.ok) return { error: "provider_" + r.status };
  const d = await r.json();
  const p = (d?.candidates?.[0]?.content?.parts || []).find((x: any) => x.inlineData || x.inline_data);
  const inl = p?.inlineData || p?.inline_data;
  if (!inl?.data) return { error: "no_image" };
  return { image: `data:${inl.mimeType || inl.mime_type || "image/png"};base64,${inl.data}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const { data: u } = await admin.auth.getUser(token);
  const uid = u?.user?.id;
  if (!uid) return j({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return j({ error: "bad_json" }, 400); }
  const kind = String(b.kind || ""), code = String(b.code || ""), prompt = String(b.prompt || "").slice(0, 5000);
  if (!DAILY[kind] || !code || prompt.length < 40) return j({ error: "bad_request" }, 400);
  const imgs: string[] = Array.isArray(b.images) ? b.images.slice(0, 5) : [];
  const images: { mime: string; b64: string }[] = [];
  for (const d of imgs) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d));
    if (!m || m[2].length > 2_000_000) return j({ error: "bad_image" }, 400);
    images.push({ mime: m[1], b64: m[2] });
  }
  if (!images.length) return j({ error: "bad_request" }, 400);
  const { data: p } = await admin.from("peladas").select("owner,doc").eq("code", code).maybeSingle();
  if (!p) return j({ error: "not_found" }, 404);
  const members = new Set<string>([p.owner, ...(p.doc?.state?.players || []).map((x: any) => x.uid).filter(Boolean)]);
  if (!members.has(uid)) return j({ error: "forbidden" }, 403);
  if (p.doc?.state?.pelada?.plan !== "pro") return j({ error: "pro_only" }, 402);
  if (kind === "u3d" && uid !== p.owner) return j({ error: "forbidden" }, 403);
  const count = async (sinceIso: string) => {
    // uniforme: limites por pelada (dono); personagem: limites por usuário
    let q = admin.from("ai_gen_log").select("id", { count: "exact", head: true }).eq("kind", kind).gt("created_at", sinceIso);
    q = kind === "u3d" ? q.eq("pelada_code", code) : q.eq("user_id", uid);
    return (await q).count || 0;
  };
  if (await count(new Date(Date.now() - 24 * 36e5).toISOString()) >= DAILY[kind]) return j({ error: "daily_limit" }, 429);
  const br = new Date(Date.now() - 3 * 36e5);
  const monthStart = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1) + 3 * 36e5).toISOString();
  if (await count(monthStart) >= MONTHLY[kind]) return j({ error: "monthly_limit" }, 429);
  const out = await gemini(prompt, images);
  if (out.error) return j({ error: out.error }, out.error === "not_configured" ? 503 : 502);
  await admin.from("ai_gen_log").insert({ user_id: uid, kind, pelada_code: code });
  return j({ image: out.image });
});
