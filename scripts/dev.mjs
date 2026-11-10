import {spawn} from 'node:child_process';
try { process.loadEnvFile('.env') } catch { /* configuración opcional */ }
const children=[];
for(const [name,args] of [['API',['server/index.mjs']],['WEB',['node_modules/vite/bin/vite.js','--host','0.0.0.0']]]){
 const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,NODE_ENV:'development'}});
 child.on('exit',code=>{if(code!==0){console.error(`${name} terminó con código ${code}`);stop()}});children.push(child);
}
function stop(){for(const p of children)if(!p.killed)p.kill('SIGTERM')}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
