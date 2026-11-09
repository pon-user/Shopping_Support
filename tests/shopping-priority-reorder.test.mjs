import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
function app(){
 assert.ok(source);
 const code=source.replace("(()=>{'use strict';","return (()=>{'use strict';").replace(
  "\nrender();\n})();",
  "\nrender();return {state:()=>state,screenShop,screenStock,shopGroups,stockLegend,click,applyCategoryOrder,dragEdgeVelocity};\n})();"
 );
 assert.notEqual(code,source);
 const appEl={innerHTML:''},store=new Map(),listeners={};
 const doc={body:{dataset:{},classList:{toggle(){}}},querySelector:()=>({content:''}),
  getElementById:id=>id==='app'?appEl:null,addEventListener:(n,h)=>{listeners[n]=h}};
 const api=new Function('document','window','navigator','localStorage','setTimeout','clearTimeout',code)(
  doc,{matchMedia:()=>({matches:false}),scrollTo(){}},{standalone:false},
  {getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},()=>1,()=>{});
 return {api,store,listeners};
}
test('out of stock across categories is always above nonzero replenishment',()=>{
 const {api}=app();const st=api.state();
 const a=st.items.find(x=>x.id==='i1'),b=st.items.find(x=>x.id==='i2');
 a.qty=1;a.cycle=true;a.postpone=false;b.qty=0;b.categoryId='cat-kitchen';b.cycle=true;b.postpone=false;
 const page=api.screenShop(),urgent=page.indexOf('在庫なし・優先'),zero=page.indexOf('ティッシュ'),lowHeader=page.indexOf('<h2>補充目安</h2>'),low=page.indexOf('洗濯洗剤');
 assert.ok(urgent>=0&&urgent<zero&&zero<lowHeader&&lowHeader<low);
 assert.match(page,/data-act="shop-category-toggle"/);
 assert.match(page,/>キッチン用品<\/strong>/);
 assert.match(page,/>日用品<\/strong>/);
});
test('shopping list categories can collapse and manual notes remain separate',()=>{
 const {api}=app();
 const page=api.screenShop();
 assert.match(page,/買い物メモ/);
 assert.match(page,/在庫とは連動しないメモ/);
 api.click({dataset:{act:'shop-category-toggle',id:'zero:cat-daily'}});
 assert.match(api.screenShop(),/data-id="zero:cat-daily" aria-expanded="false"/);
});
test('empty urgent block is hidden, and no empty replenishment section for zero-only',()=>{
 const {api}=app();const st=api.state();
 st.items.forEach(x=>{x.cycle=false});
 st.items[1].qty=0;st.items[1].cycle=true;st.items[1].postpone=false;
 const page=api.screenShop();
 assert.match(page,/在庫なし・優先/);
 assert.doesNotMatch(page,/<h2>補充目安<\/h2>/);
});
test('inventory color legend is above search and categorized rows',()=>{
 const {api}=app();const page=api.screenStock();
 const legend=page.indexOf('class="stock-legend"'),search=page.indexOf('class="toolbar stock-toolbar"'),firstGroup=page.indexOf('class="category-section"');
 assert.ok(legend>=0&&legend<search&&search<firstGroup);
 assert.equal(page.split('class="stock-legend"').length-1,1);
 for(const label of ['補充目安','在庫なし','十分'])assert.ok(page.includes(label));
});
test('reordered category preserves other categories and all existing history',()=>{
 const {api,store}=app(),st=api.state();
 const a=st.items.find(x=>x.id==='i1'),c=st.items.find(x=>x.id==='i3');
 c.categoryId=a.categoryId;
 const order=st.items.map(x=>x.id),logs=JSON.stringify(st.logs);
 assert.equal(api.applyCategoryOrder(a.categoryId,['i3','i1','i4']),false,'should reject foreign ID');
 const group=st.items.filter(x=>!x.archived&&x.categoryId===a.categoryId);
 const inverse=group.map(x=>x.id).reverse();
 assert.ok(api.applyCategoryOrder(a.categoryId,inverse));
 const after=st.items.map(x=>x.id);
 const originalPositions=order.map((id,i)=>st.items.some(x=>x.id===id&&x.categoryId===a.categoryId)?i:-1).filter(i=>i>=0);
 for(const i of order.keys())if(!originalPositions.includes(i))assert.equal(after[i],order[i]);
 assert.deepEqual(originalPositions.map(i=>after[i]),inverse);
 assert.equal(JSON.stringify(st.logs),logs);
 assert.equal(api.applyCategoryOrder(a.categoryId,inverse),false);
 assert.ok(store.has('shopping-support-ux-demo-v03'));
});
test('autoscroll triggers only near edges and when category extends beyond viewport',()=>{
 const {api}=app();
 assert.ok(api.dragEdgeVelocity(14,800,-300,1200)<0);
 assert.ok(api.dragEdgeVelocity(724,800,-300,1200)>0);
 assert.equal(api.dragEdgeVelocity(380,800,-300,1200),0);
 assert.equal(api.dragEdgeVelocity(724,800,-300,600),0);
 assert.equal(api.dragEdgeVelocity(14,800,70,1200),0);
 assert.ok(api.dragEdgeVelocity(724,800,-300,1200)<=25);
});
test('touch gesture implementation uses stable capture, floating ghost and FLIP animation',()=>{
 assert.match(html,/document\.body\.setPointerCapture\?\.\(e\.pointerId\)/);
 assert.match(html,/dragging\.timer=setTimeout\(\(\)=>activateDrag\(pending\),180\)/);
 assert.match(html,/classList\.add\('drag-ghost'\)/);
 assert.match(html,/el\.animate\?\.\(/);
 assert.match(html,/requestAnimationFrame\(dragScrollFrame\)/);
 assert.match(html,/window\.scrollBy\(0,speed\)/);
 assert.match(html,/pointercancel/);
 assert.match(html,/sort-arrow/);
});
