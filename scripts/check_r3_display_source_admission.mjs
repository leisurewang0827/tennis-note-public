// 화면 문구와 버전 순서 guard만 허용하는 별도 경로. 기존 historical proof는 그대로 둔다.
export const BASE="007ec7a58d2ea123f8a1f6774efeb50e1975590c";
export const BASE_TREE="ffc6a3b33d46df146ee199abe63cd4bf9c0cb3cf";
export const REPOSITORY="leisurewang0827/tennis-note-public";
export const PRODUCTION_CANDIDATE_BRANCH="codex/tennisnote-r3-operating558-20261026";
export const DEV_CANDIDATE_BRANCH="codex/tennisnote-r3-display-dev563-20261028";
export const DEV_CANDIDATE_REF="refs/heads/"+DEV_CANDIDATE_BRANCH;
export const DEV_WORKFLOW_REF=REPOSITORY+"/.github/workflows/deploy-cloudflare-pages-dev.yml@"+DEV_CANDIDATE_REF;
export const TARGETS={
 main:["15fe59bdd21bc75a70da810f3a63a0c80853f39f","f6e3f569a4b5b1d483e0fcdc884af1f919c38f7c"],
 dev:["d1a22ea5faf60b9fb97d10e5029ec6027351b759","4c82ae973c1a1c25a54e0e002c85710a9c19a662"]
};
export const BASE_VERSION="1.0.561";
export const PR_VERSION={main:"1.0.562",dev:"1.0.563"};
export const NEXT_VERSION={"1.0.561":"1.0.562","1.0.562":"1.0.563"};
export const SELF="scripts/check_r3_display_source_admission.mjs";
export const TEST="tests/r3-display-source.test.mjs";
// 실패한 P는 재봉인하지 않는다. 보완 C는 이 불변 부모의 검사2파일만 바꿀 수 있다.
export const CORRECTION_BASE="ab81d3a6127bcdf3b12a961838e4f550c1535720";
export const CORRECTION_BASE_TREE="19286f62a1b8374aa499627897b6c5a7650e90d9";
export const CORRECTION_PATHS=[SELF,TEST].sort();
export const UI="app/shared/tennisnote-settlement-adjustment.js";
export const DEV_GUARD="scripts/check_r3_display_dev_deployment.py";
export const WORKFLOWS=[".github/workflows/tennisnote-public-ci.yml",".github/workflows/deploy-cloudflare-pages-dev.yml"];
export const WORKFLOW_NAMES=["Tennis Note Public PWA CI","Deploy Tennis Note development sites"];
export const NEW_PATHS=[SELF,TEST,DEV_GUARD,"scripts/check_production_release_order.py","tests/production-release-order.test.js"];
export const PATHS=[...WORKFLOWS,...NEW_PATHS,UI,".github/workflows/deploy-cloudflare-pages.yml"].sort();
export const METADATA=[
 "app/admin/index.html","app/release.json","app/shared/tennisnote-release.js",
 "app/tennis-note-coach-app/app.js","app/tennis-note-coach-app/domain/coaches.js","app/tennis-note-coach-app/forms/common.js",
 "app/tennis-note-coach-app/index.html","app/tennis-note-coach-app/service-worker.js",
 "app/tennis-note-member-app/app.js","app/tennis-note-member-app/forms/common.js","app/tennis-note-member-app/index.html",
 "app/tennis-note-member-app/service-worker.js","app/tennis-note-member-app/ui/screens.js"
].sort();
export const PINS={
 [UI]:"1b2c2fe4e7a3bcb1e629a40e1ef7ab59423279b639e30be3b2cba6f7892c2e41",
 ".github/workflows/deploy-cloudflare-pages.yml":"76cf7b028bc85cc948aef5e96e710ee55502841a16508ac2a2d54cab103233d5",
 "scripts/check_production_release_order.py":"3cd6063455fa42b0fa6636cca4ddcb0429081003c050f45211fed706b2032f3a",
 "tests/production-release-order.test.js":"4135fa622df417ee07edf6587d60016ef53de71bf969f59da847c0a9d38c4ffc",
 [DEV_GUARD]:"6782de562f0eab19dd52ee1dd957b74f67012dd4b9cbc4965a250f55467f0e0c"
};
export const PRESERVED={};
export const REUSED={
 canonicalUi:"1b2c2fe4e7a3bcb1e629a40e1ef7ab59423279b639e30be3b2cba6f7892c2e41",
 canonicalBrowser:"27a3c674508d39f23a42278eddfe54de9e7c5770d528e29bdbebb721ba77e377",
 localUi12Guard9Receipt:"7806829a2bbc05874368cac8f73dde4181b8da5e87a58dcb397f37d77aec7cd7",
 devClosedReceipt:"2bb73f15b29ad79b0d99dc0e9a176243ce2800ec3d89d749bfbbf66e08950c12"
};
export function profileFor(ref,io){
 const r=JSON.parse(io.blob(ref,"app/release.json"));
 need([BASE_VERSION,"1.0.562","1.0.563"].includes(r.version),"UNKNOWN_RELEASE");
 if(r.version===BASE_VERSION) return {version:BASE_VERSION};
 const dev=r.version==="1.0.563",id=dev?"2026.10.28.02":"2026.10.28.01";
 need(r.releaseId===id && r.appSurfaceVersion===r.version &&
   /^2026-10-28T\d{2}:\d{2}:\d{2}\+09:00$/.test(r.deployedAt) &&
   Number.isFinite(Date.parse(r.deployedAt)),"RELEASE_METADATA_INVALID");
 return {version:r.version,appSurfaceVersion:r.version,releaseId:id,deployedAt:r.deployedAt,
   memberCache:"tennis-note-member-pwa-v"+(dev?596:595),coachCache:"tennis-note-coach-mode-v"+(dev?569:568)};
}
export function expectedMetadata(name,base,p){
 let s=lf(base);
 if(name==="app/release.json"){
   for(const k of ["version","appSurfaceVersion","releaseId","deployedAt"]){
     const re=new RegExp('"'+k+'":\\s*"[^"]+"',"g");
     need([...s.matchAll(re)].length===1,"RELEASE_JSON_ANCHOR");
     s=s.replace(re,'"'+k+'": "'+p[k]+'"');
   } return s;
 }
 if(name==="app/shared/tennisnote-release.js"){
   for(const k of ["version","releaseId","appSurfaceVersion","deployedAt"]){
     const re=new RegExp('^(    '+k+': ")[^"]+(")',"gm");
     need([...s.matchAll(re)].length===1,"RELEASE_JS_ANCHOR");
     s=s.replace(re,(_,a,b)=>a+p[k]+b);
   } return s;
 }
 // 기존 bump_release.py의 local query/literal/cache 규칙만 허용한다. nativeShell/version 하위 필드 제외.
 s=s.replace(/([^"'\s()]*)\?v=(\d+\.\d+\.\d+)/g,(m,url,v)=>{
   if(url.includes("://")||url.includes("/vendor/")) return m;
   need(v===BASE_VERSION,"STALE_QUERY");return url+"?v="+p.version;
 });
 if(name.endsWith(".js")){
   s=s.replace(/(\bv:\s*"|\|\|\s*")1\.0\.561(")/g,(_,a,b)=>a+p.version+b);
 }
 if(name.endsWith("/service-worker.js")){
   const next=name.includes("member-app")?p.memberCache:p.coachCache;
   const re=/const CACHE_NAME = "[a-z-]+-v\d+";/g;
   need([...s.matchAll(re)].length===1,"CACHE_ANCHOR");
   s=s.replace(re,'const CACHE_NAME = "'+next+'";');
 }
 need(s!==lf(base),"EMPTY_METADATA_CHANGE");return s;
}
export function expectedWorkflow(path,base){
 let s=lf(base);
 if(path===WORKFLOWS[0]){
   // 새 source/guard 자체만 바뀌는 경우도 반드시 CI가 수집한다.
   s=s.replaceAll('      - "scripts/verify.sh"','      - "scripts/verify.sh"\n      - "scripts/check_r3_display*"\n      - "scripts/check_production_release_order.py"');
   s=once(s,"      # 고정 운영 기준 blob",
     "      - name: Admit exact reviewed display and release source\n        id: display\n        run: node "+SELF+" --ci-route\n      - name: New source merge and collector cases only\n        if: steps.display.outputs.scoped == 'true'\n        run: node --test "+TEST+"\n      # 고정 운영 기준 blob");
   s=once(s,"      - name: Prepare pinned browser runtime\n","      - name: Prepare pinned browser runtime\n        if: steps.display.outputs.scoped != 'true'\n");
   s=once(s,"      - name: Verify\n","      - name: Verify\n        if: steps.display.outputs.scoped != 'true'\n");
 }else if(path===WORKFLOWS[1]){
   s=once(s,"      - name: Admit exact manual R3 candidate\n",
     "      - name: Set up exact source admission runtime\n        uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n\n      - name: Admit exact manual R3 candidate\n");
   const exact="github.event_name == 'workflow_dispatch' && github.ref == '"+DEV_CANDIDATE_REF+"'";
   const historical="github.event_name == 'workflow_dispatch' && github.ref != '"+DEV_CANDIDATE_REF+"'";
   s=once(s,"      - name: Admit exact manual R3 candidate\n        if: github.event_name == 'workflow_dispatch'\n",
     "      - name: Admit exact DEV563 child source\n        if: "+exact+"\n        run: node "+SELF+" --dev-source\n\n      - name: Admit exact manual R3 candidate\n        if: "+historical+"\n");
   s=once(s,"      - name: Prevent development release rollback on dev branch pushes\n        if: github.event_name == 'push'\n",
     "      - name: Prevent development release rollback for exact display source\n        if: github.event_name == 'push' || ("+exact+")\n");
   s=once(s,"      - name: Verify exact existing development target and rollback before manual deploy\n        if: github.event_name == 'workflow_dispatch'\n",
     "      - name: Verify exact existing development target and rollback before manual deploy\n        if: "+historical+"\n");
   s=once(s,"python scripts/check_r3_dev_deployment.py --branch-preflight","python "+DEV_GUARD);
 }else throw Error("UNKNOWN_WORKFLOW");
 return s;
}
import {createHash} from "node:crypto";
import {readFileSync, appendFileSync, lstatSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath, pathToFileURL} from "node:url";
import {dirname, resolve} from "node:path";
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const lf = value => String(value).replace(/\r\n/g, "\n");
export const hash = value => createHash("sha256").update(value).digest("hex");
export const need = (ok, code) => { if (!ok) throw Error(code); };
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export const once = (text, before, after) => {
  need(text.split(before).length === 2, "ANCHOR_NOT_EXACT");
  return text.replace(before, after);
};
export const SOURCE_SEAL = "3cf05564ca91c8fd635e641219474a06e290ae5e48eb1ac8c6bae59f05928e33";
export const TEST_SEAL = "7ac2dbfd1d4df85bc9b71d27c936e6d55f2f2de5d7ccf0b37f2abe34d0fc9918";
export const read = name => lf(readFileSync(resolve(ROOT,name),"utf8"));
export const git = (...args) => execFileSync("git",args,{
  cwd:ROOT, encoding:"utf8", stdio:["ignore","pipe","pipe"], timeout:15000, maxBuffer:8*1024*1024
}).trimEnd();
export const IO = {
  tree: ref => git("rev-parse",ref+"^{tree}"),
  parents: ref => git("show","-s","--format=%P",ref).split(" ").filter(Boolean),
  changes: ref => git("diff","--no-renames","--name-status",BASE,ref).split("\n").filter(Boolean).map(s=>s.split("\t")),
  delta: (base,ref) => git("diff","--no-renames","--name-status",base,ref).split("\n").filter(Boolean).map(s=>s.split("\t")),
  blob: (ref,name) => lf(execFileSync("git",["show",ref+":"+name],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:8*1024*1024})),
  mode: (ref,name) => git("ls-tree","--format=%(objectmode)",ref,"--",name)
};
export function seal(text) {
  return hash(lf(text).replace(/export const SOURCE_SEAL = "[^"]+";/,'export const SOURCE_SEAL = "PENDING";'));
}
// 이 경로는 이전 금융/DB 검증을 다시 실행하지 않는다. 정확한 변경 경로 밖의 전체 tree는 그대로여야 한다.
export function proveTree(ref, io=IO) {
  need(io.tree(BASE)===BASE_TREE,"BASE_TREE_DRIFT");
  for(const [sha,tree] of Object.values(TARGETS)) need(io.tree(sha)===tree,"TARGET_TREE_DRIFT");
  const profile=profileFor(ref,io);
  const expected=[...PATHS,...(profile.version===BASE_VERSION?[]:METADATA)].sort();
  const actual=io.changes(ref);
  need(same(actual.map(r=>r[1]).sort(),expected),"EXACT_SCOPE_REQUIRED");
  for(const [status,name] of actual) {
    need(status===(NEW_PATHS.includes(name)?"A":"M"),"PATH_KIND_CHANGED");
    need(io.mode(ref,name)==="100644","REGULAR_FILE_REQUIRED");
  }
  for(const name of PATHS) {
    const value=io.blob(ref,name);
    if(name===SELF) need(seal(value)===SOURCE_SEAL,"ADMISSION_SOURCE_CHANGED");
    else if(name===TEST) need(hash(value)===TEST_SEAL,"ADMISSION_TEST_CHANGED");
    else if(PINS[name]) need(hash(value)===PINS[name],"REVIEWED_SOURCE_CHANGED");
    else need(value===expectedWorkflow(name,io.blob(BASE,name)),"WORKFLOW_CHANGED");
  }
  for(const name of profile.version===BASE_VERSION?[]:METADATA)
    need(io.blob(ref,name)===expectedMetadata(name,io.blob(BASE,name),profile),"METADATA_ONLY_REQUIRED");
  return {version:profile.version, release:profile, tree:io.tree(ref), reused:REUSED, newDatabaseRuns:0};
}
function exactDelta(base,ref,paths,io) {
  const delta=io.delta(base,ref);
  need(same(delta.map(r=>r[1]).sort(),[...paths].sort()),"EXACT_CHILD_SCOPE_REQUIRED");
  for(const [status,name] of delta)
    need(status==="M" && io.mode(ref,name)==="100644","CHILD_FILE_KIND_CHANGED");
}
function proveCorrection(ref,io,proof=proveTree(ref,io)) {
  need(proof.version==="1.0.562","METADATA_SEQUENCE_REQUIRED");
  need(same(io.parents(ref),[CORRECTION_BASE]),"CORRECTION_DIRECT_PARENT_REQUIRED");
  need(io.tree(CORRECTION_BASE)===CORRECTION_BASE_TREE,"CORRECTION_BASE_TREE_DRIFT");
  // P의 old SELF/TEST를 새 seal로 검사하지 않는다. 전체 불변 tree와 exact2 delta가 경계다.
  exactDelta(CORRECTION_BASE,ref,CORRECTION_PATHS,io);
  for(const name of METADATA)
    need(io.blob(ref,name)===io.blob(CORRECTION_BASE,name),"CORRECTION_METADATA_CHANGED");
  return {...proof,sourceRoute:"correction562",frozenParent:CORRECTION_BASE};
}
export function proveFeature(ref,io=IO) {
  const proof=proveTree(ref,io), parents=io.parents(ref);
  need(parents.length===1,"FEATURE_SINGLE_PARENT_REQUIRED");
  if(proof.version===BASE_VERSION) {
    need(parents[0]===BASE,"FEATURE_BASE_REQUIRED");
    return proof;
  }
  if(proof.version==="1.0.562") return proveCorrection(ref,io,proof);
  // D는 검증된 C의 metadata-only 직계 자식. P→D 통합/임의 중간 커밋은 허용하지 않는다.
  need(parents[0]!==CORRECTION_BASE,"DEV_CORRECTION_PARENT_REQUIRED");
  const correction=proveCorrection(parents[0],io);
  exactDelta(parents[0],ref,METADATA,io);
  for(const name of PATHS)
    need(io.blob(ref,name)===io.blob(parents[0],name),"DEV_SOURCE_CHANGED");
  return {...proof,sourceRoute:"dev563-metadata-child",correction:parents[0],frozenParent:correction.frozenParent};
}
export function proveEvent(c,io=IO) {
  need(c.repo===REPOSITORY && c.attempt==="1","EVENT_IDENTITY");
  need(/^[a-f0-9]{40}$/.test(c.head||""),"HEAD_REQUIRED");
  need(c.workflow && WORKFLOW_NAMES.includes(c.workflow),"WORKFLOW_REQUIRED");
  let proof, admissionRoute="ordinary";
  if(c.event==="pull_request") {
    need(c.headRepo===REPOSITORY,"PR_BASE_OR_FORK");
    if(c.target===PRODUCTION_CANDIDATE_BRANCH) {
      // 검사용 PR이다. 대상 브랜치를 진행하거나 이 PR을 병합해 운영 후보를563으로 올리지 않는다.
      need(c.workflow===WORKFLOW_NAMES[0] && c.headRef===DEV_CANDIDATE_BRANCH,"QA_BRANCH_OR_WORKFLOW");
      need(same(io.parents(c.head),[c.base]),"QA_DIRECT_PARENT_REQUIRED");
      proof=proveFeature(c.head,io);
      need(proof.version==="1.0.563" && profileFor(c.base,io).version==="1.0.562","QA_RELEASE_SEQUENCE");
      admissionRoute="qa563-child";
    } else {
      need(TARGETS[c.target]?.[0]===c.base,"PR_BASE_OR_FORK");
      proof=proveFeature(c.head,io);
      need(PR_VERSION[c.target]===proof.version,"PR_RELEASE_PROFILE");
    }
    if(c.checkout!==c.head) {
      need(same(io.parents(c.checkout),[c.base,c.head]) && io.tree(c.checkout)===proof.tree,"PR_MERGE_TREE_CHANGED");
    }
  } else if(c.event==="push") {
    need(TARGETS[c.target]?.[0]===c.base && c.ref==="refs/heads/"+c.target && c.checkout===c.head,"PUSH_CONTEXT");
    const parents=io.parents(c.head);
    need(parents[0]===c.base && [1,2].includes(parents.length),"MERGE_PARENT_CHANGED");
    proof=proveTree(c.head,io);
    need(PR_VERSION[c.target]===proof.version,"PUSH_RELEASE_PROFILE");
    if(parents.length===2) need(proveFeature(parents[1],io).tree===proof.tree,"MERGE_PAYLOAD_CHANGED");
    // Squash has a different SHA; exact full-tree overlay against frozen base is the proof, not ancestry fiction.
  } else if(c.event==="workflow_dispatch") {
    need(c.workflow===WORKFLOW_NAMES[1] && c.ref===DEV_CANDIDATE_REF && c.refType==="branch"
      && c.target===DEV_CANDIDATE_BRANCH && c.checkout===c.head && c.githubSha===c.head
      && c.candidateInput===c.head && c.candidateSha===c.head
      && c.workflowRef===DEV_WORKFLOW_REF && c.declaredWorkflowRef===DEV_WORKFLOW_REF,"MANUAL_DEV_CONTEXT");
    proof=proveFeature(c.head,io);
    need(proof.version==="1.0.563","MANUAL_DEV563_REQUIRED");
    admissionRoute="dev563-manual";
  } else throw Error("EVENT_FORBIDDEN");
  return {...proof, head:c.head, checkout:c.checkout, ref:c.ref, event:c.event, admissionRoute, displayOnly:true};
}
export function eventContext(env=process.env, event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,"utf8")), checkout=git("rev-parse","HEAD")) {
  const pr=event.pull_request;
  return {repo:env.GITHUB_REPOSITORY,attempt:env.GITHUB_RUN_ATTEMPT,event:env.GITHUB_EVENT_NAME,
    workflow:env.GITHUB_WORKFLOW,head:pr?.head?.sha||env.GITHUB_SHA,
    headRepo:pr?.head?.repo?.full_name,target:pr?.base?.ref||(env.GITHUB_REF||"").replace("refs/heads/",""),
    base:pr?.base?.sha||event.before,ref:env.GITHUB_REF,checkout,headRef:pr?.head?.ref,
    githubSha:env.GITHUB_SHA,refType:env.GITHUB_REF_TYPE,candidateInput:event.inputs?.candidate_sha,
    candidateSha:env.TENNISNOTE_CANDIDATE_SHA,workflowRef:env.GITHUB_WORKFLOW_REF,
    declaredWorkflowRef:env.TENNISNOTE_WORKFLOW_REF};
}
export function verifyCheckout(c=eventContext()) {
  need(git("status","--porcelain","--untracked-files=all")==="","HOSTED_CLEAN_REQUIRED");
  const proof=proveEvent(c);
  for(const name of [...PATHS,...METADATA]) {
    need(!lstatSync(resolve(ROOT,name)).isSymbolicLink(),"SYMLINK_FORBIDDEN");
    need(read(name)===IO.blob(c.checkout,name),"WORKTREE_CHANGED");
  }
  return proof;
}
export function localOverlay() {
  need(git("rev-parse","HEAD")===BASE && git("diff","--cached","--name-only")==="","LOCAL_BASE_OR_INDEX");
  const tracked=git("diff","--name-only").split("\n").filter(Boolean);
  const untracked=git("ls-files","--others","--exclude-standard").split("\n").filter(Boolean);
  const owned=[...tracked,...untracked].filter(p=>!Object.hasOwn(PRESERVED,p)).sort();
  need(same(owned,[...PATHS].sort()),"LOCAL_SCOPE");
  for(const [p,h] of Object.entries(PRESERVED)) need(hash(readFileSync(resolve(ROOT,p)))===h,"UNRELATED_DIRTY_DRIFT");
  const virtual="e".repeat(40);
  const io={...IO, tree:ref=>ref===virtual?"LOCAL_UNCOMMITTED":IO.tree(ref),
    changes:()=>PATHS.map(p=>[NEW_PATHS.includes(p)?"A":"M",p]),
    mode:(_,p)=>{need(!lstatSync(resolve(ROOT,p)).isSymbolicLink(),"SYMLINK_FORBIDDEN");return "100644";},
    blob:(ref,p)=>ref===virtual?read(p):IO.blob(ref,p)};
  return proveTree(virtual,io);
}
export function localCorrectionOverlay() {
  need(git("rev-parse","HEAD")===CORRECTION_BASE && git("diff","--cached","--name-only")==="","LOCAL_CORRECTION_BASE_OR_INDEX");
  need(git("ls-files","--others","--exclude-standard")==="","LOCAL_CORRECTION_UNTRACKED");
  const tracked=git("diff","--name-only").split("\n").filter(Boolean).sort();
  need(same(tracked,CORRECTION_PATHS),"LOCAL_CORRECTION_SCOPE");
  for(const name of CORRECTION_PATHS)
    need(!lstatSync(resolve(ROOT,name)).isSymbolicLink(),"SYMLINK_FORBIDDEN");
  const virtual="e".repeat(40);
  const io={...IO,tree:ref=>ref===virtual?"LOCAL_UNCOMMITTED":IO.tree(ref),
    parents:ref=>ref===virtual?[CORRECTION_BASE]:IO.parents(ref),
    changes:ref=>IO.changes(ref===virtual?CORRECTION_BASE:ref),
    delta:(base,ref)=>{
      need(base===CORRECTION_BASE && ref===virtual,"LOCAL_CORRECTION_DELTA");
      return CORRECTION_PATHS.map(name=>["M",name]);
    },
    mode:(ref,name)=>IO.mode(ref===virtual?CORRECTION_BASE:ref,name),
    blob:(ref,name)=>ref===virtual?(CORRECTION_PATHS.includes(name)?read(name):IO.blob(CORRECTION_BASE,name)):IO.blob(ref,name)};
  return proveFeature(virtual,io);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const mode=process.argv[2];
    need(["--local","--local-correction","--ci-route","--service-route","--dev-source"].includes(mode),"MODE");
    if(mode==="--service-route" && process.env.GITHUB_EVENT_NAME!=="pull_request") {
      need(typeof manualHistorical==="function","NO_MANUAL_ROUTE");
      manualHistorical();
    } else {
      const proof=mode==="--local"?localOverlay():mode==="--local-correction"?localCorrectionOverlay():verifyCheckout();
      need(mode==="--dev-source" || proof.event!=="workflow_dispatch","MANUAL_ROUTE_ONLY");
      if(mode==="--dev-source") need(proof.version==="1.0.563" &&
        (proof.event==="push" || proof.admissionRoute==="dev563-manual"),"DEV563_DEPLOY_ONLY");
      if(["--ci-route","--service-route"].includes(mode)) appendFileSync(process.env.GITHUB_OUTPUT,"scoped=true\ndisplay_only=true\n");
      console.log(JSON.stringify({contract:"r3-reviewed-display-source/1",...proof}));
    }
  } catch { console.error("R3_DISPLAY_SOURCE_HOLD"); process.exitCode=2; }
}
