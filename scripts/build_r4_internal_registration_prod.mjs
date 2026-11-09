// Source-only production administrator artifact; this command cannot deploy.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from "node:fs";
import {join,dirname} from "node:path";
import {execFileSync} from "node:child_process";
import {compose} from "../release-sources/r4-internal-registration-prod/production-overlay.mjs";
const hash=b=>createHash("sha256").update(b).digest("hex"),read=p=>readFileSync(p);
const parent="7ecba95a6c6304563ee0b919a57b56de5366ccce",sha=process.env.GITHUB_SHA;
const allowed=[".github/workflows/r4-internal-registration-prod-source.yml","release-sources/r4-internal-registration-prod/production-host.js","release-sources/r4-internal-registration-prod/production-overlay.mjs","scripts/build_r4_internal_registration_prod.mjs","scripts/check_r4_internal_registration_prod.mjs","scripts/check_r4_internal_registration_prod_browser.mjs"].sort();
assert.equal(process.env.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");
assert.equal(process.env.GITHUB_REF,"refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108");
assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");
assert.match(sha||"",/^[a-f0-9]{40}$/);
const git=(...a)=>execFileSync("git",a,{encoding:"utf8"}).trim();
assert.equal(git("rev-list","--parents","-n","1",sha),`${sha} ${parent}`,"SOURCE_PARENT_DRIFT");
assert.deepEqual(git("diff","--name-only",parent,sha).split("\n").filter(Boolean).sort(),allowed,"SOURCE_SCOPE_DRIFT");
const walk=(dir,prefix="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>{
  assert.ok(!e.isSymbolicLink());return e.isDirectory()?Object.entries(walk(join(dir,e.name),prefix+e.name+"/")):[[prefix+e.name,read(join(dir,e.name))]];
}));
const base="prod-base",files=walk(join(base,"admin"));
const {delta,token}=compose({files,sealBytes:read(join(base,"seal.json")),
  draftSource:read("release-sources/r4-product-draft-dev/r4-product-draft-candidate.js"),
  registrationSource:read("release-sources/r4-internal-registration-dev/registration-ui.js"),
  hostSource:read("release-sources/r4-internal-registration-prod/production-host.js"),
  cssSource:read("release-sources/r4-product-draft-style-dev/candidate.css")});
const all={...files,...delta};assert.equal(Object.keys(all).length,172,"ADMIN_ASSET_COUNT_DRIFT");
mkdirSync("prod-internal-release/admin",{recursive:true});
for(const [name,bytes] of Object.entries(all)) {const path=join("prod-internal-release/admin",name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes,{flag:"wx"});}
const seal={schema:1,source:sha,baseArtifactId:13604763261,baseArtifactDigest:"57a903df37a97e7ef5ab45eacbde7b3fa066a5172b8b78ee260afdf5d5ae4271",baseSealSha256:"f16bf186f6d0d196f7d0a238f74863908dfb0904ee5fac201b947a834fb3ee20",installSqlSha256:"f76086eea58d4aa0e87a53d370e2c298f485b8500b69ed47249415c4be441ac3",verifySqlSha256:"6869e4f4f09c3289737dc90e29f014b6f25a2ef331e9182bf9f10144f1ddafc0",token,admin:Object.fromEntries(Object.entries(all).map(([k,v])=>[k,hash(v)]))};
writeFileSync("prod-internal-release/seal.json",JSON.stringify(seal)+"\n",{flag:"wx"});
console.log(JSON.stringify({status:"PROD_ADMIN_SOURCE_ONLY_PASS",baseline:168,result:172,changed:Object.keys(delta).sort()}));
