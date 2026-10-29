const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers.cjs');
test('startup is silent and every scroll-lock control is hidden for a single note',()=>{
  const h=harness(),Lock=h.load('features/scroll-lock');h.workspace.leaves=[h.leaf()];
  const p=new Lock(h.owner,'scroll');p.load();h.ready.forEach(f=>f());
  assert.equal(h.notices.length,0);assert.equal(p.status.hidden,true);assert.equal(p.ribbon.hidden,true);assert.equal(p.actions.size,0);p.unload();
});
test('two side-by-side panes expose controls; a closed pane silently unlocks and removes actions',()=>{
  const h=harness(),Lock=h.load('features/scroll-lock');h.workspace.leaves=[h.leaf(),h.leaf(410,0,400,600,'other.md')];
  const p=new Lock(h.owner,'scroll');p.load();h.ready.forEach(f=>f());
  assert.equal(p.status.hidden,false);assert.equal(p.actions.size,2);p.toggle();assert.ok(p.session);
  h.workspace.leaves.pop();p.refresh();assert.equal(p.session,null);assert.equal(p.actions.size,0);assert.equal(p.status.hidden,true);assert.equal(h.notices.length,0);p.unload();
});
test('stacked panes, invisible tabs, and mode changes are handled correctly',()=>{
  const h=harness(),Lock=h.load('features/scroll-lock');const a=h.leaf(),b=h.leaf(0,610);h.workspace.leaves=[a,b];
  const p=new Lock(h.owner,'scroll');p.load();h.ready.forEach(f=>f());assert.equal(p.status.hidden,true);
  h.workspace.leaves=[a,h.leaf(410),h.leaf(820)];h.workspace.leaves[2].view.containerEl.style.display='none';p.refresh();assert.equal(p.status.hidden,false);
  p.toggle();h.workspace.leaves[1].view.getMode=()=> 'preview';p.refresh();assert.equal(p.session,null);assert.equal(p.status.hidden,true);p.unload();
});
test('startup does not change native pane linking',()=>{
  const h=harness(),Lock=h.load('features/scroll-lock');const a=h.leaf(),b=h.leaf(410);a.group=b.group='native';h.workspace.leaves=[a,b];
  const p=new Lock(h.owner,'scroll');p.load();h.ready.forEach(f=>f());assert.equal(a.group,'native');p.toggle();assert.equal(a.group,null);p.unload();
});
test('relative scrolling retains offsets, handles boundaries and Alt, and detaches on unload',()=>{
  const h=harness(),{RelativeScrollSession:Session}=h.load('features/scroll-lock');const a=h.leaf().view.containerEl.firstChild,b=h.leaf().view.containerEl.firstChild;
  a.scrollTop=100;b.scrollTop=500;const s=new Session([a,b]);a.scrollTop=150;a.dispatchEvent(new h.window.Event('scroll'));assert.equal(b.scrollTop,550);
  b.dispatchEvent(new h.window.Event('scroll'));assert.equal(a.scrollTop,150);
  s.setAlt(true);a.scrollTop=200;a.dispatchEvent(new h.window.Event('scroll'));assert.equal(b.scrollTop,550);s.setAlt(false);
  a.scrollTop=250;a.dispatchEvent(new h.window.Event('scroll'));assert.equal(b.scrollTop,600);
  a.scrollTop=1800;a.dispatchEvent(new h.window.Event('scroll'));assert.equal(b.scrollTop,1800);
  b.dispatchEvent(new h.window.Event('scroll'));assert.equal(a.scrollTop,1800);
  s.dispose();a.scrollTop=0;a.dispatchEvent(new h.window.Event('scroll'));assert.equal(b.scrollTop,1800);
});
