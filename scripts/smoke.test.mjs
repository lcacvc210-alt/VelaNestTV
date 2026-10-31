import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import dgram from 'node:dgram';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {once} from 'node:events';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function freeUdp(){const s=dgram.createSocket('udp4');s.bind(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;s.close();return p;}
async function freeTcp(){const s=http.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
test('companion isolated authentication, signed NAS ranges and discovery',{timeout:25000},async t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'velanesttv-smoke-'));const media=path.join(temp,'media');fs.mkdirSync(media);fs.writeFileSync(path.join(media,'fixture.mp4'),Buffer.from('0123456789abcdef'));const secret='test-only-'+Date.now();
 const mock=http.createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;res.setHeader('Content-Type','application/json');if(req.url==='/api/auth'){if(req.method==='POST'&&JSON.parse(body).password===secret){res.setHeader('Set-Cookie','session=smoke; Path=/');res.end('{}');}else if(req.headers.cookie==='session=smoke')res.end('{"verified":true}');else{res.statusCode=401;res.end('{}');}}else if(req.url==='/api/status')res.end('{"defaultSources":[]}');else{res.statusCode=404;res.end('{}');}});
 mock.listen(0,'127.0.0.1');await once(mock,'listening');const corePort=mock.address().port,port=await freeTcp(),udpPort=await freeUdp();
 const child=spawn(process.execPath,['server.mjs'],{cwd:path.join(repo,'companion'),env:{...process.env,PASSWORD:secret,CORE_URL:'http://127.0.0.1:'+corePort,COMPANION_PORT:String(port),DISCOVERY_PORT:String(udpPort),BIND_HOST:'127.0.0.1',EXTERNAL_METADATA:'false',COMPANION_DATA_DIR:path.join(temp,'data'),NAS_ROOT:media},stdio:['ignore','pipe','pipe'],windowsHide:true});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 t.after(async()=>{child.kill();await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);await new Promise(r=>mock.close(r));fs.rmSync(temp,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<70;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,logs);
 assert.equal((await fetch(base+'/tv/nas')).status,401);
 const headers={cookie:'session=smoke'};let r=await fetch(base+'/tv/nas',{headers});assert.equal(r.status,200);const listing=await r.json();assert.equal(listing.items.length,1);const url=listing.items[0].url;
 r=await fetch(url,{headers:{Range:'bytes=2-5'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 2-5/16');assert.equal(await r.text(),'2345');
 r=await fetch(url,{method:'HEAD'});assert.equal(r.headers.get('content-length'),'16');assert.equal(await r.text(),'');
 assert.equal((await fetch(url,{headers:{Range:'bytes=99-100'}})).status,416);
 const bad=new URL(url);bad.searchParams.set('sig','tampered');assert.equal((await fetch(bad)).status,403);
 assert.equal((await fetch(base+'/tv/nas?dir=..',{headers})).status,400);
 r=await fetch(base+'/tv/catalog?category=movie',{headers});assert.equal(r.status,200);assert.deepEqual((await r.json()).items,[]);
 const socket=dgram.createSocket('udp4');t.after(()=>socket.close());socket.bind(0,'127.0.0.1');await once(socket,'listening');const response=once(socket,'message');socket.send(Buffer.from('PRIVATE_CINEMA_DISCOVER_V2'),udpPort,'127.0.0.1');const [message]=await Promise.race([response,new Promise((_,reject)=>setTimeout(()=>reject(Error('discovery timeout')),2000))]);const found=JSON.parse(message);assert.equal(found.port,corePort);assert.equal(found.companionPort,port);
});
