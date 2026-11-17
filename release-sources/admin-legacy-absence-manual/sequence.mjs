// Release admission and ordering only. No credential access, network or production IO.
// The live adapter must supply authenticated GitHub/DB/Pages observations and one-use claims.
import { createHash } from "node:crypto";

const digest="295ae2fe04150c94509e9f8ea30c542d35d1ff7434589a839b056f49fc08b11f";
const recovery="484c4e49-dbc0-4807-89ea-0a1955f38710";
const fingerprint="3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a";
const verificationCommit="a63e1a315ce9902ff02d8c83c4fcd8478eef29fc";
const environment="tennisnote-r4-admin-production";
const repository="leisurewang0827/tennis-note-public";
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const commit=/^[a-f0-9]{40}$/;
export const pins=Object.freeze({digest,recovery,fingerprint,verificationCommit,environment,repository,project:"tennisnote-admin"});

export async function runProtected(plan,bundleBytes,io) {
  const writes={install:0,publish:0,off:0,rollback:0};
  const result=(status, extra={})=>({status,writes:{...writes},...extra});
  const validPlan=plan && commit.test(plan.releaseCommit) && plan.releaseCommit!==verificationCommit &&
    uuid.test(plan.operation) && Number.isSafeInteger(plan.runId) && plan.runId>0 && plan.attempt===1 &&
    ["release","close","recover"].includes(plan.intent) &&
    (plan.intent!=="recover" || (uuid.test(plan.publishedId) && plan.publishedId!==recovery &&
      uuid.test(plan.publishedOperation) && plan.publishedOperation!==plan.operation));
  if(!validPlan || !Buffer.isBuffer(bundleBytes) || createHash("sha256").update(bundleBytes).digest("hex")!==digest)
    return result("PACKAGE_OR_INTENT_MISMATCH");
  const doc=JSON.parse(bundleBytes);
  const observe=async(fn,...args)=>{try{return await fn?.(plan,...args)}catch{return null}};
  const isFresh=r=>Number.isSafeInteger(r?.observedAt) && r.observedAt<=Date.now() && Date.now()-r.observedAt<=20000;
  const tied=r=>r?.candidate===plan.releaseCommit && r?.operation===plan.operation && r?.bundle===digest;
  const db=async purpose=>{
    const r=await observe(io.readPrimary,purpose);
    return tied(r) && isFresh(r) && r.purpose===purpose && r.target===fingerprint && r.primary===true &&
      r.readOnly===true && r.separateConnection===true ? r : null;
  };
  const web=async purpose=>{
    const r=await observe(io.readAdmin,purpose);
    return tied(r) && isFresh(r) && r.purpose===purpose && r.project===pins.project && r.production===true &&
      r.recoveryId===recovery && r.recoveryBytes===true && uuid.test(r.canonicalId) ? r : null;
  };
  const off=r=>r?.state==="installed" && r.catalogExact===true && r.sql===doc.database.readback &&
    r.gate==="OFF" && r.effective===0 && r.stored===0;
  const base=r=>r?.canonicalId===recovery && r.canonicalBytes===true;
  const owned=(r, op)=>r?.canonicalId!==recovery && r?.releaseCommit===plan.releaseCommit && r?.publishedOperation===op;
  const ack=(r,action)=>tied(r) && r?.confirmed===true && r.action===action;
  const authorize=async action=>{
    const a=await observe(io.verifyGitHubApproval,action);
    return tied(a) && isFresh(a) && a.repository===repository && a.environment===environment && a.review==="approved" &&
      a.reviewRun===plan.runId && a.runAttempt===1 && a.protectedJob===true && a.action===action &&
      a.verificationCommit===verificationCommit && a.independentReview===true && a.concurrentPublisherExcluded===true;
  };
  const once=async (action, fn, detail)=>{
    if(writes[action]!==0 || !await authorize(action)) return null;
    // The adapter must persist this claim across runs; never substitute a per-process set.
    if(await observe(io.claimOnce,action)!==true) return null;
    writes[action]=1;
    return observe(fn,detail);
  };

  if(plan.intent==="release") {
    const before=await db("preinstall");
    if(before?.state!=="absent" || before.catalogExact!==true || !base(await web("preinstall")))
      return result("PREFLIGHT_MISMATCH_NO_WRITE");
    const installed=await once("install",io.installOnly,{sha:doc.database.install});
    if(writes.install===0) return result("INSTALL_NOT_ADMITTED");
    const post=await db("committed-install");
    if(!ack(installed,"install")) return result("INSTALL_ACK_UNKNOWN_NO_PUBLISH",{observedOff:off(post)});
    if(!off(post)) return result("OFF_NOT_CONFIRMED_NO_PUBLISH");
    if(!base(await web("prepublish")) || !off(await db("prepublish"))) return result("PUBLISH_PREFLIGHT_MOVED_DB_LEFT_OFF");
    const publication=await once("publish",io.publishAdminOnly,{files:doc.administrator});
    if(writes.publish===0) return result("PUBLISH_NOT_ADMITTED_DB_LEFT_OFF");
    const actual=await web("postpublish");
    const postDb=await db("postpublish");
    if(owned(actual,plan.operation) && actual.immutableBytes===true && actual.canonicalBytes===true && off(postDb))
      return result("ADMIN_PUBLISHED_DB_OFF_VERIFIED",{deployment:actual.canonicalId,acknowledged:ack(publication,"publish")});
    return result(owned(actual,plan.operation)?"OWN_PUBLICATION_NEEDS_SEPARATE_RECOVERY":"PUBLISH_UNKNOWN_NO_RETRY",
      {deployment:owned(actual,plan.operation)?actual.canonicalId:null,observedOff:off(postDb)});
  }

  const pre=await db("preclose");
  if(pre?.state!=="installed" || pre.catalogExact!==true) return result("CLOSE_WRONG_OR_UNKNOWN_INSTALL");
  const current=plan.intent==="recover"?await web("prerecovery"):null;
  if(plan.intent==="recover" && (!owned(current,plan.publishedOperation) || current.canonicalId!==plan.publishedId))
    return result("FOREIGN_OR_MOVED_PUBLICATION_NO_ROLLBACK");
  const close=await once("off",io.closeFeatureOnly,{sha:doc.database.off});
  if(writes.off===0) return result("CLOSE_NOT_ADMITTED");
  if(!off(await db("committed-close"))) return result("OFF_UNCONFIRMED_NO_ROLLBACK");
  if(plan.intent==="close") return result("OFF_AND_ZERO_VERIFIED",{acknowledged:ack(close,"off")});
  const same=await web("before-rollback");
  if(!owned(same,plan.publishedOperation) || same.canonicalId!==plan.publishedId || !off(await db("before-rollback")))
    return result("RECOVERY_TARGET_MOVED_NO_ROLLBACK");
  const rollback=await once("rollback",io.rollbackAdminOnly,{from:plan.publishedId,to:recovery});
  if(writes.rollback===0) return result("ROLLBACK_NOT_ADMITTED_DB_LEFT_OFF");
  if(!base(await web("postrollback")) || !off(await db("postrollback"))) return result("ROLLBACK_UNCONFIRMED_NO_RETRY");
  return result("ADMIN_RESTORED_DB_LEFT_OFF_VERIFIED",{acknowledged:ack(rollback,"rollback")});
}
