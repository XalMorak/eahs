// api/bug.js unit test: node tools/bug-api-test.js  (хамааралгүй; хуурамч webhook = node http сервер)
"use strict";
const http = require("http");
const path = require("path");
const bug = require(path.join(__dirname, "..", "api", "bug.js"));
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const KEY = "s3cr3t-KEY-zz9";
let received = [];   // хуурамч webhook-д ирсэн хүсэлтүүд
let hookStatus = 200, hookDelay = 0;

function listen(srv) { return new Promise(r => srv.listen(0, "127.0.0.1", () => r(srv.address().port))); }
(async () => {
  const hook = http.createServer((req, res) => {
    let b = ""; req.on("data", c => b += c); req.on("end", () => {
      received.push({ url: req.url, headers: req.headers, body: b });
      setTimeout(() => { res.statusCode = hookStatus; res.end("{}"); }, hookDelay);
    });
  });
  const hookPort = await listen(hook);
  const HOOK = `http://127.0.0.1:${hookPort}/hook`;
  let ENV = {};
  // mode "raw": req.body байхгүй (stream); mode "vercel": Vercel helper шиг req.body-г урьдчилан задална
  let mode = "raw";
  const api = http.createServer((req, res) => {
    if (mode === "vercel") {
      let b = ""; req.on("data", c => b += c); req.on("end", () => {
        Object.defineProperty(req, "body", { get() { if (!b) return undefined; return JSON.parse(b); } });
        bug.handler(req, res, ENV);
      });
    } else bug.handler(req, res, ENV);
  });
  const apiPort = await listen(api);
  const call = async (body, { origin = "https://eahs-g5jf.vercel.app", method = "POST", ct = "application/json", raw } = {}) => {
    const headers = { "Content-Type": ct }; if (origin) headers.Origin = origin;
    const r = await fetch(`http://127.0.0.1:${apiPort}/api/bug`, { method, headers, body: method === "POST" ? (raw != null ? raw : JSON.stringify(body)) : undefined });
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (_) {}
    return { status: r.status, j, text };
  };
  const good = () => ({
    description: "Хадгалах дарахад гацаад байна <img src=x onerror=alert(1)>",
    context: { view: "workerHome", role: "worker", sap: "w1", appVersion: "v13", userAgent: "UA", screen: { w: 390, h: 844, vw: 390, vh: 844, dpr: 2 },
      ts: new Date().toISOString(), password: "hunter2", pin: "1234", token: "tok",
      errors: [{ type: "error", message: "TypeError: x is undefined at https://x/?token=abcd1234&a=1", source: "app.js", line: 10, col: 2, stack: "at f (app.js:10:2) AIzaSyCj0zqo31QoCw2ggpOl2Aewu8u95azL6jQ" }] },
  });

  for (const m of ["raw", "vercel"]) {
    mode = m; console.log(`--- body mode: ${m}`);
    // 1) bearer (default)
    ENV = { BUG_WEBHOOK_URL: HOOK, BUG_WEBHOOK_KEY: KEY }; received = [];
    let r = await call(good());
    const h = received[0];
    ok("bearer default → 200 {ok:true}", r.status === 200 && r.j && r.j.ok === true && Object.keys(r.j).length === 1, r.text);
    ok("bearer: Authorization: Bearer KEY sent, URL unchanged", h && h.headers.authorization === "Bearer " + KEY && h.url === "/hook");
    const fwd = h && JSON.parse(h.body);
    ok("forwarded JSON: type, description, context (role/sap/view/screen), receivedAt", fwd && fwd.type === "eahs-bug-report" && fwd.description.startsWith("Хадгалах") && fwd.context.role === "worker" && fwd.context.sap === "w1" && fwd.context.view === "workerHome" && fwd.context.screen.w === 390 && !!fwd.receivedAt);
    ok("unknown context fields (password/pin/token) dropped", fwd && !("password" in fwd.context) && !("pin" in fwd.context) && !("token" in fwd.context) && !/hunter2/.test(h.body));
    ok("error text scrubbed (token=, Firebase API key)", fwd && /token=\[redacted\]/.test(fwd.context.errors[0].message) && !/abcd1234/.test(h.body) && !/AIza/.test(h.body));
    ok("key never echoed in response", !r.text.includes(KEY));
    // 2) header style
    ENV = { BUG_WEBHOOK_URL: HOOK, BUG_WEBHOOK_KEY: KEY, BUG_WEBHOOK_AUTH_STYLE: "header", BUG_WEBHOOK_KEY_HEADER: "X-Webhook-Key" }; received = [];
    r = await call(good());
    ok("header style → X-Webhook-Key: KEY, no Authorization", r.status === 200 && received[0].headers["x-webhook-key"] === KEY && !received[0].headers.authorization);
    ENV = { BUG_WEBHOOK_URL: HOOK, BUG_WEBHOOK_KEY: KEY, BUG_WEBHOOK_AUTH_STYLE: "header" }; received = [];
    r = await call(good());
    ok("header style without BUG_WEBHOOK_KEY_HEADER → 503 misconfigured, nothing sent", r.status === 503 && r.j.error === "misconfigured" && received.length === 0);
    // 3) query style
    ENV = { BUG_WEBHOOK_URL: HOOK + "?x=1", BUG_WEBHOOK_KEY: KEY, BUG_WEBHOOK_AUTH_STYLE: "query" }; received = [];
    r = await call(good());
    let q = new URL(received[0].url, "http://h").searchParams;
    ok("query style (default param 'key') keeps existing params", r.status === 200 && q.get("key") === KEY && q.get("x") === "1" && !received[0].headers.authorization);
    ENV = { BUG_WEBHOOK_URL: HOOK, BUG_WEBHOOK_KEY: KEY, BUG_WEBHOOK_AUTH_STYLE: "QUERY", BUG_WEBHOOK_KEY_PARAM: "token" }; received = [];
    r = await call(good());
    q = new URL(received[0].url, "http://h").searchParams;
    ok("query style with BUG_WEBHOOK_KEY_PARAM=token (case-insensitive style)", r.status === 200 && q.get("token") === KEY && !q.get("key"));
    ENV = { BUG_WEBHOOK_URL: HOOK, BUG_WEBHOOK_KEY: KEY, BUG_WEBHOOK_AUTH_STYLE: "basic" };
    r = await call(good());
    ok("unknown auth style → 503 misconfigured", r.status === 503 && r.j.error === "misconfigured");
    // 4) missing env
    for (const e of [{}, { BUG_WEBHOOK_URL: HOOK }, { BUG_WEBHOOK_KEY: KEY }]) {
      ENV = e; received = [];
      r = await call(good());
      ok(`missing env ${JSON.stringify(Object.keys(e))} → 503 not_configured`, r.status === 503 && r.j.ok === false && r.j.error === "not_configured" && received.length === 0);
    }
    ENV = { BUG_WEBHOOK_URL: "not a url", BUG_WEBHOOK_KEY: KEY };
    r = await call(good()); ok("invalid URL → 503 misconfigured", r.status === 503 && r.j.error === "misconfigured");
    // 5) validation
    ENV = { BUG_WEBHOOK_URL: HOOK, BUG_WEBHOOK_KEY: KEY }; received = [];
    r = await call({ ...good(), description: "" }); ok("empty description → 400 description_required", r.status === 400 && r.j.error === "description_required");
    r = await call({ ...good(), description: "   " }); ok("whitespace description → 400", r.status === 400 && r.j.error === "description_required");
    r = await call({ context: {} }); ok("missing description → 400", r.status === 400 && r.j.error === "description_required");
    r = await call({ ...good(), description: "a".repeat(2001) }); ok("description >2000 → 400", r.status === 400 && r.j.error === "description_too_long");
    r = await call(null, { raw: "{not json" }); ok("bad JSON → 400 bad_json", r.status === 400 && r.j.error === "bad_json");
    r = await call(null, { raw: "[1,2]" }); ok("array body → 400", r.status === 400);
    r = await call({ ...good(), screenshot: "data:text/html;base64,PHNjcmlwdD4=" }); ok("non-JPEG screenshot → 400 bad_screenshot", r.status === 400 && r.j.error === "bad_screenshot");
    r = await call({ ...good(), screenshot: "data:image/jpeg;base64," + "A".repeat(300 * 1024) }); ok("screenshot >~290KB → 413", r.status === 413);
    r = await call({ ...good(), context: { ...good().context, pad: "x".repeat(401 * 1024) } }); ok("body >400KB → 413 too_large", r.status === 413 && r.j.error === "too_large");
    ok("no upstream call for any rejected request", received.length === 0);
    const shot = "data:image/jpeg;base64," + Buffer.alloc(150 * 1024, 7).toString("base64");
    r = await call({ ...good(), screenshot: shot }); ok("≈150KB JPEG screenshot accepted + forwarded", r.status === 200 && JSON.parse(received[0].body).screenshot === shot);
    // 6) origin / method / content type
    received = [];
    r = await call(good(), { origin: "https://evil.example" }); ok("foreign origin → 403", r.status === 403 && r.j.error === "forbidden_origin");
    r = await call(good(), { origin: "" }); ok("no Origin/Referer → 403", r.status === 403);
    r = await call(good(), { origin: "https://eahsx.vercel.app.evil.com" }); ok("look-alike origin → 403", r.status === 403);
    ok("no upstream call for forbidden origins", received.length === 0);
    for (const o of ["https://eahs.vercel.app", "https://eahs-git-feature-bug-report-xalmorak.vercel.app", "http://localhost:3000", "http://127.0.0.1:8123"]) {
      r = await call(good(), { origin: o }); ok("allowed origin " + o, r.status === 200);
    }
    r = await call(good(), { origin: `http://127.0.0.1:${apiPort}` }); ok("same-host origin allowed", r.status === 200);
    ENV.BUG_ALLOWED_ORIGINS = "https://eahs.mn, https://www.eahs.mn/";
    r = await call(good(), { origin: "https://www.eahs.mn" }); ok("BUG_ALLOWED_ORIGINS extra origin allowed", r.status === 200);
    delete ENV.BUG_ALLOWED_ORIGINS;
    r = await call(good(), { method: "GET" }); ok("GET → 405", r.status === 405);
    r = await call(good(), { ct: "text/plain" }); ok("text/plain → 415", r.status === 415);
    // chunked body without Content-Length (stream limit)
    received = [];
    const chunked = big => new Promise(res => {
      const rq = http.request({ host: "127.0.0.1", port: apiPort, path: "/api/bug", method: "POST", headers: { "Content-Type": "application/json", Origin: "https://eahs.vercel.app", "Transfer-Encoding": "chunked" } }, rs => { let t = ""; rs.on("data", c => t += c); rs.on("end", () => res({ status: rs.statusCode, t })); });
      rq.on("error", () => res({ status: 0 }));
      const body = JSON.stringify({ ...good(), context: { pad: "y".repeat(big) } });
      for (let i = 0; i < body.length; i += 16384) rq.write(body.slice(i, i + 16384));
      rq.end();
    });
    let cr = await chunked(500 * 1024); ok("chunked body >400KB (no Content-Length) → 413, nothing forwarded", cr.status === 413 && received.length === 0, "status " + cr.status);
    cr = await chunked(1000); ok("chunked small body → 200", cr.status === 200);
    // 7) upstream failures
    hookStatus = 500; r = await call(good()); ok("upstream 500 → 502 upstream_500 (no key leak)", r.status === 502 && r.j.error === "upstream_500" && !r.text.includes(KEY)); hookStatus = 200;
    ENV = { BUG_WEBHOOK_URL: "http://127.0.0.1:1/x", BUG_WEBHOOK_KEY: KEY, BUG_WEBHOOK_AUTH_STYLE: "query" };
    r = await call(good()); ok("upstream unreachable → 502, key not echoed", r.status === 502 && r.j.error === "upstream_unreachable" && !r.text.includes(KEY));
  }
  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  hook.close(); api.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
