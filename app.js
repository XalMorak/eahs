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
            <div class="logo" aria-hidden="true">🍃</div>
            <div><h1>ЭАХС</h1><p>Эрүүл ахуйн хяналтын систем</p></div>
          </div>
          <nav class="menu">
            <button class="menu-btn solid" data-g="worker">👤 Ажилтан нэвтрэх <span>›</span></button>
            <button class="menu-btn line" data-g="hazard">⚠ Аюулыг мэдээлэх (нэвтрэхгүй) <span>›</span></button>
            <button class="menu-btn solid" data-g="supervisor">📋 Ахлах нэвтрэх <span>›</span></button>
            <button class="menu-btn solid" data-g="hygiene">✚ Эрүүл ахуйчийн самбар <span>›</span></button>
          </nav>
        </div>
        <div class="foot-sites">Оюут · Манлай · Эрчим баар · Оффис</div>
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
    <header class="fhead"><h2>ЭАХС</h2><span>${esc(roleName(role))} нэвтрэх</span></header>
    <div class="loginbox">
      <form class="card" id="lf" autocomplete="on">
        <label class="f" for="sap">SAP / нэвтрэх нэр</label><input id="sap" name="username" autocomplete="username" required/>
        <label class="f" for="pin">Нууц үг</label><input id="pin" name="password" type="password" autocomplete="current-password" required/>
        <div id="lerr" class="errtxt" role="alert"></div>
        <button class="btn" type="submit">Нэвтрэх</button>
        <div class="gap"></div>
        <button class="btn ghost" type="button" id="back">Буцах</button>
      </form>
    </div>`);
  $("#sap").focus();
  $("#back").onclick = landing;
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
    hygHtml = `<div class="card"><b>Ариун цэврийн хяналт · ${esc(hs.h.date)}</b>
      <p>${st==="fail"?'<span class="badge b-bad">Шаардлага хангаагүй — ажиллахгүй</span>':st==="ok"?'<span class="badge b-ok">Шаардлага хангасан</span>':'<span class="badge b-wait">Бүрэн шалгаагүй</span>'}</p>
      <div class="critmini">${HYG_CRIT.map((c,i)=>`<span class="${cellVal(r,i)==="no"?"bad":cellVal(r,i)==="ok"?"good":""}">${cellSym(cellVal(r,i))||"·"} ${esc(c)}</span>`).join("")}</div>
      ${r.sign?`<p class="muted">Танилцсан: ${esc(r.signAt||"")}</p>`:`<button class="btn" id="hsign" data-id="${esc(hs.h.id)}" data-rk="${esc(hs.rk)}">Танилцсан (гарын үсэг)</button>`}
    </div>`;
  }
  const app = mount(`
    <header class="fhead"><h2>ЭАХС · Ажилтан</h2><span>${esc(u.name)}</span></header>
    <main class="page">
    <div class="card row-between"><div><b>${esc(u.name)}</b><div class="muted">SAP ${esc(u.sap)} · ${esc(u.alba)}</div></div>
      <button class="btn ghost sm" id="out">Гарах</button></div>
    <button class="home-btn" id="uhaan"><b>УХААН</b>
      <span class="muted">${uhaan.length?"Өнөөдөр бөглөсөн":"Өнөөдөр бөглөөгүй — ажил эхлэхийн өмнө"}</span></button>
    <button class="home-btn" id="fat"><b>Ядаргаа</b>
      <span class="muted">${needF?"Бөглөх хугацаа болсон":"Дараагийн бөглөлт хүлээгдэж байна"}</span></button>
    <button class="home-btn" id="inf"><b>Халдварын асуумж</b>
      <span class="muted">${esc(infTxt)}</span></button>
    ${hygHtml}
    <div class="card"><b>Миний баримт</b>
      <p>Цагаан дэвтэр: ${esc(u.bookExp||"—")} ${expBadge(u.bookExp)}</p>
      <p>Жилийн шинжилгээ: ${esc(u.exam||"—")} ${expBadge(u.exam)}</p>
    </div>
    <button class="btn ghost" id="haz">⚠ Аюул мэдэгдэх</button></main>`);
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
    <header class="fhead"><h2>УХААН</h2><span>${esc(u.name)}</span></header>
    <div class="paper">
      <h3>Ямагт ажил эхлэхийн өмнө УХААН-ы тохирлыг шалгадаг байх</h3>
      <p class="muted">${esc(u.name)} · ${esc(u.sap)} · ${today()} · ${esc(u.alba)}</p>
      <label class="f" for="job">Миний ажил</label><input id="job" value="${esc(u.job||"")}"/>
      <h4>Урьдаар ажлаа нарийн тооц</h4>
      ${U1.map((t,i)=>triRow("a"+i,t)).join("")}
      <p class="muted">Хэрэв БАЙГАА бол журмыг уншиж ойлгосон байх. Хэрэв ТИЙМ бол ойр ажилтнуудад анхааруулах.</p>
      <h4>Хор хөнөөл, аюул бүрийг тодорхойл</h4>
      ${U2.map((t,i)=>triRow("b"+i,t)).join("")}
      <p class="warnbox">Агааржуулалт ✕ бол ажлаа зогсоож хяналтанд авна.</p>
      <h4>Миний хийх ажил надаас дараахыг шаардана</h4>
      ${U3.map((t,i)=>triRow("c"+i,t)).join("")}
      <p class="warnbox">Аль нэг ✓ (шаардана) бол ажлаа зогсоож хяналтанд авна.</p>
      <label class="f" for="risk">Аюулыг удирдаагүйгээс юу тохиолдож болох вэ?</label><textarea id="risk" maxlength="1000"></textarea>
      <label class="f" for="ctrl">Ямар хяналтуудыг хэрэгжүүлж болох вэ?</label><textarea id="ctrl" maxlength="1000"></textarea>
      <p>Нэн тэргүүнд аюулгүй бай. Хянах боломжгүй бол ажлаа зогсоож ахлагчид мэдэгд.</p>
      <button class="btn" id="send">Илгээх</button>
      <div class="gap"></div>
      <button class="btn ghost" id="back">Буцах</button>
    </div>`);
  bindTri(app);
  $("#back").onclick = workerHome;
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
    <header class="fhead"><h2>✚ Алжаал ядаргааны үнэлгээ</h2><span>Олон нийтийн эрүүл мэндийн үнэлгээний хэрэгсэл</span></header>
    <main class="fwrap">
      <div class="lockgrid">
        <div class="cell">🔒 SAP<b>${esc(u.sap)}</b></div>
        <div class="cell">🔒 Нэр<b>${esc(u.name)}</b></div>
        <div class="cell">🔒 Огноо<b>${today()}</b></div>
        <div class="cell">🔒 Тасаг / Нэгж<b>${esc(u.alba)}</b></div>
      </div>
      ${qblock("q5","1. Сүүлийн 24 цагийн унтах хугацаа (ойролцоогоор)","Та сүүлийн 24 цагт нийт хэдэн цаг унтав?",["7 ба түүнээс их","6-7 цаг","6 цагаас бага"])}
      ${qblock("q6","2. Сүүлийн 48 цагийн унтах хугацаа (ойролцоогоор)","Та сүүлийн 48 цагт нийт хэдэн цаг унтав?",["14 цагаас их","12-14","12 цагаас бага"])}
      ${qblock("q7","3. Ээлж дуусах үед сэрүүн байсан цаг (ойролцоогоор)","Та ээлж эхэлснээс хойш ээлж дуустал хэдэн цаг сэрүүн байв?",["14 цагаас бага","14-16","16 цагаас илүү"])}
      ${qblock("q8", "4. Сүүлийн 24 цагийн архины хэрэглээ (стандарт нэгж) — "+(g?"ЭМ":"ЭР"),"Та сүүлийн 24 цагт хэдэн стандарт нэгж архи хэрэглэсэн бэ?",["хэрэглээгүй","1-3","4-6"])}
      ${qblock("q10","5. Эмийн хэрэглээ (сүүлийн 24 цаг)","Та сүүлийн 24 цагт ямар нэг эм, нойрны эм, тайвшруулах эм хэрэглэсэн үү?",["Үгүй","Тийм"])}
      ${qblock("q11","6. Анхаарал төвлөрөл / Сэтгэцийн хурц байдал","Та өөрийгөө ямар түвшинд үнэлэх вэ?",["Маш сайн / Хурц","Дунд зэрэг / Хангалттай","Муу / Бүдэг"])}
      <button class="btn" id="calc">Оноо тооцох →</button>
      <div class="gap"></div><button class="btn ghost" id="back">Буцах</button>
    </main>`);
  bindOpts(app);
  $("#back").onclick = workerHome;
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
    <header class="fhead"><h2>Гэдэсний халдварт өвчнийг тандах</h2></header>
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
      <button class="btn" id="send">Илгээх</button>
      <div class="gap"></div>
      <button class="btn ghost" id="back">Буцах</button>
    </main>`);
  bindOpts(app);
  $("#back").onclick = workerHome;
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
const HZ_CLS = ["Бодис","Биологийн","Цаг агаарын","Тээврийн хэрэгсэл","Цахилгаан","Байгалийн орчин","Эргономик","Гэрэлтүүлэг","Механик","Хувь хүний","Даралт","Дуу чимээ","Ажлын орчин","Дулаан","Гадаа аюул","Хог хаягдал"];
function hazardForm(){
  hazardPics = [];
  view(hazardForm, false);
  const u = me();
  const back = ()=> u? homeFor(u) : landing();
  const app = mount(`
    <div class="hpage"><div class="hcard">
      <div class="hhead">
        <div><b class="teal">Oyu Tolgoi</b></div>
        <div class="center"><h2>АЮУЛЫГ МЭДЭЭЛЭХ ХУУДАС</h2><div class="muted">RECORD AN OBSERVED HAZARD</div></div>
        <div aria-hidden="true">🛡</div>
      </div>
      <div class="hbar">ЕРӨНХИЙ МЭДЭЭЛЭЛ  GENERAL INFORMATION</div>
      <div class="hgrid">
        <div><label for="area">Ажлын талбар</label><select id="area">${ALBA.map(a=>`<option>${esc(a)}</option>`).join("")}</select></div>
        <div><label for="hdate">Огноо</label><input type="date" id="hdate" value="${today()}"/></div>
        <div><label for="acc">Хариуцах хэлтэс</label><input id="acc" maxlength="100" placeholder="Сонгоно уу"/></div>
        <div><label for="rep">Мэдээлэгч</label><input id="rep" maxlength="100" value="${esc(u?.name||"")}" placeholder="Нэр, албан тушаал"/></div>
        <div><label for="rev">Шалгагч</label><input id="rev" maxlength="100" placeholder="Нэр, албан тушаал"/></div>
      </div>
      <div class="hbar">АЮУЛЫН ТАЙЛБАР  HAZARD DESCRIPTION</div>
      <p>Аюулын төрөл / Hazard type</p>
      <div class="types" id="types">${["Эрүүл мэнд / Health","Аюулгүй байдал / Safety","Байгаль орчин / Environment","Хамгаалалт / Security"].map(t=>`<label><input type="checkbox" value="${esc(t.split(" / ")[0])}"/> ${esc(t)}</label>`).join("")}</div>
      <p>Аюулын ангилал (нэгийг сонгоно)</p>
      <div class="cls" id="cls">${HZ_CLS.map(t=>`<button type="button">${esc(t)}</button>`).join("")}</div>
      <label class="f" for="det">Аюулын дэлгэрэнгүй тайлбар</label><textarea id="det" maxlength="1000" rows="3" placeholder="Аюулын байршил, нөхцөл, юу ажиглагдсаныг дэлгэрэнгүй бичнэ үү..."></textarea>
      <label class="f" for="act">Шууд авсан арга хэмжээ</label><textarea id="act" maxlength="500" rows="2" placeholder="Аюулыг бууруулах эсвэл арилгахын тулд шууд юу хийсэн бэ?..."></textarea>
      <label class="f" for="risk">Эрсдэл</label>
      <select id="risk"><option>Бага</option><option>Дунд зэрэг</option><option>Их</option><option>Маш их</option></select>
      <label class="drop">📷 Зураг оруулах — багадаа 2, дээд тал нь 8 зураг (JPG/PNG)
        <input type="file" id="pics" accept="image/*" multiple/></label>
      <div class="thumbs" id="thumbs"></div>
      <button class="btn" id="send">✉ Илгээх / Submit</button>
      <p class="muted center">🔒 Таны мэдээлэл нууцлагдана.</p>
      <button class="btn ghost" id="back">Буцах</button>
    </div></div>`);
  let pickedCls="";
  $("#cls").onclick=e=>{
    const b=e.target.closest("button"); if(!b) return;
    $$("#cls button").forEach(x=>x.classList.remove("on"));
    b.classList.add("on"); pickedCls=b.textContent;
  };
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
  $("#send").onclick = ()=>{
    if(hazardPics.length<2){ toast("Багадаа 2 зураг оруулна уу"); return; }
    if(!$("#det").value.trim()){ toast("Аюулын тайлбар бичнэ үү"); return; }
    const types=$$("#types input:checked").map(x=>x.value);
    const id=uid();
    write({
      ["hazards/"+id]: {id, area:$("#area").value, date:$("#hdate").value||today(), acc:$("#acc").value, reporter:$("#rep").value, reviewer:$("#rev").value,
        types, cls:pickedCls?[pickedCls]:[], risk:$("#risk").value, det:$("#det").value, act:$("#act").value,
        photoCount: hazardPics.length, status:"Шинэ", created:nowStr()},
      ["photos/"+id]: hazardPics.slice(0,8)
    });
    alert("Мэдэгдэл хүлээн авлаа.");
    back();
  };
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
function shell(active, inner){
  const u = me(); const role = u?.role==="supervisor"?"supervisor":"hygiene";
  const title = role==="supervisor" ? `📋 Ахлах · ${esc(u?.alba||"")}` : "✚ Эрүүл ахуйчийн хяналтын самбар";
  return `<div class="dash">
    <aside class="side">
      <h1>${title}<small>${esc(u?.name||"")}</small></h1>
      <nav class="navs">
      ${NAV[role].map(([k,l])=>`<button class="navb ${active===k?"on":""}" data-nav="${k}" ${active===k?'aria-current="page"':""}>${esc(l)}</button>`).join("")}
      <button class="navb out" data-nav="гарах">Гарах</button>
      </nav>
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
const tbl = (head, rows, empty="Хоосон") =>
  `<div class="tw"><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")||`<tr><td colspan="${head.length}" class="muted">${esc(empty)}</td></tr>`}</tbody></table></div>`;
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
    <h2 class="pt">УХААН шалгах</h2>
    <p class="muted">${esc(u.alba)} · Өнөөдөр: ${today()}</p>
    ${hygDueCard(u.alba)}
    <div class="card"><h3>УХААН — ${esc(u.alba)}</h3>${tbl(["Огноо","Нэр","Ажил","Төлөв",""], l.map(x=>`<tr data-u="${esc(x.id)}" class="click"><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.job||"")}</td><td>${stU(x)}</td><td><button class="btn sm" data-u="${esc(x.id)}">Нээх</button></td></tr>`))}</div>`));
  bindNav(app, e=>{ const b=e.target.closest("[data-open-hyg]"); if(b) hygEdit(today(), u.alba); });
}
function viewUhaan(id){
  const x=DB.uhaan[id]; if(!x) return;
  const u = me(); const who = u?.role;
  view(()=>viewUhaan(id), false);
  const sym = v => v==="ok"?"✓":v==="na"?"—":v==="no"?"✕":"?";
  const show=(a,pref,src)=>a.map((t,i)=>`<div class="item"><p>${esc(t)}</p><b>${sym((src||{})[pref+i])}</b></div>`).join("");
  const app = mount(`<header class="fhead"><h2>УХААН · ${esc(x.name)}</h2><span>${esc(x.date)}</span></header><div class="paper">
    <p class="muted">${esc(x.date)} ${esc(x.time||"")} · ${esc(x.alba)} · ${esc(x.job||"")}</p>
    ${x.stop?'<div class="warnbox">Зогсоох нөхцөл илэрсэн</div>':""}
    <h4>Урьдаар тооц</h4>${show(U1,"a",x.a)}
    <h4>Хор хөнөөл</h4>${show(U2,"b",x.b)}
    <h4>Ажлын шаардлага</h4>${show(U3,"c",x.c)}
    <p><b>Эрсдэл:</b> ${esc(x.risk||"—")}</p>
    <p><b>Хяналт:</b> ${esc(x.ctrl||"—")}</p>
    <p>Ахлах: ${esc(x.supervisor||"хүлээгдэж")} ${x.note?"· "+esc(x.note):""}</p>
    ${who==="supervisor" && x.status==="huleegdej"?`<button class="btn" id="ok">Батална</button><div class="gap"></div><button class="btn warn" id="no">Буцаа</button>`:""}
    <div class="gap"></div><button class="btn ghost" id="back">Буцах</button>
  </div>`);
  const back = ()=> who==="supervisor"?supervisorHome():hygieneHome();
  $("#back").onclick=back;
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
        <h2 class="pt">Эрүүл ахуйчийн хяналтын самбар</h2>
        <p class="muted">Өнөөдөр: ${today()}</p>
        <div class="kpis">
          <div class="kpi"><i style="background:#d92d20">🔋</i><div>Өндөр ядаргаа<b>${hi}</b><span class="muted">өнөөдөр</span></div></div>
          <div class="kpi"><i style="background:#dc6803">⚠</i><div>Шинэ аюул<b>${neu}</b><span class="muted">бүртгэл</span></div></div>
          <div class="kpi"><i style="background:#1570ef">📄</i><div>Баримт ≤30 хоног<b>${exp}</b><span class="muted">ажилтан</span></div></div>
          <div class="kpi"><i style="background:#7a5af8">🦠</i><div>Халдвар шийдээгүй<b>${infPend}</b><span class="muted">өнөөдөр оруулахгүй: ${infBlock}</span></div></div>
          <div class="kpi"><i style="background:#079455">🧼</i><div>Ариун цэвэр өнөөдөр<b>${due.done}/${due.total}</b><span class="muted">бүртгэсэн / бүртгэх</span></div></div>
        </div>
        ${hygDueCard(null)}
        <div class="card"><h3>Аюулын жагсаалт</h3>
          ${h.slice(0,6).map(x=>`<div class="item"><div><b>${esc(x.det||x.types?.[0]||"Аюул")}</b><div class="muted">${esc(x.date)} · ${esc(x.area)}</div></div>${stH(x.status)}</div>`).join("")||'<p class="muted">Хоосон</p>'}
        </div>
        <div class="card"><h3>Ажилтнуудын тойм</h3>
          ${tbl(["Ажилтан","SAP","Тасаг","Ядаргаа","Цагаан дэвтэр"], ws.map(w=>{
            const last=f.find(x=>x.sap===w.sap);
            return `<tr><td>${esc(w.name)}</td><td>${esc(w.sap)}</td><td>${esc(w.alba)}</td><td>${last?esc(last.level+" ("+last.score+")"):"—"}</td><td>${expBadge(w.bookExp)}</td></tr>`;
          }))}
        </div>
        <div class="card"><h3>УХААН</h3>
          ${tbl(["Огноо","Нэр","Алба","Төлөв"], u.slice(0,12).map(x=>`<tr data-u="${esc(x.id)}" class="click"><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.alba)}</td><td>${stU(x)}</td></tr>`))}
        </div>`));
  bindNav(app, e=>{ const b=e.target.closest("[data-open-hyg]"); if(b) hygEdit(today(), b.dataset.openHyg); });
}

function fatigueListPage(){
  if(!requireRole("hygiene")) return;
  view(fatigueListPage, true);
  const f=list("fatigue").sort(byNew);
  const app = mount(shell("ядаргаа", `<h2 class="pt">Ядаргаа</h2><div class="card">
    ${tbl(["Огноо","Нэр","Алба","Оноо","Түвшин"], f.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.alba)}</td><td>${esc(x.score)}</td><td>${x.level==="Өндөр"?'<span class="badge b-bad">Өндөр</span>':esc(x.level)}</td></tr>`))}</div>`));
  bindNav(app);
}
function hazardListPage(){
  if(!requireRole("hygiene")) return;
  view(hazardListPage, true);
  const h=list("hazards").sort(byNew);
  const app = mount(shell("аюул", `<h2 class="pt">Аюул</h2>
    ${h.map(x=>`<div class="card">
      <div class="row-between"><b>${esc(x.date)} · ${esc(x.area)} · ${esc(x.risk)}</b>${stH(x.status)}</div>
      <div class="muted">${esc((x.types||[]).join(", "))} ${x.cls?.length?"· "+esc(x.cls.join(", ")):""}</div>
      <p>${esc(x.det||"")}</p>
      ${x.act?`<p class="muted"><b>Авсан арга хэмжээ:</b> ${esc(x.act)}</p>`:""}
      <p class="muted">Мэдээлэгч: ${esc(x.reporter||"—")} · Хариуцах: ${esc(x.acc||"—")}</p>
      <div class="thumbs" data-ph="${esc(x.id)}">${x.photoCount?`<span class="muted">Зураг ачаалж байна… (${esc(x.photoCount)})</span>`:""}</div>
      <div class="row-gap">
        <select data-st="${esc(x.id)}" aria-label="Төлөв">${["Шинэ","Шалгаж байна","Шийдвэрлэсэн"].map(s=>`<option ${s===x.status?"selected":""}>${s}</option>`).join("")}</select>
        <button class="btn warn sm" data-delhz="${esc(x.id)}">Устгах</button>
      </div>
    </div>`).join("")||'<p class="muted">Хоосон</p>'}`));
  bindNav(app, e=>{
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
  const app = mount(shell("халдвар", `<h2 class="pt">Халдвар — үр дүн гаргах</h2>
    <p class="muted">Ажилтан зөвхөн бөглөсөн. Орж болно / оруулахгүй-г эндээс та тогтооно.</p>
    ${inf.map(x=>{ const v = x.verdict && VERDICT[x.verdict] ? x.verdict : "huleegdej"; return `<div class="card">
      <b>${esc(x.date)} · ${esc(x.name)}</b> <span class="muted">${esc(x.sap)} · ${esc(x.alba)}</span>
      <div class="qa">${arr(x.ans).map(a=>`<div class="item"><p>${esc(a.q)}</p><b>${esc(a.a)}</b></div>`).join("")}</div>
      <label class="f">Үр дүн</label>
      <select data-inf="${esc(x.id)}" class="v-${v}">${Object.entries(VERDICT).map(([k,l])=>`<option value="${k}" ${k===v?"selected":""}>${l}</option>`).join("")}</select>
    </div>`;}).join("")||'<p class="muted">Хоосон</p>'}`));
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
  const app = mount(shell("дэвтэр", `<h2 class="pt">Цагаан дэвтэр / жилийн шинжилгээ</h2><div class="card">
    ${tbl(["Нэр","SAP","Алба","Дэвтэр","Шинжилгээ"], ws.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(w.sap)}</td><td>${esc(w.alba)}</td><td>${esc(w.bookExp||"—")} ${expBadge(w.bookExp)}</td><td>${esc(w.exam||"—")} ${expBadge(w.exam)}</td></tr>`))}</div>`));
  bindNav(app);
}
function rosterPage(){
  if(!requireRole("hygiene")) return;
  view(rosterPage, true);
  const ws=workers().sort((a,b)=>a.name.localeCompare(b.name));
  const rs=list("roster").sort((a,b)=>String(b.arrive).localeCompare(String(a.arrive)));
  const app = mount(shell("хуваарь", `<h2 class="pt">Талбарын хуваарь</h2>
    <form class="card" id="rf">
      <div class="g3">
        <div><label class="f" for="rsap">Ажилтан</label><select id="rsap">${ws.map(u=>`<option value="${esc(u.sap)}">${esc(u.name)} (${esc(u.sap)}) · ${esc(u.alba)}</option>`).join("")}</select></div>
        <div><label class="f" for="arrive">Ирэх өдөр</label><input type="date" id="arrive" value="${today()}" required/></div>
        <div><label class="f" for="leave">Гарах өдөр</label><input type="date" id="leave"/></div>
      </div>
      <div class="gap"></div><button class="btn" type="submit">Нэмэх</button>
    </form>
    <div class="card">${tbl(["Ирэх","Нэр","Алба","Гарах",""], rs.map(x=>{ const w=DB.users[keyOf(x.sap)];
      return `<tr><td>${esc(x.arrive)}</td><td>${esc(x.name)}</td><td>${esc(w?.alba||"")}</td><td>${esc(x.leave||"")}</td><td><button class="btn ghost sm" data-delr="${esc(x.id)}">Устгах</button></td></tr>`;}))}</div>`));
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
  const app = mount(shell("ажилтан", `<h2 class="pt">Ажилтнууд</h2>
    <form class="card" id="uf">
      <h3>${ed?"Засах: "+esc(ed.name):"Шинэ ажилтан"}</h3>
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
    <div class="card"><h3>Бүх хэрэглэгч (${all.length})</h3>
    ${tbl(["Нэр","SAP","Үүрэг","Алба","Албан тушаал",""], all.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.sap)}</td><td>${esc(roleName(u.role))}</td><td>${esc(u.alba)}</td><td>${esc(u.job||"")}</td>
      <td class="nowrap"><button class="btn ghost sm" data-edit="${esc(u.sap)}">Засах</button> ${u.sap===meU.sap?"":`<button class="btn warn sm" data-delu="${esc(u.sap)}">Устгах</button>`}</td></tr>`))}
    </div>
    <div class="card"><h3>Excel-ээр оруулах</h3>
      <p class="muted">Багана: SAP, Нэр, Алба, Хүйс, Ажил, Нууц үг, Цагаан дэвтэр, Шинжилгээ</p>
      <button class="btn ghost" id="tmpl" type="button">Загвар татах</button>
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
  const app = mount(shell("тохиргоо", `<h2 class="pt">Тохиргоо</h2>
    ${hyg?`<form class="card" id="sf">
      <h3>Ерөнхий</h3>
      <label class="f" for="fd">Ядаргаа хэд хоногт 1</label><input type="number" min="1" max="60" id="fd" value="${esc(s.fatigueDays)}"/>
      <label class="f" for="bl">Баримт дуусахад</label>
      <select id="bl"><option value="0">Зөвхөн анхааруул</option><option value="1" ${s.blockExpired?"selected":""}>Хоригло</option></select>
      <div class="gap"></div><button class="btn" type="submit">Хадгалах</button>
    </form>`:""}
    <form class="card" id="pf">
      <h3>Нууц үг солих</h3>
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
  return `<div class="card due"><div class="row-between"><h3>🧼 Ариун цэврийн хяналт — өнөөдөр</h3><span class="muted">2 өдөрт 1 удаа (ээлжийн 1-р өдрөөс)</span></div>
    <div class="duegrid">${albas.map(a=>{ const b=d.byAlba[a]||{total:0,done:0}; const left=b.total-b.done;
      return `<button class="duebox ${left>0?"warn":b.total?"ok":""}" data-open-hyg="${esc(a)}"><b>${esc(a)}</b>
        <span>${b.total?`${b.done}/${b.total} бүртгэсэн`:"Өнөөдөр бүртгэх хүнгүй"}</span>${left>0?`<em>${left} үлдсэн</em>`:""}</button>`;}).join("")}</div></div>`;
}
function hygListPage(){
  const u = requireRole("hygiene","supervisor"); if(!u) return;
  view(hygListPage, true);
  const sup = u.role==="supervisor";
  const sheets = list("hygcheck").filter(h=>!sup || h.alba===u.alba).sort(byNew);
  const app = mount(shell("ариун", `<h2 class="pt">${esc(HYG_TITLE)}</h2>
    <form class="card" id="hf">
      <div class="g3">
        <div><label class="f" for="hd">Огноо</label><input type="date" id="hd" value="${today()}" required/></div>
        <div><label class="f" for="ha">Алба</label><select id="ha" ${sup?"disabled":""}>${ALBA.map(a=>`<option ${a===(sup?u.alba:ALBA[1])?"selected":""}>${esc(a)}</option>`).join("")}</select></div>
        <div class="end"><button class="btn" type="submit">Хуудас нээх / бөглөх</button></div>
      </div>
    </form>
    ${hygDueCard(sup?u.alba:null)}
    <div class="card"><h3>Бүртгэсэн хуудсууд</h3>
    ${tbl(["Огноо","Алба","Ажилтан","Хангаагүй","Шалгасан",""], sheets.map(h=>{ const rs=rowsOf(h); const bad=rs.filter(r=>rowStatus(r)==="fail").length;
      return `<tr><td>${esc(h.date)}</td><td>${esc(h.alba)}</td><td>${rs.length}</td><td>${bad?`<span class="badge b-bad">${bad}</span>`:'<span class="badge b-ok">0</span>'}</td>
      <td>${h.checkedBy?esc(h.checkedBy):'<span class="muted">—</span>'}</td>
      <td class="nowrap"><button class="btn sm" data-he="${esc(h.id)}">Засах</button> <button class="btn ghost sm" data-hp="${esc(h.id)}">Хэвлэх</button>${sup?"":` <button class="btn warn sm" data-hdel="${esc(h.id)}">Устгах</button>`}</td></tr>`;}), "Одоогоор хуудас бүртгээгүй")}
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
      <div class="row-between wrap"><div><h2 class="pt">${esc(HYG_TITLE)}</h2>
        <p class="muted">Огноо: <b>${esc(date)}</b> · Алба: <b>${esc(alba)}</b> · ${isNew?"Шинэ хуудас":"Хадгалсан хуудас"} · ${W.rows.length} ажилтан ${failN?`· <span class="badge b-bad">${failN} ажиллахгүй</span>`:""}</p></div>
        <div class="row-gap"><button class="btn ghost sm" data-act="back">← Жагсаалт</button><button class="btn ghost sm" data-act="print">🖨 Хэвлэх</button></div></div>
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
          <div class="end"><button type="button" class="btn ghost" data-act="confirm">✔ Шалгасан гэж батлах</button></div>
          <div class="end muted">${W.checkedAt?"Баталсан: "+esc(W.checkedAt):""}</div>
        </div>
        <div class="notes"><b>Анхаарах:</b><ul>${HYG_NOTES.map(n=>`<li>${esc(n)}</li>`).join("")}</ul></div>
      </div>
      <div class="savebar"><button type="button" class="btn" data-act="save">Хадгалах</button><button type="button" class="btn ghost" data-act="saveprint">Хадгалаад хэвлэх</button></div>`;
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
      <button class="btn sm" id="pp">🖨 Хэвлэх (A4 хэвтээ)</button>
      <button class="btn ghost sm" id="pe">Засах</button>
      <button class="btn ghost sm" id="pb">← Жагсаалт</button>
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
  const app = mount(shell("excel", `<h2 class="pt">Excel татах</h2>
    <form class="card" id="xf">
      <p class="muted">УХААН орохгүй. Хэрэгтэй тайлангаа сонгоно уу.</p>
      <div class="g3">
        <div><label class="f" for="from">Эхлэх</label><input type="date" id="from" value="${addDays(-13)}"/></div>
        <div><label class="f" for="to">Дуусах</label><input type="date" id="to" value="${today()}"/></div>
      </div>
      <p><b>Аль тайлан</b></p>
      <label class="chk"><input type="checkbox" id="x-hyg" checked/> Ариун цэврийн хяналт (хуудас бүр тусдаа)</label>
      <label class="chk"><input type="checkbox" id="x-ayul" checked/> Аюул (зурагтай)</label>
      <label class="chk"><input type="checkbox" id="x-inf" checked/> Халдварын асуумж</label>
      <label class="chk"><input type="checkbox" id="x-fat" checked/> Ядаргааны үнэлгээ</label>
      <div class="gap"></div>
      <button class="btn" type="submit" id="xl">Татах</button>
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
    const hz=list("hazards").filter(x=>inR(x.date)).sort(byNew);
    const s1=wb.addWorksheet("Аюул");
    s1.addRow(["Огноо","Газар","Хариуцах","Мэдээлэгч","Төрөл","Ангилал","Эрсдэл","Дэлгэрэнгүй","Шуурхай арга","Зураг тоо","Төлөв"]);
    hz.forEach(x=>s1.addRow([x.date,x.area,x.acc,x.reporter,(x.types||[]).join("; "),(x.cls||[]).join("; "),x.risk,x.det,x.act,x.photoCount||0,x.status]));
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
  else mount(`<div class="land"><p class="muted">Ачаалж байна…</p></div>`);
  initCloud().then(()=>{
    if(!started) start();
    else if(session && !me()) landing();
    else scheduleRender();
  });
})();
