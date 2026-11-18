const clean=s=>String(s||'').replace(/[\s·:：\-_（）()]/g,'').toLowerCase();
export function isType(v,category){const type=v.typeName||'';if(category==='movie')return /电影|动画片|动作|喜剧|科幻|恐怖|剧情|爱情|纪录|战争|悬疑|惊悚/.test(type)&&!/剧集|电视剧|国产剧|连续|短剧/.test(type);if(category==='tv')return /剧|连续/.test(type)&&!/短剧/.test(type);if(category==='anime')return /动漫|动画/.test(type);if(category==='variety')return /综艺/.test(type);return true;}
export function browseCatalog(store,category,page=0,filters={}){
 const genre=String(filters.genre||''),year=String(filters.year||''),sort=['updated','year','hot'].includes(filters.sort)?filters.sort:'updated';
 const publicItem=({_name,_py,_initial,...rest})=>rest;
 let list=store.items.filter(v=>isType(v,category));
 const years=[...new Set(list.map(v=>String(v.year||'').match(/(?:19|20)\d{2}/)?.[0]).filter(Boolean))].sort().reverse();
 const hotSection=(store.sections||[]).find(s=>s.title==='热门电影');
 if(category==='movie'&&sort==='hot'){
  const known=new Map(list.map(v=>[clean(v.name),v]));const seen=new Set();
  list=(hotSection?.items||[]).map((v,i)=>({...v,...known.get(clean(v.name)),hotRank:i+1})).filter(v=>{const key=clean(v.name);if(seen.has(key))return false;seen.add(key);return true;});
 }
 if(category==='movie'){
  if(genre)list=list.filter(v=>String((v.genres||'')+' '+(v.typeName||'')).includes(genre));
  if(year)list=list.filter(v=>{const y=Number(String(v.year||'').match(/(?:19|20)\d{2}/)?.[0]);return year==='older'?y>0&&y<new Date().getFullYear()-5:y===Number(year);});
  if(sort==='year')list.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0));
  if(sort==='updated')list.sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));
 }
 const sections=category==='home'?(store.sections||[]):[];
 return {items:list.slice(page*30,page*30+30).map(publicItem),sections:sections.map(s=>({...s,items:s.items.slice(0,12)})),page,hasMore:(page+1)*30<list.length,total:list.length,updated:store.updated,filters:{genre,year,sort},years,hotAvailable:!!hotSection?.items?.length,hotUpdated:store.hotUpdated||store.updated,hotNote:'外部热门电影片单顺序，并非本应用播放量排行榜'};
}
