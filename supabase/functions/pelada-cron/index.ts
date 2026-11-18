import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { tick, type Ev } from "./logic.ts";

const PUB = "BKQlIsvlNM_wrJauHrF5M4BsMTB-JdYva50F9gkOtzQJBG0d4J9pVzVwQGQBcvwexvCLKwa4PuJ-VFQYG1ojO70";
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (priv) webpush.setVapidDetails("mailto:contato@obrasileiro.work", PUB, priv);
  const now = Date.now();
  const { data: rows, error } = await admin.from("peladas").select("id,code,owner,doc,version");
  if (error) return j({ error: error.message }, 500);
  let saved = 0, notified = 0;
  for (const r of rows || []) {
    try {
      const doc = structuredClone(r.doc);
      const { changed, events } = tick(doc, now);
      if (changed) {
        const { data: ok, error: ue } = await admin.from("peladas").update({ doc, version: r.version + 1 }).eq("id", r.id).eq("version", r.version).select("id");
        if (ue) { console.error("update", r.code, ue.message); continue; }
        if (!ok || !ok.length) continue; // alguém salvou no meio: tenta de novo no próximo ciclo
        saved++;
      }
      if (events.length) notified += await send(admin, r, doc, events, !!priv);
    } catch (_) { /* uma pelada com problema não derruba as outras */ }
  }
  return j({ peladas: rows?.length || 0, saved, notified });
});

async function send(admin: any, r: any, doc: any, events: Ev[], push: boolean) {
  const S = doc.state, players: any[] = S.players || [];
  const members = new Set<string>([r.owner, ...players.map((x) => x.uid).filter(Boolean)]);
  const adminPl = players.find((p) => p.id === (S.tempAdminId || S.ownerId));
  const adminUid = adminPl?.uid || r.owner;
  let total = 0;
  for (const e of events) {
    const target = e.to === "all" ? [...members] : e.to === "admin" ? [adminUid] : e.to.filter((u) => members.has(u));
    if (!target.length) continue;
    const { data: profs } = await admin.from("profiles").select("id,doc").in("id", target);
    let want = (profs || []).filter((p: any) => p.doc?.notif?.[e.type] !== false).map((p: any) => p.id as string);
    // rede de segurança: não repete o mesmo aviso para a mesma pessoa em 20h
    const { data: dup } = await admin.from("notifications").select("user_id").eq("pelada_code", r.code).eq("title", e.title).in("user_id", want).gt("created_at", new Date(Date.now() - 20 * 36e5).toISOString());
    const seen = new Set((dup || []).map((d: any) => d.user_id));
    want = want.filter((id: string) => !seen.has(id));
    if (!want.length) continue;
    await admin.from("notifications").insert(want.map((id) => ({ user_id: id, pelada_code: r.code, type: e.type, title: e.title, body: e.body })));
    total += want.length;
    if (!push) continue;
    const { data: subs } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", want);
    const payload = JSON.stringify({ title: e.title, body: e.body, url: "/" }); const dead: string[] = [];
    await Promise.all((subs || []).map(async (s: any) => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 }); }
      catch (e2: any) { if (e2?.statusCode === 404 || e2?.statusCode === 410) dead.push(s.endpoint); }
    }));
    if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
  }
  return total;
}
