import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const get=path=>readFileSync(path,"utf8").replace(/\r\n/g,"\n");
const html=get("app/admin/index.html"), view=get("app/admin/views/members.js");
const script=get("app/admin/r4-internal-catalog-issue-dev.js");
const sql=get("release-sources/r4-internal-catalog-issue-dev/install.sql");
const workflow=get(".github/workflows/r4-internal-catalog-issue-dev.yml");
const marker='<script src="./r4-internal-catalog-issue-dev.js?v=1"></script>';
assert.equal(html.split(marker).length,2);
assert.ok(html.indexOf(marker)<html.indexOf('<script src="./views/members.js'));
assert.match(view,/action === "assign" && operationsRole\(\) === "admin"[\s\S]{0,190}TennisNoteR4InternalCatalogIssueDev\?\.mount/);
assert.match(script,/cfg\?\.environment !== "development"/);
assert.match(script,/cfg\.supabaseUrl !== devApi \|\| cfg\.projectFingerprint !== devFingerprint/);
assert.match(script,/button\.type = "button"/);
assert.match(script,/await readResult\(item,operation\)/);
assert.doesNotMatch(script,/tn_admin_assign_paid|innerHTML|tennisnote-admin\.pages\.dev/);
assert.match(sql,/enabled boolean not null default false/);
assert.match(sql,/unique \(registration_id, member_id\)/);
assert.match(sql,/singleton for update/);
assert.match(sql,/new\.is_active|r4_catalog_reference_immutable/);
assert.match(sql,/g\.branch_id is distinct from p_branch or g\.member_id is distinct from p_member/);
assert.match(sql,/private\.tn_r4_member_catalog_registration/);
assert.doesNotMatch(sql,/(?:insert into|update) public\.tn_(?:payments|lessons|regular_schedule_rules)\b/i);
assert.doesNotMatch(sql,/commit;|disable trigger|skip_future_regular_reconcile/i);
assert.doesNotMatch(workflow,/environment:|secrets\.|workflow_dispatch|deploy |wrangler/);
new Script(view);new Script(script);
if(process.env.CI){
  const changed=execFileSync("git",["diff","--name-only","HEAD^","HEAD"],{encoding:"utf8"}).trim().split("\n").sort();
  assert.deepEqual(changed,[
    ".github/workflows/r4-internal-catalog-issue-dev.yml","app/admin/index.html","app/admin/r4-internal-catalog-issue-dev.js",
    "app/admin/views/members.js","release-sources/r4-internal-catalog-issue-dev/check.mjs",
    "release-sources/r4-internal-catalog-issue-dev/install.sql",
  ].sort());
}
console.log("R4_PRIVATE_CATALOG_ISSUE_DELTA_PASS");
