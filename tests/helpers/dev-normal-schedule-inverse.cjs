// 개발 SQL로 배정된 합성 수업 3파일만 과거 해시 검사 전에 되돌린다. 제품 빌드에는 쓰지 않는다.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const base = "d1a22ea5faf60b9fb97d10e5029ec6027351b759";
const patchFile = "tests/fixtures/dev-normal-schedule-patch.json";
const patchHash = "6148ee013ed6247d3faafd443e7b1465ecb9eb3d9a77207bc27cb14fade71c67";
const paths = Object.fromEntries(Object.entries({
  "actions/schedule.js": ["c9f2ebaa80d19c736e7765c93cbdd492abcdae11fb818c6ae5aa4155d46ea3a4","dbce64524d8d6f21c0c06f5e49357138e9fce9882133409f8cedc84fba13843e"],
  "views/schedule.js": ["69f29ceae6a8a0d37234120b77e8829ade41332fd6e829d5910e84c6d723a86a","dff06af7fd04cfb2261ce474e3b1330447cb2f85ee82c8039d51226e52497dc0"],
  "events/delegated.js": ["24bc6b6f84c8ec377bacc190bf3aa6897e903b0238c7d9f45222cf58ea1eb3ee","46b5220d9436d286cb64b7755fe296ad66fe3e81ed0fdd06207db58b8a43f7ed"],
}).map(([k,v])=>["app/tennis-note-coach-app/"+k,v]));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const repo = "leisurewang0827/tennis-note-public";
function allowed(env) {
  if (env.GITHUB_ACTIONS === "true") {
    if (env.GITHUB_REPOSITORY !== repo) return false;
    if (env.GITHUB_EVENT_NAME === "push") return env.GITHUB_REF === "refs/heads/dev";
    return env.GITHUB_EVENT_NAME === "pull_request" && env.GITHUB_BASE_REF === "dev" && /^refs\/pull\/\d+\/merge$/.test(env.GITHUB_REF || "");
  }
  return env.TENNISNOTE_LOCAL_DEV_PARITY === "1" && !env.GITHUB_REF && !env.GITHUB_EVENT_NAME;
}
const seen = new Map();
function project(file, source, env = process.env, strict = false) {
  const row = paths[file];
  if (!row) {
    if (strict) throw Error("Unregistered DEV schedule path");
    return source;
  }
  const sha = hash(source);
  if (sha === row[0]) return source;
  if (sha !== row[1]) {
    if (strict || /normalCoach(?:Lease|AssignedMove)|tn_dev_normal_/.test(source)) throw Error("Unknown DEV schedule bytes: "+file);
    return source; // 중간 역사적 소스는 기존의 자체 검사를 그대로 통과해야 한다.
  }
  if (!allowed(env)) throw Error("DEV schedule delta not admitted for this target");
  if (seen.has(file)) return seen.get(file);
  const diff = Buffer.from(JSON.parse(fs.readFileSync(path.join(root, patchFile),"utf8")).join("\n"),"utf8");
  if (hash(diff) !== patchHash) throw Error("DEV schedule patch digest drift");
  const blocks = diff.toString("utf8").split(/^--- a\//m).slice(1);
  if (blocks.length !== 3 || blocks.some(x => !Object.hasOwn(paths,x.split("\n",1)[0]))) throw Error("DEV schedule patch set drift");
  const block = blocks.find(x=>x.startsWith(file+"\n+++ b/"+file+"\n"));
  if (!block) throw Error("Missing DEV schedule patch");
  const lines = source.split("\n");
  const hunks = [...block.matchAll(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@[^\n]*\n([\s\S]*?)(?=^@@ |(?![\s\S]))/gm)];
  if (!hunks.length) throw Error("Missing DEV schedule hunk");
  for (const [, ,beforeCount,at,afterCount,body] of hunks.reverse()) {
    const patchLines = body.replace(/\n$/,"").split("\n");
    if (patchLines.some(s=>!/^[-+ ]/.test(s))) throw Error("Invalid DEV schedule patch");
    const oldLines = patchLines.filter(s=>s[0]!=="+").map(s=>s.slice(1));
    const newLines = patchLines.filter(s=>s[0]!=="-").map(s=>s.slice(1));
    const pos = Number(at)-1;
    if (oldLines.length!==Number(beforeCount) || newLines.length!==Number(afterCount) ||
        newLines.some((s,i)=>s!==lines[pos+i])) throw Error("DEV schedule inverse mismatch");
    lines.splice(pos,newLines.length,...oldLines);
  }
  const prior = lines.join("\n");
  if (hash(prior)!==row[0] || !Buffer.from(prior).equals(execFileSync("git",["show",base+":"+file],{cwd:root}))) throw Error("DEV schedule historical source mismatch");
  seen.set(file,prior);
  return prior;
}
module.exports = { project, allowed, paths, base, root };
if (require.main===module) process.stdout.write(project(process.argv[2],fs.readFileSync(0,"utf8"),process.env,true));
