import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const paths=['index.html','shared/tennisnote-comment-draft.js'];
export const before=['304157b482226fa92e3d0604c53b12d5389453d4469deec976bda9e25dc594d2','be01c5d237d12374a23e0d5fe98d75c1b9dd1d6bbfccc2f0ae2f8cc92d41e6a0'];
export const after=['ff68ae0f78d8abb9b4e9de2ab57b8eac9bc972face42ccee08a09e1a73be7c36','1bd370b98ce781f5c6f62ae62c7252ca8bb7a8f3218b567e78a4a994fdb62e11'];
export const baseSeal='e634bf72f7ea9609050fbd79a70efda9f737b56f4cf5314ceabaac158cd93d48';
function walk(dir,p=''){
  const files=[];
  for(const name of readdirSync(join(dir,p)).sort()){
    const n=p?p+'/'+name:name;const s=lstatSync(join(dir,n));assert(!s.isSymbolicLink());
    if(s.isDirectory())files.push(...walk(dir,n));else{assert(s.isFile());files.push(n)}
  }
  return files.sort();
}
export function compose(base,out){
  const seal=readFileSync(join(base,'seal.json'));assert.equal(hash(seal),baseSeal);
  const previous=JSON.parse(seal).files, root=join(base,'site'),keys=walk(root);
  assert.deepEqual(keys,Object.keys(previous).sort());assert.equal(keys.length,184);
  const detail=readFileSync(new URL('detail.js',import.meta.url),'utf8').replaceAll('\r\n','\n').trimEnd();
  const next={},data={};
  for(const p of keys){
    let raw=readFileSync(join(root,p));assert.equal(hash(raw),previous[p],p);
    if(paths.includes(p)){
      const i=paths.indexOf(p);assert.equal(hash(raw),before[i]);const src=raw.toString('utf8');
      if(i===0){
        const old='shared/tennisnote-comment-draft.js?v='+before[1].slice(0,16);
        const to=old.split('?')[0]+'?v='+after[1].slice(0,16);
        assert.equal(src.split(old).length,2);assert(!src.includes(to));const s=src.replace(old,to);
        assert.equal(s.replace(to,old),src);raw=Buffer.from(s);
      }else{
        const a='  function detailedDraft(',b='  window.TennisNoteCommentDraft';
        assert.equal(src.split(a).length,2);assert.equal(src.split(b).length,2);
        assert(src.indexOf(b)>src.indexOf(a));raw=Buffer.from(src.slice(0,src.indexOf(a))+detail+'\n\n'+src.slice(src.indexOf(b)));
      }
      assert.equal(hash(raw),after[i]);
    }
    next[p]=hash(raw);data[p]=raw;
  }
  assert.deepEqual(keys.filter(p=>next[p]!==previous[p]),paths);
  if(out){
    mkdirSync(out,{recursive:false});
    for(const p of keys){const target=join(out,p);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,data[p],{flag:'wx'})}
    assert.deepEqual(walk(out),keys);for(const p of keys)assert.equal(hash(readFileSync(join(out,p))),next[p]);
  }
  return {previous,next,data};
}
