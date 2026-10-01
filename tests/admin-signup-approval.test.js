import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sha = text => createHash("sha256").update(text).digest("hex");
const manifest = JSON.parse(read("docs/admin-signup-approval-source-parity-20261001.json"));
const actions = read("app/admin/actions/member.js");
const helper = actions.match(/async function submitSignupLinkApproval\(form, member\) \{[\s\S]*?\n\}/)[0];

test("approval helper is byte-equivalent to the verified private authority", () => {
  assert.equal(sha(helper), manifest.helperSha256);
});

// 승인 이식 부분만 역으로 제거해 공개 전용 회원/결제/등록 코드 보존을 검증한다.
function withoutApproval(path, source) {
  if (path.endsWith("/app.js")) return source.replace(/  signupLinkRequests: \[\],\n  signupLinkReviewBusy: false,\n  signupLinkReviewOperations: \{\},\n/, "");
  if (path.includes("/data/")) return source
    .replace(/    const selectedBranch = activeOperationBranchId\(\);[\s\S]*?    memberManagementModalState.signupLinkRequests = Array.isArray\(pending\?\.requests\) \? pending.requests : \[\];\n/, "")
    .replace("    memberManagementModalState.signupLinkRequests = [];\n", "");
  if (path.includes("/ui/")) return source.replace("    signupLinkRequests: [],\n", "");
  if (path.includes("/views/")) return source
    .replace('((memberManagementModalState.signupLinkRequests || []).length ? "선택한 요청 처리" : memberAuthConnection(member).linked', '(memberAuthConnection(member).linked')
    .replace(/    const pendingRequests = memberManagementModalState.signupLinkRequests \|\| \[\];[\s\S]*?\n    \}\n(?=  \} else if \(isCreate\))/, "");
  return source.replace(helper + "\n\n", "")
    .replace(/  if \(action === "app_link" && form.elements.signupLinkRequest\) \{\n    await submitSignupLinkApproval\(form, member\);\n    return;\n  \}\n/, "");
}

for (const row of manifest.products) {
  test(`only approved hunks changed: ${row.path}`, () => {
    const source = read(row.path);
    assert.equal(sha(source), row.candidateSha256);
    assert.equal(sha(withoutApproval(row.path, source)), row.baseSha256);
    assert.ok(read("app/admin/index.html").includes(row.path.replace("app/admin/", "")));
  });
}

test("approval controls escape request text and retain a single primary action", () => {
  const views = read("app/admin/views/members.js");
  const block = views.match(/const pendingRequests =[\s\S]*?\n  \} else if \(isCreate\)/)[0];
  assert.match(block, /escapeHtml\(request.id\)/);
  assert.match(block, /escapeHtml\(request.sourceName/);
  assert.match(block, /name="signupLinkBranchConfirmed" required/);
  assert.doesNotMatch(block, /<button|onclick=|fetch\(/);
});

test("approval transport cannot fall through to login replacement or financial writes", () => {
  assert.match(actions, /await submitSignupLinkApproval\(form, member\);\n    return;/);
  assert.equal((helper.match(/\.rpc\(/g) || []).length, 1);
  assert.match(helper, /"tn_admin_review_signup_link"/);
  assert.doesNotMatch(helper, /tn_admin_replace_member_login|insert|updateRows|service_role|payment|ticket/i);
});

test("readback, privilege, exact scope and payload-bound retry contract", () => {
  for (const token of ['operationsRole() !== "admin"', 'request.branchId !== branch',
    'request.targetUserId !== member.serverUserId', 'request.status !== "pending"',
    'Number.isInteger(request.revision)', 'signupLinkReviewBusy', 'JSON.stringify(payload)',
    'signupLinkReviewOperations[signature]', 'approval_readback_failed',
    'await loadMemberLinkCandidates(member)', 'await refreshMemberAuthManagement(member)']) assert.ok(helper.includes(token), token);
});

test("44px correction is limited to signup approval buttons, preserving other CSS", () => {
  const css = read("app/admin/styles.css");
  const marker = "\n/* 가입 연결 승인 폼에서만 터치 영역과 처리 중 상태를 보장한다. */";
  const offset = css.indexOf(marker);
  assert.ok(offset > 0);
  assert.equal(sha(css), manifest.accessibilityCorrection.candidateSha256);
  assert.equal(sha(css.slice(0, offset)), manifest.accessibilityCorrection.baseSha256);
  const patch = css.slice(offset);
  assert.equal((patch.match(/#memberManagementForm:has\(\[name="signupLinkRequest"\]\) \.modal-actions > button/g) || []).length, 2);
  assert.match(patch, /min-height: 44px;/);
  assert.match(patch, /button:disabled/);
  assert.doesNotMatch(patch, /!important|payment|billing|\.primary-button\s*\{/);
});
