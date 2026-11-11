// Local only. No network, repository writes, or deployment APIs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const sha=x=>createHash('sha256').update(x).digest('hex');
const here=dirname(fileURLToPath(import.meta.url));
const base=resolve(here,'../../2026-11-10-r4-general-dev/prod-independent-source-42846945596');
export const baseSource='7ba4e453e5e89540c0578db1dd76312c6f8d9442';
export const recovery='d0841b4a-a92a-4a87-a5c1-ae40436fb2a3';
const sealSha='44c31617fc2c1d8ea5377d0e6d6a0f2d2b52ee1aa048a023e8c4ac08f497c85b';
export const candidatePaths=['compose.mjs','install-off.sql','pilot-open.sql','designated-open.sql','disable.sql','postread.sql','independent-v2.js','check-db.mjs','check-web.mjs'];
export function assemble(){
  const seal=readFileSync(join(base,'seal.json'));
  assert.equal(sha(seal),sealSha,'baseline seal drift');
  const old=JSON.parse(seal);
  assert.equal(old.source,baseSource);
  const admin=join(base,'admin');
  function walk(dir,prefix=''){
    return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
      const p=prefix+e.name;
      assert.ok(e.isDirectory()||e.isFile());
      return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+'/')):[[p,readFileSync(join(dir,e.name))]];
    }));
  }
  const before=walk(admin);
  const hashFiles=x=>Object.fromEntries(Object.keys(x).sort().map(p=>[p,sha(x[p])]));
  assert.deepEqual(hashFiles(before),old.admin);
  assert.equal(Object.keys(before).length,178);
  const name='r4-independent-prod-v2.js',js=readFileSync(join(here,'independent-v2.js'));
  const html=before['index.html'].toString('utf8');
  const anchor='<script src="./r4-independent-owner.js?v=05b861eaffad3030"></script>';
  assert.equal(html.split(anchor).length,2);
  assert.ok(html.includes('id="r4Onboarding"')&&!Object.hasOwn(before,name));
  const after={...before,'index.html':Buffer.from(html.replace(anchor,'<script src="./'+name+'?v='+sha(js).slice(0,16)+'"></script>')),[name]:js};
  const delta=Object.keys(after).filter(p=>!before[p]||!after[p].equals(before[p])).sort();
  assert.deepEqual(delta,['index.html',name]);
  return {after,delta,hashes:hashFiles(after)};
}
export function manifest(){
  const m=assemble(), inputs=Object.fromEntries(candidatePaths.map(p=>[p,sha(readFileSync(join(here,p)))]));
  return {format:'tennisnote-r4-independent-prod-v2-local-only',gitBase:'63c929ebcb61a03482042252f684734758a4b095',
    baseline:{source:baseSource,sealSha256:sealSha,recovery},targetsBound:false,inputs,admin:{fileCount:Object.keys(m.after).length,delta:m.delta,sha256:m.hashes}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const m=manifest(),bytes=Buffer.from(JSON.stringify(m,null,2)+'\n');
  if(process.argv[2]==='--seal')writeFileSync(join(here,'candidate-seal.json'),bytes,{flag:'wx'});
  else if(process.argv[2]!=='--check')throw Error('Local check or seal only');
  console.log(JSON.stringify({sha256:sha(bytes),files:m.admin.fileCount,delta:m.admin.delta,sql:Object.fromEntries(Object.entries(m.inputs).filter(([p])=>p.endsWith('.sql')))}));
}
