const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers.cjs');
test('source-copy payload retains emphasis and diagrams before the website strips them',()=>{
 const h=harness(),{findAnswer,payloadFor}=h.load('../browser-extension/source');
 h.window.document.body.innerHTML='<section><div data-dil-message-id="one"><p><span data-d-default-strong>Key sentence</span></p><img src="data:image/svg+xml,%3Csvg%3E"><table><tr><th>A</th></tr><tr><td>B</td></tr></table></div><div><button aria-label="Copy">Copy</button></div></section>';
 const root=findAnswer(h.window.document.querySelector('button'));assert.ok(root);const payload=payloadFor(root);assert.match(payload.html,/<strong>Key sentence<\/strong>/);assert.match(payload.html,/data:image\/svg\+xml/);assert.match(payload.html,/<table>/);assert.doesNotMatch(payload.html,/button/);
 const {normalizeRichHtml}=h.load('rich-html');const again=normalizeRichHtml(payload.html);assert.equal(again.html,payload.html);assert.equal(again.changed,false);h.window.close();
});
test('answer-copy interception writes HTML and plain text only on a deliberate supported copy click',async()=>{
 const h=harness(),doc=h.window.document,{installCopyFix}=h.load('../browser-extension/source');doc.body.innerHTML='<section><div data-dil-message-id="one"><span data-d-default-strong>Bold</span></div><button aria-label="Copy"></button></section>';
 const handlers=new Map(),writes=[];doc.addEventListener=(name,fn)=>handlers.set(name,fn);doc.removeEventListener=(name)=>handlers.delete(name);h.window.ClipboardItem=class{constructor(data){this.data=data;}};
 const dispose=installCopyFix(doc,{write:async items=>writes.push(items)});const button=doc.querySelector('button');let stopped=false;
 handlers.get('click')({isTrusted:true,target:button,preventDefault(){},stopImmediatePropagation(){stopped=true;}});await Promise.resolve();assert.equal(stopped,true);assert.equal(writes.length,1);assert.deepEqual(Object.keys(writes[0][0].data),['text/html','text/plain']);
 handlers.get('click')({isTrusted:false,target:button});assert.equal(writes.length,1);button.setAttribute('aria-label','Copy message');handlers.get('click')({isTrusted:true,target:button});assert.equal(writes.length,1);dispose();assert.equal(handlers.has('click'),false);assert.equal(handlers.has('copy'),false);h.window.close();
});
test('copy failures fall back to the original website action',async()=>{
 const h=harness(),doc=h.window.document,{installCopyFix}=h.load('../browser-extension/source');doc.body.innerHTML='<section><div data-dil-message-id="one">Answer</div><button aria-label="Copy"></button></section>';
 const handlers=new Map();doc.addEventListener=(name,fn)=>handlers.set(name,fn);doc.removeEventListener=(name)=>handlers.delete(name);h.window.ClipboardItem=class{};let fallback=0;const button=doc.querySelector('button');button.click=()=>fallback++;
 const dispose=installCopyFix(doc,{write:()=>Promise.reject(new Error('permission'))});handlers.get('click')({isTrusted:true,target:button,preventDefault(){},stopImmediatePropagation(){}});await Promise.resolve();await Promise.resolve();assert.equal(fallback,1);dispose();h.window.close();
});
