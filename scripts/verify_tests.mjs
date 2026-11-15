// 현재 기능 검사와 과거 배포 원본 재현을 모두 실행합니다. 어느 한쪽 실패도 숨기지 않습니다.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import routing from "../tests/helpers/verification-routing.cjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
const replay = "scripts/check_historical_contracts.py";
const historical = JSON.parse(execFileSync(python, ["-B", replay, "--list"], { cwd: root, encoding: "utf8" }));
const files = fs.readdirSync(path.join(root, "tests"), { recursive: true })
  .filter(file => file.endsWith(".test.js")).map(file => `tests/${file.replaceAll("\\", "/")}`).sort();
if (new Set(historical).size !== historical.length || historical.some(file => !files.includes(file))) {
  throw new Error("과거 검사 등록 경로 누락 또는 중복");
}
const current = files.filter(file => !historical.includes(file));
routing.verifySelectedRouting(fs.readFileSync(path.join(root, "tests/r3-production-selected.test.js"), "utf8"));
console.log(`CURRENT WORKTREE: ${current.length} test files; HISTORICAL REPLAY: ${historical.length} test files`);
const now = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...current], { cwd: root, stdio: "inherit" });
const selectedCurrent = spawnSync(process.execPath, ["--test", "--test-reporter=spec",
  `--test-name-pattern=${routing.currentPattern}`, "tests/r3-production-selected.test.js"], { cwd: root, stdio: "inherit" });
const past = spawnSync(python, ["-B", replay], { cwd: root, stdio: "inherit" });
process.exitCode = now.status === 0 && selectedCurrent.status === 0 && past.status === 0 ? 0 : 1;
