// Motor de tempo da pelada no servidor: abre/fecha a lista sozinho e gera lembretes.
// Espelha as regras do app (lOpen, lClose, lc, nextGameDate). Fuso fixo de Brasília (-03:00).
export type Ev = { type: string; title: string; body: string; to: "all" | "admin" | string[] };
const TZ = "America/Sao_Paulo";
const DEF = { modo: "auto", abreWd: null as any, abreH: "12:00", fechaH: 3, lembra: true, lembraWd: null as any, lembraH: "12:00", vagas: null as any, golLim: false, vagasGol: 2 };
const z = (n: number) => String(n).padStart(2, "0");

export function localParts(ms: number) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" });
  const o: any = {}; for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday);
  const h = o.hour === "24" ? 0 : +o.hour;
  return { iso: `${o.year}-${o.month}-${o.day}`, wd, min: h * 60 + +o.minute };
}
export const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}`; };
const hm = (t: string) => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const startTs = (date: string, time: string) => Date.parse(`${date}T${time || "20:00"}:00-03:00`);

function cfg(P: any) {
  const c: any = Object.assign({}, DEF, P.lista || {});
  const w = P.weekday;
  if (c.vagas == null) c.vagas = (P.base || 5) * 2;
  if (c.abreWd == null) c.abreWd = w == null ? 4 : (w + 5) % 7;
  if (c.lembraWd == null) c.lembraWd = c.abreWd;
  if (P.plan !== "pro") c.modo = "manual";
  return c;
}
function nextGameDate(P: any, now: number) {
  const L = localParts(now); const w = P.weekday;
  let add = w == null ? 0 : (w - L.wd + 7) % 7;
  if (add === 0 && P.time && L.min > hm(P.time)) add = 7;
  return addDays(L.iso, add);
}
const role = (p: any) => (p && p.pos === "GOL" ? "gol" : "linha");

export function tick(doc: any, now: number): { changed: boolean; events: Ev[] } {
  const S = doc?.state, ev: Ev[] = [];
  if (!S || !S.pelada || S.pelada.weekday == null || !S.pelada.time) return { changed: false, events: ev };
  const P = S.pelada, c = cfg(P), L = localParts(now);
  S.srv = S.srv || {}; const mk = S.srv; let changed = false;
  const byId = (id: string) => (S.players || []).find((p: any) => p.id === id);
  const name = P.name || "Pelada";
  const active = () => !!S.lst && S.lst.status !== "encerrada";

  // 0) encerrar a lista quando a pelada termina. O app já faz isso ao tocar em "Encerrar pelada";
  //    aqui só cobrimos o caso de a pelada ser encerrada fora do app: encerra às 6h do dia seguinte.
  if (S.lst && S.lst.status !== "encerrada") {
    const ended = S.closedDate === S.lst.date || (S.session && S.session.date === S.lst.date) || now > startTs(addDays(S.lst.date, 1), "06:00");
    if (ended) {
      const C = (S.cx = S.cx || {}); C.multas = C.multas || [];
      const nm = (v: any) => parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0;
      (S.lst.fines || []).filter((f: any) => f.state === "prov").forEach((f: any) => { f.state = "ativa"; C.multas.push({ id: f.id, pid: f.pid, date: S.lst.date, kind: "desist", valor: (Math.round(nm(C.diaria) * .5 * 100) / 100).toFixed(2).replace(".", ",") }); });
      S.lst.status = "encerrada"; changed = true;
    }
  }
  // 1) abrir a lista sozinho
  if (c.modo === "auto" && !active() && L.wd === c.abreWd && L.min >= hm(c.abreH)) {
    let dt = nextGameDate(P, now);
    if (S.lst && S.lst.date >= dt) dt = addDays(S.lst.date, 7);
    const sameWeek = dt <= addDays(L.iso, 7);
    if (sameWeek && mk.open !== dt) {
      S.lst = { date: dt, status: "aberta", in: [], esp: [], nao: [], at: {}, openedAt: now, closedAt: null, edit: false, fines: [], simLeft: null };
      (S.players || []).forEach((p: any) => { if (p.on) p.on = false; });
      mk.open = dt; changed = true;
      ev.push({ type: "lista", title: "Lista aberta · " + name, body: `Pelada de ${dt.slice(8)}/${dt.slice(5, 7)} às ${P.time}. Mensalistas: confirmem se vão. Avulsos: entrem na lista de espera.`, to: "all" });
    }
  }
  // 2) fechar a lista sozinho (promove a espera)
  if (c.modo === "auto" && S.lst && S.lst.status === "aberta") {
    const closeTs = startTs(S.lst.date, P.time) - c.fechaH * 36e5;
    if (now >= closeTs) {
      const l = S.lst; l.status = "fechada"; l.closedAt = now; const up: string[] = [];
      const cap = (r: string) => (r === "gol" ? (c.golLim ? c.vagasGol : Infinity) : c.vagas);
      const inR = (r: string) => l.in.filter((id: string) => role(byId(id)) === r);
      const free = (r: string) => cap(r) - inR(r).length;
      for (const r of ["linha", "gol"]) { while (free(r) > 0) { const nx = l.esp.find((id: string) => role(byId(id)) === r); if (!nx) break; l.esp = l.esp.filter((x: string) => x !== nx); l.in.push(nx); up.push(nx); } }
      (S.players || []).forEach((p: any) => { const v = l.in.includes(p.id); if (p.on !== v) p.on = v; });
      changed = true;
      ev.push({ type: "lista", title: "Lista fechada · " + name, body: `${l.in.length} confirmados${up.length ? `, ${up.length} ${up.length === 1 ? "subiu" : "subiram"} da espera` : ""}. A lista de espera continua aberta até a pelada.`, to: "all" });
      const uids = up.map((id) => byId(id)?.uid).filter(Boolean);
      if (uids.length) ev.push({ type: "lista", title: "Você está dentro!", body: "Subiu uma vaga para você na " + name + ".", to: uids });
      const fr = Math.max(0, free("linha")) + (c.golLim ? Math.max(0, free("gol")) : 0);
      if (fr > 0) ev.push({ type: "lista", title: "Ainda tem vaga na " + name, body: `Sobraram ${fr} ${fr === 1 ? "vaga" : "vagas"}. Entra na lista!`, to: "all" });
    }
  }
  // 3) lista fecha em 1 hora: avisa quem ainda não respondeu
  if (c.modo === "auto" && S.lst && S.lst.status === "aberta") {
    const closeTs = startTs(S.lst.date, P.time) - c.fechaH * 36e5, left = closeTs - now;
    if (left > 0 && left <= 36e5 && mk.almost !== S.lst.date) {
      const pend = (S.players || []).filter((p: any) => p.uid && !S.lst.in.includes(p.id) && !S.lst.esp.includes(p.id) && !S.lst.nao.includes(p.id)).map((p: any) => p.uid);
      mk.almost = S.lst.date; changed = true;
      if (pend.length) ev.push({ type: "lista", title: "A lista fecha em 1 hora · " + name, body: "Ainda não confirmou? Depois do fechamento, mensalista perde a prioridade.", to: pend });
    }
  }
  // 4) véspera da pelada, às 18h do dia anterior
  const game = nextGameDate(P, now);
  if (L.iso === addDays(game, -1) && L.min >= 18 * 60 && mk.vesp !== game) {
    mk.vesp = game; changed = true;
    ev.push({ type: "vespera", title: "Amanhã tem " + name, body: `Pelada às ${P.time}. Confirma com o Dono de Pelada se vai.`, to: "all" });
  }
  // 5) lembrete ao Dono de Pelada para abrir a lista (modo manual)
  if (c.modo === "manual" && c.lembra && !active() && L.wd === c.lembraWd && L.min >= hm(c.lembraH) && mk.lembra !== L.iso) {
    mk.lembra = L.iso; changed = true;
    ev.push({ type: "lista", title: "Hora de abrir a lista", body: "Abra a lista da " + name + " para a galera confirmar presença.", to: "admin" });
  }
  return { changed, events: ev };
}
