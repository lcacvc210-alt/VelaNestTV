import http from 'node:http';
import dgram from 'node:dgram';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {pinyin} from 'pinyin-pro';
import {listNas,handleNasStream} from './nas.mjs';

const root=path.dirname(fileURLToPath(import.meta.url)), data=path.resolve(process.env.COMPANION_DATA_DIR||path.join(root,'data'));
fs.mkdirSync(data,{recursive:true});
const core=(process.env.CORE_URL||'http://127.0.0.1:8080').replace(/\/+$/,''),port=Number(process.env.COMPANION_PORT||8090),discoveryPort=Number(process.env.DISCOVERY_PORT||45831);
const idFile=path.join(data,'backend-id.txt');
if(!fs.existsSync(idFile))fs.writeFileSync(idFile,crypto.randomUUID());
const backendId=fs.readFileSync(idFile,'utf8').trim();
const cacheFile=path.join(data,'catalog.json');
let store={items:[],sections:[],updated:0};
try{store=JSON.parse(fs.readFileSync(cacheFile,'utf8'));}catch{}
let sources=[],cookie='',refreshing=false;
const sessionCache=new Map(),suggestCache=new Map();
const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
const normalize=s=>clean(s).toLowerCase().replace(/[\s·:：\-_（）()]/g,'');
function index(item){return {...item,name:clean(item.name),desc:clean(item.desc),_name:normalize(item.name),_py:pinyin(clean(item.name),{toneType:'none',separator:''}).replace(/[^a-z0-9]/g,''),_initial:pinyin(clean(item.name),{pattern:'first',toneType:'none',separator:''}).replace(/[^a-z0-9]/g,'')};}
function publicItem(item){const {_name,_py,_initial,...rest}=item;return rest;}
function merge(items){const m=new Map();for(const item of items){const key=normalize(item.name);if(!key)continue;const old=m.get(key);if(!old)m.set(key,index(item));else m.set(key,index({...old,...item,pic:item.pic||old.pic,desc:item.desc||old.desc,year:item.year||old.year}));}return [...m.values()];}
async function request(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(options.timeout||16000)});if(!r.ok)throw Error(`HTTP ${r.status}: ${url.split('?')[0]}`);return r.json();}
async function login(){const password=process.env.PASSWORD;if(!password)throw Error('Set PASSWORD in companion/.env to match backend/.env.local');const r=await fetch(core+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});if(!r.ok)throw Error('后台登录失败');cookie=r.headers.get('set-cookie')?.split(';')[0]||'';sources=(await request(core+'/api/status')).defaultSources;}
async function coreGet(p){return request(core+p,{headers:{cookie}});}
function persist(){store.updated=Date.now();fs.writeFileSync(cacheFile,JSON.stringify(store));}
function sourceItem(v,s){return {name:v.vod_name,pic:v.vod_pic,year:String(v.vod_year||''),typeName:v.type_name||'',remarks:v.vod_remarks||'',desc:clean(v.vod_content),vodId:String(v.vod_id),sourceKey:s.key,sourceName:s.name,sourceUrl:s.url};}
async function refresh(){
 if(refreshing)return;refreshing=true;
 try{
  await login();const collected=[];
  for(let page=1;page<=8;page++){
   const result=await Promise.allSettled(sources.map(async s=>{const j=await request(s.url.replace(/\/+$/,'')+'?ac=detail&pg='+page,{timeout:9000});return(j.list||[]).filter(v=>!/伦理|情色|成人|福利/.test(v.type_name||'')).map(v=>sourceItem(v,s));}));
   for(const r of result)if(r.status==='fulfilled')collected.push(...r.value);
   if(page===1){store.items=merge([...store.items,...collected]);persist();}
   await new Promise(r=>setTimeout(r,120));
  }
  const sections=[];
  for(const [type,tag,label] of [['movie','热门','热门电影'],['tv','热门','热播剧集'],['movie','高分','高分佳作'],['tv','国产剧','国产剧集'],['movie','科幻','科幻与想象'],['tv','日本动画','动画时光']]){
   try{if(process.env.EXTERNAL_METADATA==='false')continue;const r=await coreGet(`/api/douban?type=${type}&tag=${encodeURIComponent(tag)}&pageSize=24`);const list=(r.items||[]).map(v=>({name:v.title,pic:v.cover||v.pic,year:String(v.year||''),typeName:type==='movie'?'电影':tag==='日本动画'?'动漫':'电视剧',remarks:v.rate?'豆瓣 '+v.rate:'',desc:'',recommendation:true}));if(list.length){sections.push({title:label,items:list});collected.push(...list);}}
   catch(e){console.log('recommendation fallback',label,e.message);}
  }
  store.items=merge([...store.items,...collected]).slice(-18000);store.sections=sections;persist();console.log('catalog refreshed',store.items.length);
 }catch(e){console.error('refresh failed:',e.message);}finally{refreshing=false;}
}
function isType(v,category){const type=v.typeName||'';if(category==='movie')return /电影|动作|喜剧|科幻|恐怖|剧情|爱情|纪录|战争|悬疑|惊悚/.test(type)&&!/剧集|电视剧|国产剧|连续|短剧/.test(type);if(category==='tv')return /剧|连续/.test(type)&&!/短剧/.test(type);if(category==='anime')return /动漫|动画/.test(type);if(category==='variety')return /综艺/.test(type);return true;}
function browse(category,page=0){const list=store.items.filter(v=>isType(v,category));const sections=category==='home'?store.sections:[];return {items:list.slice(page*30,page*30+30).map(publicItem),sections:sections.map(s=>({...s,items:s.items.slice(0,12)})),page,hasMore:(page+1)*30<list.length,total:list.length,updated:store.updated,refreshing};}
function distanceOne(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,n=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;}else{if(++n>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}}return n+(a.length-i)+(b.length-j)<=1;}
function localSuggestions(query){const q=normalize(query);if(!q)return [];return store.items.map(v=>({v,score:v._name===q?100:v._initial===q?98:v._py===q?97:v._name.startsWith(q)?90:v._initial.startsWith(q)?85:v._py.startsWith(q)?82:v._name.includes(q)?75:v._py.includes(q)?65:q.length>=3&&distanceOne(q,v._initial)?45:0})).filter(x=>x.score).sort((a,b)=>b.score-a.score).slice(0,16).map(x=>({...publicItem(x.v),match:x.score===98?'首字母匹配':x.score===97?'全拼匹配':x.score===45?'相近片名':'片名联想'}));}
async function suggestions(query){
 const q=query.slice(0,60),key=normalize(q);if(!key)return {items:store.items.slice(0,12).map(publicItem)};
 const cached=suggestCache.get(key);if(cached&&Date.now()-cached.time<900000)return cached.value;
 const local=localSuggestions(q);let external=[];
 try{if(process.env.EXTERNAL_METADATA==='false')throw Error('External metadata disabled');const r=await request('https://suggest.video.iqiyi.com/?if=mobile&key='+encodeURIComponent(q),{timeout:3500});external=(r.data||[]).filter(v=>v.is_known_query!==false&&!/免费|全集|在线观看|解说|预告|花絮|剪辑/.test(v.name||'')&&/电影|剧|综艺|动漫|动画|纪录/.test(v.cname||v.presentation_element?.tags?.map(t=>t.name).join(',')||'')).slice(0,10).map(v=>({name:clean(v.name),pic:v.picture_url||v.presentation_element?.picture_url||'',year:v.aid?String(v.year||''):'',typeName:v.cname||v.presentation_element?.tags?.[0]?.name||'',desc:v.presentation_element?.show_reason||'',suggestion:true,match:'关联片名'}));}catch{}
 const items=merge([...external,...local]).slice(0,16).map(publicItem);
 await Promise.allSettled(items.slice(0,2).filter(v=>!v.pic).map(async item=>{
  const known=store.items.find(v=>normalize(v.name)===normalize(item.name)&&v.pic);if(known){item.pic=known.pic;item.desc=known.desc;return;}
  try{const r=await request(core+'/api/search',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({wd:item.name,sources:sources.slice(0,2),filterAdult:true}),timeout:6500});const match=(r.list||[]).find(v=>normalize(v.name)===normalize(item.name))||(r.list||[]).find(v=>normalize(v.name).replace(/第[一1]季$/,'')===normalize(item.name)&&!/预告/.test(v.name));if(match){item.pic=match.pic||'';item.year=match.year||item.year;item.remarks=match.remarks||'';item.typeName=match.typeName||item.typeName;store.items=merge([...store.items,{...item,pic:item.pic},match]);persist();}}catch{}
 }));
 const value={items,indexed:store.items.length};suggestCache.set(key,{value,time:Date.now()});if(suggestCache.size>200)suggestCache.delete(suggestCache.keys().next().value);return value;
}
async function verified(req){const c=req.headers.cookie||'';if(!c)return false;const old=sessionCache.get(c);if(old&&old>Date.now())return true;try{const r=await request(core+'/api/auth',{headers:{cookie:c},timeout:4000});if(r.verified){if(sessionCache.size>100)sessionCache.clear();sessionCache.set(c,Date.now()+60000);return true;}}catch{}return false;}
function json(res,code,value){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 try{
  if(u.pathname==='/health'){json(res,200,{service:'private-cinema-tv',version:'2.1.0',backendId,indexed:store.items.length,refreshing});return;}
  if(/^\/tv\/live\/(cctv|satellite|local)\.m3u$/.test(u.pathname)){
   const filename=path.join(data,'live',path.basename(u.pathname));
   if(!fs.existsSync(filename)){json(res,404,{error:'直播列表尚未生成'});return;}
   const text=fs.readFileSync(filename);res.writeHead(200,{'Content-Type':'audio/x-mpegurl; charset=utf-8','Content-Length':text.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:text);return;
  }
  if(handleNasStream(req,res,u))return;
  if(!await verified(req)){json(res,401,{error:'需要登录'});return;}
  if(u.pathname==='/tv/nas'){try{json(res,200,listNas(u.searchParams.get('dir')||'',req.headers.host));}catch(e){json(res,400,{error:e.message});}return;}
  if(u.pathname==='/tv/catalog'){json(res,200,browse(u.searchParams.get('category')||'home',Math.min(200,Math.max(0,Number(u.searchParams.get('page'))||0))));return;}
  if(u.pathname==='/tv/suggest'){json(res,200,await suggestions(u.searchParams.get('q')||''));return;}
  json(res,404,{error:'不存在的接口'});
 }catch(e){json(res,502,{error:e.message});}
});
server.listen(port,process.env.BIND_HOST||'0.0.0.0',()=>console.log('TV companion :'+port,backendId));
const udp=dgram.createSocket('udp4');udp.on('error',e=>console.error('discovery',e.message));
udp.on('message',(msg,peer)=>{if(msg.toString()==='PRIVATE_CINEMA_DISCOVER_V2')udp.send(Buffer.from(JSON.stringify({service:'private-cinema-tv',backendId,port:Number(new URL(core).port||80),companionPort:port})),peer.port,peer.address);});udp.bind(discoveryPort,process.env.BIND_HOST||'0.0.0.0');
refresh();setInterval(refresh,6*60*60*1000).unref();
