import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync(new URL("../fixtures/purchase-identity-source-parity.json", import.meta.url)));

// 이번 identity hunk만 역변환한다. 기존 승인/조회 golden hash는 변경하지 않는다.
export function withoutPurchaseIdentity(path, source) {
  for (const { before, after } of manifest.inverseHunks[path] || []) {
    assert.equal(source.split(after).length - 1, 1, `identity hunk exact occurrence: ${path}`);
    source = source.replace(after, before);
  }
  return source;
}
