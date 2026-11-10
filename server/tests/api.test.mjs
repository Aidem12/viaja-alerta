import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'viaja-alerta-api-'));
process.env.NODE_ENV='test';process.env.DATA_DIR=dir;
process.env.ADMIN_EMAIL='admin@ejemplo.test';process.env.ADMIN_PASSWORD='AdminSegura1234!';
const {server}=await import('../index.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
async function request(route,method='GET',body, cookie){
  const res=await fetch(base+'/api'+route,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
  const contentType=res.headers.get('content-type')||'';
  const data=contentType.includes('application/json')?await res.json():await res.text();
  return {status:res.status,data,cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
try{
await test('api health and student account/permissions',async()=>{
  let health=await request('/health');assert.equal(health.status,200);
  let pub=await request('/state');assert.equal(pub.status,200);assert.equal(pub.data.modules.length,4);assert.equal(pub.data.users.length,0);assert.equal(pub.data.reports.length,0);
  const register=await request('/auth/register','POST',{name:'Alumno de prueba',email:'alumno@ejemplo.test',password:'ClaveSegura1234!'});assert.equal(register.status,201);assert.ok(register.cookie?.startsWith('sid='));
  const cookie=register.cookie;
  const state=await request('/state','GET',null,cookie);assert.equal(state.data.users[0].email,'alumno@ejemplo.test');assert.ok(!('passwordHash' in state.data.users[0]));
  assert.equal((await request('/admin/state','POST',{},cookie)).status,403);
  const answer=await request('/progress/answer','POST',{situationId:'s1',choiceIndex:1},cookie);assert.equal(answer.status,200);assert.equal(answer.data.correct,true);
  const done=await request('/state','GET',null,cookie);assert.equal(done.data.progress[done.data.session].s1,true);
  assert.equal((await request('/auth/register','POST',{name:'Otro',email:'alumno@ejemplo.test',password:'ClaveSegura1234!'})).status,409);
  const logout=await request('/auth/logout','POST',{},cookie);assert.equal(logout.status,200);
  assert.equal((await request('/progress/answer','POST',{situationId:'s1',choiceIndex:0},cookie)).status,401);
});
await test('anonymous report with image evidence and admin privacy',async()=>{
  const png=Buffer.from('89504e470d0a1a0a0000000049454e44ae426082','hex').toString('base64');
  const report=await request('/reports','POST',{route:'Ruta 10',time:'18:30',tactic:'Tapón',story:'Varias personas bloquearon la puerta.',evidence:{name:'evidencia.png',mime:'image/png',data:png}});assert.equal(report.status,201);
  const publicState=await request('/state');assert.equal(publicState.data.reports.length,0);
  const adminLogin=await request('/auth/login','POST',{email:'admin@ejemplo.test',password:'AdminSegura1234!'});assert.equal(adminLogin.status,200);const cookie=adminLogin.cookie;
  const adminState=await request('/state','GET',null,cookie);assert.equal(adminState.data.reports.length,1);assert.equal(adminState.data.users.length,2);
  const ev=adminState.data.reports[0].evidence;
  assert.equal((await request('/evidence/'+ev.id)).status,403);
  const evidence=await request('/evidence/'+ev.id,'GET',null,cookie);assert.equal(evidence.status,200);
  assert.equal((await request('/admin/reports.csv','GET',null,cookie)).status,200);
  const published=await request(`/admin/reports/${report.data.id}/publish`,'POST',{summary:'Alerta educativa validada: mantén tus pertenencias en un compartimento seguro.'},cookie);
  assert.equal(published.status,201);
  const afterPublication=await request('/state');
  assert.ok(afterPublication.data.posts.some(p=>p.id===published.data.postId));
  assert.equal((await request(`/admin/reports/${report.data.id}/publish`,'POST',{summary:'Una publicación que no debe duplicarse.'},cookie)).status,409);
});
await test('password recovery requires a valid one-use code',async()=>{
  process.env.DEV_SHOW_RESET_CODE='1';
  const req=await request('/auth/request-reset','POST',{email:'alumno@ejemplo.test'});
  assert.equal(req.status,200);assert.ok(req.data.devCode?.length>20);
  assert.equal((await request('/auth/reset','POST',{email:'alumno@ejemplo.test',code:'wrong',password:'ClaveNueva2026!'})).status,400);
  assert.equal((await request('/auth/reset','POST',{email:'alumno@ejemplo.test',code:req.data.devCode,password:'ClaveNueva2026!'})).status,200);
  assert.equal((await request('/auth/reset','POST',{email:'alumno@ejemplo.test',code:req.data.devCode,password:'ClaveNueva2026!'})).status,400);
  assert.equal((await request('/auth/login','POST',{email:'alumno@ejemplo.test',password:'ClaveSegura1234!'})).status,401);
  assert.equal((await request('/auth/login','POST',{email:'alumno@ejemplo.test',password:'ClaveNueva2026!'})).status,200);
  delete process.env.DEV_SHOW_RESET_CODE;
});
await test('invalid or oversized evidence is rejected and views are recorded',async()=>{
  const file=await request('/reports','POST',{route:'Ruta 12',time:'17:00',tactic:'Empujón',story:'Un relato suficientemente largo',evidence:{name:'evil.svg',mime:'image/svg+xml',data:Buffer.from('<svg/>').toString('base64')}});
  assert.equal(file.status,400);
  assert.equal((await request('/metrics/view','POST',{page:'modulos'})).status,200);
  const admin=await request('/auth/login','POST',{email:'admin@ejemplo.test',password:'AdminSegura1234!'});
  const state=(await request('/state','GET',null,admin.cookie)).data;
  assert.ok((state.metrics.views.modulos||0)>=1);
  const payload={site:state.site,modules:state.modules,situations:state.situations,tips:state.tips,reports:state.reports,users:state.users.map(u=>({...u,role:'alumno'}))};
  assert.equal((await request('/admin/state','POST',payload,admin.cookie)).status,400);
});
await test('forum publishing / moderation and admin editorial changes',async()=>{
  const post=await request('/posts','POST',{route:'Ruta 5',title:'Intento en el acceso',text:'Una persona hizo una distracción.'});assert.equal(post.status,201);
  const reply=await request(`/posts/${post.data.id}/replies`,'POST',{text:'Gracias por reportarlo'});assert.equal(reply.status,201);
  const login=await request('/auth/login','POST',{email:'admin@ejemplo.test',password:'AdminSegura1234!'});const cookie=login.cookie;
  const current=(await request('/state','GET',null,cookie)).data;
  const patch={site:{...current.site,heroTitle:'Título institucional de prueba'},modules:current.modules,situations:current.situations,tips:current.tips,reports:current.reports.map(r=>({...r,status:'revisado'})),posts:current.posts,users:current.users};
  const saved=await request('/admin/state','POST',patch,cookie);assert.equal(saved.status,200);assert.equal(saved.data.site.heroTitle,'Título institucional de prueba');
  const deletion=await request('/posts/'+post.data.id,'DELETE',undefined,cookie);assert.equal(deletion.status,200);
  const after=await request('/state');assert.ok(!after.data.posts.some(p=>p.id===post.data.id));
});
}finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
