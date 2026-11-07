import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];

function appRuntime(){
 assert.ok(source,'inline code exists');
 const body=source.replace("(()=>{'use strict';","return (()=>{'use strict';").replace(
 "\nrender();\n})();",
 "\nrender();return {state:()=>state,cmp:()=>cmp,setCmp:v=>cmp=v,setBundle:v=>bundleCount=v,setDiscount:v=>discount=v,toolState:()=>({toolView,bundleMode,bundleCount,discount}),click,screenCompare,cmpResult,discountResult,compareRateFor};\n})();"
 );
 assert.notEqual(body,source,'test source exposes required runtime');
 const app={innerHTML:''},storage=new Map();
 const doc={body:{dataset:{},classList:{toggle(){}}},
 querySelector:()=>({content:''}),getElementById:k=>k==='app'?app:null,addEventListener(){}};
 const api=new Function('document','window','navigator','localStorage','setTimeout','clearTimeout',body)(
 doc,{matchMedia:()=>({matches:false}),scrollTo(){}},{standalone:false},
 {getItem:key=>storage.get(key)??null,setItem:(key,v)=>storage.set(key,v)},()=>123,()=>{});
 const go=(id)=>api.click({dataset:{act:'tool-select',id}});
 return {api,go};
}
test('shopping tools launch page exposes all three calculators',()=>{
 const {api}=appRuntime();const text=api.screenCompare();
 for(const label of ['買い物支援','単価比較','割引計算','100g比較'])assert.ok(text.includes(label),label);
 assert.match(html,/\['compare','買い物支援'\]/);
});
test('regular comparison needs only price and quantity',()=>{
 const {api,go}=appRuntime();go('unit');const form=api.screenCompare();
 assert.match(form,/id="cp-a"/);assert.match(form,/id="cv-b"/);
 assert.doesNotMatch(form,/id="bk-a"/);
 api.setCmp({a:{price:'498',volume:'900'},b:{price:'598',volume:'1200'}});
 assert.equal(api.cmpResult().better,'b');
});
test('paper multipacks 200 sets x4 vs 300 sets x3',()=>{
 const {api,go}=appRuntime();go('unit');
 api.click({dataset:{act:'bundle-toggle'}});
 const form=api.screenCompare();assert.match(form,/id="bk-a"/);assert.match(form,/id="bk-b"/);
 api.setCmp({a:{price:'1000',volume:'200'},b:{price:'1000',volume:'300'}});
 api.setBundle({a:'4',b:'3'});
 const r=api.cmpResult();
 assert.equal(r.a.total,800);assert.equal(r.b.total,900);assert.equal(r.better,'b');
 assert.equal(r.a.n,1.25);assert.ok(Math.abs(r.b.n-1000/900)<1e-10);
});
test('optional multiplier can be blank (1), rejects 0 and fractions',()=>{
 const {api,go}=appRuntime();go('unit');
 api.click({dataset:{act:'bundle-toggle'}});
 api.setCmp({a:{price:'100',volume:'50'},b:{price:'100',volume:'40'}});
 api.setBundle({a:'',b:'2'});
 assert.equal(api.cmpResult().a.total,50);
 api.setBundle({a:'0',b:'2'});assert.equal(api.cmpResult(),null);
 api.setBundle({a:'1.5',b:'2'});assert.equal(api.cmpResult(),null);
});
test('discount 20%, 0%, 100% and invalid percent',()=>{
 const {api,go}=appRuntime();go('discount');
 api.setDiscount({price:'1000',percent:'20'});
 assert.deepEqual(api.discountResult(),{saving:200,total:800});
 api.setDiscount({price:'1000',percent:'0'});assert.equal(api.discountResult().total,1000);
 api.setDiscount({price:'1000',percent:'100'});assert.equal(api.discountResult().total,0);
 api.setDiscount({price:'1000',percent:'101'});assert.equal(api.discountResult(),null);
});
test('100g calculates price per fixed 100g with no unit selector',()=>{
 const {api,go}=appRuntime();go('per100');
 assert.match(api.screenCompare(),/内容量（g）/);
 assert.doesNotMatch(api.screenCompare(),/id="bk-a"/);
 api.setCmp({a:{price:'180',volume:'150'},b:{price:'320',volume:'300'}});
 const r=api.cmpResult();assert.equal(r.a.n,120);assert.ok(Math.abs(r.b.n-106.6666666667)<1e-7);
 assert.equal(r.better,'b');
});
test('switching tools resets form values without clearing saved inventory',()=>{
 const {api,go}=appRuntime();
 const initial=JSON.stringify(api.state());
 go('unit');api.setCmp({a:{price:'300',volume:'100'},b:{price:'200',volume:'50'}});
 go('discount');api.setDiscount({price:'1500',percent:'20'});
 go('unit');assert.equal(api.cmp().a.price,'');
 assert.equal(api.toolState().discount.price,'');
 assert.equal(JSON.stringify(api.state()),initial);
});
