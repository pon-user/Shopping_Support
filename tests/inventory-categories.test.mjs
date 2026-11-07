import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
function runtime(legacy=null){
 assert.ok(source);
 const src=source.replace("(()=>{'use strict';","return (()=>{'use strict';").replace(
  "\nrender();\n})();",
  "\nrender();return {state:()=>state,modal:()=>modal,click,render,screenStock,screenSettings,sheet,storeItem,openItem,openPurchase,inferCategoryFor,purchaseSuggestions,categoryName};\n})();"
 );
 assert.notEqual(src,source);
 const persisted=new Map(),nodes={},events={},app={innerHTML:''},errors=[];
 if(legacy)persisted.set('shopping-support-ux-demo-v03',JSON.stringify(legacy));
 const document={body:{dataset:{},classList:{toggle(){}}},querySelector:()=>({content:''}),
 querySelectorAll:()=>[],getElementById:id=>id==='app'?app:nodes[id]??null,addEventListener:(n,h)=>events[n]=h};
 const api=new Function('document','window','navigator','localStorage','setTimeout','clearTimeout','alert',src)(
 document,{matchMedia:()=>({matches:false}),scrollTo(){}},{standalone:false},
 {getItem:k=>persisted.get(k)??null,setItem:(k,v)=>persisted.set(k,v)},()=>123,()=>{},m=>errors.push(m));
 return {api,persisted,nodes,events,app,errors};
}
test('default three categories, max five plus independent uncategorized group',()=>{
 const {api,nodes,errors}=runtime();
 assert.deepEqual(api.state().categories.map(c=>c.name),['日用品','キッチン用品','食品・調味料']);
 for(const name of ['ペット用品','備蓄']){nodes.newCategoryName={value:name};api.click({dataset:{act:'category-add'}})}
 assert.equal(api.state().categories.length,5);
 assert.match(api.screenSettings(),/5 \/ 5/);
 nodes.newCategoryName={value:'医薬品'};api.click({dataset:{act:'category-add'}});
 assert.equal(api.state().categories.length,5);assert.ok(errors.length>=1);
 assert.equal(api.inferCategoryFor(api.state(),'未知の品名'),'uncategorized');
});
test('legacy saved stock and logs migrate additively with rule guesses',()=>{
 const {api}=runtime();const old=JSON.parse(JSON.stringify(api.state()));
 delete old.categories;delete old.categoryPrefs;old.items.forEach(x=>delete x.categoryId);old.theme='dark-blue';
 const {api:up,persisted}=runtime(old);
 assert.equal(up.state().schemaVersion,'UX-DEMO-0.3');
 assert.equal(up.state().items.length,old.items.length);assert.deepEqual(up.state().logs,old.logs);
 assert.equal(up.state().items.find(x=>x.name==='ティッシュ').categoryId,'cat-daily');
 assert.equal(up.state().theme,'dark-blue');
 assert.equal(JSON.parse(persisted.get('shopping-support-ux-demo-v03')).categories.length,3);
});
test('suggested category changes on input; manual correction is remembered only for matching name',()=>{
 const {api,nodes,events}=runtime();api.openItem('');
 nodes.itemCategory={value:'uncategorized'};
 events.input({target:{id:'itemName',value:'醤油',dataset:{}}});
 assert.equal(nodes.itemCategory.value,'cat-food');
 nodes.itemCategory.value='cat-kitchen';
 events.change({target:{id:'itemCategory',value:'cat-kitchen',dataset:{}}});
 Object.assign(nodes,{itemName:{value:'醤油'},itemQty:{value:''},itemLine:{value:''},
 itemTarget:{value:''},itemUnit:{value:'本'},itemDetail:{value:''},itemVolume:{value:''},itemVu:{value:'mL'}});
 api.storeItem();
 assert.equal(api.inferCategoryFor(api.state(),'醤油'),'cat-kitchen');
 assert.equal(api.inferCategoryFor(api.state(),'みりん'),'cat-food');
 assert.equal(api.state().items.find(x=>x.name==='醤油').categoryId,'cat-kitchen');
});
test('used inventory groups visible, empty groups omitted and expandable',()=>{
 const {api}=runtime();const rendered=api.screenStock();
 assert.match(rendered,/data-category-section/);
 assert.match(rendered,/>日用品<\/strong>/);
 assert.doesNotMatch(rendered,/>キッチン用品<\/strong>/);
 api.click({dataset:{act:'category-toggle',id:'cat-daily'}});
 assert.match(api.screenStock(),/data-id="cat-daily" aria-expanded="false"/);
});
test('renaming category preserves item references and purchase history snapshots',()=>{
 const {api,nodes}=runtime(),oldHistory=JSON.stringify(api.state().logs);
 const item=api.state().items[0],oldId=item.categoryId;
 api.click({dataset:{act:'category-edit',id:oldId}});
 nodes.editCategoryName={value:'生活用品'};
 api.click({dataset:{act:'category-save'}});
 assert.equal(item.categoryId,oldId);assert.equal(api.categoryName(oldId),'生活用品');
 assert.equal(JSON.stringify(api.state().logs),oldHistory);
});
test('category deletion asks destination and remaps items and learned suggestions',()=>{
 const {api,nodes}=runtime();
 const item=api.state().items[0];item.categoryId='cat-kitchen';
 api.state().categoryPrefs['アルミホイル']='cat-kitchen';
 api.click({dataset:{act:'category-remove',id:'cat-kitchen'}});
 assert.match(api.sheet(),/id="categoryTarget"/);
 nodes.categoryTarget={value:'cat-food'};
 api.click({dataset:{act:'category-delete'}});
 assert.equal(item.categoryId,'cat-food');
 assert.equal(api.state().categoryPrefs['アルミホイル'],'cat-food');
 assert.equal(api.state().categories.some(c=>c.id==='cat-kitchen'),false);
});
test('purchase store suggestions global and product names scoped to managed item',()=>{
 const {api,nodes}=runtime();
 api.state().logs.push({kind:'purchase',itemId:'i2',store:'スーパーB',detail:'ティッシュ別ブランド'});
 assert.ok(api.purchaseSuggestions('store','i1').includes('スーパーB'));
 assert.ok(!api.purchaseSuggestions('detail','i1').includes('ティッシュ別ブランド'));
 assert.ok(api.purchaseSuggestions('detail','i1').includes('いつもの洗剤'));
 api.openPurchase('i1',{more:true});
 assert.match(api.sheet(),/data-act="suggest-store"/);
 assert.match(api.sheet(),/data-act="suggest-detail"/);
 nodes.store={value:''};api.click({dataset:{act:'suggest-store',value:'スーパーB'}});
 assert.equal(nodes.store.value,'スーパーB');
});

test('removing a built-in category never assigns orphaned ID for new products',()=>{
 const {api,nodes}=runtime();
 api.click({dataset:{act:'category-remove',id:'cat-food'}});
 nodes.categoryTarget={value:'uncategorized'};
 api.click({dataset:{act:'category-delete'}});
 assert.equal(api.inferCategoryFor(api.state(),'醤油'),'uncategorized');
 assert.equal(api.state().categories.some(c=>c.id==='cat-food'),false);
});
