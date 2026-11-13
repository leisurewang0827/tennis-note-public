// Read-only decision: the second protected job must not accept a caller's mismatch flag.
import { createHash } from 'node:crypto';
import { expected, assertRecovery } from './protected-finance-admission.mjs';
import { canonicalId, route } from './finance-postread.mjs';

const recoverySource='81046af5ff14184585533f1a72b22f29a0298050';
const recoveryIndex='66fb7b87c4a9984e85b462968b1682329a177bf41062656737885f659f7d1ef0';
const digest=x=>createHash('sha256').update(x).digest('hex');
const need=(ok,code)=>{if(!ok)throw Error(code);};

export async function verifyRollbackPreimage({publishedId,asset,sealBytes,project,recovery,readPublic,readProject}) {
  need(digest(sealBytes)===expected.seal,'ROLLBACK_ASSET_SEAL_DRIFT');
  return compareRollbackPreimage({publishedId,asset,assets:JSON.parse(sealBytes).assets,project,recovery,readPublic,readProject});
}

// Pure I/O adapter for isolated assertions; no caller-supplied result is write authority.
export async function compareRollbackPreimage({publishedId,asset,assets,project,recovery,readPublic,readProject}) {
  need(canonicalId(project)===publishedId,'ROLLBACK_NOT_CURRENT');
  assertRecovery({...project,result:{...project.result,canonical_deployment:recovery?.result}},recovery,recoverySource);
  need(typeof asset==='string' && !asset.startsWith('tennis-note-member-app/') && Object.hasOwn(assets,asset) &&
    /^[a-f0-9]{64}$/.test(assets[asset]),'ROLLBACK_ASSET_NOT_SEALED');
  const path=route(asset);
  need(path!==null,'ROLLBACK_ASSET_NOT_PUBLIC');
  const candidate=`https://${publishedId.slice(0,8)}.tennisnote-admin.pages.dev${path}`;
  const baseline='https://80f7c05f.tennisnote-admin.pages.dev/';
  const [wrong,base]=await Promise.all([readPublic(candidate),readPublic(baseline)]);
  need(wrong.status===200 && base.status===200,'ROLLBACK_READ_UNCONFIRMED');
  need(digest(Buffer.from(await wrong.arrayBuffer()))!==assets[asset],'ROLLBACK_MISMATCH_NOT_CONFIRMED');
  need(digest(Buffer.from(await base.arrayBuffer()))===recoveryIndex,'ROLLBACK_BASELINE_BYTES_DRIFT');
  need(canonicalId(await readProject())===publishedId,'ROLLBACK_NOT_CURRENT');
  return Object.freeze({preimageVerified:true,publishedId,restoreId:expected.recovery,asset,writeAuthorized:false});
}
