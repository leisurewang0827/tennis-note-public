/* Exact P1 context-repair inverse before the immutable substitute layer. */
const crypto = require("node:crypto");
const manifest = require("../fixtures/r3-substitute-source-parity.json");
const seal = require("../fixtures/r3-substitute-context-source-parity.json");

const file = seal.path;
const prior = manifest.files.find((entry) => entry.path === file);
const repairedSha256 = seal.repairedCandidateSha256;
const sha = (source) => crypto.createHash("sha256").update(source).digest("hex");

function restore(filePath, source) {
  if (filePath !== file) return source;
  let text = source.replace(/\r\n/g, "\n");
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

module.exports = { file, repairedSha256, restore };
