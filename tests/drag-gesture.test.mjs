import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
function fakeClassList(){
 const set=new Set();
 return {add:(x)=>set.add(x),remove:(x)=>set.delete(x),toggle:(x,yes)=>yes?set.add(x):set.delete(x),contains:x=>set.has(x)};
}
function create(){
 assert.ok(source);
 const code=source.replace("(()=>{'use strict';","return (()=>{'use strict';").replace(
  "\nrender();\n})();","\nrender();return {state:()=>state,applyCategoryOrder,enableSort:()=>{reordering=true}};\n})();");
 assert.notEqual(source,code);
 const listeners={},frames=new Map(),timers=new Map(),stateStorage=new Map();
 const counters={seq:0,scroll:0,captures:[],released:[],ghosts:[],animations:0};
 const body={dataset:{},classList:fakeClassList(),appendChild(el){counters.ghosts.push(el)},setPointerCapture:id=>counters.captures.push(id),releasePointerCapture:id=>counters.released.push(id)};
 const doc={body,querySelector:()=>({content:''}),getElementById:id=>id==='app'?{innerHTML:''}:null,addEventListener:(type,fn)=>listeners[type]=fn};
 const win={matchMedia:()=>({matches:false}),scrollTo(){},scrollBy:(_x,dy)=>{counters.scroll+=dy},innerHeight:800,visualViewport:{height:800},addEventListener(){}};
 const api=new Function('document','window','navigator','localStorage','setTimeout','clearTimeout','alert','requestAnimationFrame','cancelAnimationFrame',code)(
 doc,win,{standalone:false},{getItem:k=>stateStorage.get(k)||null,setItem:(k,v)=>stateStorage.set(k,v)},
 fn=>{const id=++counters.seq;timers.set(id,fn);return id},id=>timers.delete(id),()=>{},
 fn=>{const id=++counters.seq;frames.set(id,fn);return id},id=>frames.delete(id));
 api.enableSort();
 const group={children:[],isConnected:true,
  getBoundingClientRect(){return {top:180-counters.scroll,bottom:180+group.children.length*135-counters.scroll}},
  insertBefore(row,target){this.children.splice(this.children.indexOf(row),1);this.children.splice(this.children.indexOf(target),0,row)},
  appendChild(row){this.children.splice(this.children.indexOf(row),1);this.children.push(row)}};
 function row(id){
  const element={dataset:{orderId:id},classList:fakeClassList(),isConnected:true,
   hasAttribute:key=>key==='data-order-id',
   getBoundingClientRect(){return {top:180+group.children.indexOf(element)*135-counters.scroll,left:20,width:340,height:135}},
   closest:key=>key==='.category-products'?group:null,
   cloneNode:()=>({style:{},classList:fakeClassList(),removeAttribute(){},setAttribute(){},remove(){this.removed=true}}),
   animate(){counters.animations++}};
  Object.defineProperty(element,'nextElementSibling',{get(){return group.children[group.children.indexOf(element)+1]||null}});
  return element;
 }
 group.children=api.state().items.filter(x=>!x.archived&&x.categoryId==='cat-daily').map(x=>row(x.id));
 const h={dataset:{id:group.children[0].dataset.orderId}};
 h.closest=key=>key==='[data-act="drag-handle"]'?h:key==='[data-order-id]'?group.children[0]:null;
 const pointer=(type,y,pointerType='touch')=>({
  pointerId:7,clientX:250,clientY:y,pointerType,target:h,preventDefault(){this.prevented=true}
 });
 function fire(type,y,pointerType){const e=pointer(type,y,pointerType);listeners[type](e);return e}
 function advanceTimer(){const first=[...timers.entries()][0];assert.ok(first,'long-press timer');timers.delete(first[0]);first[1]()}
 function frame(){const first=[...frames.entries()][0];assert.ok(first,'animation frame scheduled');frames.delete(first[0]);first[1]()}
 return {api,group,listeners,counters,timers,frames,fire,frame,advanceTimer};
}
test('touch hold lifts a ghost, smoothly shifts items, auto-scrolls and saves order',()=>{
 const x=create(),initial=x.api.state().items.map(i=>i.id);
 x.fire('pointerdown',205);assert.equal(x.counters.ghosts.length,0);
 assert.deepEqual(x.counters.captures,[7]);
 x.advanceTimer();assert.equal(x.counters.ghosts.length,1);
 assert.ok(x.group.children[0].classList.contains('drag-placeholder'));
 x.fire('pointermove',385);
 assert.notDeepEqual(x.group.children.map(r=>r.dataset.orderId),initial);
 assert.ok(x.counters.animations>0);
 x.fire('pointermove',725);
 x.frame();assert.ok(x.counters.scroll>0,'edge scrolling occurred');
 x.fire('pointerup',725);
 assert.equal(x.counters.ghosts[0].removed,true);
 assert.deepEqual(x.counters.released,[7]);
 assert.deepEqual(x.api.state().items.map(i=>i.id),x.group.children.map(r=>r.dataset.orderId));
 assert.notDeepEqual(x.api.state().items.map(i=>i.id),initial);
});
test('touch movement before long-press cancels drag without changing persisted order',()=>{
 const x=create(),initial=x.api.state().items.map(i=>i.id);
 x.fire('pointerdown',205);assert.ok(x.timers.size);
 x.fire('pointermove',245);
 assert.equal(x.timers.size,0);assert.equal(x.counters.ghosts.length,0);
 assert.deepEqual(x.api.state().items.map(i=>i.id),initial);
});
test('pointercancel restores original DOM arrangement without saving',()=>{
 const x=create(),before=x.api.state().items.map(i=>i.id);
 x.fire('pointerdown',205);x.advanceTimer();
 x.fire('pointermove',480);
 x.fire('pointercancel',480);
 assert.deepEqual(x.group.children.map(x=>x.dataset.orderId),before);
 assert.deepEqual(x.api.state().items.map(x=>x.id),before);
});
