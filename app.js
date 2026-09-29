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

function load(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function today(){ return new Date().toISOString().slice(0,10); }
function nowStr(){ return new Date().toLocaleString("mn-MN"); }

function seed(){
  if(!load("eahs_users", null)){
    save("eahs_users", [
      {sap:"1108650", name:"Б. Энхбаяр", role:"worker", alba:"Оюут баар", gender:"Эр", job:"Тусгаар", pin:"1234", book:"ЦД-2025-1", bookExp:"2026-12-10", exam:"2026-11-01"},
      {sap:"50012346", name:"С. Болормаа", role:"worker", alba:"Оюут баар", gender:"Эм", job:"Тогооч", pin:"1234", book:"ЦД-2025-2", bookExp:"2026-10-20", exam:"2026-12-01"},
      {sap:"akhakh", name:"Д. Ганболд", role:"supervisor", alba:"Оюут баар", gender:"Эр", job:"Ахлах", pin:"1234"},
      {sap:"admin", name:"Эрүүл ахуйч", role:"hygiene", alba:"Оффис", gender:"Эм", job:"Эрүүл ахуйч", pin:"1234"}
    ]);
  }
  if(!load("eahs_settings", null)){
    save("eahs_settings", {fatigueDays:7, blockExpired:false});
  }
  ["eahs_uhaan","eahs_fatigue","eahs_hazards","eahs_infect","eahs_roster"].forEach(k=>{
    if(load(k,null)===null) save(k,[]);
  });
}
seed();

let session = load("eahs_session", null);
const $ = sel => document.querySelector(sel);
function setWho(){
  $("#who").textContent = session ? `${session.name} · ${roleName(session.role)}` : "";
}
function roleName(r){ return {worker:"Ажилтан", supervisor:"Ахлах", hygiene:"Эрүүл ахуйч"}[r]||""; }

function go(fn){ $("#app").innerHTML = ""; fn(); setWho(); }

function landing(){
  session = null; save("eahs_session", null); setWho();
  $("#app").innerHTML = `
    <div class="card">
      <h2>Эрүүл ахуйн хяналтын систем</h2>
      <p class="muted">УХААН · ядаргаа · аюул · халдвар</p>
      <button class="btn" data-g="login-worker">Ажилтан нэвтрэх</button>
      <div style="height:8px"></div>
      <button class="btn ghost" data-g="hazard">Аюулыг мэдээлэх (нэвтрэхгүй)</button>
      <div style="height:8px"></div>
      <button class="btn ghost" data-g="login-supervisor">Ахлах нэвтрэх</button>
      <div style="height:8px"></div>
      <button class="btn ghost" data-g="login-hygiene">Эрүүл ахуйчийн самбар</button>
    </div>`;
  $("#app").onclick = e=>{
    const g = e.target.dataset.g;
    if(g==="hazard") hazardForm();
    if(g==="login-worker") loginForm("worker");
    if(g==="login-supervisor") loginForm("supervisor");
    if(g==="login-hygiene") loginForm("hygiene");
  };
}

function loginForm(role){
  $("#app").innerHTML = `
    <div class="card">
      <h3>${roleName(role)} нэвтрэх</h3>
      <label>SAP / нэр</label><input id="sap"/>
      <label>Нууц үг</label><input id="pin" type="password"/>
      <p class="muted">Жишээ: ажилтан 1108650 / 1234 · ахлах akhakh / 1234 · admin / 1234</p>
      <button class="btn" id="ok">Нэвтрэх</button>
      <div style="height:8px"></div>
      <button class="btn ghost" id="back">Буцах</button>
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
    <div class="card"><b>${session.name}</b><div class="muted">SAP ${session.sap} · ${session.alba}</div>
      <button class="btn ghost" id="out">Гарах</button></div>
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
    <button class="btn ghost" id="haz">Аюул мэдэгдэх</button>`;
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
    <div class="card"><h3>Алжаал ядаргааны үнэлгээ</h3>
      <p class="muted">SAP ${session.sap} · ${session.name} · ${today()} · ${session.alba}</p>
      <label>5. Сүүлийн 24 цагт хэдэн цаг унтсан бэ?</label>
      <select id="q5"><option>7 ба түүнээс их</option><option>6-7 цаг</option><option>6 цагаас бага</option></select>
      <label>6. Сүүлийн 48 цагт хэдэн цаг унтсан бэ?</label>
      <select id="q6"><option>14 цагаас их</option><option>12-14 цаг</option><option>12 цагаас бага</option></select>
      <label>7. Ээлж дуусах үед хэдэн цаг сэрүүн байх вэ?</label>
      <select id="q7"><option>14 цагаас бага</option><option>14-16 цаг</option><option>16 цагаас илүү</option></select>
      <label>${g?"9":"8"}. Сүүлийн 12 цагт архи (${g?"ЭМ":"ЭР"})</label>
      <select id="q8"><option>Согтууруулах ундаа хэрэглээгүй</option><option>1-3</option><option>4-6</option></select>
      <label>10. Эм тариа / нэмэлт?</label>
      <select id="q10"><option>Үгүй</option><option>Тийм</option></select>
      <label>11. Анхаарал төвлөрөл</label>
      <select id="q11"><option>Тийм, чадаж байна</option><option>Тийм , гэхдээ тийм ч сайн биш</option><option>Нойрмог эвшээсэн , анхаарал төвлөрүүлхэд хүндрэлтэй</option></select>
      <button class="btn" id="calc">Оноо тооцох</button>
      <div style="height:8px"></div><button class="btn ghost" id="back">Буцах</button>
    </div>`;
  $("#back").onclick = workerHome;
  $("#calc").onclick = ()=>{
    const map3 = (v,opts)=>opts.indexOf(v);
    const s5 = map3($("#q5").value,["7 ба түүнээс их","6-7 цаг","6 цагаас бага"]);
    const s6 = map3($("#q6").value,["14 цагаас их","12-14 цаг","12 цагаас бага"]);
    const s7 = map3($("#q7").value,["14 цагаас бага","14-16 цаг","16 цагаас илүү"]);
    const s8 = map3($("#q8").value,["Согтууруулах ундаа хэрэглээгүй","1-3","4-6"]);
    const s10 = $("#q10").value==="Тийм"?2:0;
    const s11 = map3($("#q11").value,["Тийм, чадаж байна","Тийм , гэхдээ тийм ч сайн биш","Нойрмог эвшээсэн , анхаарал төвлөрүүлхэд хүндрэлтэй"]);
    let score = s5+s6+s7+s8+s10+s11;
    let level = score<=3?"Бага":score<=7?"Дунд":"Өндөр";
    if($("#q10").value==="Тийм" || s11===2) level = level==="Бага"?"Дунд":level;
    if(s8===2 && s5===2) level="Өндөр";
    const rec={id:uid(), sap:session.sap, name:session.name, alba:session.alba, gender:session.gender, date:today(),
      q5:$("#q5").value,q6:$("#q6").value,q7:$("#q7").value,q8:$("#q8").value,q10:$("#q10").value,q11:$("#q11").value,score,level};
    const all=load("eahs_fatigue",[]); all.unshift(rec); save("eahs_fatigue",all);
    alert(`${level} оноо: ${score}/12`+(level==="Өндөр"?" — ахлах/эрүүл ахуйчид мэдэгдлээ":""));
    workerHome();
  };
}

function infectForm(){
  const qs=["Бөөлжих","Суулгах","Халуурах","Хэвлийгээр өвдөх","Ойр хавийн хүнд ижил өвчин"];
  $("#app").innerHTML = `<div class="card"><h3>Гэдэсний халдварт өвчин тандах</h3>
    <p class="muted">${session.name} · ${today()}</p>
    ${qs.map((q,i)=>`<label>${q}</label><select id="i${i}"><option>Үгүй</option><option>Тийм</option></select>`).join("")}
    <button class="btn" id="send">Илгээх</button>
    <div style="height:8px"></div><button class="btn ghost" id="back">Буцах</button></div>`;
  $("#back").onclick = workerHome;
  $("#send").onclick = ()=>{
    const ans = qs.map((q,i)=>({q, a:$("#i"+i).value}));
    const risk = ans.some(x=>x.a==="Тийм");
    const all=load("eahs_infect",[]);
    all.unshift({id:uid(), sap:session.sap, name:session.name, alba:session.alba, date:today(), ans, risk});
    save("eahs_infect", all);
    alert(risk?"Эрсдэлтэй — ажилд оруулахгүй, эрүүл ахуйчид мэдэгдсэн":"Ажилд орж болно");
    workerHome();
  };
}

let hazardPics = [];
function hazardForm(){
  hazardPics = [];
  $("#app").innerHTML = `
    <div class="card"><h3>Аюулыг мэдээлэх хуудас</h3>
      <p class="muted">RECORD AN OBSERVED HAZARD</p>
      <h4>Ерөнхий мэдээлэл</h4>
      <label>Аюулыг харсан газар, харьяа хэлтэс</label><select id="area">${ALBA.map(a=>`<option>${a}</option>`).join("")}</select>
      <label>Огноо</label><input type="date" id="hdate" value="${today()}"/>
      <label>Хариуцах хэлтэс</label><input id="acc"/>
      <label>Мэдээлсэн хүн</label><input id="rep" value="${session?.name||""}"/>
      <label>Ахлах / судласан хүн</label><input id="rev"/>
      <h4>Аюулын тайлбар</h4>
      <div id="types">${HAZ_TYPES.map(t=>`<label><input type="checkbox" value="${t}"/> ${t}</label>`).join("")}</div>
      <p>Ангилал</p>
      <div id="cls">${HAZ_CLASS.map(t=>`<label><input type="checkbox" value="${t}"/> ${t}</label>`).join("")}</div>
      <label>Эрсдэл</label>
      <select id="risk"><option>Бага</option><option>Дунд зэрэг</option><option>Их</option><option>Маш их</option></select>
      <label>Харсан аюулаа дэлгэрэнгүй</label><textarea id="det"></textarea>
      <label>Авсан шуурхай арга хэмжээ</label><textarea id="act"></textarea>
      <label>Зураг (багадаа 2)</label>
      <input type="file" id="pics" accept="image/*" multiple/>
      <div class="thumbs" id="thumbs"></div>
      <button class="btn" id="send">Илгээх</button>
      <div style="height:8px"></div>
      <button class="btn ghost" id="back">Буцах</button>
    </div>`;
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
    const cls=[...document.querySelectorAll("#cls input:checked")].map(x=>x.value);
    const rec={id:uid(), area:$("#area").value, date:$("#hdate").value, acc:$("#acc").value, reporter:$("#rep").value, reviewer:$("#rev").value, types, cls, risk:$("#risk").value, det:$("#det").value, act:$("#act").value, photos:hazardPics.slice(0,8), status:"Шинэ", created:nowStr()};
    const all=load("eahs_hazards",[]); all.unshift(rec); save("eahs_hazards",all);
    alert("Мэдэгдэл хүлээн авлаа. Эрүүл ахуйчийн самбарт шинэ төлөвтэй орлоо.");
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
        const w=Math.min(900,img.width), h=img.height*(w/img.width);
        c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",0.7));
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

function hygieneHome(){
  const u=load("eahs_uhaan",[]), f=load("eahs_fatigue",[]), h=load("eahs_hazards",[]), inf=load("eahs_infect",[]);
  const users=load("eahs_users",[]).filter(x=>x.role==="worker");
  const todayU=u.filter(x=>x.date===today());
  const miss=users.filter(w=>!todayU.some(x=>x.sap===w.sap)).length;
  const stop=u.filter(x=>x.stop && x.date===today()).length;
  const neu=h.filter(x=>x.status==="Шинэ").length;
  const exp=users.filter(w=>w.bookExp && daysBetween(today(),w.bookExp)<=30).length;
  $("#app").innerHTML=`
    <div class="card"><b>Эрүүл ахуйчийн самбар</b> <button class="btn ghost" id="out">Гарах</button></div>
    <div class="kpi">
      <div class="card">УХААН бөглөөгүй<b>${miss}</b></div>
      <div class="card">Зогсоосон / өндөр<b>${stop + f.filter(x=>x.level==="Өндөр"&&x.date===today()).length}</b></div>
      <div class="card">Шинэ аюул<b>${neu}</b></div>
      <div class="card">Баримт 30 хоног<b>${exp}</b></div>
    </div>
    <div class="row">
      <button class="btn" id="rep">Тайлан / Excel</button>
      <button class="btn ghost" id="emp">Шинэ ажилтан</button>
      <button class="btn ghost" id="ros">Хуваарь</button>
      <button class="btn ghost" id="set">Тохиргоо</button>
    </div>
    <div class="card"><h3>УХААН (ахлахтай ижил харагдана)</h3>
      <table><tr><th>Огноо</th><th>Нэр</th><th>Алба</th><th>Төлөв</th></tr>
      ${u.slice(0,15).map(x=>`<tr data-u="${x.id}"><td>${x.date}</td><td>${x.name}</td><td>${x.alba}</td><td>${stU(x)}</td></tr>`).join("")}
      </table></div>
    <div class="card"><h3>Аюул</h3>
      ${h.slice(0,10).map(x=>`<div class="item"><div><b>${x.date} ${x.area}</b> · ${x.risk}<br><span class="muted">${(x.types||[]).join(", ")}</span>
      <div class="thumbs">${(x.photos||[]).slice(0,3).map(p=>`<img src="${p}">`).join("")}</div></div>
      <select data-st="${x.id}">${["Шинэ","Шалгаж байна","Шийдвэрлэсэн"].map(s=>`<option ${s===x.status?"selected":""}>${s}</option>`).join("")}</select></div>`).join("")||"Хоосон"}
    </div>`;
  $("#out").onclick=landing;
  $("#rep").onclick=reportPage;
  $("#emp").onclick=newEmp;
  $("#ros").onclick=rosterPage;
  $("#set").onclick=settingsPage;
  $("#app").onchange=e=>{
    const id=e.target.dataset.st; if(!id) return;
    const all=load("eahs_hazards",[]);
    const i=all.findIndex(x=>x.id===id); if(i>=0){ all[i].status=e.target.value; save("eahs_hazards",all); }
  };
  $("#app").onclick=e=>{
    const tr=e.target.closest("tr[data-u]");
    if(tr) viewUhaan(tr.dataset.u, "hygiene");
  };
}

function reportPage(){
  $("#app").innerHTML=`<div class="card"><h3>Тайлан</h3>
    <p class="muted">УХААН Excel-д орохгүй. Аюулын файлаас зурагтай хуудас гарна.</p>
    <label>Эхлэх</label><input type="date" id="from" value="${addDays(-13)}"/>
    <label>Дуусах</label><input type="date" id="to" value="${today()}"/>
    <button class="btn" id="xl">Excel татах (аюул+зураг, халдвар, ядаргаа)</button>
    <div style="height:8px"></div><button class="btn ghost" id="back">Буцах</button></div>`;
  $("#back").onclick=hygieneHome;
  $("#xl").onclick=()=>exportExcel($("#from").value,$("#to").value);
}
function addDays(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }

function dataUrlToBuf(url){
  const b64=url.split(",")[1]; const bin=atob(b64); const u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return u;
}

async function exportExcel(from,to){
  const wb=new ExcelJS.Workbook();
  wb.creator="EAHS";
  const inR=(d)=>d>=from && d<=to;
  const hz=load("eahs_hazards",[]).filter(x=>inR(x.date));
  const inf=load("eahs_infect",[]).filter(x=>inR(x.date));
  const fat=load("eahs_fatigue",[]).filter(x=>inR(x.date));

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

  const s2=wb.addWorksheet("Халдвар");
  s2.addRow(["Огноо","SAP","Нэр","Алба","Үр дүн","Хариу"]);
  inf.forEach(x=>s2.addRow([x.date,x.sap,x.name,x.alba,x.risk?"Эрсдэлтэй":"Орж болно",(x.ans||[]).map(a=>a.q+":"+a.a).join("; ")]));

  const s3=wb.addWorksheet("Ядаргаа");
  s3.addRow(["Огноо","SAP","Нэр","Алба","Хүйс","24ц","48ц","Сэрүүн","Архи","Эм","Төвлөрөл","Оноо","Түвшин"]);
  fat.forEach(x=>s3.addRow([x.date,x.sap,x.name,x.alba,x.gender,x.q5,x.q6,x.q7,x.q8,x.q10,x.q11,x.score,x.level]));

  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`EAHS_${from}_${to}.xlsx`;
  a.click();
}

function newEmp(){
  $("#app").innerHTML=`<div class="card"><h3>Шинэ ажилтан</h3>
    <label>SAP</label><input id="sap"/>
    <label>Нэр</label><input id="name"/>
    <label>Алба</label><select id="alba">${ALBA.map(a=>`<option>${a}</option>`).join("")}</select>
    <label>Хүйс</label><select id="gender"><option>Эр</option><option>Эм</option></select>
    <label>Ажил</label><input id="job"/>
    <label>Нууц үг</label><input id="pin" value="1234"/>
    <label>Цагаан дэвтэр дуусах</label><input type="date" id="book"/>
    <label>Жилийн шинжилгээ дуусах</label><input type="date" id="exam"/>
    <button class="btn" id="save">Хадгалах</button>
    <div style="height:8px"></div><button class="btn ghost" id="back">Буцах</button></div>`;
  $("#back").onclick=hygieneHome;
  $("#save").onclick=()=>{
    const users=load("eahs_users",[]);
    if(users.some(x=>x.sap===$("#sap").value.trim())){ alert("SAP давхардсан"); return; }
    users.push({sap:$("#sap").value.trim(), name:$("#name").value, role:"worker", alba:$("#alba").value, gender:$("#gender").value, job:$("#job").value, pin:$("#pin").value, bookExp:$("#book").value, exam:$("#exam").value});
    save("eahs_users", users); alert("Хадгаллаа"); hygieneHome();
  };
}

function rosterPage(){
  const users=load("eahs_users",[]).filter(x=>x.role==="worker");
  $("#app").innerHTML=`<div class="card"><h3>Талбарын хуваарь</h3>
    <label>Ажилтан</label><select id="sap">${users.map(u=>`<option value="${u.sap}">${u.name} (${u.sap})</option>`).join("")}</select>
    <label>Ирэх өдөр</label><input type="date" id="arrive" value="${today()}"/>
    <label>Гарах өдөр</label><input type="date" id="leave"/>
    <button class="btn" id="add">Нэмэх</button>
    <table><tr><th>Ирэх</th><th>Нэр</th><th>Гарах</th></tr>
    ${load("eahs_roster",[]).map(x=>`<tr><td>${x.arrive}</td><td>${x.name}</td><td>${x.leave||""}</td></tr>`).join("")}
    </table>
    <button class="btn ghost" id="back">Буцах</button></div>`;
  $("#back").onclick=hygieneHome;
  $("#add").onclick=()=>{
    const u=users.find(x=>x.sap===$("#sap").value);
    const all=load("eahs_roster",[]);
    all.unshift({sap:u.sap,name:u.name,arrive:$("#arrive").value,leave:$("#leave").value});
    save("eahs_roster",all); rosterPage();
  };
}

function settingsPage(){
  const s=load("eahs_settings",{});
  $("#app").innerHTML=`<div class="card"><h3>Тохиргоо</h3>
    <label>Ядаргаа хэд хоногт 1</label><input type="number" id="fd" value="${s.fatigueDays||7}"/>
    <label>Баримт дуусахад хориглох</label>
    <select id="bl"><option value="0">Зөвхөн анхааруул</option><option value="1">Хоригло</option></select>
    <button class="btn" id="save">Хадгалах</button>
    <div style="height:8px"></div><button class="btn ghost" id="back">Буцах</button></div>`;
  $("#bl").value = s.blockExpired?"1":"0";
  $("#back").onclick=hygieneHome;
  $("#save").onclick=()=>{ save("eahs_settings",{fatigueDays:+$("#fd").value||7, blockExpired:$("#bl").value==="1"}); alert("Хадгаллаа"); hygieneHome(); };
}

if(session?.role==="worker") workerHome();
else if(session?.role==="supervisor") supervisorHome();
else if(session?.role==="hygiene") hygieneHome();
else landing();
