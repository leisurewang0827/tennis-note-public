import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// verify.sh 와 CI 워크플로가 같은 더미 환경변수로 빌드해야 한다.
// 어긋나면 로컬에서 통과한 것이 CI 에서 깨진다. 실제로 그런 적이 있다 —
// 상류가 CI 의 결제 설정을 multi + 계좌이체로 바꿨는데 verify.sh 는
// 옛 tosspay_only 로 남아, 배포본 검사가 로컬에서만 실패했다.

/** `: "${NAME:=값}"` 형태의 기본값을 모은다. */
function verifyShellDefaults() {
  const source = readFileSync(join(repoRoot, "scripts/verify.sh"), "utf8").replace(/\r\n?/g, "\n");
  const values = new Map();
  for (const match of source.matchAll(/^:\s*"\$\{(TENNISNOTE_[A-Z0-9_]+):=(.*)\}"$/gm)) {
    values.set(match[1], match[2]);
  }
  return values;
}

/** 워크플로 `env:` 블록의 TENNISNOTE_* 를 모은다. */
function workflowEnv() {
  const source = readFileSync(join(repoRoot, ".github/workflows/tennisnote-public-ci.yml"), "utf8").replace(/\r\n?/g, "\n");
  const values = new Map();
  for (const match of source.matchAll(/^\s+(TENNISNOTE_[A-Z0-9_]+):\s*(.+)$/gm)) {
    values.set(match[1], match[2].trim().replace(/^"(.*)"$/, "$1"));
  }
  return values;
}

test("verify.sh 와 CI 워크플로의 환경변수가 같다", () => {
  const local = verifyShellDefaults();
  const ci = workflowEnv();
  assert.ok(ci.size > 0, "CI 워크플로에서 TENNISNOTE_* 를 찾지 못했다");

  const problems = [];
  for (const [name, value] of ci) {
    if (!local.has(name)) problems.push(`${name} — CI 에만 있다. scripts/verify.sh 에 : "\${${name}:=${value}}" 를 더하고 export 목록에도 넣어라`);
    else if (local.get(name) !== value) problems.push(`${name} — verify.sh 는 "${local.get(name)}", CI 는 "${value}". CI 값에 맞춰라`);
  }
  for (const name of local.keys()) {
    if (!ci.has(name)) problems.push(`${name} — verify.sh 에만 있다. CI 워크플로 env: 에도 넣어라`);
  }
  assert.deepEqual(problems, [], "로컬과 CI 가 다른 설정으로 빌드하고 있다:\n  " + problems.join("\n  "));
});

test("verify.sh 가 기본값을 정한 변수를 모두 export 한다", () => {
  const source = readFileSync(join(repoRoot, "scripts/verify.sh"), "utf8").replace(/\r\n?/g, "\n");
  const exported = new Set();
  const exportBlock = /^export ((?:.|\\\n)*?)$/m.exec(source.replace(/\\\n\s*/g, " "));
  for (const name of (exportBlock?.[1] || "").split(/\s+/)) if (name) exported.add(name);

  const missing = [...verifyShellDefaults().keys()].filter((name) => !exported.has(name));
  assert.deepEqual(missing, [], "기본값만 정하고 export 하지 않으면 python3 자식 프로세스에 전달되지 않는다:\n  " + missing.join("\n  "));
});

test("연장 HOLD 브라우저 16조합은 verify/PR 경로에서 정확히 한 번 필수 실행된다", () => {
  const read = file => readFileSync(join(repoRoot,file),"utf8").replace(/\r\n/g,"\n");
  const verify=read("scripts/verify.sh"), workflow=read(".github/workflows/tennisnote-public-ci.yml");
  const runner=read("scripts/check_tennisnote_renewal_hold_browser.cjs");
  assert.equal((verify.match(/^node scripts\/check_tennisnote_renewal_hold_browser\.cjs$/gm)||[]).length,1);
  assert.match(verify,/set -euo pipefail/);
  assert.equal((workflow.match(/run: \.\/scripts\/verify\.sh/g)||[]).length,1);
  assert.equal((workflow.match(/- "scripts\/check_tennisnote_renewal_hold_browser\.cjs"/g)||[]).length,2);
  assert.equal((workflow.match(/- "scripts\/check_tennisnote_renewal_hold_member\.cjs"/g)||[]).length,2);
  assert(!/node scripts\/check_tennisnote_renewal_hold_browser/.test(workflow),"workflow에서 검사 중복 실행 금지");
  assert(workflow.indexOf("Prepare browser test dependencies")<workflow.indexOf("- name: Verify"));
  assert.match(workflow,/playwright@1\.62\.1/);
  assert.match(workflow,/- uses: actions\/checkout@v7\n\s+with:\n\s+fetch-depth: 0(?:\n|$)/,"exact base git show에 필요한 전체 이력 확보");
  assert.match(workflow,/install --with-deps chromium webkit/);
  assert.match(workflow,/NODE_PATH=\$RUNNER_TEMP\/tennisnote-browser\/node_modules/);
  assert.match(workflow,/timeout-minutes: 10/);
  assert.match(workflow,/- name: Verify\n\s+timeout-minutes: 4/);
  assert(!workflow.includes("continue-on-error"));
  assert.match(runner,/Object\.entries\(\{chromium,webkit\}\)/);
  assert.match(runner,/\[\[390,844\],\[844,390\]\]/);
  assert.match(runner,/\["light","dark"\]/);
  assert.match(runner,/\["tennis-note-member-app","admin"\]/);
  assert.match(runner,/assert\.equal\(combinations,16,/);
  assert.match(runner,/process\.exit\(124\);\},120000\)/);
});

test("alignment 검사 변경은 PR와 push 각각 한 번 경로 필터에 포함된다", () => {
  const workflow=readFileSync(join(repoRoot,".github/workflows/tennisnote-public-ci.yml"),"utf8").replace(/\r\n/g,"\n");
  const entry=/^      - "scripts\/check_tennisnote_dev_prod_alignment\.py"$/gm;
  for(const event of ["pull_request","push"]) {
    const block=new RegExp(`^  ${event}:\\n([\\s\\S]*?)(?=^  [a-z_]+:|^\\S)`,"m").exec(workflow)?.[1];
    assert.ok(block,`${event} 이벤트 필터 필요`);
    assert.equal((block.match(entry)||[]).length,1,`${event}: alignment 경로 exactly once`);
  }
  assert.equal((workflow.match(entry)||[]).length,2,"두 이벤트 합계 exactly two");
});

test("독립 profile 검사는 한 번 병렬 실행하고 모든 실패를 빌드 전에 전파한다", () => {
  const verify = readFileSync(join(repoRoot,"scripts/verify.sh"),"utf8").replace(/\r\n/g,"\n");
  const start = verify.indexOf('step "본인 번호 인증·저장');
  const end = verify.indexOf('step "배포본 빌드"', start);
  assert(start >= 0 && end > start);
  const block = verify.slice(start, end);
  assert.equal((block.match(/^node scripts\/check_tennisnote_verified_profile_phone_browser\.cjs &$/gm)||[]).length,1);
  assert.equal((block.match(/^wait "\$profile_pid"$/gm)||[]).length,1);
  assert(block.lastIndexOf('wait "$profile_pid"') > block.indexOf("node scripts/check_tennisnote_r3_effective_browser.cjs"));
  const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
  for (const failure of ["none", "profile", "alignment", "r3"]) {
    const fake = `set -euo pipefail
step() { :; }
node() {
  if [[ "$1" == *verified_profile* ]]; then
    echo PROFILE_ONCE
    sleep 0.1
    [[ "${failure}" != profile ]] || return 17
  elif [[ "$1" == *r3_effective* ]]; then
    [[ "${failure}" != r3 ]] || return 19
  fi
}
fake_python() { [[ "${failure}" != alignment ]] || return 18; }
PYTHON_BIN=fake_python
${block}
echo BUILD_REACHED
`;
    const result=spawnSync(bash,["-c",fake],{encoding:"utf8",timeout:5000});
    assert.ifError(result.error);
    assert.equal(result.status,failure === "none" ? 0 : {profile:17,alignment:18,r3:19}[failure]);
    assert.equal(result.stdout.includes("BUILD_REACHED"),failure === "none");
    if(failure === "none" || failure === "profile") assert.equal(result.stdout.split("PROFILE_ONCE").length-1,1);
  }
});
