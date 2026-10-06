import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
test("AUTH-04/07 PAY-02/07: private source body parity and actual modular entry", () => {
  const manifest = JSON.parse(readFileSync(new URL("./fixtures/purchase-identity-source-parity.json", import.meta.url)));
  const entry = readFileSync(root + "app/admin/index.html", "utf8");
  for (const { name, file, sha256 } of manifest.functions) {
    const source = readFileSync(root + file, "utf8").replace(/\r\n/g, "\n");
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    const body = source.slice(start, source.indexOf("\n}\n", start) + 2);
    assert.equal(createHash("sha256").update(body).digest("hex"), sha256, name);
    assert.ok(entry.includes(file.replace("app/admin/", "")), file);
  }
  const domain = readFileSync(root + "app/admin/domain/members.js", "utf8");
  for (const code of ["confirmation_cancelled", "client_update_required|proof_required", "legacy_operation_review_required"]) {
    assert.ok(domain.includes("purchase_identity_" + (code.includes("|") ? "(" + code + ")" : code)));
  }
});

test("AUTH-07 PAY-02: exact selection, confirmation, duplicate, draft and protected onsite fixtures", () => {
  const result = spawnSync(process.execPath, ["scripts/check_tennisnote_purchase_identity_confirmation.cjs"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).checks, 40);
});

test("NFR-04 BRANCH-03: approved CSS hunk parity and fail-closed inverse guard", () => {
  const manifest = JSON.parse(readFileSync(new URL("./fixtures/purchase-identity-source-parity.json", import.meta.url)));
  assert.equal(manifest.styleHunks.length, 1);
  const style = manifest.styleHunks[0];
  assert.equal(style.file, "app/admin/styles.css");
  assert.equal(style.privateSourcePath, "90-Dashboard/tennis-note-prototype/styles.css");
  assert.equal(style.sha256, "baf321bf2607ad9f223ec39162e254f92e04d23391053963bf9b230be7e6af25");
  assert.equal(createHash("sha256").update(style.text).digest("hex"), style.sha256);
  const css = readFileSync(root + style.file, "utf8").replace(/\r\n/g, "\n");
  assert.equal(css.split(style.text).length - 1, 1);
  // 실제 alignment 함수를 인메모리 변형으로 검증한다. 파일/기준 해시를 바꾸지 않는다.
  const code = `
import json, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
m = json.loads((a.ROOT/'tests/fixtures/purchase-identity-source-parity.json').read_text(encoding='utf-8'))
baseline = json.loads(a.MANIFEST_PATH.read_text(encoding='utf-8'))
style = m['styleHunks'][0]
path, block = style['file'], style['text']
css = (a.ROOT/path).read_text(encoding='utf-8')
restore = lambda value: a.restore_purchase_identity_source(path, value, m)
hash_of = lambda value: a.sha256(a.normalize_product_bytes(path, value.encode('utf-8'), baseline))
expected = baseline['product_tree']['normalized_sha256_by_path'][path]
assert hash_of(restore(a.restore_excel_retry_base(path, css))) == expected
for changed in (css.replace(block, block.replace('44px', '40px')), css.replace(block, ''), css.replace(block, block+block)):
    try:
        restore(changed)
    except RuntimeError:
        pass
    else:
        raise AssertionError('style drift accepted')
assert hash_of(restore(css + 'body { opacity: .5; }')) != expected
bad = json.loads(json.dumps(m))
bad['styleHunks'][0]['sha256'] = '0'*64
try:
    a.restore_purchase_identity_source(path, css, bad)
except RuntimeError:
    pass
else:
    raise AssertionError('style hash drift accepted')
print('CSS_INVERSE_GUARD_PASS=6')
`;
  const result = spawnSync(process.env.TENNISNOTE_TEST_PYTHON || "python", ["-B", "-c", code], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "CSS_INVERSE_GUARD_PASS=6");
});
