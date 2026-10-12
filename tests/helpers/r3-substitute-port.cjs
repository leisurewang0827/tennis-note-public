/* Exact additive R3 layer inverse; historical goldens remain immutable. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const contextPort = require("./r3-substitute-context-port.cjs");
const nonPayableSeal = require("../fixtures/r3-substitute-context-source-parity.json").nonPayableTrace;
const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/r3-substitute-source-parity.json"), "utf8"));
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");

function restoreNonPayable(file, source) {
  const entry = nonPayableSeal.files.find((item) => item.path === file);
  if (!entry) return source;
  let text = source.replace(/\r\n/g, "\n");
  if (sha(text) === entry.priorCandidateSha256) return text;
  if (sha(text) !== entry.candidateSha256) throw Error("R3 nonpayable candidate drift: " + file);
  const replaceOnce = (before, after) => {
    if (text.split(before).length !== 2) throw Error("R3 nonpayable inverse boundary drift: " + file);
    text = text.replace(before, after);
  };
  if (file === "app/shared/tennisnote-settlement-adjustment.js") {
    const start = text.indexOf("        const excludedLesson = policyV2 && components.nonPayableDecision === true;");
    const end = text.indexOf("        if (components.duplicateSharedTime === true || excludedLesson) {", start);
    if (start < 0 || end < start || text.indexOf("        const excludedLesson =", start + 1) >= 0) {
      throw Error("R3 nonpayable inverse boundary drift: " + file);
    }
    text = text.slice(0, start) + "        if (components.duplicateSharedTime === true) {" + text.slice(end + "        if (components.duplicateSharedTime === true || excludedLesson) {".length);
    replaceOnce("          if (excludedLesson) source.nonPayable = true;", "          if (policyV2 && components.nonPayableDecision === true) source.nonPayable = true;");
    replaceOnce("        const ticket = ticketById.get(line.sourceTicketId);\n        const session = policyV2 ? (value.sourceManifest.sessions || []).find((item) => item.id === line.sourceSessionId) : null;",
      "        const ticket = ticketById.get(line.sourceTicketId);");
    replaceOnce("          const exact = (value.sourceManifest.assignments || []).filter((item) => item.id === line.sourceSubstituteAssignmentId);",
      "          const exact = (value.sourceManifest.assignments || []).filter((item) => item.id === line.sourceSubstituteAssignmentId);\n          const session = policyV2 ? (value.sourceManifest.sessions || []).find((item) => item.id === line.sourceSessionId) : null;");
    replaceOnce("                ? (line.calculationComponents?.nonPayableReason === \"recipient_original_coach\"\n                  || (line.calculationComponents?.nonPayableReason == null && session?.substitutePolicy === \"originalCoach\"))\n                  ? \"대타 · 원코치 귀속 · 0원 근거\"\n                  : \"대타 · 지급 제외 · 0원 근거\"",
      "                ? \"대타 · 지급 없음 또는 원코치 귀속 근거\"");
  } else if (file === "app/tennis-note-coach-app/views/settlement.js") {
    replaceOnce("    const excluded = components.nonPayableDecision === true;\n    const basis = excluded || components.duplicateSharedTime === true ? \"\"",
      "    const basis = components.duplicateSharedTime === true ? \"\"");
    replaceOnce("    const progress = excluded\n      ? `${components.nonPayableReason === \"recipient_original_coach\" ? \"실제 진행 수업\" : \"대타 배정 근거\"} · 정산 반영 0분`\n      : Number.isSafeInteger(row.settledMinutes) && row.settledMinutes > 0",
      "    const progress = Number.isSafeInteger(row.settledMinutes) && row.settledMinutes > 0");
    replaceOnce("    const exclusion = excluded\n      ? components.nonPayableReason === \"recipient_original_coach\" ? \"원코치 귀속 · 대타 코치 지급 제외\"\n        : components.nonPayableReason === \"explicit_no_settlement\" ? \"명시적 정산 없음\" : \"지급 제외 근거\"\n      : components.duplicateSharedTime === true ? \"시간·정산 중복 제외\"",
      "    const exclusion = components.duplicateSharedTime === true ? \"시간·정산 중복 제외\"");
  }
  if (sha(text) !== entry.priorCandidateSha256) throw Error("R3 nonpayable inverse hash drift: " + file);
  return text;
}

function restore(file, source) {
  const variants = manifest.files.filter((item) => item.path === file);
  if (!variants.length) return source;
  let text = contextPort.restore(file, restoreNonPayable(file, source.replace(/\r\n/g, "\n")));
  const entry = variants.find((item) => item.candidateSha256 === sha(text));
  if (!entry) throw Error("R3 substitute candidate drift: " + file);
  for (const hunk of [...entry.hunks].reverse()) {
    const chars = Array.from(text);
    if (chars.slice(hunk.start, hunk.end).join("") !== hunk.after) {
      throw Error("R3 substitute inverse hunk drift: " + file);
    }
    text = chars.slice(0, hunk.start).join("") + hunk.before + chars.slice(hunk.end).join("");
  }
  if (sha(text) !== entry.baseSha256) throw Error("R3 substitute baseline drift: " + file);
  return text;
}

module.exports = { root, manifest, sha, restore, restoreContext: contextPort.restore, restoreNonPayable };
