// 게시 확인 전용. 회원앱 이동을 따라가지 않고 봉인된 이동 규칙과 직접 서빙 파일을 구분한다.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export const memberRedirectRule = "/tennis-note-member-app/* https://tennisnote-app.pages.dev/ 302\n";
export const memberRedirectTarget = "https://tennisnote-app.pages.dev/";
export function createPostreadPlan(seal, redirectBytes) {
  assert.equal(Buffer.from(redirectBytes).toString("utf8").replaceAll("\r\n", "\n"), memberRedirectRule, "POSTREAD_REDIRECT_RULE_CHANGED");
  assert.equal(sha(redirectBytes), seal.files["_redirects"], "POSTREAD_REDIRECT_SEAL_MISMATCH");
  assert.equal(seal.prior["_redirects"], seal.files["_redirects"], "POSTREAD_REDIRECT_BASELINE_CHANGED");
  const paths = Object.keys(seal.files).filter(p => !["_headers", "_redirects", "_worker.js"].includes(p));
  const redirects = paths.filter(p => p.startsWith("tennis-note-member-app/assets/"));
  assert.equal(paths.length, 181, "POSTREAD_PATH_SET_CHANGED");
  assert.equal(redirects.length, 40, "POSTREAD_REDIRECT_SET_CHANGED");
  return Object.freeze({
    paths: Object.freeze(paths),
    redirects: Object.freeze(redirects),
    files: Object.freeze({...seal.files}),
    prior: Object.freeze({...seal.prior}),
  });
}
export async function classifyPostread(plan, path, response) {
  assert.ok(plan.paths.includes(path), "POSTREAD_UNSEALED_PATH");
  if (plan.redirects.includes(path)) {
    if (response.status !== 302) throw Error("POSTREAD_REDIRECT_STATUS " + path);
    if (response.headers.get("location") !== memberRedirectTarget) throw Error("POSTREAD_REDIRECT_TARGET " + path);
    return "redirect";
  }
  if (response.status === 200) {
    const digest = sha(Buffer.from(await response.arrayBuffer()));
    if (digest === plan.files[path]) return "static";
    if (digest === plan.prior[path]) return "retry";
    throw Error("UNRECOGNIZED_ASSET " + path);
  }
  if (response.status === 404) return "retry";
  throw Error("POSTREAD_HTTP_" + response.status + " " + path);
}

