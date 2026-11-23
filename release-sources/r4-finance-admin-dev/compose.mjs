// 기존 183파일 개발 산출물에 검증한 권한 패널만 추가한다.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,lstatSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const prefix='release-sources/r4-finance-admin-dev/';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const json=p=>JSON.parse(readFileSync(p,'utf8'));
export const walk=(dir,p='')=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
 const path=join(dir,e.name);assert(!lstatSync(path).isSymbolicLink());return e.isDirectory()?Object.entries(walk(path,p+e.name+'/')):[[p+e.name,hash(readFileSync(path))]];
}));
export function compose(base,out,m){
 assert(!existsSync(out),'Output already exists; reconcile');
 assert.equal(hash(readFileSync(join(base,'composition.json'))),m.base.compositionSha256);
 const old=json(join(base,'composition.json'));assert.equal(old.source,m.base.source);assert.equal(old.project,m.devProject);assert.equal(old.paymentEnabled,false);
 assert.equal(Object.keys(old.files).length,183);assert.deepEqual(walk(join(base,'admin')),old.files);
 const additions={};for(const p of ['r4-finance-admin-control.js','r4-finance-admin-control.css']){
  const bytes=readFileSync(prefix+p);assert.equal(hash(bytes),m.payload[p]);assert(!old.files[p]);additions[p]=bytes;
 }
 const config=readFileSync(join(base,'admin/shared/config.local.js'),'utf8');
 assert(config.includes('udjmiezroipctytmztwz')&&config.includes('63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba'));
 assert(!config.includes('cnympiwrwgouuvhaivbc'));
 let index=readFileSync(join(base,'admin/index.html'),'utf8');assert(!index.includes('r4-finance-admin-control.'));
 const end=index.lastIndexOf('</body>');assert(end>=0);
 const tags='    <link rel="stylesheet" href="./r4-finance-admin-control.css?v='+m.payload['r4-finance-admin-control.css'].slice(0,16)+'" />\n'
  +'    <script src="./r4-finance-admin-control.js?v='+m.payload['r4-finance-admin-control.js'].slice(0,16)+'"></script>\n';
 index=index.slice(0,end)+tags+index.slice(end);
 mkdirSync(out,{recursive:true});cpSync(join(base,'admin'),join(out,'admin'),{recursive:true});
 writeFileSync(join(out,'admin/index.html'),index);for(const[p,b]of Object.entries(additions))writeFileSync(join(out,'admin',p),b);
 const files={...old.files,'index.html':hash(index),...Object.fromEntries(Object.entries(additions).map(([p,b])=>[p,hash(b)]))};
 assert.equal(Object.keys(files).length,185);assert.deepEqual(walk(join(out,'admin')),files);
 const receipt={source:process.env.GITHUB_SHA||null,privateSource:m.privateSource,project:m.devProject,paymentEnabled:false,baseSource:old.source,files};
 writeFileSync(join(out,'composition.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=compose(process.argv[2]||'base',process.argv[3]||'candidate',json(prefix+'manifest.json'));
 console.log(JSON.stringify({composition:'PASS',files:Object.keys(result.files).length,onlyNewPanel:true}));
}
