// New source/target delta only; synthetic data and local sealed baseline.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {compose,walk,validateTarget,validateBaseArtifact} from './r4_general_dev_source.mjs';
const base=process.env.R4_GENERAL_BASE;assert.ok(base,'BASE_REQUIRED');
const p=JSON.parse(readFileSync('release-sources/r4-general-dev/policy.json'));
const files=walk(join(base,'admin')),sealBytes=readFileSync(join(base,'seal.json')),module=readFileSync('release-sources/r4-general-dev/general-ui.js');
if(process.env.R4_GENERAL_CONFIG_ONLY==='1') {
  const d={id:p.canonicalId,latest_stage:{status:'success'},deployment_trigger:{metadata:{branch:p.branchName,commit_hash:p.baseSource}}};
  const state={project:{name:p.project,production_branch:p.branchName,canonical_deployment:d},recovery:d,indexBytes:files['index.html'],immutableBytes:files['index.html'],configBytes:files['shared/config.local.js'],immutableConfigBytes:files['shared/config.local.js'],releaseBytes:files['release.json'],immutableReleaseBytes:files['release.json']};
  assert.equal(validateTarget(state,p).canonicalId,p.canonicalId);
  for(const key of ['configBytes','immutableConfigBytes','releaseBytes','immutableReleaseBytes']) {
    assert.throws(()=>validateTarget({...state,[key]:Buffer.from('wrong environment')},p));
    assert.throws(()=>validateTarget({...state,[key]:undefined},p));
  }
  assert.throws(()=>validateTarget(state,{...p,targetFingerprint:'wrong'}));
  console.log('PASS: live/immutable config, DEV fingerprint and release mismatch/missing fail closed');process.exit(0);
}
const {all,changes}=compose({files,sealBytes,module,policy:p});assert.deepEqual(changes,['index.html','r4-general-dev.js']);assert.equal(Object.keys(all).length,172);
assert.match(all['shared/config.local.js'].toString(),/63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba/);
assert.throws(()=>compose({files:{...files,'index.html':Buffer.from('drift')},sealBytes,module,policy:p}));
assert.throws(()=>compose({files,sealBytes,module:Buffer.from('drift'),policy:p}));
const deploy={id:p.canonicalId,latest_stage:{status:'success'},deployment_trigger:{metadata:{branch:p.branchName,commit_hash:p.baseSource}}};
const state={project:{name:p.project,production_branch:p.branchName,canonical_deployment:deploy},recovery:deploy,indexBytes:files['index.html'],immutableBytes:files['index.html'],configBytes:files['shared/config.local.js'],immutableConfigBytes:files['shared/config.local.js'],releaseBytes:files['release.json'],immutableReleaseBytes:files['release.json']};
assert.equal(validateTarget(state,p).canonicalId,p.canonicalId);
assert.throws(()=>validateTarget({...state,project:{...state.project,name:'tennisnote-app-dev'}},p));
assert.throws(()=>validateTarget({...state,recovery:{...deploy,id:'other'}},p));
assert.throws(()=>validateTarget({...state,immutableBytes:Buffer.from('drift')},p));
const artifact={id:p.baseArtifactId,workflow_run:{id:p.baseRun},name:p.baseArtifactName,digest:`sha256:${p.baseArtifactDigest}`,expired:false,expires_at:'2099-01-01T00:00:00Z'};
validateBaseArtifact(artifact,p);assert.throws(()=>validateBaseArtifact({...artifact,expired:true},p));
console.log('PASS: DEV admin baseline171→172; exactly index+module; target/recovery/artifact drift fails closed');
