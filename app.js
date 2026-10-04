"use strict";
/* ЭАХС — Эрүүл ахуйн хяналтын систем
 * Өгөгдөл: Firebase RTDB "eahs/v2/<цуглуулга>/<id>" (бичлэг тус бүрээр update хийнэ),
 * офлайн үед localStorage дээр хадгалж, "pending" дараалалд үлдээгээд холбогдмогц илгээнэ.
 */
const ALBA = ["Оффис", "Оюут баар", "Манлай баар", "Эрчим баар"];
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
const ROOT = "eahs/v2";
const COLS = ["users","settings","uhaan","fatigue","hazards","infect","roster","hygcheck"];
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
function toast(msg){
  let t=document.getElementById("toast");
  if(!t){ t=document.createElement("div"); t.id="toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  t.textContent=msg; t.className="toast show";
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
  map:'<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'
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
let _fb = null, _cloudState = "off", _flushing = false;

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
    PENDING.push({p, v: clone(v)});
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
function flush(){
  if(!_fb || _flushing || !PENDING.length) return;
  const batch = PENDING.slice();
  _flushing = true;
  setCloud("wait","Хадгалж байна…");
  _fb.ref(ROOT).update(coalesce(batch)).then(()=>{
    PENDING = PENDING.slice(batch.length);
    persistPending();
    setCloud("ok","Үүлэнд хадгаллаа");
  }).catch(e=>{
    console.warn("fb update", e);
    setCloud("err","Үүлэнд хадгалж чадсангүй — энэ төхөөрөмжид үлдсэн");
  }).finally(()=>{
    _flushing = false;
    if(PENDING.length && _cloudState!=="err") setTimeout(flush, 400);
  });
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

async function initCloud(){
  await migrateLegacyLocal();
  setCloud("wait","Холбож байна…");
  if(typeof firebase==="undefined"){ await seedIfEmpty(true); await migratePins(); setCloud("err"); return; }
  try{
    if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    _fb = firebase.database();
    if(firebase.auth){ try{ await firebase.auth().signInAnonymously(); }catch(e){ console.warn("auth", e); } }
    await migrateLegacyCloud();
    // v1 локал түлхүүрүүд (нууц үг ил агуулсан) үүлэнд шилжсэн тул устгана
    ["users","settings","uhaan","fatigue","hazards","infect","roster"].forEach(c=>localStorage.removeItem("eahs_"+c));
    // Эхний ачаалал: үүл + офлайн хүлээгдэж буй бичлэгүүд (локал давамгайлна)
    await Promise.all(COLS.map(async c=>{
      const v = (await _fb.ref(ROOT+"/"+c).once("value")).val();
      DB[c] = v || {}; overlayPending(c);
    }));
    persist(COLS);
    await seedIfEmpty(false);
    await migratePins();
    // Бодит цагийн шинэчлэл
    COLS.forEach(c=>{
      _fb.ref(ROOT+"/"+c).on("value", s=>{
        DB[c] = s.val() || {}; overlayPending(c); persist([c]);
        scheduleRender();
      });
    });
    _fb.ref(".info/connected").on("value", s=>{
      if(s.val()===true){ setCloud("ok"); flush(); }
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
  if(s && s.sap && s.role) session = {sap:String(s.sap), role:s.role};
  lsSet("eahs_session", session);   // хуучин (pin агуулсан) сессийг цэвэрлэнэ
})();
function me(){ return session ? DB.users[keyOf(session.sap)] || null : null; }
function setSession(u){ session = u? {sap:u.sap, role:u.role} : null; lsSet("eahs_session", session); }

/* ======================= НҮҮР / НЭВТРЭХ ======================= */
function landing(){
  setSession(null); view(landing, false);
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
    const u = DB.users[keyOf(sap)];
    let ok = false;
    if(u && u.role===role){
      if(u.pinHash) ok = (await hashPin(u.sap, pin)) === u.pinHash;
      else if(u.pin!=null) ok = String(u.pin)===pin;   // хуучин бичлэг (migratePins хөрвүүлнэ)
    }
    if(!ok){ $("#lerr").textContent = "SAP эсвэл нууц үг буруу байна"; return; }
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
    ${appbar("ЭАХС · Ажилтан", esc(u.alba||""))}
    <main class="page">
    <div class="card row-between"><div class="hello"><span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span><div><b>${esc(u.name)}</b><div class="muted">SAP ${esc(u.sap)} · ${esc(u.alba)}</div></div></div>
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
    <button class="btn ghost" id="haz">${ic("alert")} Аюул мэдэгдэх</button></main>`);
  $("#out").onclick = landing;
  $("#uhaan").onclick = uhaanForm;
  $("#fat").onclick = ()=> needF ? fatigueForm() : toast("Одоо бөглөх шаардлагагүй");
  $("#inf").onclick = ()=> roster && !infect ? infectForm() : toast(roster?"Өнөөдөр бөглөсөн":"Өнөөдөр хуваарь байхгүй");
  $("#haz").onclick = hazardForm;
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
      <p class="muted">${esc(u.name)} · ${esc(u.sap)} · ${today()} · ${esc(u.alba)}</p>
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
    write({["uhaan/"+id]: {id, sap:u.sap, name:u.name, alba:u.alba, job:$("#job").value, date:today(), time:nowStr(), a,b,c,
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
        <div class="cell"><span>${ic("lock")}Тасаг / Нэгж</span><b>${esc(u.alba)}</b></div>
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
    write({["fatigue/"+id]: {id, sap:u.sap, name:u.name, alba:u.alba, gender:u.gender, date:today(),
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
        <div class="cell">SAP / алба<b>${esc(u.sap)} · ${esc(u.alba)}</b></div>
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
    write({["infect/"+id]: {id, sap:u.sap, name:u.name, alba:u.alba, date:$("#arrive").value||today(),
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
  return {...x, types, cls};
}
const hzMark = on => on ? "☒" : "☐";
function hazardForm(){
  hazardPics = [];
  view(hazardForm, false);
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
          <div class="otv"><input id="area" list="albaList" maxlength="120" required value="${esc(u?.alba||"")}" placeholder="Жишээ: Оюут баар, гал тогоо"/>
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
    write({
      ["hazards/"+id]: {id, form:"OT-03-v2", area:$("#area").value.trim(), date:$("#hdate").value||today(), acc:$("#acc").value.trim(), reporter:$("#rep").value.trim(), reviewer:$("#rev").value.trim(),
        types:vals("type"), cls:vals("cls"), risk:vals("risk")[0], det:$("#det").value, act:$("#act").value,
        photoCount: hazardPics.length, status:"Шинэ", created:nowStr()},
      ["photos/"+id]: hazardPics.slice(0,8)
    });
    alert("Мэдэгдэл хүлээн авлаа.");
    back();
  };
}
/* Цаасан маягттай ижил хэвлэх хуудас (A4 босоо, 2 хуудас) */
async function hazardPrint(id){
  if(!requireRole("hygiene")) return;
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
  hygiene: [["тойм","Тойм"],["ариун","Ариун цэвэр"],["ядаргаа","Ядаргаа"],["аюул","Аюул"],["халдвар","Халдвар"],["хуваарь","Хуваарь"],["дэвтэр","Цагаан дэвтэр"],["ажилтан","Ажилтнууд"],["excel","Excel"],["тохиргоо","Тохиргоо"]],
  supervisor: [["тойм","УХААН шалгах"],["ариун","Ариун цэвэр"],["тохиргоо","Тохиргоо"]]
};
const NAV_IC = {"тойм":"grid","ариун":"drop","ядаргаа":"battery","аюул":"alert","халдвар":"virus","хуваарь":"calendar","дэвтэр":"book","ажилтан":"users","excel":"sheet","тохиргоо":"sliders"};
function shell(active, inner){
  const u = me(); const role = u?.role==="supervisor"?"supervisor":"hygiene";
  const title = role==="supervisor" ? `Ахлах · ${esc(u?.alba||"")}` : "Эрүүл ахуйчийн самбар";
  return `<div class="dash">
    <aside class="side">
      <div class="sbrand"><span class="slogo"><img src="/logo.png" alt="Ерөө говь ХХК"/></span><h1>${title}<small>ЭАХС · ${esc(u?.name||"")}</small></h1></div>
      <nav class="navs" aria-label="Цэс">
      ${NAV[role].map(([k,l])=>`<button class="navb ${active===k?"on":""}" data-nav="${k}" ${active===k?'aria-current="page"':""}>${ic(NAV_IC[k])}<span>${esc(l)}</span></button>`).join("")}
      <button class="navb out" data-nav="гарах">${ic("logout")}<span>Гарах</span></button>
      </nav>
      <div class="suser"><span class="avatar" aria-hidden="true">${esc(initials(u?.name))}</span><div><b>${esc(u?.name||"")}</b><span>${esc(roleName(u?.role))}${u?.alba?" · "+esc(u.alba):""}</span></div></div>
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
        "хуваарь":rosterPage, "дэвтэр":bookPage, "ажилтан":usersPage, "excel":reportPage, "тохиргоо":settingsPage, "гарах":landing}[nav]||(()=>{}))();
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
  const l = list("uhaan").filter(x=>x.alba===u.alba).sort(byNew);
  const app = mount(shell("тойм", `
    ${phead("УХААН шалгах", `${esc(u.alba)} · Өнөөдөр: ${today()}`)}
    ${hygDueCard(u.alba)}
    <div class="card"><div class="ctitle">${ic("checks")}<h3>УХААН — ${esc(u.alba)}</h3></div>${tbl(["Огноо","Нэр","Ажил","Төлөв",""], l.map(x=>`<tr data-u="${esc(x.id)}" class="click"><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.job||"")}</td><td>${stU(x)}</td><td><button class="btn sm" data-u="${esc(x.id)}">Нээх</button></td></tr>`), "УХААН бүртгэл алга")}</div>`));
  bindNav(app, e=>{ const b=e.target.closest("[data-open-hyg]"); if(b) hygEdit(today(), u.alba); });
}
function viewUhaan(id){
  const x=DB.uhaan[id]; if(!x) return;
  const u = me(); const who = u?.role;
  view(()=>viewUhaan(id), false);
  const sym = v => v==="ok"?"✓":v==="na"?"—":v==="no"?"✕":"?";
  const show=(a,pref,src)=>a.map((t,i)=>`<div class="item inl"><p>${esc(t)}</p><b>${sym((src||{})[pref+i])}</b></div>`).join("");
  const app = mount(`${appbar("УХААН · "+esc(x.name), esc(x.date), true)}<div class="paper"><div class="formcard">
    <p class="muted">${esc(x.date)} ${esc(x.time||"")} · ${esc(x.alba)} · ${esc(x.job||"")}</p>
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
  if(s==="Шинэ") return `<span class="badge b-new">Шинэ</span>`;
  if(s==="Шалгаж байна") return `<span class="badge b-wait">Шалгаж байна</span>`;
  return `<span class="badge b-ok">Шийдвэрлэсэн</span>`;
}
function hygieneHome(){
  const me_ = requireRole("hygiene"); if(!me_) return;
  view(hygieneHome, true);
  const u=list("uhaan").sort(byNew), f=list("fatigue").sort(byNew), h=list("hazards").sort(byNew), inf=list("infect");
  const ws=workers();
  const hi=f.filter(x=>x.level==="Өндөр" && x.date===today()).length;
  const neu=h.filter(x=>x.status==="Шинэ").length;
  const exp=ws.filter(w=>(w.bookExp && daysBetween(today(),w.bookExp)<=30) || (w.exam && daysBetween(today(),w.exam)<=30)).length;
  const infPend=inf.filter(x=>(!x.verdict||x.verdict==="huleegdej")).length;
  const infBlock=inf.filter(x=>x.verdict==="ersdel" && x.date===today()).length;
  const due = hygDue(today());
  const app = mount(shell("тойм", `
        ${phead("Хяналтын самбар", `${ic("calendar","sm")} Өнөөдөр: ${today()}`)}
        <div class="kpis">
          <div class="kpi k-red ${hi?"hot":""}"><i>${ic("battery")}</i><div>Өндөр ядаргаа<b>${hi}</b><span class="muted">өнөөдөр</span></div></div>
          <div class="kpi k-org"><i>${ic("alert")}</i><div>Шинэ аюул<b>${neu}</b><span class="muted">бүртгэл</span></div></div>
          <div class="kpi k-blu"><i>${ic("file")}</i><div>Баримт ≤30 хоног<b>${exp}</b><span class="muted">ажилтан</span></div></div>
          <div class="kpi k-vio"><i>${ic("virus")}</i><div>Халдвар шийдээгүй<b>${infPend}</b><span class="muted">өнөөдөр оруулахгүй: ${infBlock}</span></div></div>
          <div class="kpi k-grn"><i>${ic("drop")}</i><div>Ариун цэвэр өнөөдөр<b>${due.done}/${due.total}</b><span class="muted">бүртгэсэн / бүртгэх</span></div></div>
        </div>
        ${hygDueCard(null)}
        <div class="card"><div class="ctitle">${ic("alert")}<h3>Сүүлийн аюулын мэдээлэл</h3><button class="btn ghost sm" data-nav="аюул" style="margin-left:auto">Бүгд ${ic("chev","sm")}</button></div>
          ${h.slice(0,6).map(x=>`<div class="hzrow"><div><b>${esc(x.det||x.types?.[0]||"Аюул")}</b><div class="muted">${esc(x.date)} · ${esc(x.area)}</div></div>${stH(x.status)}</div>`).join("")||emptyState("Аюулын мэдээлэл алга","Ажилтнууд мэдээлэхэд энд харагдана","alert")}
        </div>
        <div class="card"><div class="ctitle">${ic("users")}<h3>Ажилтнуудын тойм</h3></div>
          ${tbl(["Ажилтан","SAP","Тасаг","Ядаргаа","Цагаан дэвтэр"], ws.map(w=>{
            const last=f.find(x=>x.sap===w.sap);
            return `<tr><td>${esc(w.name)}</td><td>${esc(w.sap)}</td><td>${esc(w.alba)}</td><td>${last?esc(last.level+" ("+last.score+")"):"—"}</td><td>${expBadge(w.bookExp)}</td></tr>`;
          }))}
        </div>
        <div class="card"><div class="ctitle">${ic("checks")}<h3>УХААН</h3></div>
          ${tbl(["Огноо","Нэр","Алба","Төлөв"], u.slice(0,12).map(x=>`<tr data-u="${esc(x.id)}" class="click"><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.alba)}</td><td>${stU(x)}</td></tr>`))}
        </div>`));
  bindNav(app, e=>{ const b=e.target.closest("[data-open-hyg]"); if(b) hygEdit(today(), b.dataset.openHyg); });
}

function fatigueListPage(){
  if(!requireRole("hygiene")) return;
  view(fatigueListPage, true);
  const f=list("fatigue").sort(byNew);
  const app = mount(shell("ядаргаа", `${phead("Ядаргааны үнэлгээ", "Ажилтнуудын бөглөсөн үнэлгээ, шинээс нь")}<div class="card">
    ${tbl(["Огноо","Нэр","Алба","Оноо","Түвшин"], f.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.alba)}</td><td>${esc(x.score)}</td><td>${x.level==="Өндөр"?'<span class="badge b-bad">Өндөр</span>':x.level==="Дунд"?'<span class="badge b-wait">Дунд</span>':x.level==="Бага"?'<span class="badge b-ok">Бага</span>':esc(x.level)}</td></tr>`), "Ядаргааны үнэлгээ алга")}</div>`));
  bindNav(app);
}
function hazardListPage(){
  if(!requireRole("hygiene")) return;
  view(hazardListPage, true);
  const h=list("hazards").map(normHazard).sort(byNew);
  const app = mount(shell("аюул", `${phead("Аюулын мэдээлэл", "OT-03-FRM-0001-D маягтаар ирсэн бүртгэлүүд")}
    ${h.map(x=>`<div class="card hzcard">
      <div class="row-between"><b>${ic("map","sm")} ${esc(x.date)} · ${esc(x.area)}</b>${stH(x.status)}</div>
      <div class="hzmeta">${x.risk?`<span class="tagp risk">Эрсдэл: ${esc(x.risk)}</span>`:""}<span class="tagp">${esc((x.types||[]).join(", "))} ${x.cls?.length?"· "+esc(x.cls.join(", ")):""}</span></div>
      <p class="det">${esc(x.det||"")}</p>
      ${x.act?`<p class="muted"><b>Авсан арга хэмжээ:</b> ${esc(x.act)}</p>`:""}
      <div class="people"><span>Мэдээлэгч: <b>${esc(x.reporter||"—")}</b></span><span>Хянасан: <b>${esc(x.reviewer||"—")}</b></span><span>Хариуцах: <b>${esc(x.acc||"—")}</b></span></div>
      <div class="thumbs" data-ph="${esc(x.id)}">${x.photoCount?`<span class="muted">Зураг ачаалж байна… (${esc(x.photoCount)})</span>`:""}</div>
      <div class="row-gap">
        <select data-st="${esc(x.id)}" aria-label="Төлөв">${["Шинэ","Шалгаж байна","Шийдвэрлэсэн"].map(s=>`<option ${s===x.status?"selected":""}>${s}</option>`).join("")}</select>
        <button class="btn ghost sm" data-prhz="${esc(x.id)}">${ic("printer","sm")} Хэвлэх</button>
        <button class="btn warn sm" data-delhz="${esc(x.id)}">${ic("trash","sm")} Устгах</button>
      </div>
    </div>`).join("")||`<div class="card">${emptyState("Аюулын мэдээлэл алга","Ажилтнууд «Аюулыг мэдээлэх» маягтаар илгээнэ","alert")}</div>`}`));
  bindNav(app, e=>{
    const pr=e.target.closest("[data-prhz]"); if(pr){ hazardPrint(pr.dataset.prhz); return; }
    const d=e.target.closest("[data-delhz]");
    if(d && confirm("Энэ аюулын бүртгэлийг устгах уу?")){ write({["hazards/"+d.dataset.delhz]:null, ["photos/"+d.dataset.delhz]:null}); toast("Устгалаа"); }
  });
  app.onchange = e=>{
    const s=e.target.closest("[data-st]");
    if(s) write({["hazards/"+s.dataset.st+"/status"]: s.value});
  };
  $$("[data-ph]").forEach(async el=>{
    const ps = await getPhotos(el.dataset.ph);
    el.innerHTML = ps.slice(0,8).map(p=>`<img src="${esc(p)}" alt="Аюулын зураг" loading="lazy">`).join("") || "";
  });
}
const VERDICT = {huleegdej:"Хүлээгдэж байна", orjbolno:"Орж болно", ersdel:"Ажилд оруулахгүй"};
function infectListPage(){
  if(!requireRole("hygiene")) return;
  view(infectListPage, true);
  const inf=list("infect").sort(byNew);
  const app = mount(shell("халдвар", `${phead("Халдвар — үр дүн гаргах", "Ажилтан зөвхөн бөглөсөн. Орж болно / оруулахгүй-г эндээс та тогтооно.")}
    ${inf.map(x=>{ const v = x.verdict && VERDICT[x.verdict] ? x.verdict : "huleegdej"; return `<div class="card">
      <div class="hello"><span class="avatar" aria-hidden="true">${esc(initials(x.name))}</span><div><b>${esc(x.name)}</b><div class="muted">${esc(x.date)} · ${esc(x.sap)} · ${esc(x.alba)}</div></div></div>
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
    ${tbl(["Нэр","SAP","Алба","Дэвтэр","Шинжилгээ"], ws.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(w.sap)}</td><td>${esc(w.alba)}</td><td>${esc(w.bookExp||"—")} ${expBadge(w.bookExp)}</td><td>${esc(w.exam||"—")} ${expBadge(w.exam)}</td></tr>`))}</div>`));
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
        <div><label class="f" for="rsap">Ажилтан</label><select id="rsap">${ws.map(u=>`<option value="${esc(u.sap)}">${esc(u.name)} (${esc(u.sap)}) · ${esc(u.alba)}</option>`).join("")}</select></div>
        <div><label class="f" for="arrive">Ирэх өдөр</label><input type="date" id="arrive" value="${today()}" required/></div>
        <div><label class="f" for="leave">Гарах өдөр</label><input type="date" id="leave"/></div>
      </div>
      <div class="gap"></div><button class="btn" type="submit">${ic("plus")} Нэмэх</button>
    </form>
    <div class="card">${tbl(["Ирэх","Нэр","Алба","Гарах",""], rs.map(x=>{ const w=DB.users[keyOf(x.sap)];
      return `<tr><td>${esc(x.arrive)}</td><td>${esc(x.name)}</td><td>${esc(w?.alba||"")}</td><td>${esc(x.leave||"")}</td><td><button class="btn warn sm" data-delr="${esc(x.id)}">${ic("trash","sm")} Устгах</button></td></tr>`;}), "Хуваарь бүртгээгүй байна")}</div>`));
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
        <div><label class="f" for="ualba">Алба</label><select id="ualba">${opt(ALBA.map(a=>[a,a]), ed?.alba||ALBA[1])}</select></div>
        <div><label class="f" for="ugender">Хүйс</label><select id="ugender">${opt([["Эр","Эр"],["Эм","Эм"]], ed?.gender||"Эр")}</select></div>
        <div><label class="f" for="ujob">Албан тушаал / ажил</label><input id="ujob" value="${esc(ed?.job||"")}"/></div>
        <div><label class="f" for="upin">Нууц үг ${ed?"(хоосон бол хэвээр)":"*"}</label><input id="upin" type="password" autocomplete="new-password" ${ed?"":"required"} minlength="4"/></div>
        <div><label class="f" for="ubook">Цагаан дэвтэр дуусах</label><input type="date" id="ubook" value="${esc(ed?.bookExp||"")}"/></div>
        <div><label class="f" for="uexam">Жилийн шинжилгээ дуусах</label><input type="date" id="uexam" value="${esc(ed?.exam||"")}"/></div>
      </div>
      <div class="gap"></div>
      <div class="row-gap"><button class="btn" type="submit">Хадгалах</button>${ed?'<button class="btn ghost" type="button" id="ucancel">Болих</button>':""}</div>
    </form>
    <div class="card"><div class="ctitle">${ic("users")}<h3>Бүх хэрэглэгч (${all.length})</h3></div>
    ${tbl(["Нэр","SAP","Үүрэг","Алба","Албан тушаал",""], all.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.sap)}</td><td>${esc(roleName(u.role))}</td><td>${esc(u.alba)}</td><td>${esc(u.job||"")}</td>
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
    if(d && confirm("Хэрэглэгчийг устгах уу? ("+d.dataset.delu+")")){ write({["users/"+keyOf(d.dataset.delu)]: null}); toast("Устгалаа"); }
  });
  if($("#ucancel")) $("#ucancel").onclick = ()=>usersPage();
  app.onsubmit = async e=>{
    e.preventDefault();
    const sap=$("#usap").value.trim(), pin=$("#upin").value.trim();
    if(!validKey(sap)){ toast("SAP-д . # $ [ ] / тэмдэгт орж болохгүй"); return; }
    if(!ed && DB.users[keyOf(sap)]){ toast("SAP давхардсан"); return; }
    if(pin && pin.length<4){ toast("Нууц үг дор хаяж 4 тэмдэгт"); return; }
    const rec = {...(ed||{}), sap, name:$("#unm").value.trim(), role:$("#urole").value, alba:$("#ualba").value, gender:$("#ugender").value,
      job:$("#ujob").value.trim(), bookExp:$("#ubook").value, exam:$("#uexam").value};
    delete rec.pin;
    if(pin){ rec.pinHash = await hashPin(sap, pin); delete rec.mustChange; }
    write({["users/"+keyOf(sap)]: rec});
    toast("Хадгаллаа"); usersPage();
  };
  let pending=null;
  $("#tmpl").onclick=async ()=>{
    if(typeof ExcelJS==="undefined"){ toast("Excel сан ачаалагдаагүй байна"); return; }
    const wb=new ExcelJS.Workbook(); const s=wb.addWorksheet("Ажилтан");
    s.addRow(["SAP","Нэр","Алба","Хүйс","Ажил","Нууц үг","Цагаан дэвтэр","Шинжилгээ"]);
    s.addRow(["50019999","Жишээ Нэр","Оюут баар","Эр","Тогооч","","2026-12-31","2026-11-01"]);
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
      if(alba && !ALBA.includes(alba)) errs.push(i+"-р мөр: Алба танигдаагүй («"+alba+"»)");
      if(gender && gender!=="Эр" && gender!=="Эм") errs.push(i+"-р мөр: Хүйс Эр/Эм биш");
      if(!pin) errs.push(i+"-р мөр: Нууц үг хоосон — «1234» болно, солиулна уу");
      rows.push({sap,name,role:"worker",alba:ALBA.includes(alba)?alba:(alba||"Оффис"),gender:gender==="Эм"?"Эм":"Эр",job,pin:pin||"1234",
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
      const rec={...p, pinHash: await hashPin(p.sap, p.pin)}; delete rec.pin;
      upd["users/"+keyOf(p.sap)] = rec;
    }
    if(Object.keys(upd).length) write(upd);
    alert("Орлоо: "+Object.keys(upd).length + (skip.length?" · давхардсан SAP: "+skip.join(", "):""));
    usersPage();
  };
}
function excelDate(v){
  if(v==null||v==="") return "";
  if(v instanceof Date) return ymd(v);
  if(typeof v==="number"){ const d=new Date(Math.round((v-25569)*86400*1000)); return d.toISOString().slice(0,10); }
  return String(v).slice(0,10);
}

/* ======================= ТОХИРГОО ======================= */
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
    <form class="card" id="pf">
      <div class="ctitle">${ic("key")}<h3>Нууц үг солих</h3></div>
      ${u.mustChange?'<div class="warnbox">Анхны нууц үгээ заавал солино уу.</div>':""}
      <input type="text" name="username" value="${esc(u.sap)}" autocomplete="username" hidden/>
      <label class="f" for="op">Одоогийн нууц үг</label><input type="password" id="op" autocomplete="current-password" required/>
      <label class="f" for="np">Шинэ нууц үг (дор хаяж 6)</label><input type="password" id="np" autocomplete="new-password" minlength="6" required/>
      <label class="f" for="np2">Шинэ нууц үг давтах</label><input type="password" id="np2" autocomplete="new-password" minlength="6" required/>
      <div class="gap"></div><button class="btn" type="submit">Солих</button>
    </form>`));
  bindNav(app);
  app.onsubmit = async e=>{
    e.preventDefault();
    if(e.target.id==="sf"){ write({"settings/main": {fatigueDays:Math.max(1,+$("#fd").value||7), blockExpired:$("#bl").value==="1"}}); toast("Хадгаллаа"); return; }
    if(e.target.id==="pf"){
      const cur = me();
      if((await hashPin(cur.sap,$("#op").value.trim()))!==cur.pinHash){ toast("Одоогийн нууц үг буруу"); return; }
      if($("#np").value!==$("#np2").value){ toast("Шинэ нууц үг таарахгүй байна"); return; }
      write({["users/"+keyOf(cur.sap)+"/pinHash"]: await hashPin(cur.sap,$("#np").value.trim()), ["users/"+keyOf(cur.sap)+"/mustChange"]: null});
      toast("Нууц үг солигдлоо"); e.target.reset();
    }
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
    .map(x=>({x, u:DB.users[keyOf(x.sap)]})).filter(o=>o.u && (!alba || o.u.alba===alba));
}
/* Уртын ээлжийн эхний өдрөөс эхлэн 2 өдөрт 1 удаа */
const isDueDay = (rosterEntry, date) => daysBetween(rosterEntry.arrive, date) % 2 === 0;
function hygDue(date, alba){
  const res = {total:0, done:0, byAlba:{}};
  activeRoster(date, alba).filter(o=>isDueDay(o.x, date)).forEach(o=>{
    const a = o.u.alba; const b = res.byAlba[a] = res.byAlba[a] || {total:0, done:0};
    const h = DB.hygcheck[sheetId(date, a)];
    const done = rowsOf(h).some(r=>r.sap===o.u.sap && rowStatus(r)!=="empty");
    res.total++; b.total++; if(done){ res.done++; b.done++; }
  });
  return res;
}
function hygDueCard(alba){
  const d = hygDue(today(), alba);
  const albas = alba ? [alba] : ALBA;
  return `<div class="card due"><div class="ctitle">${ic("drop")}<h3>Ариун цэврийн хяналт — өнөөдөр</h3><span class="muted">2 өдөрт 1 удаа (ээлжийн 1-р өдрөөс)</span></div>
    <div class="duegrid">${albas.map(a=>{ const b=d.byAlba[a]||{total:0,done:0}; const left=b.total-b.done;
      return `<button class="duebox ${left>0?"warn":b.total?"ok":""}" data-open-hyg="${esc(a)}"><b>${esc(a)}</b>
        <span>${b.total?`${b.done}/${b.total} бүртгэсэн`:"Өнөөдөр бүртгэх хүнгүй"}</span>${left>0?`<em>${left} үлдсэн</em>`:""}</button>`;}).join("")}</div></div>`;
}
function hygListPage(){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  view(hygListPage, true);
  const sup = u.role==="supervisor";
  const sheets = list("hygcheck").filter(h=>!sup || h.alba===u.alba).sort(byNew);
  const app = mount(shell("ариун", `${phead(esc(HYG_TITLE), "Огноо, албаа сонгоод хуудсаа нээнэ")}
    <form class="card" id="hf">
      <div class="g3">
        <div><label class="f" for="hd">Огноо</label><input type="date" id="hd" value="${today()}" required/></div>
        <div><label class="f" for="ha">Алба</label><select id="ha" ${sup?"disabled":""}>${ALBA.map(a=>`<option ${a===(sup?u.alba:ALBA[1])?"selected":""}>${esc(a)}</option>`).join("")}</select></div>
        <div class="end"><button class="btn" type="submit">Хуудас нээх / бөглөх</button></div>
      </div>
    </form>
    ${hygDueCard(sup?u.alba:null)}
    <div class="card"><div class="ctitle">${ic("file")}<h3>Бүртгэсэн хуудсууд</h3></div>
    ${tbl(["Огноо","Алба","Ажилтан","Хангаагүй","Шалгасан",""], sheets.map(h=>{ const rs=rowsOf(h); const bad=rs.filter(r=>rowStatus(r)==="fail").length;
      return `<tr><td>${esc(h.date)}</td><td>${esc(h.alba)}</td><td>${rs.length}</td><td>${bad?`<span class="badge b-bad">${bad}</span>`:'<span class="badge b-ok">0</span>'}</td>
      <td>${h.checkedBy?esc(h.checkedBy):'<span class="muted">—</span>'}</td>
      <td class="nowrap"><button class="btn sm" data-he="${esc(h.id)}">Засах</button> <button class="btn ghost sm" data-hp="${esc(h.id)}">${ic("printer","sm")} Хэвлэх</button>${sup?"":` <button class="btn warn sm" data-hdel="${esc(h.id)}">${ic("trash","sm")} Устгах</button>`}</td></tr>`;}), "Одоогоор хуудас бүртгээгүй")}
    </div>`));
  bindNav(app, e=>{
    const o=e.target.closest("[data-open-hyg]"); if(o){ hygEdit(today(), o.dataset.openHyg); return; }
    const he=e.target.closest("[data-he]"); if(he){ const h=DB.hygcheck[he.dataset.he]; if(h) hygEdit(h.date, h.alba); return; }
    const hp=e.target.closest("[data-hp]"); if(hp){ hygPrint(hp.dataset.hp); return; }
    const hd=e.target.closest("[data-hdel]");
    if(hd && confirm("Энэ хуудсыг устгах уу?")){ write({["hygcheck/"+hd.dataset.hdel]: null}); toast("Устгалаа"); }
  });
  app.onsubmit = e=>{ e.preventDefault(); hygEdit($("#hd").value||today(), sup?u.alba:$("#ha").value); };
}

function hygEdit(date, alba){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  if(u.role==="supervisor") alba = u.alba;
  view(()=>hygEdit(date, alba), false);
  const id = sheetId(date, alba);
  const orig = DB.hygcheck[id];
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
    const albaWorkers = users().filter(w=>w.alba===alba && w.role!=="hygiene" && !W.rows.some(r=>r.sap===w.sap)).sort((a,b)=>a.name.localeCompare(b.name));
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
    const upd = { [base+"/id"]:id, [base+"/date"]:date, [base+"/alba"]:alba, [base+"/checkedBy"]:W.checkedBy||"", [base+"/checkedAt"]:W.checkedAt||"",
      [base+"/_u"]:Date.now(), [base+"/updatedBy"]:u.name };
    if(isNew && !DB.hygcheck[id]) upd[base+"/createdBy"] = u.name;
    W.rows.forEach(r=>{
      const rp = base+"/rows/"+r.rk;
      if(dirty.has(r.rk)){ upd[rp+"/sap"]=r.sap||""; upd[rp+"/name"]=r.name||""; upd[rp+"/pos"]=r.pos||""; upd[rp+"/ord"]=r.ord||0; upd[rp+"/c"]=r.c.slice(); }
      if(dirtySign.has(r.rk)){ upd[rp+"/sign"]=!!r.sign; upd[rp+"/signAt"]=r.sign?(r.signAt||nowStr()):""; }
    });
    removed.forEach(rk=>upd[base+"/rows/"+rk]=null);
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
      <div class="sh-meta"><span>Алба: ${esc(h.alba||"")}</span><span>Огноо: <b>${esc(h.date||"")}</b></span></div>
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
  $("#pe").onclick = ()=>hygEdit(h.date, h.alba);
  $("#pb").onclick = hygListPage;
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
      <label class="chk"><input type="checkbox" id="x-ayul" checked/> Аюул (зурагтай)</label>
      <label class="chk"><input type="checkbox" id="x-inf" checked/> Халдварын асуумж</label>
      <label class="chk"><input type="checkbox" id="x-fat" checked/> Ядаргааны үнэлгээ</label>
      <div class="gap"></div>
      <button class="btn" type="submit" id="xl">${ic("download")} Татах</button>
    </form>`));
  bindNav(app);
  app.onsubmit = async e=>{
    e.preventDefault();
    const kinds=[["x-hyg","hyg"],["x-ayul","ayul"],["x-inf","inf"],["x-fat","fat"]].filter(([i])=>$("#"+i).checked).map(([,k])=>k);
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
  let nm = (h.date+" "+(h.alba||"")).replace(/[\\\/\?\*\[\]:]/g," ").slice(0,31);
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
  s.getCell("A2").value = "Алба: "+(h.alba||""); s.getCell("A2").font=font;
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
    const hs = list("hygcheck").filter(h=>inR(h.date)).sort((a,b)=>String(a.date+a.alba).localeCompare(String(b.date+b.alba)));
    const used = new Set();
    const sum = wb.addWorksheet("Ариун цэвэр (нэгтгэл)");
    sum.addRow(["Огноо","Алба","Ажилтны нэр","Албан тушаал",...HYG_CRIT,"Гарын үсэг","Дүгнэлт","Шалгасан"]);
    sum.getRow(1).font={bold:true}; sum.getRow(1).alignment={wrapText:true, vertical:"middle"};
    hs.forEach(h=> rowsOf(h).forEach(r=> sum.addRow([h.date,h.alba,r.name,r.pos,...HYG_CRIT.map((_,i)=>cellSym(cellVal(r,i))), r.sign?"Танилцсан":"", rowStatus(r)==="fail"?"Ажиллахгүй":rowStatus(r)==="ok"?"Хангасан":"Бүрэн бус", h.checkedBy||""])));
    sum.columns.forEach((c,i)=> c.width = i<2?12: i<4?22: 14);
    hs.forEach(h=>addHygSheet(wb, h, used));
  }
  if(kinds.includes("ayul")){
    const hz=list("hazards").map(normHazard).filter(x=>inR(x.date)).sort(byNew);
    const s1=wb.addWorksheet("Аюул");
    s1.addRow(["Огноо","Газар","Хариуцах","Мэдээлэгч","Хянасан","Төрөл","Ангилал","Эрсдэл","Дэлгэрэнгүй","Шуурхай арга","Зураг тоо","Төлөв"]);
    hz.forEach(x=>s1.addRow([x.date,x.area,x.acc,x.reporter,x.reviewer||"",(x.types||[]).join("; "),(x.cls||[]).join("; "),x.risk,x.det,x.act,x.photoCount||0,x.status]));
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
    list("infect").filter(x=>inR(x.date)).sort(byNew).forEach(x=>s2.addRow([x.date,x.sap,x.name,x.alba,VERDICT[x.verdict]||VERDICT.huleegdej,arr(x.ans).map(a=>a.q+": "+a.a).join("; ")]));
  }
  if(kinds.includes("fat")){
    const s3=wb.addWorksheet("Ядаргаа");
    s3.addRow(["Огноо","SAP","Нэр","Алба","Хүйс","24ц","48ц","Сэрүүн","Архи","Эм","Төвлөрөл","Оноо","Түвшин"]);
    list("fatigue").filter(x=>inR(x.date)).sort(byNew).forEach(x=>s3.addRow([x.date,x.sap,x.name,x.alba,x.gender,x.q5,x.q6,x.q7,x.q8,x.q10,x.q11,x.score,x.level]));
  }
  await downloadWb(wb, `EAHS_${kinds.join("-")}_${from}_${to}.xlsx`);
}

/* ======================= ЭХЛЭЛ ======================= */
(function boot(){
  let started=false;
  const start = ()=>{ started=true; homeFor(me()); };
  if(Object.keys(DB.users).length) start();       // локал өгөгдлөөр шууд харуулна
  else mount(`<div class="land"><div class="center"><img src="/logo.png" alt="" width="120" style="opacity:.9"/><p class="muted">Ачаалж байна…</p></div></div>`);
  initCloud().then(()=>{
    if(!started) start();
    else if(session && !me()) landing();
    else scheduleRender();
  });
})();
