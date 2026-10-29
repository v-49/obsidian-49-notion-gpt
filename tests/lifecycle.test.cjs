const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers.cjs');
test('unified plugin imports old table widths once and owns all registrations',async()=>{
 const h=harness(),Suite=h.load('main');const p=new Suite();p.app=h.owner.app;
 const legacy={version:1,files:{'example.md':{'["A|B",0]':[123,234]}}};let reads=0,saved;
 p.loadData=async()=>null;p.saveData=async data=>{saved=data;};p.app.vault.adapter={exists:async()=>true,read:async()=>{reads++;return JSON.stringify(legacy);}};
 for(const key of ['addCommand','addRibbonIcon','addStatusBarItem','registerMarkdownPostProcessor'])p[key]=h.owner[key];
 await p.load();await Promise.resolve();assert.equal(reads,1);assert.equal(JSON.stringify(saved.tables),JSON.stringify(legacy));assert.equal(p.children.length,3);assert.equal(new Set(h.commands.map(c=>c.id)).size,h.commands.length);assert.ok(h.commands.every(c=>/^(tables|scroll)-/.test(c.id)));
 h.ready.forEach(f=>f());p.unload();assert.equal(h.window.document.querySelectorAll('.ntr-overlay,.relative-scroll-lock-status,.relative-scroll-lock-ribbon').length,0);assert.ok(h.events.every(e=>e.off));
});
test('unloading while table data is loading does not attach listeners later',async()=>{
 const h=harness(),Table=h.load('features/table-resize');const p=new Table(h.owner,'tables');let resolve;p.loadData=()=>new Promise(r=>resolve=r);const loading=p.load();p.unload();resolve(null);await loading;assert.equal(h.events.length,0);assert.equal(h.ready.length,0);
});
test('table anchors disambiguate repeated headers and skip fenced examples',()=>{
 const {tablesIn}=harness().load('features/table-resize');const text='| A | B |\n|---|---|\n| x | y |\n\n```md\n| A | B |\n|---|---|\n```\n\n| A | B |\n|---|---|\n| z | w |';const result=tablesIn(text);assert.equal(result.length,2);assert.notEqual(result[0].key,result[1].key);
});
test('failed writes do not prevent later saves and latest state wins',async()=>{
 const h=harness(),Suite=h.load('main'),p=new Suite();p.data={version:1};p.writeQueue=Promise.resolve();const saved=[];p.saveData=async d=>{if(!saved.length){saved.push('failed');throw new Error('temporary');}saved.push(d);};
 await assert.rejects(p.saveFeature('tables',{files:{a:1}}));await p.saveFeature('tables',{files:{a:2}});assert.equal(saved[1].tables.files.a,2);
});
test('public package imports the original unified package data before standalone widths',async()=>{
 const h=harness(),Suite=h.load('main'),p=new Suite();p.app=h.owner.app;
 const legacy={version:1,tables:{version:1,files:{'unified.md':{'table':[200,300]}}}};const paths=[];
 p.loadData=async()=>null;p.saveData=async()=>{};p.app.vault.adapter={exists:async()=>true,read:async path=>{paths.push(path);return JSON.stringify(legacy);}};
 for(const key of ['addCommand','addRibbonIcon','addStatusBarItem','registerMarkdownPostProcessor'])p[key]=h.owner[key];
 await p.load();await Promise.resolve();assert.equal(paths.length,1);assert.match(paths[0],/plugins\/49-notion-gpt\/data\.json$/);assert.equal(JSON.stringify(p.data.tables),JSON.stringify(legacy.tables));p.unload();
});
