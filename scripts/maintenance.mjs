import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const report={time:new Date().toISOString(),ok:false,live:[],playbackVerified:false};
async function get(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);return r;}
try{
 const env=parseEnv(fs.readFileSync(path.join(root,'companion/.env'),'utf8'));
 const core=parseEnv(fs.readFileSync(path.join(root,'backend/.env.local'),'utf8'));
 const base=(env.CORE_URL||'http://127.0.0.1:8080').replace(/\/+$/,'');
 const companion='http://127.0.0.1:'+(env.COMPANION_PORT||8090);
 let ready=false;try{const h=await (await get(companion+'/health')).json();await get(base+'/api/status');ready=h.service==='private-cinema-tv';}catch{}
 if(!ready&&process.platform==='win32'){
  const p=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/start.ps1')],{windowsHide:true,stdio:'ignore',timeout:120000});
  if(p.status!==0)throw Error('Startup failed; inspect runtime logs');
 }
 const auth=await get(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:core.PASSWORD})});
 const cookie=auth.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('Missing session');const headers={cookie};
 const health=await (await get(companion+'/health')).json();if(health.service!=='private-cinema-tv')throw Error('Wrong service');
 const status=await (await get(base+'/api/status')).json();
 for(const source of status.defaultLiveSources||[]){try{await get(base+'/api/live/playlist?force=1&url='+encodeURIComponent(source.url),{headers});report.live.push({ok:true});}catch{report.live.push({ok:false});}}
 await get(companion+'/tv/sources/refresh',{method:'POST',headers});
 let finished=false;
 for(let i=0;i<180;i++){await new Promise(r=>setTimeout(r,2000));const s=await (await get(companion+'/tv/sources/refresh',{headers})).json();if(!s.running){finished=true;report.catalogOK=s.phase==='done';break;}}
 if(!finished)throw Error('Refresh timeout');
 report.ok=report.catalogOK&&report.live.every(x=>x.ok);
}catch{report.error='Maintenance failed; check configuration, runtime logs and source availability.';}
fs.mkdirSync(path.join(root,'runtime'),{recursive:true});
fs.writeFileSync(path.join(root,'runtime/maintenance.json'),JSON.stringify(report,null,2));
console.log(report.ok?'Maintenance passed (playback not verified).':'Maintenance failed; see runtime/maintenance.json');
if(!report.ok)process.exitCode=1;
