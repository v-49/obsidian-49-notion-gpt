const {build} = require('esbuild');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist', 'fortynine-notion-gpt');
async function main() {
  fs.mkdirSync(out, {recursive:true});
  await build({entryPoints:[path.join(root,'src/main.js')],bundle:true,platform:'node',format:'cjs',target:'es2022',external:['obsidian'],outfile:path.join(out,'main.js')});
  const names=['layout','prompt-handbook','project-dashboard','table-resize','scroll-lock'];
  fs.writeFileSync(path.join(out,'styles.css'), names.map(n=>`/* === ${n} === */\n`+fs.readFileSync(path.join(root,'styles',n+'.css'),'utf8')).join('\n\n'));
  fs.copyFileSync(path.join(root,'manifest.json'),path.join(out,'manifest.json'));
  for (const name of ['main.js','styles.css']) fs.copyFileSync(path.join(out,name),path.join(root,name));
  console.log('Built: '+out);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
