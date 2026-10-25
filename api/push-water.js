"use strict";
/* ЭАХС — «Усаа уугаарай» Web Push илгээгч (v22). Сайт хаалттай байсан ч утсан дээр мэдэгдэл очно.
 * POST|GET /api/push-water   толгой: X-Push-Secret: <PUSH_CRON_SECRET>   (GitHub Actions цагийн хуваарь дууддаг)
 *   ?dry=1          — илгээхгүй, хэнд очихыг л тоолно
 *   ?force=water    — цагийн хязгаар (07–22) үл харгалзана      ?force=weekly — 7 хоногийн тайланг одоо илгээнэ
 *   ?only=<sap>     — зөвхөн тухайн SAP руу (туршилт)
 * Логик (Улаанбаатарын цагаар):
 *   07:00–21:59 — өнөөдөр 10 аягад хүрээгүй, сүүлийн 50 минутад аяга нэмээгүй бүх захиалагч руу сануулга.
 *   Даваа 09:00-с хойш (7 хоногт 1 удаа) — эрүүл ахуйчид өмнөх 7 хоногийн усны тайлангийн хураангуй.
 *   404/410 буцаасан захиалгыг устгана.
 * Давхардал хамгаалалт (v24): GitHub Actions 10 минут тутам дууддаг. Усны сануулгын «тойрог» сүүлийн илгээлтээс
 *   ≥55 минут өнгөрсөн үед л илгээгдэнэ (push/_sent/water = ms тэмдэгт мөр). Илгээхээс ӨМНӨ ETag + if-match-аар
 *   слотоо «эзэлнэ» — зэрэг хоёр дуудлага ирвэл нэг нь л амжина (412 → skipped:'race'). 7 хоногийн тайлан ч мөн адил.
 * Орчны хувьсагч: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_CRON_SECRET, EAHS_DB_EMAIL, EAHS_DB_PASSWORD
 *   (EAHS_DB_* = эрүүл ахуйчийн эрхтэй Firebase Auth бүртгэл — RTDB-г REST-ээр уншина)
 */
const crypto = require("crypto");
const webpush = require("web-push");

const DB_URL = "https://borluulalt-f9d70-default-rtdb.asia-southeast1.firebasedatabase.app";
const ROOT = "eahs/v2";
const API_KEY = "AIzaSyCj0zqo31QoCw2ggpOl2Aewu8u95azL6jQ";   // Firebase вэб API түлхүүр (нийтэд ил, апп-д байгаа)
const TZ = "Asia/Ulaanbaatar";
const GOAL = 10, START = 7, END = 22, RECENT_MS = 50 * 60000, ROUND_MS = 55 * 60000;

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
const hdr = (req, n) => { const v = req.headers && req.headers[n]; return Array.isArray(v) ? v[0] : (v == null ? "" : String(v)); };
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const keyOf = s => String(s == null ? "" : s).trim().replace(/[.#$\[\]\/]/g, "_");

/* Улаанбаатарын огноо/цаг */
function ubNow(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour % 24, minute: +p.minute, wd: p.weekday };
}
function addDays(n, ymd) { const t = new Date(ymd + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function mondayOf(ymd) { const dow = new Date(ymd + "T00:00:00Z").getUTCDay(); return addDays(-((dow + 6) % 7), ymd); }

async function signIn(env) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.EAHS_DB_EMAIL, password: env.EAHS_DB_PASSWORD, returnSecureToken: true }) });
  if (!r.ok) throw Object.assign(new Error("auth_failed"), { status: r.status });
  return (await r.json()).idToken;
}
function dbFactory(token) {
  const u = (path, q) => `${DB_URL}/${ROOT}/${path}.json?auth=${encodeURIComponent(token)}${q ? "&" + q : ""}`;
  return {
    get: async (path, q) => { const r = await fetch(u(path, q)); if (!r.ok) throw Object.assign(new Error("db_read_" + path.split("/")[0]), { status: r.status }); return r.json(); },
    put: async (path, v) => { const r = await fetch(u(path), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); if (!r.ok) throw new Error("db_write_" + r.status); },
    del: async path => { const r = await fetch(u(path), { method: "DELETE" }); return r.ok; },
    /* ETag-тай уншилт ба нөхцөлт бичилт (RTDB REST): 412 → өөр дуудлага түрүүлж бичсэн */
    getE: async path => { const r = await fetch(u(path), { headers: { "X-Firebase-ETag": "true" } }); if (!r.ok) throw Object.assign(new Error("db_read_" + path.split("/")[0]), { status: r.status }); return { val: await r.json(), etag: r.headers.get("etag") }; },
    putIf: async (path, v, etag) => { const r = await fetch(u(path), { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag || "null_etag" }, body: JSON.stringify(v) }); if (r.status === 412) return false; if (!r.ok) throw new Error("db_write_" + r.status); return true; },
  };
}
const qDate = (a, b) => `orderBy=${encodeURIComponent('"date"')}&startAt=${encodeURIComponent(JSON.stringify(a))}&endAt=${encodeURIComponent(JSON.stringify(b))}`;

/* 7 хоногийн хураангуй (апп-ын waterWeek()-тэй ижил тооцоо) */
function weekSummary(recs, mon) {
  const sun = addDays(6, mon), per = {};
  Object.values(recs || {}).forEach(x => { if (x && x.date >= mon && x.date <= sun) { const k = keyOf(x.sap); per[k] = (per[k] || 0) + (+x.cups || 0); } });
  const avgs = Object.values(per).map(s => Math.round(s / 7 * 10) / 10);
  const act = avgs.length, avg = act ? Math.round(avgs.reduce((a, b) => a + b, 0) / act * 10) / 10 : 0;
  return { mon, sun, act, avg, met: avgs.filter(a => a >= GOAL).length };
}

async function handler(req, res, envIn) {
  const env = envIn || process.env;
  if (!env.PUSH_CRON_SECRET || !env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.EAHS_DB_EMAIL || !env.EAHS_DB_PASSWORD)
    return send(res, 503, { ok: false, error: "not_configured" });
  const given = hdr(req, "x-push-secret") || (hdr(req, "authorization").replace(/^Bearer\s+/i, ""));
  if (!given || !safeEq(given, env.PUSH_CRON_SECRET)) return send(res, 401, { ok: false, error: "unauthorized" });

  const q = new URL(req.url || "/", "http://x").searchParams;
  const dry = q.get("dry") === "1", force = q.get("force") || "", only = q.get("only") ? keyOf(q.get("only")) : "";
  const now = ubNow(), out = { ok: true, ub: `${now.date} ${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`, dry,
    water: { sent: 0, skippedDone: 0, skippedRecent: 0, skippedUnknown: 0, failed: 0, window: false }, weekly: { due: false, sent: 0 }, subs: 0, removed: 0 };

  webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:admin@eahs.vercel.app", env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  let db;
  try { db = dbFactory(await signIn(env)); } catch (e) { console.error("push: auth", e.status || e.message); return send(res, 502, { ok: false, error: "auth_failed" }); }

  let subsAll, users;
  try { [subsAll, users] = await Promise.all([db.get("push"), db.get("users")]); }
  catch (e) { console.error("push:", e.message, e.status); return send(res, 502, { ok: false, error: e.message }); }
  subsAll = subsAll || {}; users = users || {};
  const meta = subsAll._sent || {};
  const targets = [];   // {sap, hash, sub, role}
  for (const [sap, hs] of Object.entries(subsAll)) {
    if (sap.startsWith("_") || !hs || typeof hs !== "object") continue;
    if (only && sap !== only) continue;
    for (const [h, s] of Object.entries(hs)) if (s && typeof s.endpoint === "string" && s.keys && s.keys.p256dh && s.keys.auth) targets.push({ sap, hash: h, sub: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } } });
  }
  out.subs = targets.length;

  const dead = new Set();
  async function push(t, payload) {
    if (dry) return true;
    try {
      await webpush.sendNotification(t.sub, JSON.stringify(payload), { TTL: 3600, urgency: "normal", timeout: 10000 });
      return true;
    } catch (e) {
      const sc = e && e.statusCode;
      if (sc === 404 || sc === 410) dead.add(t.sap + "/" + t.hash);
      else console.warn("push: send", sc || (e && e.message));
      return false;
    }
  }

  /* 1) Ус уух сануулга */
  out.water.window = now.hour >= START && now.hour < END;
  let doWater = out.water.window || force === "water";
  if (!doWater) out.water.skipped = "outside-window";
  if (doWater) {
    /* Тойргийн слотыг эзлэх: сүүлийн илгээлтээс ≥55 мин, зэрэг дуудлагаас нэг нь л */
    try {
      const { val, etag } = await db.getE("push/_sent/water");
      const last = +val || 0, nowMs = Date.now();
      out.water.last = last || null;
      if (last && nowMs - last < ROUND_MS && force !== "water") { doWater = false; out.water.skipped = "too-soon"; out.water.nextInMin = Math.ceil((ROUND_MS - (nowMs - last)) / 60000); }
      else if (!dry && !(await db.putIf("push/_sent/water", String(nowMs), etag))) { doWater = false; out.water.skipped = "race"; }
    } catch (e) { console.error("push: claim", e.message); return send(res, 502, { ok: false, error: "claim_failed" }); }
  }
  if (doWater) {
    let recs = {};
    try { recs = await db.get("water", qDate(now.date, now.date)) || {}; } catch (e) { console.error("push: water", e.status); return send(res, 502, { ok: false, error: "db_read_water" }); }
    const today = {};
    Object.values(recs).forEach(x => { if (x && x.date === now.date) today[keyOf(x.sap)] = x; });
    const jobs = [];
    for (const t of targets) {
      if (!users[t.sap]) { out.water.skippedUnknown++; continue; }
      const r = today[t.sap], cups = r && typeof r.cups === "number" ? r.cups : 0;
      if (cups >= GOAL) { out.water.skippedDone++; continue; }
      if (r && typeof r.ts === "number" && Date.now() - r.ts < RECENT_MS && force !== "water") { out.water.skippedRecent++; continue; }
      jobs.push(push(t, { title: "Усаа уугаарай 💧", body: `Өнөөдөр ${cups}/${GOAL} аяга. Өдөрт дор хаяж ${GOAL} аяга ус ууна уу.`, tag: "eahs-water", url: "/?n=water" })
        .then(okk => okk ? out.water.sent++ : out.water.failed++));
    }
    await Promise.all(jobs);
  }

  /* 2) Даваа гарагийн 7 хоногийн тайлан — эрүүл ахуйчид */
  const mon = mondayOf(now.date);
  out.weekly.due = force === "weekly" || (now.wd === "Mon" && now.hour >= 9 && meta.weekly !== mon);
  if (out.weekly.due && force !== "weekly") {
    /* Илгээхээс өмнө 7 хоногийн слотыг эзэлнэ — 10 мин тутмын дуудлага давхар илгээхгүй */
    try {
      const { val, etag } = await db.getE("push/_sent/weekly");
      if (val === mon) { out.weekly.due = false; out.weekly.skipped = "already-sent"; }
      else if (!dry && !(await db.putIf("push/_sent/weekly", mon, etag))) { out.weekly.due = false; out.weekly.skipped = "race"; }
    } catch (e) { console.error("push: wclaim", e.message); out.weekly.due = false; out.weekly.skipped = "claim_failed"; }
  }
  if (out.weekly.due) {
    const last = addDays(-7, mon);
    let recs = {};
    try { recs = await db.get("water", qDate(last, addDays(6, last))) || {}; } catch (e) { console.error("push: week", e.status); }
    const w = weekSummary(recs, last);
    out.weekly.summary = w;
    const hyg = targets.filter(t => users[t.sap] && users[t.sap].role === "hygiene");
    await Promise.all(hyg.map(t => push(t, { title: "7 хоногийн усны тайлан", body: `${w.mon}–${w.sun}: ${w.act} хүн бүртгэсэн, дундаж ${w.avg} аяга/өдөр, ${w.met} хүн ${GOAL}+ аяга`, tag: "eahs-waterweek", url: "/?n=waterweek" })
      .then(okk => { if (okk) out.weekly.sent++; })));
  }

  /* 3) Хүчингүй болсон захиалгыг устгана */
  for (const p of dead) { if (await db.del("push/" + p)) out.removed++; }
  if (out.water.skipped && !out.weekly.due) out.skipped = out.water.skipped;
  console.log("push-water", JSON.stringify({ ub: out.ub, subs: out.subs, water: out.water, weekly: { due: out.weekly.due, sent: out.weekly.sent }, removed: out.removed }));
  return send(res, 200, out);
}

module.exports = (req, res) => handler(req, res);
module.exports.handler = handler;
module.exports._test = { ubNow, mondayOf, addDays, weekSummary, ROUND_MS };
