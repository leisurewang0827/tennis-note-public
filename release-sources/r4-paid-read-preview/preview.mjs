import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync, spawnSync} from "node:child_process";
import {appendFile, readFile, writeFile, mkdir, readdir} from "node:fs/promises";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {patchWrangler} from "../../scripts/r4_scoped_member_catalog_dev.mjs";

const repo = "leisurewang0827/tennis-note-public";
const branch = "codex/tennisnote-r4-ui-finish-dev-20261108";
const parent = "2d0760e8a59433113e4152cd3c4529fdd429c493";
const ciPath = ".github/workflows/r4-paid-read-preview-ci.yml";
const deployWorkflow = "343938323";
const actions = "https://api.github.com/repos/" + repo + "/actions";
const project = "tennisnote-app-dev", preview = "r4-marketplace-qa";
const alias = "https://r4-marketplace-qa.tennisnote-app-dev.pages.dev";
const old = {id:"55c6bb21-cae5-4020-b1bf-4fe6f3feb247", url:"https://55c6bb21.tennisnote-app-dev.pages.dev", sha:"58bb20d2f808d850973349cb62f2862edff8834a"};
const root = dirname(fileURLToPath(import.meta.url));
const sealed = JSON.parse(await readFile(join(root, "seal.json"), "utf8"));
const baseline = sealed.restore, candidate = {...baseline, ...sealed.additions};
const controls = ["_headers", "_redirects", "_worker.js"];
const added = ["r4-paid-read-qa/index.html", "r4-paid-read-qa/read.js"];
const canaries = ["index.html", "manifest.webmanifest", "service-worker.js", "release.json", "shared/config.local.js"];
const configPath = "shared/config.local.js";
const digest = b => createHash("sha256").update(b).digest("hex");
const uid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const sha = /^[0-9a-f]{40}$/;
const liveOrigin = /^https:\/\/[a-f0-9]{8}\.tennisnote-app-dev\.pages\.dev$/;
const env = process.env;
const check = (ok, code) => {if (!ok) throw Error(code);};
const git = (...args) => execFileSync("git", args, {encoding:"utf8", maxBuffer:2**20}).trim();

function verifySeal() {
  assert.deepEqual(Object.keys(sealed.additions).sort(), added);
  assert.deepEqual(Object.keys(sealed.controls).sort(), controls);
  assert.equal(Object.keys(baseline).length, 248);
  assert.equal(Object.keys(candidate).length, 250);
  assert.equal(digest(JSON.stringify(baseline)), sealed.restoreDigest);
  const sorted = Object.fromEntries(Object.keys(candidate).sort((a,b)=>a.localeCompare(b,"en-US")).map(name => [name,candidate[name]]));
  assert.equal(digest(JSON.stringify(sorted)), sealed.candidateDigest);
  for (const [name, hash] of Object.entries(candidate)) {
    assert.match(name, /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/);
    assert.ok(name.split("/").every(part => part !== "." && part !== ".."));
    assert.match(hash, /^[a-f0-9]{64}$/);
  }
}
function verifyBytes(bytes, hash, code) {
  check(digest(bytes) === hash, code);
}
function configOff(bytes) {
  try {
    const src = bytes.toString("utf8");
    const parts = [...src.matchAll(/window\.([A-Z0-9_]+)\s*=\s*(\{[\s\S]*?\})\s*;/g)];
    if (parts.length !== 2 || src.replace(/window\.[A-Z0-9_]+\s*=\s*\{[\s\S]*?\}\s*;/g, "").trim()) return false;
    const cfg = Object.fromEntries(parts.map(m => [m[1],JSON.parse(m[2].replace(/^\s*([A-Za-z_][A-Za-z0-9_]+)\s*:/gm,'"$1":').replace(/,\s*(?=[}\]])/g,""))]));
    const client = cfg.TENNISNOTE_CONFIG, pay = cfg.TENNIS_NOTE_PAYMENT_CONFIG;
    const ref = "udjmiezroipctytmztwz";
    if (client.environment !== "development" || client.supabaseUrl !== "https://" + ref + ".supabase.co" ||
        client.projectFingerprint !== "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba" ||
        pay.enabled !== false || pay.bankTransfer.enabled !== false) return false;
    const key = client.supabasePublishableKey;
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
    if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) return false;
    const claims = JSON.parse(Buffer.from(key.split(".")[1],"base64url"));
    return claims.role === "anon" && claims.ref === ref;
  } catch {return false;}
}
async function asset(origin, name) {
  check(origin === alias || liveOrigin.test(origin), "PUBLIC_ORIGIN_DENIED");
  const path = name === "index.html" ? "/" : "/" + name.split("/").map(encodeURIComponent).join("/");
  let url = new URL(path, origin);
  for (let hops = 0; hops < 4; hops++) {
    const res = await fetch(url,{redirect:"manual", cache:"no-store",headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(15000)});
    if ([301,302,303,307,308].includes(res.status)) {
      url = new URL(res.headers.get("location"), url);
      check(url.origin === origin && !url.username && !url.password, "PUBLIC_REDIRECT_DENIED");
      continue;
    }
    check(res.status === 200, "PUBLIC_ASSET_MISSING");
    return Buffer.from(await res.arrayBuffer());
  }
  throw Error("PUBLIC_REDIRECT_LIMIT");
}
async function put(rootDir,name,bytes) {
  const path = join(rootDir,name);
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path, bytes, {flag:"wx"});
}
async function build(dest, sourceDir) {
  const entries = Object.entries(baseline);
  let cursor = 0;
  await Promise.all(Array.from({length:8},async () => {
    while (cursor < entries.length) {
      const [name, hash] = entries[cursor++];
      const bytes = controls.includes(name) ? Buffer.from(sealed.controls[name],"base64") :
        sourceDir ? await readFile(join(sourceDir,name)) : await asset(old.url,name);
      verifyBytes(bytes,hash,"BASELINE_ASSET_DIGEST_MISMATCH:" + name);
      if (name === configPath) check(configOff(bytes),"DEV_CONFIG_NOT_OFF");
      await Promise.all([put(join(dest,"restore"),name,bytes),put(join(dest,"candidate"),name,bytes)]);
    }
  }));
  for (const name of added) {
    const file = name.split("/").at(-1);
    const bytes = await readFile(join(root,file));
    verifyBytes(bytes, sealed.additions[name],"NEW_ASSET_DIGEST_MISMATCH");
    await put(join(dest,"candidate"),name,bytes);
  }
  await verifyPack(dest);
}
async function list(dir, prefix = "") {
  const entries = await readdir(dir,{withFileTypes:true});
  const all = await Promise.all(entries.map(entry => {
    const name = prefix + entry.name;
    if (entry.isDirectory()) return list(join(dir,entry.name),name + "/");
    check(entry.isFile(),"PACK_NON_REGULAR_ENTRY");
    return [name];
  }));
  return all.flat().sort();
}
async function verifyPack(dest) {
  for (const [kind, files] of Object.entries({restore:baseline,candidate})) {
    const dir = join(dest,kind);
    assert.deepEqual(await list(dir), Object.keys(files).sort(),"PACK_FILE_SET_MISMATCH");
    for (const [name, hash] of Object.entries(files)) {
      const bytes = await readFile(join(dir,name));
      verifyBytes(bytes,hash,"PACK_ASSET_DIGEST_MISMATCH:" + name);
      if (name === configPath) check(configOff(bytes),"PACK_DEV_CONFIG_NOT_OFF");
    }
  }
}
function githubFence(event) {
  check(env.GITHUB_REPOSITORY === repo && env.GITHUB_REF === "refs/heads/" + branch &&
    env.GITHUB_EVENT_NAME === event && env.GITHUB_RUN_ATTEMPT === "1" && sha.test(env.GITHUB_SHA || ""), "GITHUB_IDENTITY_DENIED");
  check(git("rev-list","--parents","-n","1",env.GITHUB_SHA) === env.GITHUB_SHA + " " + parent,"GITHUB_PARENT_DENIED");
  const expected = [ciPath,".github/workflows/deploy-cloudflare-pages-dev.yml",...["index.html","preview.mjs","read.js","seal.json"].map(n=>"release-sources/r4-paid-read-preview/"+n)].sort();
  assert.deepEqual(git("diff","--name-only",parent,env.GITHUB_SHA).split("\n").sort(),expected,"GITHUB_CHANGESET_DENIED");
}
function dispatch(value, now) {
  const [kind, source, run, observed, current, extra] = (value || "").split(":");
  check((kind === "publish" || kind === "restore") && sha.test(source || "") && /^[1-9][0-9]{5,15}$/.test(run || "") &&
    /^\d{13}$/.test(observed || "") && extra === undefined, "DISPATCH_INPUT_DENIED");
  check(Number(observed) <= now + 30000 && now - Number(observed) <= 10*60000,"OFF_OBSERVATION_EXPIRED");
  check(kind === "publish" ? current === undefined : uid.test(current || ""),"RECOVERY_ID_DENIED");
  return {kind, source, run, observed:Number(observed), current};
}
async function json(url, token) {
  check(token,"REQUIRED_TOKEN_MISSING");
  const res = await fetch(url,{redirect:"error",headers:{Authorization:"Bearer " + token,Accept:"application/json"},signal:AbortSignal.timeout(15000)});
  check(res.ok,"PROTECTED_READ_HTTP_" + res.status);
  return await res.json();
}
async function verifyCi(input) {
  check(input.source === env.GITHUB_SHA,"DISPATCH_SOURCE_DENIED");
  const base = "https://api.github.com/repos/" + repo + "/actions/runs/" + input.run;
  const [run, jobs, artifacts] = await Promise.all(["","/jobs","/artifacts"].map(s=>json(base+s,env.GH_TOKEN)));
  check(String(run.id) === input.run && run.path === ciPath && run.head_sha === input.source &&
    run.head_branch === branch && run.event === "push" && run.run_attempt === 1 &&
    run.repository?.full_name === repo && run.head_repository?.full_name === repo && run.conclusion === "success","EXACT_CI_DENIED");
  check(jobs.total_count === 1 && jobs.jobs[0]?.name === "Verify sealed member preview" && jobs.jobs[0]?.conclusion === "success","EXACT_CI_JOB_DENIED");
  check(artifacts.total_count === 1 && artifacts.artifacts[0]?.name === "r4-paid-read-preview-" + input.source &&
    artifacts.artifacts[0]?.expired === false && artifacts.artifacts[0]?.workflow_run?.head_sha === input.source &&
    /^sha256:[a-f0-9]{64}$/.test(artifacts.artifacts[0]?.digest || ""),"EXACT_ARTIFACT_DENIED");
}
async function verifyDeploymentWindow(input) {
  const query = new URLSearchParams({branch,head_sha:input.source,event:"workflow_dispatch",per_page:"100"});
  const history = await json(actions + "/workflows/" + deployWorkflow + "/runs?" + query,env.GH_TOKEN);
  check(history.total_count === history.workflow_runs?.length && history.total_count <= 100,"DEPLOYMENT_HISTORY_INCOMPLETE");
  const current = history.workflow_runs.find(run=>String(run.id) === env.GITHUB_RUN_ID);
  check(current?.head_sha === input.source && current.head_branch === branch && current.run_attempt === 1 &&
    current.repository?.full_name === repo && String(current.workflow_id) === deployWorkflow,"DEPLOYMENT_RUN_ID_DENIED");
  const earlier = history.workflow_runs.filter(run=>run.run_number < current.run_number);
  check(earlier.length === (input.kind === "publish" ? 0 : 1) &&
    (input.kind === "publish" || earlier[0]?.status === "completed"),"DUPLICATE_OR_UNRECONCILED_DISPATCH_DENIED");
  const statuses = ["in_progress","queued","waiting","pending","requested"];
  const views = await Promise.all(statuses.map(status=>json(actions+"/runs?status="+status+"&per_page=100",env.GH_TOKEN)));
  for (const view of views) {
    check(view.total_count === view.workflow_runs?.length && view.total_count <= 100,"ACTIVE_DEPLOYMENT_LIST_INCOMPLETE");
    check(view.workflow_runs.every(run=>String(run.id) === env.GITHUB_RUN_ID ||
      !/\/(?:deploy-cloudflare-pages(?:-dev)?|r4-(?:general-dev-promotion|independent-selfserve-dev|internal-catalog-issue-preview|internal-registration-dev|private-catalog-dev|product-draft-(?:dev-(?:promote|resume)|style-dev)|scoped-member-catalog-dev|ui-finish-dev))\.yml$/.test(run.path?.split("@")[0] || "")),"OTHER_DEVELOPMENT_DEPLOYMENT_ACTIVE");
  }
}
function cf() {
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  check(/^[a-f0-9]{32}$/.test(account || "") &&
    digest(account) === env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT,"CLOUDFLARE_ACCOUNT_DENIED");
  return async path => {
    const r = await json("https://api.cloudflare.com/client/v4/accounts/" + account + "/pages/projects/" + project + path,env.CLOUDFLARE_API_TOKEN);
    check(r.success === true, "CLOUDFLARE_READ_FAILED");
    return r;
  };
}
function previewDeployment(d) {
  check(uid.test(d?.id || "") && liveOrigin.test(d?.url || "") &&
    d?.project_name === project && d?.environment === "preview" &&
    d?.deployment_trigger?.metadata?.branch === preview &&
    d?.latest_stage?.status === "success","PREVIEW_DEPLOYMENT_DENIED");
  return d;
}
async function cloudState(api) {
  const {result:p} = await api("");
  check(p.name === project && p.subdomain === project + ".pages.dev" &&
    typeof p.production_branch === "string" && p.production_branch !== preview &&
    uid.test(p.canonical_deployment?.id || "") && p.canonical_deployment?.latest_stage?.status === "success","CLOUDFLARE_PROJECT_DENIED");
  const {result:restore} = await api("/deployments/" + old.id);
  previewDeployment(restore);
  check(restore.id === old.id && restore.url === old.url &&
    restore.deployment_trigger.metadata.commit_hash === old.sha,"IMMUTABLE_RESTORE_DENIED");
  const found = [];
  let total;
  for (let page = 1; page <= (total ?? 1); page++) {
    const r = await api("/deployments" + (page === 1 ? "" : "?page=" + page));
    check(r.result_info?.page === page && Number.isInteger(r.result_info?.total_pages) &&
      r.result_info.total_pages >= 1 && r.result_info.total_pages <= 100 && Array.isArray(r.result),"CLOUDFLARE_PAGINATION_DENIED");
    if (total !== undefined) check(total === r.result_info.total_pages,"CLOUDFLARE_LIST_DRIFT");
    total = r.result_info.total_pages;
    found.push(...r.result.filter(d => d.environment === "preview" && d.deployment_trigger?.metadata?.branch === preview));
  }
  check(new Set(found.map(d=>d.id)).size === found.length &&
    found.every(d=>Number.isFinite(Date.parse(d.created_on))),"PREVIEW_LIST_DENIED");
  found.sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));
  check(found.length && (found.length === 1 || found[0].created_on !== found[1].created_on),"PREVIEW_LATEST_AMBIGUOUS");
  const latest = previewDeployment(found[0]);
  check(Array.isArray(latest.aliases) && latest.aliases.includes(alias),"PREVIEW_ALIAS_DENIED");
  return {latest, canonical:p.canonical_deployment.id};
}
async function readback(origin, isCandidate) {
  const pack = isCandidate ? candidate : baseline;
  await Promise.all([...canaries,...(isCandidate ? added : [])].map(async name=>{
    const bytes = await asset(origin,name);
    verifyBytes(bytes,pack[name],"LIVE_DIGEST_MISMATCH:" + name);
    if (name === configPath) check(configOff(bytes),"LIVE_DEV_CONFIG_NOT_OFF");
  }));
  if (!isCandidate) {
    // Prior pack must not still serve either QA asset; SPA fallback is allowed, the old asset is not.
    for (const name of added) {
      const path = "/" + name;
      const r = await fetch(origin + path,{redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(15000)});
      const body = r.status === 200 ? Buffer.from(await r.arrayBuffer()) : null;
      check((body && digest(body) !== sealed.additions[name]) || [301,302,307,308,404].includes(r.status),"OLD_QA_ASSET_STILL_PRESENT");
    }
  }
}
function memberWrangler(bytes) {
  const patched = patchWrangler(bytes).toString("utf8");
  check(patched.split("tennisnote-admin-dev").length === 3,"TRANSPORT_MEMBER_FENCE_DRIFT");
  return patched.replaceAll("tennisnote-admin-dev",project);
}
async function deploy(dest, value) {
  githubFence("workflow_dispatch");
  const input = dispatch(value,Date.now());
  await verifyCi(input);
  await verifyDeploymentWindow(input);
  await verifyPack(dest);
  const api = cf();
  const publish = input.kind === "publish";
  const before = await cloudState(api);
  check(before.latest.id === (publish ? old.id : input.current) &&
    before.latest.deployment_trigger.metadata.commit_hash === (publish ? old.sha : input.source),"PREVIEW_TARGET_DRIFT");
  await Promise.all([readback(alias,!publish),readback(before.latest.url,!publish)]);
  const cliDir = join(env.RUNNER_TEMP,"r4-paid-wrangler/node_modules/wrangler/wrangler-dist");
  const cli = join(cliDir,"cli-r4-member-single.cjs");
  await writeFile(cli,memberWrangler(await readFile(join(cliDir,"cli.js"))),{flag:"wx"});
  const [rightBefore] = await Promise.all([cloudState(api),verifyDeploymentWindow(input)]);
  check(rightBefore.latest.id === before.latest.id && rightBefore.canonical === before.canonical,"PREVIEW_CONCURRENT_DRIFT");
  dispatch(value,Date.now());
  const deployedSha = publish ? input.source : old.sha;
  // Do not print vendor output (including on timeout). A single deployment POST is enforced in the pinned transport.
  const result = spawnSync(process.execPath,[cli,"pages","deploy",join(dest,publish ? "candidate" : "restore"),
    "--project-name="+project,"--branch="+preview,"--commit-hash="+deployedSha,"--commit-dirty=false"],
    {env, encoding:"utf8", timeout:3*60000,maxBuffer:2**20});
  const output = (result.stdout || "") + "\n" + (result.stderr || "");
  const urls = [...new Set(output.match(/https:\/\/[a-f0-9]{8}\.tennisnote-app-dev\.pages\.dev\b/g) || [])];
  if (result.status !== 0 || urls.length !== 1) {
    // Never repeat a write on transport failure; capture only a read-only state classification.
    try {
      const observed = await cloudState(api);
      const changed = observed.latest.id !== before.latest.id;
      if (changed) await readback(observed.latest.url,publish);
      console.log(JSON.stringify({state:"MUTATION_RECONCILE",changed,id:observed.latest.id,
        expectedSha:observed.latest.deployment_trigger.metadata.commit_hash === deployedSha,
        canonicalUnchanged:observed.canonical === before.canonical}));
    } catch {console.log("MUTATION_RECONCILE_UNAVAILABLE");}
    throw Error("PUBLISH_OUTCOME_UNKNOWN_READ_ONLY_RECONCILE_NO_RETRY");
  }
  const after = await cloudState(api);
  check(after.latest.id !== before.latest.id && after.latest.url === urls[0] &&
    after.latest.deployment_trigger.metadata.commit_hash === deployedSha &&
    after.canonical === before.canonical,"POST_PUBLISH_DRIFT_READ_ONLY_RECONCILE_NO_RETRY");
  await Promise.all([readback(after.latest.url,publish),readback(alias,publish)]);
  console.log(JSON.stringify({state:publish ? "MEMBER_PREVIEW_PUBLISHED" : "MEMBER_PREVIEW_RESTORED",
    source:input.source,ci:input.run,id:after.latest.id,url:after.latest.url,previous:before.latest.id,canonicalUnchanged:true,clientPaymentsOff:true}));
}
const [mode, dest, arg] = process.argv.slice(2);
try {
  verifySeal();
  if (mode === "local" || mode === "ci") {
    if (mode === "ci") githubFence("push");
    await build(dest,mode === "local" ? arg : undefined);
    for (const bad of ["", "publish:wrong","restore:" + parent + ":123456:" + Date.now() + ":wrong"]) assert.throws(()=>dispatch(bad,Date.now()));
    assert.throws(()=>dispatch("publish:" + parent + ":123456:" + (Date.now()-601000),Date.now()));
    assert.equal(dispatch("publish:" + parent + ":123456:" + Date.now(),Date.now()).kind,"publish");
    assert.equal(dispatch("restore:" + parent + ":123456:" + Date.now() + ":" + old.id,Date.now()).current,old.id);
    console.log(JSON.stringify({state:"MEMBER_PREVIEW_SEAL_PASS",source:env.GITHUB_SHA || null,restore:248,candidate:250,restoreDigest:sealed.restoreDigest,candidateDigest:sealed.candidateDigest}));
  } else if (mode === "admit") {
    githubFence("workflow_dispatch");
    const input = dispatch(env.PREVIEW_INPUT,Date.now());
    await verifyCi(input);
    await appendFile(env.GITHUB_OUTPUT,"ci=" + input.run + "\n");
  } else if (mode === "deploy") {
    await deploy(dest,env.PREVIEW_INPUT);
  } else throw Error("MODE_DENIED");
} catch (error) {
  // No assertion diffs, vendor bodies, credentials, or local paths in workflow logs.
  const message = String(error?.message || "");
  console.error(/^[A-Z0-9_]+(?::[A-Za-z0-9_./-]+)?$/.test(message) ? message : "MEMBER_PREVIEW_GUARD_OR_READ_FAILED");
  process.exitCode = 1;
}
