// Compose only the approved DEV administrator delta; no database or publish transport.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=dirname(fileURLToPath(import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
const manifest=JSON.parse(readFileSync(join(root,'manifest.json')));
for(const [name,sha] of Object.entries(manifest.files)) assert.equal(hash(readFileSync(join(root,name))),sha,name);
assert.equal(manifest.project,'udjmiezroipctytmztwz');
assert.equal(manifest.preview,'https://r4-finance-owner-qa.tennisnote-admin-dev.pages.dev');
assert.equal(manifest.paymentEnabled,false);
const base=resolve(process.argv[2]||'dev-base'),out=resolve(process.argv[3]||'owner-artifact');
assert.notEqual(base,out);assert.ok(!existsSync(out),'Output must be a fresh directory');
const seal=JSON.parse(readFileSync(join(base,'seal.json')));
assert.equal(seal.source,'dee0ee6347496ca900abc5ad95da8dccacd3ebc3');
assert.equal(seal.executor,'d1eaf418c4b2d24d95bd93726491e5224680cdc9');
assert.equal(Object.keys(seal.sites.admin).length,182);
const walk=(dir,p='')=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name),p+e.name+'/'):[p+e.name]);
assert.deepEqual(walk(join(base,'admin')).sort(),Object.keys(seal.sites.admin).sort());
for(const [path,sha] of Object.entries(seal.sites.admin)) assert.equal(hash(readFileSync(join(base,'admin',path))),sha,path);
const win={};vm.runInNewContext(readFileSync(join(base,'admin/shared/config.local.js'),'utf8'),{window:win},{timeout:1000});
assert.equal(win.TENNISNOTE_CONFIG.environment,'development');
assert.equal(win.TENNISNOTE_CONFIG.supabaseUrl,'https://'+manifest.project+'.supabase.co');
assert.equal(win.TENNISNOTE_CONFIG.projectFingerprint,manifest.fingerprint);
assert.equal(win.TENNIS_NOTE_PAYMENT_CONFIG.enabled,false);
assert.equal(win.TENNIS_NOTE_PAYMENT_CONFIG.mode,'disabled');
mkdirSync(out,{recursive:true});cpSync(join(base,'admin'),join(out,'admin'),{recursive:true});
let index=readFileSync(join(base,'admin/index.html'),'utf8');
for(const kind of ['paid','settlement']){
  const file='r4-branch-finance-'+kind+'.js',src=readFileSync(join(root,file));
  const regex=new RegExp(file.replaceAll('.','\\.')+'\\?v=[a-f0-9]+','g');
  assert.equal([...index.matchAll(regex)].length,1,file+' must be connected once');
  index=index.replace(regex,file+'?v='+hash(src).slice(0,16));
  writeFileSync(join(out,'admin',file),src);
}
writeFileSync(join(out,'admin/index.html'),index);
const changed=Object.keys(seal.sites.admin).filter(p=>hash(readFileSync(join(out,'admin',p)))!==seal.sites.admin[p]).sort();
assert.deepEqual(changed,['index.html','r4-branch-finance-paid.js','r4-branch-finance-settlement.js']);
const receipt={status:'DEV_COMPOSITION_PASS',source:process.env.GITHUB_SHA||null,baseSource:seal.source,
 preview:manifest.preview,project:manifest.project,paymentEnabled:false,changed,
 sqlSha256:manifest.files['owner-candidate.sql'],databaseWrites:0,publishRequests:0,
 files:Object.fromEntries(walk(join(out,'admin')).map(p=>[p,hash(readFileSync(join(out,'admin',p)))]))};
writeFileSync(join(out,'composition.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({...receipt,files:undefined}));
