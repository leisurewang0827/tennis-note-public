// 새 게시 응답 분기만 검사. 운영 URL/DB/인증/결제/게시 호출 없음.
import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {createServer} from "node:http";
import {join} from "node:path";
import {once} from "node:events";
import {createPostreadPlan, classifyPostread, memberRedirectRule, memberRedirectTarget} from "./postread-policy.mjs";
const sha = x => createHash("sha256").update(x).digest("hex");
function fixture() {
  const files = {"_headers": sha("headers"), "_redirects": sha(memberRedirectRule), "_worker.js": sha("worker")};
  const bodies = {};
  for (let i = 0; i < 40; i++) files["tennis-note-member-app/assets/item" + i + ".png"] = sha("unserved legacy " + i);
  for (let i = 0; i < 139; i++) {
    const p = i === 0 ? "index.html" : "admin/asset" + i + ".js";
    bodies[p] = Buffer.from("synthetic admin asset " + i); files[p] = sha(bodies[p]);
  }
  const seal = {files, prior: {...files}};
  return {seal, bodies, plan: createPostreadPlan(seal, Buffer.from(memberRedirectRule))};
}
test("정확한 40개 경로만 302와 고정 목적지로 통과하며 본문을 읽지 않는다", async () => {
  const {plan} = fixture();
  for (const path of plan.redirects) {
    const response = {status: 302, headers: new Headers({location: memberRedirectTarget}),
      arrayBuffer() {throw Error("redirect body must not be read");}};
    assert.equal(await classifyPostread(plan, path, response), "redirect");
  }
});
test("다른 호스트 경로 쿼리 스킴 표기 등 목적지 변형은 거부한다", async () => {
  const {plan} = fixture(), path = plan.redirects[0];
  for (const location of ["https://example.com/", "https://tennisnote-app.pages.dev/extra",
    "https://tennisnote-app.pages.dev/?token=not-a-real-secret", "http://tennisnote-app.pages.dev/",
    "//tennisnote-app.pages.dev/", "https://tennisnote-app.pages.dev", "https://tennisnote-app.pages.dev:443/"]) {
    await assert.rejects(classifyPostread(plan, path, new Response(null, {status: 302, headers: {location}})), /POSTREAD_REDIRECT_TARGET/);
  }
});
test("40개 경로도 상태가 302가 아니거나 Location이 없으면 실패한다", async () => {
  const {plan} = fixture(), path = plan.redirects[0];
  for (const status of [200, 301, 303, 307, 308, 401, 403, 404, 500]) {
    await assert.rejects(classifyPostread(plan, path, new Response(null, {status, headers: {location: memberRedirectTarget}})), /POSTREAD_REDIRECT_STATUS/);
  }
  await assert.rejects(classifyPostread(plan, path, new Response(null, {status: 302})), /POSTREAD_REDIRECT_TARGET/);
});
test("관리자 파일의 이동과 알 수 없는 본문은 새 예외로 통과하지 못한다", async () => {
  const {plan} = fixture(), path = "index.html";
  await assert.rejects(classifyPostread(plan, path, new Response(null, {status: 302, headers: {location: memberRedirectTarget}})), /POSTREAD_HTTP_302/);
  await assert.rejects(classifyPostread(plan, path, new Response("unrecognized")), /UNRECOGNIZED_ASSET/);
  await assert.rejects(classifyPostread(plan, "tennis-note-member-app/assets/UNSEALED.png", new Response(null, {status: 302})), /POSTREAD_UNSEALED_PATH/);
});
test("리디렉션 설정의 바이트 지문 또는 경로 집합이 바뀌면 검사 전 중단한다", () => {
  const {seal} = fixture();
  assert.throws(() => createPostreadPlan(seal, Buffer.from(memberRedirectRule + "# unexpected")), /POSTREAD_REDIRECT_RULE_CHANGED/);
  assert.throws(() => createPostreadPlan({...seal, files: {...seal.files, "_redirects": "bad"}}, Buffer.from(memberRedirectRule)), /POSTREAD_REDIRECT_SEAL_MISMATCH/);
  assert.throws(() => createPostreadPlan({...seal, prior: {...seal.prior, "_redirects": "bad"}}, Buffer.from(memberRedirectRule)), /POSTREAD_REDIRECT_BASELINE_CHANGED/);
  const fewer = {...seal.files}; delete fewer[Object.keys(fewer).find(p => p.startsWith("tennis-note-member-app/assets/"))];
  assert.throws(() => createPostreadPlan({...seal, files: fewer}, Buffer.from(memberRedirectRule)), /POSTREAD_PATH_SET_CHANGED/);
  const disguised = {...seal.files};
  const first = Object.keys(disguised).find(p => p.startsWith("tennis-note-member-app/assets/"));
  disguised[first.replace("/assets/", "/assets-else/")] = disguised[first]; delete disguised[first];
  assert.throws(() => createPostreadPlan({...seal, files: disguised}, Buffer.from(memberRedirectRule)), /POSTREAD_REDIRECT_SET_CHANGED/);
});
test("실제 readAfter 연결이 loopback 응답 139본문과 40이동을 두 주소 모두 구분한다", async () => {
  const f = fixture(); let requests = 0;
  const server = createServer((req, res) => {
    assert.equal(req.method, "GET"); requests++;
    const p = req.url === "/" ? "index.html" : req.url.slice(1);
    if (f.plan.redirects.includes(p)) {res.writeHead(302, {location: memberRedirectTarget}); res.end("not an admin asset");}
    else if (f.bodies[p]) {res.writeHead(200); res.end(f.bodies[p]);}
    else {res.writeHead(404); res.end();}
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    const source = readFileSync(new URL("./runner.mjs", import.meta.url), "utf8");
    const start = source.indexOf("async function readAfter("), end = source.indexOf("async function offReceipt(", start);
    assert(start >= 0 && end > start);
    const block = source.slice(start, end).trim();
    let canonicalReads = 0;
    const current = {id: "12345678-1234-1234-1234-123456789abc"};
    const fakeFetch = async (url, options) => {
      assert.equal(options.redirect, "manual", "정상 302를 fetch 단계에서 오류로 만들면 안 됨");
      assert.equal(options.method, "GET");
      const target = new URL(url);
      assert(["12345678.tennisnote-admin.pages.dev", "tennisnote-admin.pages.dev"].includes(target.hostname));
      return fetch(origin + target.pathname, options);
    };
    const read = new Function("assert", "hash", "createPostreadPlan", "classifyPostread", "readFileSync", "join", "e", "fetch", "project", "deployment", "return (" + block + ")")(
      assert, sha, createPostreadPlan, classifyPostread,
      p => {assert(String(p).endsWith("_redirects")); return Buffer.from(memberRedirectRule);}, join,
      {RUNNER_TEMP: "/synthetic", GITHUB_SHA: "a".repeat(40)}, fakeFetch,
      async () => {canonicalReads++; return {canonical_deployment: current};}, () => {});
    const result = await read(current, f.seal);
    assert.equal(result.responses, 358);
    assert.equal(result.staticResponses, 278);
    assert.equal(result.redirectResponses, 80);
    assert.equal(requests, 358);
    assert.equal(canonicalReads, 0, "이번 새 분기는 기존 재시도 흐름을 불필요하게 실행하지 않는다");
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});

