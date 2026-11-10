import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
export const sha=b=>createHash("sha256").update(b).digest("hex");
export const BASE_SEAL="dd2661614bc2519ff105fe2070387d6e60252c4ec2773e5897c4ff9dac308f31";
export const RECOVERY="af8eba1b-28f8-42e7-b0b8-f644213dcdd7";
export function assemble(base){
  const sealBytes=readFileSync(join(base,"seal.json"));
  assert.equal(sha(sealBytes),BASE_SEAL,"unexpected administrator base seal");
  const sealed=JSON.parse(sealBytes);
  const walk=(dir,prefix="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const p=prefix+e.name;
    assert.ok(e.isDirectory()||e.isFile(),"unknown base entry");
    return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+"/")):[[p,readFileSync(join(dir,e.name))]];
  }));
  const prior=walk(join(base,"admin"));
  const hashes=files=>Object.fromEntries(Object.entries(files).map(([k,v])=>[k,sha(v)]));
  assert.deepEqual(hashes(prior),sealed.admin);
  const file="pending-member-registration.js";
  assert.ok(!Object.hasOwn(prior,file));
  const script=readFileSync(new URL("./"+file,import.meta.url));
  const index=prior["index.html"].toString("utf8");
  const anchor="</body>";
  assert.equal(index.split(anchor).length,2);
  assert.ok(index.includes('id="addMemberButton"')&&index.includes("r4-zero-personal-issue.js"));
  const version=sha(script).slice(0,16), eol=index.includes("\r\n")?"\r\n":"\n";
  const next=Buffer.from(index.replace(anchor,`  <script src="./${file}?v=${version}"></script>${eol}</body>`));
  const output={...prior,"index.html":next,[file]:script};
  assert.deepEqual(Object.keys(output).filter(k=>!prior[k]||!output[k].equals(prior[k])).sort(),["index.html",file]);
  return {output,version,hashes:hashes(output)};
}
