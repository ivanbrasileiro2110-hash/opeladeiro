import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const PUB = "BKQlIsvlNM_wrJauHrF5M4BsMTB-JdYva50F9gkOtzQJBG0d4J9pVzVwQGQBcvwexvCLKwa4PuJ-VFQYG1ojO70";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const TYPES = new Set(["vespera", "lista", "times", "resenha", "camp", "caixinha", "pedidos"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const { data: u } = await admin.auth.getUser(token);
  const uid = u?.user?.id;
  if (!uid) return j({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return j({ error: "bad_json" }, 400); }
  const code = String(b.code || ""), title = String(b.title || "Opeladeiro").slice(0, 80), body = String(b.body || "").slice(0, 160);
  const type = TYPES.has(String(b.type)) ? String(b.type) : "lista";
  if (!code || !body) return j({ error: "bad_request" }, 400);
  const { data: p } = await admin.from("peladas").select("owner,doc").eq("code", code).maybeSingle();
  if (!p) return j({ error: "not_found" }, 404);
  const players: any[] = p.doc?.state?.players || [];
  const members = new Set<string>([p.owner, ...players.map((x) => x.uid).filter(Boolean)]);
  if (!members.has(uid)) return j({ error: "forbidden" }, 403);
  members.delete(uid);
  if (!members.size) return j({ sent: 0 });
  // respeita as preferências de cada pessoa (perfil.doc.notif[tipo] === false desliga)
  const { data: profs } = await admin.from("profiles").select("id,doc").in("id", [...members]);
  const want = (profs || []).filter((r: any) => r.doc?.notif?.[type] !== false).map((r: any) => r.id as string);
  if (!want.length) return j({ sent: 0 });
  // caixa de avisos dentro do app (aparece no sino)
  await admin.from("notifications").insert(want.map((id) => ({ user_id: id, pelada_code: code, type, title, body })));
  if (!priv) return j({ sent: 0, inbox: want.length });
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", want);
  webpush.setVapidDetails("mailto:contato@obrasileiro.work", PUB, priv);
  const payload = JSON.stringify({ title, body, url: "/" });
  let sent = 0; const dead: string[] = [];
  await Promise.all((subs || []).map(async (s: any) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 }); sent++; }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint); }
  }));
  if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
  return j({ sent, inbox: want.length });
});
