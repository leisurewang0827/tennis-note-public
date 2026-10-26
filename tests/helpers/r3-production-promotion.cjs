"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { restoreSuccessor } = require("./r3-basic-refresh-production.cjs");
const selected = require("./r3-production-selected.cjs");

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/r3-production-promotion.json"), "utf8"));
const BASE = contract.base;
const files = contract.files.map(row => [row.path, row.baseSha256, row.candidateSha256]);
const normalize = value => value.replace(/\r\n/g, "\n");
const sha256 = value => crypto.createHash("sha256").update(normalize(value)).digest("hex");

function changedAppPaths(base = BASE, cwd = process.cwd()) {
  const tracked = execFileSync("git", ["diff", "--name-only", base, "--", "app"], { cwd, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "app"], { cwd, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  if (base === BASE) {
    if (fs.realpathSync(cwd)!==fs.realpathSync(path.resolve(__dirname,"../.."))) throw Error("R3 historical fixed checkout mismatch");
    return selected.restoreHistoricalAppPaths([...tracked,...untracked],restoreSuccessor);
  }
  // 별도 합성 Git 저장소의 일반 관측 계약은 유지한다. 고정 운영base에는 위 검증이 필수다.
  return [...new Set([...tracked, ...untracked])].sort();
}

function restoreBeforeR3(file, text, cwd = process.cwd()) {
  text = restoreSuccessor(file, text);
  const row = files.find(item => item[0] === file);
  if (!row) return normalize(text);
  const normalized = normalize(text);
  if (sha256(normalized) !== row[2]) throw new Error(`R3 promotion exact candidate mismatch: ${file}`);
  if (row[1] === null) return "";
  const baseText = normalize(execFileSync("git", ["show", `${BASE}:${file}`], { cwd, encoding: "utf8", maxBuffer: 8e6 }));
  if (sha256(baseText) !== row[1]) throw new Error(`R3 promotion exact base mismatch: ${file}`);
  return baseText;
}

const removedR3Paths = files.filter(([, baseSha256]) => baseSha256 === null).map(([file]) => file);
module.exports = { BASE, files, removedR3Paths, normalize, sha256, changedAppPaths, restoreBeforeR3, restoreSuccessor };
