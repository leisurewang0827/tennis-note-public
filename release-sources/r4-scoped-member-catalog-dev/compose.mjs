import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const once = (source, from, to) => {
  assert.equal(source.split(from).length, 2, "ANCHOR_DRIFT");
  return source.replace(from, () => to);
};
export function compose({files, sealBytes, policy, moduleBytes = readFileSync(new URL("./module.js", import.meta.url))}) {
  assert.equal(hash(sealBytes), policy.baseSealSha256, "BASE_SEAL_DRIFT");
  const base = JSON.parse(sealBytes);
  assert.equal(base.source, policy.baseSource);
  assert.equal(base.privateCommit, policy.privateCommit);
  assert.equal(Object.keys(base.admin).length, 177);
  assert.deepEqual(Object.fromEntries(Object.entries(files).map(([k, b]) => [k, hash(b)])), base.admin);
  assert.equal(hash(moduleBytes), policy.delta["r4-scoped-member-catalog.js"]);
  assert.ok(!Object.hasOwn(files, "r4-scoped-member-catalog.js"));
  const settings = files["views/settings.js"].toString("utf8");
  const anchor = '  window.TennisNoteR4Onboarding?.refresh?.({';
  const view = once(settings, anchor, [
    '  void window.TennisNoteR4ScopedMemberCatalog?.refresh?.({',
    '    allowed: !adminLocalPreviewMode && workspaceSignedIn && !restoringSession && role === "member"',
    '      && window.TennisNoteR4ExistingAccount?.isWorkspaceMode?.() === true,',
    '    client: window.TennisNoteDataClient,',
    '  });',
    anchor,
  ].join(settings.includes("\r\n") ? "\r\n" : "\n"));
  const index = files["index.html"].toString("utf8");
  const scripts = [
    '<script src="./r4-scoped-member-catalog.js?v=' + hash(moduleBytes).slice(0, 16) + '"></script>',
    '    <script src="./views/settings.js?v=' + hash(view).slice(0, 16) + '"></script>',
  ].join(index.includes("\r\n") ? "\r\n" : "\n");
  const delta = {
    "index.html": Buffer.from(once(index, '<script src="./views/settings.js?v=r4-marketplace-010b4a3834ac"></script>', scripts)),
    "views/settings.js": Buffer.from(view),
    "r4-scoped-member-catalog.js": moduleBytes,
  };
  const hashes = Object.fromEntries(Object.entries(delta).map(([k, b]) => [k, hash(b)]));
  assert.deepEqual(hashes, policy.delta, "REVIEWED_DELTA_DRIFT");
  const result = {...files, ...delta};
  assert.equal(Object.keys(result).length, 178);
  return {files: result, changed: Object.keys(delta).sort(), hashes: {...base.admin, ...hashes}};
}
