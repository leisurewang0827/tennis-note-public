import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
