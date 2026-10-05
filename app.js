"use strict";
/* ЭАХС — Эрүүл ахуйн хяналтын систем
 * Өгөгдөл: Firebase RTDB "eahs/v2/<цуглуулга>/<id>" (бичлэг тус бүрээр update хийнэ),
 * офлайн үед localStorage дээр хадгалж, "pending" дараалалд үлдээгээд холбогдмогц илгээнэ.
 */
/* Алба: зөвхөн 2. Хуучин өгөгдлийг ХӨНДӨХГҮЙ — зөвхөн харуулах/харьцуулахдаа хөрвүүлнэ:
   «Оффис» агуулсан → «Оффис», бусад бүх нэр (Оюут баар, Манлай баар, Эрчим баар…) → «Бар», хоосон → "" */
const ALBA = ["Оффис", "Бар"];
const albaN = a => { const s = String(a==null?"":a).trim(); if(!s) return ""; return /оффис/i.test(s) ? "Оффис" : "Бар"; };
const U1 = [
  "Би хийх гэж буй ажлаа сайн мэднэ",
  "Надад энэ ажлыг хийх ур чадвар болон зөвшөөрөл бий",
  "Бүрэн бүтэн бөгөөд зориулалтын багаж надад бий",
  "Техник ажиллуулахын өмнөх үзлэгийг гүйцэтгэсэн",
  "Энэ ажилд зориулсан Стандарт Ажиллагааны Журам бий юу?",
  "Миний хийж буй ажил бусдад нөлөөлөх үү?"
];
const U2 = [
  "Би ажил хийх бүрэн чадвартай (сайн амарсан, согтууруулах ундаа, эм, мансууруулах бодисын нөлөөнд автаагүй)",
  "Хашлага, тэмдэглэгээг зөв байршуулж тавьсан",
  "Зам, шалны тавцан шаардлага хангахуйц байна",
  "Миний ажлын талбарт агааржуулалт хангалттай байна"
];
const U3 = [
  "Энергийн эх үүсвэрүүдийг салгаж",
  "1.5 мээс өндөрт ажиллах",
  "Өндөр химийн ажилд оролцох",
  "Хазгаарлагдмал орчинд нэвтрэх",
  "Өргөгдсөн ачааны доор болон тулгуур муутай талбарт ажиллах",
  "Хөдөлгөөнт техникийн дунд эсвэл ойролцоо ажиллах",
  "Биед эвгүй байрлалд эсвэл ихээр түлхэх, татах, өргөх",
  "Удаан хугацааны турш давтсан хөдөлгөөн хийх"
];
/* Ажилтны эрүүл мэнд, хувийн ариун цэврийн хяналт — үзүүлэлтүүд */
const HYG_TITLE = "Ажилтны эрүүл мэнд, хувийн ариун цэврийн хяналт";
const HYG_CRIT = [
  "ХӨ-ний шинж тэмдэг илрээгүй",
  "Гарт ил шархгүй",
  "Хумсаа авсан, будаггүй",
  "Гоёл чимэглэл зүүгээгүй",
  "Үсээ цэгцтэй зассан, боосон",
  "Ажлын хувцас өмссөн, цэвэр эсэх",
  "Амны хаалт зүүж, бээлий өмссөн"
];
const HYG_NOTES = [
  "Уртын ээлжийн эхний өдрөөс эхлэн 2 өдөрт 1 удаа бүртгэх",
  "Гарын ариун цэвэр сахих",
  "Шаардлага хангаагүй ажилтан ажиллахгүй.",
  "Шаардлага хангасан бол √, хангаагүй бол X тэмдэглэнэ."
];
const HYG_MIN_ROWS = 18;

const firebaseConfig = {
  apiKey:"AIzaSyCj0zqo31QoCw2ggpOl2Aewu8u95azL6jQ",
  authDomain:"borluulalt-f9d70.firebaseapp.com",
  databaseURL:"https://borluulalt-f9d70-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"borluulalt-f9d70"
};
/* Тест (Firebase emulator) — production-д window.EAHS_EMU байхгүй */
const EMU = (typeof window!=="undefined" && window.EAHS_EMU) || null;
const EMU_NO_SW = !!(typeof window!=="undefined" && window.EAHS_NO_SW);
const FB_CONFIG = EMU ? {...firebaseConfig, ...(EMU.config||{})} : firebaseConfig;
const ROOT = "eahs/v2";
const COLS = ["users","settings","uhaan","fatigue","hazards","infect","roster","hygcheck","notifs","svcheck"];
/* Нэвтрэлт: Firebase Auth (имэйл/нууц үг) — SAP → «<sap>@eahs.local» (нууц үг шинэчилбэл «<sap>+N@eahs.local») */
const AUTH_DOMAIN = "eahs.local";
const authSapOk = sap => /^[A-Za-z0-9_-]{2,40}$/.test(String(sap||""));
const authEmail = (sap, gen) => String(sap).toLowerCase() + (gen ? "+"+gen : "") + "@" + AUTH_DOMAIN;
const sapFromEmail = em => String(em||"").split("@")[0].split("+")[0];
/* Хуучин 4 оронтой PIN-г Firebase-ийн «≥6 тэмдэгт» шаардлагад нийцүүлэх (шинэ нууц үг ≥6 тул давхцахгүй) */
const fbPw = pw => String(pw).length>=6 ? String(pw) : "eahs#"+String(pw);
const LS = "eahs2_";

/* ---------- жижиг хэрэгслүүд ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
function esc(v){
  return String(v==null?"":v).replace(/[&<>"'`]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","`":"&#96;"}[c]));
}
function clone(v){ return v==null?v:JSON.parse(JSON.stringify(v)); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function keyOf(s){ return String(s==null?"":s).trim().replace(/[.#$\[\]\/]/g,"_"); }
function validKey(s){ return !!s && !/[.#$\[\]\/]/.test(s); }
const pad = n => String(n).padStart(2,"0");
function ymd(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function today(){ return ymd(new Date()); }            // орон нутгийн цаг (UTC биш)
function addDays(n, base){ const d = base? new Date(base+"T00:00:00") : new Date(); d.setDate(d.getDate()+n); return ymd(d); }
function daysBetween(a,b){ return Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000); }
function nowStr(){ return new Date().toLocaleString("mn-MN"); }
function arr(v){ return Array.isArray(v)? v.filter(x=>x!=null) : Object.values(v||{}); }
function lsGet(k,d){ try{ const v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch{ return d; } }
let _quotaWarned=false;
function lsSet(k,v){
  try{ localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch(e){
    console.warn("localStorage", k, e);
    if(!_quotaWarned){ _quotaWarned=true; toast("Төхөөрөмжийн санах ой дүүрсэн — үүлэнд холбогдсон байхад хадгална"); }
    return false;
  }
}
function toast(msg, html){
  let t=document.getElementById("toast");
  if(!t){ t=document.createElement("div"); t.id="toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  if(html) t.innerHTML = String(msg).replace(/^(<svg[\s\S]*?<\/svg>)?([\s\S]*)$/, (m,svg,txt)=>(svg||"")+esc(txt)); else t.textContent=msg;
  t.className="toast show";
  clearTimeout(window._tt); window._tt=setTimeout(()=>t.className="toast",2600);
}
/* ---------- Дүрс тэмдэг (inline SVG, 24×24 stroke) ---------- */
const ICONS = {
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 16 0v1"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v6M9 11h6"/>',
  battery:'<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2M6 11v2"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  virus:'<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  drop:'<path d="M12 2.7s6 6.3 6 11.3a6 6 0 0 1-12 0c0-5 6-11.3 6-11.3z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  printer:'<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  chev:'<path d="m9 18 6-6-6-6"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  grid:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  sheet:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  send:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  checks:'<path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>',
  map:'<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  chart:'<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/>',
  qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  filter:'<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  userCheck:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'
};
const ic = (n, cls="") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[n]||""}</svg>`;
const initials = name => String(name||"?").replace(/^[^\s.]+\.\s*/,"").trim().slice(0,1).toUpperCase() || "?";
/* Хоосон төлөв */
const emptyState = (title, sub="", icon="inbox") => `<div class="empty"><span class="eico">${ic(icon,"lg")}</span><b>${esc(title)}</b>${sub?`<span>${esc(sub)}</span>`:""}</div>`;
/* Апп-ын толгой: лого + гарчиг (+ буцах товч) */
const appbar = (title, sub="", back=false) => `<header class="fhead">${back?`<button class="hback" type="button" data-hback aria-label="Буцах">${ic("back")}</button>`:""}<img class="hlogo" src="/logo.png" alt="Ерөө говь ХХК"/><div class="ht"><h2>${title}</h2>${sub?`<span>${sub}</span>`:""}</div></header>`;
/* Самбарын хуудасны гарчиг */
const phead = (title, sub="", right="") => `<div class="phead"><div><h2 class="ptitle">${title}</h2>${sub?`<p class="muted">${sub}</p>`:""}</div>${right}</div>`;

async function hashPin(sap, pin){
  const data = new TextEncoder().encode("eahs|"+String(sap).trim()+"|"+String(pin).trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

/* ---------- өгөгдлийн сан (локал + үүл) ---------- */
const DB = {};
COLS.forEach(c=> DB[c] = lsGet(LS+c, {}) || {});
let PHOTOS = lsGet(LS+"photos", {}) || {};
let PENDING = lsGet(LS+"pending", []) || [];
let REJECTED = lsGet(LS+"rejected", []) || [];
let _fb = null, _auth = null, CLOUD_AUTH = false, _cloudState = "off", _flushing = false;
/* Одоо Firebase-д нэвтэрсэн хэрэглэгч (нэргүй бол sap=null) */
const AUTH = {uid:null, sap:null, role:null};

function setPath(obj, path, v){
  const ks = path.split("/"); let o = obj;
  for(let i=0;i<ks.length-1;i++){
    if(o[ks[i]]==null || typeof o[ks[i]]!=="object") o[ks[i]] = {};
    o = o[ks[i]];
  }
  const last = ks[ks.length-1];
  if(v==null) delete o[last]; else o[last] = clone(v);
}
function applyLocal(p, v){
  const [col, ...rest] = p.split("/");
  if(col==="photos"){
    if(rest.length) { if(v==null) delete PHOTOS[rest[0]]; else PHOTOS[rest[0]] = clone(v); }
    return;
  }
  if(!DB[col]) DB[col] = {};
  if(!rest.length) DB[col] = clone(v)||{};
  else setPath(DB[col], rest.join("/"), v);
}
function persist(cols){
  cols.forEach(c=>{ if(c==="photos") lsSet(LS+"photos", PHOTOS); else if(DB[c]) lsSet(LS+c, DB[c]); });
}
function persistPending(){
  if(!lsSet(LS+"pending", PENDING)){
    // зураггүйгээр ч гэсэн хадгалж үзнэ
    lsSet(LS+"pending", PENDING.filter(e=>!e.p.startsWith("photos/")));
  }
}
/* updates: { "users/123": {...}, "hygcheck/id/rows/r1": {...}, "roster/x": null } */
function write(updates){
  const touched = new Set();
  Object.entries(updates).forEach(([p,v])=>{
    v = v===undefined? null : v;
    applyLocal(p, v); touched.add(p.split("/")[0]);
    PENDING.push({p, v: clone(v), who: session ? session.sap : "anon"});
  });
  persist([...touched]);
  persistPending();
  flush();
  scheduleRender();
}
/* Firebase multi-path update нь эцэг/хүү зам зэрэг байхыг зөвшөөрдөггүй тул нэгтгэнэ */
function coalesce(batch){
  const upd = {};
  for(const {p, v} of batch){
    Object.keys(upd).forEach(k=>{ if(k.startsWith(p+"/")) delete upd[k]; });
    const anc = Object.keys(upd).find(k=>p.startsWith(k+"/"));
    if(anc){
      let base = upd[anc];
      base = (base==null || typeof base!=="object") ? {} : clone(base);
      setPath(base, p.slice(anc.length+1), v);
      upd[anc] = base;
    } else upd[p] = v==null? null : v;
  }
  return upd;
}
/* Бичлэг бүр хэн бичсэнийг (who) хадгална — тухайн хэрэглэгч нэвтэрсэн үед л илгээнэ.
   "anon" (нэвтрээгүй үеийн аюулын мэдээлэл) болон хуучин (who-гүй) бичлэгийг ямар ч эрхээр илгээж үзнэ. */
const flushable = e => !CLOUD_AUTH || !e.who || e.who==="anon" || (AUTH.sap && e.who===AUTH.sap);
const isDenied = e => /permission/i.test(String((e && (e.code||e.message))||""));
function dropEntries(done){ const d=new Set(done); PENDING = PENDING.filter(e=>!d.has(e)); persistPending(); }
async function flush(){
  if(!_fb || _flushing || !PENDING.length) return;
  if(!PENDING.some(flushable)) return;
  _flushing = true;
  try{
    if(CLOUD_AUTH && !_auth.currentUser){
      // нэвтрээгүй: зөвхөн нэргүй бичлэг (аюулын мэдээлэл + зураг + мэдэгдэл) илгээх эрхтэй
      try{ await _auth.signInAnonymously(); }catch(e){ console.warn("anon auth", e && e.code); setCloud("err"); return; }
    }
    const batch = PENDING.filter(flushable);
    if(!batch.length) return;
    setCloud("wait","Хадгалж байна…");
    try{
      await _fb.ref(ROOT).update(coalesce(batch));
      dropEntries(batch);
      setCloud("ok","Үүлэнд хадгаллаа");
    }catch(e){
      if(!isDenied(e)){ console.warn("fb update", e); setCloud("err","Үүлэнд хадгалж чадсангүй — энэ төхөөрөмжид үлдсэн"); return; }
      // Эрхгүй бичлэгийг ялгаж, бусдыг нь илгээнэ
      const done = []; let rej = 0;
      for(const en of batch){
        try{ await _fb.ref(ROOT).update(coalesce([en])); done.push(en); }
        catch(x){ if(isDenied(x)){ REJECTED.push({...en, at:Date.now()}); done.push(en); rej++; } else { console.warn("fb update", x); break; } }
      }
      dropEntries(done); lsSet(LS+"rejected", REJECTED.slice(-200));
      if(rej){ console.warn("rejected writes", rej); toast(rej+" өөрчлөлт эрхгүй тул үүлэнд хадгалагдсангүй"); }
      setCloud(PENDING.some(flushable)?"err":"ok");
    }
  } finally {
    _flushing = false;
    if(PENDING.some(flushable) && _cloudState!=="err") setTimeout(flush, 400);
  }
}
function overlayPending(col){
  PENDING.forEach(e=>{ if(e.p===col || e.p.startsWith(col+"/")) applyLocal(e.p, e.v); });
}
/* Хуучин (v1) бүтэц: eahs/<eahs_users|...> массив → v2 бичлэгүүд */
async function legacyToV2(old){
  const upd = {};
  for(const u of arr(old.eahs_users)){
    if(!u || !u.sap) continue;
    const k = keyOf(u.sap); const rec = {...u, sap:String(u.sap)};
    if(rec.pin!=null && rec.pin!==""){ rec.pinHash = await hashPin(rec.sap, rec.pin); }
    delete rec.pin;
    upd["users/"+k] = rec;
  }
  if(old.eahs_settings && typeof old.eahs_settings==="object") upd["settings/main"] = old.eahs_settings;
  ["uhaan","fatigue","infect"].forEach(c=>{
    arr(old["eahs_"+c]).forEach((x,i)=>{ if(!x) return; const id = keyOf(x.id || (c+"_"+i)); upd[c+"/"+id] = {...x, id}; });
  });
  arr(old.eahs_hazards).forEach((x,i)=>{
    if(!x) return; const id = keyOf(x.id || ("hz_"+i));
    const photos = arr(x.photos); const rec = {...x, id, photoCount: photos.length}; delete rec.photos;
    upd["hazards/"+id] = rec;
    if(photos.length) upd["photos/"+id] = photos;
  });
  arr(old.eahs_roster).forEach(x=>{
    if(!x || !x.sap) return; const id = keyOf(x.id || (x.sap+"_"+(x.arrive||"")));
    upd["roster/"+id] = {...x, id};
  });
  return upd;
}
function hasLegacyLocal(){ return localStorage.getItem("eahs_users")!=null; }
async function migrateLegacyLocal(){
  if(Object.keys(DB.users).length || !hasLegacyLocal()) return;
  const old = {};
  ["users","settings","uhaan","fatigue","hazards","infect","roster"].forEach(c=> old["eahs_"+c] = lsGet("eahs_"+c, null));
  const upd = await legacyToV2(old);
  Object.entries(upd).forEach(([p,v])=>applyLocal(p,v));   // зөвхөн локал (үүл ирэхэд үүл давамгайлна)
  persist([...COLS, "photos"]);
}
async function migrateLegacyCloud(){
  if(!_fb) return false;
  const meta = (await _fb.ref(ROOT+"/_meta").once("value")).val();
  if(meta && meta.migratedAt) return false;
  const old = {};
  for(const k of ["eahs_users","eahs_settings","eahs_uhaan","eahs_fatigue","eahs_hazards","eahs_infect","eahs_roster"]){
    old[k] = (await _fb.ref("eahs/"+k).once("value")).val();
  }
  const upd = await legacyToV2(old);
  upd["_meta"] = {migratedAt: Date.now(), from: "eahs/eahs_* (v1 массив, устгаагүй)"};
  await _fb.ref(ROOT).update(upd);
  return true;
}
async function seedIfEmpty(localOnly){
  if(Object.keys(DB.users).length) return;
  const admin = {sap:"admin", name:"Эрүүл ахуйч", role:"hygiene", alba:"Оффис", gender:"Эм", job:"Эрүүл ахуйч",
                 pinHash: await hashPin("admin","1234"), mustChange:true};
  const set = {fatigueDays:7, blockExpired:false};
  if(localOnly){ applyLocal("users/admin", admin); applyLocal("settings/main", set); persist(["users","settings"]); }
  else write({"users/admin": admin, "settings/main": set});
}
async function migratePins(){
  if(CLOUD_AUTH && AUTH.role!=="hygiene") return;
  const upd = {};
  for(const [k,u] of Object.entries(DB.users)){
    if(u && u.pin!=null){ upd["users/"+k+"/pinHash"] = await hashPin(u.sap||k, u.pin); upd["users/"+k+"/pin"] = null; }
  }
  if(Object.keys(upd).length) write(upd);
}

function setCloud(state, msg){
  _cloudState = state;
  let el = document.getElementById("cloudbar");
  if(!el){ el=document.createElement("div"); el.id="cloudbar"; el.setAttribute("role","status"); document.body.appendChild(el); }
  el.className = "cloudbar "+state;
  el.title = msg || "";
  el.textContent = msg || ({ok:"Үүлэнд холбогдсон", wait:"Холбож байна…", err:"Зөвхөн энэ төхөөрөмжид", off:"Холбогдоогүй"}[state]||"");
  clearTimeout(window._cbT);
  if(state!=="wait") window._cbT = setTimeout(()=>el.classList.add("mini"), state==="ok"?2500:6000);
}

/* ---------- Үүлний синк (үүрэг тус бүрийн уншиж болох замуудаар) ---------- */
let SUBS = [];
function stopSync(){ SUBS.forEach(f=>{ try{ f(); }catch(e){} }); SUBS = []; }
const OWN_COLS = ["uhaan","fatigue","infect"];
function syncPlan(role){
  if(role==="hygiene") return COLS;
  if(role==="supervisor") return ["users","settings","uhaan","hazards","roster","hygcheck","notifs","svcheck"];
  return ["users","settings","roster","hygcheck",...OWN_COLS];
}
function startSync(role, sap){
  stopSync();
  if(!_fb) return Promise.resolve();
  const k = keyOf(sap);
  let ready; const usersReady = new Promise(r=>ready=r);
  syncPlan(role).forEach(c=>{
    let q = _fb.ref(ROOT+"/"+c), map = v=>v||{};
    if(role==="worker" && c==="users"){ q = _fb.ref(ROOT+"/users/"+k); map = v=> v? {[k]:v} : {}; }
    else if(role==="worker" && OWN_COLS.includes(c)) q = q.orderByChild("sap").equalTo(k);
    const cb = snap=>{ DB[c] = map(snap.val()); overlayPending(c); persist([c]); if(c==="notifs") onNotifs(); if(c==="users") ready(); scheduleRender(); };
    q.on("value", cb, e=>{ console.warn("sync "+c, e && (e.code||e.message)); if(c==="users") ready(); });
    SUBS.push(()=>q.off("value", cb));
  });
  return usersReady;
}
/* Өөр хэрэглэгч нэвтэрвэл өмнөх хэрэглэгчийн кэшийг цэвэрлэнэ (хүлээгдэж буй бичлэг үлдэнэ) */
function claimCache(sap){
  const owner = lsGet(LS+"owner", null);
  if(owner && owner!==sap){ COLS.forEach(c=>{ DB[c] = {}; }); PHOTOS = {}; persist([...COLS, "photos"]); }
  lsSet(LS+"owner", sap);
}
let _loggingIn = false;
async function afterLogin(sap, role, uid){
  AUTH.uid = uid; AUTH.sap = sap; AUTH.role = role;
  claimCache(sap);
  setSession({sap, role});
  const ready = startSync(role, sap);
  flush();
  await Promise.race([ready, new Promise(r=>setTimeout(r, 5000))]);
  if(role==="hygiene") migratePins().catch(e=>console.warn("pins", e && e.code));
}
async function onAuth(user){
  if(_loggingIn) return;
  if(user && !user.isAnonymous){
    if(AUTH.uid===user.uid) return;
    const em = sapFromEmail(user.email);              // email нь жижиг үсэгтэй
    const sap = session ? keyOf(session.sap) : "";
    if(session && sap.toLowerCase()===em){
      await afterLogin(sap, session.role, user.uid);   // офлайнд ч ажиллана (кэшилсэн үүрэг)
      try{
        const r = (await _fb.ref(ROOT+"/roles/"+user.uid).once("value")).val();
        if(!r || r.sap!==sap){ toast("Эрх олдсонгүй — дахин нэвтэрнэ үү"); landing(); return; }
        if(r.role!==session.role){ await afterLogin(sap, r.role, user.uid); homeFor(me()); }
      }catch(e){ console.warn("roles", e && e.code); }
    } else { await _auth.signOut(); }
  } else {
    if(AUTH.uid) stopSync();
    AUTH.uid = AUTH.sap = AUTH.role = null;
    if(session && CLOUD_AUTH && !session.local){ setSession(null); landing(); }
  }
}
async function initCloud(){
  await migrateLegacyLocal();
  setCloud("wait","Холбож байна…");
  if(typeof firebase==="undefined"){ await seedIfEmpty(true); await migratePins(); setCloud("err"); return; }
  try{
    if(!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    _fb = firebase.database();
    if(EMU) _fb.useEmulator(EMU.dbHost, EMU.dbPort);
    if(firebase.auth){
      _auth = firebase.auth(); CLOUD_AUTH = true;
      if(EMU) _auth.useEmulator(EMU.authUrl);
      await new Promise(res=>{ const off = _auth.onAuthStateChanged(()=>{ off(); res(); }); });
      if(!_auth.currentUser){ try{ await _auth.signInAnonymously(); }catch(e){ console.warn("anon auth", e && e.code); } }
    }
    // v1 → v2 (хуучин өгөгдөл) — шинэ дүрэмд уншиж чадахгүй бол алгасна
    try{ await migrateLegacyCloud(); }catch(e){ if(!isDenied(e)) console.warn("legacy migration skipped", e && (e.code||e.message)); }  // хатуу дүрэмд нэргүй уншиж чадахгүй — хэвийн
    ["users","settings","uhaan","fatigue","hazards","infect","roster"].forEach(c=>localStorage.removeItem("eahs_"+c));
    if(_auth){ await new Promise(res=>{ let first=true; _auth.onAuthStateChanged(async u=>{ try{ await onAuth(u); }catch(e){ console.warn("auth state", e); } if(first){ first=false; res(); } }); }); }
    else { COLS.forEach(c=>{ _fb.ref(ROOT+"/"+c).on("value", sn=>{ DB[c]=sn.val()||{}; overlayPending(c); persist([c]); scheduleRender(); }); }); }
    _fb.ref(".info/connected").on("value", sn=>{
      if(sn.val()===true){ setCloud("ok"); flush(); }
      else if(_cloudState==="ok") setCloud("wait","Холболт тасарсан — дахин холбогдож байна…");
    });
    setCloud("ok");
    flush();
    setInterval(()=>{ if(PENDING.length) flush(); }, 30000);
  }catch(e){
    console.warn("cloud", e);
    await seedIfEmpty(true); await migratePins();
    setCloud("err");
  }
}

/* ---------- Нэвтрэх (үүл) ---------- */
const BAD_LOGIN = "SAP эсвэл нууц үг буруу байна";
const isNetErr = e => /network|unavailable|offline/i.test(String(e && (e.code||e.message)));
async function readOrNull(path){ try{ return {ok:true, v:(await _fb.ref(path).once("value")).val()}; }catch(e){ return {ok:false, v:null}; } }
async function rememberOffline(sap, role, pw){
  const lv = lsGet(LS+"lv", {}) || {}; lv[sap] = {role, h: await hashPin("lv:"+sap, pw)}; lsSet(LS+"lv", lv);
}
async function cloudLogin(role, sapIn, pw){
  const k = keyOf(sapIn);
  if(!authSapOk(k)) return {err:"Энэ SAP-аар нэвтрэх боломжгүй (зөвхөн латин үсэг, тоо). Эрүүл ахуйчид хандана уу"};
  _loggingIn = true;
  try{
    const gen = (await readOrNull(ROOT+"/authgen/"+k)).v;
    const email = authEmail(k, gen);
    let migrated = false;
    try{ await _auth.signInWithEmailAndPassword(email, fbPw(pw)); }
    catch(e){
      if(isNetErr(e)) throw e;
      if(e.code==="auth/too-many-requests") return {err:"Олон удаа буруу оролдлоо. Түр хүлээгээд дахин оролдоно уу"};
      if(e.code==="auth/operation-not-allowed") return {err:"Firebase-д Email/Password нэвтрэлт идэвхжээгүй байна"};
      const m = await migrateAccount(role, k, String(sapIn).trim(), pw, email);
      if(m.err) return m;
      migrated = true;
    }
    const uid = _auth.currentUser.uid;
    const r = (await readOrNull(ROOT+"/roles/"+uid)).v;
    if(!r || r.sap!==k){ await _auth.signOut(); return {err:"Эрх олдсонгүй — эрүүл ахуйчид хандана уу"}; }
    if(r.role!==role){ await _auth.signOut(); return {err:`Энэ SAP «${roleName(r.role)}» эрхтэй. Тухайн цэсээр нэвтэрнэ үү`}; }
    await rememberOffline(k, r.role, pw);
    await afterLogin(k, r.role, uid);
    return {sap:k, role:r.role, migrated};
  } finally { _loggingIn = false; }
}
/* Хуучин (PIN-ийн hash-тай) хэрэглэгчийг анх нэвтрэхэд нь Firebase Auth руу шилжүүлнэ.
   Дүрэм: roles/{uid}.proof === users/{sap}/pinHash байж л үүрэг авна (PIN мэдэхгүй бол болохгүй). */
async function migrateAccount(role, k, sapRaw, pw, email){
  let cred;
  try{ cred = await _auth.createUserWithEmailAndPassword(email, fbPw(pw)); }
  catch(e){
    if(e.code==="auth/email-already-in-use") return {err:BAD_LOGIN};
    if(e.code==="auth/operation-not-allowed") return {err:"Firebase-д Email/Password нэвтрэлт идэвхжээгүй байна"};
    throw e;
  }
  try{
    const proof = await hashPin(sapRaw, pw);
    const u = await readOrNull(ROOT+"/users/"+k);       // шилжилтийн дүрэмд уншиж болно → урьдчилж шалгана
    if(u.ok && (!u.v || u.v.pinHash!==proof || u.v.role!==role)) throw new Error("bad pin");
    await _fb.ref(ROOT).update({["roles/"+cred.user.uid]: {sap:k, role, proof, at:Date.now()}});
    await _fb.ref(ROOT).update({["users/"+k+"/uid"]: cred.user.uid, ["users/"+k+"/pinHash"]: null, ...(String(pw).length<6?{["users/"+k+"/mustChange"]: true}:{})});
    return {};
  }catch(e){
    try{ await cred.user.delete(); }catch(x){ console.warn("cleanup", x && x.code); }
    return {err:BAD_LOGIN};
  }
}
/* Эрүүл ахуйч шинэ хэрэглэгчийн Auth бүртгэл үүсгэнэ — 2 дахь Firebase app ашиглана (өөрөө нэвтэрсэн хэвээр) */
async function createAuthAccount(k, pw){
  let app2 = firebase.apps.find(a=>a.name==="eahs-admin");
  if(!app2){ app2 = firebase.initializeApp(FB_CONFIG, "eahs-admin"); if(EMU) app2.auth().useEmulator(EMU.authUrl); }
  const a2 = app2.auth();
  try{ await a2.setPersistence(firebase.auth.Auth.Persistence.NONE); }catch(e){}
  let gen = (await readOrNull(ROOT+"/authgen/"+k)).v || null;
  for(let i=0;i<6;i++){
    try{
      const c = await a2.createUserWithEmailAndPassword(authEmail(k, gen), pw);
      const uid = c.user.uid; await a2.signOut();
      return {uid, gen};
    }catch(e){
      if(e.code!=="auth/email-already-in-use") throw e;
      gen = String((+gen||0)+1);           // хуучин бүртгэл байгаа (нууц үг шинэчлэх) → дараагийн хувилбар
    }
  }
  throw new Error("Auth бүртгэл үүсгэж чадсангүй");
}
async function getPhotos(id){
  if(PHOTOS[id]) return arr(PHOTOS[id]);
  if(!_fb) return [];
  try{
    const v = (await _fb.ref(ROOT+"/photos/"+id).once("value")).val();
    if(v){ PHOTOS[id] = arr(v); lsSet(LS+"photos", PHOTOS); }
    return arr(v);
  }catch(e){ console.warn(e); return []; }
}

/* ---------- харагдац / дахин зурах ---------- */
let VIEW = {fn:null, live:false};
function view(fn, live){ VIEW = {fn, live:!!live}; }
let _rt=null;
function scheduleRender(){
  clearTimeout(_rt);
  _rt = setTimeout(()=>{
    if(!VIEW.live || !VIEW.fn) return;
    const a = document.activeElement;
    if(a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;   // бичиж байхад бүү дахин зур
    const y = window.scrollY; VIEW.fn(); window.scrollTo(0,y);
  }, 120);
}
function mount(html){
  const app = $("#app"); window.onresize = null;
  app.onclick = null; app.onchange = null; app.onsubmit = null; app.oninput = null;
  app.innerHTML = html;
  return app;
}

/* ---------- жагсаалт туслахууд ---------- */
const list = col => Object.values(DB[col]||{}).filter(Boolean);
const byNew = (a,b)=> String(b.date||"").localeCompare(String(a.date||"")) || String(b.id||"").localeCompare(String(a.id||""));
const users = ()=> list("users");
const workers = ()=> users().filter(u=>u.role==="worker");
const settings = ()=> ({fatigueDays:7, blockExpired:false, ...(DB.settings.main||{})});
function roleName(r){ return {worker:"Ажилтан", supervisor:"Ахлах", hygiene:"Эрүүл ахуйч"}[r]||""; }

/* Сесс: зөвхөн SAP + үүрэг (нууц үг хадгалахгүй) */
let session = null;
(function loadSession(){
  const s = lsGet("eahs_session", null);
  if(s && s.sap && s.role) session = {sap:String(s.sap), role:s.role, ...(s.local?{local:true}:{})};
  lsSet("eahs_session", session);   // хуучин (pin агуулсан) сессийг цэвэрлэнэ
})();
function me(){ return session ? DB.users[keyOf(session.sap)] || null : null; }
function setSession(u){ session = u? {sap:u.sap, role:u.role, ...(u.local?{local:true}:{})} : null; lsSet("eahs_session", session); }

/* ======================= НҮҮР / НЭВТРЭХ ======================= */
function signOutCloud(){
  if(CLOUD_AUTH && _auth && _auth.currentUser && !_auth.currentUser.isAnonymous){
    stopSync(); AUTH.uid = AUTH.sap = AUTH.role = null;
    _auth.signOut().catch(e=>console.warn("signout", e && e.code));
  }
}
function landing(){
  setSession(null); signOutCloud(); view(landing, false);
  const app = mount(`
    <div class="land">
      <div>
        <div class="land-in">
          <div class="brand">
            <img class="logo" src="/logo.png" alt="Ерөө говь ХХК" width="148" height="117"/>
            <span class="kicker">${ic("shield","sm")} Ерөө говь ХХК</span>
            <h1>ЭАХС<br><span>Эрүүл ахуйн хяналт</span></h1>
            <p>Ажилтны эрүүл мэнд, ариун цэвэр, ядаргаа, аюулын мэдээллийг нэг дор — утас, компьютер дээр.</p>
            <div class="sites" aria-label="Талбарууд">${ALBA.map(a=>`<span>${esc(a)}</span>`).join("")}</div>
          </div>
          <nav class="menu" aria-label="Нэвтрэх сонголт">
            <div class="menu-h">Нэвтрэх</div>
            <button class="menu-btn" data-g="worker"><span class="mi">${ic("user")}</span><span><b>Ажилтан</b><small>УХААН, ядаргаа, халдварын асуумж</small></span>${ic("chev","chev")}</button>
            <button class="menu-btn" data-g="supervisor"><span class="mi">${ic("clipboard")}</span><span><b>Ахлах</b><small>УХААН батлах, ариун цэврийн хяналт</small></span>${ic("chev","chev")}</button>
            <button class="menu-btn" data-g="hygiene"><span class="mi">${ic("shield")}</span><span><b>Эрүүл ахуйч</b><small>Хяналтын самбар, тайлан, Excel</small></span>${ic("chev","chev")}</button>
            <hr/>
            <button class="menu-btn alt" data-g="hazard"><span class="mi">${ic("alert")}</span><span><b>Аюулыг мэдээлэх</b><small>Нэвтрэхгүйгээр шууд илгээнэ</small></span>${ic("chev","chev")}</button>
          </nav>
        </div>
        <div class="foot-sites">© Ерөө говь ХХК · Эрүүл ахуйн хяналтын систем</div>
      </div>
    </div>`);
  app.onclick = e=>{
    const g = e.target.closest("[data-g]")?.dataset.g;
    if(g==="hazard") hazardForm();
    else if(g) loginForm(g);
  };
}
function homeFor(u){
  if(!u) return landing();
  if(u.role==="worker") workerHome();
  else if(u.role==="supervisor") supervisorHome();
  else hygieneHome();
}
function loginForm(role){
  view(()=>loginForm(role), false);
  const app = mount(`
    ${appbar("ЭАХС", esc(roleName(role))+" нэвтрэх", true)}
    <div class="loginbox">
      <form class="card" id="lf" autocomplete="on">
        <div class="lhead"><span class="mi">${ic(role==="worker"?"user":role==="supervisor"?"clipboard":"shield","lg")}</span><div><h3>${esc(roleName(role))} нэвтрэх</h3><p>SAP дугаар болон нууц үгээ оруулна уу</p></div></div>
        <label class="f" for="sap">SAP / нэвтрэх нэр</label><input id="sap" name="username" autocomplete="username" required/>
        <label class="f" for="pin">Нууц үг</label><input id="pin" name="password" type="password" autocomplete="current-password" required/>
        <div id="lerr" class="errtxt" role="alert"></div>
        <button class="btn" type="submit">${ic("key")} Нэвтрэх</button>
        <div class="gap"></div>
        <button class="btn ghost" type="button" id="back">Буцах</button>
      </form>
    </div>`);
  $("#sap").focus();
  $("#back").onclick = landing;
  $("[data-hback]").onclick = landing;
  app.onsubmit = async e=>{
    e.preventDefault();
    const sap = $("#sap").value.trim(), pin = $("#pin").value.trim();
    const btn = $("#lf button[type=submit]"); const err = m=>{ $("#lerr").textContent = m; };
    if(!sap || !pin) return err("SAP болон нууц үгээ оруулна уу");
    if(CLOUD_AUTH){
      btn.disabled = true; err("");
      try{
        const r = await cloudLogin(role, sap, pin);
        if(r.err) return err(r.err);
        const u = me();
        if(r.migrated) toast("Таны бүртгэл шинэ нэвтрэлт рүү шилжлээ");
        if(u && u.mustChange) setTimeout(()=>toast(u.role==="worker"?"Нүүр хуудаснаас «Нууц үг солих» дарж солино уу (дор хаяж 6)":"Нууц үгээ Тохиргоо хэсэгт сольно уу (дор хаяж 6 тэмдэгт)"), r.migrated?2700:0);
        return homeFor(u || {role:r.role});
      }catch(ex){
        if(!isNetErr(ex)){ console.warn("login", ex); return err("Нэвтрэхэд алдаа гарлаа ("+(ex.code||"алдаа")+")"); }
        // интернэтгүй: энэ төхөөрөмж дээр өмнө нэвтэрч байсан бол офлайнаар
        const lv = (lsGet(LS+"lv", {})||{})[keyOf(sap)];
        if(lv && lv.role===role && lv.h===await hashPin("lv:"+keyOf(sap), pin)){ setSession({sap:keyOf(sap), role, local:true}); toast("Офлайн горим — холбогдмогц дахин нэвтэрнэ үү"); return homeFor(me()||{role}); }
        return err("Интернэт холболтгүй байна. Энэ төхөөрөмж дээр өмнө нэвтэрч байгаагүй тул офлайнаар нэвтрэх боломжгүй");
      } finally { const b=$("#lf button[type=submit]"); if(b) b.disabled=false; }
    }
    // Firebase ачаалагдаагүй (бүрэн офлайн) — локал горим
    const u = DB.users[keyOf(sap)];
    let ok = false;
    if(u && u.role===role){
      if(u.pinHash) ok = (await hashPin(u.sap, pin)) === u.pinHash;
      else if(u.pin!=null) ok = String(u.pin)===pin;   // хуучин бичлэг (migratePins хөрвүүлнэ)
    }
    if(!ok){
      const lv = (lsGet(LS+"lv", {})||{})[keyOf(sap)];
      if(lv && lv.role===role && u && lv.h===await hashPin("lv:"+keyOf(sap), pin)){ setSession({sap:u.sap, role, local:true}); return homeFor(u); }
      return err(BAD_LOGIN);
    }
    if(u.pin!=null) write({["users/"+keyOf(u.sap)+"/pinHash"]: await hashPin(u.sap,pin), ["users/"+keyOf(u.sap)+"/pin"]: null});
    setSession(u);
    if(u.mustChange) toast("Анхны нууц үгээ Тохиргоо хэсэгт сольно уу");
    homeFor(u);
  };
}

/* ======================= АЖИЛТАН ======================= */
function expBadge(d){
  if(!d) return "";
  const left = daysBetween(today(), d);
  if(left<0) return `<span class="badge b-bad">Дууссан</span>`;
  if(left<=30) return `<span class="badge b-wait">Сарын дотор</span>`;
  return `<span class="badge b-ok">Хүчинтэй</span>`;
}
function workerHome(){
  const u = me(); if(!u) return landing();
  view(workerHome, true);
  const set = settings();
  const uhaan = list("uhaan").filter(x=>x.sap===u.sap && x.date===today());
  const lastF = list("fatigue").filter(x=>x.sap===u.sap).sort(byNew)[0];
  const needF = !lastF || daysBetween(lastF.date, today()) >= (set.fatigueDays||7);
  const roster = list("roster").find(x=>x.sap===u.sap && x.arrive===today());
  const infect = list("infect").find(x=>x.sap===u.sap && x.date===today());
  let infTxt = "Өнөөдөр хуваарь байхгүй";
  if(roster && !infect) infTxt = "Өнөөдөр талбарт ирэх хуваарьтай — бөглөнө";
  if(infect && (!infect.verdict || infect.verdict==="huleegdej")) infTxt = "Бөглөсөн · эрүүл ахуйч шийдээгүй";
  if(infect && infect.verdict==="orjbolno") infTxt = "Шийдвэр: орж болно";
  if(infect && infect.verdict==="ersdel") infTxt = "Шийдвэр: ажилд оруулахгүй";
  // Ариун цэврийн хяналт — өнөөдрийн хуудсанд байгаа эсэх
  const hs = list("hygcheck").filter(h=>h.date===today()).map(h=>({h, rk:Object.keys(h.rows||{}).find(k=>h.rows[k]?.sap===u.sap)})).find(x=>x.rk);
  let hygHtml = "";
  if(hs){
    const r = hs.h.rows[hs.rk]; const st = rowStatus(r);
    hygHtml = `<div class="card"><div class="ctitle">${ic("drop")}<h3>Ариун цэврийн хяналт</h3><span class="muted">${esc(hs.h.date)}</span></div>
      <p>${st==="fail"?'<span class="badge b-bad">Шаардлага хангаагүй — ажиллахгүй</span>':st==="ok"?'<span class="badge b-ok">Шаардлага хангасан</span>':'<span class="badge b-wait">Бүрэн шалгаагүй</span>'}</p>
      <div class="critmini">${HYG_CRIT.map((c,i)=>`<span class="${cellVal(r,i)==="no"?"bad":cellVal(r,i)==="ok"?"good":""}">${cellSym(cellVal(r,i))||"·"} ${esc(c)}</span>`).join("")}</div>
      ${r.sign?`<p class="muted">Танилцсан: ${esc(r.signAt||"")}</p>`:`<button class="btn" id="hsign" data-id="${esc(hs.h.id)}" data-rk="${esc(hs.rk)}">Танилцсан (гарын үсэг)</button>`}
    </div>`;
  }
  const infTodo = roster && !infect;
  const task = (id, icon, title, sub, state, stTxt) => `<button class="home-btn ${state}" id="${id}"><span class="mi">${ic(icon)}</span><span><b>${title}</b><span class="muted">${esc(sub)}</span></span><span class="st">${stTxt}</span></button>`;
  const app = mount(`
    ${appbar("ЭАХС · Ажилтан", esc(albaN(u.alba)))}
    <main class="page">
    <div class="card row-between"><div class="hello"><span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span><div><b>${esc(u.name)}</b><div class="muted">SAP ${esc(u.sap)} · ${esc(albaN(u.alba))}</div></div></div>
      <button class="btn ghost sm" id="out">${ic("logout","sm")} Гарах</button></div>
    <div class="sec-t">Өнөөдрийн ажил · ${today()}</div>
    <div class="tasks">
    ${task("uhaan","checks","УХААН", uhaan.length?"Өнөөдөр бөглөсөн":"Өнөөдөр бөглөөгүй — ажил эхлэхийн өмнө", uhaan.length?"done":"todo", uhaan.length?"Бөглөсөн":"Бөглөх")}
    ${task("fat","battery","Ядаргаа", needF?"Бөглөх хугацаа болсон":"Дараагийн бөглөлт хүлээгдэж байна", needF?"todo":"done", needF?"Бөглөх":"Хийгдсэн")}
    ${task("inf","virus","Халдварын асуумж", infTxt, infTodo?"todo":infect?"done":"idle", infTodo?"Бөглөх":infect?"Илгээсэн":"Шаардлагагүй")}
    </div>
    ${hygHtml}
    <div class="card"><div class="ctitle">${ic("file")}<h3>Миний баримт</h3></div>
      <div class="docs">
        <div class="doc"><span>Цагаан дэвтэр</span><b>${esc(u.bookExp||"—")}</b>${expBadge(u.bookExp)}</div>
        <div class="doc"><span>Жилийн шинжилгээ</span><b>${esc(u.exam||"—")}</b>${expBadge(u.exam)}</div>
      </div>
    </div>
    ${u.mustChange?`<div class="warnbox">${ic("key","sm")} Анхны нууц үгээ солино уу (дор хаяж 6 тэмдэгт).</div>`:""}
    <div class="row-gap"><button class="btn ghost" id="haz">${ic("alert")} Аюул мэдэгдэх</button><button class="btn ghost" id="wpw">${ic("key")} Нууц үг солих</button></div></main>`);
  $("#out").onclick = landing;
  $("#uhaan").onclick = uhaanForm;
  $("#fat").onclick = ()=> needF ? fatigueForm() : toast("Одоо бөглөх шаардлагагүй");
  $("#inf").onclick = ()=> roster && !infect ? infectForm() : toast(roster?"Өнөөдөр бөглөсөн":"Өнөөдөр хуваарь байхгүй");
  $("#haz").onclick = ()=>hazardForm();
  $("#wpw").onclick = workerPwPage;
  const hb = $("#hsign");
  if(hb) hb.onclick = ()=>{
    write({[`hygcheck/${hb.dataset.id}/rows/${hb.dataset.rk}/sign`]: true, [`hygcheck/${hb.dataset.id}/rows/${hb.dataset.rk}/signAt`]: nowStr()});
    toast("Гарын үсэг бүртгэгдлээ");
  };
}

function triRow(id, text){
  return `<div class="item"><p>${esc(text)}</p>
    <div class="tri" data-id="${id}" role="group">
      <button type="button" data-v="ok" aria-label="Тийм">✓</button>
      <button type="button" data-v="na" aria-label="Хамаарахгүй">—</button>
      <button type="button" data-v="no" aria-label="Үгүй">✕</button>
    </div></div>`;
}
function bindTri(root){
  root.querySelectorAll(".tri").forEach(g=>{
    g.onclick = e=>{
      const b = e.target.closest("button"); if(!b) return;
      g.querySelectorAll("button").forEach(x=>x.className="");
      b.className = b.dataset.v==="ok"?"on-ok":b.dataset.v==="na"?"on-na":"on-no";
      g.dataset.val = b.dataset.v;
    };
  });
}
function collectTri(prefix, n){
  const o={};
  for(let i=0;i<n;i++){ const g = document.querySelector(`.tri[data-id="${prefix}${i}"]`); o[prefix+i] = g?.dataset.val || ""; }
  return o;
}

function uhaanForm(){
  const u = me(); if(!u) return landing();
  view(uhaanForm, false);
  const app = mount(`
    ${appbar("УХААН", esc(u.name), true)}
    <div class="paper"><div class="formcard">
      <h3>Ямагт ажил эхлэхийн өмнө УХААН-ы тохирлыг шалгадаг байх</h3>
      <p class="muted">${esc(u.name)} · ${esc(u.sap)} · ${today()} · ${esc(albaN(u.alba))}</p>
      <label class="f" for="job">Миний ажил</label><input id="job" value="${esc(u.job||"")}"/>
      <h4>Урьдаар ажлаа нарийн тооц</h4>
      ${U1.map((t,i)=>triRow("a"+i,t)).join("")}
      <p class="muted">Хэрэв БАЙГАА бол журмыг уншиж ойлгосон байх. Хэрэв ТИЙМ бол ойр ажилтнуудад анхааруулах.</p>
      <h4>Хор хөнөөл, аюул бүрийг тодорхойл</h4>
      ${U2.map((t,i)=>triRow("b"+i,t)).join("")}
      <p class="warnbox">${ic("alert","sm")}<span>Агааржуулалт ✕ бол ажлаа зогсоож хяналтанд авна.</span></p>
      <h4>Миний хийх ажил надаас дараахыг шаардана</h4>
      ${U3.map((t,i)=>triRow("c"+i,t)).join("")}
      <p class="warnbox">${ic("alert","sm")}<span>Аль нэг ✓ (шаардана) бол ажлаа зогсоож хяналтанд авна.</span></p>
      <label class="f" for="risk">Аюулыг удирдаагүйгээс юу тохиолдож болох вэ?</label><textarea id="risk" maxlength="1000"></textarea>
      <label class="f" for="ctrl">Ямар хяналтуудыг хэрэгжүүлж болох вэ?</label><textarea id="ctrl" maxlength="1000"></textarea>
      <p class="note">Нэн тэргүүнд аюулгүй бай. Хянах боломжгүй бол ажлаа зогсоож ахлагчид мэдэгд.</p>
      <div class="actions">
      <button class="btn" id="send">${ic("send")} Илгээх</button>
      <button class="btn ghost" id="back">Буцах</button></div>
    </div></div>`);
  bindTri(app);
  $("#back").onclick = workerHome; $("[data-hback]").onclick = workerHome;
  $("#send").onclick = ()=>{
    const a=collectTri("a",U1.length), b=collectTri("b",U2.length), c=collectTri("c",U3.length);
    if(Object.values({...a,...b,...c}).some(v=>!v)){ toast("Бүх мөрийг ✓ / — / ✕-ээр тэмдэглэнэ үү"); return; }
    const stop = b.b3==="no" || Object.values(c).some(v=>v==="ok");
    const id = uid();
    write({["uhaan/"+id]: {id, sap:u.sap, name:u.name, alba:albaN(u.alba), job:$("#job").value, date:today(), time:nowStr(), a,b,c,
      risk:$("#risk").value, ctrl:$("#ctrl").value, stop, status: stop?"zogsooson":"huleegdej", supervisor:null}});
    alert(stop?"Ажлаа зогсоо. Ахлах болон эрүүл ахуйчид мэдэгдлээ.":"Илгээгдлээ. Ахлах болон эрүүл ахуйч харна.");
    workerHome();
  };
}

function qblock(id,title,sub,opts){
  return `<div class="qcard" id="${id}"><h3>${esc(title)}</h3><p class="muted">${esc(sub)}</p>
    <div class="opts" role="radiogroup">${opts.map(o=>`<button type="button" class="opt" role="radio">${esc(o)}</button>`).join("")}</div></div>`;
}
function bindOpts(app){
  app.onclick = e=>{
    const o=e.target.closest(".opt");
    if(o){ o.parentElement.querySelectorAll(".opt").forEach(x=>{x.classList.remove("on"); x.setAttribute("aria-checked","false");}); o.classList.add("on"); o.setAttribute("aria-checked","true"); }
  };
}
const optVal = id => document.querySelector("#"+id+" .opt.on")?.textContent.trim();

function fatigueForm(){
  const u = me(); if(!u) return landing();
  view(fatigueForm, false);
  const g = u.gender==="Эм";
  const app = mount(`
    ${appbar("Алжаал ядаргааны үнэлгээ", "Олон нийтийн эрүүл мэндийн үнэлгээний хэрэгсэл", true)}
    <main class="fwrap">
      <div class="lockgrid">
        <div class="cell"><span>${ic("lock")}SAP</span><b>${esc(u.sap)}</b></div>
        <div class="cell"><span>${ic("lock")}Нэр</span><b>${esc(u.name)}</b></div>
        <div class="cell"><span>${ic("lock")}Огноо</span><b>${today()}</b></div>
        <div class="cell"><span>${ic("lock")}Тасаг / Нэгж</span><b>${esc(albaN(u.alba))}</b></div>
      </div>
      ${qblock("q5","1. Сүүлийн 24 цагийн унтах хугацаа (ойролцоогоор)","Та сүүлийн 24 цагт нийт хэдэн цаг унтав?",["7 ба түүнээс их","6-7 цаг","6 цагаас бага"])}
      ${qblock("q6","2. Сүүлийн 48 цагийн унтах хугацаа (ойролцоогоор)","Та сүүлийн 48 цагт нийт хэдэн цаг унтав?",["14 цагаас их","12-14","12 цагаас бага"])}
      ${qblock("q7","3. Ээлж дуусах үед сэрүүн байсан цаг (ойролцоогоор)","Та ээлж эхэлснээс хойш ээлж дуустал хэдэн цаг сэрүүн байв?",["14 цагаас бага","14-16","16 цагаас илүү"])}
      ${qblock("q8", "4. Сүүлийн 24 цагийн архины хэрэглээ (стандарт нэгж) — "+(g?"ЭМ":"ЭР"),"Та сүүлийн 24 цагт хэдэн стандарт нэгж архи хэрэглэсэн бэ?",["хэрэглээгүй","1-3","4-6"])}
      ${qblock("q10","5. Эмийн хэрэглээ (сүүлийн 24 цаг)","Та сүүлийн 24 цагт ямар нэг эм, нойрны эм, тайвшруулах эм хэрэглэсэн үү?",["Үгүй","Тийм"])}
      ${qblock("q11","6. Анхаарал төвлөрөл / Сэтгэцийн хурц байдал","Та өөрийгөө ямар түвшинд үнэлэх вэ?",["Маш сайн / Хурц","Дунд зэрэг / Хангалттай","Муу / Бүдэг"])}
      <div class="actions"><button class="btn" id="calc">Оноо тооцох ${ic("chev")}</button>
      <button class="btn ghost" id="back">Буцах</button></div>
    </main>`);
  bindOpts(app);
  $("#back").onclick = workerHome; $("[data-hback]").onclick = workerHome;
  $("#calc").onclick = ()=>{
    const ids=["q5","q6","q7","q8","q10","q11"];
    if(ids.some(i=>!optVal(i))){ toast("Бүх асуултыг сонгоно уу"); return; }
    const map3 = (v,opts)=>Math.max(0,opts.indexOf(v));
    const s5 = map3(optVal("q5"),["7 ба түүнээс их","6-7 цаг","6 цагаас бага"]);
    const s6 = map3(optVal("q6"),["14 цагаас их","12-14","12 цагаас бага"]);
    const s7 = map3(optVal("q7"),["14 цагаас бага","14-16","16 цагаас илүү"]);
    const s8 = optVal("q8")==="хэрэглээгүй"?0:optVal("q8")==="1-3"?1:2;
    const s10 = optVal("q10")==="Тийм"?2:0;
    const s11 = map3(optVal("q11"),["Маш сайн / Хурц","Дунд зэрэг / Хангалттай","Муу / Бүдэг"]);
    const score = s5+s6+s7+s8+s10+s11;
    let level = score<=3?"Бага":score<=7?"Дунд":"Өндөр";
    if(optVal("q10")==="Тийм" || s11===2) level = level==="Бага"?"Дунд":level;
    if(s8===2 && s5===2) level="Өндөр";
    const id=uid();
    write({["fatigue/"+id]: {id, sap:u.sap, name:u.name, alba:albaN(u.alba), gender:u.gender, date:today(),
      q5:optVal("q5"),q6:optVal("q6"),q7:optVal("q7"),q8:optVal("q8"),q10:optVal("q10"),q11:optVal("q11"),score,level}});
    alert(`${level} оноо: ${score}/12`+(level==="Өндөр"?" — ахлах/эрүүл ахуйчид мэдэгдлээ":""));
    workerHome();
  };
}

const INF_QS = [
  {id:"f1", t:"Та сүүлийн 72 цагийн хугацаанд ил задгай хадгалсан, үнэр амт өөрчлөгдсөн, хордлого үүсгэж болзошгүй хоол хүнс хэрэглэсэн үү?", o:["Тийм","Үгүй"]},
  {id:"f2", t:"Таньд дотор муухайрах, гэдэс базлах, гүйлгэх шинж тэмдэг илэрч байна уу?", o:["Тийм","Үгүй","Илэрсэн, одоо эдгэсэн"]},
  {id:"f3", t:"Та амралтын хугацаанд дээрх шинж тэмдэг илэрсэн хүнтэй хавьтал болсон уу?", o:["Тийм","Үгүй","Мэдэхгүй"]},
  {id:"f4", t:"Танд бэртэл гэмтэл авсан зэрэг эрүүл мэндийн асуудал байна уу? (Тийм бол ахлах ажилтандаа мэдэгдэнэ үү)", o:["Тийм","Үгүй"]},
  {id:"f5", t:"Нойр, амралт хангалттай авч ажилдаа бэлэн байх нөхцөлийг хангаж чадаж байна уу?", o:["Тийм","Үгүй"]}
];
function infectForm(){
  const u = me(); if(!u) return landing();
  view(infectForm, false);
  const app = mount(`
    ${appbar("Гэдэсний халдварт өвчнийг тандах", esc(u.name), true)}
    <main class="fwrap">
      <p class="muted">ГХӨ-г эрт илрүүлэх, халдвар дамжихаас сэргийлэх зорилготой.</p>
      <div class="lockgrid two">
        <div class="cell">Овог нэр<b>${esc(u.name)}</b></div>
        <div class="cell">SAP / алба<b>${esc(u.sap)} · ${esc(albaN(u.alba))}</b></div>
      </div>
      <label class="f" for="arrive">Ээлжинд ирэх хугацаа *</label>
      <input type="date" id="arrive" value="${today()}"/>
      ${INF_QS.map(q=>`<div class="qcard" id="${q.id}"><h3>${esc(q.t)}</h3>
        <div class="opts ${q.o.length===3?"":"two"}" role="radiogroup">${q.o.map(o=>`<button type="button" class="opt" role="radio">${esc(o)}</button>`).join("")}</div></div>`).join("")}
      <div class="actions"><button class="btn" id="send">${ic("send")} Илгээх</button>
      <button class="btn ghost" id="back">Буцах</button></div>
    </main>`);
  bindOpts(app);
  $("#back").onclick = workerHome; $("[data-hback]").onclick = workerHome;
  $("#send").onclick = ()=>{
    if(INF_QS.some(q=>!optVal(q.id))){ toast("Бүх асуултыг хариулна уу"); return; }
    const id=uid();
    write({["infect/"+id]: {id, sap:u.sap, name:u.name, alba:albaN(u.alba), date:$("#arrive").value||today(),
      ans: INF_QS.map(q=>({q:q.t, a:optVal(q.id)})), verdict:"huleegdej"}});
    toast("Илгээгдлээ. Үр дүнг эрүүл ахуйч гаргана.");
    workerHome();
  };
}

let hazardPics = [];
/* OT-03-FRM-0001-D «Record an observed hazard checklist v2.0» — бүтэц */
const HZ_FORM_CODE = "OT-03-FRM-0001-D-Record an observed hazard checklist_v2.0";
const HZ_TYPES = [["Эрүүл мэнд","Health"],["Аюулгүй ажиллагаа","Safety"],["Байгаль орчин","Environment"],["Аюулгүй байдал","Security"]];
/* Цаасан хуудсын 4 баганат сүлжээ (null = цаасан дээрх шошгогүй хоосон нүд) */
const HZ_GRID = [
  [["Бодисууд","Substances"],["Байгаль орчин Эко систем","Natural environment / Ecosystem"],["Хувийн/Зан чанарын","Personal / Behavioral"],["Дулаан/Гал/Тэсэлгээ","Thermal/ Fire/ Explosion"]],
  [["Биологийн","Biological"],["Эргономик","Ergonomics"],["Даралт","Pressure"],["Гадны аюулууд","External Threats"]],
  [["Цаг уур/Байгалийн үзэгдлүүд","Climatic / Natural Events"],null,null,["Бохир/Хаягдал","Waste"]],
  [["Машин/Тээврийн хэрэгсэл","Vehicles / transportation"],["Гэрэл","Lighting"],["Дуу чимээ/Доргион, чичиргээ","Sound / Vibration"],["Ажлын орчин","Work Environment"]],
  [["Цахилгаан / Соронзон орон","Electric / Magnetic"],["Механик","Mechanical"],["Нийгэм / Соёлын","Social / Cultural"],null]
];
const HZ_CLS = HZ_GRID.flat().filter(Boolean);
const HZ_RISK = [["Бага","Low"],["Дунд зэрэг","Moderate"],["Их","High"],["Маш их","Critical"]];
/* Хуучин (v1 маягт) утгуудыг шинэ шошго руу */
const HZ_CLS_OLD = {"Бодис":"Бодисууд","Цаг агаарын":"Цаг уур/Байгалийн үзэгдлүүд","Тээврийн хэрэгсэл":"Машин/Тээврийн хэрэгсэл","Цахилгаан":"Цахилгаан / Соронзон орон",
  "Байгалийн орчин":"Байгаль орчин Эко систем","Байгаль орчин / эко систем":"Байгаль орчин Эко систем","Гэрэлтүүлэг":"Гэрэл","Хувь хүний":"Хувийн/Зан чанарын","Дуу чимээ":"Дуу чимээ/Доргион, чичиргээ",
  "Дулаан":"Дулаан/Гал/Тэсэлгээ","Гадаа аюул":"Гадны аюулууд","Хог хаягдал":"Бохир/Хаягдал"};
function normHazard(x){
  x = x || {};
  let types = arr(x.types);
  if(x.form!=="OT-03-v2"){   // хуучин маягт: "Аюулгүй байдал"=Safety, "Хамгаалалт"=Security байсан
    types = types.map(t=> t==="Аюулгүй байдал" ? "Аюулгүй ажиллагаа" : t==="Хамгаалалт" ? "Аюулгүй байдал" : t);
  }
  const cls = arr(x.cls).map(c=> HZ_CLS_OLD[c] || c);
  const status = HZ_ST_OLD[x.status] || x.status || "Шинэ";
  return {...x, types, cls, status, alba: x.alba ? albaN(x.alba) : albaOf(x.area)};
}
const hzMark = on => on ? "☒" : "☐";
/* Аюулын хяналт: төлөв, хариуцагч, хугацаа, түүх */
const HZ_ST = ["Шинэ","Хийгдэж буй","Шийдсэн","Хаасан"];
const HZ_ST_OLD = {"Шалгаж байна":"Хийгдэж буй","Шийдвэрлэсэн":"Шийдсэн"};
const HZ_OPEN = s => s==="Шинэ" || s==="Хийгдэж буй";
const HZ_HIGH = r => r==="Их" || r==="Маш их";
/* Газрын нэрнээс алба: «оффис» → Оффис, «баар»/«бар» гэсэн үг → Бар, бусад → "" (бүх ахлахад харагдана) */
const albaOf = area => { const s = String(area||""); return /оффис/i.test(s) ? "Оффис" : /баар|(^|[\s,.;:\/()-])бар($|[\s,.;:\/()-])/i.test(s) ? "Бар" : ""; };
const hzOverdue = x => !!(x.due && x.due < today() && HZ_OPEN(x.status));
function hazardForm(opts){
  hazardPics = [];
  const preArea = opts && typeof opts.area==="string" ? opts.area.slice(0,120) : null;
  view(()=>hazardForm(opts), false);
  const u = me();
  const back = ()=> u? homeFor(u) : landing();
  const lbl = (mn,en,forId)=>`<label class="otl" ${forId?`for="${forId}"`:""}><b>${esc(mn)}</b>${en?`<i>${esc(en)}</i>`:""}</label>`;
  const chk = (name,[mn,en],type="checkbox")=>`<label class="otc"><input type="${type}" name="${name}" value="${esc(mn)}"/><span><b>${esc(mn)}</b><i>${esc(en)}</i></span></label>`;
  const app = mount(`
    <div class="otpage">
      <div class="otband"><div><h1>АЮУЛЫГ МЭДЭЭЛЭХ ХУУДАС</h1><h2>RECORD AN OBSERVED HAZARD</h2></div><img src="/logo.png" alt="Ерөө говь ХХК"/></div>
      <form id="hzf" novalidate>
      <div class="otbar big"><b>ЕРӨНХИЙ МЭДЭЭЛЭЛ</b><span>HAZARD HEADER</span></div>
      <div class="otgrid">
        <div class="otrow full">${lbl("Аюулыг харсан газар, харъяа хэлтэс:","What work area was the hazard observed in?","area")}
          <div class="otv"><input id="area" list="albaList" maxlength="120" required value="${esc(preArea!=null&&preArea!==""?preArea:(albaN(u?.alba)||""))}" placeholder="Жишээ: Бар, гал тогоо"/>
          ${preArea?`<small class="qrnote">${ic("qr","sm")} QR кодоор нээсэн — газар бөглөгдсөн</small>`:""}
          <datalist id="albaList">${ALBA.map(a=>`<option value="${esc(a)}">`).join("")}</datalist></div></div>
        <div class="otrow">${lbl("Аюулыг олж ажигласан огноо:","","hdate")}<div class="otv"><input type="date" id="hdate" value="${today()}" max="${today()}" required/></div></div>
        <div class="otrow">${lbl("Аюулыг хянаж бууруулах ажлыг хариуцах хэлтэс:","What part of the organisation is accountable for the hazard?","acc")}<div class="otv"><input id="acc" maxlength="120"/></div></div>
        <div class="otrow">${lbl("Аюулыг мэдээлсэн хүн:","Hazard Reporter:","rep")}<div class="otv"><input id="rep" maxlength="120" value="${esc(u?.name||"")}" placeholder="Нэр, албан тушаал"/></div></div>
        <div class="otrow">${lbl("Аюулыг хянаж , судласан хүн (ахлах ажилтан):","Hazard Reviewer:","rev")}<div class="otv"><input id="rev" maxlength="120" placeholder="Нэр, албан тушаал"/></div></div>
      </div>
      <div class="otbar"><b>АЮУЛЫН ТАЙЛБАР</b><span>HAZARD DESCRIPTION</span></div>
      <div class="otgrid">
        <div class="otrow full">${lbl("Аюулын төрөл","What type of hazard did you observe?")}
          <div class="otv otchecks c3" id="types">${[HZ_TYPES[0],HZ_TYPES[1],HZ_TYPES[2],null,HZ_TYPES[3],null].map(t=>t?chk("type",t):'<div class="otc-empty"></div>').join("")}</div></div>
        <div class="otrow full">${lbl("Тухайн аюулыг аль ангилалд хамааруулах вэ?","What hazard type would you classify the hazard as?")}
          <div class="otv otchecks c4" id="cls">${HZ_GRID.flat().map(t=>t?chk("cls",t):'<div class="otc-empty"></div>').join("")}</div></div>
        <div class="otrow full">${lbl("Эрсдлийн түвшинг өөрийн сэтгэгдлээр илэрхийлнэ үү?","What is your impression of the risk?")}
          <div class="otv otchecks c4 risk" id="riskg">${HZ_RISK.map(t=>chk("risk",t,"radio")).join("")}</div></div>
        <div class="otrow full">${lbl("Харсан аюулаа дэлгэрэнгүй дүрсэлж бичнэ үү?","Record details of the hazard","det")}
          <div class="otv"><textarea id="det" maxlength="1000" rows="5" required placeholder="Аюулын байршил, нөхцөл, юу ажиглагдсаныг дэлгэрэнгүй бичнэ үү..."></textarea></div></div>
        <div class="otrow full">${lbl("Авсан шуурхай арга хэмжээ","Were any immediate actions taken?","act")}
          <div class="otv"><textarea id="act" maxlength="1000" rows="4" placeholder="Аюулыг бууруулах эсвэл арилгахын тулд шууд юу хийсэн бэ?..."></textarea></div></div>
      </div>
      <div class="otbar"><b>НЭМЭЛТ: ЗУРАГ</b><span>PHOTOS (2–8)</span></div>
      <label class="drop">${ic("camera")}<span>Зураг оруулах — багадаа 2, дээд тал нь 8 зураг (JPG/PNG)</span>
        <input type="file" id="pics" accept="image/*" multiple/></label>
      <div class="thumbs" id="thumbs"></div>
      <div id="hzerr" class="errtxt" role="alert"></div>
      <button class="btn" type="submit" id="send">${ic("send")} Илгээх / Submit</button>
      <p class="muted center">${ic("lock","sm")} Таны мэдээлэл нууцлагдана.</p>
      <button class="btn ghost" type="button" id="back">Буцах</button>
      </form>
      <div class="otfoot"><b>Ерөө говь ХХК</b><span>PRINTED COPIES ARE UNCONTROLLED<br>${esc(HZ_FORM_CODE)}</span><span></span></div>
    </div>`);
  const drawThumbs = ()=> $("#thumbs").innerHTML = hazardPics.map((s,i)=>`<div class="th"><img src="${s}" alt=""><button type="button" data-rm="${i}" aria-label="Устгах">×</button></div>`).join("");
  $("#thumbs").onclick = e=>{ const b=e.target.closest("[data-rm]"); if(b){ hazardPics.splice(+b.dataset.rm,1); drawThumbs(); } };
  $("#pics").onchange = async e=>{
    for(const f of [...e.target.files]){
      if(hazardPics.length>=8){ toast("Дээд тал нь 8 зураг"); break; }
      if(!/^image\//.test(f.type)) continue;
      try{ hazardPics.push(await fileToData(f)); }catch(err){ console.warn(err); toast("Зураг уншиж чадсангүй"); }
    }
    e.target.value=""; drawThumbs();
  };
  $("#back").onclick = back;
  app.onchange = app.oninput = ()=>{ const er=$("#hzerr"); if(er && er.textContent) er.textContent=""; };
  app.onsubmit = e=>{
    e.preventDefault();
    const vals = n => $$(`#hzf input[name="${n}"]:checked`).map(x=>x.value);
    const errs = [];
    if(!$("#area").value.trim()) errs.push("Аюулыг харсан газар");
    if(!vals("type").length) errs.push("Аюулын төрөл");
    if(!vals("cls").length) errs.push("Аюулын ангилал");
    if(!vals("risk").length) errs.push("Эрсдлийн түвшин");
    if(!$("#det").value.trim()) errs.push("Аюулын дэлгэрэнгүй");
    if(hazardPics.length<2) errs.push("Багадаа 2 зураг");
    if(errs.length){ $("#hzerr").textContent = "Бөглөнө үү: "+errs.join(", "); $("#hzerr").scrollIntoView({block:"center"}); return; }
    const id=uid();
    const area=$("#area").value.trim(), risk=vals("risk")[0];
    const upd = {
      ["hazards/"+id]: {id, form:"OT-03-v2", area, alba:albaOf(area), date:$("#hdate").value||today(), acc:$("#acc").value.trim(), reporter:$("#rep").value.trim(), reviewer:$("#rev").value.trim(),
        types:vals("type"), cls:vals("cls"), risk, det:$("#det").value, act:$("#act").value,
        photoCount: hazardPics.length, status:"Шинэ", created:nowStr(), ts:Date.now(), ...(preArea?{via:"qr"}:{})},
      ["photos/"+id]: hazardPics.slice(0,8)
    };
    if(HZ_HIGH(risk)) upd["notifs/hz_"+id] = {id:"hz_"+id, type:"hazard", level: risk==="Маш их"?"critical":"high", ts:Date.now(),
      title: (risk==="Маш их"?"Маш их":"Их")+" эрсдэлтэй аюул: "+area.slice(0,80), body: $("#det").value.slice(0,160), alba: albaOf(area), ref:id,
      by: (u?.name || $("#rep").value.trim() || "Нэргүй").slice(0,80), bySap: u?.sap || ""};
    write(upd);
    alert("Мэдэгдэл хүлээн авлаа.");
    back();
  };
}
/* Цаасан маягттай ижил хэвлэх хуудас (A4 босоо, 2 хуудас) */
async function hazardPrint(id){
  if(!requireRole("hygiene","supervisor")) return;
  const raw = DB.hazards[id]; if(!raw){ toast("Олдсонгүй"); return; }
  const x = normHazard(raw);
  view(()=>hazardPrint(id), false);
  const has = (list,v)=>list.includes(v);
  const L = (mn,en)=>`<td class="pl"><b>${esc(mn)}</b>${en?`<i>${esc(en)}</i>`:""}</td>`;
  const opt = (on,[mn,en])=>`<div class="po"><span class="bx">${hzMark(on)}</span><div><b>${esc(mn)}</b><i>${esc(en)}</i></div></div>`;
  const band = `<div class="pband"><div><h1>АЮУЛЫГ МЭДЭЭЛЭХ ХУУДАС</h1><h2>RECORD AN OBSERVED HAZARD</h2></div><img src="/logo.png" alt="Ерөө говь ХХК"/></div>`;
  const foot = n=>`<div class="pfoot"><b>Ерөө говь ХХК</b><span>PRINTED COPIES ARE UNCONTROLLED<br>${esc(HZ_FORM_CODE)}</span><span>Page ${n} of 2</span></div>`;
  const app = mount(`
    <div class="printbar noprint"><button class="btn sm" id="pp">${ic("printer","sm")} Хэвлэх (A4)</button><button class="btn ghost sm" id="pb">${ic("back","sm")} Аюулын жагсаалт</button></div>
    <div class="sheet-wrap"><div class="hzsheet">
      <section class="ppage">${band}
        <table class="pt"><colgroup><col style="width:24%"/><col style="width:26%"/><col style="width:24%"/><col style="width:26%"/></colgroup>
          <tr class="pbar big"><td colspan="4"><b>ЕРӨНХИЙ МЭДЭЭЛЭЛ</b><span>HAZARD HEADER</span></td></tr>
          <tr>${L("Аюулыг харсан газар, харъяа хэлтэс:","What work area was the hazard observed in?")}<td colspan="3" class="pv">${esc(x.area||"")}</td></tr>
          <tr>${L("Аюулыг олж ажигласан огноо:","")}<td class="pv">${esc(x.date||"")}</td>${L("Аюулыг хянаж бууруулах ажлыг хариуцах хэлтэс:","What part of the organisation is accountable for the hazard?")}<td class="pv">${esc(x.acc||"")}</td></tr>
          <tr>${L("Аюулыг мэдээлсэн хүн:","Hazard Reporter:")}<td class="pv">${esc(x.reporter||"")}</td>${L("Аюулыг хянаж , судласан хүн (ахлах ажилтан):","Hazard Reviewer:")}<td class="pv">${esc(x.reviewer||"")}</td></tr>
          <tr class="pbar"><td colspan="4"><b>АЮУЛЫН ТАЙЛБАР</b><span>HAZARD DESCRIPTION</span></td></tr>
          <tr>${L("Аюулын төрөл","What type of hazard did you observe?")}<td colspan="3" class="pv"><div class="pg g3">
            ${opt(has(x.types,HZ_TYPES[0][0]),HZ_TYPES[0])}${opt(has(x.types,HZ_TYPES[1][0]),HZ_TYPES[1])}${opt(has(x.types,HZ_TYPES[2][0]),HZ_TYPES[2])}<div></div>${opt(has(x.types,HZ_TYPES[3][0]),HZ_TYPES[3])}<div></div></div></td></tr>
          <tr>${L("Тухайн аюулыг аль ангилалд хамааруулах вэ?","What hazard type would you classify the hazard as?")}<td colspan="3" class="pv"><div class="pg g4">
            ${HZ_GRID.flat().map(c=> c? opt(has(x.cls,c[0]),c) : `<div class="po"><span class="bx">☐</span><div></div></div>`).join("")}</div></td></tr>
          <tr>${L("Эрсдлийн түвшинг өөрийн сэтгэгдлээр илэрхийлнэ үү?","What is your impression of the risk?")}<td colspan="3" class="pv"><div class="pg g4 risk">
            ${HZ_RISK.map(r=>`<div class="po"><span class="bx">${hzMark(x.risk===r[0])}</span><div>${esc(r[0])} / <i class="in">${esc(r[1])}</i></div></div>`).join("")}</div></td></tr>
          <tr class="tall">${L("Харсан аюулаа дэлгэрэнгүй дүрсэлж бичнэ үү?","Record details of the hazard")}<td colspan="3" class="pv txt">${esc(x.det||"")}</td></tr>
        </table>${foot(1)}
      </section>
      <section class="ppage">${band}
        <table class="pt"><colgroup><col style="width:24%"/><col/></colgroup>
          <tr class="tall2">${L("Авсан шуурхай арга хэмжээ","Were any immediate actions taken?")}<td class="pv txt">${esc(x.act||"")}</td></tr>
        </table>
        <div class="pphotos" id="pph"></div>
        ${foot(2)}
      </section>
    </div></div>`);
  const fit = ()=>{ const sh=$(".hzsheet"); if(!sh) return; const z=Math.min(1,(window.innerWidth-24)/794); sh.style.zoom = z<1? z.toFixed(3) : ""; };
  fit(); window.onresize = fit;
  $("#pp").onclick = ()=>window.print();
  $("#pb").onclick = hazardListPage;
  const ps = await getPhotos(id);
  const el = $("#pph");
  if(el && ps.length) el.innerHTML = `<div class="pphead">Хавсралт: зураг (${ps.length})</div><div class="ppgrid">${ps.slice(0,8).map(p=>`<img src="${esc(p)}" alt=""/>`).join("")}</div>`;
}
function fileToData(f){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onerror=rej;
    r.onload=()=>{
      const img=new Image();
      img.onerror=rej;
      img.onload=()=>{
        const c=document.createElement("canvas");
        const w=Math.min(800,img.width), h=Math.round(img.height*(w/img.width));
        c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",0.6));
      };
      img.src=r.result;
    };
    r.readAsDataURL(f);
  });
}

/* ======================= САМБАРЫН БҮРХҮҮЛ ======================= */
const NAV = {
  hygiene: [["тойм","Тойм"],["мэдэгдэл","Мэдэгдэл"],["ариун","Ариун цэвэр"],["хяналт","Ахлахын хяналт"],["ядаргаа","Ядаргаа"],["аюул","Аюул"],["халдвар","Халдвар"],["хуваарь","Хуваарь"],["дэвтэр","Цагаан дэвтэр"],["ажилтан","Ажилтнууд"],["тайлан","Тайлан, график"],["qr","QR код"],["excel","Excel"],["тохиргоо","Тохиргоо"]],
  supervisor: [["тойм","УХААН шалгах"],["мэдэгдэл","Мэдэгдэл"],["ариун","Ариун цэвэр"],["хяналт","Хяналтын хуудас"],["аюул","Аюул"],["тохиргоо","Тохиргоо"]]
};
const NAV_IC = {"тойм":"grid","мэдэгдэл":"bell","ариун":"drop","хяналт":"clipboard","ядаргаа":"battery","аюул":"alert","халдвар":"virus","хуваарь":"calendar","дэвтэр":"book","ажилтан":"users","тайлан":"chart","qr":"qr","excel":"sheet","тохиргоо":"sliders"};
function shell(active, inner){
  const u = me(); const role = u?.role==="supervisor"?"supervisor":"hygiene";
  const title = role==="supervisor" ? `Ахлах · ${esc(albaN(u?.alba))}` : "Эрүүл ахуйчийн самбар";
  return `<div class="dash">
    <aside class="side">
      <div class="sbrand"><span class="slogo"><img src="/logo.png" alt="Ерөө говь ХХК"/></span><h1>${title}<small>ЭАХС · ${esc(u?.name||"")}</small></h1></div>
      <nav class="navs" aria-label="Цэс">
      ${NAV[role].map(([k,l])=>{ const n = k==="мэдэгдэл" ? unreadCount() : k==="аюул" && role==="hygiene" ? list("hazards").map(normHazard).filter(hzOverdue).length : 0;
        return `<button class="navb ${active===k?"on":""}" data-nav="${k}" ${active===k?'aria-current="page"':""}>${ic(NAV_IC[k])}<span>${esc(l)}</span>${n?`<em class="nbadge ${k==="аюул"?"od":""}" aria-label="${n}">${n>99?"99+":n}</em>`:""}</button>`; }).join("")}
      <button class="navb out" data-nav="гарах">${ic("logout")}<span>Гарах</span></button>
      </nav>
      <div class="suser"><span class="avatar" aria-hidden="true">${esc(initials(u?.name))}</span><div><b>${esc(u?.name||"")}</b><span>${esc(roleName(u?.role))}${u?.alba?" · "+esc(albaN(u.alba)):""}</span></div></div>
    </aside>
    <main class="main">${inner}</main>
  </div>`;
}
function bindNav(app, extra){
  app.onclick = e=>{
    const nav=e.target.closest("[data-nav]")?.dataset.nav;
    if(nav){
      const sup = me()?.role==="supervisor";
      ({"тойм": sup?supervisorHome:hygieneHome, "ариун":hygListPage, "ядаргаа":fatigueListPage, "аюул":hazardListPage, "халдвар":infectListPage,
        "хуваарь":rosterPage, "дэвтэр":bookPage, "ажилтан":usersPage, "excel":reportPage, "тохиргоо":settingsPage, "гарах":landing,
        "мэдэгдэл":notifPage, "тайлан":reportsPage, "qr":qrPage, "хяналт":svListPage}[nav]||(()=>{}))();
      window.scrollTo(0,0);
      return;
    }
    const tr=e.target.closest("[data-u]");
    if(tr){ viewUhaan(tr.dataset.u); return; }
    if(extra) extra(e);
  };
}
const tbl = (head, rows, empty="Одоогоор бүртгэл алга") =>
  `<div class="tw"><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")||`<tr><td colspan="${head.length}" class="empty-td">${emptyState(empty, "Шинэ бүртгэл орж ирэхэд энд харагдана")}</td></tr>`}</tbody></table></div>`;
function requireRole(...roles){ const u=me(); if(!u || !roles.includes(u.role)){ landing(); return null; } return u; }

/* ======================= АХЛАХ ======================= */
function stU(x){
  if(x.stop) return `<span class="badge b-bad">Зогсоосон</span>`;
  if(x.status==="batlagdsan") return `<span class="badge b-ok">Батлагдсан</span>`;
  if(x.status==="butsaasan") return `<span class="badge b-wait">Буцаасан</span>`;
  return `<span class="badge b-wait">Хүлээгдэж</span>`;
}
function supervisorHome(){
  const u = requireRole("supervisor"); if(!u) return;
  view(supervisorHome, true);
  const l = list("uhaan").filter(x=>albaN(x.alba)===albaN(u.alba)).sort(byNew);
  const app = mount(shell("тойм", `
    ${phead("УХААН шалгах", `${esc(albaN(u.alba))} · Өнөөдөр: ${today()}`)}
    ${hygDueCard(u.alba)}
    <div class="card"><div class="ctitle">${ic("checks")}<h3>УХААН — ${esc(albaN(u.alba))}</h3></div>${tbl(["Огноо","Нэр","Ажил","Төлөв",""], l.map(x=>`<tr data-u="${esc(x.id)}" class="click"><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.job||"")}</td><td>${stU(x)}</td><td><button class="btn sm" data-u="${esc(x.id)}">Нээх</button></td></tr>`), "УХААН бүртгэл алга")}</div>`));
  bindNav(app, e=>{ const b=e.target.closest("[data-open-hyg]"); if(b) hygEdit(today(), u.alba); });
}
function viewUhaan(id){
  const x=DB.uhaan[id]; if(!x) return;
  const u = me(); const who = u?.role;
  view(()=>viewUhaan(id), false);
  const sym = v => v==="ok"?"✓":v==="na"?"—":v==="no"?"✕":"?";
  const show=(a,pref,src)=>a.map((t,i)=>`<div class="item inl"><p>${esc(t)}</p><b>${sym((src||{})[pref+i])}</b></div>`).join("");
  const app = mount(`${appbar("УХААН · "+esc(x.name), esc(x.date), true)}<div class="paper"><div class="formcard">
    <p class="muted">${esc(x.date)} ${esc(x.time||"")} · ${esc(albaN(x.alba))} · ${esc(x.job||"")}</p>
    ${x.stop?`<div class="warnbox bad">${ic("alert","sm")}<span>Зогсоох нөхцөл илэрсэн</span></div>`:""}
    <h4>Урьдаар тооц</h4>${show(U1,"a",x.a)}
    <h4>Хор хөнөөл</h4>${show(U2,"b",x.b)}
    <h4>Ажлын шаардлага</h4>${show(U3,"c",x.c)}
    <p><b>Эрсдэл:</b> ${esc(x.risk||"—")}</p>
    <p><b>Хяналт:</b> ${esc(x.ctrl||"—")}</p>
    <p>Ахлах: ${esc(x.supervisor||"хүлээгдэж")} ${x.note?"· "+esc(x.note):""}</p>
    <div class="actions">${who==="supervisor" && x.status==="huleegdej"?`<button class="btn" id="ok">${ic("check")} Батална</button><button class="btn warn" id="no">Буцаа</button>`:""}
    <button class="btn ghost" id="back">Буцах</button></div>
  </div></div>`);
  const back = ()=> who==="supervisor"?supervisorHome():hygieneHome();
  $("#back").onclick=back; $("[data-hback]").onclick=back;
  const ok=$("#ok"), no=$("#no");
  if(ok) ok.onclick=()=>{ write({["uhaan/"+id+"/status"]:"batlagdsan", ["uhaan/"+id+"/supervisor"]:u.name+" "+nowStr()}); back(); };
  if(no) no.onclick=()=>{ const n=prompt("Шалтгаан")||""; write({["uhaan/"+id+"/status"]:"butsaasan", ["uhaan/"+id+"/supervisor"]:u.name+" "+nowStr(), ["uhaan/"+id+"/note"]:n}); back(); };
}

/* ======================= ЭРҮҮЛ АХУЙЧ ======================= */
function stH(s){
  s = HZ_ST_OLD[s] || s || "Шинэ";
  if(s==="Шинэ") return `<span class="badge b-new">Шинэ</span>`;
  if(s==="Хийгдэж буй") return `<span class="badge b-wait">Хийгдэж буй</span>`;
  if(s==="Хаасан") return `<span class="badge b-closed">Хаасан</span>`;
  return `<span class="badge b-ok">Шийдсэн</span>`;
}
function hygieneHome(){
  const me_ = requireRole("hygiene"); if(!me_) return;
  view(hygieneHome, true);
  const u=list("uhaan").sort(byNew), f=list("fatigue").sort(byNew), h=list("hazards").sort(byNew), inf=list("infect");
  const ws=workers();
  const hi=f.filter(x=>x.level==="Өндөр" && x.date===today()).length;
  const neu=h.filter(x=>x.status==="Шинэ").length;
  const hzN=h.map(normHazard), odz=hzN.filter(hzOverdue).length, hzOpen=hzN.filter(x=>HZ_OPEN(x.status)).length;
  const exp=ws.filter(w=>(w.bookExp && daysBetween(today(),w.bookExp)<=30) || (w.exam && daysBetween(today(),w.exam)<=30)).length;
  const infPend=inf.filter(x=>(!x.verdict||x.verdict==="huleegdej")).length;
  const infBlock=inf.filter(x=>x.verdict==="ersdel" && x.date===today()).length;
  const due = hygDue(today());
  const app = mount(shell("тойм", `
        ${phead("Хяналтын самбар", `${ic("calendar","sm")} Өнөөдөр: ${today()}`)}
        <div class="kpis">
          <div class="kpi k-red ${hi?"hot":""}"><i>${ic("battery")}</i><div>Өндөр ядаргаа<b>${hi}</b><span class="muted">өнөөдөр</span></div></div>
          <div class="kpi k-org"><i>${ic("alert")}</i><div>Шинэ аюул<b>${neu}</b><span class="muted">бүртгэл</span></div></div>
          <div class="kpi k-red ${odz?"hot":""} click" data-nav="аюул" data-hzod><i>${ic("clock")}</i><div>Хугацаа хэтэрсэн<b>${odz}</b><span class="muted">нээлттэй аюул: ${hzOpen}</span></div></div>
          <div class="kpi k-blu"><i>${ic("file")}</i><div>Баримт ≤30 хоног<b>${exp}</b><span class="muted">ажилтан</span></div></div>
          <div class="kpi k-vio"><i>${ic("virus")}</i><div>Халдвар шийдээгүй<b>${infPend}</b><span class="muted">өнөөдөр оруулахгүй: ${infBlock}</span></div></div>
          <div class="kpi k-grn"><i>${ic("drop")}</i><div>Ариун цэвэр өнөөдөр<b>${due.done}/${due.total}</b><span class="muted">бүртгэсэн / бүртгэх</span></div></div>
        </div>
        ${hygDueCard(null)}
        <div class="card"><div class="ctitle">${ic("alert")}<h3>Сүүлийн аюулын мэдээлэл</h3><button class="btn ghost sm" data-nav="аюул" style="margin-left:auto">Бүгд ${ic("chev","sm")}</button></div>
          ${hzN.slice(0,6).map(x=>`<div class="hzrow click" data-hzd="${esc(x.id)}"><div><b>${esc(x.det||x.types?.[0]||"Аюул")}</b><div class="muted">${esc(x.date)} · ${esc(x.area)}</div></div>${stH(x.status)}</div>`).join("")||emptyState("Аюулын мэдээлэл алга","Ажилтнууд мэдээлэхэд энд харагдана","alert")}
        </div>
        <div class="card"><div class="ctitle">${ic("users")}<h3>Ажилтнуудын тойм</h3></div>
          ${tbl(["Ажилтан","SAP","Тасаг","Ядаргаа","Цагаан дэвтэр"], ws.map(w=>{
            const last=f.find(x=>x.sap===w.sap);
            return `<tr><td>${esc(w.name)}</td><td>${esc(w.sap)}</td><td>${esc(albaN(w.alba))}</td><td>${last?esc(last.level+" ("+last.score+")"):"—"}</td><td>${expBadge(w.bookExp)}</td></tr>`;
          }))}
        </div>
        <div class="card"><div class="ctitle">${ic("checks")}<h3>УХААН</h3></div>
          ${tbl(["Огноо","Нэр","Алба","Төлөв"], u.slice(0,12).map(x=>`<tr data-u="${esc(x.id)}" class="click"><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(albaN(x.alba))}</td><td>${stU(x)}</td></tr>`))}
        </div>`));
  app.addEventListener("click", e=>{ if(e.target.closest("[data-hzod]")){ HZF={...HZF, st:"od"}; } }, true);
  bindNav(app, e=>{ const b=e.target.closest("[data-open-hyg]"); if(b) hygEdit(today(), b.dataset.openHyg);
    const z=e.target.closest("[data-hzd]"); if(z){ hazardDetail(z.dataset.hzd); window.scrollTo(0,0); } });
}

function fatigueListPage(){
  if(!requireRole("hygiene")) return;
  view(fatigueListPage, true);
  const f=list("fatigue").sort(byNew);
  const app = mount(shell("ядаргаа", `${phead("Ядаргааны үнэлгээ", "Ажилтнуудын бөглөсөн үнэлгээ, шинээс нь")}<div class="card">
    ${tbl(["Огноо","Нэр","Алба","Оноо","Түвшин"], f.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(albaN(x.alba))}</td><td>${esc(x.score)}</td><td>${x.level==="Өндөр"?'<span class="badge b-bad">Өндөр</span>':x.level==="Дунд"?'<span class="badge b-wait">Дунд</span>':x.level==="Бага"?'<span class="badge b-ok">Бага</span>':esc(x.level)}</td></tr>`), "Ядаргааны үнэлгээ алга")}</div>`));
  bindNav(app);
}
/* ---------- Аюулын хяналт: жагсаалт + шүүлтүүр ---------- */
let HZF = {st:"all", risk:"", alba:"", who:"", q:"", from:"", to:""};
function hzVisible(u){
  const all = list("hazards").map(normHazard);
  if(u.role==="supervisor") return all.filter(x=>albaN(x.alba)===albaN(u.alba) || x.assignee===u.sap || !x.alba);
  return all;
}
function hzLogEntry(id, u, kind, text){
  const lid = uid();
  return ["hazards/"+id+"/log/"+lid, {ts:Date.now(), at:nowStr(), by:u.name||"", bySap:u.sap||"", kind, text:String(text).slice(0,600)}];
}
function hzStatusUpd(x, st, u){
  const upd = {["hazards/"+x.id+"/status"]: st};
  if(!HZ_OPEN(st) && HZ_OPEN(x.status)) upd["hazards/"+x.id+"/closedAt"] = today();
  if(HZ_OPEN(st)) upd["hazards/"+x.id+"/closedAt"] = null;
  const [p,v] = hzLogEntry(x.id, u, "status", `Төлөв: ${x.status} → ${st}`); upd[p]=v;
  return upd;
}
const staffList = ()=> users().filter(w=>w.role!=="worker").sort((a,b)=>a.name.localeCompare(b.name)).concat(workers().sort((a,b)=>a.name.localeCompare(b.name)));
function dueTxt(x){
  if(!x.due) return "";
  const d = daysBetween(today(), x.due);
  if(hzOverdue(x)) return `<span class="badge b-bad">${ic("clock","sm")} ${-d} хоног хэтэрсэн</span>`;
  if(HZ_OPEN(x.status) && d<=2) return `<span class="badge b-wait">${d===0?"Өнөөдөр дуусна":d+" хоног үлдсэн"}</span>`;
  return "";
}
function hazardListPage(){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  view(hazardListPage, true);
  const all = hzVisible(u).sort((a,b)=> (b.ts||0)-(a.ts||0) || byNew(a,b));
  const hyg = u.role==="hygiene";
  const cnt = {all:all.length, open:all.filter(x=>HZ_OPEN(x.status)).length, od:all.filter(hzOverdue).length};
  HZ_ST.forEach(s=>cnt[s]=all.filter(x=>x.status===s).length);
  const chip = (k,l)=>`<button type="button" class="fchip ${HZF.st===k?"on":""} ${k==="od"?"od":""}" data-fst="${esc(k)}" aria-pressed="${HZF.st===k}">${esc(l)} <b>${cnt[k]||0}</b></button>`;
  const assignees = [...new Map(all.filter(x=>x.assignee).map(x=>[x.assignee, x.assigneeName||x.assignee])).entries()];
  const app = mount(shell("аюул", `${phead("Аюулын мэдээлэл, хяналт", "OT-03-FRM-0001-D маягтаар ирсэн бүртгэл · хариуцагч, хугацаа, залруулах арга хэмжээ")}
    <div class="card filters noprint">
      <div class="fchips" role="group" aria-label="Төлөв">${chip("all","Бүгд")}${chip("open","Нээлттэй")}${HZ_ST.map(s=>chip(s,s)).join("")}${chip("od","Хугацаа хэтэрсэн")}</div>
      <div class="frow">
        <label class="fsearch">${ic("search","sm")}<input id="fq" type="search" placeholder="Хайх: газар, тайлбар, мэдээлэгч…" value="${esc(HZF.q)}" aria-label="Хайх"/></label>
        <select id="frisk" aria-label="Эрсдэл"><option value="">Бүх эрсдэл</option>${HZ_RISK.map(r=>`<option ${HZF.risk===r[0]?"selected":""}>${esc(r[0])}</option>`).join("")}</select>
        ${hyg?`<select id="falba" aria-label="Алба"><option value="">Бүх алба</option>${ALBA.map(a=>`<option ${HZF.alba===a?"selected":""}>${esc(a)}</option>`).join("")}</select>`:""}
        <select id="fwho" aria-label="Хариуцагч"><option value="">Бүх хариуцагч</option><option value="-" ${HZF.who==="-"?"selected":""}>Хариуцагчгүй</option>${assignees.map(([k,n])=>`<option value="${esc(k)}" ${HZF.who===k?"selected":""}>${esc(n)}</option>`).join("")}</select>
        <input type="date" id="ffrom" value="${esc(HZF.from)}" aria-label="Эхлэх огноо"/><input type="date" id="fto" value="${esc(HZF.to)}" aria-label="Дуусах огноо"/>
        <button type="button" class="btn ghost sm" id="freset">${ic("filter","sm")} Цэвэрлэх</button>
      </div>
    </div>
    <div id="hzl"></div>`));
  const draw = ()=>{
    const q = HZF.q.trim().toLowerCase();
    const h = all.filter(x=>
      (HZF.st==="all" || (HZF.st==="open" ? HZ_OPEN(x.status) : HZF.st==="od" ? hzOverdue(x) : x.status===HZF.st)) &&
      (!HZF.risk || x.risk===HZF.risk) && (!HZF.alba || albaN(x.alba)===HZF.alba) &&
      (!HZF.who || (HZF.who==="-" ? !x.assignee : x.assignee===HZF.who)) &&
      (!HZF.from || x.date>=HZF.from) && (!HZF.to || x.date<=HZF.to) &&
      (!q || [x.area,x.det,x.act,x.reporter,x.reviewer,x.acc,x.assigneeName,x.corr].join(" ").toLowerCase().includes(q)));
    $("#hzl").innerHTML = `<p class="muted">${h.length} / ${all.length} бүртгэл</p>` + (h.map(x=>`<div class="card hzcard ${hzOverdue(x)?"overdue":""}">
      <div class="row-between"><b>${ic("map","sm")} ${esc(x.date)} · ${esc(x.area)}</b><span class="row-gap">${dueTxt(x)}${stH(x.status)}</span></div>
      <div class="hzmeta">${x.risk?`<span class="tagp risk ${HZ_HIGH(x.risk)?"hi":""}">Эрсдэл: ${esc(x.risk)}</span>`:""}<span class="tagp">${esc((x.types||[]).join(", "))} ${x.cls?.length?"· "+esc(x.cls.join(", ")):""}</span>${x.via==="qr"?`<span class="tagp">${ic("qr","sm")} QR</span>`:""}</div>
      <p class="det">${esc(x.det||"")}</p>
      ${x.act?`<p class="muted"><b>Авсан арга хэмжээ:</b> ${esc(x.act)}</p>`:""}
      ${x.corr?`<p class="muted"><b>Залруулах арга хэмжээ:</b> ${esc(x.corr)}</p>`:""}
      <div class="people"><span>Мэдээлэгч: <b>${esc(x.reporter||"—")}</b></span><span>Хянасан: <b>${esc(x.reviewer||"—")}</b></span><span>Хариуцах: <b>${esc(x.acc||"—")}</b></span>
        <span>${ic("userCheck","sm")} Хариуцагч: <b>${esc(x.assigneeName||"—")}</b></span><span>${ic("calendar","sm")} Хугацаа: <b>${esc(x.due||"—")}</b></span></div>
      <div class="thumbs" data-ph="${esc(x.id)}">${x.photoCount?`<span class="muted">Зураг ачаалж байна… (${esc(x.photoCount)})</span>`:""}</div>
      <div class="row-gap">
        <select data-st="${esc(x.id)}" aria-label="Төлөв">${HZ_ST.map(s=>`<option ${s===x.status?"selected":""}>${s}</option>`).join("")}</select>
        <button class="btn sm" data-hzd="${esc(x.id)}">${ic("history","sm")} Хянах / түүх${x.log?` (${Object.keys(x.log).length})`:""}</button>
        <button class="btn ghost sm" data-prhz="${esc(x.id)}">${ic("printer","sm")} Хэвлэх</button>
        ${hyg?`<button class="btn warn sm" data-delhz="${esc(x.id)}">${ic("trash","sm")} Устгах</button>`:""}
      </div>
    </div>`).join("") || `<div class="card">${emptyState(all.length?"Шүүлтүүрт тохирох бүртгэл алга":"Аюулын мэдээлэл алга", all.length?"Шүүлтүүрээ өөрчилж үзнэ үү":"Ажилтнууд «Аюулыг мэдээлэх» маягтаар илгээнэ","alert")}</div>`);
    $$("[data-ph]").forEach(async el=>{
      const ps = await getPhotos(el.dataset.ph);
      el.innerHTML = ps.slice(0,8).map(p=>`<img src="${esc(p)}" alt="Аюулын зураг" loading="lazy">`).join("") || "";
    });
  };
  draw();
  bindNav(app, e=>{
    const f=e.target.closest("[data-fst]"); if(f){ HZF.st=f.dataset.fst; $$("[data-fst]").forEach(b=>{ b.classList.toggle("on", b===f); b.setAttribute("aria-pressed", b===f); }); draw(); return; }
    if(e.target.closest("#freset")){ HZF={st:"all", risk:"", alba:"", who:"", q:"", from:"", to:""}; hazardListPage(); return; }
    const dt=e.target.closest("[data-hzd]"); if(dt){ hazardDetail(dt.dataset.hzd); window.scrollTo(0,0); return; }
    const pr=e.target.closest("[data-prhz]"); if(pr){ hazardPrint(pr.dataset.prhz); return; }
    const d=e.target.closest("[data-delhz]");
    if(d && confirm("Энэ аюулын бүртгэлийг устгах уу?")){ write({["hazards/"+d.dataset.delhz]:null, ["photos/"+d.dataset.delhz]:null}); toast("Устгалаа"); }
  });
  app.oninput = e=>{ if(e.target.id==="fq"){ HZF.q=e.target.value; draw(); } };
  app.onchange = e=>{
    const s=e.target.closest("[data-st]");
    if(s){ const x=normHazard(DB.hazards[s.dataset.st]); if(x && x.status!==s.value) write(hzStatusUpd(x, s.value, u)); return; }
    const m={frisk:"risk", falba:"alba", fwho:"who", ffrom:"from", fto:"to"}[e.target.id];
    if(m){ HZF[m]=e.target.value; draw(); }
  };
}
/* ---------- Аюулын дэлгэрэнгүй: хариуцагч, хугацаа, залруулах арга хэмжээ, түүх ---------- */
async function hazardDetail(id){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  const raw = DB.hazards[id]; if(!raw){ toast("Олдсонгүй"); return hazardListPage(); }
  const x = normHazard(raw);
  view(()=>hazardDetail(id), false);
  const logs = Object.values(x.log||{}).filter(Boolean).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const people = staffList();
  const LOGIC = {status:"check", assign:"userCheck", due:"calendar", corr:"edit", note:"file"};
  const app = mount(shell("аюул", `
    <div class="row-between wrap"><div>${phead(esc(x.area||"Аюул"), `${esc(x.date)} · Мэдээлэгч: ${esc(x.reporter||"—")}${x.via==="qr"?" · QR кодоор":""}`)}</div>
      <div class="row-gap noprint"><button class="btn ghost sm" id="hb">${ic("back","sm")} Жагсаалт</button><button class="btn ghost sm" id="hp">${ic("printer","sm")} Маягт хэвлэх</button></div></div>
    <div class="hzgrid">
      <div class="card hzcard ${hzOverdue(x)?"overdue":""}">
        <div class="row-between"><span class="row-gap">${stH(x.status)}${dueTxt(x)}</span>${x.risk?`<span class="tagp risk ${HZ_HIGH(x.risk)?"hi":""}">Эрсдэл: ${esc(x.risk)}</span>`:""}</div>
        <div class="hzmeta"><span class="tagp">${esc((x.types||[]).join(", "))} ${x.cls?.length?"· "+esc(x.cls.join(", ")):""}</span></div>
        <p class="det">${esc(x.det||"")}</p>
        ${x.act?`<p class="muted"><b>Авсан шуурхай арга хэмжээ:</b> ${esc(x.act)}</p>`:""}
        <div class="people"><span>Хянасан: <b>${esc(x.reviewer||"—")}</b></span><span>Хариуцах хэлтэс: <b>${esc(x.acc||"—")}</b></span>${x.closedAt?`<span>Хаасан/шийдсэн: <b>${esc(x.closedAt)}</b></span>`:""}</div>
        <div class="thumbs" id="dph"></div>
      </div>
      <form class="card" id="hzt">
        <div class="ctitle">${ic("userCheck")}<h3>Хяналт, залруулах арга хэмжээ</h3></div>
        <div class="g2">
          <div><label class="f" for="tst">Төлөв</label><select id="tst">${HZ_ST.map(s=>`<option ${s===x.status?"selected":""}>${s}</option>`).join("")}</select></div>
          <div><label class="f" for="tdue">Гүйцэтгэх хугацаа</label><input type="date" id="tdue" value="${esc(x.due||"")}"/></div>
        </div>
        <label class="f" for="tas">Хариуцагч</label>
        <select id="tas"><option value="">— хариуцагчгүй —</option>${people.map(w=>`<option value="${esc(w.sap)}" ${w.sap===x.assignee?"selected":""}>${esc(w.name)} · ${esc(roleName(w.role))}${w.alba?" · "+esc(albaN(w.alba)):""}</option>`).join("")}</select>
        <label class="f" for="tcorr">Залруулах арга хэмжээ (төлөвлөгөө / гүйцэтгэл)</label>
        <textarea id="tcorr" maxlength="1000" rows="4" placeholder="Юу хийх, хэрхэн арилгах, урьдчилан сэргийлэх…">${esc(x.corr||"")}</textarea>
        <label class="f" for="tnote">Тэмдэглэл нэмэх (түүхэнд бичигдэнэ)</label>
        <textarea id="tnote" maxlength="600" rows="2" placeholder="Жишээ: Засварын хүсэлт илгээсэн"></textarea>
        <div class="actions"><button class="btn" type="submit">${ic("check")} Хадгалах</button></div>
      </form>
    </div>
    <div class="card"><div class="ctitle">${ic("history")}<h3>Түүх</h3><span class="muted">${logs.length} бичлэг</span></div>
      <ol class="timeline">${logs.map(l=>`<li><span class="tdot">${ic(LOGIC[l.kind]||"file","sm")}</span><div><b>${esc(l.text)}</b><span class="muted">${esc(l.by||"")} · ${esc(l.at||"")}</span></div></li>`).join("")}
        <li><span class="tdot">${ic("send","sm")}</span><div><b>Мэдээлэл ирсэн</b><span class="muted">${esc(x.reporter||"Нэргүй")} · ${esc(x.created||x.date||"")}</span></div></li></ol>
    </div>`));
  bindNav(app, e=>{
    if(e.target.closest("#hb")) hazardListPage();
    if(e.target.closest("#hp")) hazardPrint(id);
  });
  app.onsubmit = e=>{
    e.preventDefault();
    const cur = normHazard(DB.hazards[id]||{}); if(!cur.id){ toast("Олдсонгүй"); return; }
    let upd = {};
    const st=$("#tst").value, due=$("#tdue").value, as=$("#tas").value, corr=$("#tcorr").value.trim(), note=$("#tnote").value.trim();
    const add = (k,t)=>{ const [p,v]=hzLogEntry(id,u,k,t); upd[p]=v; };
    if(st!==cur.status) upd = {...upd, ...hzStatusUpd(cur, st, u)};
    if(due!==(cur.due||"")){ upd["hazards/"+id+"/due"]=due||null; add("due", `Хугацаа: ${cur.due||"—"} → ${due||"—"}`); }
    if(as!==(cur.assignee||"")){ const w=DB.users[keyOf(as)]; upd["hazards/"+id+"/assignee"]=as||null; upd["hazards/"+id+"/assigneeName"]=w?w.name:null; add("assign", `Хариуцагч: ${cur.assigneeName||"—"} → ${w?w.name:"—"}`); }
    if(corr!==(cur.corr||"")){ upd["hazards/"+id+"/corr"]=corr||null; add("corr", "Залруулах арга хэмжээ: "+(corr||"(хоосолсон)")); }
    if(note) add("note", note);
    if(!Object.keys(upd).length){ toast("Өөрчлөлт алга"); return; }
    write(upd); toast("Хадгаллаа"); hazardDetail(id);
  };
  const ps = await getPhotos(id); const el=$("#dph");
  if(el) el.innerHTML = ps.slice(0,8).map(p=>`<img src="${esc(p)}" alt="Аюулын зураг" loading="lazy">`).join("");
}
const VERDICT = {huleegdej:"Хүлээгдэж байна", orjbolno:"Орж болно", ersdel:"Ажилд оруулахгүй"};
function infectListPage(){
  if(!requireRole("hygiene")) return;
  view(infectListPage, true);
  const inf=list("infect").sort(byNew);
  const app = mount(shell("халдвар", `${phead("Халдвар — үр дүн гаргах", "Ажилтан зөвхөн бөглөсөн. Орж болно / оруулахгүй-г эндээс та тогтооно.")}
    ${inf.map(x=>{ const v = x.verdict && VERDICT[x.verdict] ? x.verdict : "huleegdej"; return `<div class="card">
      <div class="hello"><span class="avatar" aria-hidden="true">${esc(initials(x.name))}</span><div><b>${esc(x.name)}</b><div class="muted">${esc(x.date)} · ${esc(x.sap)} · ${esc(albaN(x.alba))}</div></div></div>
      <div class="qa">${arr(x.ans).map(a=>`<div class="item inl"><p>${esc(a.q)}</p><b>${esc(a.a)}</b></div>`).join("")}</div>
      <label class="f">Үр дүн</label>
      <select data-inf="${esc(x.id)}" class="v-${v}">${Object.entries(VERDICT).map(([k,l])=>`<option value="${k}" ${k===v?"selected":""}>${l}</option>`).join("")}</select>
    </div>`;}).join("")||`<div class="card">${emptyState("Халдварын асуумж алга","Хуваарьтай ажилтан ирэх өдрөө бөглөнө","virus")}</div>`}`));
  bindNav(app);
  app.onchange = e=>{
    const s=e.target.closest("[data-inf]");
    if(s){ write({["infect/"+s.dataset.inf+"/verdict"]: s.value}); toast("Хадгаллаа"); }
  };
}
function bookPage(){
  if(!requireRole("hygiene")) return;
  view(bookPage, true);
  const ws=workers().sort((a,b)=>String(a.bookExp||"9").localeCompare(String(b.bookExp||"9")));
  const app = mount(shell("дэвтэр", `${phead("Цагаан дэвтэр / жилийн шинжилгээ", "Дуусах хугацаагаар эрэмбэлсэн")}<div class="card">
    ${tbl(["Нэр","SAP","Алба","Дэвтэр","Шинжилгээ"], ws.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(w.sap)}</td><td>${esc(albaN(w.alba))}</td><td>${esc(w.bookExp||"—")} ${expBadge(w.bookExp)}</td><td>${esc(w.exam||"—")} ${expBadge(w.exam)}</td></tr>`))}</div>`));
  bindNav(app);
}
function rosterPage(){
  if(!requireRole("hygiene")) return;
  view(rosterPage, true);
  const ws=workers().sort((a,b)=>a.name.localeCompare(b.name));
  const rs=list("roster").sort((a,b)=>String(b.arrive).localeCompare(String(a.arrive)));
  const app = mount(shell("хуваарь", `${phead("Талбарын хуваарь", "Ажилтны ирэх / гарах өдөр")}
    <form class="card" id="rf">
      <div class="g3">
        <div><label class="f" for="rsap">Ажилтан</label><select id="rsap">${ws.map(u=>`<option value="${esc(u.sap)}">${esc(u.name)} (${esc(u.sap)}) · ${esc(albaN(u.alba))}</option>`).join("")}</select></div>
        <div><label class="f" for="arrive">Ирэх өдөр</label><input type="date" id="arrive" value="${today()}" required/></div>
        <div><label class="f" for="leave">Гарах өдөр</label><input type="date" id="leave"/></div>
      </div>
      <div class="gap"></div><button class="btn" type="submit">${ic("plus")} Нэмэх</button>
    </form>
    <div class="card">${tbl(["Ирэх","Нэр","Алба","Гарах",""], rs.map(x=>{ const w=DB.users[keyOf(x.sap)];
      return `<tr><td>${esc(x.arrive)}</td><td>${esc(x.name)}</td><td>${esc(albaN(w?.alba))}</td><td>${esc(x.leave||"")}</td><td><button class="btn warn sm" data-delr="${esc(x.id)}">${ic("trash","sm")} Устгах</button></td></tr>`;}), "Хуваарь бүртгээгүй байна")}</div>`));
  bindNav(app, e=>{
    const d=e.target.closest("[data-delr]");
    if(d && confirm("Хуваарийг устгах уу?")) write({["roster/"+d.dataset.delr]: null});
  });
  app.onsubmit = e=>{
    e.preventDefault();
    const u=DB.users[keyOf($("#rsap").value)]; if(!u) return;
    const arrive=$("#arrive").value, leave=$("#leave").value;
    if(leave && leave<arrive){ toast("Гарах өдөр ирэх өдрөөс өмнө байна"); return; }
    const id=keyOf(u.sap+"_"+arrive);
    write({["roster/"+id]: {id, sap:u.sap, name:u.name, arrive, leave}});
    toast("Нэмлээ");
  };
}

/* ======================= АЖИЛТНУУД ======================= */
function usersPage(editSap){
  const meU = requireRole("hygiene"); if(!meU) return;
  view(()=>usersPage(), !editSap);
  const all = users().sort((a,b)=>(a.role+a.name).localeCompare(b.role+b.name));
  const ed = editSap ? DB.users[keyOf(editSap)] : null;
  const opt = (vals, cur) => vals.map(v=>`<option value="${esc(v[0])}" ${v[0]===cur?"selected":""}>${esc(v[1])}</option>`).join("");
  const app = mount(shell("ажилтан", `${phead("Ажилтнууд", "Хэрэглэгч нэмэх, засах, Excel-ээр оруулах")}
    <form class="card" id="uf">
      <div class="ctitle">${ic(ed?"edit":"plus")}<h3>${ed?"Засах: "+esc(ed.name):"Шинэ ажилтан"}</h3></div>
      <div class="g3">
        <div><label class="f" for="usap">SAP / нэвтрэх нэр *</label><input id="usap" required value="${esc(ed?.sap||"")}" ${ed?"readonly":""}/></div>
        <div><label class="f" for="unm">Нэр *</label><input id="unm" required value="${esc(ed?.name||"")}"/></div>
        <div><label class="f" for="urole">Үүрэг</label><select id="urole">${opt([["worker","Ажилтан"],["supervisor","Ахлах"],["hygiene","Эрүүл ахуйч"]], ed?.role||"worker")}</select></div>
        <div><label class="f" for="ualba">Алба</label><select id="ualba">${opt(ALBA.map(a=>[a,a]), albaN(ed?.alba)||"Бар")}</select></div>
        <div><label class="f" for="ugender">Хүйс</label><select id="ugender">${opt([["Эр","Эр"],["Эм","Эм"]], ed?.gender||"Эр")}</select></div>
        <div><label class="f" for="ujob">Албан тушаал / ажил</label><input id="ujob" value="${esc(ed?.job||"")}"/></div>
        <div><label class="f" for="upin">${ed?"Нууц үг шинэчлэх (хоосон бол хэвээр)":"Нууц үг *"} ${CLOUD_AUTH?"· ≥6":""}</label><input id="upin" type="password" autocomplete="new-password" ${ed?"":"required"} minlength="${CLOUD_AUTH?6:4}"/></div>
        <div><label class="f" for="ubook">Цагаан дэвтэр дуусах</label><input type="date" id="ubook" value="${esc(ed?.bookExp||"")}"/></div>
        <div><label class="f" for="uexam">Жилийн шинжилгээ дуусах</label><input type="date" id="uexam" value="${esc(ed?.exam||"")}"/></div>
      </div>
      <div class="gap"></div>
      <div class="row-gap"><button class="btn" type="submit">Хадгалах</button>${ed?'<button class="btn ghost" type="button" id="ucancel">Болих</button>':""}</div>
    </form>
    <div class="card"><div class="ctitle">${ic("users")}<h3>Бүх хэрэглэгч (${all.length})</h3></div>
    ${CLOUD_AUTH?`<p class="muted">Нэвтрэлт: <b>${all.filter(u=>u.uid).length}/${all.length}</b> шинэ (Firebase) нэвтрэлт рүү шилжсэн. Шилжээгүй хэрэглэгч хуучин PIN-ээрээ анх нэвтрэхэд автоматаар шилжинэ.</p>`:""}
    ${tbl(["Нэр","SAP","Үүрэг","Алба","Албан тушаал",...(CLOUD_AUTH?["Нэвтрэлт"]:[]),""], all.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.sap)}</td><td>${esc(roleName(u.role))}</td><td>${esc(albaN(u.alba))}</td><td>${esc(u.job||"")}</td>${CLOUD_AUTH?`<td>${u.uid?'<span class="badge b-ok">Шилжсэн</span>':u.pinHash?'<span class="badge b-wait">Хуучин PIN</span>':'<span class="badge b-bad">Нууц үггүй</span>'}</td>`:""}
      <td class="nowrap"><button class="btn ghost sm" data-edit="${esc(u.sap)}">${ic("edit","sm")} Засах</button> ${u.sap===meU.sap?"":`<button class="btn warn sm" data-delu="${esc(u.sap)}">${ic("trash","sm")} Устгах</button>`}</td></tr>`))}
    </div>
    <div class="card"><div class="ctitle">${ic("sheet")}<h3>Excel-ээр оруулах</h3></div>
      <p class="muted">Багана: SAP, Нэр, Алба, Хүйс, Ажил, Нууц үг, Цагаан дэвтэр, Шинжилгээ</p>
      <button class="btn ghost" id="tmpl" type="button">${ic("download")} Загвар татах</button>
      <div class="gap"></div>
      <input type="file" id="ximp" accept=".xlsx"/>
      <div id="ximperr" class="muted"></div>
      <button class="btn" id="ximpok" type="button">Шалгаад оруулах</button>
    </div>`));
  bindNav(app, e=>{
    const ebtn=e.target.closest("[data-edit]"); if(ebtn){ usersPage(ebtn.dataset.edit); window.scrollTo(0,0); return; }
    const d=e.target.closest("[data-delu]");
    if(d && confirm("Хэрэглэгчийг устгах уу? ("+d.dataset.delu+")")){ const du=DB.users[keyOf(d.dataset.delu)]; write({["users/"+keyOf(d.dataset.delu)]: null, ...(du&&du.uid?{["roles/"+du.uid]: null}:{})}); toast("Устгалаа"); }
  });
  if($("#ucancel")) $("#ucancel").onclick = ()=>usersPage();
  app.onsubmit = async e=>{
    e.preventDefault();
    const sap=$("#usap").value.trim(), pin=$("#upin").value.trim();
    if(!validKey(sap)){ toast("SAP-д . # $ [ ] / тэмдэгт орж болохгүй"); return; }
    if(!ed && DB.users[keyOf(sap)]){ toast("SAP давхардсан"); return; }
    const rec = {...(ed||{}), sap, name:$("#unm").value.trim(), role:$("#urole").value, alba:(ed && albaN(ed.alba)===$("#ualba").value) ? ed.alba : $("#ualba").value, gender:$("#ugender").value,
      job:$("#ujob").value.trim(), bookExp:$("#ubook").value, exam:$("#uexam").value};
    delete rec.pin;
    if(!CLOUD_AUTH){
      if(pin && pin.length<4){ toast("Нууц үг дор хаяж 4 тэмдэгт"); return; }
      if(pin){ rec.pinHash = await hashPin(sap, pin); delete rec.mustChange; }
      write({["users/"+keyOf(sap)]: rec});
      toast("Хадгаллаа"); usersPage(); return;
    }
    // Firebase Auth горим
    const k = keyOf(sap); const upd = {};
    if(pin){
      if(pin.length<6){ toast("Нууц үг дор хаяж 6 тэмдэгт"); return; }
      if(!authSapOk(k)){ toast("SAP зөвхөн латин үсэг, тоо, - _ байна (нэвтрэлтэд)"); return; }
      if(navigator.onLine===false){ toast("Хэрэглэгчийн нэвтрэлт үүсгэхэд интернэт шаардлагатай"); return; }
      const btn = $("#uf button[type=submit]"); btn.disabled = true; btn.textContent = "Үүсгэж байна…";
      try{
        const a = await createAuthAccount(k, pin);
        if(ed && ed.uid && ed.uid!==a.uid) upd["roles/"+ed.uid] = null;   // хуучин бүртгэл эрхгүй болно
        upd["roles/"+a.uid] = {sap:k, role:rec.role, by:meU.sap, at:Date.now()};
        if(a.gen) upd["authgen/"+k] = a.gen;
        rec.uid = a.uid; rec.mustChange = true; delete rec.pinHash;
      }catch(ex){ console.warn("create auth", ex); toast("Нэвтрэлт үүсгэж чадсангүй: "+(ex.code||ex.message)); btn.disabled=false; btn.textContent="Хадгалах"; return; }
    } else if(!ed){ toast("Нууц үг оруулна уу"); return; }
    else if(ed.uid && ed.role!==rec.role) upd["roles/"+ed.uid+"/role"] = rec.role;
    upd["users/"+k] = rec;
    write(upd);
    toast(pin?"Хадгаллаа · нэвтрэх эрх үүслээ":"Хадгаллаа"); usersPage();
  };
  let pending=null;
  $("#tmpl").onclick=async ()=>{
    if(typeof ExcelJS==="undefined"){ toast("Excel сан ачаалагдаагүй байна"); return; }
    const wb=new ExcelJS.Workbook(); const s=wb.addWorksheet("Ажилтан");
    s.addRow(["SAP","Нэр","Алба","Хүйс","Ажил","Нууц үг","Цагаан дэвтэр","Шинжилгээ"]);
    s.addRow(["50019999","Жишээ Нэр","Бар","Эр","Тогооч","","2026-12-31","2026-11-01"]);
    downloadWb(wb, "EAHS_ajiltan_zagvar.xlsx");
  };
  $("#ximp").onchange=async e=>{
    const f=e.target.files[0]; if(!f) return;
    if(typeof ExcelJS==="undefined"){ toast("Excel сан ачаалагдаагүй байна"); return; }
    const wb=new ExcelJS.Workbook();
    try{ await wb.xlsx.load(await f.arrayBuffer()); }catch(err){ $("#ximperr").innerHTML="<div class='warnbox'>Файл уншиж чадсангүй</div>"; return; }
    const sh=wb.worksheets[0]; const rows=[]; const errs=[];
    const cell = (row,i)=>{ const v=row.getCell(i).value; return v&&typeof v==="object"&&"text" in v? String(v.text).trim() : String(v==null?"":v).trim(); };
    sh.eachRow((row,i)=>{
      if(i===1) return;
      const sap=cell(row,1), name=cell(row,2), alba=cell(row,3), gender=cell(row,4), job=cell(row,5), pin=cell(row,6);
      if(!sap) { errs.push(i+"-р мөр: SAP хоосон"); return; }
      if(!validKey(sap)) { errs.push(i+"-р мөр: SAP буруу тэмдэгттэй"); return; }
      if(!name) { errs.push(i+"-р мөр: Нэр хоосон"); return; }
      if(alba && !ALBA.includes(alba)) errs.push(i+"-р мөр: Алба «"+alba+"» → «"+albaN(alba)+"» болгож хадгална (Оффис / Бар)");
      if(gender && gender!=="Эр" && gender!=="Эм") errs.push(i+"-р мөр: Хүйс Эр/Эм биш");
      if(CLOUD_AUTH && (pin.length<6 || !authSapOk(sap))){ errs.push(i+"-р мөр: "+(!authSapOk(sap)?"SAP латин үсэг/тоо биш":"нууц үг 6-аас богино")+" — алгасна"); return; }
      if(!pin) errs.push(i+"-р мөр: Нууц үг хоосон — «1234» болно, солиулна уу");
      rows.push({sap,name,role:"worker",alba:alba?albaN(alba):"Оффис",gender:gender==="Эм"?"Эм":"Эр",job,pin:pin||"1234",
        bookExp:excelDate(row.getCell(7).value),exam:excelDate(row.getCell(8).value)});
    });
    pending=rows;
    $("#ximperr").innerHTML = (errs.length?("<div class='warnbox'>"+errs.map(esc).join("<br>")+"</div>"):"<div class='muted'>Алдаагүй.</div>")+"<div class='muted'>"+rows.length+" мөр бэлэн.</div>";
  };
  $("#ximpok").onclick=async ()=>{
    if(!pending||!pending.length){ toast("Файл сонгоно уу"); return; }
    const skip=[]; const upd={};
    for(const p of pending){
      if(DB.users[keyOf(p.sap)]) { skip.push(p.sap); continue; }
      if(CLOUD_AUTH){
        try{ const a = await createAuthAccount(keyOf(p.sap), p.pin); const rec={...p, uid:a.uid, mustChange:true}; delete rec.pin;
          upd["users/"+keyOf(p.sap)] = rec; upd["roles/"+a.uid] = {sap:keyOf(p.sap), role:"worker", by:meU.sap, at:Date.now()}; if(a.gen) upd["authgen/"+keyOf(p.sap)] = a.gen; }
        catch(ex){ console.warn("import auth", ex); skip.push(p.sap+" (нэвтрэлт үүсээгүй)"); }
        continue;
      }
      const rec={...p, pinHash: await hashPin(p.sap, p.pin)}; delete rec.pin;
      upd["users/"+keyOf(p.sap)] = rec;
    }
    if(Object.keys(upd).length) write(upd);
    alert("Орлоо: "+Object.keys(upd).filter(k=>k.startsWith("users/")).length + (skip.length?" · алгассан SAP: "+skip.join(", "):""));
    usersPage();
  };
}
function excelDate(v){
  if(v==null||v==="") return "";
  if(v instanceof Date) return ymd(v);
  if(typeof v==="number"){ const d=new Date(Math.round((v-25569)*86400*1000)); return d.toISOString().slice(0,10); }
  return String(v).slice(0,10);
}

/* ======================= ТАЙЛАН, ГРАФИК (inline SVG) ======================= */
const CH_COL = {blue:"#1747C8", blue2:"#7FA0EE", ok:"#157A3E", warn:"#E08A00", bad:"#C1272D", vio:"#5B3FD1", gray:"#A9B3C4", sun:"#FCC419"};
const RISK_COL = {"Бага":CH_COL.ok, "Дунд зэрэг":CH_COL.sun, "Их":CH_COL.warn, "Маш их":CH_COL.bad};
const ST_COL = {"Шинэ":CH_COL.blue, "Хийгдэж буй":CH_COL.warn, "Шийдсэн":CH_COL.ok, "Хаасан":CH_COL.gray};
let REPF = null;
function periodKey(d, g){ if(!d) return ""; const y=d.slice(0,4), m=+d.slice(5,7); return g==="q" ? `${y} Q${Math.ceil(m/3)}` : d.slice(0,7); }
function periodList(from, to, g){
  const out=[]; let y=+from.slice(0,4), m=+from.slice(5,7); const ey=+to.slice(0,4), em=+to.slice(5,7);
  while(y<ey || (y===ey && m<=em)){ const k=periodKey(`${y}-${String(m).padStart(2,"0")}-01`, g); if(out[out.length-1]!==k) out.push(k); if(++m>12){m=1;y++;} if(out.length>60) break; }
  return out;
}
const periodLabel = (k,g)=> g==="q" ? k : (["","1-р","2-р","3-р","4-р","5-р","6-р","7-р","8-р","9-р","10-р","11-р","12-р"][+k.slice(5,7)]+" сар"+(k.slice(5,7)==="01"?" "+k.slice(0,4):""));
/* Багана график (stacked) */
function svgBars(cats, series, opt={}){
  const W=640, H=opt.h||220, pl=34, pr=10, pt=12, pb=34, iw=W-pl-pr, ih=H-pt-pb;
  const tot = cats.map((_,i)=>series.reduce((s,se)=>s+(se.data[i]||0),0));
  const max = Math.max(1, ...tot); const step = Math.max(1, Math.ceil(max/4));
  const top = step*Math.ceil(max/step); const bw = Math.min(46, iw/cats.length*0.62);
  let g=""; for(let v=0; v<=top; v+=step){ const y=pt+ih-ih*v/top; g+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" class="gl"/><text x="${pl-6}" y="${y+4}" class="ax" text-anchor="end">${v}</text>`; }
  let b=""; cats.forEach((c,i)=>{ const cx = pl + iw*(i+.5)/cats.length; let acc=0;
    series.forEach(se=>{ const v=se.data[i]||0; if(!v) return; const h=ih*v/top; const y=pt+ih-ih*(acc+v)/top; acc+=v;
      b+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${se.color}" rx="2"><title>${esc(c.l)} · ${esc(se.name)}: ${v}</title></rect>`; });
    if(tot[i]) b+=`<text x="${cx}" y="${pt+ih-ih*tot[i]/top-4}" class="vl" text-anchor="middle">${tot[i]}</text>`;
    b+=`<text x="${cx}" y="${H-pb+16}" class="ax" text-anchor="middle">${esc(c.l)}</text>`; });
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.title||"")}">${g}${b}</svg>${legend(series)}</figure>`;
}
/* Шугаман график (2 тэнхлэггүй, 0..max) */
function svgLine(cats, series, opt={}){
  const W=640, H=opt.h||200, pl=34, pr=10, pt=14, pb=34, iw=W-pl-pr, ih=H-pt-pb;
  const vals = series.flatMap(s=>s.data.filter(v=>v!=null)); const max = opt.max || Math.max(1, ...vals);
  let g=""; [0,.25,.5,.75,1].forEach(f=>{ const y=pt+ih-ih*f; g+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" class="gl"/><text x="${pl-6}" y="${y+4}" class="ax" text-anchor="end">${+(max*f).toFixed(1)}</text>`; });
  const X = i=> pl + iw*(cats.length===1?.5:i/(cats.length-1));
  let l=""; series.forEach(se=>{ const pts = se.data.map((v,i)=>v==null?null:[X(i), pt+ih-ih*v/max]);
    let d=""; pts.forEach((p,i)=>{ if(!p) return; d += (d && pts[i-1] ? "L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1); });
    l+=`<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    pts.forEach((p,i)=>{ if(p) l+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="#fff" stroke="${se.color}" stroke-width="2"><title>${esc(cats[i].l)} · ${esc(se.name)}: ${se.data[i]}</title></circle>`; }); });
  cats.forEach((c,i)=> l+=`<text x="${X(i)}" y="${H-pb+16}" class="ax" text-anchor="middle">${esc(c.l)}</text>`);
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.title||"")}">${g}${l}</svg>${legend(series)}</figure>`;
}
/* Хэвтээ багана */
function hbars(items){
  const max = Math.max(1, ...items.map(i=>i.v));
  return `<div class="hbars">${items.map(i=>`<div class="hb"><span>${esc(i.k)}</span><i><b style="width:${(100*i.v/max).toFixed(1)}%;background:${i.color||CH_COL.blue}"></b></i><em>${i.v}</em></div>`).join("")}</div>`;
}
const legend = series => series.length>1 ? `<figcaption class="legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</figcaption>` : "";
function reportsPage(){
  const u = requireRole("hygiene"); if(!u) return;
  view(reportsPage, true);
  if(!REPF){ const d=new Date(); d.setMonth(d.getMonth()-5); REPF = {from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: today(), g:"m", alba:""}; }
  const F = REPF; const inR = x=> x && x.date && x.date>=F.from && x.date<=F.to && (!F.alba || albaN(x.alba)===F.alba);
  const per = periodList(F.from, F.to, F.g); const cats = per.map(k=>({k, l:periodLabel(k,F.g)}));
  const idx = k=> per.indexOf(k); const zero = ()=> per.map(()=>0);
  // аюул
  const hz = list("hazards").map(normHazard).filter(inR);
  const riskSeries = HZ_RISK.map(([r])=>({name:r, color:RISK_COL[r], data:zero()}));
  const noRisk = {name:"Тодорхойгүй", color:CH_COL.gray, data:zero()};
  hz.forEach(x=>{ const i=idx(periodKey(x.date,F.g)); if(i<0) return; const s=riskSeries.find(s=>s.name===x.risk)||noRisk; s.data[i]++; });
  const typeCnt = HZ_TYPES.map(([t])=>({k:t, v:hz.filter(x=>(x.types||[]).includes(t)).length}));
  const stCnt = HZ_ST.map(s=>({k:s, v:hz.filter(x=>x.status===s).length, color:ST_COL[s]}));
  const clsCnt = HZ_CLS.map(([c])=>({k:c, v:hz.filter(x=>(x.cls||[]).includes(c)).length})).filter(x=>x.v).sort((a,b)=>b.v-a.v).slice(0,8);
  const od = hz.filter(hzOverdue).length;
  // ядаргаа
  const fa = list("fatigue").filter(inR);
  const fAvg = zero(), fN = zero(), fHi = zero();
  fa.forEach(x=>{ const i=idx(periodKey(x.date,F.g)); if(i<0) return; fN[i]++; fAvg[i]+= +x.score||0; if(x.level==="Өндөр") fHi[i]++; });
  const avg = fAvg.map((s,i)=> fN[i]? +(s/fN[i]).toFixed(1) : null);
  // ариун цэврийн зөрчил
  const hc = list("hygcheck").filter(inR);
  const hFail = zero(), hOk = zero(), hInc = zero(); const critFail = HYG_CRIT.map(()=>0);
  hc.forEach(h=>{ const i=idx(periodKey(h.date,F.g)); if(i<0) return; rowsOf(h).forEach(r=>{ const st=rowStatus(r);
    (st==="fail"?hFail:st==="ok"?hOk:hInc)[i]++; HYG_CRIT.forEach((_,ci)=>{ if(cellVal(r,ci)==="no") critFail[ci]++; }); }); });
  // халдвар
  const inf = list("infect").filter(inR);
  const vS = [["orjbolno",CH_COL.ok],["ersdel",CH_COL.bad],["huleegdej",CH_COL.gray]].map(([k,c])=>({name:VERDICT[k], color:c, key:k, data:zero()}));
  inf.forEach(x=>{ const i=idx(periodKey(x.date,F.g)); if(i<0) return; (vS.find(s=>s.key===(x.verdict||"huleegdej"))||vS[2]).data[i]++; });
  const sum = (a)=>a.reduce((s,v)=>s+v,0);
  const rows = sum(hFail)+sum(hOk)+sum(hInc);
  const kpi = (cls,icn,t,v,s)=>`<div class="kpi ${cls}"><i>${ic(icn)}</i><div>${t}<b>${v}</b><span class="muted">${s}</span></div></div>`;
  const sec = (icn,t,body,extra="")=>`<section class="card rsec"><div class="ctitle">${ic(icn)}<h3>${t}</h3>${extra}</div>${body}</section>`;
  const app = mount(shell("тайлан", `
    <div class="rep">
    <div class="rephead">${phead("Тайлан, график", `${esc(F.from)} — ${esc(F.to)} · ${F.g==="q"?"Улирлаар":"Сараар"} · ${esc(F.alba||"Бүх алба")}`)}
      <img class="replogo" src="/logo.png" alt="Ерөө говь ХХК"/></div>
    <form class="card filters noprint" id="rf">
      <div class="frow">
        <div><label class="f" for="rfrom">Эхлэх</label><input type="date" id="rfrom" value="${esc(F.from)}" required/></div>
        <div><label class="f" for="rto">Дуусах</label><input type="date" id="rto" value="${esc(F.to)}" required/></div>
        <div><label class="f" for="rg">Хугацааны нэгж</label><select id="rg"><option value="m" ${F.g==="m"?"selected":""}>Сараар</option><option value="q" ${F.g==="q"?"selected":""}>Улирлаар</option></select></div>
        <div><label class="f" for="ralba">Алба</label><select id="ralba"><option value="">Бүх алба</option>${ALBA.map(a=>`<option ${F.alba===a?"selected":""}>${esc(a)}</option>`).join("")}</select></div>
        <div class="end row-gap"><button type="button" class="btn ghost sm" data-rq="3">3 сар</button><button type="button" class="btn ghost sm" data-rq="12">12 сар</button><button type="button" class="btn sm" id="rprint">${ic("printer","sm")} Хэвлэх</button></div>
      </div>
    </form>
    <div class="kpis">
      ${kpi("k-org","alert","Аюулын мэдээлэл",hz.length,`их/маш их: ${hz.filter(x=>HZ_HIGH(x.risk)).length}`)}
      ${kpi("k-red "+(od?"hot":""),"clock","Хугацаа хэтэрсэн",od,`нээлттэй: ${hz.filter(x=>HZ_OPEN(x.status)).length}`)}
      ${kpi("k-blu","battery","Ядаргааны асуумж",fa.length,`өндөр: ${sum(fHi)}`)}
      ${kpi("k-grn","drop","Ариун цэврийн шалгалт",rows,`ажиллахгүй: ${sum(hFail)}${rows?` (${Math.round(100*sum(hFail)/rows)}%)`:""}`)}
      ${kpi("k-vio","virus","Халдварын асуумж",inf.length,`оруулахгүй: ${sum(vS[1].data)}`)}
    </div>
    ${sec("alert","Аюулын мэдээлэл — эрсдлийн түвшингээр", hz.length? svgBars(cats, [...riskSeries, ...(sum(noRisk.data)?[noRisk]:[])], {title:"Аюул эрсдлээр"}) : emptyState("Энэ хугацаанд аюулын мэдээлэл алга","","alert"))}
    <div class="rgrid">
      ${sec("filter","Аюулын төрөл", hbars(typeCnt))}
      ${sec("check","Төлөв", hbars(stCnt))}
    </div>
    ${clsCnt.length? sec("map","Аюулын ангилал (эхний 8)", hbars(clsCnt)) : ""}
    ${sec("battery","Ядаргааны чиг хандлага", fa.length? svgLine(cats, [{name:"Дундаж оноо (0–12)", color:CH_COL.blue, data:avg}], {max:12, title:"Ядаргааны дундаж оноо"}) + svgBars(cats, [{name:"Өндөр ядаргаа", color:CH_COL.bad, data:fHi}, {name:"Бусад", color:CH_COL.blue2, data:fN.map((n,i)=>n-fHi[i])}], {h:170, title:"Ядаргааны асуумж"}) : emptyState("Ядаргааны асуумж алга","","battery"))}
    ${sec("drop","Ариун цэврийн шалгалт — зөрчил", rows? svgBars(cats, [{name:"Ажиллахгүй", color:CH_COL.bad, data:hFail}, {name:"Хангасан", color:CH_COL.ok, data:hOk}, {name:"Бүрэн бус", color:CH_COL.gray, data:hInc}], {title:"Ариун цэврийн шалгалт"})
        + `<h4 class="rsub">Үзүүлэлтээр хангаагүй тоо</h4>` + hbars(HYG_CRIT.map((c,i)=>({k:c, v:critFail[i], color:CH_COL.bad}))) : emptyState("Ариун цэврийн бүртгэл алга","","drop"))}
    ${sec("virus","Халдварын асуумжийн дүгнэлт", inf.length? svgBars(cats, vS, {title:"Халдвар"}) : emptyState("Халдварын асуумж алга","","virus"))}
    <p class="muted repfoot">Гаргасан: ${esc(u.name)} · ${esc(nowStr())} · ЭАХС — Ерөө говь ХХК</p>
    </div>`));
  bindNav(app, e=>{
    const q=e.target.closest("[data-rq]"); if(q){ const d=new Date(); d.setMonth(d.getMonth()-(+q.dataset.rq-1)); REPF={...REPF, from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: today()}; reportsPage(); return; }
    if(e.target.closest("#rprint")) window.print();
  });
  app.onchange = e=>{
    if(!e.target.closest("#rf")) return;
    const from=$("#rfrom").value, to=$("#rto").value;
    if(!from || !to || from>to){ toast("Огнооны муж буруу"); return; }
    REPF = {from, to, g:$("#rg").value, alba:$("#ralba").value}; reportsPage();
  };
}

/* ======================= QR КОД ======================= */
let _qrLib = null;
function loadQr(){
  if(window.qrcode) return Promise.resolve(window.qrcode);
  return _qrLib ||= new Promise((res, rej)=>{ const s=document.createElement("script"); s.src="/vendor/qrcode.js"; s.onload=()=>res(window.qrcode); s.onerror=()=>{ _qrLib=null; rej(new Error("qr")); }; document.head.appendChild(s); });
}
const qrUrl = area => location.origin + "/?hazard&area=" + encodeURIComponent(area);
function qrSvg(text, cls="qrsvg"){
  const q = window.qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4; let d = "";
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(q.isDark(r,c)) d += `M${c+m} ${r+m}h1v1h-1z`;
  return `<svg class="${cls}" viewBox="0 0 ${n+2*m} ${n+2*m}" shape-rendering="crispEdges" role="img" aria-label="QR: ${esc(text)}"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
const qrAreas = ()=> { const s = DB.settings.qr; const extra = Array.isArray(s?.areas) ? s.areas : Object.values(s?.areas||{});
  return [...new Set([...ALBA, ...extra.filter(a=>typeof a==="string" && a.trim())])]; };
async function qrPage(){
  const u = requireRole("hygiene"); if(!u) return;
  view(qrPage, true);
  const app = mount(shell("qr", `${phead("QR код — аюул мэдээлэх", "Талбай бүрт наах QR. Уншуулахад «Аюулыг мэдээлэх» маягт тухайн газар бөглөгдсөн нээгдэнэ.")}<div id="qrb"><p class="muted">Ачаалж байна…</p></div>`));
  try{ await loadQr(); }catch{ $("#qrb").innerHTML = `<div class="card">${emptyState("QR сан ачаалагдсангүй","Сүлжээгээ шалгаад дахин оролдоно уу","qr")}</div>`; return; }
  if(VIEW.fn!==qrPage || !$("#qrb")) return;
  const areas = qrAreas(); const extra = areas.filter(a=>!ALBA.includes(a));
  $("#qrb").innerHTML = `
    <form class="card" id="qadd"><div class="ctitle">${ic("map")}<h3>Талбай нэмэх</h3></div>
      <div class="frow"><input id="qnew" maxlength="60" placeholder="Жишээ: Агуулах №2, Гал тогоо" aria-label="Шинэ талбайн нэр"/><button class="btn" type="submit">${ic("plus","sm")} Нэмэх</button></div>
      <p class="muted">Алба: ${ALBA.map(esc).join(", ")} үргэлж жагсаалтад байна (зөвхөн 2 алба).</p></form>
    <form class="card" id="qsel"><div class="ctitle">${ic("qr")}<h3>Хэвлэх стикер сонгох</h3><span class="muted">A4 хуудсанд 8 стикер (2×4)</span></div>
      <div class="qrgrid">${areas.map(a=>`<label class="qritem"><input type="checkbox" value="${esc(a)}" checked/>${qrSvg(qrUrl(a))}<b>${esc(a)}</b>
        <span class="row-gap"><input type="number" min="1" max="24" value="1" data-copies="${esc(a)}" aria-label="${esc(a)} хувь"/> хувь
        ${extra.includes(a)?`<button type="button" class="btn ghost sm" data-qdel="${esc(a)}" aria-label="${esc(a)} устгах">${ic("trash","sm")}</button>`:""}</span>
        <a class="muted qrlink" href="${esc(qrUrl(a))}" target="_blank" rel="noopener">${esc(qrUrl(a))}</a></label>`).join("")}</div>
      <div class="actions"><button class="btn" type="submit">${ic("printer")} A4 стикер хуудас</button></div></form>`;
  const saveAreas = list=> write({"settings/qr": {areas: list}});
  app.onsubmit = e=>{
    e.preventDefault();
    if(e.target.id==="qadd"){ const v=$("#qnew").value.trim().replace(/\s+/g," "); if(!v) return;
      if(qrAreas().includes(v)){ toast("Аль хэдийн байна"); return; } saveAreas([...extra, v]); toast("Нэмлээ"); qrPage(); return; }
    const pick = $$("#qsel input[type=checkbox]:checked").map(c=>c.value);
    if(!pick.length){ toast("Талбай сонгоно уу"); return; }
    const items = pick.flatMap(a=>{ const n=Math.min(24, Math.max(1, +($(`[data-copies="${CSS.escape(a)}"]`)?.value)||1)); return Array(n).fill(a); });
    qrPrint(items);
  };
  bindNav(app, e=>{ const d=e.target.closest("[data-qdel]"); if(d){ e.preventDefault(); if(confirm(`«${d.dataset.qdel}» талбайг устгах уу?`)){ saveAreas(extra.filter(a=>a!==d.dataset.qdel)); qrPage(); } } });
}
async function qrPrint(items){
  if(!requireRole("hygiene")) return;
  await loadQr();
  view(()=>qrPrint(items), false);
  const pages = []; for(let i=0;i<items.length;i+=8) pages.push(items.slice(i,i+8));
  const app = mount(`
    <div class="printbar noprint"><button class="btn sm" id="pp">${ic("printer","sm")} Хэвлэх (A4)</button><button class="btn ghost sm" id="pb">${ic("back","sm")} QR код</button><span class="muted">${items.length} стикер · ${pages.length} хуудас</span></div>
    <div class="sheet-wrap"><div class="qrsheet">${pages.map(p=>`<section class="qrpage">${p.map(a=>`<div class="qrst">
      <div class="qrst-h"><img src="/logo.png" alt="Ерөө говь ХХК"/><div><b>АЮУЛЫГ МЭДЭЭЛ</b><span>Report a hazard</span></div></div>
      <div class="qrst-b">${qrSvg(qrUrl(a), "qrsvg big")}<div class="qrst-t"><small>Талбай / Area</small><b>${esc(a)}</b><p>Утасныхаа камераар уншуулж, харсан аюулаа шууд мэдээлнэ үү.</p><i>Нэвтрэх шаардлагагүй · OT-03</i></div></div>
      </div>`).join("")}</section>`).join("")}</div></div>`);
  $("#pp").onclick = ()=>window.print();
  $("#pb").onclick = ()=>qrPage();
}

/* ======================= МЭДЭГДЭЛ ======================= */
const seenKey = ()=> LS+"seen_"+(session ? keyOf(session.sap) : "");
function notifList(){
  const u = me(); if(!u || u.role==="worker") return [];
  return list("notifs").filter(n=> n && n.id && (u.role==="hygiene" || !n.alba || albaN(n.alba)===albaN(u.alba))).sort((a,b)=>(b.ts||0)-(a.ts||0));
}
const readSet = ()=> new Set(lsGet(seenKey(), []) || []);
function markRead(ids){ const r=readSet(); ids.forEach(i=>r.add(i)); lsSet(seenKey(), [...r].slice(-800)); }
function unreadCount(){ const r=readSet(); return notifList().filter(n=>!r.has(n.id)).length; }
/* Шинэ мэдэгдэл ирэхэд: апп доторх toast + хөтчийн мэдэгдэл (зөвшөөрсөн бол) */
function onNotifs(){
  const u = me(); if(!u || u.role==="worker") return;
  const k = LS+"lastpush_"+keyOf(u.sap);
  const ns = notifList(); const maxTs = ns.reduce((m,n)=>Math.max(m, n.ts||0), 0);
  const last = lsGet(k, null);
  if(last==null){ lsSet(k, maxTs); return; }          // анх ачаалахад хуучныг дуугаргахгүй
  const fresh = ns.filter(n=>(n.ts||0)>last && n.bySap!==u.sap);
  if(maxTs>last) lsSet(k, maxTs);
  if(!fresh.length) return;
  toast(ic("bell","sm")+" "+fresh[0].title, true);
  fresh.slice(0,3).forEach(showBrowserNotif);
}
async function showBrowserNotif(n){
  if(!("Notification" in window) || Notification.permission!=="granted") return;
  const opts = {body: n.body||"", icon:"/icon-192.png", badge:"/icon-192.png", tag:"eahs-"+n.id, data:{url:"/?n="+encodeURIComponent(n.id)}};
  try{
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if(reg && reg.showNotification){ await reg.showNotification(n.title, opts); return; }
  }catch(e){ console.warn("sw notif", e && e.message); }
  try{ const nn = new Notification(n.title, opts); nn.onclick = ()=>{ window.focus(); openNotif(n.id); }; }catch(e){ console.warn("notif", e && e.message); }
}
function openNotif(id){
  const n = (DB.notifs||{})[id]; if(!n) return notifPage();
  markRead([id]);
  if(n.type==="hazard" && DB.hazards[n.ref]) return hazardDetail(n.ref);
  if(n.type==="hygfail" && DB.hygcheck[n.ref]){ const h=DB.hygcheck[n.ref]; return hygEdit(h.date, h.alba, h.id); }
  notifPage();
}
const NLEVEL = {critical:["Маш их эрсдэл","b-bad","alert"], high:["Их эрсдэл","b-wait","alert"], fail:["Ажиллахгүй","b-bad","drop"]};
function notifPage(){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  view(notifPage, true);
  const ns = notifList(); const r = readSet();
  const perm = !("Notification" in window) ? "none" : Notification.permission;
  const permHtml = perm==="granted" ? `<span class="badge b-ok">Хөтчийн мэдэгдэл асаалттай</span>`
    : perm==="denied" ? `<span class="badge b-bad">Хөтчийн мэдэгдлийг хориглосон — хөтчийн тохиргооноос зөвшөөрнө</span>`
    : perm==="none" ? `<span class="badge b-wait">Энэ хөтөч мэдэгдэл дэмжихгүй</span>`
    : `<button class="btn sm" id="nperm">${ic("bell","sm")} Хөтчийн мэдэгдэл асаах</button>`;
  const app = mount(shell("мэдэгдэл", `${phead("Мэдэгдэл", u.role==="supervisor"?`${esc(albaN(u.alba))} — их/маш их эрсдэлтэй аюул, «Ажиллахгүй» ажилтан`:"Их/маш их эрсдэлтэй аюул, «Ажиллахгүй» ажилтан")}
    <div class="card row-between wrap nperm"><div class="row-gap">${permHtml}</div>
      <button class="btn ghost sm" id="nall" ${ns.some(n=>!r.has(n.id))?"":"disabled"}>${ic("checks","sm")} Бүгдийг уншсан</button></div>
    <p class="muted">Апп нээлттэй (эсвэл таб далд) үед мэдэгдэл ирнэ. Апп хаалттай үед ирэх «push» мэдэгдэлд сервер шаардлагатай.</p>
    <div class="card nlist">${ns.map(n=>{ const L=NLEVEL[n.level]||["Мэдэгдэл","b-new","bell"]; const un=!r.has(n.id);
      return `<button class="nitem ${un?"unread":""}" data-nid="${esc(n.id)}"><span class="nic ${esc(n.level||"")}">${ic(L[2])}</span>
        <span class="nbody"><b>${esc(n.title||"")}</b><span>${esc(n.body||"")}</span><small>${esc(n.by||"")} · ${n.ts?esc(new Date(n.ts).toLocaleString("mn-MN")):""}${n.alba?" · "+esc(albaN(n.alba)):""}</small></span>
        <span class="badge ${L[1]}">${esc(L[0])}</span></button>`; }).join("") || emptyState("Мэдэгдэл алга","Их эрсдэлтэй аюул эсвэл «Ажиллахгүй» тэмдэглэгдэхэд энд гарна","bell")}</div>`));
  bindNav(app, async e=>{
    const it=e.target.closest("[data-nid]"); if(it){ openNotif(it.dataset.nid); return; }
    if(e.target.closest("#nall")){ markRead(ns.map(n=>n.id)); notifPage(); return; }
    if(e.target.closest("#nperm")){
      try{ const p = await Notification.requestPermission(); if(p==="granted"){ toast("Мэдэгдэл асаалаа"); showBrowserNotif({id:"test", title:"ЭАХС мэдэгдэл асаалттай", body:"Их эрсдэлтэй аюул, «Ажиллахгүй» ажилтны мэдээлэл энд ирнэ."}); } }
      catch(err){ console.warn("perm", err); }
      notifPage();
    }
  });
}

/* ======================= ТОХИРГОО ======================= */
/* Нууц үг солих — бүх үүрэгт (ажилтан ч мөн) */
function pwFormHtml(u){
  return `<form class="card" id="pf">
      <div class="ctitle">${ic("key")}<h3>Нууц үг солих</h3></div>
      ${u.mustChange?'<div class="warnbox">Анхны нууц үгээ заавал солино уу.</div>':""}
      <input type="text" name="username" value="${esc(u.sap)}" autocomplete="username" hidden/>
      <label class="f" for="op">Одоогийн нууц үг</label><input type="password" id="op" autocomplete="current-password" required/>
      <label class="f" for="np">Шинэ нууц үг (дор хаяж 6)</label><input type="password" id="np" autocomplete="new-password" minlength="6" required/>
      <label class="f" for="np2">Шинэ нууц үг давтах</label><input type="password" id="np2" autocomplete="new-password" minlength="6" required/>
      <div class="gap"></div><button class="btn" type="submit">Солих</button>
    </form>`;
}
async function changePassword(form){
  const cur = me(); if(!cur) return false;
  const op = $("#op").value.trim(), np = $("#np").value.trim();
  if(np!==$("#np2").value.trim()){ toast("Шинэ нууц үг таарахгүй байна"); return false; }
  if(np.length<6){ toast("Шинэ нууц үг дор хаяж 6 тэмдэгт"); return false; }
  if(CLOUD_AUTH && session && session.local){ toast("Нууц үг солиход интернэт шаардлагатай"); return false; }
  if(CLOUD_AUTH && _auth.currentUser && !_auth.currentUser.isAnonymous){
    const cu = _auth.currentUser;
    try{
      await cu.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(cu.email, fbPw(op)));
      await cu.updatePassword(np);
    }catch(ex){ console.warn("pw", ex && ex.code); toast(/wrong-password|invalid-credential|invalid-login/.test(ex.code||"")?"Одоогийн нууц үг буруу":"Солиж чадсангүй: "+(ex.code||"")); return false; }
    await rememberOffline(keyOf(cur.sap), cur.role, np);
    if(cur.mustChange) write({["users/"+keyOf(cur.sap)+"/mustChange"]: null});
    toast("Нууц үг солигдлоо"); form.reset(); return true;
  }
  if((await hashPin(cur.sap,op))!==cur.pinHash){ toast("Одоогийн нууц үг буруу"); return false; }
  write({["users/"+keyOf(cur.sap)+"/pinHash"]: await hashPin(cur.sap,np), ["users/"+keyOf(cur.sap)+"/mustChange"]: null});
  toast("Нууц үг солигдлоо"); form.reset(); return true;
}
function workerPwPage(){
  const u = me(); if(!u) return landing();
  view(workerPwPage, false);
  const app = mount(`${appbar("ЭАХС · Ажилтан", esc(albaN(u.alba)))}
    <main class="page"><button class="btn ghost sm" id="wb">${ic("back","sm")} Буцах</button><div class="gap"></div>${pwFormHtml(u)}</main>`);
  $("#wb").onclick = workerHome;
  app.onsubmit = async e=>{ e.preventDefault(); if(await changePassword(e.target)) setTimeout(workerHome, 900); };
}
function settingsPage(){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  view(settingsPage, false);
  const s=settings(); const hyg = u.role==="hygiene";
  const app = mount(shell("тохиргоо", `${phead("Тохиргоо")}
    ${hyg?`<form class="card" id="sf">
      <div class="ctitle">${ic("sliders")}<h3>Ерөнхий</h3></div>
      <label class="f" for="fd">Ядаргаа хэд хоногт 1</label><input type="number" min="1" max="60" id="fd" value="${esc(s.fatigueDays)}"/>
      <label class="f" for="bl">Баримт дуусахад</label>
      <select id="bl"><option value="0">Зөвхөн анхааруул</option><option value="1" ${s.blockExpired?"selected":""}>Хоригло</option></select>
      <div class="gap"></div><button class="btn" type="submit">Хадгалах</button>
    </form>`:""}
    ${pwFormHtml(u)}`));
  bindNav(app);
  app.onsubmit = async e=>{
    e.preventDefault();
    if(e.target.id==="sf"){ write({"settings/main": {fatigueDays:Math.max(1,+$("#fd").value||7), blockExpired:$("#bl").value==="1"}}); toast("Хадгаллаа"); return; }
    if(e.target.id==="pf") await changePassword(e.target);
  };
}

/* ======================= АРИУН ЦЭВРИЙН ХЯНАЛТ ======================= */
const sheetId = (date, alba) => keyOf(date+"_"+alba);
const cellVal = (r,i) => (r && r.c && r.c[i]) || "";
const cellSym = v => v==="ok"?"√":v==="no"?"X":"";
function rowStatus(r){
  const vs = HYG_CRIT.map((_,i)=>cellVal(r,i));
  if(vs.includes("no")) return "fail";
  if(vs.every(v=>v==="ok")) return "ok";
  return vs.some(Boolean) ? "partial" : "empty";
}
function rowsOf(h){ return Object.entries(h?.rows||{}).filter(([,r])=>r).map(([rk,r])=>({rk,...r})).sort((a,b)=>(a.ord||0)-(b.ord||0)); }
/* Тухайн өдөр талбарт байгаа (хуваарьтай) ажилтнууд */
function activeRoster(date, alba){
  return list("roster").filter(x=>x.arrive && x.arrive<=date && (!x.leave || date<=x.leave))
    .map(x=>({x, u:DB.users[keyOf(x.sap)]})).filter(o=>o.u && (!alba || albaN(o.u.alba)===albaN(alba)));
}
/* Уртын ээлжийн эхний өдрөөс эхлэн 2 өдөрт 1 удаа */
const isDueDay = (rosterEntry, date) => daysBetween(rosterEntry.arrive, date) % 2 === 0;
function hygDue(date, alba){
  const res = {total:0, done:0, byAlba:{}};
  const daySheets = list("hygcheck").filter(h=>h.date===date);
  activeRoster(date, alba).filter(o=>isDueDay(o.x, date)).forEach(o=>{
    const a = albaN(o.u.alba); const b = res.byAlba[a] = res.byAlba[a] || {total:0, done:0};
    const done = daySheets.filter(h=>albaN(h.alba)===a).some(h=>rowsOf(h).some(r=>r.sap===o.u.sap && rowStatus(r)!=="empty"));
    res.total++; b.total++; if(done){ res.done++; b.done++; }
  });
  return res;
}
function hygDueCard(alba){
  const d = hygDue(today(), alba);
  const albas = alba ? [albaN(alba)] : ALBA;
  return `<div class="card due"><div class="ctitle">${ic("drop")}<h3>Ариун цэврийн хяналт — өнөөдөр</h3><span class="muted">2 өдөрт 1 удаа (ээлжийн 1-р өдрөөс)</span></div>
    <div class="duegrid">${albas.map(a=>{ const b=d.byAlba[a]||{total:0,done:0}; const left=b.total-b.done;
      return `<button class="duebox ${left>0?"warn":b.total?"ok":""}" data-open-hyg="${esc(a)}"><b>${esc(a)}</b>
        <span>${b.total?`${b.done}/${b.total} бүртгэсэн`:"Өнөөдөр бүртгэх хүнгүй"}</span>${left>0?`<em>${left} үлдсэн</em>`:""}</button>`;}).join("")}</div></div>`;
}
function hygListPage(){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  view(hygListPage, true);
  const sup = u.role==="supervisor";
  const sheets = list("hygcheck").filter(h=>!sup || albaN(h.alba)===albaN(u.alba)).sort(byNew);
  const app = mount(shell("ариун", `${phead(esc(HYG_TITLE), "Огноо, албаа сонгоод хуудсаа нээнэ")}
    <form class="card" id="hf">
      <div class="g3">
        <div><label class="f" for="hd">Огноо</label><input type="date" id="hd" value="${today()}" required/></div>
        <div><label class="f" for="ha">Алба</label><select id="ha" ${sup?"disabled":""}>${ALBA.map(a=>`<option ${a===(sup?albaN(u.alba):"Бар")?"selected":""}>${esc(a)}</option>`).join("")}</select></div>
        <div class="end"><button class="btn" type="submit">Хуудас нээх / бөглөх</button></div>
      </div>
    </form>
    ${hygDueCard(sup?u.alba:null)}
    <div class="card"><div class="ctitle">${ic("file")}<h3>Бүртгэсэн хуудсууд</h3></div>
    ${tbl(["Огноо","Алба","Ажилтан","Хангаагүй","Шалгасан",""], sheets.map(h=>{ const rs=rowsOf(h); const bad=rs.filter(r=>rowStatus(r)==="fail").length;
      return `<tr><td>${esc(h.date)}</td><td>${esc(albaN(h.alba))}</td><td>${rs.length}</td><td>${bad?`<span class="badge b-bad">${bad}</span>`:'<span class="badge b-ok">0</span>'}</td>
      <td>${h.checkedBy?esc(h.checkedBy):'<span class="muted">—</span>'}</td>
      <td class="nowrap"><button class="btn sm" data-he="${esc(h.id)}">Засах</button> <button class="btn ghost sm" data-hp="${esc(h.id)}">${ic("printer","sm")} Хэвлэх</button>${sup?"":` <button class="btn warn sm" data-hdel="${esc(h.id)}">${ic("trash","sm")} Устгах</button>`}</td></tr>`;}), "Одоогоор хуудас бүртгээгүй")}
    </div>`));
  bindNav(app, e=>{
    const o=e.target.closest("[data-open-hyg]"); if(o){ hygEdit(today(), o.dataset.openHyg); return; }
    const he=e.target.closest("[data-he]"); if(he){ const h=DB.hygcheck[he.dataset.he]; if(h) hygEdit(h.date, h.alba, h.id); return; }
    const hp=e.target.closest("[data-hp]"); if(hp){ hygPrint(hp.dataset.hp); return; }
    const hd=e.target.closest("[data-hdel]");
    if(hd && confirm("Энэ хуудсыг устгах уу?")){ write({["hygcheck/"+hd.dataset.hdel]: null}); toast("Устгалаа"); }
  });
  app.onsubmit = e=>{ e.preventDefault(); hygEdit($("#hd").value||today(), sup?u.alba:$("#ha").value); };
}

function hygEdit(date, alba, sid){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  // Хуучин нэртэй (жишээ нь «Оюут баар») хадгалсан хуудсыг id-аар нь нээнэ; шинэ хуудас «Оффис»/«Бар»
  const old = sid && DB.hygcheck[sid] ? DB.hygcheck[sid] : null;
  alba = albaN(u.role==="supervisor" ? u.alba : (old ? old.alba : alba)) || "Бар";
  if(old && u.role==="supervisor" && albaN(old.alba)!==alba){ toast("Энэ хуудас таны албанд хамаарахгүй"); return hygListPage(); }
  view(()=>hygEdit(date, alba, sid), false);
  const id = old ? sid : sheetId(date, alba);
  const orig = DB.hygcheck[id];
  const storeAlba = orig?.alba || alba;  // хадгалсан албаны нэрийг дарж бичихгүй
  const isNew = !orig;
  const W = { id, date, alba, checkedBy: orig?.checkedBy || "", checkedAt: orig?.checkedAt || "", rows: rowsOf(orig).map(r=>({...r, c: HYG_CRIT.map((_,i)=>cellVal(r,i))})) };
  const dirty = new Set(), dirtySign = new Set(), removed = new Set();
  let ordSeq = W.rows.reduce((m,r)=>Math.max(m, r.ord||0), 0);
  const rosterOn = activeRoster(date, alba);
  const dueMap = Object.fromEntries(rosterOn.map(o=>[o.u.sap, isDueDay(o.x, date)]));
  const addWorker = w => {
    if(W.rows.some(r=>r.sap && r.sap===w.sap)) return false;
    const rk = keyOf(w.sap); removed.delete(rk);
    W.rows.push({rk, sap:w.sap, name:w.name, pos:w.job||"", c:HYG_CRIT.map(()=>""), sign:false, ord:++ordSeq}); dirty.add(rk); return true;
  };
  if(isNew) rosterOn.sort((a,b)=>a.u.name.localeCompare(b.u.name)).forEach(o=>addWorker(o.u));
  if(!W.checkedBy && u.role==="supervisor") W.checkedBy = u.name;

  const app = mount(shell("ариун", `<div id="hedit"></div>`));
  const box = $("#hedit");
  function draw(){
    const albaWorkers = users().filter(w=>albaN(w.alba)===alba && w.role!=="hygiene" && !W.rows.some(r=>r.sap===w.sap)).sort((a,b)=>a.name.localeCompare(b.name));
    const failN = W.rows.filter(r=>rowStatus(r)==="fail").length;
    box.innerHTML = `
      <div class="row-between wrap"><div><h2 class="ptitle">${esc(HYG_TITLE)}</h2>
        <p class="muted">Огноо: <b>${esc(date)}</b> · Алба: <b>${esc(alba)}</b> · ${isNew?"Шинэ хуудас":"Хадгалсан хуудас"} · ${W.rows.length} ажилтан ${failN?`· <span class="badge b-bad">${failN} ажиллахгүй</span>`:""}</p></div>
        <div class="row-gap"><button class="btn ghost sm" data-act="back">${ic("back","sm")} Жагсаалт</button><button class="btn ghost sm" data-act="print">${ic("printer","sm")} Хэвлэх</button></div></div>
      <div class="legend"><span><i class="ck ck-ok">√</i> Шаардлага хангасан</span><span><i class="ck ck-no">X</i> Хангаагүй</span><span>Нүдийг дарж солино: хоосон → √ → X</span></div>
      <div class="tw hygtw"><table class="hyg">
        <thead><tr><th rowspan="2">№</th><th rowspan="2">Ажилтны нэр</th><th rowspan="2">Албан тушаал</th><th colspan="${HYG_CRIT.length}">Үзүүлэлт</th><th rowspan="2">Ажилтны гарын үсэг</th><th rowspan="2"></th></tr>
        <tr>${HYG_CRIT.map(c=>`<th class="crit">${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${W.rows.map((r,i)=>{ const st=rowStatus(r); const due = r.sap && dueMap[r.sap];
          return `<tr class="${st==="fail"?"fail":""}" data-rk="${esc(r.rk)}">
            <td data-l="№" class="num">${i+1}</td>
            <td data-l="Ажилтны нэр"><input class="cin" data-f="name" value="${esc(r.name||"")}" aria-label="Ажилтны нэр"/>
              ${due===true?'<small class="tag due">Бүртгэх өдөр</small>':due===false?'<small class="tag">2 өдөрт 1 — өнөөдөр заавал биш</small>':""}</td>
            <td data-l="Албан тушаал"><input class="cin" data-f="pos" value="${esc(r.pos||"")}" aria-label="Албан тушаал"/></td>
            ${HYG_CRIT.map((c,ci)=>{ const v=r.c[ci]; return `<td data-l="${esc(c)}" class="cc"><button type="button" class="ck ${v?"ck-"+v:""}" data-ci="${ci}" aria-label="${esc(c)}: ${v==="ok"?"хангасан":v==="no"?"хангаагүй":"тэмдэглээгүй"}">${cellSym(v)}</button></td>`; }).join("")}
            <td data-l="Гарын үсэг" class="cc"><label class="sign"><input type="checkbox" data-f="sign" ${r.sign?"checked":""}/> <span>${r.sign?"Танилцсан":"—"}</span></label></td>
            <td class="acts"><span class="st">${st==="fail"?'<span class="badge b-bad">Ажиллахгүй</span>':st==="ok"?'<span class="badge b-ok">Хангасан</span>':""}</span>
              <button type="button" class="btn ghost sm" data-all>Бүгд √</button><button type="button" class="btn ghost sm" data-del aria-label="Мөр устгах">✕</button></td>
          </tr>`; }).join("") || `<tr><td colspan="${HYG_CRIT.length+5}" class="muted">Мөр алга. Доороос ажилтан нэмнэ үү.${rosterOn.length?"":" (Энэ өдөр энэ албанд хуваарьтай ажилтан алга.)"}</td></tr>`}</tbody>
      </table></div>
      <div class="card addrow">
        <div class="g3">
          <div><label class="f" for="addw">Ажилтан нэмэх</label><select id="addw"><option value="">— сонгох —</option>${albaWorkers.map(w=>`<option value="${esc(w.sap)}">${esc(w.name)} (${esc(w.sap)})${dueMap[w.sap]===true?" · бүртгэх өдөр":""}</option>`).join("")}</select></div>
          <div class="end"><button type="button" class="btn ghost" data-act="addroster">Хуваарийн бүх ажилтныг нэмэх</button></div>
          <div class="end"><button type="button" class="btn ghost" data-act="addmanual">+ Гараар мөр нэмэх</button></div>
        </div>
      </div>
      <div class="card">
        <div class="g3">
          <div><label class="f" for="chk">Шалгасан (Ахлах ажилтан)</label><input id="chk" value="${esc(W.checkedBy)}" placeholder="Нэр"/></div>
          <div class="end"><button type="button" class="btn ghost" data-act="confirm">${ic("check")} Шалгасан гэж батлах</button></div>
          <div class="end muted">${W.checkedAt?"Баталсан: "+esc(W.checkedAt):""}</div>
        </div>
        <div class="notes"><b>Анхаарах:</b><ul>${HYG_NOTES.map(n=>`<li>${esc(n)}</li>`).join("")}</ul></div>
      </div>
      <div class="savebar"><button type="button" class="btn" data-act="save">${ic("check")} Хадгалах</button><button type="button" class="btn ghost" data-act="saveprint">${ic("printer")} Хадгалаад хэвлэх</button></div>`;
  }
  const rowOf = el => { const tr=el.closest("tr[data-rk]"); return tr ? W.rows.find(r=>r.rk===tr.dataset.rk) : null; };
  function save(silent){
    const base = "hygcheck/"+id;
    const upd = { [base+"/id"]:id, [base+"/date"]:date, [base+"/alba"]:storeAlba, [base+"/checkedBy"]:W.checkedBy||"", [base+"/checkedAt"]:W.checkedAt||"",
      [base+"/_u"]:Date.now(), [base+"/updatedBy"]:u.name };
    if(isNew && !DB.hygcheck[id]) upd[base+"/createdBy"] = u.name;
    W.rows.forEach(r=>{
      const rp = base+"/rows/"+r.rk;
      if(dirty.has(r.rk)){ upd[rp+"/sap"]=r.sap||""; upd[rp+"/name"]=r.name||""; upd[rp+"/pos"]=r.pos||""; upd[rp+"/ord"]=r.ord||0; upd[rp+"/c"]=r.c.slice(); }
      if(dirtySign.has(r.rk)){ upd[rp+"/sign"]=!!r.sign; upd[rp+"/signAt"]=r.sign?(r.signAt||nowStr()):""; }
    });
    removed.forEach(rk=>upd[base+"/rows/"+rk]=null);
    // Шинээр «Ажиллахгүй» болсон ажилтнууд → мэдэгдэл
    const prev = DB.hygcheck[id]?.rows || {};
    const newFail = W.rows.filter(r=>rowStatus(r)==="fail" && rowStatus(prev[r.rk])!=="fail" && (r.name||r.sap));
    if(newFail.length){
      const nid = keyOf("hf_"+id+"_"+Date.now().toString(36));
      upd["notifs/"+nid] = {id:nid, type:"hygfail", level:"fail", ts:Date.now(), alba, ref:id, by:u.name, bySap:u.sap,
        title: ("Ажиллахгүй: "+newFail.map(r=>r.name||r.sap).join(", ")).slice(0,180),
        body: (alba+" · "+date+" — ариун цэврийн шаардлага хангаагүй: "+newFail.map(r=>HYG_CRIT.filter((c,i)=>r.c[i]==="no").join("; ")).join(" | ")).slice(0,280)};
    }
    write(upd);
    dirty.clear(); dirtySign.clear(); removed.clear();
    if(!silent) toast("Хадгаллаа");
  }
  const hasChanges = ()=> dirty.size || dirtySign.size || removed.size || (W.checkedBy!==(DB.hygcheck[id]?.checkedBy||""));
  app.oninput = e=>{
    const f=e.target.dataset.f; if(f==="name"||f==="pos"){ const r=rowOf(e.target); if(r){ r[f]=e.target.value; dirty.add(r.rk);} }
    if(e.target.id==="chk") W.checkedBy=e.target.value;
  };
  bindNav(app, e=>{
    const ck=e.target.closest(".ck[data-ci]");
    if(ck){ const r=rowOf(ck); const ci=+ck.dataset.ci; r.c[ci] = r.c[ci]===""?"ok":r.c[ci]==="ok"?"no":""; dirty.add(r.rk); draw(); return; }
    if(e.target.closest("[data-all]")){ const r=rowOf(e.target); r.c=HYG_CRIT.map(()=>"ok"); dirty.add(r.rk); draw(); return; }
    if(e.target.closest("[data-del]")){ const r=rowOf(e.target); if(r && confirm("Мөрийг устгах уу? ("+(r.name||"")+")")){ W.rows=W.rows.filter(x=>x!==r); dirty.delete(r.rk); removed.add(r.rk); draw(); } return; }
    const sg=e.target.closest('input[data-f="sign"]');
    if(sg){ const r=rowOf(sg); r.sign=sg.checked; r.signAt=sg.checked?nowStr():""; dirtySign.add(r.rk); draw(); return; }
    const act=e.target.closest("[data-act]")?.dataset.act;
    if(act==="back"){ if(hasChanges() && !confirm("Хадгалаагүй өөрчлөлт байна. Гарах уу?")) return; hygListPage(); }
    if(act==="addroster"){ let n=0; rosterOn.forEach(o=>{ if(addWorker(o.u)) n++; }); toast(n?n+" ажилтан нэмлээ":"Нэмэх ажилтан алга"); draw(); }
    if(act==="addmanual"){ const rk="m"+uid(); W.rows.push({rk, sap:"", name:"", pos:"", c:HYG_CRIT.map(()=>""), sign:false, ord:++ordSeq}); dirty.add(rk); draw();
      const ins=$$('tr[data-rk] input[data-f="name"]'); ins[ins.length-1]?.focus(); }
    if(act==="confirm"){ W.checkedBy = ($("#chk").value||u.name).trim(); W.checkedAt = nowStr(); save(true); toast("Шалгасан гэж баталлаа"); draw(); }
    if(act==="save"){ save(); draw(); }
    if(act==="print"){ if(hasChanges()) save(true); hygPrint(id); }
    if(act==="saveprint"){ save(true); hygPrint(id); }
  });
  app.onchange = e=>{
    if(e.target.id==="addw" && e.target.value){ const w=DB.users[keyOf(e.target.value)]; if(w){ addWorker(w); draw(); } }
  };
  draw();
}

function hygPrint(id){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  const h = DB.hygcheck[id]; if(!h){ toast("Хуудас олдсонгүй"); return; }
  view(()=>hygPrint(id), true);
  const rs = rowsOf(h);
  const n = Math.max(HYG_MIN_ROWS, rs.length);
  const body = Array.from({length:n}, (_,i)=>{ const r=rs[i];
    return `<tr><td class="c">${i+1}</td><td>${esc(r?.name||"")}</td><td>${esc(r?.pos||"")}</td>${HYG_CRIT.map((_,ci)=>`<td class="c mk ${cellVal(r,ci)==="no"?"x":""}">${cellSym(cellVal(r,ci))}</td>`).join("")}<td class="c sg">${r?.sign?"Танилцсан":""}</td></tr>`; }).join("");
  const app = mount(`
    <div class="printbar noprint">
      <button class="btn sm" id="pp">${ic("printer","sm")} Хэвлэх (A4 хэвтээ)</button>
      <button class="btn ghost sm" id="pe">${ic("edit","sm")} Засах</button>
      <button class="btn ghost sm" id="pb">${ic("back","sm")} Жагсаалт</button>
    </div>
    <div class="sheet-wrap"><div class="sheet">
      <div class="sh-top">
        <img src="/logo.png" class="sh-logo" alt="Лого"/>
        <h1>${esc(HYG_TITLE)}</h1>
        <div class="sh-logo-sp"></div>
      </div>
      <div class="sh-meta"><span>Алба: ${esc(albaN(h.alba))}</span><span>Огноо: <b>${esc(h.date||"")}</b></span></div>
      <table class="sht">
        <colgroup><col class="w-no"/><col class="w-name"/><col class="w-pos"/>${HYG_CRIT.map(()=>'<col class="w-crit"/>').join("")}<col class="w-sign"/></colgroup>
        <thead>
          <tr><th rowspan="2">№</th><th rowspan="2">Ажилтны нэр</th><th rowspan="2">Албан тушаал</th><th colspan="${HYG_CRIT.length}">Үзүүлэлт</th><th rowspan="2">Ажилтны гарын үсэг</th></tr>
          <tr>${HYG_CRIT.map(c=>`<th class="crit">${esc(c)}</th>`).join("")}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <div class="sh-foot">
        <div class="sh-notes"><b>Анхаарах:</b>${HYG_NOTES.map(x=>`<div>${esc(x)}</div>`).join("")}</div>
        <div class="sh-sign">Шалгасан: <span class="dots">${esc(h.checkedBy||"")}</span>/Ахлах ажилтан/</div>
      </div>
    </div></div>`);
  const fit = ()=>{ const sh=$(".sheet"); if(!sh) return; const z=Math.min(1,(window.innerWidth-24)/1060); sh.style.zoom = z<1? z.toFixed(3) : ""; };
  fit(); window.onresize = fit;
  $("#pp").onclick = ()=>window.print();
  $("#pe").onclick = ()=>hygEdit(h.date, h.alba, h.id);
  $("#pb").onclick = hygListPage;
}

/* ======================= АХЛАХЫН ХЯНАЛТЫН ХУУДАС (xlsx маягт) =======================
   Эх: «Ахлах ажилтны өдөр тутмын цэвэрлэгээ үйлчилгээний хяналт шалгалтын хуудас» (8 хуудас/sheet).
   Бичлэг: svcheck/{id} = {id,tpl,start,heseg,alba,inspector,createdBy,createdBySap,_u,updatedBy,
     cells/{ik}/{d0..d6} = "ok"|"imp"|"no", notes/{ik}/{d0..d6} = "…", sign/{d0..d6} = {by,sap,at}}
   Бичихдээ зөвхөн өөрчлөгдсөн замыг (per-path) бичнэ. */
const SV_TPL = {"oyut":{"name":"Оюут (нэгдсэн, 2026)","sheet":"Оюут","kind":"weekly","freq":["d","w","2w"],"orient":"landscape","secs":[{"k":"zg","name":"Зөөгч","items":[["Текний цэвэрлэгээ","d"],["Тоглоомнуудын тоос","d"],["Эмийн сан цэвэрлэгээ","d"],["Зөөврийн депүзер цэвэрлэгээ","w"],["Задгай пивоны хөргүүр дотор гадна","w"],["Хөргүүрийн дотор гадна талын цэвэрлэгээ","w"],["Тавиурын цэвэрлэгээ","d"],["Ханын гэрэлний цэвэрлэгээ","w"],["Ширээний цэвэрлэгээ /хөл/","w"],["Сандалны цэвэрлэгээ /хөл/","w"],["Цонхны цэвэрлэгээ /гадна, дотор/","w"],["Цонхны тавцан цэвэрлэгээ","d"],["Ханийн цэвэрлэгээ","2w"],["Ханын доод гарнез цэвэрлэгээ","2w"],["Өлгүүрнүүдийн цэвэрлэгээ","w"],["Диспенсерүүдийн цэвэрлэгээ","d"],["Галын хорны тоос арчсан эсэх","d"],["Контейнерийн цэвэрлэгээ","w"],["Паарны цэвэрлэгээ","d"],["Пьечны цэвэрлэгээ","d"],["Хурлын өрөөний бичиг цаас эмх цэгц","d"],["Хогийн савны цэвэрлэгээ","d"],["Хогийн уут хийгдсэн эсэх","d"],["Хогийн савны sign","d"],["Хаалганы цэвэрлэгээ","d"],["Вино тогоо цэвэрлэсэн эсэх","d"],["Гарцны тэмдэглэгээний цэвэрлэгээ","w"],["Унтраалганы цэвэрлэгээ","d"],["Буйдангийн цэвэрлэгээ","w"],["Спорт тоглоомны ширээнүүд","d"],["Хөргүүр цэвэрлэгээний бүртгэл","d"],["Пос цэнэглэх, цэвэрлэх","d"],["Цэвэрлэгээний бүртгэл","d"],["Хөргүүрийн дээгүүр тоос","w"],["Хөргүүрийн дотор цэвэрлэгээ","w"],["Хөгжимийн хэсэг","d"],["Дарсны тек цэвэрлэгээ","d"],["Ком дэлгэц арчих","d"],["Ахлахын өрөөний цэвэрлэгээ","d"],["ХАБ гүйдэг хаалга","w"],["Хувин цэвэрлэгээ","d"],["Алчуур дэлгэж хатаах","d"],["5s буюу эмх цэгц","d"]]},{"k":"hk","name":"Үйлчилгээний ажилтан","items":[["Үйлчлэгчийн өрөөний цэвэрлэгээ","d"],["Шалны цэвэрлэгээ /Ногоон/","d"],["Тосгуурны цэвэрлэгээ","d"],["Шээлтүүрний цэвэрлэгээ","d"],["Крантны өнгөлгөө","w"],["Цонхны цэвэрлэгээ","d"],["Угаалтуурны цэвэрлэгээ","d"],["Суултуурны цэвэрлэгээ","d"],["Нойлын кабины цэвэрлэгээ","d"],["Нойлын кабины никель хүрээний өнгөлгөө","w"],["Паарны цэвэрлэгээ","d"],["Хаалганы цэвэрлэгээ","d"],["Тольны цэвэрлэгээ","d"],["Унтраалганы цэвэрлэгээ","w"],["Хогийн савны цэвэрлэгээ","d"],["Ангор шал","d"],["Хогийн савны sign","d"],["Нойлын сойтог тавигдсан эсэх","d"],["Такси цэвэрлэгээ","w"],["Тэмдэг тэмдэглэгээ арчих","w"],["Тавилагны арын хог","w"],["Хогын шүүр хутгуур цэвэрлэгээ","w"],["Хурлын өрөөний цэвэрлэгээ","d"],["Гар цаастай эсэх түүний тавиур","d"],["5s буюу эмх цэгц","d"]]},{"k":"gt","name":"Гадаа талбай /Туслах ажилтан/","items":[["Гадаа талбайн тоос шороо","d"],["Гадаа талбайн хог түүх","d"],["BBQ хашаа хэсэг","d"],["Хогын цэг","d"],["Тамхины цэг","d"],["Гадаа хогын сав","d"]]},{"k":"bm","name":"Бармен","items":[["AC болон удирдлага ажиллагаатай эсэх","d"],["Зурагт болон удирдлага ажиллагаатай эсэх","d"],["Заал шал","d"],["Текний эмх цэгц","d"],["Кордор шал","d"],["Тооллого тооцоо","d"]]}]},"manlai":{"name":"Манлай (нэгдсэн)","sheet":"Манлай","kind":"weekly","freq":["d","w","2w"],"orient":"landscape","secs":[{"k":"zg","name":"Зөөгч","items":[["Дарс Текний цэвэрлэгээ","d"],["Ширээний цэвэрлэгээ /тавцан/","d"],["Ширээ тавцан /сойтогдож угаах/","w"],["Шалны хүрээ","w"],["Эмийн сан цэвэрлэгээ","d"],["Задгай пивоны хөргүүр дотор гадна","d"],["Хөргүүрийн дотор гадна талын цэвэрлэгээ","d"],["Тавиурын цэвэрлэгээ","d"],["Ханын гэрэлний цэвэрлэгээ","w"],["Ширээний цэвэрлэгээ /хөл/","w"],["Сандалны цэвэрлэгээ /хөл/","w"],["Цонхнй цэвэрлэгээ /гадна,дотор/","d"],["Цонхны тавцан цэвэрлэгээ","d"],["Ханын цэвэрлэгээ","w"],["Ханын доод гарнез цэвэрлэгээ","w"],["Өлгүүрнүүдийн цэвэрлэгээ","d"],["Диспенсерүүдийн цэвэрлэгээ","d"],["Галын хорны тоос арчсан эсэх","d"],["Контейнерийн цэвэрлэгээ","w"],["Паарны цэвэрлэгээ","d"],["Хөргүүрийн дээгүүр тоос","w"],["Хогийн савны цэвэрлэгээ","d"],["Хогийн уут хийгдсэн эсэх","d"],["Хогийн савны sign","d"],["Хаалганы цэвэрлэгээ","d"],["Вино тогоо цэвэрлэсэн эсэх","d"],["Гарцны тэмдэглэгээний цэвэрлэгээ","d"],["Унтраалганы цэвэрлэгээ","d"],["Спорт тоглоомны ширээнүүд","d"],["Хөргүүр цэвэрлэгээний бүртгэл","d"],["Хөргүүрийн темпратур бүртгэл","d"],["Пос цэнэглэх, арчиж цэвэрлэх","d"],["5S буюу эмх цэгц",""]]},{"k":"hk","name":"Үйлчилгээний ажилтан","items":[["Үйлчлэгчийн өрөөний цэвэрлэгээ","d"],["Шалны цэвэрлэгээ","d"],["Тосгуурны цэвэрлэгээ","d"],["Шээлтүүрний цэвэрлэгээ","d"],["Крантны өнгөлгөө","d"],["Цонхны цэвэрлэгээ","d"],["Угаалтуурны цэвэрлэгээ","d"],["Суултуурны цэвэрлэгээ","d"],["Нойлын кабины цэвэрлэгээ","d"],["Нойлын кабины никель хүрээний өнгөлгөө","d"],["Паарны цэвэрлэгээ","d"],["Хаалганы цэвэрлэгээ","d"],["Тольны цэвэрлэгээ","d"],["Унтраалганы цэвэрлэгээ","d"],["Хогийн савны цэвэрлэгээ","d"],["Хогийн уут хийгдсэн эсэх","d"],["Хогийн савны sign","d"],["Нойлын сойтог тавигдсан эсэх","d"],["Хурлын өрөөний цэврэлгээ","d"],["Гар цаастай эсэх түүний тавиур",""]]},{"k":"gt","name":"Гадаа талбай /Туслах ажилтан/","items":[["Гадаа талбай шүүрдэх","d"],["Гадна талбайн хог түүх","d"],["Тамхны цэгийн хог түүх","d"],["Тамхны цэгийн хог сав угаах","w"],["Хогоо ангилаж хаях","d"],["Хогын цэгийг эмх цэгцтэй байлгах","d"],["Гадаа талбай мөс хусаж цэвэрлэх / давс цацах/","d"]]},{"k":"bm","name":"Бармен","items":[["AC болон удирдлага ажиллагаатай эсэх","d"],["Шалны цэвэрлэгээ","d"],["Текны эмх цэгц","d"],["Хогоо ангилаж хаях","d"]]}]},"zoogch":{"name":"Зөөгч","sheet":"Зөөгч","kind":"weekly","freq":["d","w","2w"],"orient":"landscape","title":"Ахлах ажилтны цэвэрлэгээ үйлчилгээний хяналт шалгалтын хуудас","secs":[{"k":"zg","name":"Зөөгч","items":[["Текний цэвэрлэгээ","d"],["Тоглоомнуудын тоос","d"],["Эмийн сан цэвэрлэгээ","d"],["Зөөврийн депүзер цэвэрлэгээ","w"],["Задгай пивоны хөргүүр дотор гадна","w"],["Хөргүүрийн дотор гадна талын цэвэрлэгээ","w"],["Тавиурын цэвэрлэгээ","d"],["Ханын гэрэлний цэвэрлэгээ","w"],["Ширээний цэвэрлэгээ /хөл/","w"],["Сандалны цэвэрлэгээ /хөл/","w"],["Цонхны цэвэрлэгээ /гадна, дотор/","w"],["Цонхны тавцан цэвэрлэгээ","d"],["Ханийн цэвэрлэгээ","2w"],["Ханын доод гарнез цэвэрлэгээ","2w"],["Өлгүүрнүүдийн цэвэрлэгээ","w"],["Диспенсерүүдийн цэвэрлэгээ","w"],["Галын хорны тоос арчсан эсэх","d"],["Контейнерийн цэвэрлэгээ","w"],["Паарны цэвэрлэгээ","d"],["Пьечны цэвэрлэгээ","d"],["Хурлын өрөөний цэвэрлэгээ","d"],["Хогийн савны цэвэрлэгээ","d"],["Хогийн уут хийгдсэн эсэх","d"],["Хогийн савны sign","d"],["Хаалганы цэвэрлэгээ","d"],["Вино тогоо цэвэрлэсэн эсэх","d"],["Гарцны тэмдэглэгээний цэвэрлэгээ","w"],["Унтраалганы цэвэрлэгээ","w"],["Буйдангийн цэвэрлэгээ","w"],["Спорт тоглоомны ширээнүүд","d"],["Хөргүүр цэвэрлэгээний бүртгэл","d"],["Пос цэнэглэх, цэвэрлэх","d"],["Цэвэрлэгээний бүртгэл","d"],["Хөргүүрийн дээгүүр тоос","w"],["Хөргүүр дотор цэвэрлгээ","w"],["Хөгжимийн хэсэг",""],["Дарсны тек цэврэлгээ","d"],["Ком арчих","d"],["Ахлахын өрөөний эмх цэгц","d"],["HUB-гүйдэг хаалга","w"],["Хувин цэврэлгээ","d"],["Арчуур дэлгэж хатаах","d"]]}]},"hk":{"name":"Үйлчилгээний ажилтан (HK)","sheet":"HK","kind":"weekly","freq":["d","w","2w"],"orient":"landscape","secs":[{"k":"hk","name":"Үйлчилгээний ажилтан","items":[["Үйлчлэгчийн өрөөний цэвэрлэгээ","d"],["Шалны цэвэрлэгээ /Ногоон/","d"],["Тосгуурны цэвэрлэгээ","d"],["Шээлтүүрний цэвэрлэгээ","d"],["Крантны өнгөлгөө","w"],["Цонхны цэвэрлэгээ","w"],["Угаалтуурны цэвэрлэгээ","d"],["Суултуурны цэвэрлэгээ","d"],["Нойлын кабины цэвэрлэгээ","w"],["Нойлын кабины никель хүрээний өнгөлгөө","w"],["Паарны цэвэрлэгээ","d"],["Хаалганы цэвэрлэгээ","w"],["Толины цэвэрлэгээ","d"],["Унтраалганы цэвэрлэгээ","w"],["Хогийн савны цэвэрлэгээ","d"],["Такси цэврэлгээ","d"],["Хогийн савны sign","d"],["Нойлын сойтог тавигдсан эсэх","d"],["Гар цаастай эсэх түүний тавиур","d"],["Тэмдэг тэмдэглэгээ арчих","d"],["Тавилганы арын хог","w"],["Тосгуурны гаднах цагаан тавцан","d"],["Хогын шүүр хутгуур цэврэлгээ","d"],["Ханын цэвэрлэгээ","2w"],["Хурлын өрөө цэвэрлэгээ","d"]]}]},"tuslah":{"name":"Туслах ажилтан (гадаа талбай)","sheet":"Туслах","kind":"weekly","freq":["d","w","2w"],"orient":"portrait","secs":[{"k":"gt","name":"Гадаа талбай /Туслах ажилтан/","items":[["Гадаа талбайн шороо шүүрдэх","d"],["Гадаа талбайн хог түүх","d"],["Гадаа хогын сав угаах","w"],["Гадаа талбайг угаах","w"],["Тамхины цэгийн хог түүх","d"],["Тамхины цэгийг угаах","w"],["Гадуур тамхины иш түүх","d"],["Ширээ сандал зөөх эмх цэгц","d"],["Ногоон шал угаах","d"],["Агуулах цэгцлэж янзлах","w"],["Дартс биллиард цэвэрлэгээ","d"],["Хогыг ангилаж цэгцлэж хаях","d"],["Гадаа талбайд давс цацах","d"],["Хогын цэгийг цэгцлэх","d"],["BBQ хашаа хэсэг цэвэрлэх","d"]]}]},"barmen":{"name":"Бармен","sheet":"Бармен","kind":"weekly","freq":["d"],"orient":"portrait","approve":"Батлав. Үйл ажиллагааны менежер","extra":1,"secs":[{"k":"bm","name":"Бармен","items":[["AC болон удирдлага ажиллагаатай эсэх","d"],["Зурагт болон удирдлага ажиллагаатай эсэх","d"],["Хог ангилж цэгцэлж хаях","d"],["Текний эмх цэгц","d"],["Хогын цэгийг цэгцлэх","d"],["Дартс биллиард цэвэрлэгээ","d"],["Ногоон шал угаах","d"],["Ширээ сандал зөөх эмх цэгц","d"],["Текний эмх цэгц","d"],["Хогын цэгийг цэгцлэх","d"],["Дартс биллиард цэвэрлэгээ","d"],["Коридор шал",""],["Тооллого тооцоо","d"]]}]},"servis":{"name":"Сервисийн өмнөх шалгалт (бармен)","sheet":"Сервис","kind":"service","freq":[],"orient":"landscape","extra":2,"title":"Ахлах ажилтан барменыг сервист гарахаас өмнөх хяналт шалгалт хийх хуудас","secs":[{"k":"sv","name":"","items":[["Хувцас жигдрэлт",""],["Үс засалт",""],["ХХХ-бүрэн байдал",""],["Пос цаас бэлдэх",""],["Пиво, Вино оруулах",""],["Пиво тоолох",""],["Ком шалгах",""],["Пос шалгах",""],["Касс мөнгө тулгах",""],["Биеэ бэлдэх",""],["Пиво, Вино задлагч",""],["Хогын уут бэлдэх",""],["Бээлий бэлдэх",""],["Тооцооны цаас бэлдэх",""],["Хутга бэлдэх",""],["Цаг баримтлах",""],["10-20мин өмнө тамхи татах",""],["QR-Тай stand бэлдэх",""],["Текний арын өрөлт",""],["АЭӨмнөх эмх цэгц",""],["Ай ди уншигч шалгах",""],["Зурагт асаасан эсэх",""]]}]},"abarmen":{"name":"Ахлах бармены ажил үүрэг","sheet":"А.Бармен","kind":"duty","freq":[],"orient":"portrait","title":"Ахлах бармены өдөр тутмын ажил үүрэгийн жагсаалт","inspector":"Ээлжийн ахлах ажилтан","itemHead":"Хийгдэх ажилууд","secs":[{"k":"ab","name":"","items":[["Тооллого хийх",""],["Цэвэрлэгээ үйлчилгээ шалгах",""],["Сервист гарах",""],["Ахлах ажилтантай өглөө ээлжилж ирэх",""],["Шаардлагатхай тохиолдолд тооцоо хийх",""],["Ахлах ажилтны өгсөн үүрэг даалгавар чиглэлийн дагуу ажиллах",""],["Аваарын хаалга онгойлгох",""]]}]}};
const SV_TITLE = "Ахлах ажилтны өдөр тутмын цэвэрлэгээ үйлчилгээний хяналт шалгалтын хуудас";
const SV_FQ = {d:"Өдөр бүр", w:"7х1", "2w":"14х1"};
const SV_FQ_L = {d:"Өдөр бүр", w:"7 хоногт 1", "2w":"14 хоногт 1", "":"Давтамж заагаагүй"};
const SV_WD = ["Да","Мя","Лх","Пү","Ба","Бя","Ня"];
const SV_DK = ["d0","d1","d2","d3","d4","d5","d6"];
const svT = k => SV_TPL[k] || SV_TPL.oyut;
const svDays = start => SV_DK.map((_,i)=>addDays(i, start));
const svMon = d => { const x = new Date(d+"T00:00:00"); return addDays(-((x.getDay()+6)%7), d); };
const svId = (tpl, start, heseg) => keyOf(tpl+"_"+start+"_"+String(heseg||"").trim().slice(0,60));
const svItems = t => t.secs.flatMap(s=>s.items.map((it,i)=>({sk:s.k, sec:s.name, n:i+1, text:it[0], f:it[1], ik:s.k+(i+1)})));
const svHeseg = h => { const s = String(h||"").trim(); return !s ? "" : /ба?ар$/i.test(s) ? s : s+" баар"; };
const svCell = (r, ik, d) => (r && r.cells && r.cells[ik] && r.cells[ik][d]) || "";
const svNote = (r, ik, d) => (r && r.notes && r.notes[ik] && r.notes[ik][d]) || "";
const svWd = d => SV_WD[(new Date(d+"T00:00:00").getDay()+6)%7];
const svMD = d => d ? d.slice(5).replace("-","/") : "";
function svStats(r){
  const t = svT(r.tpl), its = svItems(t); let ok=0, imp=0, no=0;
  its.forEach(it=>SV_DK.forEach(d=>{
    const vs = t.kind==="service" ? [svCell(r,it.ik+"m",d), svCell(r,it.ik+"e",d)] : [svCell(r,it.ik,d)];
    vs.forEach(v=>{ if(v==="ok") ok++; else if(v==="imp") imp++; else if(v==="no") no++; });
  }));
  const signed = SV_DK.filter(d=>r.sign && r.sign[d]).length;
  return {ok, imp, no, bad: imp+no, signed, items: its.length};
}
/* Давтамжтай мөр энэ 7 хоногт (14х1 бол өмнөх 7 хоногийн хуудсанд ч) хийгдсэн эсэх */
function svDoneElsewhere(r, it, di){
  const t = svT(r.tpl); if(t.kind!=="weekly" || !(it.f==="w" || it.f==="2w")) return "";
  const days = svDays(r.start);
  for(let i=0;i<7;i++){ if(i!==di && svCell(r,it.ik,SV_DK[i])==="ok") return days[i]; }
  if(it.f==="2w"){ const p = DB.svcheck[svId(r.tpl, addDays(-7, r.start), r.heseg)];
    if(p) for(let i=6;i>=0;i--){ if(svCell(p,it.ik,SV_DK[i])==="ok") return svDays(p.start)[i]; } }
  return "";
}
function svCanEdit(u, r){ return u.role==="supervisor" && (!r || albaN(r.alba)===albaN(u.alba)); }

function svListPage(){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  view(svListPage, true);
  const sup = u.role==="supervisor";
  const F = window.SVF = window.SVF || {tpl:"", alba:""};
  const recs = list("svcheck").filter(r=>r && r.id && (!sup || albaN(r.alba)===albaN(u.alba)))
    .filter(r=>(!F.tpl || r.tpl===F.tpl) && (sup || !F.alba || albaN(r.alba)===F.alba))
    .sort((a,b)=>String(b.start||"").localeCompare(String(a.start||"")) || String(a.heseg||"").localeCompare(String(b.heseg||"")));
  const hesegs = [...new Set(list("svcheck").map(r=>r.heseg).filter(Boolean))];
  const tplOpts = sel => Object.entries(SV_TPL).map(([k,t])=>`<option value="${k}" ${k===sel?"selected":""}>${esc(t.name)}</option>`).join("");
  const app = mount(shell("хяналт", `${phead("Ахлахын хяналтын хуудас", sup?`${esc(albaN(u.alba))} · Цэвэрлэгээ үйлчилгээний 7 хоногийн хяналт`:"Ахлах ажилтнуудын бөглөсөн хяналтын хуудас — харах, хэвлэх, Excel")}
    ${sup?`<form class="card" id="svf"><div class="ctitle">${ic("clipboard")}<h3>Хуудас нээх / бөглөх</h3></div>
      <div class="g3">
        <div><label class="f" for="svtpl">Маягт</label><select id="svtpl">${tplOpts(F.last||"oyut")}</select></div>
        <div><label class="f" for="svst">7 хоногийн эхний өдөр</label><input type="date" id="svst" value="${svMon(today())}" required/></div>
        <div><label class="f" for="svh">Хэсэг (баар)</label><input id="svh" list="svhl" maxlength="60" required placeholder="Жишээ: Оюут" value="${esc(F.heseg||"")}"/><datalist id="svhl">${hesegs.map(h=>`<option value="${esc(h)}">`).join("")}</datalist></div>
      </div>
      <div class="svfoot"><button class="btn" type="submit">${ic("edit","sm")} Нээх / бөглөх</button></div></form>`:""}
    <div class="card"><div class="ctitle">${ic("file")}<h3>Бүртгэсэн хуудсууд</h3><span class="muted">${recs.length}</span></div>
      <div class="frow svfilt">
        <select id="svft" aria-label="Маягт"><option value="">Бүх маягт</option>${tplOpts(F.tpl)}</select>
        ${sup?"":`<select id="svfa" aria-label="Алба"><option value="">Бүх алба</option>${ALBA.map(a=>`<option ${F.alba===a?"selected":""}>${esc(a)}</option>`).join("")}</select>`}
      </div>
      ${tbl(["7 хоног","Маягт","Хэсэг","Алба","Бөглөсөн","Сайжруулах","Гарын үсэг",""], recs.map(r=>{ const s=svStats(r); const ds=svDays(r.start);
        return `<tr><td class="nowrap">${esc(r.start)} — ${esc(svMD(ds[6]))}</td><td>${esc(svT(r.tpl).name)}</td><td>${esc(r.heseg||"")}</td><td>${esc(albaN(r.alba))}</td>
          <td>${s.ok+s.bad}</td><td>${s.bad?`<span class="badge b-bad">${s.bad}</span>`:'<span class="badge b-ok">0</span>'}</td><td>${s.signed}/7</td>
          <td class="nowrap"><button class="btn sm" data-svo="${esc(r.id)}">${svCanEdit(u,r)?"Бөглөх":"Харах"}</button> <button class="btn ghost sm" data-svp="${esc(r.id)}">${ic("printer","sm")} Хэвлэх</button> <button class="btn ghost sm" data-svx="${esc(r.id)}">${ic("sheet","sm")} Excel</button>${sup?"":` <button class="btn warn sm" data-svd="${esc(r.id)}">${ic("trash","sm")} Устгах</button>`}</td></tr>`; }), "Одоогоор хяналтын хуудас бүртгээгүй")}
    </div>`));
  bindNav(app, async e=>{
    const o=e.target.closest("[data-svo]"); if(o){ svEdit(o.dataset.svo); window.scrollTo(0,0); return; }
    const p=e.target.closest("[data-svp]"); if(p){ svPrint(p.dataset.svp); return; }
    const x=e.target.closest("[data-svx]"); if(x){ await svExcel([DB.svcheck[x.dataset.svx]]); return; }
    const d=e.target.closest("[data-svd]");
    if(d && confirm("Энэ хяналтын хуудсыг устгах уу?")){ write({["svcheck/"+d.dataset.svd]: null}); toast("Устгалаа"); }
  });
  app.onchange = e=>{
    if(e.target.id==="svft"){ F.tpl=e.target.value; svListPage(); }
    if(e.target.id==="svfa"){ F.alba=e.target.value; svListPage(); }
  };
  const f = $("#svf");
  if(f) f.onsubmit = e=>{ e.preventDefault();
    const tpl=$("#svtpl").value, start=$("#svst").value||svMon(today()), heseg=$("#svh").value.trim();
    if(!heseg){ toast("Хэсгийн нэрээ бичнэ үү"); return; }
    F.last=tpl; F.heseg=heseg;
    svEdit(svId(tpl,start,heseg), {tpl, start, heseg}); window.scrollTo(0,0);
  };
}

function svEdit(id, init){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  const existing = DB.svcheck[id];
  if(!existing && !(init && u.role==="supervisor")){ toast("Хуудас олдсонгүй"); return svListPage(); }
  if(existing && u.role==="supervisor" && !svCanEdit(u, existing)){ toast("Энэ хуудас таны албанд хамаарахгүй"); return svListPage(); }
  view(()=>svEdit(id, init), false);
  const R = ()=> DB.svcheck[id] || {id, tpl:init.tpl, start:init.start, heseg:init.heseg, alba:albaN(u.alba), inspector:u.name};
  const edit = svCanEdit(u, existing);
  const t = svT(R().tpl), its = svItems(t), days = svDays(R().start);
  let di = Math.max(0, days.indexOf(today()));
  const base = "svcheck/"+id;
  const app = mount(shell("хяналт", `<div id="sved"></div>`));
  const box = $("#sved");
  function put(upd){
    if(!edit) return;
    const all = {};
    if(!DB.svcheck[id]){ const r=R(); Object.assign(all, {[base+"/id"]:id, [base+"/tpl"]:r.tpl, [base+"/start"]:r.start, [base+"/heseg"]:r.heseg,
      [base+"/alba"]:r.alba, [base+"/inspector"]:r.inspector||"", [base+"/createdBy"]:u.name, [base+"/createdBySap"]:u.sap}); }
    Object.assign(all, upd, {[base+"/_u"]:Date.now(), [base+"/updatedBy"]:u.name});
    write(all);
  }
  function itemHtml(it){
    const r = R(), d = SV_DK[di];
    if(t.kind==="service"){
      const seg = (sfx, lbl) => { const v=svCell(r,it.ik+sfx,d);
        return `<div class="svseg" role="group" aria-label="${esc(lbl)}"><span>${esc(lbl)}</span>
          <button type="button" class="svb ok ${v==="ok"?"on":""}" data-k="${it.ik+sfx}" data-v="ok" aria-pressed="${v==="ok"}" ${edit?"":"disabled"}>✓</button>
          <button type="button" class="svb no ${v==="no"?"on":""}" data-k="${it.ik+sfx}" data-v="no" aria-pressed="${v==="no"}" ${edit?"":"disabled"}>✗</button></div>`; };
      const st = [svCell(r,it.ik+"m",d), svCell(r,it.ik+"e",d)];
      return `<div class="svi ${st.includes("no")?"imp":st.every(v=>v==="ok")?"ok":""}"><span class="svn">${it.n}</span><div class="svt">${esc(it.text)}</div>
        <div class="svbs two">${seg("m","Өглөө")}${seg("e","Орой")}</div></div>`;
    }
    const v = svCell(r,it.ik,d), note = svNote(r,it.ik,d), el = svDoneElsewhere(r, it, di);
    return `<div class="svi ${v} ${el&&!v?"done-el":""}"><span class="svn">${it.n}</span>
      <div class="svt">${esc(it.text)}${t.freq.length?` <small class="fq fq-${it.f||"x"}">${esc(SV_FQ_L[it.f||""])}</small>`:""}${el&&!v?` <small class="fq fq-done">${esc(svMD(el))}-нд хийсэн</small>`:""}</div>
      <div class="svbs"><button type="button" class="svb ok ${v==="ok"?"on":""}" data-k="${it.ik}" data-v="ok" aria-pressed="${v==="ok"}" ${edit?"":"disabled"}>✓ Бүрэн</button>
        <button type="button" class="svb imp ${v==="imp"?"on":""}" data-k="${it.ik}" data-v="imp" aria-pressed="${v==="imp"}" ${edit?"":"disabled"}>! Сайжруулах</button></div>
      ${v==="imp"?`<input class="svnote" data-nk="${it.ik}" maxlength="200" value="${esc(note)}" placeholder="Юуг сайжруулах вэ? (заавал биш)" aria-label="Сайжруулах тэмдэглэл" ${edit?"":"readonly"}/>`:""}
    </div>`;
  }
  function dayProg(i){
    const r = R(), d = SV_DK[i]; let need=0, done=0;
    its.forEach(it=>{
      if(t.kind==="service"){ need+=2; done += ["m","e"].filter(s=>svCell(r,it.ik+s,d)).length; return; }
      const v = svCell(r,it.ik,d);
      if(v){ need++; done++; return; }
      if(!svDoneElsewhere(r, it, i)) need++;
    });
    return {need, done};
  }
  function draw(){
    const r = R(), d = SV_DK[di], sg = r.sign && r.sign[d], p = dayProg(di);
    box.innerHTML = `
      <div class="phead"><div><h2 class="ptitle">${esc(t.title||SV_TITLE)}</h2>
        <p class="muted">${esc(t.name)} · Хэсэг: <b>${esc(svHeseg(r.heseg))}</b> · ${esc(albaN(r.alba))} · ${esc(r.start)} — ${esc(svMD(days[6]))}${DB.svcheck[id]?"":" · Шинэ хуудас"}${edit?"":" · Зөвхөн харах"}</p></div>
        <div class="row-gap noprint"><button class="btn ghost sm" data-act="back">${ic("back","sm")} Жагсаалт</button><button class="btn ghost sm" data-act="print">${ic("printer","sm")} Хэвлэх</button>${u.role==="hygiene"?`<button class="btn ghost sm" data-act="xl">${ic("sheet","sm")} Excel</button>`:""}</div></div>
      <div class="card svmeta">
        <label class="f" for="svins">Шалгалт хийсэн: ${esc(t.inspector||"Ахлах ажилтан")}</label>
        <input id="svins" maxlength="80" value="${esc(r.inspector||"")}" placeholder="Нэр" ${edit?"":"readonly"}/>
      </div>
      <div class="svdays" role="tablist" aria-label="Өдөр сонгох">${days.map((dd,i)=>{ const q=dayProg(i); const s=r.sign&&r.sign[SV_DK[i]];
        return `<button type="button" role="tab" class="svday ${i===di?"on":""} ${dd===today()?"today":""}" data-di="${i}" aria-selected="${i===di}">
          <span>${svWd(dd)}</span><b>${esc(svMD(dd))}</b><small>${s?"✓ гарын үсэг":q.done?`${q.done}/${q.need}`:"—"}</small></button>`; }).join("")}</div>
      <div class="card svprog"><div class="row-between"><b>${esc(days[di])} (${svWd(days[di])})</b><span class="muted">${p.done}/${p.need} шалгасан</span></div>
        <div class="bar"><i style="width:${p.need?Math.round(100*p.done/p.need):0}%"></i></div>
        ${t.kind==="weekly"&&t.freq.length>1?`<p class="muted small">7х1 / 14х1 мөрийг 7 (14) хоногт нэг удаа шалгана — өөр өдөр «Бүрэн» болсон бол саарал харагдана.</p>`:""}</div>
      ${t.secs.map(s=>{ const sits = its.filter(it=>it.sk===s.k);
        return `<section class="card svsec"><div class="svsh"><h3>${esc(s.name||t.itemHead||"Шалгах зүйлс")}</h3>
          ${edit?`<button type="button" class="btn ghost sm" data-allok="${s.k}">${ic("checks","sm")} Бүгд бүрэн</button>`:""}</div>
          ${sits.map(itemHtml).join("")}</section>`; }).join("")}
      <div class="savebar noprint">
        ${edit?`<button type="button" class="btn ${sg?"ghost":""}" data-act="sign">${ic("check")} ${sg?`Батлагдсан · ${esc(sg.by)} (цуцлах)`:`Өдрийг батлах · ${esc(svMD(days[di]))}`}</button>`:""}
        <button type="button" class="btn ghost" data-act="print">${ic("printer")} Хэвлэх</button>
      </div>`;
  }
  bindNav(app, async e=>{
    const a = e.target.closest("[data-act]")?.dataset.act;
    if(a==="back"){ svListPage(); window.scrollTo(0,0); return; }
    if(a==="print"){ if(!DB.svcheck[id]){ toast("Эхлээд нэг ч гэсэн мөр бөглөнө үү"); return; } svPrint(id); return; }
    if(a==="xl"){ await svExcel([DB.svcheck[id]]); return; }
    const dEl = e.target.closest("[data-di]"); if(dEl){ di = +dEl.dataset.di; draw(); return; }
    if(!edit) return;
    const d = SV_DK[di];
    if(a==="sign"){ const s = R().sign && R().sign[d];
      if(s && !confirm("Энэ өдрийн баталгаажуулалтыг цуцлах уу?")) return;
      put({[base+"/sign/"+d]: s ? null : {by:u.name, sap:u.sap, at:nowStr()}}); toast(s?"Цуцаллаа":"Баталгаажууллаа"); draw(); return; }
    const b = e.target.closest("[data-k]");
    if(b){ const k=b.dataset.k, v=b.dataset.v, cur=svCell(R(),k,d);
      const upd = {[base+"/cells/"+k+"/"+d]: cur===v ? null : v};
      if(cur==="imp" && v!=="imp" && svNote(R(),k,d)) upd[base+"/notes/"+k+"/"+d] = null;
      put(upd); draw(); return; }
    const all = e.target.closest("[data-allok]");
    if(all){ const upd = {};
      its.filter(it=>it.sk===all.dataset.allok).forEach(it=>{
        if(t.kind==="service"){ ["m","e"].forEach(s=>{ if(!svCell(R(),it.ik+s,d)) upd[base+"/cells/"+it.ik+s+"/"+d]="ok"; }); return; }
        if(!svCell(R(),it.ik,d) && !svDoneElsewhere(R(), it, di)) upd[base+"/cells/"+it.ik+"/"+d]="ok"; });
      if(Object.keys(upd).length){ put(upd); draw(); toast(Object.keys(upd).length+" мөр «Бүрэн»"); } else toast("Хоосон мөр алга");
    }
  });
  app.onchange = e=>{
    if(!edit) return;
    if(e.target.id==="svins"){ put({[base+"/inspector"]: e.target.value.trim()}); return; }
    const nk = e.target.dataset.nk;
    if(nk){ put({[base+"/notes/"+nk+"/"+SV_DK[di]]: e.target.value.trim() || null}); }
  };
  draw();
}

/* ---- Цаасан маягттай ижил хэвлэх хувилбар ---- */
function svSheetHtml(r){
  const t = svT(r.tpl), its = svItems(t), days = svDays(r.start);
  const FQ = t.kind==="weekly" ? t.freq : [];
  const sub = t.kind==="service" ? ["Өглөө сервис","Орой сервис"] : ["Бүрэн эсэх","Сайжруулах шаардлагатай"];
  const ncol = 2 + FQ.length + 14;
  const yr = String(r.start||"").slice(0,4);
  const cellsFor = it => SV_DK.map(d=>{
    if(t.kind==="service"){ const m=svCell(r,it.ik+"m",d), e=svCell(r,it.ik+"e",d);
      return `<td class="mk">${m==="ok"?"✓":m==="no"?"✗":""}</td><td class="mk">${e==="ok"?"✓":e==="no"?"✗":""}</td>`; }
    const v=svCell(r,it.ik,d), n=svNote(r,it.ik,d);
    return `<td class="mk">${v==="ok"?"✓":""}</td><td class="nt">${v==="imp"?(n?esc(n):'<span class="mk">✓</span>'):""}</td>`; }).join("");
  const blank = () => `<tr><td></td><td class="it"></td>${FQ.map(()=>"<td></td>").join("")}${SV_DK.map(()=>"<td></td><td></td>").join("")}</tr>`;
  const body = t.secs.map(s=>`${s.name?`<tr class="sec"><td colspan="${ncol}">${esc(s.name)}</td></tr>`:""}
    ${its.filter(it=>it.sk===s.k).map(it=>`<tr><td class="no">${t.kind==="duty"?"":it.n}</td><td class="it">${esc(it.text)}</td>${FQ.map(f=>`<td class="fqc ${it.f===f?"on":""}">${it.f===f?"1":""}</td>`).join("")}${cellsFor(it)}</tr>`).join("")}`).join("")
    + Array.from({length:t.extra||0}, blank).join("");
  return `<div class="svsheet ${t.orient==="portrait"?"portrait":""}">
    <div class="svs-top"><span>${esc(t.approve||"Баталсан:Үйл ажиллагааны менежер")}............................./...................../</span><span>${esc(yr)} он</span></div>
    <div class="svs-title"><img src="/logo.png" alt="Лого"/><h1>${esc(t.title||SV_TITLE)}</h1><span></span></div>
    <div class="svs-meta"><span>Хэсэг: <b class="dots">${esc(svHeseg(r.heseg)||".................................. баар")}</b></span>
      <span>${esc(t.inspector||"Шалгалт хийсэн: Ахлах ажилтан")} / <b class="dots">${esc(r.inspector||"")}</b> / ..............................</span></div>
    <table class="svt">
      <colgroup><col class="c-no"/><col class="c-it"/>${FQ.map(()=>'<col class="c-fq"/>').join("")}${SV_DK.map(()=>t.kind==="service"?'<col class="c-sv"/><col class="c-sv"/>':'<col class="c-ok"/><col class="c-im"/>').join("")}</colgroup>
      <thead>
        <tr><th colspan="2" rowspan="2" class="hd">${esc(t.itemHead||"Шалгах зүйлс")}</th>${FQ.length?`<th colspan="${FQ.length}" class="hd">Давтамж</th>`:""}${days.map(d=>`<th colspan="2" class="dt">${esc(d.replace(/-/g,"/"))}</th>`).join("")}</tr>
        <tr>${FQ.map(f=>`<th class="hd fqh">${esc(SV_FQ[f])}</th>`).join("")}${SV_DK.map(()=>`<th class="hd sb">${esc(sub[0])}</th><th class="hd sb">${esc(sub[1])}</th>`).join("")}</tr>
      </thead>
      <tbody>${body}
        <tr class="sg"><td colspan="${2+FQ.length}">Шалгасан гарын үсэг</td>${SV_DK.map(d=>`<td colspan="2">${r.sign&&r.sign[d]?esc(r.sign[d].by):""}</td>`).join("")}</tr>
      </tbody>
    </table></div>`;
}
function svPrint(id){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  const r = DB.svcheck[id]; if(!r){ toast("Хуудас олдсонгүй"); return; }
  view(()=>svPrint(id), true);
  const portrait = svT(r.tpl).orient==="portrait";
  mount(`<div class="printbar noprint">
      <button class="btn sm" id="pp">${ic("printer","sm")} Хэвлэх (A4 ${portrait?"босоо":"хэвтээ"})</button>
      ${u.role==="hygiene"?`<button class="btn ghost sm" id="px">${ic("sheet","sm")} Excel</button>`:""}
      <button class="btn ghost sm" id="pe">${ic("edit","sm")} ${svCanEdit(u,r)?"Засах":"Харах"}</button>
      <button class="btn ghost sm" id="pb">${ic("back","sm")} Жагсаалт</button>
    </div>
    <div class="sheet-wrap svwrap">${svSheetHtml(r)}</div>`);
  const fit = ()=>{ const sh=$(".svsheet"); if(!sh) return; const w = portrait?740:1060; const z=Math.min(1,(window.innerWidth-24)/w); sh.style.zoom = z<1? z.toFixed(3) : ""; };
  fit(); window.onresize = fit;
  $("#pp").onclick = ()=>window.print();
  if($("#px")) $("#px").onclick = ()=>svExcel([r]);
  $("#pe").onclick = ()=>svEdit(id);
  $("#pb").onclick = svListPage;
}

/* ---- Excel: эх xlsx-тэй ижил бүтэц (нэгтгэсэн нүд, өнгө, Times New Roman, лого) ---- */
let SV_LOGO = null;
async function svLogo(){ if(SV_LOGO) return SV_LOGO; try{ const r = await fetch("/logo.png"); SV_LOGO = new Uint8Array(await r.arrayBuffer()); }catch(e){ console.warn(e); } return SV_LOGO; }
function addSvSheet(wb, r, used, logo){
  const t = svT(r.tpl), its = svItems(t), days = svDays(r.start);
  const FQ = t.kind==="weekly" ? t.freq : [];
  let nm = (String(r.start||"").slice(5)+" "+(r.heseg||"")+" "+t.sheet).replace(/[\\\/\?\*\[\]:]/g," ").slice(0,31);
  let k=2; while(used.has(nm)){ nm = nm.slice(0,28)+" "+(k++); } used.add(nm);
  const s = wb.addWorksheet(nm, {pageSetup:{paperSize:9, orientation:t.orient||"landscape", fitToPage:true, fitToWidth:1, fitToHeight:0,
    margins:{left:0.25,right:0.25,top:0.4,bottom:0.4,header:0.2,footer:0.2}, printTitlesRow:"4:5"}});
  const D0 = 3 + FQ.length, NC = D0 - 1 + 14;
  const sub = t.kind==="service" ? ["Өглөө сервис","Орой сервис"] : ["Бүрэн эсэх","Сайжруулах шаардлагатай"];
  s.columns = [{width:3.2},{width:34}, ...FQ.map(()=>({width:4.6})), ...SV_DK.flatMap(()=> t.kind==="service" ? [{width:7.5},{width:7.5}] : [{width:4.9},{width:11.4}])];
  const thin = {style:"thin", color:{argb:"FF000000"}}, border = {top:thin,left:thin,bottom:thin,right:thin};
  const F = (o={}) => ({name:"Times New Roman", size:9, ...o});
  const fill = argb => ({type:"pattern", pattern:"solid", fgColor:{argb}});
  const C = (row,col) => s.getCell(row,col);
  s.mergeCells(1,2,1,Math.min(NC-3, 12)); C(1,2).value = (t.approve||"Баталсан:Үйл ажиллагааны менежер")+"............................./...................../"; C(1,2).font=F({size:10});
  s.mergeCells(1,NC-2,1,NC); C(1,NC-2).value = String(r.start||"").slice(0,4)+"он"; C(1,NC-2).font=F({size:10}); C(1,NC-2).alignment={horizontal:"right"};
  s.mergeCells(2,1,2,NC); C(2,1).value = t.title||SV_TITLE; C(2,1).font=F({size:16, bold:true, italic:true}); C(2,1).alignment={horizontal:"center", vertical:"middle"}; s.getRow(2).height=34;
  s.mergeCells(3,1,3,D0-1+2); C(3,1).value = "Хэсэг:  "+(svHeseg(r.heseg)||".................................. баар "); C(3,1).font=F({size:11});
  s.mergeCells(3,D0+2,3,NC); C(3,D0+2).value = (t.inspector||"Шалгалт хийсэн: Ахлах ажилтан")+" / "+(r.inspector||"............................................")+"/ ..................................................."; C(3,D0+2).font=F({size:11});
  s.getRow(3).height = 18.75;
  // толгой
  s.mergeCells(4,1,5,2); C(4,1).value = t.itemHead||"Шалгах зүйлс";
  if(FQ.length){ if(FQ.length>1) s.mergeCells(4,3,4,2+FQ.length); C(4,3).value="Давтамж"; FQ.forEach((f,i)=>C(5,3+i).value = SV_FQ[f]); }
  days.forEach((d,i)=>{ const c=D0+2*i; s.mergeCells(4,c,4,c+1); C(4,c).value = d.replace(/-/g,"/"); C(5,c).value=sub[0]; C(5,c+1).value=sub[1]; });
  for(let rr=4; rr<=5; rr++) for(let c=1;c<=NC;c++){ const x=C(rr,c); x.border=border; x.font=F({size:rr===4?(c===1?14:10):8, bold:rr===4}); x.alignment={horizontal:"center",vertical:"middle",wrapText:true};
    x.fill = fill(rr===4 && c>=D0 ? "FFFFFF00" : "FFA9D08E"); }
  s.getRow(4).height = 17.25; s.getRow(5).height = 33;
  let row = 6;
  t.secs.forEach(sec=>{
    if(sec.name){ s.mergeCells(row,1,row,NC); C(row,1).value = sec.name; C(row,1).font=F({size:10,bold:true}); C(row,1).fill=fill("FF92D050");
      for(let c=1;c<=NC;c++) C(row,c).border=border; row++; }
    its.filter(it=>it.sk===sec.k).forEach(it=>{
      C(row,1).value = t.kind==="duty" ? "" : it.n; C(row,2).value = it.text;
      FQ.forEach((f,i)=>{ if(it.f===f){ C(row,3+i).value=1; C(row,3+i).fill=fill("FFE2EFDA"); } });
      SV_DK.forEach((d,i)=>{ const c=D0+2*i;
        if(t.kind==="service"){ const m=svCell(r,it.ik+"m",d), e=svCell(r,it.ik+"e",d); C(row,c).value = m==="ok"?"✓":m==="no"?"✗":""; C(row,c+1).value = e==="ok"?"✓":e==="no"?"✗":""; }
        else { const v=svCell(r,it.ik,d); C(row,c).value = v==="ok"?"✓":""; C(row,c+1).value = v==="imp" ? (svNote(r,it.ik,d)||"✓") : ""; } });
      for(let c=1;c<=NC;c++){ const x=C(row,c); x.border=border; x.font=F(); x.alignment={vertical:"middle", horizontal: c===2?"left": (c>=D0 && (c-D0)%2===1 && t.kind!=="service")?"left":"center", wrapText: c>=D0}; }
      s.getRow(row).height = SV_DK.some(d=>svNote(r,it.ik,d)) ? 24 : 13.5; row++;
    });
  });
  for(let i=0;i<(t.extra||0);i++){ for(let c=1;c<=NC;c++) C(row,c).border=border; s.getRow(row).height=13.5; row++; }
  s.mergeCells(row,1,row,D0-1); C(row,1).value = "Шалгасан гарын үсэг"; C(row,1).font=F({size:10,bold:true});
  SV_DK.forEach((d,i)=>{ const c=D0+2*i; s.mergeCells(row,c,row,c+1); C(row,c).value = r.sign&&r.sign[d] ? r.sign[d].by : ""; C(row,c).alignment={horizontal:"center",vertical:"middle"}; C(row,c).font=F({size:8}); });
  for(let c=1;c<=NC;c++) C(row,c).border=border; s.getRow(row).height = 24;
  if(logo){ try{ const img = wb.addImage({buffer:logo, extension:"png"}); s.addImage(img, {tl:{col:0.15,row:1.05}, ext:{width:52,height:43}}); }catch(e){ console.warn(e); } }
  s.pageSetup.printArea = `A1:${s.getColumn(NC).letter}${row}`;
  return s;
}
async function svExcel(recs, wb0){
  recs = (recs||[]).filter(Boolean);
  if(typeof ExcelJS==="undefined"){ toast("Excel сан ачаалагдаагүй байна"); return; }
  const wb = wb0 || new ExcelJS.Workbook(); if(!wb0) wb.creator = "EAHS";
  const logo = await svLogo(); const used = new Set(wb.worksheets.map(w=>w.name));
  recs.forEach(r=>addSvSheet(wb, r, used, logo));
  if(!wb0){ const r=recs[0]; await downloadWb(wb, recs.length===1 ? `EAHS_ahlah_hyanalt_${r.start}_${keyOf(r.heseg||"")}.xlsx` : "EAHS_ahlah_hyanalt.xlsx"); }
  return wb;
}

/* ======================= EXCEL ======================= */
function reportPage(){
  if(!requireRole("hygiene")) return;
  view(reportPage, false);
  const app = mount(shell("excel", `${phead("Excel татах", "УХААН орохгүй. Хэрэгтэй тайлангаа сонгоно уу.")}
    <form class="card" id="xf">
      <div class="ctitle">${ic("sheet")}<h3>Тайлан</h3></div>
      <div class="g3">
        <div><label class="f" for="from">Эхлэх</label><input type="date" id="from" value="${addDays(-13)}"/></div>
        <div><label class="f" for="to">Дуусах</label><input type="date" id="to" value="${today()}"/></div>
      </div>
      <label class="f">Аль тайлан</label>
      <label class="chk"><input type="checkbox" id="x-hyg" checked/> Ариун цэврийн хяналт (хуудас бүр тусдаа)</label>
      <label class="chk"><input type="checkbox" id="x-sv" checked/> Ахлахын хяналтын хуудас (маягтаар, хуудас бүр тусдаа)</label>
      <label class="chk"><input type="checkbox" id="x-ayul" checked/> Аюул (зурагтай)</label>
      <label class="chk"><input type="checkbox" id="x-inf" checked/> Халдварын асуумж</label>
      <label class="chk"><input type="checkbox" id="x-fat" checked/> Ядаргааны үнэлгээ</label>
      <div class="gap"></div>
      <button class="btn" type="submit" id="xl">${ic("download")} Татах</button>
    </form>`));
  bindNav(app);
  app.onsubmit = async e=>{
    e.preventDefault();
    const kinds=[["x-hyg","hyg"],["x-sv","sv"],["x-ayul","ayul"],["x-inf","inf"],["x-fat","fat"]].filter(([i])=>$("#"+i).checked).map(([,k])=>k);
    if(!kinds.length){ toast("Дор хаяж нэг тайлан сонгоно уу"); return; }
    if(typeof ExcelJS==="undefined"){ toast("Excel сан ачаалагдаагүй байна"); return; }
    $("#xl").disabled=true; $("#xl").textContent="Бэлдэж байна…";
    try{ await exportExcel($("#from").value,$("#to").value,kinds); }
    catch(err){ console.error(err); toast("Excel үүсгэхэд алдаа гарлаа"); }
    finally{ const b=$("#xl"); if(b){ b.disabled=false; b.textContent="Татах"; } }
  };
}
function dataUrlToBuf(url){
  const b64=String(url).split(",")[1]||""; const bin=atob(b64); const u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return u;
}
function downloadWb(wb, name){
  return wb.xlsx.writeBuffer().then(buf=>{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
    a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  });
}
function addHygSheet(wb, h, usedNames){
  let nm = (h.date+" "+albaN(h.alba)).replace(/[\\\/\?\*\[\]:]/g," ").slice(0,31);
  let k=2; while(usedNames.has(nm)){ nm = nm.slice(0,28)+" "+(k++); } usedNames.add(nm);
  const s = wb.addWorksheet(nm, {pageSetup:{paperSize:9, orientation:"landscape", fitToPage:true, fitToWidth:1, fitToHeight:0, margins:{left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.2,footer:0.2}}});
  const NC = 3 + HYG_CRIT.length + 1;  // 11 багана
  const last = String.fromCharCode(64+NC);
  s.columns = [{width:5},{width:26},{width:16}, ...HYG_CRIT.map(()=>({width:11})), {width:16}];
  const thin = {style:"thin", color:{argb:"FF000000"}};
  const border = {top:thin,left:thin,bottom:thin,right:thin};
  const font = {name:"Times New Roman", size:11};
  s.mergeCells(`A1:${last}1`);
  Object.assign(s.getCell("A1"), {value:HYG_TITLE});
  s.getCell("A1").font = {...font, size:14, bold:true}; s.getCell("A1").alignment={horizontal:"center", vertical:"middle"};
  s.getRow(1).height = 26;
  s.getCell("A2").value = "Алба: "+albaN(h.alba); s.getCell("A2").font=font;
  s.mergeCells(`${String.fromCharCode(64+NC-2)}2:${last}2`);
  s.getCell(`${String.fromCharCode(64+NC-2)}2`).value = "Огноо: "+(h.date||"");
  s.getCell(`${String.fromCharCode(64+NC-2)}2`).font = font;
  s.getCell(`${String.fromCharCode(64+NC-2)}2`).alignment = {horizontal:"right"};
  // Толгой: 3-4-р мөр
  s.mergeCells("A3:A4"); s.mergeCells("B3:B4"); s.mergeCells("C3:C4");
  s.mergeCells(`D3:${String.fromCharCode(64+3+HYG_CRIT.length)}3`);
  s.mergeCells(`${last}3:${last}4`);
  s.getCell("A3").value="№"; s.getCell("B3").value="Ажилтны нэр"; s.getCell("C3").value="Албан тушаал";
  s.getCell("D3").value="Үзүүлэлт"; s.getCell(`${last}3`).value="Ажилтны гарын үсэг";
  HYG_CRIT.forEach((c,i)=> s.getCell(4, 4+i).value = c);
  s.getRow(4).height = 62;
  for(let r=3;r<=4;r++) for(let c=1;c<=NC;c++){ const cell=s.getCell(r,c); cell.border=border; cell.font=font; cell.alignment={horizontal:"center",vertical:"middle",wrapText:true}; }
  const rs = rowsOf(h); const n = Math.max(HYG_MIN_ROWS, rs.length);
  for(let i=0;i<n;i++){
    const r = rs[i]; const rowN = 5+i;
    const vals = [i+1, r?.name||"", r?.pos||"", ...HYG_CRIT.map((_,ci)=>cellSym(cellVal(r,ci))), r?.sign?"Танилцсан":""];
    s.getRow(rowN).values = vals; s.getRow(rowN).height = 18;
    for(let c=1;c<=NC;c++){ const cell=s.getCell(rowN,c); cell.border=border; cell.font = (c>3 && c<NC && cell.value==="X") ? {...font, bold:true, color:{argb:"FFC0352B"}} : font;
      cell.alignment = {vertical:"middle", horizontal:(c===2||c===3)?"left":"center"}; }
  }
  const f = 5+n;
  s.getCell(`A${f}`).value = "Анхаарах:"; s.getCell(`A${f}`).font = {...font, bold:true};
  s.mergeCells(`G${f}:${last}${f}`);
  s.getCell(`G${f}`).value = "Шалгасан: "+(h.checkedBy||"..............................")+" /Ахлах ажилтан/";
  s.getCell(`G${f}`).font = font; s.getCell(`G${f}`).alignment={horizontal:"right"};
  HYG_NOTES.forEach((t,i)=>{ s.mergeCells(`A${f+1+i}:F${f+1+i}`); s.getCell(`A${f+1+i}`).value=t; s.getCell(`A${f+1+i}`).font=font; });
  s.pageSetup.printArea = `A1:${last}${f+HYG_NOTES.length}`;
}
async function exportExcel(from,to,kinds){
  const wb=new ExcelJS.Workbook();
  wb.creator="EAHS";
  const inR=d=>d>=from && d<=to;
  if(kinds.includes("hyg")){
    const hs = list("hygcheck").filter(h=>inR(h.date)).sort((a,b)=>String(a.date+albaN(a.alba)).localeCompare(String(b.date+albaN(b.alba))));
    const used = new Set();
    const sum = wb.addWorksheet("Ариун цэвэр (нэгтгэл)");
    sum.addRow(["Огноо","Алба","Ажилтны нэр","Албан тушаал",...HYG_CRIT,"Гарын үсэг","Дүгнэлт","Шалгасан"]);
    sum.getRow(1).font={bold:true}; sum.getRow(1).alignment={wrapText:true, vertical:"middle"};
    hs.forEach(h=> rowsOf(h).forEach(r=> sum.addRow([h.date,albaN(h.alba),r.name,r.pos,...HYG_CRIT.map((_,i)=>cellSym(cellVal(r,i))), r.sign?"Танилцсан":"", rowStatus(r)==="fail"?"Ажиллахгүй":rowStatus(r)==="ok"?"Хангасан":"Бүрэн бус", h.checkedBy||""])));
    sum.columns.forEach((c,i)=> c.width = i<2?12: i<4?22: 14);
    hs.forEach(h=>addHygSheet(wb, h, used));
  }
  if(kinds.includes("sv")){
    const rs = list("svcheck").filter(r=>r && r.start && r.start<=to && addDays(6, r.start)>=from).sort((a,b)=>String(a.start+a.heseg).localeCompare(String(b.start+b.heseg)));
    if(rs.length) await svExcel(rs, wb);
  }
  if(kinds.includes("ayul")){
    const hz=list("hazards").map(normHazard).filter(x=>inR(x.date)).sort(byNew);
    const s1=wb.addWorksheet("Аюул");
    s1.addRow(["Огноо","Газар","Хариуцах","Мэдээлэгч","Хянасан","Төрөл","Ангилал","Эрсдэл","Дэлгэрэнгүй","Шуурхай арга","Зураг тоо","Төлөв","Алба","Хариуцагч","Гүйцэтгэх хугацаа","Хугацаа хэтэрсэн","Залруулах арга хэмжээ","Хаасан огноо","Түүх"]);
    hz.map(normHazard).forEach(x=>s1.addRow([x.date,x.area,x.acc,x.reporter,x.reviewer||"",(x.types||[]).join("; "),(x.cls||[]).join("; "),x.risk,x.det,x.act,x.photoCount||0,x.status,
      albaN(x.alba),x.assigneeName||"",x.due||"",hzOverdue(x)?"Тийм":"",x.corr||"",x.closedAt||"",
      Object.values(x.log||{}).filter(Boolean).sort((a,b)=>(a.ts||0)-(b.ts||0)).map(l=>`${l.at} ${l.by}: ${l.text}`).join("\n")]));
    const sP=wb.addWorksheet("Аюул_зураг");
    sP.addRow(["Огноо","Газар","Мэдээлэгч","Зураг №"]);
    let r=2;
    for(const x of hz){
      const ps = await getPhotos(x.id);
      ps.forEach((p,i)=>{
        sP.getRow(r).values=[x.date,x.area,x.reporter,i+1];
        sP.getRow(r).height=80;
        try{ const imgId=wb.addImage({buffer:dataUrlToBuf(p), extension:"jpeg"}); sP.addImage(imgId,{tl:{col:4,row:r-1}, ext:{width:120,height:90}}); }catch(e){ console.warn(e); }
        r++;
      });
    }
    sP.getColumn(5).width=22;
  }
  if(kinds.includes("inf")){
    const s2=wb.addWorksheet("Халдвар");
    s2.addRow(["Огноо","SAP","Нэр","Алба","Үр дүн","Хариу"]);
    list("infect").filter(x=>inR(x.date)).sort(byNew).forEach(x=>s2.addRow([x.date,x.sap,x.name,albaN(x.alba),VERDICT[x.verdict]||VERDICT.huleegdej,arr(x.ans).map(a=>a.q+": "+a.a).join("; ")]));
  }
  if(kinds.includes("fat")){
    const s3=wb.addWorksheet("Ядаргаа");
    s3.addRow(["Огноо","SAP","Нэр","Алба","Хүйс","24ц","48ц","Сэрүүн","Архи","Эм","Төвлөрөл","Оноо","Түвшин"]);
    list("fatigue").filter(x=>inR(x.date)).sort(byNew).forEach(x=>s3.addRow([x.date,x.sap,x.name,albaN(x.alba),x.gender,x.q5,x.q6,x.q7,x.q8,x.q10,x.q11,x.score,x.level]));
  }
  await downloadWb(wb, `EAHS_${kinds.join("-")}_${from}_${to}.xlsx`);
}

/* ======================= ЭХЛЭЛ ======================= */
(function boot(){
  let started=false;
  // QR стикер: /?hazard&area=<газар> → аюулын маягт (газар бөглөгдсөн), мэдэгдэл: /?n=<id>
  const QP = new URLSearchParams(location.search);
  const qrArea = QP.has("hazard") ? (QP.get("area")||"") : null;
  const openN = QP.get("n");
  if(qrArea!=null || openN) history.replaceState(null, "", location.pathname);
  const start = ()=>{
    started=true;
    if(qrArea!=null) return hazardForm({area: qrArea});
    homeFor(me());
    if(openN && me() && me().role!=="worker") openNotif(openN);
  };
  if("serviceWorker" in navigator && !EMU_NO_SW){
    navigator.serviceWorker.register("/sw.js").catch(e=>console.warn("sw", e && e.message));
    navigator.serviceWorker.addEventListener("message", e=>{
      if(e.data && e.data.type==="eahs-open"){ const id = new URL(e.data.url, location.origin).searchParams.get("n"); if(id && me()) openNotif(id); }
    });
  }
  if(Object.keys(DB.users).length) start();       // локал өгөгдлөөр шууд харуулна
  else mount(`<div class="land"><div class="center"><img src="/logo.png" alt="" width="120" style="opacity:.9"/><p class="muted">Ачаалж байна…</p></div></div>`);
  initCloud().then(()=>{
    if(!started) start();
    else if(session && !me() && !CLOUD_AUTH) landing();
    else scheduleRender();
  });
})();
