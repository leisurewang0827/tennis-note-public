import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// AGENTS.md 와 docs/ 는 코딩 에이전트가 읽는 문서다.
// 링크가 깨지면 엉뚱한 곳으로 가거나 그냥 못 읽고 지나간다.
// 파일 이름이나 제목을 바꿀 때 링크를 같이 못 고치는 일이 잦으므로 검사한다.

/** 깃허브가 만드는 앵커와 같은 규칙으로 제목을 슬러그로 바꾼다. */
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*]/g, "")
    .replace(/[^\w\s가-힣·-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function docFiles() {
  const files = ["AGENTS.md", "CLAUDE.md"];
  for (const name of readdirSync(join(repoRoot, "docs"))) {
    if (name.endsWith(".md")) files.push(join("docs", name));
  }
  return files.map((path) => ({ path, source: readFileSync(join(repoRoot, path), "utf8") }));
}

test("문서 사이의 링크가 실제 파일을 가리킨다", () => {
  const missing = [];
  for (const file of docFiles()) {
    for (const match of file.source.matchAll(/\[[^\]]+\]\(([^)#]*)(?:#[^)]*)?\)/g)) {
      const target = match[1];
      if (!target || /^https?:/.test(target)) continue;
      const full = resolve(repoRoot, dirname(file.path), target);
      if (!existsSync(full)) missing.push(`${file.path} → ${target}`);
    }
  }
  assert.deepEqual(missing, [], "가리키는 파일이 없습니다:\n  " + missing.join("\n  "));
});

test("문서 사이의 앵커가 실제 제목을 가리킨다", () => {
  const headings = new Map();
  for (const file of docFiles()) {
    headings.set(
      file.path.replace(/^docs\//, ""),
      new Set([...file.source.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1]))),
    );
  }
  const broken = [];
  for (const file of docFiles()) {
    for (const match of file.source.matchAll(/\[[^\]]+\]\(([^)#]*)#([^)]+)\)/g)) {
      const [, target, anchor] = match;
      if (/^https?:/.test(target)) continue;
      const key = (target || file.path).replace(/^.*\//, "");
      const known = headings.get(key);
      if (!known) continue; // 파일 존재는 위 검사가 본다
      if (!known.has(anchor)) broken.push(`${file.path} → ${key}#${anchor}`);
    }
  }
  assert.deepEqual(broken, [], "그런 제목이 없습니다:\n  " + broken.join("\n  "));
});

test("CLAUDE.md 는 규칙을 직접 적지 않고 AGENTS.md 를 가리킨다", () => {
  // 두 파일에 같은 규칙을 두면 반드시 어긋난다. 실제로 그래서 합쳤다.
  const source = readFileSync(join(repoRoot, "CLAUDE.md"), "utf8");
  assert.ok(source.includes("AGENTS.md"), "AGENTS.md 를 가리켜야 합니다");
  const lines = source.split("\n").filter((line) => line.trim()).length;
  assert.ok(lines <= 20, `CLAUDE.md 가 ${lines}줄입니다. 규칙은 AGENTS.md 와 docs/ 에 적으세요.`);
});

test("AGENTS.md 가 docs/ 의 모든 문서를 안내한다", () => {
  // 문서를 새로 만들고 안내에 안 넣으면 아무도 읽지 않는다.
  const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");
  const orphans = readdirSync(join(repoRoot, "docs"))
    .filter((name) => name.endsWith(".md"))
    .filter((name) => !agents.includes(`docs/${name}`));
  assert.deepEqual(orphans, [], "AGENTS.md 에서 가리키지 않는 문서:\n  " + orphans.join("\n  "));
});
