// Local in-memory candidate only. No publishing or source tree writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {candidate as scoped} from './scoped-client-overlay-portable.mjs';
const root=process.env.R4_BASE_ARTIFACT;
const prod=process.env.R4_INDEPENDENT_SOURCE;
assert.ok(root&&prod,'EXPLICIT_ARTIFACT_PATHS_REQUIRED');
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=p=>readFileSync(p);
const seal=read(join(root,'seal.json'));assert.equal(sha(seal),'44c31617fc2c1d8ea5377d0e6d6a0f2d2b52ee1aa048a023e8c4ac08f497c85b');
function walk(dir,prefix=''){return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  assert.ok(e.isFile()||e.isDirectory());const p=prefix+e.name;return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+'/')):[[p,read(join(dir,e.name))]];
}));}
const hashFiles=xs=>Object.fromEntries(Object.keys(xs).sort().map(k=>[k,sha(xs[k])]));
const old=JSON.parse(seal),base=walk(join(root,'admin'));assert.deepEqual(hashFiles(base),old.admin);assert.equal(Object.keys(base).length,178);
function once(text,a,b){assert.equal(text.split(a).length,2,'ANCHOR_MISMATCH');return text.replace(a,b);}
const previous='<script src="./r4-independent-owner.js?v=05b861eaffad3030"></script>';
const independent=read(join(prod,'independent-v2.js'));
base['index.html']=Buffer.from(once(base['index.html'].toString(),previous,`<script src="./r4-independent-prod-v2.js?v=${sha(independent).slice(0,16)}"></script>`));
base['r4-independent-prod-v2.js']=independent;
const frozen=JSON.parse(read(join(prod,'candidate-seal.json')));assert.deepEqual(hashFiles(base),frozen.admin.sha256);assert.equal(Object.keys(base).length,179);
let code=base['r4-branch-operations.js'].toString();
code=once(code,'let client, actor, active, snapshot, preview, generation = 0, busy = false;',
  'let client, actor, active, snapshot, preview, firstIssue, firstIssueTimer, generation = 0, busy = false;');
code=once(code,'  const controls = {',`  function clearFirstIssue() {
    firstIssue = null;
    if (firstIssueTimer) root.clearTimeout(firstIssueTimer);
    firstIssueTimer = null;
    const option = select.querySelector('[value="firstIssue"]');
    if (select.value === "firstIssue") select.value = "policy";
    option?.remove();
  }
  function acceptFirstIssue(cap, target) {
    clearFirstIssue();
    const fields = ["owner", "branch", "member", "product", "coach"];
    if (cap?.enabled !== true || cap.actor !== actor || cap.branch !== target ||
        !Number.isFinite(cap.expiresAt) || cap.expiresAt <= Date.now() || cap.expiresAt > Date.now()+300000 ||
        ["actor", "branch", "member", "product", "coach", "operation"].some(k => !uuid(cap[k])) ||
        fields.some(k => !cap.display?.[k] || typeof cap.display[k].label !== "string" ||
          cap.display[k].label.trim().length < 1 || cap.display[k].label.length > 100 ||
          cap.display[k].id !== (k === "owner" ? cap.actor : cap[k])) ||
        cap.display.product.price !== 0 || !Number.isSafeInteger(cap.display.product.sessions) ||
        !Number.isSafeInteger(cap.display.product.minutes) || !Number.isSafeInteger(cap.display.product.days) ||
        !root.TennisNoteR4FirstIssuePrototype) return;
    firstIssue = cap;
    select.append(new Option("0원 회원권 발급", "firstIssue"));
    firstIssueTimer = root.setTimeout(() => { clearFirstIssue(); paint(); }, Math.max(1, cap.expiresAt-Date.now()));
  }
  const controls = {`);
code=once(code,"    import: '<p>개인 정규권 1행만 등록합니다.","    firstIssue: '<p data-first-issue-info></p>',\n    import: '<p>개인 정규권 1행만 등록합니다.");
code=once(code,'{ policy: "정책 저장", product: "상품 등록", import: "미리보기" }','{ policy: "정책 저장", product: "상품 등록", firstIssue: "0원 회원권 발급", import: "미리보기" }');
code=once(code,'    if (action === "policy" && snapshot',`    if (action === "firstIssue" && firstIssue) {
      const d = firstIssue.display;
      body.querySelector("[data-first-issue-info]").textContent =
        "관리자 " + d.owner.label + " · 지점 " + d.branch.label + " · 회원 " + d.member.label +
        " · 상품 " + d.product.label + " · 코치 " + d.coach.label + " · " +
        d.product.minutes + "분 · " + d.product.sessions + "회 · " + d.product.days + "일 · 0원";
    }
    if (action === "policy" && snapshot`);
code=once(code,'    active = snapshot = preview = null;', '    active = snapshot = preview = null;\n    clearFirstIssue();');
code=once(code,'      snapshot = data;\n      panel.hidden = false;', '      snapshot = data;\n      acceptFirstIssue(data.firstIssue, target);\n      panel.hidden = false;');
code=once(code,'      } else if (action === "import") {',`      } else if (action === "firstIssue") {
        if (!firstIssue) throw Error("r4_first_issue_not_available");
        const capability = firstIssue;
        const bridge = root.TennisNoteR4FirstIssuePrototype.create({capability,client,branchElement:branch,
          productionVerified:root.TennisNoteR4ExistingAccount?.isProductionTarget?.() === true});
        const request = Object.fromEntries(["branch","member","product","coach","operation"].map(k => [k,capability[k]]));
        await bridge.issue(request);
        if (!current(stamp)) return;
        clearFirstIssue();
        paint();
        status.textContent = "0원 회원권을 등록하고 확인했습니다. 아래에서 수업을 선택하세요.";
      } else if (action === "import") {`);
code=once(code,'        else {\n          snapshot = null;', '        else if (action === "firstIssue") {\n          clearFirstIssue();\n          status.textContent = "등록 결과를 확인하지 못했습니다. 기록을 확인해 주세요.";\n        } else {\n          snapshot = null;');
const bridge=read(new URL('./issue-bridge.js',import.meta.url));
const next={...base,'r4-branch-operations.js':Buffer.from(code),'r4-selfserve-client.js':Buffer.from(scoped),'r4-first-issue-bridge.js':bridge};
let html=next['index.html'].toString();
const opsTag='<script src="./r4-branch-operations.js?v=r4-ops-d75f6a0c54a0"></script>';
html=once(html,opsTag,`<script src="./r4-first-issue-bridge.js?v=${sha(bridge).slice(0,16)}"></script>\n    <script src="./r4-branch-operations.js?v=${sha(next['r4-branch-operations.js']).slice(0,16)}"></script>`);
html=once(html,'<script src="./r4-selfserve-client.js?v=r4-prod-workspace-a000a3108920"></script>',`<script src="./r4-selfserve-client.js?v=${sha(next['r4-selfserve-client.js']).slice(0,16)}"></script>`);
next['index.html']=Buffer.from(html);
const delta=Object.keys(next).filter(k=>!base[k]||!next[k].equals(base[k])).sort();
assert.deepEqual(delta,['index.html','r4-branch-operations.js','r4-first-issue-bridge.js','r4-selfserve-client.js']);
export {base,next,delta,sha};
