import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as app from './core.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const PORT=Number(process.env.API_PORT || process.env.PORT || 3001);
app.initDB();
// Límite básico en memoria para minimizar abuso de formularios públicos.
const rateCounters = new Map();
function throttle(req, key, limit, windowMs=60_000){
 const client=req.socket.remoteAddress || 'local';
 const id=key+':'+client;const now=Date.now();
 const previous=rateCounters.get(id);
 const hit=previous&&previous.until>now?previous:{until:now+windowMs,count:0};
 hit.count++;rateCounters.set(id,hit);
 if(hit.count>limit)throw new app.AppError('Demasiados intentos. Vuelve a probar más tarde.',429);
 if(rateCounters.size>3000)for(const [k,v] of rateCounters)if(v.until<now)rateCounters.delete(k);
}
const allowedOrigins=()=>[process.env.APP_ORIGIN,`http://localhost:${PORT}`,`http://127.0.0.1:${PORT}`,'http://localhost:5173','http://127.0.0.1:5173'].filter(Boolean);
function json(res,status,value,headers={}){const body=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body)}
function readBody(req,limit=9_000_000){return new Promise((resolve,reject)=>{const parts=[];let size=0;req.on('data',chunk=>{size+=chunk.length;if(size>limit){reject(new app.AppError('Solicitud demasiado grande.',413));req.destroy();return;}parts.push(chunk)});req.on('end',()=>{try{const txt=Buffer.concat(parts).toString('utf8');resolve(txt?JSON.parse(txt):{})}catch{reject(new app.AppError('JSON inválido.'))}});req.on('error',reject)})}
async function route(req,res){
 const origin=req.headers.origin;
 if(!['GET','HEAD','OPTIONS'].includes(req.method||'GET')&&origin){
  let sameHost=false;try{sameHost=new URL(origin).host===req.headers.host}catch{}
  if(!sameHost&&!allowedOrigins().includes(origin))throw new app.AppError('Origen no autorizado.',403);
 }
 const url=new URL(req.url||'/',`http://localhost:${PORT}`);
 const key=`${req.method} ${url.pathname}`;
 const user=app.getUser(req.headers.cookie);
 if(key==='GET /api/health')return json(res,200,{ok:true,service:'viaja-alerta',time:new Date().toISOString()});
 if(key==='GET /api/state')return json(res,200,app.publicState(user));
 if(key==='POST /api/auth/register'){throttle(req,'register',10,60_000);const b=await readBody(req);const s=app.register(b.name,b.email,b.password);return json(res,201,{ok:true,user:s.user},{'Set-Cookie':app.sessionCookie(s.token)})}
 if(key==='POST /api/auth/login'){throttle(req,'login',25,60_000);const b=await readBody(req);const s=app.login(b.email,b.password);return json(res,200,{ok:true,user:s.user},{'Set-Cookie':app.sessionCookie(s.token)})}
 if(key==='POST /api/auth/logout'){app.logout(req.headers.cookie);return json(res,200,{ok:true},{'Set-Cookie':app.sessionCookie('',true)})}
 if(key==='POST /api/auth/request-reset'){throttle(req,'reset',6,15*60_000);const b=await readBody(req);const devCode=app.requestReset(b.email);return json(res,200,{ok:true,message:'Si existe la cuenta, se ha generado un código de recuperación.',...(devCode?{devCode}:{})})}
 if(key==='POST /api/auth/reset'){const b=await readBody(req);app.resetPassword(b.email,b.code,b.password);return json(res,200,{ok:true})}
 if(key==='POST /api/progress/answer'){const b=await readBody(req);return json(res,200,{correct:app.choose(user,b.situationId,b.choiceIndex)})}
 if(key==='POST /api/progress/reset'){app.resetProgress(user);return json(res,200,{ok:true})}
 if(key==='POST /api/reports'){throttle(req,'reports',8,60*60_000);const b=await readBody(req);return json(res,201,app.createReport(b))}
 if(key==='POST /api/posts'){throttle(req,'posts',15,60*60_000);const b=await readBody(req);return json(res,201,app.createPost(b,user))}
 if(req.method==='POST'&&/^\/api\/posts\/[-\w]+\/replies$/.test(url.pathname)){const b=await readBody(req);return json(res,201,app.createReply(url.pathname.split('/')[3],b,user))}
 if(req.method==='DELETE'&&/^\/api\/posts\/[-\w]+$/.test(url.pathname)){app.deletePost(url.pathname.split('/')[3],user);return json(res,200,{ok:true})}
 if(req.method==='POST'&&/^\/api\/admin\/reports\/[-\w]+\/publish$/.test(url.pathname)){const b=await readBody(req);return json(res,201,app.publishReport(user,url.pathname.split('/')[4],b.summary))}
 if(req.method==='DELETE'&&/^\/api\/admin\/reports\/[-\w]+$/.test(url.pathname)){app.deleteReport(user,url.pathname.split('/')[4]);return json(res,200,{ok:true})}
 if(key==='POST /api/admin/state'){const b=await readBody(req);return json(res,200,app.adminSync(user,b))}
 if(key==='GET /api/admin/reports.csv'){const csv=app.reportsCsv(user);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="reportes-viaja-alerta.csv"','Cache-Control':'no-store'});return res.end(csv)}
 if(key==='POST /api/metrics/view'){const b=await readBody(req);app.viewPage(b.page);return json(res,200,{ok:true})}
 if(req.method==='GET'&&/^\/api\/evidence\/[-\w]+$/.test(url.pathname)){
  const f=app.evidence(user,url.pathname.split('/')[3]);res.writeHead(200,{'Content-Type':f.metadata.mime,'Content-Disposition':`attachment; filename="${encodeURIComponent(f.metadata.name).replace(/%/g,'_')}"`,'Content-Security-Policy':"default-src 'none'",'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'});return fs.createReadStream(f.path).pipe(res);
 }
 if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Ruta de API no encontrada.'});
 // Vite handles static files during development. In production we serve built dist.
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Método no permitido.'});
 const requested=decodeURIComponent(url.pathname);
 const dist=path.join(root,'dist');let filename=path.resolve(dist,'.'+requested);
 if(!filename.startsWith(dist+path.sep) && filename!==dist)throw new app.AppError('Ruta inválida.',403);
 try{if(!fs.statSync(filename).isFile())filename=path.join(dist,'index.html')}catch{filename=path.join(dist,'index.html')}
 if(!fs.existsSync(filename))return json(res,404,{error:'Compila primero el frontend con npm run build.'});
 const ext=path.extname(filename);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'}[ext]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff'});fs.createReadStream(filename).pipe(res);
}
export const server=http.createServer((req,res)=>{route(req,res).catch(error=>{if(res.headersSent){res.destroy();return;}const status=error instanceof app.AppError?error.status:500;console.error('[API]',error.message);json(res,status,{error:status===500?'Error interno del servidor.':error.message});});});
if(process.env.NODE_ENV!=='test')server.listen(PORT,()=>console.log(`Viaja Alerta API: http://localhost:${PORT}`));
