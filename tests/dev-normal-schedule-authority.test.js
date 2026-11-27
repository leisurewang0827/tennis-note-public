const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const {project,paths,base,root} = require("./helpers/dev-normal-schedule-inverse.cjs");
const dev = {GITHUB_ACTIONS:"true",GITHUB_REPOSITORY:"leisurewang0827/tennis-note-public",GITHUB_EVENT_NAME:"push",GITHUB_REF:"refs/heads/dev"};
for (const file of Object.keys(paths)) {
  test("DEV 일정 원본·역패치·운영 거절: "+file,()=>{
    const candidate = fs.readFileSync(path.join(root,file),"utf8");
    const original = execFileSync("git",["show",base+":"+file],{cwd:root,encoding:"utf8"});
    assert.notEqual(candidate,original);
    assert.equal(project(file,candidate,dev,true),original);
    assert.equal(project(file,candidate,{...dev,GITHUB_EVENT_NAME:"pull_request",GITHUB_REF:"refs/pull/10/merge",GITHUB_BASE_REF:"dev"},true),original);
    assert.equal(project(file,original,{},true),original);
    assert.throws(()=>project(file,candidate+" ",dev,true),/Unknown DEV/);
    assert.throws(()=>project(file,candidate,{...dev,GITHUB_REF:"refs/heads/main",TENNISNOTE_LOCAL_DEV_PARITY:"1"},true),/not admitted/);
    assert.throws(()=>project(file,candidate,{...dev,GITHUB_REPOSITORY:"other/project"},true),/not admitted/);
    assert.throws(()=>project(file,candidate,{...dev,GITHUB_EVENT_NAME:"pull_request",GITHUB_BASE_REF:"main",GITHUB_REF:"refs/pull/10/merge"},true),/not admitted/);
    assert.throws(()=>project("app/other.js",candidate,dev,true),/Unregistered/);
  });
}
