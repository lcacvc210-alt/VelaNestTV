import test from 'node:test';import assert from 'node:assert/strict';
import {browseCatalog} from '../companion/catalog.mjs';
const year=new Date().getFullYear();
const store={updated:100,hotUpdated:90,items:[
 {name:'A',typeName:'动作片',genres:'动作,科幻',year:String(year),updatedAt:10},
 {name:'B',typeName:'喜剧片',year:String(year-1),updatedAt:30},
 {name:'C',typeName:'剧情片',year:String(year-6),updatedAt:20},
 {name:'D',typeName:'国产剧',genres:'动作',year:String(year),updatedAt:50},
 {name:'E',typeName:'剧情片',year:'',updatedAt:0}],
 sections:[{title:'热门电影',items:[{name:'B',typeName:'电影'},{name:'A',typeName:'电影'},{name:'B',typeName:'电影'}]}]};
test('movie genre and year intersect and exclude TV/missing metadata',()=>{
 const result=browseCatalog(store,'movie',0,{genre:'科幻',year:String(year)});
 assert.deepEqual(result.items.map(v=>v.name),['A']);assert.equal(result.total,1);
 assert.equal(browseCatalog(store,'movie',0,{year:'older'}).items[0].name,'C');
});
test('hot ranks come only from cached external list, with no invented fallback',()=>{
 const result=browseCatalog(store,'movie',0,{sort:'hot'});
 assert.deepEqual(result.items.map(v=>[v.name,v.hotRank]),[['B',1],['A',2]]);
 assert.equal(result.hotUpdated,90);assert.equal(result.items[0].year,String(year-1));
 const empty=browseCatalog({...store,sections:[]},'movie',0,{sort:'hot'});
 assert.equal(empty.hotAvailable,false);assert.equal(empty.items.length,0);
});
test('filtering and sorting happen before pagination',()=>{
 const many={items:Array.from({length:65},(_,i)=>({name:String(i),typeName:'喜剧片',year:String(year),updatedAt:i})),sections:[]};
 const result=browseCatalog(many,'movie',1,{genre:'喜剧'});
 assert.equal(result.total,65);assert.equal(result.items.length,30);assert.equal(result.items[0].name,'34');assert.equal(result.hasMore,true);
 assert.equal(browseCatalog(many,'movie',2).hasMore,false);
});
