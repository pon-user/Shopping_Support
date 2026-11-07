import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// UX review HTML: test without browser packages. Real iPhone rendering is a separate check.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
function runtime(){
  assert.ok(source,'inline JavaScript exists');
  const body=source.replace("(()=>{'use strict';","return (()=>{'use strict';")
    .replace("\nrender();\n})();",
      "\nrender();return {state:()=>state,cmp:()=>cmp,setCmp:v=>cmp=v,setModal:v=>modal=v,screenCompare,screenStock,screenHistory,sheet,storeItem,cmpResult,unitlessRate,click};\n})();");
  assert.notEqual(body,source,'test exposure succeeded');
  const nodes={},listeners={},store=new Map(),app={innerHTML:''};
  const doc={
    body:{dataset:{},classList:{toggle(){}}},
    querySelector:()=>({content:''}),
    getElementById:id=>id==='app'?app:nodes[id]??null,
    addEventListener:(name,handler)=>{listeners[name]=handler}
  };
  const mockStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const api=new Function('document','window','navigator','localStorage','setTimeout','clearTimeout',body)(
    doc,{matchMedia:()=>({matches:false}),scrollTo(){}},{standalone:false},mockStorage,()=>1,()=>{});
  return {api,nodes,listeners,app};
}
test('all inputs use 16px or larger; browser pinch zoom remains available',()=>{
  assert.match(html,/input,select,textarea,\.comparebox input\.field,\.comparebox select\.field\{font-size:16px!important\}/);
  assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
});
test('new product inputs start blank, default stock values applied at save',()=>{
  const {api,nodes}=runtime();api.setModal({type:'item',id:''});
  const form=api.sheet();
  for(const [id,placeholder] of [['itemQty','0'],['itemLine','1'],['itemTarget','2']]){
    assert.match(form,new RegExp('id="'+id+'"[^>]*value="" placeholder="'+placeholder+'"'));
  }
  Object.assign(nodes,{
    itemName:{value:'テスト商品'},itemQty:{value:''},itemLine:{value:''},itemTarget:{value:''},
    itemUnit:{value:'個'},itemDetail:{value:''},itemVolume:{value:''},itemVu:{value:'mL'}
  });
  api.storeItem();
  const row=api.state().items.find(x=>x.name==='テスト商品');
  assert.deepEqual([row.qty,row.line,row.target],[0,1,2]);
});
test('comparison needs only price and numeric quantity; starts blank',()=>{
  const {api}=runtime();
  assert.equal(api.cmp().a.price,'');assert.equal(api.cmp().b.volume,'');
  api.click({dataset:{act:'tool-select',id:'unit'}});
  const cmp=api.screenCompare();
  assert.doesNotMatch(cmp,/id="cu-[ab]"/);
  assert.match(cmp,/数量1あたり/);
  api.setCmp({a:{price:'498',volume:'900'},b:{price:'598',volume:'1200'}});
  assert.equal(api.cmpResult().better,'b');
  assert.equal(api.unitlessRate({price:'',volume:'100'}),null);
  assert.equal(api.unitlessRate({price:'100',volume:'0'}),null);
});
test('comparison keyboard sequence and new-form labels',()=>{
  const {api,listeners,nodes}=runtime();
  api.click({dataset:{act:'tool-select',id:'unit'}});
  const cmp=api.screenCompare();
  for(const [id,next] of [['cp-a','cv-a'],['cv-a','cp-b'],['cp-b','cv-b'],['cv-b','']]){
    const tag=cmp.match(new RegExp('<input id="'+id+'"[^>]*>'))?.[0];
    assert.ok(tag&&tag.includes('data-next="'+next+'"'));
  }
  let focused=0;
  nodes['cv-a']={focus(){focused++}};
  listeners.keydown({key:'Enter',target:{dataset:{next:'cv-a'},matches:()=>true},preventDefault(){}});
  assert.equal(focused,1);
  api.setModal(null);
  assert.doesNotMatch(api.screenStock(),/予備/);
  assert.doesNotMatch(api.screenHistory(),/予備/);
});
test('existing sample data and separate historical price normalization survive',()=>{
  const {api}=runtime();
  assert.equal(api.state().schemaVersion,'UX-DEMO-0.3');
  assert.ok(api.state().items.length>=5);
  assert.match(html,/function normalized\(v\)/);
  assert.match(html,/stock-mark\.is-zero/);
});
