"use strict";
/* ЭАХС — «Алдаа мэдээлэх» хүлээн авагч (Vercel Node serverless function, хамаарал/build шаардахгүй).
 * POST /api/bug  (application/json, ≤400KB)  →  process.env.BUG_WEBHOOK_URL руу JSON-оор дамжуулна.
 * Орчны хувьсагч (Vercel → Project → Settings → Environment Variables):
 *   BUG_WEBHOOK_URL         — заавал. Хүлээн авах webhook-ийн URL
 *   BUG_WEBHOOK_KEY         — заавал. Нууц түлхүүр (хариуд хэзээ ч буцаахгүй, log-д бичихгүй)
 *   BUG_WEBHOOK_AUTH_STYLE  — "bearer" (анхдагч: Authorization: Bearer KEY) | "header" | "query"
 *   BUG_WEBHOOK_KEY_HEADER  — style=header үед толгойн нэр (жишээ: X-Webhook-Key)
 *   BUG_WEBHOOK_KEY_PARAM   — style=query үед параметрийн нэр (анхдагч: key)
 *   BUG_ALLOWED_ORIGINS     — (сонголттой) нэмэлт зөвшөөрөгдсөн origin-ууд, таслалаар
 * Хариу: {ok:true} | {ok:false, error:"<код>"}.  Тохиргоо дутуу → 503 {error:"not_configured"}.
 */
const MAX_BYTES = 400 * 1024;
const DESC_MAX = 2000;
const SHOT_MAX = 290 * 1024;          // ≈200KB JPEG → base64 (~273KB) + толгой
const UPSTREAM_TIMEOUT_MS = 10000;
const ROLES = ["worker", "supervisor", "hygiene", "none"];
const ORIGIN_RES = [
  /^https:\/\/eahs(-[a-z0-9-]+)?\.vercel\.app$/i,        // eahs.vercel.app, eahs-g5jf.vercel.app, preview: eahs-git-…, eahs-<hash>-…
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i,
];

function send(res, status, obj, extra) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (extra) for (const k of Object.keys(extra)) res.setHeader(k, extra[k]);
  res.end(JSON.stringify(obj));
}

function hdr(req, name) {
  const v = req.headers && req.headers[name];
  return Array.isArray(v) ? v[0] : (v == null ? "" : String(v));
}

function originOf(req) {
  const o = hdr(req, "origin");
  if (o && o !== "null") return o;
  const r = hdr(req, "referer");
  if (r) { try { return new URL(r).origin; } catch (_) { /* ignore */ } }
  return "";
}

function originAllowed(origin, req, env) {
  if (!origin) return false;
  if (ORIGIN_RES.some(re => re.test(origin))) return true;
  const extra = String(env.BUG_ALLOWED_ORIGINS || "").split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
  if (extra.includes(origin)) return true;
  // Ижил хост (custom домэйн дээр ажиллаж байвал): https://<host> === origin
  const host = hdr(req, "x-forwarded-host") || hdr(req, "host");
  return !!host && (origin === "https://" + host);
}

const str = (v, n) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, n);
const num = v => (typeof v === "number" && isFinite(v) ? v : null);
/* Нууц мэдээлэл алдааны текстээр алдагдахаас сэргийлнэ */
function scrub(s) {
  return String(s)
    .replace(/\b(pass(?:word)?|pwd|pin|token|secret|api[_-]?key|key|auth|sig|signature|code|access_token|id_token)=([^&\s"'<>]+)/gi, "$1=[redacted]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]")
    .replace(/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{4,}/g, "[jwt]")
    .replace(/Bearer\s+[\w.~+/=-]+/gi, "Bearer [redacted]")
    .replace(/data:[a-z]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]{16,}/gi, "data:…");
}

function clean(body) {
  const c = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : {};
  const sc = c.screen && typeof c.screen === "object" ? c.screen : {};
  const role = ROLES.includes(c.role) ? c.role : "none";
  const sap = typeof c.sap === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(c.sap) ? c.sap : null;
  const errors = (Array.isArray(c.errors) ? c.errors : []).slice(-10).filter(e => e && typeof e === "object").map(e => ({
    type: str(e.type, 20), message: scrub(str(e.message, 500)), source: scrub(str(e.source, 300)),
    line: num(e.line), col: num(e.col), stack: scrub(str(e.stack, 1500)), ts: str(e.ts, 40), view: str(e.view, 60),
  }));
  const out = {
    description: str(body.description, DESC_MAX).trim(),
    context: {
      view: str(c.view, 60), nav: str(c.nav, 40), modals: (Array.isArray(c.modals) ? c.modals : []).slice(0, 5).map(m => str(m, 40)),
      path: str(c.path, 200), role, sap, appVersion: str(c.appVersion, 40), userAgent: str(c.userAgent, 400),
      screen: { w: num(sc.w), h: num(sc.h), vw: num(sc.vw), vh: num(sc.vh), dpr: num(sc.dpr) },
      ts: str(c.ts, 40), localTime: str(c.localTime, 60), tzOffset: num(c.tzOffset), lang: str(c.lang, 20),
      online: typeof c.online === "boolean" ? c.online : null, cloud: typeof c.cloud === "boolean" ? c.cloud : null,
      errors,
    },
  };
  if (typeof body.screenshot === "string" && body.screenshot) out.screenshot = body.screenshot;
  return out;
}

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0, over = false; const chunks = [];
    req.on("data", ch => {
      if (over) return;                       // хэтэрсэн бол үлдсэнийг хаяна (хариуг шууд 413-аар өгнө)
      size += ch.length;
      if (size > limit) { over = true; chunks.length = 0; reject(Object.assign(new Error("too_large"), { code: 413 })); return; }
      chunks.push(ch);
    });
    req.on("end", () => { if (!over) resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}

async function readBody(req) {
  // Vercel-ийн helper req.body-г (JSON) аль хэдийн задалсан байж болно; эс бөгөөс stream-ээс уншина.
  let b;
  try { b = req.body; } catch (_) { throw Object.assign(new Error("bad_json"), { code: 400 }); }
  if (b !== undefined && b !== null && b !== "") {
    let text, obj;
    if (Buffer.isBuffer(b)) text = b.toString("utf8");
    else if (typeof b === "string") text = b;
    else obj = b;
    if (text != null) {
      if (Buffer.byteLength(text) > MAX_BYTES) throw Object.assign(new Error("too_large"), { code: 413 });
      try { obj = JSON.parse(text); } catch (_) { throw Object.assign(new Error("bad_json"), { code: 400 }); }
    } else if (Buffer.byteLength(JSON.stringify(obj)) > MAX_BYTES) throw Object.assign(new Error("too_large"), { code: 413 });
    return obj;
  }
  const raw = await readRaw(req, MAX_BYTES);
  try { return JSON.parse(raw); } catch (_) { throw Object.assign(new Error("bad_json"), { code: 400 }); }
}

/* Webhook-ийн хүсэлт бэлдэнэ (түлхүүрийг зөвхөн энд хэрэглэнэ) */
function buildUpstream(env) {
  const url = String(env.BUG_WEBHOOK_URL || "").trim(), key = String(env.BUG_WEBHOOK_KEY || "");
  if (!url || !key) return { error: "not_configured" };
  let u; try { u = new URL(url); } catch (_) { return { error: "misconfigured" }; }
  if (!/^https?:$/.test(u.protocol)) return { error: "misconfigured" };
  const style = String(env.BUG_WEBHOOK_AUTH_STYLE || "bearer").trim().toLowerCase();
  const headers = { "Content-Type": "application/json", "User-Agent": "eahs-bug-relay/1" };
  if (style === "bearer") headers.Authorization = "Bearer " + key;
  else if (style === "header") {
    const h = String(env.BUG_WEBHOOK_KEY_HEADER || "").trim();
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(h)) return { error: "misconfigured" };
    headers[h] = key;
  } else if (style === "query") {
    u.searchParams.set(String(env.BUG_WEBHOOK_KEY_PARAM || "").trim() || "key", key);
  } else return { error: "misconfigured" };
  return { url: u.toString(), headers };
}

async function handler(req, res, envIn) {
  const env = envIn || process.env;
  if (req.method === "OPTIONS") { res.statusCode = 204; res.setHeader("Allow", "POST, OPTIONS"); return res.end(); }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method_not_allowed" }, { Allow: "POST" });
  const origin = originOf(req);
  if (!originAllowed(origin, req, env)) return send(res, 403, { ok: false, error: "forbidden_origin" });
  if (!/^application\/json\b/i.test(hdr(req, "content-type"))) return send(res, 415, { ok: false, error: "json_required" });
  const len = parseInt(hdr(req, "content-length"), 10);
  if (len > MAX_BYTES) return send(res, 413, { ok: false, error: "too_large" });

  let body;
  try { body = await readBody(req); }
  catch (e) { return send(res, e.code === 413 ? 413 : 400, { ok: false, error: e.code === 413 ? "too_large" : "bad_json" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return send(res, 400, { ok: false, error: "bad_json" });
  if (typeof body.description !== "string" || !body.description.trim()) return send(res, 400, { ok: false, error: "description_required" });
  if (body.description.length > DESC_MAX) return send(res, 400, { ok: false, error: "description_too_long" });
  if (body.screenshot != null && body.screenshot !== "") {
    if (typeof body.screenshot !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.screenshot)) return send(res, 400, { ok: false, error: "bad_screenshot" });
    if (body.screenshot.length > SHOT_MAX) return send(res, 413, { ok: false, error: "screenshot_too_large" });
  }

  const up = buildUpstream(env);
  if (up.error) { console.error("bug relay:", up.error); return send(res, 503, { ok: false, error: up.error }); }

  const report = clean(body);
  const payload = {
    type: "eahs-bug-report", version: 1,
    receivedAt: new Date().toISOString(),
    site: { origin, host: hdr(req, "x-forwarded-host") || hdr(req, "host"),
      commit: String(env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 12) || null, env: env.VERCEL_ENV || null,
      deploymentUrl: env.VERCEL_URL || null, country: hdr(req, "x-vercel-ip-country") || null },
    ...report,
  };
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const r = await fetch(up.url, { method: "POST", headers: up.headers, body: JSON.stringify(payload), signal: ac.signal });
    if (!r.ok) { console.error("bug relay: upstream status", r.status); return send(res, 502, { ok: false, error: "upstream_" + r.status }); }
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error("bug relay: upstream", e && e.name === "AbortError" ? "timeout" : "unreachable");
    return send(res, 502, { ok: false, error: e && e.name === "AbortError" ? "upstream_timeout" : "upstream_unreachable" });
  } finally { clearTimeout(t); }
}

module.exports = (req, res) => handler(req, res);
module.exports.handler = handler;
module.exports._test = { buildUpstream, clean, scrub, originAllowed, MAX_BYTES };
