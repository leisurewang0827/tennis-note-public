import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const once = (source, from, to) => {
  assert.equal(source.split(from).length, 2, "ANCHOR_DRIFT");
  return source.replace(from, () => to);
};
export function compose({files, sealBytes, policy, moduleBytes = readFileSync(new URL("./module.js", import.meta.url))}) {
  assert.equal(hash(sealBytes), policy.prior.seal, "BASE_SEAL_DRIFT");
  const base = JSON.parse(sealBytes);

  assert.equal(Object.keys(base.admin).length, 174);
  assert.deepEqual(Object.fromEntries(Object.entries(files).map(([k, b]) => [k, hash(b)])), base.admin);

  assert.ok(!Object.hasOwn(files, "r4-scoped-member-catalog.js"));
  const settings = files["views/settings.js"].toString("utf8");
  const anchor = '  window.TennisNoteR4Onboarding?.refresh?.({';
  const view = once(settings, anchor, [
    '  void window.TennisNoteR4ScopedMemberCatalog?.refresh?.({',
    '    allowed: !adminLocalPreviewMode && workspaceSignedIn && !restoringSession && role === "member"',
    '      && window.TennisNoteR4ExistingAccount?.isWorkspaceMode?.({ role }) === true,',
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
    "index.html": Buffer.from(once(index, '<script src="./views/settings.js?v=r4-prod-modules-d40a0cf0752e"></script>', scripts)),
    "views/settings.js": Buffer.from(view),
    "r4-scoped-member-catalog.js": moduleBytes,
  };
  const hashes = Object.fromEntries(Object.entries(delta).map(([k, b]) => [k, hash(b)]));

  const result = {...files, ...delta};
  assert.equal(Object.keys(result).length, 175);
  return {files: result, changed: Object.keys(delta).sort(), hashes: {...base.admin, ...hashes}};
}
