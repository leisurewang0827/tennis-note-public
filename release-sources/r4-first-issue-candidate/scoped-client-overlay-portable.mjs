// Only creates bytes in memory for focused checks; no repo writes or publish.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
assert.ok(process.env.R4_BASE_ARTIFACT,'EXPLICIT_ARTIFACT_PATH_REQUIRED');
const base=join(process.env.R4_BASE_ARTIFACT,'admin','r4-selfserve-client.js');
const sha=x=>createHash('sha256').update(x).digest('hex');
const original=readFileSync(base,'utf8');
assert.equal(sha(original),'cf3025173e9d0d6af38df6a480297c5ef398a2e9226c5ee6b4f4d554b16ab494');
function once(text,from,to){assert.equal(text.split(from).length,2,'OVERLAY_ANCHOR');return text.replace(from,to);}
let candidate=once(original,'    tn_r4_branch_operations_options: "tn_r4_prod_selfserve_ops_options",',
  '    tn_r4_branch_operations_options: "tn_r4_prod_selfserve_ops_options",\n    tn_r4_first_zero_issue: "tn_r4_first_zero_issue",');
candidate=once(candidate,'const target = args.target_branch_id ?? args.target_branch ?? args.branch;',
  'const target = args.target_branch_id ?? args.target_branch ?? args.branch ?? args.p_branch;');
candidate=once(candidate,'          let mapped = names[name];',
  '          if (name === "tn_r4_first_zero_issue" && (args.p_branch !== branchId || args.target_branch_id !== undefined || args.target_branch !== undefined || args.branch !== undefined)) throw Error("r4_selfserve_branch_mismatch");\n          let mapped = names[name];');
export {original,candidate};
