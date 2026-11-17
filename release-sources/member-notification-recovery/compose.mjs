import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const seal=JSON.parse(readFileSync(new URL('./seal.json',import.meta.url)));
const controls=JSON.parse(readFileSync(new URL('./controls.json',import.meta.url)));
const payload=JSON.parse(readFileSync(new URL('./payload.json',import.meta.url)));
export function route(p){return '/'+(p.endsWith('index.html')?p.slice(0,-10):p.replace(/\.html$/,''));}
export async function readBytes(host,p){const r=await fetch(host+route(p),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});assert.equal(r.status,200,'READ_FAILED '+p);return Buffer.from(await r.arrayBuffer());}
export async function verifyRemote(hashes,host){const paths=Object.keys(hashes).filter(p=>!Object.hasOwn(controls,p));for(let i=0;i<paths.length;i+=8)await Promise.all(paths.slice(i,i+8).map(async p=>assert.equal(sha(await readBytes(host,p)),hashes[p],'REMOTE_DRIFT '+p)));return paths.length;}
export async function build(out,localBase=''){
  assert.deepEqual(Object.keys(payload).sort(),seal.changed);
  assert.deepEqual(Object.keys(controls).sort(),['_headers','_redirects','_worker.js']);
  const paths=Object.keys(seal.baseline);assert.equal(paths.length,252);
  const files={};for(let i=0;i<paths.length;i+=8)await Promise.all(paths.slice(i,i+8).map(async p=>{
    assert(!p.includes('..')&&!p.startsWith('/')&&!p.includes('\\'));
    const b=Object.hasOwn(controls,p)?Buffer.from(controls[p],'base64'):localBase?readFileSync(join(localBase,p)):await readBytes('https://tennisnote-app.pages.dev',p);
    assert.equal(sha(b),seal.baseline[p],'BASELINE_DRIFT '+p);files[p]=b;
  }));
  for(const[p,b]of Object.entries(payload))files[p]=Buffer.from(b,'base64');
  const hashes=Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)]));assert.deepEqual(hashes,seal.candidate);
  assert.deepEqual(paths.filter(p=>hashes[p]!==seal.baseline[p]).sort(),seal.changed);
  for(const[p,b]of Object.entries(files)){const f=join(out,p);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,b,{flag:'wx'});}
  return hashes;
}
