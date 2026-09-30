const ALBA = ["Оффис", "Оюут баар", "Манлай баар", "Эрчим баар"];
const HAZ_TYPES = ["Эрүүл мэнд", "Аюулгүй ажиллагаа", "Байгаль орчин", "Аюулгүй байдал"];
const HAZ_CLASS = ["Бодисууд","Байгаль орчин / эко систем","Хувийн / зан чанарын","Дулаан / гал / тэсрэлт","Биологийн","Эргономик","Даралт","Гадна аюулвууд","Цаг уур / байгалийн үзэгдэл","Бохир / хаягдал","Машин / тээврийн хэрэгсэл","Гэрэл","Дуу чимээ / доргион","Ажлын орчин","Цахилгаан / соронзон орон","Механик","Нийгэм / соёлын"];
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

const CLOUD_KEYS = ["eahs_users","eahs_settings","eahs_uhaan","eahs_fatigue","eahs_hazards","eahs_infect","eahs_roster"];
const firebaseConfig = {
  apiKey:"AIzaSyCj0zqo31QoCw2ggpOl2Aewu8u95azL6jQ",
  authDomain:"borluulalt-f9d70.firebaseapp.com",
  databaseURL:"https://borluulalt-f9d70-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"borluulalt-f9d70"
};
let _fb = null;
function load(k, d){ try{ const v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch{ return d; } }
function save(k, v){
  localStorage.setItem(k, JSON.stringify(v));
  if(_fb && CLOUD_KEYS.includes(k)){
    _fb.ref("eahs/"+k).set(v).catch(e=>console.warn("fb",e));
  }
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function today(){ return new Date().toISOString().slice(0,10); }
function nowStr(){ return new Date().toLocaleString("mn-MN"); }

function seedLocal(){
  if(!load("eahs_users", null)){
    localStorage.setItem("eahs_users", JSON.stringify([
      {sap:"1108650", name:"Б. Энхбаяр", role:"worker", alba:"Оюут баар", gender:"Эр", job:"Тусгаар", pin:"1234", book:"ЦД-2025-1", bookExp:"2026-12-10", exam:"2026-11-01"},
      {sap:"50012346", name:"С. Болормаа", role:"worker", alba:"Оюут баар", gender:"Эм", job:"Тогооч", pin:"1234", book:"ЦД-2025-2", bookExp:"2026-10-20", exam:"2026-12-01"},
      {sap:"akhakh", name:"Д. Ганболд", role:"supervisor", alba:"Оюут баар", gender:"Эр", job:"Ахлах", pin:"1234"},
      {sap:"admin", name:"Эрүүл ахуйч", role:"hygiene", alba:"Оффис", gender:"Эм", job:"Эрүүл ахуйч", pin:"1234"}
    ]));
  }
  if(!load("eahs_settings", null)){
    localStorage.setItem("eahs_settings", JSON.stringify({fatigueDays:7, blockExpired:false}));
  }
  ["eahs_uhaan","eahs_fatigue","eahs_hazards","eahs_infect","eahs_roster"].forEach(k=>{
    if(load(k,null)===null) localStorage.setItem(k, JSON.stringify([]));
  });
}

async function initCloud(){
  seedLocal();
  if(typeof firebase==="undefined") return;
  try{
    if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    _fb = firebase.database();
    if(firebase.auth){
      try{ await firebase.auth().signInAnonymously(); }catch(e){ console.warn(e); }
    }
    const snap = await _fb.ref("eahs").once("value");
    const cloud = snap.val();
    if(cloud){
      CLOUD_KEYS.forEach(k=>{
        if(cloud[k]!=null) localStorage.setItem(k, JSON.stringify(cloud[k]));
      });
    } else {
      const pack={};
      CLOUD_KEYS.forEach(k=>pack[k]=load(k, k==="eahs_settings"?{fatigueDays:7}:[]));
      await _fb.ref("eahs").set(pack);
    }
    _fb.ref("eahs").on("value", s=>{
      const v=s.val(); if(!v) return;
      CLOUD_KEYS.forEach(k=>{
        if(v[k]!=null) localStorage.setItem(k, JSON.stringify(v[k]));
      });
    });
  }catch(e){ console.warn("cloud", e); }
}

let session = load("eahs_session", null);
const $ = sel => document.querySelector(sel);
function setWho(){}
function roleName(r){ return {worker:"Ажилтан", supervisor:"Ахлах", hygiene:"Эрүүл ахуйч"}[r]||""; }

function go(fn){ $("#app").innerHTML = ""; fn(); }

function landing(){
  session = null; save("eahs_session", null);
  $("#app").innerHTML = `
    <div class="land">
      <div>
        <div class="land-in">
          <div class="brand">
            <div class="logo">🍃</div>
            <div>
              <h1>ЭАХС</h1>
              <p>Эрүүл ахуйн хяналтын систем</p>
            </div>
          </div>
          <div class="menu">
            <button class="menu-btn solid" data-g="login-worker">👤 Ажилтан нэвтрэх ›</button>
            <button class="menu-btn line" data-g="hazard">⚠ Аюулыг мэдээлэх (нэвтрэхгүй) ›</button>
            <button class="menu-btn solid" data-g="login-supervisor">📋 Ахлах нэвтрэх ›</button>
            <button class="menu-btn solid" data-g="login-hygiene">📋 Эрүүл ахуйчийн самбар ›</button>
          </div>
        </div>
        <div class="foot-sites">Оюут · Манлай · Эрчим баар · Оффис</div>
      </div>
    </div>`;
  $("#app").onclick = e=>{
    const g = e.target.closest("[data-g]")?.dataset.g;
    if(g==="hazard") hazardForm();
    if(g==="login-worker") loginForm("worker");
    if(g==="login-supervisor") loginForm("supervisor");
    if(g==="login-hygiene") loginForm("hygiene");
  };
}

function loginForm(role){
  $("#app").innerHTML = `
    <div class="fhead"><h2>ЭАХС</h2><span>${roleName(role)} нэвтрэх</span></div>
    <div class="loginbox">
      <div class="card">
        <label class="f">SAP / нэр</label><input id="sap" autocomplete="username"/>
        <label class="f">Нууц үг</label><input id="pin" type="password" autocomplete="current-password"/>
        <p class="muted">Жишээ: 1108650 / 1234 · akhakh / 1234 · admin / 1234</p>
        <button class="btn" id="ok">Нэвтрэх</button>
        <div style="height:8px"></div>
        <button class="btn ghost" id="back">Буцах</button>
      </div>
    </div>`;
  $("#back").onclick = landing;
  $("#ok").onclick = ()=>{
    const sap = $("#sap").value.trim();
    const pin = $("#pin").value.trim();
    const u = load("eahs_users",[]).find(x=>x.sap===sap && x.pin===pin && x.role===role);
    if(!u){ alert("Нэвтрэлт буруу"); return; }
    session = u; save("eahs_session", u);
    if(role==="worker") workerHome();
    else if(role==="supervisor") supervisorHome();
    else hygieneHome();
  };
}

function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }

function workerHome(){
  const set = load("eahs_settings",{});
  const uhaan = load("eahs_uhaan",[]).filter(x=>x.sap===session.sap && x.date===today());
  const lastF = load("eahs_fatigue",[]).filter(x=>x.sap===session.sap).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const needF = !lastF || daysBetween(lastF.date, today()) >= (set.fatigueDays||7);
  const roster = load("eahs_roster",[]).find(x=>x.sap===session.sap && x.arrive===today());
  const infect = load("eahs_infect",[]).find(x=>x.sap===session.sap && x.date===today());
  $("#app").innerHTML = `
    <div class="fhead"><h2>ЭАХС · Ажилтан</h2><span>${session.name}</span></div>
    <div class="page">
    <div class="card"><b>${session.name}</b><div class="muted">SAP ${session.sap} · ${session.alba}</div>
      <div style="height:8px"></div><button class="btn ghost" id="out">Гарах</button></div>
    <button class="home-btn" id="uhaan"><b>УХААН</b>
      <span class="muted">${uhaan.length?"Өнөөдөр бөглөсөн":"Өнөөдөр бөглөөгүй — ажил эхлэхийн өмнө"}</span></button>
    <button class="home-btn" id="fat"><b>Ядаргаа</b>
      <span class="muted">${needF?"Бөглөх хугацаа болсон":"Дараагийн бөглөлт хүлээгдэж байна"}</span></button>
    <button class="home-btn" id="inf"><b>Халдварын асуумж</b>
      <span class="muted">${roster?(infect?"Бөглөсөн":"Өнөөдөр талбарт ирэх хуваарьтай"):"Өнөөдөр хуваарь байхгүй"}</span></button>
    <div class="card"><b>Миний баримт</b>
      <p>Цагаан дэвтэр: ${session.bookExp||"—"} ${expBadge(session.bookExp)}</p>
      <p>Жилийн шинжилгээ: ${session.exam||"—"} ${expBadge(session.exam)}</p>
    </div>
    <button class="btn ghost" id="haz">Аюул мэдэгдэх</button></div>`;
  $("#out").onclick = landing;
  $("#uhaan").onclick = uhaanForm;
  $("#fat").onclick = ()=> needF ? fatigueForm() : alert("Одоо бөглөх шаардлагагүй");
  $("#inf").onclick = ()=> roster && !infect ? infectForm() : alert(roster?"Бөглөсөн":"Хуваарь байхгүй");
  $("#haz").onclick = hazardForm;
}
function expBadge(d){
  if(!d) return "";
  const left = daysBetween(today(), d);
  if(left<0) return `<span class="badge b-bad">Дууссан</span>`;
  if(left<=30) return `<span class="badge b-wait">Сарын дотор</span>`;
  return `<span class="badge b-ok">Хүчинтэй</span>`;
}

function triRow(id, text){
  return `<div class="item"><p>${text}</p>
    <div class="tri" data-id="${id}">
      <button type="button" data-v="ok">✓</button>
      <button type="button" data-v="na">—</button>
      <button type="button" data-v="no">✕</button>
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
  for(let i=0;i<n;i++){
    const g = document.querySelector(`.tri[data-id="${prefix}${i}"]`);
    o[prefix+i] = g?.dataset.val || "";
  }
  return o;
}

function uhaanForm(){
  $("#app").innerHTML = `
    <div class="paper">
      <h3>Ямагт ажил эхлэхийн өмнө УХААН-ы тохирлыг шалгадаг байх</h3>
      <p class="muted">${session.name} · ${session.sap} · ${today()} · ${session.alba}</p>
      <label>Миний ажил</label><input id="job" value="${session.job||""}"/>
      <h4>Урьдаар ажлаа нарийн тооц</h4>
      ${U1.map((t,i)=>triRow("a"+i,t)).join("")}
      <p class="muted">Хэрэв БАЙГАА бол журмыг уншиж ойлгосон байх. Хэрэв ТИЙМ бол ойр ажилтнуудад анхааруулах.</p>
      <h4>Хор хөнөөл, аюул бүрийг тодорхойл</h4>
      ${U2.map((t,i)=>triRow("b"+i,t)).join("")}
      <p class="warnbox">Агааржуулалт ✕ бол ажлаа зогсоож хяналтанд авна.</p>
      <h4>Миний хийх ажил надаас дараахыг шаардана</h4>
      ${U3.map((t,i)=>triRow("c"+i,t)).join("")}
      <p class="warnbox">Аль нэг ✓ (шаардана) бол ажлаа зогсоож хяналтанд авна.</p>
      <label>Аюулыг удирдаагүйгээс юу тохиолдож болох вэ?</label><textarea id="risk"></textarea>
      <label>Ямар хяналтуудыг хэрэгжүүлж болох вэ?</label><textarea id="ctrl"></textarea>
      <p>Нэн тэргүүнд аюулгүй бай. Хянах боломжгүй бол ажлаа зогсоож ахлагчид мэдэгд.</p>
      <button class="btn" id="send">Илгээх</button>
      <div style="height:8px"></div>
      <button class="btn ghost" id="back">Буцах</button>
    </div>`;
  bindTri($("#app"));
  $("#back").onclick = workerHome;
  $("#send").onclick = ()=>{
    const a=collectTri("a",U1.length), b=collectTri("b",U2.length), c=collectTri("c",U3.length);
    if(Object.values({...a,...b,...c}).some(v=>!v)){ alert("Бүх мөрийг ✓ / — / ✕-ээр тэмдэглэнэ үү"); return; }
    const stop = b.b3==="no" || Object.values(c).some(v=>v==="ok");
    const rec = {id:uid(), sap:session.sap, name:session.name, alba:session.alba, job:$("#job").value, date:today(), time:nowStr(), a,b,c, risk:$("#risk").value, ctrl:$("#ctrl").value, stop, status: stop?"zogsooson":"huleegdej", supervisor:null};
    const all=load("eahs_uhaan",[]); all.unshift(rec); save("eahs_uhaan", all);
    alert(stop?"Ажлаа зогсоо. Ахлах болон эрүүл ахуйчид мэдэгдлээ.":"Илгээгдлээ. Ахлах болон эрүүл ахуйч харна.");
    workerHome();
  };
}

function fatigueForm(){
  const g = session.gender==="Эм";
  $("#app").innerHTML = `
    <div class="fhead"><h2>✚ Алжаал ядаргааны үнэлгээ</h2><span>Олон нийтийн эрүүл мэндийн үнэлгээний хэрэгсэл</span></div>
    <div class="fwrap">
      <div class="lockgrid">
        <div class="cell">🔒 SAP<b>${session.sap}</b></div>
        <div class="cell">🔒 Нэр<b>${session.name}</b></div>
        <div class="cell">🔒 Огноо<b>${today()}</b></div>
        <div class="cell">🔒 Тасаг / Нэгж<b>${session.alba}</b></div>
      </div>
      <div class="chips">${ALBA.map(a=>`<span class="chip ${a===session.alba?"on":""}">${a}</span>`).join("")}</div>
      ${qblock("q5","5. Сүүлийн 24 цагийн унтах хугацаа (ойролцоогоор)","Та сүүлийн 24 цагт нийт хэдэн цаг унтав?",["7 ба түүнээс их","6-7 цаг","6 цагаас бага"])}
      ${qblock("q6","6. Сүүлийн 48 цагийн унтах хугацаа (ойролцоогоор)","Та сүүлийн 48 цагт нийт хэдэн цаг унтав?",["14 цагаас их","12-14","12 цагаас бага"])}
      ${qblock("q7","7. Ээлж дуусах үед сэрүүн байсан цаг (ойролцоогоор)","Та ээлж эхэлснээс хойш ээлж дуустал хэдэн цаг сэрүүн байв?",["14 цагаас бага","14-16","16 цагаас илүү"])}
      ${qblock("q8", g?"9. Сүүлийн 24 цагийн архины хэрэглээ (стандарт нэгж) — ЭМ":"8. Сүүлийн 24 цагийн архины хэрэглээ (стандарт нэгж) — ЭР","Та сүүлийн 24 цагт хэдэн стандарт нэгж архи хэрэглэсэн бэ?",["1-3","4-6","хэрэглээгүй"])}
      ${qblock("q10","10. Эмийн хэрэглээ (сүүлийн 24 цаг)","Та сүүлийн 24 цагт ямар нэг эм, нойрны эм, тайвшруулах эм хэрэглэсэн үү?",["Үгүй","Тийм"])}
      ${qblock("q11","11. Анхаарал төвлөрөл / Сэтгэцийн хурц байдал","Та өөрийгөө ямар түвшинд үнэлэх вэ?",["Маш сайн / Хурц","Дунд зэрэг / Хангалттай","Муу / Бүдэг"])}
      <button class="btn" id="calc">Оноо тооцох →</button>
      <div style="height:8px"></div><button class="btn ghost" id="back">Буцах</button>
    </div>`;
  $("#app").onclick = e=>{
    const o=e.target.closest(".opt");
    if(o){ o.parentElement.querySelectorAll(".opt").forEach(x=>x.classList.remove("on")); o.classList.add("on"); }
  };
  $("#back").onclick = workerHome;
  $("#calc").onclick = ()=>{
    const val = id => document.querySelector("#"+id+" .opt.on")?.textContent.trim();
    if(!val("q5")||!val("q6")||!val("q7")||!val("q8")||!val("q10")||!val("q11")){ alert("Бүх асуултыг сонгоно уу"); return; }
    const map3 = (v,opts)=>Math.max(0,opts.indexOf(v));
    const s5 = map3(val("q5"),["7 ба түүнээс их","6-7 цаг","6 цагаас бага"]);
    const s6 = map3(val("q6"),["14 цагаас их","12-14","12 цагаас бага"]);
    const s7 = map3(val("q7"),["14 цагаас бага","14-16","16 цагаас илүү"]);
    const s8 = val("q8")==="хэрэглээгүй"?0:val("q8")==="1-3"?1:2;
    const s10 = val("q10")==="Тийм"?2:0;
    const s11 = map3(val("q11"),["Маш сайн / Хурц","Дунд зэрэг / Хангалттай","Муу / Бүдэг"]);
    let score = s5+s6+s7+s8+s10+s11;
    let level = score<=3?"Бага":score<=7?"Дунд":"Өндөр";
    if(val("q10")==="Тийм" || s11===2) level = level==="Бага"?"Дунд":level;
    if(s8===2 && s5===2) level="Өндөр";
    const rec={id:uid(), sap:session.sap, name:session.name, alba:session.alba, gender:session.gender, date:today(),
      q5:val("q5"),q6:val("q6"),q7:val("q7"),q8:val("q8"),q10:val("q10"),q11:val("q11"),score,level};
    const all=load("eahs_fatigue",[]); all.unshift(rec); save("eahs_fatigue",all);
    alert(`${level} оноо: ${score}/12`+(level==="Өндөр"?" — ахлах/эрүүл ахуйчид мэдэгдлээ":""));
    workerHome();
  };
}
function qblock(id,title,sub,opts){
  return `<div class="qcard" id="${id}"><h3>${title}</h3><p class="muted">${sub}</p>
    <div class="opts">${opts.map(o=>`<div class="opt">${o}</div>`).join("")}</div></div>`;
}

function infectForm(){
  const qs = [
    {id:"f1", t:"Та сүүлийн 72 цагийн хугацаанд ил задгай хадгалсан, үнэр амт өөрчлөгдсөн, хордлого үүсгэж болзошгүй хоол хүнс хэрэглэсэн үү?", o:["Тийм","Үгүй"]},
    {id:"f2", t:"Таньд дотор муухайрах, гэдэс базлах, гүйлгэх шинж тэмдэг илэрч байна уу?", o:["Тийм","Үгүй","Илэрсэн, одоо эдгэсэн"]},
    {id:"f3", t:"Та амралтын хугацаанд дээрх шинж тэмдэг илэрсэн хүнтэй хавьтал болсон уу?", o:["Тийм","Үгүй","Мэдэхгүй"]},
    {id:"f4", t:"Танд бэртэл гэмтэл авсан зэрэг эрүүл мэндийн асуудал байна уу? (Тийм бол ахлах ажилтандаа мэдэгдэнэ үү)", o:["Тийм","Үгүй"]},
    {id:"f5", t:"Нойр, амралт хангалттай авч ажилдаа бэлэн байх нөхцөлийг хангаж чадаж байна уу?", o:["Тийм","Үгүй"]}
  ];
  $("#app").innerHTML = `
    <div class="fhead"><h2>Гэдэсний халдварт өвчнийг тандах</h2></div>
    <div class="fwrap">
      <p class="muted">ГХӨ-г эрт илрүүлэх, халдвар дамжихаас сэргийлэх зорилготой.</p>
      <div class="lockgrid" style="grid-template-columns:1fr 1fr">
        <div class="cell">Овог нэр<b>${session.name}</b></div>
        <div class="cell">SAP / алба<b>${session.sap} · ${session.alba}</b></div>
      </div>
      <label class="f">Ээлжинд ирэх хугацаа *</label>
      <input type="date" id="arrive" value="${today()}"/>
      ${qs.map(q=>`<div class="qcard" id="${q.id}"><h3>${q.t}</h3>
        <div class="opts" style="grid-template-columns:${q.o.length===3?"1fr 1fr 1fr":"1fr 1fr"}">
          ${q.o.map(o=>`<div class="opt">${o}</div>`).join("")}
        </div></div>`).join("")}
      <button class="btn" id="send">Илгээх</button>
      <div style="height:8px"></div>
      <button class="btn ghost" id="back">Буцах</button>
    </div>`;
  $("#app").onclick = e=>{
    const o=e.target.closest(".opt");
    if(o){ o.parentElement.querySelectorAll(".opt").forEach(x=>x.classList.remove("on")); o.classList.add("on"); }
  };
  $("#back").onclick = workerHome;
  $("#send").onclick = ()=>{
    const val = id => document.querySelector("#"+id+" .opt.on")?.textContent.trim();
    if(qs.some(q=>!val(q.id))){ alert("Бүх асуултыг хариулна уу"); return; }
    const ans = qs.map(q=>({q:q.t, a:val(q.id)}));
    const risk = val("f1")==="Тийм" || val("f2")==="Тийм" || val("f3")==="Тийм" || val("f4")==="Тийм" || val("f5")==="Үгүй";
    const all=load("eahs_infect",[]);
    all.unshift({id:uid(), sap:session.sap, name:session.name, alba:session.alba, date:$("#arrive").value||today(), ans, risk});
    save("eahs_infect", all);
    alert(risk?"Эрсдэлтэй — ажилд оруулахгүй. Эрүүл ахуйч / ахлах харна.":"Ажилд орж болно");
    workerHome();
  };
}

let hazardPics = [];
function hazardForm(){
  hazardPics = [];
  const CLS = ["Бодис","Биологийн","Цаг агаарын","Тээврийн хэрэгсэл","Цахилгаан","Байгалийн орчин","Эргономик","Гэрэлтүүлэг","Механик","Хувь хүний","Даралт","Дуу чимээ","Ажлын орчин","Дулаан","Гадаа аюул","Хог хаягдал"];
  $("#app").innerHTML = `
    <div class="hpage"><div class="hcard">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div><b style="color:#0E6B5C">Oyu Tolgoi</b></div>
        <div style="text-align:center"><h2 style="margin:0">АЮУЛЫГ МЭДЭЭЛЭХ ХУУДАС</h2><div class="muted">RECORD AN OBSERVED HAZARD</div></div>
        <div>🛡</div>
      </div>
      <div class="hbar">ЕРӨНХИЙ МЭДЭЭЛЭЛ  GENERAL INFORMATION</div>
      <div class="hgrid">
        <div><label>Ажлын талбар</label><select id="area">${ALBA.map(a=>`<option>${a}</option>`).join("")}</select></div>
        <div><label>Огноо</label><input type="date" id="hdate" value="${today()}"/></div>
        <div><label>Хариуцах хэлтэс</label><input id="acc" placeholder="Сонгоно уу"/></div>
        <div><label>Мэдээлэгч</label><input id="rep" value="${session?.name||""}" placeholder="Нэр, албан тушаал"/></div>
        <div><label>Шалгагч</label><input id="rev" placeholder="Нэр, албан тушаал"/></div>
      </div>
      <div class="hbar">АЮУЛЫН ТАЙЛБАР  HAZARD DESCRIPTION</div>
      <p>Аюулын төрөл / Hazard type</p>
      <div class="types" id="types">${["Эрүүл мэнд / Health","Аюулгүй байдал / Safety","Байгаль орчин / Environment","Хамгаалалт / Security"].map(t=>`<label><input type="checkbox" value="${t.split(" / ")[0]}"/> ${t}</label>`).join("")}</div>
      <p>Аюулын ангилал (нэгийг сонгоно)</p>
      <div class="cls" id="cls">${CLS.map(t=>`<button type="button">${t}</button>`).join("")}</div>
      <label class="f">Аюулын дэлгэрэнгүй тайлбар</label><textarea id="det" maxlength="1000" rows="3" placeholder="Аюулын байршил, нөхцөл, юу ажиглагдсаныг дэлгэрэнгүй бичнэ үү..."></textarea>
      <label class="f">Шууд авсан арга хэмжээ</label><textarea id="act" maxlength="500" rows="2" placeholder="Аюулыг бууруулах эсвэл арилгахын тулд шууд юу хийсэн бэ?..."></textarea>
      <label class="f">Эрсдэл</label>
      <select id="risk"><option>Бага</option><option>Дунд зэрэг</option><option>Их</option><option>Маш их</option></select>
      <div class="drop" style="margin-top:12px">📷 Зураг оруулах — багадаа 2 зураг (JPG/PNG, 5MB)
        <input type="file" id="pics" accept="image/*" multiple/></div>
      <div class="thumbs" id="thumbs"></div>
      <button class="btn" id="send" style="margin-top:12px">✉ Илгээх / Submit</button>
      <p class="muted" style="text-align:center">🔒 Таны мэдээлэл нууцлагдана.</p>
      <button class="btn ghost" id="back">Буцах</button>
    </div></div>`;
  let pickedCls="";
  $("#cls").onclick=e=>{
    const b=e.target.closest("button"); if(!b) return;
    $("#cls").querySelectorAll("button").forEach(x=>x.classList.remove("on"));
    b.classList.add("on"); pickedCls=b.textContent;
  };
  $("#pics").onchange = async e=>{
    for(const f of [...e.target.files]){
      const data = await fileToData(f);
      hazardPics.push(data);
    }
    $("#thumbs").innerHTML = hazardPics.map(s=>`<img src="${s}">`).join("");
  };
  $("#back").onclick = ()=> session?.role==="worker"?workerHome():landing();
  $("#send").onclick = ()=>{
    if(hazardPics.length<2){ alert("Багадаа 2 зураг оруулна уу"); return; }
    const types=[...document.querySelectorAll("#types input:checked")].map(x=>x.value);
    const rec={id:uid(), area:$("#area").value, date:$("#hdate").value, acc:$("#acc").value, reporter:$("#rep").value, reviewer:$("#rev").value, types, cls:pickedCls?[pickedCls]:[], risk:$("#risk").value, det:$("#det").value, act:$("#act").value, photos:hazardPics.slice(0,8), status:"Шинэ", created:nowStr()};
    const all=load("eahs_hazards",[]); all.unshift(rec); save("eahs_hazards",all);
    alert("Мэдэгдэл хүлээн авлаа.");
    session?.role==="worker"?workerHome():landing();
  };
}
function fileToData(f){
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const c=document.createElement("canvas");
        const w=Math.min(640,img.width), h=img.height*(w/img.width);
        c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",0.55));
      };
      img.src=r.result;
    };
    r.readAsDataURL(f);
  });
}

function supervisorHome(){
  const list = load("eahs_uhaan",[]).filter(x=>x.alba===session.alba);
  $("#app").innerHTML = `<div class="card"><b>Ахлах · ${session.alba}</b>
    <button class="btn ghost" id="out">Гарах</button></div>
    <div class="card"><h3>УХААН шалгах</h3>
    <table><tr><th>Огноо</th><th>Нэр</th><th>Төлөв</th><th></th></tr>
    ${list.map(x=>`<tr><td>${x.date}</td><td>${x.name}</td><td>${stU(x)}</td><td><button data-id="${x.id}" class="btn">Нээх</button></td></tr>`).join("")||"<tr><td colspan=4>Хоосон</td></tr>"}
    </table></div>`;
  $("#out").onclick=landing;
  $("#app").onclick=e=>{
    const id=e.target.dataset.id; if(!id) return;
    viewUhaan(id, "supervisor");
  };
}
function stU(x){
  if(x.stop) return `<span class="badge b-bad">Зогсоосон</span>`;
  if(x.status==="batlagdsan") return `<span class="badge b-ok">Батлагдсан</span>`;
  if(x.status==="butsaasan") return `<span class="badge b-wait">Буцаасан</span>`;
  return `<span class="badge b-wait">Хүлээгдэж</span>`;
}
function viewUhaan(id, who){
  const x=load("eahs_uhaan",[]).find(i=>i.id===id);
  if(!x) return;
  const show=(arr,pref,src)=>arr.map((t,i)=>`<div class="item"><p>${t}</p><b>${sym(src[pref+i])}</b></div>`).join("");
  function sym(v){ return v==="ok"?"✓":v==="na"?"—":v==="no"?"✕":"?"; }
  $("#app").innerHTML=`<div class="paper"><h3>УХААН · ${x.name}</h3>
    <p class="muted">${x.date} ${x.time} · ${x.alba} · ${x.job||""}</p>
    ${x.stop?'<div class="warnbox">Зогсоох нөхцөл илэрсэн</div>':""}
    <h4>Урьдаар тооц</h4>${show(U1,"a",x.a)}
    <h4>Хор хөнөөл</h4>${show(U2,"b",x.b)}
    <h4>Ажлын шаардлага</h4>${show(U3,"c",x.c)}
    <p><b>Эрсдэл:</b> ${x.risk||"—"}</p>
    <p><b>Хяналт:</b> ${x.ctrl||"—"}</p>
    <p>Ахлах: ${x.supervisor||"хүлээгдэж"}</p>
    ${who==="supervisor" && x.status==="huleegdej"?`<button class="btn" id="ok">Батална</button><div style="height:8px"></div><button class="btn warn" id="no">Буцаа</button>`:""}
    <div style="height:8px"></div><button class="btn ghost" id="back">Буцах</button>
  </div>`;
  $("#back").onclick=()=> who==="supervisor"?supervisorHome():hygieneHome();
  const ok=$("#ok"), no=$("#no");
  if(ok) ok.onclick=()=>{ patchU(id,{status:"batlagdsan", supervisor:session.name+" "+nowStr()}); supervisorHome(); };
  if(no) no.onclick=()=>{ const n=prompt("Шалтгаан")||""; patchU(id,{status:"butsaasan", supervisor:session.name+" "+nowStr(), note:n}); supervisorHome(); };
}
function patchU(id, p){
  const all=load("eahs_uhaan",[]);
  const i=all.findIndex(x=>x.id===id); if(i>=0){ all[i]={...all[i],...p}; save("eahs_uhaan",all); }
}

function hygieneShell(active, inner){
  return `<div class="dash">
    <aside class="side">
      <h1>✚ Эрүүл ахуйчийн хяналтын самбар</h1>
      ${[["тойм","Тойм"],["ядаргаа","Ядаргаа"],["аюул","Аюул"],["халдвар","Халдвар"],["хуваарь","Хуваарь"],["дэвтэр","Цагаан дэвтэр"],["ажилтан","Шинэ ажилтан"],["excel","Excel"],["тохиргоо","Тохиргоо"]].map(([k,l])=>
        `<button class="navb ${active===k?"on":""}" data-nav="${k}">${l}</button>`).join("")}
      <button class="navb" data-nav="гарах">Гарах</button>
    </aside>
    <div class="main">${inner}</div>
  </div>`;
}
function bindHygieneNav(){
  $("#app").onclick = e=>{
    const nav=e.target.closest("[data-nav]")?.dataset.nav;
    if(nav==="тойм") hygieneHome();
    else if(nav==="ядаргаа") fatigueListPage();
    else if(nav==="аюул") hazardListPage();
    else if(nav==="халдвар") infectListPage();
    else if(nav==="хуваарь") rosterPage();
    else if(nav==="дэвтэр") bookPage();
    else if(nav==="ажилтан") newEmp();
    else if(nav==="excel") reportPage();
    else if(nav==="тохиргоо") settingsPage();
    else if(nav==="гарах") landing();
    const tr=e.target.closest("tr[data-u]");
    if(tr) viewUhaan(tr.dataset.u, "hygiene");
    const hs=e.target.closest("[data-st]");
    if(hs && e.target.tagName==="SELECT"){
      const all=load("eahs_hazards",[]);
      const i=all.findIndex(x=>x.id===hs.dataset.st);
      if(i>=0){ all[i].status=e.target.value; save("eahs_hazards",all); }
    }
  };
}

function hygieneHome(){
  const u=load("eahs_uhaan",[]), f=load("eahs_fatigue",[]), h=load("eahs_hazards",[]), inf=load("eahs_infect",[]);
  const users=load("eahs_users",[]).filter(x=>x.role==="worker");
  const hi=f.filter(x=>x.level==="Өндөр" && x.date===today()).length;
  const neu=h.filter(x=>x.status==="Шинэ").length;
  const exp=users.filter(w=>w.bookExp && daysBetween(today(),w.bookExp)<=30).length;
  const ir=inf.filter(x=>x.risk && x.date===today()).length;
  $("#app").innerHTML = hygieneShell("тойм", `
        <h2 style="margin-top:0">Эрүүл ахуйчийн хяналтын самбар</h2>
        <p class="muted">Өнөөдөр: ${today()}</p>
        <div class="kpis">
          <div class="kpi"><i style="background:#d92d20">🔋</i><div>Өндөр ядаргаа<b>${hi}</b><span class="muted">ажилтан</span></div></div>
          <div class="kpi"><i style="background:#dc6803">⚠</i><div>Шинэ аюул<b>${neu}</b><span class="muted">бүртгэл</span></div></div>
          <div class="kpi"><i style="background:#1570ef">📄</i><div>Баримт 30 хоног<b>${exp}</b><span class="muted">баримт</span></div></div>
          <div class="kpi"><i style="background:#079455">✔</i><div>Халдварын эрсдэл<b>${ir}</b><span class="muted">өндөр эрсдэлтэй</span></div></div>
        </div>
        <div class="card"><h3>Аюулын жагсаалт</h3>
          ${h.slice(0,6).map(x=>`<div class="item"><div><b>${x.det||x.types?.[0]||"Аюул"}</b><div class="muted">${x.area}</div></div>${stH(x.status)}</div>`).join("")||"Хоосон"}
        </div>
        <div class="card"><h3>Ажилтнуудын тойм</h3>
          <table><tr><th>Ажилтан</th><th>SAP</th><th>Тасаг</th><th>Ядаргаа</th><th>Цагаан дэвтэр</th></tr>
          ${users.map(w=>{
            const last=f.filter(x=>x.sap===w.sap)[0];
            return `<tr><td>${w.name}</td><td>${w.sap}</td><td>${w.alba}</td><td>${last?last.level+" ("+last.score+")":"—"}</td><td>${expBadge(w.bookExp)}</td></tr>`;
          }).join("")}
          </table>
        </div>
        <div class="card"><h3>УХААН</h3>
          <table><tr><th>Огноо</th><th>Нэр</th><th>Алба</th><th>Төлөв</th></tr>
          ${u.slice(0,12).map(x=>`<tr data-u="${x.id}"><td>${x.date}</td><td>${x.name}</td><td>${x.alba}</td><td>${stU(x)}</td></tr>`).join("")}
        </table></div>`);
  bindHygieneNav();
}
function stH(s){
  if(s==="Шинэ") return `<span class="badge b-new">Шинэ</span>`;
  if(s==="Шалгаж байна") return `<span class="badge b-wait">Шалгаж байна</span>`;
  return `<span class="badge b-ok">Шийдвэрлэсэн</span>`;
}

function fatigueListPage(){
  const f=load("eahs_fatigue",[]);
  $("#app").innerHTML=hygieneShell("ядаргаа", `<h2>Ядаргаа</h2>
    <table><tr><th>Огноо</th><th>Нэр</th><th>Алба</th><th>Оноо</th><th>Түвшин</th></tr>
    ${f.map(x=>`<tr><td>${x.date}</td><td>${x.name}</td><td>${x.alba}</td><td>${x.score}</td><td>${x.level}</td></tr>`).join("")||"<tr><td colspan=5>Хоосон</td></tr>"}
    </table>`);
  bindHygieneNav();
}
function hazardListPage(){
  const h=load("eahs_hazards",[]);
  $("#app").innerHTML=hygieneShell("аюул", `<h2>Аюул</h2>
    ${h.map(x=>`<div class="card"><b>${x.date} · ${x.area}</b> · ${x.risk}<div class="muted">${x.det||""}</div>
      <div class="thumbs">${(x.photos||[]).slice(0,4).map(p=>`<img src="${p}">`).join("")}</div>
      <select data-st="${x.id}">${["Шинэ","Шалгаж байна","Шийдвэрлэсэн"].map(s=>`<option ${s===x.status?"selected":""}>${s}</option>`).join("")}</select>
    </div>`).join("")||"<p>Хоосон</p>"}`);
  bindHygieneNav();
}
function infectListPage(){
  const inf=load("eahs_infect",[]);
  $("#app").innerHTML=hygieneShell("халдвар", `<h2>Халдвар</h2>
    <table><tr><th>Огноо</th><th>Нэр</th><th>Алба</th><th>Үр дүн</th></tr>
    ${inf.map(x=>`<tr><td>${x.date}</td><td>${x.name}</td><td>${x.alba}</td><td>${x.risk?"Эрсдэлтэй":"Орж болно"}</td></tr>`).join("")||"<tr><td colspan=4>Хоосон</td></tr>"}
    </table>`);
  bindHygieneNav();
}
function bookPage(){
  const users=load("eahs_users",[]).filter(x=>x.role==="worker");
  $("#app").innerHTML=hygieneShell("дэвтэр", `<h2>Цагаан дэвтэр / жилийн шинжилгээ</h2>
    <table><tr><th>Нэр</th><th>SAP</th><th>Дэвтэр</th><th>Шинжилгээ</th></tr>
    ${users.map(w=>`<tr><td>${w.name}</td><td>${w.sap}</td><td>${w.bookExp||"—"} ${expBadge(w.bookExp)}</td><td>${w.exam||"—"} ${expBadge(w.exam)}</td></tr>`).join("")}
    </table>`);
  bindHygieneNav();
}

function reportPage(){
  $("#app").innerHTML=hygieneShell("excel", `<h2>Excel татах</h2>
    <div class="card">
      <p class="muted">УХААН орохгүй. Хэрэгтэй тайлангаа сонгоно уу.</p>
      <label class="f">Эхлэх</label><input type="date" id="from" value="${addDays(-13)}"/>
      <label class="f">Дуусах</label><input type="date" id="to" value="${today()}"/>
      <p><b>Аль тайлан</b></p>
      <label><input type="checkbox" id="x-ayul" checked/> Аюул (зурагтай)</label><br>
      <label><input type="checkbox" id="x-inf" checked/> Халдварын асуумж</label><br>
      <label><input type="checkbox" id="x-fat" checked/> Ядаргааны үнэлгээ</label>
      <div style="height:12px"></div>
      <button class="btn" id="xl">Татах</button>
    </div>`);
  bindHygieneNav();
  $("#xl").onclick=()=>{
    const kinds=[];
    if($("#x-ayul").checked) kinds.push("ayul");
    if($("#x-inf").checked) kinds.push("inf");
    if($("#x-fat").checked) kinds.push("fat");
    if(!kinds.length){ alert("Дор хаяж нэг тайлан сонгоно уу"); return; }
    exportExcel($("#from").value,$("#to").value,kinds);
  };
}
function addDays(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }

function dataUrlToBuf(url){
  const b64=url.split(",")[1]; const bin=atob(b64); const u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return u;
}

async function exportExcel(from,to,kinds=["ayul","inf","fat"]){
  const wb=new ExcelJS.Workbook();
  wb.creator="EAHS";
  const inR=(d)=>d>=from && d<=to;
  const hz=load("eahs_hazards",[]).filter(x=>inR(x.date));
  const inf=load("eahs_infect",[]).filter(x=>inR(x.date));
  const fat=load("eahs_fatigue",[]).filter(x=>inR(x.date));

  if(kinds.includes("ayul")){
    const s1=wb.addWorksheet("Аюул");
    s1.addRow(["Огноо","Газар","Хариуцах","Мэдээлэгч","Төрөл","Ангилал","Эрсдэл","Дэлгэрэнгүй","Шуурхай арга","Зураг тоо","Төлөв"]);
    hz.forEach(x=>s1.addRow([x.date,x.area,x.acc,x.reporter,(x.types||[]).join("; "),(x.cls||[]).join("; "),x.risk,x.det,x.act,(x.photos||[]).length,x.status]));
    const sP=wb.addWorksheet("Аюул_зураг");
    sP.addRow(["Огноо","Газар","Мэдээлэгч","Зураг №"]);
    let r=2;
    for(const x of hz){
      (x.photos||[]).forEach((p,i)=>{
        sP.getRow(r).values=[x.date,x.area,x.reporter,i+1];
        sP.getRow(r).height=80;
        try{
          const id=wb.addImage({buffer:dataUrlToBuf(p), extension:"jpeg"});
          sP.addImage(id,{tl:{col:4,row:r-1}, ext:{width:120,height:90}});
        }catch(e){}
        r++;
      });
    }
    sP.getColumn(5).width=22;
  }
  if(kinds.includes("inf")){
    const s2=wb.addWorksheet("Халдвар");
    s2.addRow(["Огноо","SAP","Нэр","Алба","Үр дүн","Хариу"]);
    inf.forEach(x=>s2.addRow([x.date,x.sap,x.name,x.alba,x.risk?"Эрсдэлтэй":"Орж болно",(x.ans||[]).map(a=>a.q+":"+a.a).join("; ")]));
  }
  if(kinds.includes("fat")){
    const s3=wb.addWorksheet("Ядаргаа");
    s3.addRow(["Огноо","SAP","Нэр","Алба","Хүйс","24ц","48ц","Сэрүүн","Архи","Эм","Төвлөрөл","Оноо","Түвшин"]);
    fat.forEach(x=>s3.addRow([x.date,x.sap,x.name,x.alba,x.gender,x.q5,x.q6,x.q7,x.q8,x.q10,x.q11,x.score,x.level]));
  }

  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`EAHS_${kinds.join("-")}_${from}_${to}.xlsx`;
  a.click();
}

function newEmp(){
  $("#app").innerHTML=hygieneShell("ажилтан", `<h2>Шинэ ажилтан</h2>
    <div class="card">
    <label class="f">SAP</label><input id="sap"/>
    <label class="f">Нэр</label><input id="nm"/>
    <label class="f">Алба</label><select id="alba">${ALBA.map(a=>`<option>${a}</option>`).join("")}</select>
    <label class="f">Хүйс</label><select id="gender"><option>Эр</option><option>Эм</option></select>
    <label class="f">Ажил</label><input id="job"/>
    <label class="f">Нууц үг</label><input id="pin" value="1234"/>
    <label class="f">Цагаан дэвтэр дуусах</label><input type="date" id="book"/>
    <label class="f">Жилийн шинжилгээ дуусах</label><input type="date" id="exam"/>
    <button class="btn" id="save">Хадгалах</button>
    </div>`);
  bindHygieneNav();
  $("#save").onclick=()=>{
    const users=load("eahs_users",[]);
    if(users.some(x=>x.sap===$("#sap").value.trim())){ alert("SAP давхардсан"); return; }
    users.push({sap:$("#sap").value.trim(), name:$("#nm").value, role:"worker", alba:$("#alba").value, gender:$("#gender").value, job:$("#job").value, pin:$("#pin").value, bookExp:$("#book").value, exam:$("#exam").value});
    save("eahs_users", users); alert("Хадгаллаа"); hygieneHome();
  };
  const box = document.createElement("div");
  box.className="card";
  box.innerHTML=`<h3>Excel-ээр оруулах</h3>
    <p class="muted">Багана: SAP, Нэр, Алба, Хүйс, Ажил, Нууц үг, Цагаан дэвтэр, Шинжилгээ</p>
    <button class="btn ghost" id="tmpl">Загвар татах</button>
    <div style="height:8px"></div>
    <input type="file" id="ximp" accept=".xlsx,.xls"/>
    <div id="ximperr" class="muted"></div>
    <button class="btn" id="ximpok">Шалгаад оруулах</button>`;
  document.querySelector(".main").appendChild(box);
  let pending=null;
  $("#tmpl").onclick=async ()=>{
    const wb=new ExcelJS.Workbook(); const s=wb.addWorksheet("Ажилтан");
    s.addRow(["SAP","Нэр","Алба","Хүйс","Ажил","Нууц үг","Цагаан дэвтэр","Шинжилгээ"]);
    s.addRow(["50019999","Жишээ Нэр","Оюут баар","Эр","Тогооч","1234","2026-12-31","2026-11-01"]);
    const buf=await wb.xlsx.writeBuffer();
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
    a.download="EAHS_ajiltan_zagvar.xlsx"; a.click();
  };
  $("#ximp").onchange=async e=>{
    const f=e.target.files[0]; if(!f) return;
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(await f.arrayBuffer());
    const sh=wb.worksheets[0];
    const rows=[]; const errs=[];
    sh.eachRow((row,i)=>{
      if(i===1) return;
      const sap=String(row.getCell(1).value||"").trim();
      const name=String(row.getCell(2).value||"").trim();
      const alba=String(row.getCell(3).value||"").trim();
      const gender=String(row.getCell(4).value||"").trim();
      const job=String(row.getCell(5).value||"").trim();
      const pin=String(row.getCell(6).value||"1234").trim();
      const bookExp=excelDate(row.getCell(7).value);
      const exam=excelDate(row.getCell(8).value);
      if(!sap) { errs.push(i+"-р мөр: SAP хоосон"); return; }
      if(!name) { errs.push(i+"-р мөр: Нэр хоосон"); return; }
      if(ALBA.length && alba && !ALBA.includes(alba)) errs.push(i+"-р мөр: Алба танигдаагүй («"+alba+"»). Оруулна.");
      if(gender && gender!=="Эр" && gender!=="Эм") errs.push(i+"-р мөр: Хүйс Эр/Эм биш");
      rows.push({sap,name,role:"worker",alba:ALBA.includes(alba)?alba:(alba||"Оффис"),gender:gender==="Эм"?"Эм":"Эр",job,pin,bookExp,exam});
    });
    pending=rows;
    $("#ximperr").innerHTML = (errs.length?("<div class='warnbox'>"+errs.join("<br>")+"</div>"):"<div class='muted'>Алдаагүй. ")+rows.length+" мөр бэлэн.</div>";
  };
  $("#ximpok").onclick=()=>{
    if(!pending||!pending.length){ alert("Файл сонгоно уу"); return; }
    const users=load("eahs_users",[]);
    const skip=[];
    pending.forEach(p=>{
      if(users.some(u=>u.sap===p.sap)) skip.push(p.sap);
      else users.push(p);
    });
    save("eahs_users", users);
    alert("Орлоо: "+(pending.length-skip.length)+ (skip.length?" · давхардсан SAP: "+skip.join(", "):""));
    newEmp();
  };
}
function excelDate(v){
  if(v==null||v==="") return "";
  if(typeof v==="number"){
    const d=new Date(Math.round((v-25569)*86400*1000));
    return d.toISOString().slice(0,10);
  }
  const s=String(v).slice(0,10);
  return s;
}

function rosterPage(){
  const users=load("eahs_users",[]).filter(x=>x.role==="worker");
  $("#app").innerHTML=hygieneShell("хуваарь", `<h2>Талбарын хуваарь</h2>
    <div class="card">
    <label class="f">Ажилтан</label><select id="sap">${users.map(u=>`<option value="${u.sap}">${u.name} (${u.sap})</option>`).join("")}</select>
    <label class="f">Ирэх өдөр</label><input type="date" id="arrive" value="${today()}"/>
    <label class="f">Гарах өдөр</label><input type="date" id="leave"/>
    <button class="btn" id="add">Нэмэх</button>
    </div>
    <table><tr><th>Ирэх</th><th>Нэр</th><th>Гарах</th></tr>
    ${load("eahs_roster",[]).map(x=>`<tr><td>${x.arrive}</td><td>${x.name}</td><td>${x.leave||""}</td></tr>`).join("")}
    </table>`);
  bindHygieneNav();
  $("#add").onclick=()=>{
    const u=users.find(x=>x.sap===$("#sap").value);
    if(!u) return;
    const all=load("eahs_roster",[]);
    all.unshift({sap:u.sap,name:u.name,arrive:$("#arrive").value,leave:$("#leave").value});
    save("eahs_roster",all); rosterPage();
  };
}

function settingsPage(){
  const s=load("eahs_settings",{});
  $("#app").innerHTML=hygieneShell("тохиргоо", `<h2>Тохиргоо</h2>
    <div class="card">
    <label class="f">Ядаргаа хэд хоногт 1</label><input type="number" id="fd" value="${s.fatigueDays||7}"/>
    <label class="f">Баримт дуусахад хориглох</label>
    <select id="bl"><option value="0">Зөвхөн анхааруул</option><option value="1">Хоригло</option></select>
    <button class="btn" id="save">Хадгалах</button>
    </div>`);
  $("#bl").value = s.blockExpired?"1":"0";
  bindHygieneNav();
  $("#save").onclick=()=>{ save("eahs_settings",{fatigueDays:+$("#fd").value||7, blockExpired:$("#bl").value==="1"}); alert("Хадгаллаа"); };
}

initCloud().then(()=>{
  session = load("eahs_session", null);
  if(session?.role==="worker") workerHome();
  else if(session?.role==="supervisor") supervisorHome();
  else if(session?.role==="hygiene") hygieneHome();
  else landing();
});
