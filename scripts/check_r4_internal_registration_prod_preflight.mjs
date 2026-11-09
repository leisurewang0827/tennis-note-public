// Synthetic-only tests of production admin/recovery admission; no network calls.
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {validate,validateSourceRuns,validateSourceArtifact} from "./r4_internal_registration_prod_preflight.mjs";
if(process.env.R4_PROD_SOURCE_BIND_ONLY) {
  const source="a".repeat(40),run={id:101,head_sha:source,event:"push",conclusion:"success",run_attempt:1};
  const artifact={id:102,name:"r4-internal-registration-prod-source-101",expired:false,digest:"sha256:"+"b".repeat(64)};
  assert.equal(validateSourceRuns({workflow_runs:[run]},source).id,101);
  assert.equal(validateSourceArtifact({artifacts:[artifact]},run).id,102);
  assert.throws(()=>validateSourceRuns({workflow_runs:[run,run]},source));
  assert.throws(()=>validateSourceRuns({workflow_runs:[{...run,conclusion:"failure"}]},source));
  assert.throws(()=>validateSourceArtifact({artifacts:[{...artifact,expired:true}]},run));
  console.log("PASS: exact successful source run and artifact binding; duplicates/failed/expired denied");
  process.exit(0);
}
const base=process.env.R4_PROD_BASE;assert.ok(base);
const walk=(dir,p="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+"/")):[[p+e.name,readFileSync(join(dir,e.name))]]));
const admin=walk(join(base,"admin")),source="cc38b03df566c6b3d297e77a00e61757935c4a45",id="cfb8595d-dc30-4d50-88a5-fb611aa2dcd0";
const d={id,latest_stage:{status:"success"},deployment_trigger:{metadata:{branch:"main",commit_hash:source}}};
const input={project:{name:"tennisnote-admin",production_branch:"main",canonical_deployment:d},recovery:d,
  run:{id:42449225848,head_sha:source,conclusion:"success",run_attempt:1},
  artifact:{id:13604763261,workflow_run:{id:42449225848},expired:false,expires_at:"2099-01-01T00:00:00Z",digest:"sha256:57a903df37a97e7ef5ab45eacbde7b3fa066a5172b8b78ee260afdf5d5ae4271"},
  sealBytes:readFileSync(join(base,"seal.json")),admin,indexBytes:admin["index.html"],immutableBytes:admin["index.html"],now:Date.now()};
assert.equal(validate(input).status,"PROD_ADMIN_GET_ONLY_PREFLIGHT_PASS");
for(const bad of [
  {...input,project:{...input.project,name:"tennisnote-app"}},
  {...input,project:{...input.project,canonical_deployment:{...d,id:"other"}}},
  {...input,recovery:{...d,latest_stage:{status:"failed"}}},
  {...input,artifact:{...input.artifact,expired:true}},
  {...input,artifact:{...input.artifact,expires_at:"2000-01-01T00:00:00Z"}},
  {...input,immutableBytes:Buffer.from("drift")},
  {...input,indexBytes:Buffer.from("drift")},
  {...input,run:{...input.run,run_attempt:2}},
]) assert.throws(()=>validate(bad));
console.log("PASS: production canonical, recovery, artifact expiry and baseline drift fail closed (synthetic)");
