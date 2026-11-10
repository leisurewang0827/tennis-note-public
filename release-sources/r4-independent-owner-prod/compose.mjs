import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
export const digest=x=>createHash('sha256').update(x).digest('hex');
export const BASE_SEAL='5a7b6af33ac72f8ebd879b02555baa720cd309a01b10246af5af66cb9f4c54ad';
export const BASE_ARTIFACT='ebf3da21e1672a93e66b9936747b976762e55f69bc19aad70133ec4ef6ee759a';
export function compose(base){
  const seal=readFileSync(join(base,'seal.json'));assert.equal(digest(seal),BASE_SEAL,'base seal drift');
  const priorSeal=JSON.parse(seal);assert.equal(priorSeal.source,'bd848b8c8f893d3b7be0e2a763065e1ffaa8ec7c');
  function walk(dir,prefix=''){return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    assert.ok(e.isDirectory()||e.isFile());const p=prefix+e.name;
    return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+'/')):[[p,readFileSync(join(dir,e.name))]];
  }));}
  const baseFiles=walk(join(base,'admin')),hashes=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,digest(v)]));
  assert.deepEqual(hashes(baseFiles),priorSeal.admin);assert.equal(Object.keys(baseFiles).length,177);
  const file='r4-independent-owner.js';assert.ok(!Object.hasOwn(baseFiles,file));
  const script=readFileSync(new URL('./independent-ui.js',import.meta.url));
  const html=baseFiles['index.html'].toString('utf8');assert.equal(html.split('</body>').length,2);
  assert.ok(html.includes('id="r4Onboarding"')&&html.includes('r4-onboarding.js'));
  const version=digest(script).slice(0,16),eol=html.includes('\r\n')?'\r\n':'\n';
  const index=Buffer.from(html.replace('</body>',`  <script src="./${file}?v=${version}"></script>${eol}</body>`));
  const output={...baseFiles,'index.html':index,[file]:script};
  assert.deepEqual(Object.keys(output).filter(k=>!baseFiles[k]||!output[k].equals(baseFiles[k])).sort(),['index.html',file]);
  return {output,hashes:hashes(output),version};
}
