import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {checkDeclaration} from "./r4_product_draft_dev_promote.mjs";
const policy={privateCommit:"1".repeat(40),privateSourceSha256:{assembledSql:"2".repeat(64)}};
const good={schema:1,privateCommit:policy.privateCommit,targetFingerprint:"63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba",
  assembledSqlSha256:policy.privateSourceSha256.assembledSql,dbGateOffConfirmed:true,
  sourceRunId:1,artifactId:2,artifactDigest:"4".repeat(64),sealSha256:"5".repeat(64)};
good.dbReceipt={targetFingerprint:good.targetFingerprint,assembledSqlSha256:good.assembledSqlSha256,gateOff:true,temporaryLeaseCount:0,productionWrites:0};
good.dbReceiptSha256=createHash("sha256").update(JSON.stringify(good.dbReceipt)).digest("hex");
checkDeclaration(policy,good);
for(const mutate of [p=>p.privateCommit=null,p=>p.targetFingerprint="wrong",p=>p.assembledSqlSha256="0".repeat(64),
  p=>p.dbGateOffConfirmed=false,p=>p.dbReceiptSha256=null,p=>p.sourceRunId="1",p=>p.artifactDigest=null,p=>p.sealSha256=null,
  p=>p.dbReceipt.gateOff=false,p=>p.dbReceipt.temporaryLeaseCount=1]) {
  const copy=structuredClone(good);mutate(copy);assert.throws(()=>checkDeclaration(policy,copy));
}
console.log("PASS: promotion declaration rejects ten unbound/wrong/off-missing fields; no remote access");
