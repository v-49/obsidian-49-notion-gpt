const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers.cjs');
async function fixture(html){
 const h=harness(),Images=h.load('features/image-align');const leaf=h.leaf();h.workspace.leaves=[leaf];
 const content=h.window.document.createElement('div');content.className='cm-content';content.innerHTML=html;leaf.view.containerEl.append(content);
 const p=new Images(h.owner,'images');await p.load();h.ready.forEach(f=>f());return {...h,p,leaf,content};
}
test('standalone local images and data-URI SVGs default to center; inline and table images stay inline',async()=>{
 const h=await fixture('<span class="image-embed" src="diagram.png"><div class="image-wrapper"><img src="app://vault/diagram.png?mtime=1" width="517"></div></span><span class="image-embed"><div class="image-wrapper"><img src="data:image/svg+xml,%3Csvg%3E" width="340"></div></span><p>Text <img src="icon.png"></p><table><tr><td><img src="cell.png"></td></tr></table>');
 assert.equal(h.p.records.size,2);for(const info of h.p.records.values())assert.equal(info.host.dataset.fngImageAlign,'center');assert.equal(h.content.querySelector('img').getAttribute('width'),'517');assert.equal(h.content.querySelector('p img').classList.contains('fng-aligned-image'),false);h.p.unload();assert.equal(h.content.querySelectorAll('[data-fng-image-align]').length,0);
});
test('alignment menu augments the same native event menu without removing native actions',async()=>{
 const h=await fixture('<span class="image-embed"><div class="image-wrapper"><img src="data:image/svg+xml,%3Csvg%3E"></div></span>');const img=h.content.querySelector('img');
 img.addEventListener('contextmenu',event=>h.Menu.forEvent(event).addItem(item=>item.setTitle('Copy image')));
 img.dispatchEvent(new h.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true}));await Promise.resolve();
 assert.equal(h.menus.length,1);assert.deepEqual(h.menus[0].items.map(i=>i.title),['Copy image','图片左对齐','图片居中','图片右对齐']);
 h.menus[0].items[1].callback();assert.equal(img.closest('.image-embed').dataset.fngImageAlign,'left');assert.equal(h.owner.data.images.files['note.md'][h.p.records.get(img).key],'left');h.p.unload();
});
test('file-menu hook does not create a second menu in the deferred fallback',async()=>{
 const h=await fixture('<span class="image-embed" src="local.png"><img src="app://vault/local.png"></span>');const img=h.content.querySelector('img');
 const native=new h.Menu();img.addEventListener('contextmenu',()=>h.events.find(e=>e.name==='file-menu').fn(native,{}));
 img.dispatchEvent(new h.window.MouseEvent('contextmenu',{bubbles:true}));await Promise.resolve();assert.equal(h.menus.length,1);assert.equal(native.items.length,3);h.p.unload();
});
test('saved choices survive rerender and file rename, and are scoped to each note',async()=>{
 const h=await fixture('<span class="image-embed" src="same.png"><img src="app://vault/same.png"></span>');const info=[...h.p.records.values()][0];h.p.setAlignment(info,'right');
 h.content.innerHTML='<span class="image-embed" src="same.png"><img src="app://vault/same.png?mtime=2"></span>';h.p.scan();assert.equal(h.content.firstElementChild.dataset.fngImageAlign,'right');
 h.leaf.view.file.path='renamed.md';h.events.find(e=>e.name==='rename').fn(h.leaf.view.file,'note.md');h.p.scan();assert.equal(h.content.firstElementChild.dataset.fngImageAlign,'right');assert.equal(h.p.data.files['note.md'],undefined);
 h.leaf.view.file.path='other.md';h.p.scan();assert.equal(h.content.firstElementChild.dataset.fngImageAlign,'center');h.p.unload();
});
test('data image keys are bounded and stable while native width metadata is unchanged',async()=>{
 const h=await fixture('<p><img src="https://example.com/image.png" width="240" height="120"></p>');const {imageKey}=h.load('features/image-align');assert.equal(imageKey('x'.repeat(50000)).length<50,true);const img=h.content.querySelector('img');h.p.setAlignment([...h.p.records.values()][0],'center');assert.equal(img.getAttribute('width'),'240');assert.equal(img.getAttribute('height'),'120');h.p.unload();
});
test('unload cancels deferred context menus and disconnects image handlers',async()=>{
 const h=await fixture('<span class="image-embed"><img src="data:image/svg+xml,test"></span>');const img=h.content.querySelector('img');img.dispatchEvent(new h.window.MouseEvent('contextmenu',{bubbles:true}));h.p.unload();await Promise.resolve();assert.equal(h.menus.length,0);img.dispatchEvent(new h.window.MouseEvent('contextmenu',{bubbles:true}));await Promise.resolve();assert.equal(h.menus.length,0);
});
