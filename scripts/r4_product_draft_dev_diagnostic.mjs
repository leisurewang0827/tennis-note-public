// One read-only DEV diagnostic. No body, URL, token or account value is printed.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";

const parent="0b21d398c508a515c6bd53ae38d8843a522239a0";
const branch="codex/tennisnote-r4-ui-finish-dev-20261108";
const allowedCodes=new Set([1000,1001,10000,7003,9103,9109]);
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
try {
  const declaration=JSON.parse(readFileSync("release-diagnostics/r4-product-draft-dev/diagnostic.json"));
  assert.deepEqual(declaration,{schema:1,parent,environment:"development",project:"tennisnote-admin-dev",
    recoveryId:"7ee771cf-8bfb-407e-aff8-13e0d35cccb4",routeClasses:["project","recovery","deployments_page1"]});
  assert.equal(process.env.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");
  assert.equal(process.env.GITHUB_REF,`refs/heads/${branch}`);
  assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");
  const sha=process.env.GITHUB_SHA;assert.match(sha||"",/^[a-f0-9]{40}$/);
  assert.equal(execFileSync("git",["rev-list","--parents","-n","1",sha],{encoding:"utf8"}).trim(),`${sha} ${parent}`);
  assert.deepEqual(execFileSync("git",["diff","--name-only",parent,sha],{encoding:"utf8"}).trim().split("\n").sort(),
    [".github/workflows/r4-product-draft-dev-diagnostic.yml","scripts/r4_product_draft_dev_diagnostic.mjs",
      "release-diagnostics/r4-product-draft-dev/diagnostic.json"].sort());
  assert.match(account||"",/^[a-f0-9]{32}$/);assert.ok(token);
  assert.equal(createHash("sha256").update(account).digest("hex"),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const base=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin-dev`;
  const routes=[["project",base],["recovery",`${base}/deployments/7ee771cf-8bfb-407e-aff8-13e0d35cccb4`],
    ["deployments_page1",`${base}/deployments?per_page=100&page=1`]];
  for(const [route,url] of routes) {
    try {
      const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
      let codes=[];
      try {const body=await r.json();codes=Array.isArray(body?.errors)?body.errors.map(x=>Number(x?.code)).filter(Number.isSafeInteger).map(x=>allowedCodes.has(x)?x:"other").slice(0,5):[];}catch{}
      console.log(JSON.stringify({route,status:r.status,errorCodes:codes}));
    } catch(e) {console.log(JSON.stringify({route,status:null,errorCodes:[],transport:e?.name==="TimeoutError"?"timeout":"request_failed"}));}
  }
  console.log(JSON.stringify({previewVacancy:"NOT_EVALUATED"}));
} catch {console.log(JSON.stringify({status:"DIAGNOSTIC_SCOPE_BLOCKED"}));process.exitCode=1;}
