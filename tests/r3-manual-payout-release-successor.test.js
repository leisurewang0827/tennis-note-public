import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import renewalPort from "./helpers/renewal-hold-port.cjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.TENNISNOTE_PYTHON || "python";
const sourceAuthority = JSON.parse(readFileSync(path.join(root, "tests/fixtures/r3-manual-payout-port-source-authority.json"), "utf8"));
const stack = sourceAuthority.releaseSuccessor;
const gitText = (revision, file) => execFileSync("git", ["show", `${revision}:${file}`], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");

function runPython(source) {
  return execFileSync(python, ["-B", "-c", source], { cwd: root, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
}

test("R3 payout 1.0.554 stack inverses exactly to the 1.0.552 source before older contracts", () => {
  const output = runPython(`
import hashlib, json, subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=a._load_r3_manual_payout_release_authority()
assert port['baseCommit']=='636bdb571dab9d67e18725cd101f0fbe452d69d7'
assert port['featureCommit']=='758feca68b3dcc7df89652c0dda03176e1c2dc16'
assert port['candidateCommit']=='1b1a73ce73ea2998ed91b54d52aa312d6a2d47f6'
assert len(port['featurePaths'])==9 and len(port['releasePaths'])==13
assert len(a.R3_MANUAL_PAYOUT_EXPECTED_PATHS)==21
assert len(a.R3_MANUAL_PAYOUT_SOURCE_PATHS)==19
for path in sorted(a.R3_MANUAL_PAYOUT_SOURCE_PATHS):
    candidate=subprocess.check_output(['git','show',port['candidateCommit']+':'+path]).decode('utf-8').replace('\\r\\n','\\n')
    base=subprocess.check_output(['git','show',port['baseCommit']+':'+path]).decode('utf-8').replace('\\r\\n','\\n')
    original=candidate
    restored=a.restore_r3_manual_payout_successor_base(path,candidate)
    assert restored==base, path
    assert candidate==original, 'input mutated: '+path
    assert a.restore_r3_manual_payout_successor_base(path,base)==base, 'base stage not idempotent: '+path
path='app/admin/index.html'
candidate=subprocess.check_output(['git','show',port['candidateCommit']+':'+path]).decode('utf-8').replace('\\r\\n','\\n')
try: a.restore_r3_manual_payout_successor_base(path,candidate+'\\n')
except RuntimeError as error: assert 'stage drift' in str(error)
else: raise AssertionError('mutated payout candidate accepted')
print('R3_MANUAL_PAYOUT_EXACT_STAGE_INVERSE_PASS')
`);
  assert.match(output, /R3_MANUAL_PAYOUT_EXACT_STAGE_INVERSE_PASS/);
});

test("R3 admin history inverse accepts the payout release stack without weakening older golden", () => {
  const current = readFileSync(path.join(root, "app/admin/index.html"), "utf8").replace(/\r\n/g, "\n");
  const restored = renewalPort.restoreBase("app/admin/index.html", current);
  const baseStage = renewalPort.restoreBase("app/admin/index.html", gitText(stack.baseCommit, "app/admin/index.html"));
  assert.equal(restored, baseStage);
  assert.equal(renewalPort.restoreManualPayoutAdminIndex("app/admin/index.html", current, stack.targetVersion), gitText(stack.baseCommit, "app/admin/index.html"));
  assert.throws(() => renewalPort.restoreManualPayoutAdminIndex("app/admin/index.html", current + "\n", stack.targetVersion), /stage drift/);
});
