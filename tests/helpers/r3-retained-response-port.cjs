// 현재 응답 기능만 exact 705 바이트로 역변환한다. 옛 golden/권한 검사는 그대로 둔다.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
const lf = text => text.replace(/\r\n/g, "\n");
const authorityHash = "459e0eaa024a5cc1464c8d2377517a1c6fe2e7747a0994442ec8651544ca8177";
function authority() {
  const text = lf(fs.readFileSync(path.join(root, "tests/fixtures/r3-retained-response-source-authority.json"), "utf8"));
  if (sha(text) !== authorityHash) throw Error("R3 retained response authority drift");
  const value = JSON.parse(text);
  if (value.publicBase !== "705b7312ab14bbfcd8c68b1ef78c041be643d5d2"
      || value.privateMain !== "be8c227b16603f3cf7de1ba4a4940bae425af07b"
      || value.privateTree !== "14b8cfb53fd9dd7c9b7d168ed0abd8f71bdecd9d"
      || value.files.length !== 20) throw Error("R3 retained response source binding drift");
  return value;
}
function restore(file, text, { strict = true } = {}) {
  const port = authority(), row = port.files.find(item => item.path === file);
  if (!row || !row.beforeBlob) return { applied: false, text };
  const source = lf(text), digest = sha(source);
  if (digest === row.beforeSha256) return { applied: false, text: source };
  if (digest !== row.afterSha256 && digest !== row.productSha256) {
    // 중간 역사적 계층은 자기 exact golden으로 검증한다. 현재 응답 marker는 항상 거부한다.
    if ((strict && source.includes(port.targetVersion)) || (row.productSha256 && (
      source.includes("submitCoachSettlementReconciliation")
      || source.includes("coachSettlementReconciliationForm")
      || source.includes("coach-settlement-reconciliation-form")
      || source.includes("월·횟수·정산액을 확인한 뒤 한 번만 응답")))) {
      throw Error("R3 retained response source stage drift: " + file);
    }
    return { applied: false, text };
  }
  const base = lf(execFileSync("git", ["show", port.publicBase + ":" + file],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  const blob = crypto.createHash("sha1").update("blob " + Buffer.byteLength(base, "utf8") + "\0").update(base).digest("hex");
  if (sha(base) !== row.beforeSha256 || blob !== row.beforeBlob) throw Error("R3 retained response baseline drift: " + file);
  let restored = digest === row.productSha256 ? source.replaceAll(port.baseVersion, port.targetVersion) : source;
  if (sha(restored) !== row.afterSha256) throw Error("R3 retained response release drift: " + file);
  for (const hunk of [...row.hunks].reverse()) {
    if (!hunk.after || restored.split(hunk.after).length !== 2) throw Error("R3 retained response inverse hunk drift: " + file);
    restored = restored.replace(hunk.after, () => hunk.before);
  }
  if (restored !== base) throw Error("R3 retained response exact inverse drift: " + file);
  return { applied: true, text: base, baseVersion: port.baseVersion };
}
module.exports = { authority, restore, sha };
