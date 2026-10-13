// 승인 전화번호 증분만 exact 후보/역변환 해시로 분리하고 기존 golden은 보존한다.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/verified-profile-phone-source-parity.json"), "utf8"));
const operationStatusManifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/profile-operation-status-source-parity.json"), "utf8"));
const durableReadbackManifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/profile-durable-readback-source-parity.json"), "utf8"));
const editorDraftManifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/profile-editor-draft-source-parity.json"), "utf8"));
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
function restoreSessionLoss(file, text) {
  const contract = manifest.sessionLoss;
  assert.equal(contract?.contract, "auth-session-loss-fail-closed/1", "session-loss contract missing");
  const row = contract.files.find(item => item.path === file);
  if (!row) return text;
  text = text.replace(/\r\n/g, "\n");
  assert.equal(sha(text), row.afterFileSha256, `Auth session loss candidate drift: ${file}`);
  for (const fn of [...row.functions].reverse()) {
    assert.equal(sha(fn.after), fn.afterSha256, `session-loss after pin drift: ${fn.name}`);
    assert.equal(sha(fn.before), fn.beforeSha256, `session-loss before pin drift: ${fn.name}`);
    assert.equal(text.split(fn.after).length, 2, `session-loss inverse drift: ${fn.name}`);
    text = text.replace(fn.after, () => fn.before);
  }
  assert.equal(sha(text), row.beforeFileSha256, `session-loss baseline drift: ${file}`);
  return text;
}
function restoreAuthReconciliation(file, text) {
  text = restoreSessionLoss(file, text);
  const row = manifest.authReconciliation.files.find(item => item.path === file);
  if (!row) return text;
  text = text.replace(/\r\n/g, "\n");
  assert.equal(sha(text), row.afterFileSha256, `Auth candidate drift: ${file}`);
  for (const fn of [...row.functions].reverse()) {
    assert.equal(sha(fn.after), fn.afterSha256, `Auth function pin drift: ${fn.name}`);
    assert.equal(sha(fn.before), fn.beforeSha256, `Auth inverse pin drift: ${fn.name}`);
    const needle = fn.before ? fn.after : `\n\n${fn.after}\n`;
    const replacement = fn.before || "\n";
    assert.equal(text.split(needle).length, 2, `Auth exact inverse: ${file}/${fn.name}`);
    text = text.replace(needle, () => replacement);
  }
  assert.equal(sha(text), row.beforeFileSha256, `Auth baseline drift: ${file}`);
  return text;
}
function restoreEditorDraft(file, text, inputVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version) {
  const row = editorDraftManifest.files.find(item => item.path === file);
  if (!row) return text;
  text = text.replace(/\r\n/g, "\n").replaceAll(inputVersion, editorDraftManifest.publicVersion);
  assert.equal(sha(text), row.candidateSha256, `phone candidate drift (profile editor): ${file}`);
  for (const hunk of [...row.hunks].reverse()) {
    assert(hunk.after && text.split(hunk.after).length === 2, `profile editor inverse drift: ${file}`);
    text = text.replace(hunk.after, () => hunk.before);
  }
  assert.equal(sha(text), row.baseSha256, `profile editor baseline drift: ${file}`);
  return text.replaceAll(editorDraftManifest.publicVersion, inputVersion);
}
function restoreDurableReadback(file, text, inputVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version) {
  text = restoreEditorDraft(file, text, inputVersion);
  const row = durableReadbackManifest.files.find(item => item.path === file);
  if (!row) return text;
  text = text.replace(/\r\n/g, "\n").replaceAll(inputVersion, durableReadbackManifest.publicVersion);
  assert.equal(sha(text), row.candidateSha256, `phone candidate drift (durable readback): ${file}`);
  for (const hunk of [...row.hunks].reverse()) {
    assert(hunk.after && text.split(hunk.after).length === 2, `durable readback inverse drift: ${file}`);
    text = text.replace(hunk.after, () => hunk.before);
  }
  assert.equal(sha(text), row.baseSha256, `durable readback baseline drift: ${file}`);
  return text.replaceAll(durableReadbackManifest.publicVersion, inputVersion);
}
function restoreOperationStatus(file, text, inputVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version) {
  text = restoreAuthReconciliation(file, text);
  text = restoreDurableReadback(file, text, inputVersion);
  const row = operationStatusManifest.files.find(item => item.path === file);
  if (!row) return text;
  text = text.replaceAll(inputVersion, operationStatusManifest.publicVersion);
  assert.equal(sha(text), row.candidateSha256, `phone candidate drift (operation status): ${file}`);
  for (const hunk of [...row.hunks].reverse()) {
    assert(hunk.after && text.split(hunk.after).length === 2, `operation status inverse drift: ${file}`);
    text = text.replace(hunk.after, () => hunk.before);
  }
  assert.equal(sha(text), row.baseSha256, `operation status baseline drift: ${file}`);
  return text.replaceAll(operationStatusManifest.publicVersion, inputVersion);
}
function restorePhone(file, text, inputVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version) {
  // 기존 저장 계약을 바꾸지 않고 최신 안내 수정만 먼저 정확히 역변환합니다.
  text = restoreOperationStatus(file, text, inputVersion);
  const row = manifest.files.find(item => item.path === file);
  if (!row) return text;
  text = text.replaceAll(inputVersion, manifest.publicVersion);
  assert.equal(sha(text), row.candidateSha256, `phone candidate drift: ${file}`);
  for (const hunk of [...row.hunks].reverse()) {
    assert(hunk.after, `empty phone hunk: ${file}`);
    assert.equal(text.split(hunk.after).length, 2, `exact phone hunk: ${file}`);
    text = text.replace(hunk.after, () => hunk.before);
  }
  assert.equal(sha(text), row.baseSha256, `phone base drift: ${file}`);
  return text.replaceAll(manifest.publicVersion, inputVersion);
}
module.exports = { restorePhone, restoreOperationStatus, restoreDurableReadback, restoreEditorDraft,
  restoreAuthReconciliation, restoreSessionLoss, editorDraftManifest, durableReadbackManifest, operationStatusManifest, manifest };
