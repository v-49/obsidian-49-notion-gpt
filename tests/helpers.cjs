const fs=require('fs'),path=require('path'),vm=require('vm');
const {JSDOM}=require('jsdom');
function harness(){
  const window=new JSDOM('<body></body>',{pretendToBeVisual:true}).window;
  const notices=[],events=[],ready=[],commands=[],cache=new Map();
  class Component {
    constructor(){this.disposers=[];this.children=[];this._loaded=false;}
    register(fn){this.disposers.push(fn);}
    registerEvent(ref){this.register(()=>{ref.off=true;});}
    registerDomEvent(el,type,fn,options){el.addEventListener(type,fn,options);this.register(()=>el.removeEventListener(type,fn,options));}
    addChild(c){this.children.push(c);c.load();return c;}
    load(){this._loaded=true;return this.onload?.();}
    unload(){this.onunload?.();this.children.forEach(c=>c.unload());this.disposers.splice(0).reverse().forEach(f=>f());this._loaded=false;}
  }
  class Plugin extends Component {}
  const api={Component,Plugin,MarkdownView:class{},Notice:class{constructor(text){notices.push(text);}},setIcon:(el,icon)=>el.dataset.icon=icon,
    htmlToMarkdown:html=>html};
  const root=path.resolve(__dirname,'../src');
  function load(name){
    const filename=path.resolve(root,name.endsWith('.js')?name:name+'.js');
    if(cache.has(filename))return cache.get(filename).exports;
    const module={exports:{}};cache.set(filename,module);
    const req=n=>n==='obsidian'?api:load(path.relative(root,path.resolve(path.dirname(filename),n)));
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,require:req,console,DOMParser:window.DOMParser,DataTransfer:window.DataTransfer,ClipboardEvent:window.ClipboardEvent,setTimeout,clearTimeout},{filename});
    return module.exports;
  }
  const split={},workspace={containerEl:window.document.body,rootSplit:split,leaves:[],getLeavesOfType(){return this.leaves;},on(name,fn){const ref={name,fn};events.push(ref);return ref;},onLayoutReady(fn){ready.push(fn);},getActiveViewOfType(){return this.leaves[0]?.view;}};
  const owner=new Plugin();owner.app={workspace,vault:{configDir:'.obsidian',on:workspace.on.bind(workspace),adapter:{exists:async()=>false}}};owner.data={};
  owner.addCommand=c=>commands.push(c);
  owner.addStatusBarItem=()=>window.document.body.appendChild(window.document.createElement('div'));
  owner.addRibbonIcon=()=>window.document.body.appendChild(window.document.createElement('div'));
  owner.registerMarkdownPostProcessor=()=>{};
  owner.saveFeature=async(k,v)=>{owner.data[k]=v;};
  function leaf(left=0,top=0,width=400,height=600,path='note.md'){
    const el=window.document.body.appendChild(window.document.createElement('div'));
    el.getClientRects=()=>[el.getBoundingClientRect()];el.getBoundingClientRect=()=>({left,top,right:left+width,bottom:top+height,width,height});
    const scroll=el.appendChild(window.document.createElement('div'));scroll.className='cm-scroller';
    Object.defineProperties(scroll,{scrollHeight:{value:2400},clientHeight:{value:600}});
    const view={containerEl:el,contentEl:el,file:{path},getMode:()=> 'source',editor:{getValue:()=>''},addAction(){return el.appendChild(window.document.createElement('button'));}};
    return {view,getRoot:()=>split,setGroup(){this.group=null;}};
  }
  return {window,owner,workspace,load,notices,events,ready,commands,leaf};
}
module.exports={harness};
