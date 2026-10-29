const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers.cjs');
test('stripped web Copy citation badges disappear while prose and links survive',()=>{
 const h=harness(),{normalizeRichHtml:n}=h.load('features/paste');
 const badge=(label,count='')=>`<span><span><span><div><span><div></div></span><span><span>${label}</span></span>${count?`<span><span>${count}</span></span>`:''}</div></span></span></span>`;
 const html=`<p>规范正文。${badge('全国标准信息公共服务平台','+1')}</p><p>研究正文。${badge('World Bank Group')}</p><p>全国标准信息公共服务平台+1 是这里的正文。</p><a href="https://example.com">World Bank Group</a><pre><code>${badge('代码示例')}</code></pre>`;
 const doc=new h.window.DOMParser().parseFromString(n(html).html,'text/html');
 assert.equal(doc.body.textContent.includes('规范正文。全国'),false);
 assert.equal(doc.body.textContent.includes('研究正文。World'),false);
 assert.match(doc.body.textContent,/全国标准信息公共服务平台\+1 是这里的正文/);
 assert.equal(doc.querySelector('a').textContent,'World Bank Group');
 assert.match(doc.querySelector('code').textContent,/代码示例/);
 assert.equal(n(badge('真实链接').replace('真实链接','<a href="https://example.com">真实链接</a>')).changed,false);
 assert.equal(n(badge('普通组件').replace('<div></div>','<div>内容</div>')).changed,false);
 assert.equal(n(badge('普通组件','正文')).changed,false);
});
test('preserves emphasis, removes only source controls and retains links',()=>{
 const h=harness(),{normalizeRichHtml:normalize}=h.load('features/paste');
 const html='<p>World Bank Group <span data-d-default-strong>重点</span></p><span data-d-component="popover-trigger" role="button"><span data-d-component="badge"><span data-d-component="favicon"></span>PMC</span></span><a href="https://example.com">PMC</a><code><span data-d-default-strong>code</span></code>';
 const doc=new h.window.DOMParser().parseFromString(normalize(html).html,'text/html');
 assert.equal(doc.querySelector('strong').textContent,'重点');assert.equal(doc.querySelector('[role="button"]'),null);assert.equal(doc.querySelector('a').textContent,'PMC');assert.equal(doc.querySelector('code strong'),null);assert.match(doc.querySelector('p').textContent,/World Bank/);
});
test('web cards retain two rows, divider, icons and text in native callout markup',()=>{
 const h=harness(),{normalizeRichHtml:normalize}=h.load('features/paste');
 const card='<div data-d-component="box" data-d-has-border><div data-d-component="row"><svg data-d-component="icon" class="lucide lucide-search"></svg><p>标题一</p></div><p>正文一</p><div data-d-component="divider"></div><div data-d-component="row"><svg data-d-component="icon" class="lucide lucide-truck"></svg><p>标题二</p></div><p>正文二</p></div>';
 const doc=new h.window.DOMParser().parseFromString(normalize(card).html,'text/html');
 assert.equal(doc.querySelector('blockquote > p').textContent,'[!web-card]');assert.equal(doc.querySelectorAll('blockquote blockquote').length,2);assert.equal(doc.querySelectorAll('hr').length,1);assert.match(doc.body.textContent,/web-row\|search/);assert.match(doc.body.textContent,/web-row\|truck/);assert.match(doc.body.textContent,/正文二/);
});
test('simple lists compact while paragraphs, nested lists and code remain intact',()=>{
 const {compactMarkdown:c}=harness().load('features/paste');
 assert.equal(c('1. A\n    \n2. B\n    \n3. C\n\nEnd'),'1. A\n2. B\n3. C\n\nEnd');
 for(const s of ['P\n\nQ','1. A\n\n    paragraph\n\n2. B','- A\n  - child\n\n- B','````md\n```\n\n\n1. A\n\n2. B\n````','    first\n\n\n    second'])assert.equal(c(s),s);
});
test('tables and media survive HTML normalization',()=>{
 const h=harness(),{normalizeRichHtml:n}=h.load('features/paste');const html='<span data-d-default-strong>A</span><table><tr><td>B</td></tr></table><img src="data:image/png;base64,abc"><pre><code>\n\n\n</code></pre>';
 const doc=new h.window.DOMParser().parseFromString(n(html).html,'text/html');assert.equal(doc.querySelector('td').textContent,'B');assert.equal(doc.querySelector('img').getAttribute('src'),'data:image/png;base64,abc');assert.equal(doc.querySelector('code').textContent,'\n\n\n');
});
