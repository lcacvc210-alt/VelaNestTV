import fs from 'node:fs';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';import {once} from 'node:events';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('built backend status, authentication and empty-source search',{timeout:30000},async t=>{
 const reserve=http.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const password='test-only-'+Date.now();const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port),'-H','127.0.0.1'],{cwd:path.join(repo,'backend'),env:{...process.env,PASSWORD:password,DEFAULT_SOURCES:'[]',DEFAULT_LIVE_SOURCES:'[]',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);t.after(async()=>{child.kill();await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);});
 const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,logs);
 let r=await fetch(base+'/api/status');const status=await r.json();assert.deepEqual(status.defaultSources,[]);assert.deepEqual(status.defaultLiveSources,[]);
 const post=(p,body,headers={})=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await post('/api/auth',{password:'wrong'})).status,401);
 assert.equal((await post('/api/search',{wd:'fixture',sources:[]})).status,401);
 r=await post('/api/auth',{password});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie')?.split(';')[0];assert(cookie);
 r=await fetch(base+'/api/auth',{headers:{cookie}});assert.equal((await r.json()).verified,true);
 r=await post('/api/search',{wd:'fixture',sources:[]},{cookie});assert.equal(r.status,400);assert((await r.json()).error);

 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'velanesttv-core-'));const media=path.join(temp,'media');fs.mkdirSync(media);
 const reserve2=http.createServer();reserve2.listen(0,'127.0.0.1');await once(reserve2,'listening');const companionPort=reserve2.address().port;await new Promise(r=>reserve2.close(r));
 const companion=spawn(process.execPath,['server.mjs'],{cwd:path.join(repo,'companion'),env:{...process.env,PASSWORD:password,CORE_URL:base,COMPANION_PORT:String(companionPort),DISCOVERY_PORT:'0',BIND_HOST:'127.0.0.1',EXTERNAL_METADATA:'false',COMPANION_DATA_DIR:path.join(temp,'data'),NAS_ROOT:media},stdio:'ignore',windowsHide:true});
 t.after(async()=>{companion.kill();await Promise.race([once(companion,'exit'),new Promise(r=>setTimeout(r,1000))]);fs.rmSync(temp,{recursive:true,force:true});});
 const companionBase='http://127.0.0.1:'+companionPort;let companionReady=false;for(let i=0;i<60;i++){try{if((await fetch(companionBase+'/health')).ok){companionReady=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(companionReady);
 r=await fetch(companionBase+'/tv/nas',{headers:{cookie}});assert.equal(r.status,200);assert.deepEqual((await r.json()).items,[]);
 for(const folder of ['scripts','backend','companion'])fs.mkdirSync(path.join(temp,folder),{recursive:true});
 fs.copyFileSync(path.join(repo,'scripts/doctor.mjs'),path.join(temp,'scripts/doctor.mjs'));
 fs.writeFileSync(path.join(temp,'backend/.env.local'),'PASSWORD='+password+'\nDEFAULT_SOURCES=[]\nDEFAULT_LIVE_SOURCES=[]\n');
 fs.writeFileSync(path.join(temp,'companion/.env'),'PASSWORD='+password+'\nCORE_URL='+base+'\nCOMPANION_PORT='+companionPort+'\n');
 const {stdout}=await promisify(execFile)(process.execPath,[path.join(temp,'scripts/doctor.mjs')],{timeout:10000,windowsHide:true});assert(stdout.includes('authenticated NAS listing OK'));
});

