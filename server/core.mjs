import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const dbFile = path.join(dataDir, 'db.json');
const uploadDir = path.join(dataDir, 'evidence');
const now = () => new Date().toISOString();
const day = () => now().slice(0,10);
const id = () => crypto.randomUUID();
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const pwHash = (password) => {
  const salt=crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;
};
const checkPw = (password, saved) => {
  try { const [salt,encoded]=saved.split(':'); const a=Buffer.from(encoded,'hex'), b=crypto.scryptSync(password,salt,a.length); return a.length===b.length && crypto.timingSafeEqual(a,b); } catch { return false; }
};
function atomicWrite(filename,data){
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  const tmp=filename+'.'+process.pid+'.'+crypto.randomBytes(4).toString('hex')+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(data,null,2),{mode:0o600});
  fs.renameSync(tmp,filename);
}
function initialDb(){return {schema:2,site:seed.site,modules:seed.modules,situations:seed.situations,tips:seed.tips,reports:[],posts:seed.posts,users:[],progress:{},sessions:{},resets:{},metrics:{views:{},answers:0,reports:0}};}
let db;
export function initDB(){
  fs.mkdirSync(dataDir,{recursive:true});
  if(fs.existsSync(dbFile)){
    try{db=JSON.parse(fs.readFileSync(dbFile,'utf8'));}catch{throw new Error('La base de datos no se puede leer. Restaura una copia de seguridad antes de continuar.');}
  } else {db=initialDb();atomicWrite(dbFile,db);}
  const email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase(), password=process.env.ADMIN_PASSWORD||'';
  if(email && password && !db.users.some(x=>x.role==='admin')){
    if(password.length<12)throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
    db.users.push({id:id(),name:'Administración',email,passwordHash:pwHash(password),role:'admin',created:day()});save();
    console.log(`[Inicio] Administrador inicial creado: ${email}. Elimina ADMIN_PASSWORD del entorno después del primer arranque.`);
  }
  return db;
}
function save(){atomicWrite(dbFile,db)}
export class AppError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const fail=(msg,status)=>{throw new AppError(msg,status)};
const str=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const required=(v,name,min=2,max=500)=>{ const s=str(v,max+1); if(s.length<min||s.length>max)fail(`Campo inválido: ${name}`); return s; };
const validEmail=(v)=>{let e=str(v,200).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)||e.length>200)fail('Correo electrónico inválido.');return e;};
const visibleUser=(u)=>({id:u.id,name:u.name,email:u.email,role:u.role,created:u.created});
export const publicState = (user) => ({
  site:db.site,modules:db.modules,situations:db.situations,tips:db.tips,
  posts:db.posts,reports:user?.role==='admin'?db.reports:[],
  users:user?.role==='admin'?db.users.map(visibleUser):user?[visibleUser(user)]:[],
  progress:user?{[user.id]:db.progress[user.id]||{}}:{},
  session:user?.id??null,
  metrics:user?.role==='admin'?db.metrics:undefined
});
export function getUser(cookie){
  if(!db) initDB();
  const cookieValue=String(cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4);
  if(!cookieValue||!/^[-\w]{40,200}$/.test(cookieValue))return null;
  const session=db.sessions[hash(cookieValue)];
  if(!session||session.until<Date.now())return null;
  return db.users.find(u=>u.id===session.userId)||null;
}
export function sessionCookie(token,clear=false){const max=clear?0:60*60*24*7;return `sid=${clear?'':token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${max}${process.env.SECURE_COOKIES==='1'?'; Secure':''}`;}
export function login(email,password){
  const u=db.users.find(x=>x.email===validEmail(email));
  if(!u||!checkPw(String(password||''),u.passwordHash))fail('Correo o contraseña incorrectos.',401);
  return makeSession(u);
}
function makeSession(u){const token=crypto.randomBytes(32).toString('base64url'); db.sessions[hash(token)]={userId:u.id,until:Date.now()+7*864e5};save();return{token,user:visibleUser(u)};}
export function register(name,email,password){
  name=required(name,'nombre',2,80);email=validEmail(email);
  if(typeof password!=='string'||password.length<8||password.length>128)fail('La contraseña debe tener entre 8 y 128 caracteres.');
  if(db.users.some(x=>x.email===email))fail('Ya existe una cuenta con ese correo.',409);
  const u={id:id(),name,email,passwordHash:pwHash(password),role:'alumno',created:day()};db.users.push(u);return makeSession(u);
}
export function logout(cookie){ const t=String(cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4);if(t){delete db.sessions[hash(t)];save();}}
export function requireAdmin(user){if(user?.role!=='admin')fail('Acceso restringido a administración.',403)}
export function requestReset(email){
  email=validEmail(email);const u=db.users.find(x=>x.email===email);
  if(!u)return null;
  const code=crypto.randomBytes(18).toString('base64url');db.resets[hash(code)]={userId:u.id,expires:Date.now()+15*60e3};save();
  if(process.env.NODE_ENV!=='production')console.log(`[DESARROLLO] Código de recuperación para ${email}: ${code}`);
  return process.env.NODE_ENV!=='production'&&process.env.DEV_SHOW_RESET_CODE==='1'?code:null;
}
export function resetPassword(email,code,password){
  email=validEmail(email);
  if(typeof code!=='string'||code.length<20)fail('Código de recuperación inválido.');
  if(typeof password!=='string'||password.length<8||password.length>128)fail('La contraseña debe tener al menos 8 caracteres.');
  const entry=db.resets[hash(code)],u=db.users.find(x=>x.id===entry?.userId&&x.email===email);
  if(!entry||entry.expires<Date.now()||!u)fail('Código inválido o vencido.');
  u.passwordHash=pwHash(password);delete db.resets[hash(code)];
  for(const [key,s] of Object.entries(db.sessions))if(s.userId===u.id)delete db.sessions[key];
  save();
}
export function viewPage(page){ if(!/^(inicio|problema|datos|recomendaciones|foro|modulos|progreso|reportar|cuenta|admin)$/.test(String(page)))return;db.metrics.views[page]=(db.metrics.views[page]||0)+1;save();}
export function choose(user,situationId,choiceIndex){
 if(!user)fail('Inicia sesión para guardar tu progreso.',401);
 const s=db.situations.find(x=>x.id===situationId);if(!s)fail('Situación no encontrada.',404);
 if(!Number.isInteger(choiceIndex)||choiceIndex<0||choiceIndex>=s.opts.length)fail('Opción inválida.');
 db.progress[user.id]??={};db.progress[user.id][s.id]=Boolean(s.opts[choiceIndex].good);db.metrics.answers+=1;save();return db.progress[user.id][s.id];
}
export function resetProgress(user){if(!user)fail('Inicia sesión para borrar el progreso.',401);delete db.progress[user.id];save();}
function safeEvidence(e){
 if(!e)return null;
 const name=required(e.name,'nombre de archivo',1,160);const content=String(e.data||'');
 if(!/^[a-zA-Z0-9+/=]+$/.test(content)||content.length>8_000_000)fail('Archivo demasiado grande o inválido. Máximo 5 MB.');
 const bytes=Buffer.from(content,'base64');if(bytes.length>5_000_000)fail('El archivo supera 5 MB.');
 const mime=str(e.mime,100);let ext=null;
 if(mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';
 if(mime==='image/jpeg'&&bytes[0]===0xff&&bytes[1]===0xd8)ext='jpg';
 if(mime==='image/webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')ext='webp';
 if(mime==='video/mp4'&&bytes.toString('ascii',4,8)==='ftyp')ext='mp4';
 if(!ext)fail('Solo se admiten PNG, JPG, WEBP o MP4 válidos.');
 fs.mkdirSync(uploadDir,{recursive:true});const key=id();fs.writeFileSync(path.join(uploadDir,key+'.'+ext),bytes,{mode:0o600});
 return{id:key,name:name.replace(/[<>]/g,''),mime,bytes:bytes.length,ext};
}
export function evidence(user,evidenceId){requireAdmin(user);const r=db.reports.find(x=>x.evidence?.id===evidenceId);if(!r)fail('Evidencia no encontrada.',404);return {metadata:r.evidence,path:path.join(uploadDir,r.evidence.id+'.'+r.evidence.ext)};}
export function createReport(data){
 const evidence=safeEvidence(data?.evidence);
 const r={id:id(),route:required(data.route,'ruta',2,120),time:required(data.time,'horario',2,100),tactic:required(data.tactic,'táctica',2,120),story:required(data.story,'relato',8,2000),date:day(),status:'nuevo',evidence};
 db.reports.unshift(r);db.metrics.reports+=1;save();return{id:r.id};
}
export function createPost(data,user){
 const post={id:id(),author:data.anonymous||!user?'Anónimo':user.name,route:required(data.route,'ruta',2,90),title:required(data.title,'título',4,150),text:required(data.text,'publicación',8,2000),date:day(),replies:[]};db.posts.unshift(post);save();return post;
}
export function createReply(postId,data,user){
 const p=db.posts.find(x=>x.id===postId);if(!p)fail('Publicación no encontrada.',404);
 const r={id:id(),author:data.anonymous||!user?'Anónimo':user.name,text:required(data.text,'respuesta',2,1000),date:day()};p.replies.push(r);save();return r;
}
export function deletePost(postId,user){requireAdmin(user);const prev=db.posts.length;db.posts=db.posts.filter(x=>x.id!==postId);if(db.posts.length===prev)fail('Publicación no encontrada.',404);save();}
const plain=(v)=>JSON.parse(JSON.stringify(v));
function validList(items,name,max){if(!Array.isArray(items)||items.length>max)fail(`Lista inválida: ${name}`);return plain(items);}
function validateAdminPayload(payload){
 const site=payload.site;
 const validated={site:{heroTitle:required(site?.heroTitle,'título',1,220),heroText:required(site?.heroText,'descripción',1,1000)}};
 validated.modules=validList(payload.modules,'módulos',40).map(m=>({id:required(m.id,'id',1,70),tag:required(m.tag,'etiqueta',1,70),title:required(m.title,'título',1,140),desc:required(m.desc,'descripción',1,500)}));
 validated.situations=validList(payload.situations,'situaciones',150).map(s=>({id:required(s.id,'id',1,70),moduleId:required(s.moduleId,'módulo',1,70),where:required(s.where,'lugar',1,150),img:str(s.img,2000),q:required(s.q,'pregunta',1,700),opts:validList(s.opts,'opciones',8).map(o=>({text:required(o.text,'opción',1,600),good:o.good===true,consequence:required(o.consequence,'consecuencia',1,2000),feedback:required(o.feedback,'retroalimentación',1,2000)}))}));
 validated.tips=validList(payload.tips,'recomendaciones',100).map(t=>({id:required(t.id,'id',1,70),moment:required(t.moment,'momento',1,100),title:required(t.title,'título',1,150),text:required(t.text,'texto',1,1000),img:str(t.img,2000)}));
 return validated;
}
export function adminSync(user,payload){
 requireAdmin(user);if(!payload||typeof payload!=='object')fail('Datos inválidos.');
 const validated=validateAdminPayload(payload);
 if(!validated.situations.every(s=>validated.modules.some(m=>m.id===s.moduleId)))fail('Situaciones con módulos inexistentes.');
 const reports=validList(payload.reports,'reportes',5000);
 const statuses=new Map(reports.map(r=>[r.id,r.status]));
 const users=validList(payload.users,'usuarios',5000), wanted=new Map(users.map(u=>[u.id,u.role]));
 if(wanted.get(user.id)!=='admin')fail('No puedes modificar tu propio rol.');
 for(const u of db.users){if(u.id===user.id)continue;const role=wanted.get(u.id);if(role!==undefined && !['alumno','admin'].includes(role))fail('Rol inválido.');}
 db.site=validated.site;db.modules=validated.modules;db.situations=validated.situations;db.tips=validated.tips;
 db.reports=db.reports.map(r=>({...r,status:statuses.get(r.id)==='revisado'?'revisado':r.status}));
 db.users=db.users.filter(u=>u.id===user.id||wanted.has(u.id)).map(u=>({...u,role:u.id===user.id?'admin':wanted.get(u.id)}));
 for(const [uId] of Object.entries(db.progress))if(!db.users.some(u=>u.id===uId))delete db.progress[uId];
 for(const [key,s] of Object.entries(db.sessions))if(!db.users.some(u=>u.id===s.userId))delete db.sessions[key];
 save();return publicState(user);
}
export function publishReport(user,reportId,summary){
  requireAdmin(user);
  const report=db.reports.find(r=>r.id===reportId);
  if(!report)fail('Reporte no encontrado.',404);
  if(report.publishedAt)fail('Este reporte ya está publicado.',409);
  summary=required(summary,'resumen público',20,1000);
  const post={id:id(),author:'Equipo de revisión',route:report.route,title:`Alerta preventiva · ${report.tactic}`,text:summary,date:day(),replies:[]};
  db.posts.unshift(post);report.status='revisado';report.publishedAt=now();report.publicPostId=post.id;save();return {postId:post.id};
}
export function deleteReport(user,reportId){
 requireAdmin(user);
 const report=db.reports.find(r=>r.id===reportId);if(!report)fail('Reporte no encontrado.',404);
 db.reports=db.reports.filter(r=>r.id!==reportId);
 if(report.evidence){try{fs.rmSync(path.join(uploadDir,report.evidence.id+'.'+report.evidence.ext))}catch{}}
 save();
}
export function reportsCsv(user){requireAdmin(user);const cells=['Ruta','Horario','Táctica','Relato','Fecha','Estado','Evidencia'];const quote=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+@-]/,'\'$&')+'"';return '\uFEFF'+[cells,...db.reports.map(r=>[r.route,r.time,r.tactic,r.story,r.date,r.status,r.evidence?.name||''])].map(row=>row.map(quote).join(',')).join('\r\n');}
export function resetForTests(){db=initialDb();save();}
