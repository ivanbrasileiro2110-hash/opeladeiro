import { createClient } from "jsr:@supabase/supabase-js@2";

// Recebe os eventos do RevenueCat (assinaturas da App Store e do Google Play) e liga/desliga o Pro.
// Configure no RevenueCat: URL desta função e o cabeçalho Authorization igual ao segredo RC_WEBHOOK_SECRET.
const PRO = new Set(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT"]);
const FREE = new Set(["EXPIRATION"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("RC_WEBHOOK_SECRET");
  if (!secret) return j({ error: "not_configured" }, 503);
  if (req.headers.get("Authorization") !== secret && req.headers.get("Authorization") !== "Bearer " + secret) return j({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return j({ error: "bad_json" }, 400); }
  const e = b?.event; if (!e?.type) return j({ ok: true, ignored: "no_event" });
  const ids: string[] = [e.app_user_id, e.original_app_user_id, ...(e.aliases || [])].filter((x: string) => typeof x === "string" && UUID.test(x));
  const uid = ids[0];
  if (!uid) return j({ ok: true, ignored: "no_user" });
  const plan = PRO.has(e.type) ? "pro" : FREE.has(e.type) ? "free" : null;
  if (!plan) return j({ ok: true, ignored: e.type });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("profiles").update({ plan }).eq("id", uid);
  if (error) return j({ error: error.message }, 500);
  return j({ ok: true, uid, plan });
});
