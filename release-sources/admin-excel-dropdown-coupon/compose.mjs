import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha,walk,build as hideBuild} from '../admin-private-catalog-hide/compose.mjs';
export {sha};
const here=dirname(fileURLToPath(import.meta.url));
const seal=JSON.parse(readFileSync(join(here,'seal.json')));
export const baseline=seal.baseline;
export function compose(files){
 assert.deepEqual(Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)])),baseline,'BASELINE_DRIFT');
 const next={...files};
 for(const n of ['import','preview-ui','snapshot','transport']){
  const p='shared/tennisnote-single-sheet-'+n+'.js',b=readFileSync(join(here,'tennisnote-single-sheet-'+n+'.js')); next[p]=b;
  if(n!=='import'){
   const html=next['index.html'].toString(),old='../'+p+'?v=1.0.566';assert.equal(html.split(old).length,2);
   next['index.html']=Buffer.from(html.replace(old,'../'+p+'?v='+sha(b).slice(0,16)));
  }
 }
 const hashes=Object.fromEntries(Object.entries(next).map(([p,b])=>[p,sha(b)]));
 assert.deepEqual(hashes,seal.candidate,'CANDIDATE_DRIFT');
 assert.deepEqual(Object.keys(hashes).filter(p=>hashes[p]!==baseline[p]).sort(),seal.changed);
 return {files:next,hashes};
}
export function build(base,out){
 const previous=hideBuild(base,out+'-prior');const result=compose(previous.files);
 for(const [p,b] of Object.entries(result.files)){const f=join(out,p);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,b);}
 assert.deepEqual(Object.fromEntries(Object.entries(walk(out)).map(([p,b])=>[p,sha(b)])),result.hashes);
 return result;
}
