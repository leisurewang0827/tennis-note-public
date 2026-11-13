// Public-safe evidence formatter; no database client, credential, or query.
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
export const pins=Object.freeze({
 projectFingerprint:'3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a',
 installReviewRun:43394957796,installReviewCommit:'264bf337ee12562d7f10f2f753db4eef295c4db8',
 installSqlSha:'227d180fad783a241670cc9de9a4d220dc8b09810d96508ae60c9f0a02b56949',
 readSqlSha:'646ecf371c0fb1cf3747cbf3fbd769ceec276730f069b0e90495d9190402c16e',
 sourceSha:'680f7d481121801a83972811bee41496e392aaf4',sourceRun:43391633723,artifactId:14021410409,
 artifactDigest:'sha256:e3cedb9135f1f5703a81f65ee96e43d59953596678e649b5b449c333c5d4b6a6',
 recoveryId:'80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4',recoverySource:'81046af5ff14184585533f1a72b22f29a0298050',
});
const zero=['termActive','paidActive','historyActive','paidReceipts','termReceipts','gateRows'];
const yes=['pilotOff','rlsAndTableAcl','rpcAcl','writerPinned','readerPinned','postimagesPinned'];
const need=(x,c)=>{if(!x)throw Error(c);};
export function packageProof(rows,publishCommit,publishRun,now=Date.now()){
 need(typeof publishCommit==='string'&&/^[a-f0-9]{40}$/.test(publishCommit)&&![pins.sourceSha,pins.installReviewCommit,pins.recoverySource].includes(publishCommit)&&Number.isSafeInteger(publishRun)&&publishRun>0&&![pins.sourceRun,pins.installReviewRun].includes(publishRun),'PUBLISH_TARGET_INVALID');
 const proof=rows?.[0]?.proof;need(Array.isArray(rows)&&rows.length===1&&proof?.kind==='R4_FINANCE_COMMITTED_OFF_DB_READ_V1','OFF_PROOF_MISSING');
 const keys=['kind','dbObservedAt',...zero,...yes];need(Object.keys(proof).length===keys.length&&keys.every(k=>Object.hasOwn(proof,k))&&zero.every(k=>proof[k]===0)&&yes.every(k=>proof[k]===true),'OFF_CONDITIONS_NOT_MET');
 const stamp=proof.dbObservedAt,observed=Date.parse(stamp);need(typeof stamp==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp)&&Number.isFinite(observed)&&observed>0&&now-observed>=-30000&&now-observed<=120000,'OFF_PROOF_STALE');
 const evidence={kind:'R4_FINANCE_MANUAL_OFF_OBSERVATION_V1',...pins,publishCommit,publishRun,proof:Object.fromEntries(keys.map(k=>[k,proof[k]])),deployAuthorized:false};
 return {evidence,digest:sha(JSON.stringify(evidence))};
}
