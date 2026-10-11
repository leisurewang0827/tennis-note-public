import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {createRequire} from "node:module";
import checkout from "./helpers/release-checkout-layout.cjs";
import mechanical from "./helpers/release-freeze-mechanical.cjs";
const root=path.resolve(import.meta.dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const raw=read("tests/fixtures/release-checkout-layout.json");
const require=createRequire(import.meta.url);

test("CI layout: public paths are relative to this checkout, not a parent/public folder",()=>{
 let requested="";const result=checkout.read("synthetic-ci-root","public","app/release.json",p=>{requested=p;return Buffer.from("synthetic-public-source\r\n");});
 assert.equal(requested,path.join("synthetic-ci-root","app/release.json"));assert.equal(result,"synthetic-public-source\n");
});
test("CI layout: missing public source fails without historical or private fallback",()=>{
 let calls=0;assert.throws(()=>checkout.read("synthetic-ci-root","public","app/release.json",()=>{calls++;throw Object.assign(Error("missing"),{code:"ENOENT"});}),{code:"ENOENT"});assert.equal(calls,1);
});
test("CI layout: injected public reader retains every frozen after hash and fails on one byte",()=>{
 const sources=new Map(mechanical.currentRows("public","actual-current").map(row=>[row.path,read(row.path)]));let calls=0;
 assert.equal(mechanical.verifyCurrent("synthetic-ci-root","public",file=>{calls++;return sources.get(file);}),true);assert.equal(calls,sources.size);
 const first=sources.keys().next().value;sources.set(first,sources.get(first)+"x");assert.throws(()=>mechanical.verifyCurrent("synthetic-ci-root","public",file=>sources.get(file)),/unfrozen current metadata/);
});
test("CI layout: private inputs are explicitly pinned references, never actual private CI claims",()=>{
 assert.equal(checkout.contract.sourceScope,"PRIVATE_PINNED_REFERENCE_NOT_REMOTE_PRIVATE_CHECKOUT");assert.equal(checkout.contract.privateRecipes.length,9);
 for(const row of mechanical.contract.files.filter(row=>row.side==="private"))assert.equal(checkout.hash(checkout.read("synthetic-ci-root","private",row.path,()=>{throw Error("unexpected filesystem access");})),row.afterSha256);
});
test("CI layout: unknown private source path fails and cannot be manufactured",()=>assert.throws(()=>checkout.projectPrivate("90-Dashboard/synthetic-unknown.js"),/private_reference_unknown_path/));
test("CI layout: missing or edited reference fixture fails at its unchanged pin",()=>{
 for(const value of ["",raw+"\n",raw.replace('"privateRecipes"','"unknownRecipes"')])assert.throws(()=>checkout.loadContract(value),/checkout_reference_drift/);
});
test("CI layout: private patch before bytes cannot drift",()=>{
 const recipe=checkout.contract.privateRecipes[0],p=recipe.patches[0],saved=p.before;
 try{p.before=saved+"x";assert.throws(()=>checkout.projectPrivate(recipe.path),/private_reference_patch_drift/);}finally{p.before=saved;}
});
test("CI layout: private patch after bytes cannot bypass the existing golden",()=>{
 const recipe=checkout.contract.privateRecipes[0],p=recipe.patches[0],saved=p.after;
 try{p.after=saved+"x";assert.throws(()=>checkout.projectPrivate(recipe.path),/private_reference_after_drift/);}finally{p.after=saved;}
});
test("CI layout: duplicated private patch or removed source reference fails closed",()=>{
 const recipe=checkout.contract.privateRecipes[0];recipe.patches.push({...recipe.patches[0]});
 try{assert.throws(()=>checkout.projectPrivate(recipe.path),/private_reference_patch_drift/);}finally{recipe.patches.pop();}
 const removed=checkout.contract.privateRecipes.shift();try{assert.throws(()=>checkout.projectPrivate(removed.path),/private_reference_unknown_path/);}finally{checkout.contract.privateRecipes.unshift(removed);}
});
test("CI layout: semantic before-source is pinned without outputs evidence dependency",()=>{
 assert.equal(checkout.hash(checkout.semanticBefore()),"2fcd5c933217137c333ad5e8ecaab15b62a25037cc95c7f009b26216edb24921");
 const saved=checkout.contract.semanticBefore.source;try{checkout.contract.semanticBefore.source=saved+"x";assert.throws(()=>checkout.semanticBefore());}finally{checkout.contract.semanticBefore.source=saved;}
});
test("CI layout: source side, traversal and non UTF8 are rejected",()=>{
 assert.throws(()=>checkout.read(root,"unknown","app/release.json"),/checkout_source_side_unknown/);
 assert.throws(()=>checkout.read(root,"public","../private/app.js"),/checkout_source_path_invalid/);
 assert.throws(()=>checkout.read(root,"public",path.resolve(root,"app/release.json")),/checkout_source_path_invalid/);
 assert.throws(()=>checkout.read(root,"public","app/release.json",()=>Buffer.from([0xff])),/public_source_encoding_unknown/);
});
test("CI layout: helper runs without process, Git, object repo env, or external private checkout",()=>{
 const source=read("tests/helpers/release-checkout-layout.cjs"),allowed=new Set(["node:fs","node:path","node:assert/strict","node:crypto","./release-freeze-mechanical.cjs"]);
 // shared mechanical reference와 JSON은 같은 realm에서 파싱한다. prototype 오탐 없이 strict 비교를 유지한다.
 const context=vm.createContext({Buffer,JSON,__dirname:path.join(root,"tests/helpers"),module:{exports:{}},require:name=>{assert(allowed.has(name));return name==="./release-freeze-mechanical.cjs"?mechanical:require(name);}});
 vm.runInContext(source,context);assert.equal(context.module.exports.projectPrivate(checkout.contract.privateRecipes[0].path),checkout.projectPrivate(checkout.contract.privateRecipes[0].path));
});
test("CI layout: actual mechanical entry has no sibling-private or outputs-only read",()=>{
 const source=read("tests/release-freeze-mechanical.test.js");
 assert.match(source,/import checkout from "\.\/helpers\/release-checkout-layout\.cjs"/);assert.match(source,/const read=\(side,file\)=>checkout\.read\(publicRoot,side,file\)/);
 assert.doesNotMatch(source,/candidateRoot|evidence\/before|C:[/\\]|OBJECT_REPO/);assert.match(source,/checkout\.semanticBefore\(\)/);
 assert.match(source,/mechanical\.verifyCurrent\(publicRoot,"private",file=>read\("private",file\),"pinned-private-reference"\)/);assert.match(source,/assert\.equal\(reverted,before\)/);
});
test("CI layout: existing full checkout history and test registration are retained",()=>{
 const workflow=read(".github/workflows/tennisnote-public-ci.yml"),verify=read("scripts/verify.sh"),integrated=read("tests/integrated-feature-parity.test.js");
 assert.match(workflow,/fetch-depth: 0/);assert.match(workflow,/run: \.\/scripts\/verify\.sh/);assert.match(verify,/node --test "tests\/\*\*\/\*\.test\.js"/);
 assert.match(integrated,/PUBLIC_OBJECT_REPO \|\| root/);assert.doesNotMatch(integrated,/C:[/\\]/);assert.match(integrated,/get\(publicRepo,dev/);
});
