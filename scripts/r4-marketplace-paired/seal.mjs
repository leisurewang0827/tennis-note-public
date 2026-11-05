import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const [mode,dirArg,manifestArg,sha]=process.argv.slice(2);
assert.ok(['create','verify'].includes(mode)&&dirArg&&manifestArg&&/^[a-f0-9]{40}$/.test(sha||''));
const root=resolve(dirArg),manifest=resolve(manifestArg),hash=x=>createHash('sha256').update(x).digest('hex');
async function walk(dir,prefix=''){const rows=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=prefix+item.name;assert.ok(!item.isSymbolicLink());if(item.isDirectory())rows.push(...await walk(join(dir,item.name),path+'/'));else{assert.ok(item.isFile());rows.push({path,sha256:hash(await readFile(join(dir,item.name)))});}}return rows;}
const files=(await walk(root)).sort((a,b)=>a.path.localeCompare(b.path));
assert.ok(files.length>400&&files.every(x=>x.path.startsWith('admin/')||x.path.startsWith('member/')));
const value={sourceSha:sha,candidateSha256:'504459b03b9f61f5b4b6f3bea6f5809adaaa526a7a19cecf693bc8c627a7be0e',files};
if(mode==='create')await writeFile(manifest,JSON.stringify(value)+'\n',{flag:'wx'});
else assert.deepEqual(value,JSON.parse(await readFile(manifest,'utf8')),'artifact integrity failure');
console.log(JSON.stringify({status:'ARTIFACT_INTEGRITY_PASS',mode,fileCount:files.length}));
