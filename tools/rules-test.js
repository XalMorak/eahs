// Run: firebase emulators:start --only database,auth --project demo-eahs  (in a dir with firebase npm pkg), then: node tools/rules-test.js
// v5 rules matrix: strict (database.rules.json) and transition rules, run against the RTDB + Auth emulators.
const firebase=require('firebase/compat/app'); require('firebase/compat/auth'); require('firebase/compat/database');
const crypto=require('crypto'); const fs=require('fs');
const NS='demo-eahs-default-rtdb', DBU='http://127.0.0.1:9000', AU='http://127.0.0.1:9099';
const owner=(path,method,body)=>fetch(`${DBU}/${path}.json?ns=${NS}`,{method,headers:{Authorization:'Bearer owner'},body:body!==undefined?JSON.stringify(body):undefined}).then(r=>r.json());
const H=(sap,pin)=>crypto.createHash('sha256').update(`eahs|${sap}|${pin}`).digest('hex');
let pass=0, fail=0, n=0;
async function expect(name, shouldAllow, fn){
  let ok, msg=''; try{ await fn(); ok=true; }catch(e){ ok=false; msg=e.message; }
  const good = ok===shouldAllow; good?pass++:fail++;
  console.log(`${good?'PASS':'FAIL'}  ${shouldAllow?'allow':'deny '}  ${name}${good?'':'  (got '+(ok?'allowed':'denied: '+msg)+')'}`);
}
function mkApp(){ const a=firebase.initializeApp({apiKey:'x',projectId:'demo-eahs',databaseURL:`${DBU}?ns=${NS}`},'a'+(n++)); a.auth().useEmulator(AU); const db=a.database(); db.useEmulator('127.0.0.1',9000); return {a, db, auth:a.auth()}; }
async function emailUser(email,pw){ const x=mkApp(); await x.auth.createUserWithEmailAndPassword(email,pw); return x; }
const T='2026-10-05';
const seed={borluulalt:{users:{emp001:{name:"A",role:"employee"}}},
  eahs:{v2:{_meta:{migratedAt:1},
    users:{admin:{sap:'admin',name:'Эрүүл ахуйч',role:'hygiene',alba:'Оффис',pinHash:H('admin','1234')},
      '1108650':{sap:'1108650',name:'Б. Энхбаяр',role:'worker',alba:'Оюут баар',pinHash:H('1108650','4321')},
      '2200':{sap:'2200',name:'Өөр ажилтан',role:'worker',alba:'Манлай баар',pinHash:H('2200','5555')},
      akhakh:{sap:'akhakh',name:'Д. Ганболд',role:'supervisor',alba:'Оюут баар',pinHash:H('akhakh','1234')}},
    settings:{main:{fatigueDays:7}},
    uhaan:{u1:{id:'u1',sap:'1108650',alba:'Оюут баар',date:T,status:'huleegdej'},u2:{id:'u2',sap:'2200',alba:'Манлай баар',date:T,status:'huleegdej'}},
    fatigue:{f1:{id:'f1',sap:'1108650',date:T,score:3},f2:{id:'f2',sap:'2200',date:T,score:9}},
    infect:{i1:{id:'i1',sap:'1108650',date:T,verdict:'huleegdej'}},
    hygcheck:{[T+'_Оюут баар']:{id:T+'_Оюут баар',date:T,alba:'Оюут баар',rows:{'1108650':{sap:'1108650',name:'Б',c:['ok']},'2200':{sap:'2200',name:'Ө',c:['ok']}}},
              [T+'_Манлай баар']:{id:T+'_Манлай баар',date:T,alba:'Манлай баар',rows:{x:{sap:'2200',name:'Ө',c:['ok']}}}},
    hazards:{hLow:{id:'hLow',risk:'Бага',status:'Шинэ',det:'x'},hHigh:{id:'hHigh',risk:'Их',status:'Шинэ',det:'y'}},
    roster:{r1:{id:'r1',sap:'1108650',arrive:T}}}}};
async function reset(rulesFile){
  const rules=fs.readFileSync(rulesFile,'utf8');
  const r=await fetch(`${DBU}/.settings/rules.json?ns=${NS}`,{method:'PUT',headers:{Authorization:'Bearer owner'},body:rules}); if(!r.ok) throw new Error('rules load '+await r.text());
  await owner('','PUT',seed);
  await fetch(`${AU}/emulator/v1/projects/demo-eahs/accounts`,{method:'DELETE'});
}
const claim=(db,uid,sap,role,pin)=>db.ref('eahs/v2').update({['roles/'+uid]:{sap,role,proof:H(sap,pin),at:1}});
const V='eahs/v2/';
async function strict(){
  console.log('=== STRICT database.rules.json');
  await reset('/workspace/eahs/database.rules.json');
  const z=mkApp();
  await expect('no auth: read eahs/v2', false, ()=>z.db.ref(V).once('value'));
  await expect('no auth: read borluulalt', false, ()=>z.db.ref('borluulalt').once('value'));
  await expect('no auth: create hazard', false, ()=>z.db.ref(V+'hazards/n0').set({id:'n0',status:'Шинэ'}));
  await expect('no auth: authgen/admin readable (login needs it)', true, ()=>z.db.ref(V+'authgen/admin').once('value'));
  const an=mkApp(); await an.auth.signInAnonymously();
  console.log('--- anonymous (QR / hazard report)');
  await expect('anon: borluulalt read', true, ()=>an.db.ref('borluulalt').once('value'));
  await expect('anon: borluulalt set (sales app unchanged)', true, ()=>an.db.ref('borluulalt').set({users:{emp001:{name:'A',role:'employee'}},updatedAt:'x'}));
  await expect('anon: read eahs/v2', false, ()=>an.db.ref(V).once('value'));
  await expect('anon: read users', false, ()=>an.db.ref(V+'users').once('value'));
  await expect('anon: read users/admin', false, ()=>an.db.ref(V+'users/admin').once('value'));
  await expect('anon: read hazards', false, ()=>an.db.ref(V+'hazards').once('value'));
  await expect('anon: read settings', false, ()=>an.db.ref(V+'settings').once('value'));
  await expect('anon: hazard+photos+high notif in one update', true, ()=>an.db.ref(V).update({'hazards/hA':{id:'hA',risk:'Маш их',status:'Шинэ',det:'тос асгарсан'},'photos/hA':['data:a','data:b'],'notifs/hz_hA':{id:'hz_hA',type:'hazard',level:'critical',ts:1,title:'Маш их эрсдэлтэй аюул',ref:'hA'}}));
  await expect('anon: create hazard with status Хаасан', false, ()=>an.db.ref(V+'hazards/hB').set({id:'hB',status:'Хаасан'}));
  await expect('anon: overwrite existing hazard', false, ()=>an.db.ref(V+'hazards/hLow/status').set('Хаасан'));
  await expect('anon: delete hazard', false, ()=>an.db.ref(V+'hazards/hLow').remove());
  await expect('anon: photos for non-existent hazard', false, ()=>an.db.ref(V+'photos/nope').set(['data:x']));
  await expect('anon: overwrite existing photos', false, ()=>an.db.ref(V+'photos/hA').set(['data:z']));
  await expect('anon: notif for low-risk hazard', false, ()=>an.db.ref(V+'notifs/hz_hLow').set({id:'hz_hLow',type:'hazard',level:'high',ts:1,title:'x',ref:'hLow'}));
  await expect('anon: notif id not matching hazard', false, ()=>an.db.ref(V+'notifs/spam1').set({id:'spam1',type:'hazard',level:'high',ts:1,title:'x',ref:'hHigh'}));
  await expect('anon: hygfail notif', false, ()=>an.db.ref(V+'notifs/hf1').set({id:'hf1',type:'hygfail',level:'fail',ts:1,title:'x'}));
  await expect('anon: read notifs', false, ()=>an.db.ref(V+'notifs').once('value'));
  await expect('anon: write users', false, ()=>an.db.ref(V+'users/evil').set({sap:'evil',name:'E',role:'hygiene'}));
  await expect('anon: self-claim hygiene role (no email)', false, ()=>claim(an.db,an.auth.currentUser.uid,'admin','hygiene','1234'));
  await expect('anon: uhaan create', false, ()=>an.db.ref(V+'uhaan/x').set({id:'x',sap:'1108650'}));
  await expect('anon: unknown collection', false, ()=>an.db.ref(V+'foo/x').set(1));
  console.log('--- worker migration (first login with old PIN)');
  const w=await emailUser('1108650@eahs.local','eahs#4321'); const wu=w.auth.currentUser.uid;
  await expect('worker(no role yet): read own profile', false, ()=>w.db.ref(V+'users/1108650').once('value'));
  await expect('claim with WRONG pin', false, ()=>claim(w.db,wu,'1108650','worker','0000'));
  await expect('claim with right pin but role=hygiene', false, ()=>claim(w.db,wu,'1108650','hygiene','4321'));
  await expect('claim another sap (email mismatch)', false, ()=>claim(w.db,wu,'2200','worker','5555'));
  await expect('claim for another uid', false, ()=>claim(w.db,'someoneelse','1108650','worker','4321'));
  await expect('claim correct', true, ()=>claim(w.db,wu,'1108650','worker','4321'));
  await expect('re-claim (role exists) -> change role', false, ()=>w.db.ref(V+'roles/'+wu+'/role').set('hygiene'));
  await expect('users/1108650 uid + pinHash:null + mustChange', true, ()=>w.db.ref(V).update({'users/1108650/uid':wu,'users/1108650/pinHash':null,'users/1108650/mustChange':true}));
  await expect('worker: change own role', false, ()=>w.db.ref(V+'users/1108650/role').set('hygiene'));
  await expect('worker: change own name', false, ()=>w.db.ref(V+'users/1108650/name').set('X'));
  await expect('worker: set pinHash (not delete)', false, ()=>w.db.ref(V+'users/1108650/pinHash').set('aa'));
  await expect('worker: clear mustChange', true, ()=>w.db.ref(V+'users/1108650/mustChange').remove());
  await expect('worker: read own roles', true, ()=>w.db.ref(V+'roles/'+wu).once('value'));
  await expect('worker: read own profile', true, ()=>w.db.ref(V+'users/1108650').once('value'));
  await expect('worker: read all users', false, ()=>w.db.ref(V+'users').once('value'));
  await expect('worker: read other user', false, ()=>w.db.ref(V+'users/2200').once('value'));
  await expect('worker: read settings/roster/hygcheck', true, async()=>{ await w.db.ref(V+'settings').once('value'); await w.db.ref(V+'roster').once('value'); await w.db.ref(V+'hygcheck').once('value'); });
  await expect('worker: query own uhaan', true, ()=>w.db.ref(V+'uhaan').orderByChild('sap').equalTo('1108650').once('value'));
  await expect('worker: query own fatigue+infect', true, async()=>{ await w.db.ref(V+'fatigue').orderByChild('sap').equalTo('1108650').once('value'); await w.db.ref(V+'infect').orderByChild('sap').equalTo('1108650').once('value'); });
  await expect('worker: query other sap fatigue', false, ()=>w.db.ref(V+'fatigue').orderByChild('sap').equalTo('2200').once('value'));
  await expect('worker: read all uhaan', false, ()=>w.db.ref(V+'uhaan').once('value'));
  await expect('worker: create own fatigue', true, ()=>w.db.ref(V+'fatigue/f9').set({id:'f9',sap:'1108650',date:T,score:2}));
  await expect('worker: create fatigue for other sap', false, ()=>w.db.ref(V+'fatigue/f10').set({id:'f10',sap:'2200',date:T,score:2}));
  await expect('worker: edit existing own fatigue', false, ()=>w.db.ref(V+'fatigue/f1/score').set(0));
  await expect('worker: create own uhaan + infect', true, ()=>w.db.ref(V).update({'uhaan/u9':{id:'u9',sap:'1108650',alba:'Оюут баар'},'infect/i9':{id:'i9',sap:'1108650',verdict:'huleegdej'}}));
  await expect('worker: set own infect verdict', false, ()=>w.db.ref(V+'infect/i1/verdict').set('orjbolno'));
  await expect('worker: sign own hygcheck row', true, ()=>w.db.ref(V).update({[`hygcheck/${T}_Оюут баар/rows/1108650/sign`]:true,[`hygcheck/${T}_Оюут баар/rows/1108650/signAt`]:'x'}));
  await expect('worker: sign other row', false, ()=>w.db.ref(V+`hygcheck/${T}_Оюут баар/rows/2200/sign`).set(true));
  await expect('worker: edit own row criteria', false, ()=>w.db.ref(V+`hygcheck/${T}_Оюут баар/rows/1108650/c`).set(['ok','ok']));
  await expect('worker: read hazards', false, ()=>w.db.ref(V+'hazards').once('value'));
  await expect('worker: read photos', false, ()=>w.db.ref(V+'photos').once('value'));
  await expect('worker: read notifs', false, ()=>w.db.ref(V+'notifs').once('value'));
  await expect('worker: create hazard (Шинэ)', true, ()=>w.db.ref(V+'hazards/hW').set({id:'hW',risk:'Бага',status:'Шинэ'}));
  await expect('worker: hygfail notif', false, ()=>w.db.ref(V+'notifs/hfw').set({id:'hfw',type:'hygfail',level:'fail',ts:1,title:'x'}));
  await expect('worker: settings write', false, ()=>w.db.ref(V+'settings/main/fatigueDays').set(1));
  await expect('worker: roster write', false, ()=>w.db.ref(V+'roster/r9').set({id:'r9',sap:'1108650'}));
  console.log('--- hygienist');
  const h=await emailUser('admin@eahs.local','eahs#1234'); const hu=h.auth.currentUser.uid;
  await expect('hyg claim correct', true, ()=>claim(h.db,hu,'admin','hygiene','1234'));
  await h.db.ref(V).update({'users/admin/uid':hu,'users/admin/pinHash':null});
  await expect('hyg: read all eahs/v2', true, ()=>h.db.ref(V).once('value'));
  await expect('hyg: create user + roles + authgen', true, ()=>h.db.ref(V).update({'users/3300':{sap:'3300',name:'Шинэ',role:'worker',alba:'Оффис',uid:'newuid'},'roles/newuid':{sap:'3300',role:'worker',by:'admin',at:1},'authgen/3300':'1'}));
  await expect('hyg: user with plain pin', false, ()=>h.db.ref(V+'users/x').set({sap:'x',name:'X',role:'worker',pin:'1234'}));
  await expect('hyg: user with bad role', false, ()=>h.db.ref(V+'users/x').set({sap:'x',name:'X',role:'root'}));
  await expect('hyg: change role / delete role', true, async()=>{ await h.db.ref(V+'roles/newuid/role').set('supervisor'); await h.db.ref(V+'roles/newuid').remove(); });
  await expect('hyg: hazard tracking update (status, assignee, due, log)', true, ()=>h.db.ref(V).update({'hazards/hHigh/status':'Хийгдэж буй','hazards/hHigh/assignee':'akhakh','hazards/hHigh/due':'2026-10-01','hazards/hHigh/log/l1':{ts:1,text:'Төлөв'}}));
  await expect('hyg: det > 1000', false, ()=>h.db.ref(V+'hazards/hHigh/det').set('a'.repeat(1001)));
  await expect('hyg: settings/qr + main', true, ()=>h.db.ref(V).update({'settings/qr':{areas:['Агуулах']},'settings/main/fatigueDays':6}));
  await expect('hyg: infect verdict', true, ()=>h.db.ref(V+'infect/i1/verdict').set('orjbolno'));
  await expect('hyg: delete notif', true, ()=>h.db.ref(V+'notifs/hz_hA').remove());
  await expect('hyg: notif title > 200', false, ()=>h.db.ref(V+'notifs/n1').set({id:'n1',type:'hygfail',ts:1,title:'a'.repeat(201)}));
  await expect('hyg: _meta overwrite', false, ()=>h.db.ref(V+'_meta').set({migratedAt:2}));
  await expect('hyg: unknown collection', false, ()=>h.db.ref(V+'foo/x').set(1));
  await expect('hyg: overwrite whole eahs/v2', false, ()=>h.db.ref(V).set({}));
  await expect('hyg: write borluulalt (any auth, unchanged)', true, ()=>h.db.ref('borluulalt/updatedAt').set('h'));
  console.log('--- supervisor (Оюут баар)');
  const s=await emailUser('akhakh@eahs.local','eahs#1234'); const su=s.auth.currentUser.uid;
  await expect('sup claim correct', true, ()=>claim(s.db,su,'akhakh','supervisor','1234'));
  await expect('sup: read users/hazards/notifs/photos', true, async()=>{ for(const c of ['users','hazards','notifs','photos','uhaan','hygcheck']) await s.db.ref(V+c).once('value'); });
  await expect('sup: read fatigue', false, ()=>s.db.ref(V+'fatigue').once('value'));
  await expect('sup: read roles of others', false, ()=>s.db.ref(V+'roles').once('value'));
  await expect('sup: approve uhaan own alba', true, ()=>s.db.ref(V).update({'uhaan/u1/status':'batlagdsan','uhaan/u1/supervisor':'Д'}));
  await expect('sup: approve uhaan other alba', false, ()=>s.db.ref(V+'uhaan/u2/status').set('batlagdsan'));
  await expect('sup: hazard status + log', true, ()=>s.db.ref(V).update({'hazards/hLow/status':'Шийдсэн','hazards/hLow/log/l2':{ts:2,text:'ok'}}));
  await expect('sup: delete hazard', false, ()=>s.db.ref(V+'hazards/hLow').remove());
  await expect('sup: hygcheck own alba edit', true, ()=>s.db.ref(V).update({[`hygcheck/${T}_Оюут баар/rows/2200/c`]:['ok','no'],[`hygcheck/${T}_Оюут баар/_u`]:1}));
  await expect('sup: hygcheck other alba', false, ()=>s.db.ref(V+`hygcheck/${T}_Манлай баар/rows/x/c`).set(['no']));
  await expect('sup: hygcheck move to other alba', false, ()=>s.db.ref(V+`hygcheck/${T}_Оюут баар/alba`).set('Манлай баар'));
  await expect('sup: hygfail notif', true, ()=>s.db.ref(V+'notifs/hf2').set({id:'hf2',type:'hygfail',level:'fail',ts:3,title:'Ажиллахгүй: Ө',alba:'Оюут баар',ref:T+'_Оюут баар'}));
  await expect('sup: delete notif', false, ()=>s.db.ref(V+'notifs/hf2').remove());
  await expect('sup: write users', false, ()=>s.db.ref(V+'users/2200/role').set('supervisor'));
  await expect('sup: grant roles', false, ()=>s.db.ref(V+'roles/x').set({sap:'2200',role:'hygiene'}));
  await expect('sup: settings write', false, ()=>s.db.ref(V+'settings/main/fatigueDays').set(1));
  console.log('--- after migration');
  await expect('claim again after pinHash removed (new account, same PIN)', false, async()=>{ const x=await emailUser('1108650+9@eahs.local','eahs#4321'); await claim(x.db,x.auth.currentUser.uid,'1108650','worker','4321'); });
  const b=await owner('borluulalt','GET'); await expect('borluulalt data present', true, async()=>{ if(!b || !b.users) throw new Error('missing'); });
}
async function transition(){
  console.log('=== TRANSITION database.rules.transition.json');
  await reset('/workspace/eahs/database.rules.transition.json');
  const an=mkApp(); await an.auth.signInAnonymously();
  await expect('anon (old clients): read eahs/v2', true, ()=>an.db.ref(V).once('value'));
  await expect('anon (old clients): users/hygcheck/hazards writes', true, ()=>an.db.ref(V).update({'users/admin/name':'Э','hygcheck/x/rows/r/c':['ok'],'hazards/h9':{id:'h9',status:'Шинэ'},'settings/main/fatigueDays':7}));
  await expect('anon: self-grant role (blocked even in transition)', false, ()=>an.db.ref(V+'roles/'+an.auth.currentUser.uid).set({sap:'admin',role:'hygiene'}));
  await expect('anon: authgen write', false, ()=>an.db.ref(V+'authgen/admin').set('1'));
  await expect('anon: notif valid', true, ()=>an.db.ref(V+'notifs/n1').set({id:'n1',type:'hazard',ts:1,title:'x',ref:'h9'}));
  await expect('anon: notif invalid type', false, ()=>an.db.ref(V+'notifs/n2').set({id:'n2',type:'evil',ts:1,title:'x'}));
  await expect('anon: user with plain pin', false, ()=>an.db.ref(V+'users/x').set({sap:'x',name:'X',role:'worker',pin:'1'}));
  await expect('anon: unknown collection', false, ()=>an.db.ref(V+'foo').set(1));
  const h=await emailUser('admin@eahs.local','eahs#1234');
  await expect('hyg migration claim (transition)', true, ()=>claim(h.db,h.auth.currentUser.uid,'admin','hygiene','1234'));
  await expect('hyg: grant role to new user (transition)', true, ()=>h.db.ref(V+'roles/zz').set({sap:'3300',role:'worker'}));
  await expect('borluulalt anon set', true, ()=>an.db.ref('borluulalt/x').set(1));
  const z=mkApp(); await expect('no auth: read eahs/v2', false, ()=>z.db.ref(V).once('value'));
}
(async()=>{
  // borluulalt section must be byte-identical in both files and vs. live (main) rules
  const live=JSON.parse(require('child_process').execSync('git -C /workspace/eahs show main:database.rules.json').toString()).rules.borluulalt;
  for(const f of ['database.rules.json','database.rules.transition.json']){
    const r=JSON.parse(fs.readFileSync('/workspace/eahs/'+f)).rules;
    await expect(f+': borluulalt identical to main', true, async()=>{ if(JSON.stringify(r.borluulalt)!==JSON.stringify(live)) throw new Error('diff'); });
    await expect(f+': only borluulalt + eahs at root', true, async()=>{ if(Object.keys(r).sort().join()!=='borluulalt,eahs') throw new Error(Object.keys(r)); });
  }
  await strict(); await transition();
  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  await fetch(`${DBU}/.settings/rules.json?ns=${NS}`,{method:'PUT',headers:{Authorization:'Bearer owner'},body:fs.readFileSync('/workspace/eahs/database.rules.json','utf8')});
  process.exit(fail?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
