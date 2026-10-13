/* Exact P1 context-repair inverse before the immutable substitute layer. */
const crypto = require("node:crypto");
const manifest = require("../fixtures/r3-substitute-source-parity.json");
const seal = require("../fixtures/r3-substitute-context-source-parity.json");

const file = seal.path;
const prior = manifest.files.find((entry) => entry.path === file);
const repairedSha256 = seal.repairedCandidateSha256;
const sha = (source) => crypto.createHash("sha256").update(source).digest("hex");

function restoreLayer(filePath, source) {
  let text = source.replace(/\r\n/g, "\n");
  const entry = seal.layerBoundaryRepair.files.find((item) => item.path === filePath);
  if (!entry) return text;
  if (sha(text) === entry.priorCandidateSha256) return text;
  if (filePath === file && sha(text) === seal.priorCandidateSha256) return text;
  if (sha(text) !== entry.candidateSha256) throw Error("R3 data-layer candidate drift: " + filePath);
  if (filePath === "app/admin/data/billing.js") {
    const start = text.indexOf("\nasync function requestR3SubstituteDecisionPreview(");
    const end = text.indexOf("\nasync function refreshEffectiveSettlementPreview(", start);
    if (start < 0 || end < 0 || text.indexOf("\nasync function requestR3SubstituteDecisionPreview(", start + 1) >= 0) {
      throw Error("R3 data-layer boundary drift: " + filePath);
    }
    text = text.slice(0, start) + text.slice(end);
  } else {
    const replacements = [
      ["    const value = await requestR3SubstituteDecisionPreview(context, candidate, assignmentId);",
        "    const value = await context.client.rpc(\"tn_admin_preview_substitute_policy_decision\", {\n      target_branch_id: candidate.branchId, target_assignment_id: assignmentId,\n    });"],
      ["    const result = await requestR3SubstituteDecisionConfirmation(context, decision, recipient, operationKey);",
        "    const result = await context.client.rpc(\"tn_admin_confirm_substitute_policy_decision\", {\n      target_branch_id: decision.branchId, target_assignment_id: decision.assignmentId,\n      expected_lesson_revision: decision.lessonRevision, expected_source_fingerprint: decision.sourceFingerprint,\n      target_chosen_recipient: recipient,\n      target_operation_key: operationKey,\n    });"],
    ];
    for (const [after, before] of replacements) {
      if (text.split(after).length !== 2) throw Error("R3 data-layer inverse boundary drift: " + filePath);
      text = text.replace(after, before);
    }
  }
  if (sha(text) !== entry.priorCandidateSha256) throw Error("R3 data-layer inverse drift: " + filePath);
  return text;
}

function restore(filePath, source) {
  let text = restoreLayer(filePath, source);
  if (filePath !== file) return text;
  if (!prior || prior.candidateSha256 !== seal.priorCandidateSha256) {
    throw Error("R3 context repair prior seal drift: " + filePath);
  }
  if (sha(text) === prior.candidateSha256) return text;
  if (sha(text) !== repairedSha256) throw Error("R3 context repair candidate drift: " + filePath);
  const start = text.indexOf("const r3SubstituteDecisionUi = ");
  const next = text.indexOf("function renderEffectiveSettlementPreview()", start);
  if (start < 0 || next < 0 || text.indexOf("const r3SubstituteDecisionUi = ", start + 1) >= 0) {
    throw Error("R3 context repair boundary drift: " + filePath);
  }
  text = text.slice(0, start) + prior.hunks[0].after + text.slice(next - 1);
  const repairedReset = 'preview: null, context: null, recipient: "", operationKey: "", message: ""';
  const priorReset = 'preview: null, recipient: "", operationKey: "", message: ""';
  if (text.split(repairedReset).length !== 2) throw Error("R3 context repair reset drift: " + filePath);
  text = text.replace(repairedReset, priorReset);
  if (sha(text) !== prior.candidateSha256) throw Error("R3 context repair inverse drift: " + filePath);
  return text;
}

module.exports = { file, repairedSha256, restore, restoreLayer };
