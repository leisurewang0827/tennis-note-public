// Orchestration contract for isolated QA. Live I/O requires a separately pinned workflow entry.
import { expected, assertRecovery } from './protected-finance-admission.mjs';
import { canonicalId, route } from './finance-postread.mjs';
import { createHash } from 'node:crypto';
import { pins } from './observe-production-off-for-publish.mjs';
const recoverySource=pins.recoverySource;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const need=(ok,code)=>{if(!ok)throw Error(code);};
const sha=x=>createHash('sha256').update(x).digest('hex');
const hold=(status,id)=>({status,...(id?{id}:{}),retryAllowed:false});

// Rollback requires a specific byte mismatch independently observed on the new immutable URL.
export async function confirmImmutableMismatch({id, asset, expectedHash, fetchBytes, sealedAssets}) {
  if(!uuid.test(id??'') || !Object.hasOwn(sealedAssets,asset) || sealedAssets[asset]!==expectedHash ||
    asset.startsWith('tennis-note-member-app/')) return false;
  const path=route(asset);
  if(!path)return false;
  const r=await fetchBytes(`https://${id.slice(0,8)}.tennisnote-admin.pages.dev${path}`);
  return r.status===200 && sha(Buffer.from(await r.arrayBuffer()))!==expectedHash;
}

export async function sequenceProtectedAdmin(io) {
  const prepared=await io.verifySealedArtifact();
  need(prepared?.sha===expected.source && prepared.seal===expected.seal,'ARTIFACT_NOT_CONFIRMED');
  need((await io.queue()).ready===true,'PUBLISH_QUEUE_BUSY');
  const pre=await io.readPreimage();
  assertRecovery(pre.project,pre.recovery,recoverySource);
  const official=await io.officialReview();
  // This is an explicitly accepted operator attestation, not direct runner DB proof.
  const now=io.now(), age=now-Date.parse(official?.observedAt);
  need(official?.reviewMatched===true && official.provenance==='github-required-reviewer-attestation' &&
    official.deployAuthorized===false && Number.isFinite(age) && age>=0 && age<=120000,'OFF_REVIEW_UNCONFIRMED');
  await io.claimPublish();
  if(io.now()-Date.parse(official.observedAt)>120000)throw Error('OFF_REVIEW_EXPIRED_BEFORE_WRITE');
  let result;
  try { result=await io.publishOnce(); } catch { result=null; }
  const observed=await io.readCanonical().catch(()=>null);
  if(result?.status!=='POST_RETURNED_READBACK_REQUIRED')return hold('PUBLISH_UNKNOWN_NO_RETRY');
  let id;
  try { id=canonicalId(observed); } catch { return hold('CANONICAL_UNVERIFIED_NO_RETRY'); }
  if(result.url!==`https://${id.slice(0,8)}.tennisnote-admin.pages.dev`)return hold('PUBLISH_ID_UNVERIFIED_NO_RETRY');
  let after;
  try { after=await io.verifyPublished(id,result,observed); } catch { return hold('READBACK_UNVERIFIED_NO_RETRY',id); }
  if(after?.status==='PUBLISHED_ASSETS_VERIFIED' && after.id===id)return hold('PUBLISHED_ASSETS_VERIFIED',id);
  if(after?.status!=='IMMUTABLE_MISMATCH' || after.id!==id)return hold('READBACK_UNVERIFIED_NO_RETRY',id);
  // Rollback also has a distinct authorization and fresh canonical/recovery check.
  if(!(await io.rollbackAuthorized({id,recovery:expected.recovery,asset:after.asset}).catch(()=>false)))
    return hold('ROLLBACK_AUTHORITY_MISSING_NO_RETRY',id);
  const rb=await io.readRecoveryForRollback().catch(()=>null);
  try {
    need(canonicalId(rb?.project)===id,'ROLLBACK_CURRENT_DRIFT');
    const withBaseline={...rb.project,result:{...rb.project.result,canonical_deployment:rb.recovery?.result}};
    assertRecovery(withBaseline,rb.recovery,recoverySource);
    need(await confirmImmutableMismatch({id,asset:after.asset,expectedHash:after.expectedHash,
      fetchBytes:io.fetchBytes,sealedAssets:prepared.assets}),'ROLLBACK_MISMATCH_UNCONFIRMED');
  } catch {return hold('ROLLBACK_PRECONDITIONS_UNCONFIRMED_NO_RETRY',id);}
  await io.claimRollback();
  const rollbackAck=await io.rollbackOnce(expected.recovery).catch(()=>null);
  const final=await io.readPreimage().catch(()=>null);
  try { assertRecovery(final?.project,final?.recovery,recoverySource); }
  catch { return hold('ROLLBACK_UNCONFIRMED_NO_RETRY',id); }
  if(!(await io.verifyRecoveryAssets().catch(()=>false)))return hold('ROLLBACK_ASSETS_UNCONFIRMED_NO_RETRY',id);
  return hold(rollbackAck===true?'ROLLED_BACK_TO_VERIFIED_BASELINE':'RECOVERY_STATE_VERIFIED_ACK_UNKNOWN_NO_RETRY',id);
}
