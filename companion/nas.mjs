import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const NAS_ROOT=path.resolve(process.env.NAS_ROOT||path.join(path.dirname(fileURLToPath(import.meta.url)),'../media'));
fs.mkdirSync(NAS_ROOT,{recursive:true});
const realRoot=fs.realpathSync(NAS_ROOT);
const keyPath=path.join(path.resolve(process.env.COMPANION_DATA_DIR||path.join(path.dirname(fileURLToPath(import.meta.url)),'data')),'nas-key.bin');
fs.mkdirSync(path.dirname(keyPath),{recursive:true});
if(!fs.existsSync(keyPath))fs.writeFileSync(keyPath,crypto.randomBytes(32));
const key=fs.readFileSync(keyPath);
const types={'.mp4':'video/mp4','.m4v':'video/mp4','.mkv':'video/x-matroska','.mov':'video/quicktime','.ts':'video/mp2t','.m2ts':'video/mp2t','.webm':'video/webm','.avi':'video/x-msvideo'};
function inside(candidate){const rel=path.relative(realRoot,candidate);return !path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep);}
function resolve(relative){if(typeof relative!=='string'||relative.includes('\0')||path.isAbsolute(relative)||/^[a-z]:/i.test(relative))throw Error('无效影库路径');const candidate=path.resolve(realRoot,relative);if(!inside(candidate))throw Error('不能访问影库以外的文件');const real=fs.realpathSync(candidate);if(!inside(real))throw Error('影库链接指向了外部目录');return real;}
function token(relative,expires){return crypto.createHmac('sha256',key).update(relative+'\n'+expires).digest('hex');}
function valid(relative,expires,signature){if(!/^\d+$/.test(expires)||Number(expires)<Date.now()||Number(expires)>Date.now()+13*3600000)return false;const expected=Buffer.from(token(relative,expires)),supplied=Buffer.from(signature||'');return supplied.length===expected.length&&crypto.timingSafeEqual(expected,supplied);}
export function listNas(relative='',host='127.0.0.1:8090'){
 const dir=resolve(relative);if(!fs.statSync(dir).isDirectory())throw Error('不是影库文件夹');const items=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.name.startsWith('.'))continue;const child=path.join(relative,entry.name).replaceAll('\\','/');
  try{const real=resolve(child),stat=fs.statSync(real);if(!stat.isDirectory()&&!types[path.extname(entry.name).toLowerCase()])continue;
   const expires=String(Date.now()+12*3600000);items.push({name:entry.name,path:child,kind:stat.isDirectory()?'folder':'video',size:stat.size,modified:stat.mtimeMs,url:stat.isDirectory()?undefined:`http://${host}/tv/nas/stream?path=${encodeURIComponent(child)}&expires=${expires}&sig=${token(child,expires)}`});
  }catch{}
 }
 items.sort((a,b)=>a.kind===b.kind?a.name.localeCompare(b.name,'zh-CN',{numeric:true}):a.kind==='folder'?-1:1);
 const parent=relative?path.dirname(relative).replaceAll('\\','/'):'';
 return {rootName:path.basename(NAS_ROOT),path:relative,parent:parent==='.'?'':parent,items};
}
export function handleNasStream(req,res,url){
 if(url.pathname!=='/tv/nas/stream')return false;
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return true;}
 const relative=url.searchParams.get('path')||'',expires=url.searchParams.get('expires')||'';
 if(!valid(relative,expires,url.searchParams.get('sig'))){res.writeHead(403);res.end('链接无效或已过期，请重新打开影库');return true;}
 try{
  const file=resolve(relative),stat=fs.statSync(file),type=types[path.extname(file).toLowerCase()];
  if(!stat.isFile()||!type){res.writeHead(404);res.end();return true;}
  const size=stat.size;let start=0,end=size-1,status=200;
  const headers={'Content-Type':type,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(path.basename(file))};
  if(req.headers.range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
   if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return true;}
   if(!match[1])start=Math.max(0,size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Number(match[2]);}
   end=Math.min(end,size-1);
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return true;}
   status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length']=size===0?0:end-start+1;res.writeHead(status,headers);
  if(req.method==='HEAD'||size===0){res.end();return true;}
  const input=fs.createReadStream(file,{start,end});input.on('error',()=>res.destroy());res.on('close',()=>input.destroy());input.pipe(res);return true;
 }catch{res.writeHead(404);res.end('文件不存在或不允许访问');return true;}
}
