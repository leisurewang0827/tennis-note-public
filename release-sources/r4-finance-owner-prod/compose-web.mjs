// Compose exactly two ADMIN assets on the current production artifact. No DEV shell/config.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname,resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const baseline={execution:'2076381588b23c7e1b7432eadfc2d603ecb04838',source:'5706b9cca20acaa3baa2c281a7bdf7dd1577306a',deployment:'9704d39b-8c66-40e0-8b91-1bf6c02f4f6f',config:'0a89879945c847ecf2244823a1a32ff21dfb6936ecc80706b183c7231671bd64'};
export function walk(root,dir=root,result={}){
 for(const n of readdirSync(dir)){const p=join(dir,n),s=lstatSync(p);assert(!s.isSymbolicLink());
  if(s.isDirectory())walk(root,p,result);else{assert(s.isFile());result[relative(root,p).split(sep).join('/')]=readFileSync(p);}}
 return result;
}
export function composeWeb(base,out){
 const seal=JSON.parse(readFileSync(join(base,'admin/seal.json'),'utf8'));
 assert.equal(seal.execution,baseline.execution);assert.equal(seal.source,baseline.source);
 const files=walk(join(base,'admin/site'));
 assert.deepEqual(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,hash(b)])),seal.files);
 assert.equal(hash(files['shared/config.local.js']),baseline.config);
 assert.equal(hash(files['index.html']),'ee72c6285c5fd5c4e48e9f2caed53f667cea7d94a8263a3a10463c426126c7f0');
 assert.equal(hash(files['r4-branch-finance-settlement.js']),'a19dd649730297eca16b056c3493bbf6683004532bfeffa9bd3f3e270e74f0dc');
 const original=files['r4-branch-finance-settlement.js'].toString('utf8');
 assert.equal(original.split("'tn_r4_list_scoped_coach_roster'").length,2);
 files['r4-branch-finance-settlement.js']=Buffer.from(original.replace("'tn_r4_list_scoped_coach_roster'","'tn_r4_branch_finance_coaches'"));
 const sh=hash(files['r4-branch-finance-settlement.js']);
 const html=files['index.html'].toString('utf8'),anchor='./r4-branch-finance-settlement.js?v=a19dd649730297ec';
 assert.equal(html.split(anchor).length,2);
 files['index.html']=Buffer.from(html.replace(anchor,'./r4-branch-finance-settlement.js?v='+sh.slice(0,16)));
 const hashes=Object.fromEntries(Object.entries(files).map(([n,b])=>[n,hash(b)]));
 const changed=Object.keys(hashes).filter(n=>hashes[n]!==seal.files[n]).sort();
 assert.deepEqual(changed,['index.html','r4-branch-finance-settlement.js']);
 assert(!files['r4-finance-owner-dev-entry.js']);
 assert.equal(hash(files['r4-branch-finance-paid.js']),seal.files['r4-branch-finance-paid.js']);
 for(const [n,b]of Object.entries(files)){const p=join(out,'site',n);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b,{flag:'wx'});}
 const result={baseline,changes:changed,prior:seal.files,files:hashes};
 mkdirSync(out,{recursive:true});writeFileSync(join(out,'seal.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const r=composeWeb(process.argv[2],process.argv[3]);console.log(JSON.stringify({status:'PROD_ADMIN_MINIMAL_COMPOSE_PASS',files:Object.keys(r.files).length,changed:r.changes,devAdapter:false,configUnchanged:true}));
}

