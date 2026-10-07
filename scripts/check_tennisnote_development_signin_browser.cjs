// 실제 HTML/호출 함수와 합성 Auth를 사용한다. 외부 요청·실제 계정 입력은 없다.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium, webkit } = require("playwright");
const root = path.resolve(__dirname, "..");
const privateSource = fs.existsSync(path.join(root,"90-Dashboard","tennis-note-member-app","app.js"));
const publicRoot = process.env.TENNISNOTE_PUBLIC_SOURCE || (!privateSource && root);
const projectedRoot = process.env.TENNISNOTE_SIGNIN_OVERLAY || (!privateSource && root);
const fp = "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
function config() {
  return { environment: "development", supabaseUrl: "https://synthetic-qa-project.supabase.co", projectFingerprint: fp,
    featureFlags: { developmentEmailSignIn: true, emailPasswordAuthUi: true },
    developmentEmailSignInManifest: { contractVersion: "development-existing-sign-in/1", environment: "development", projectFingerprint: fp, supabaseOrigin: "https://synthetic-qa-project.supabase.co" } };
}
const cases = [
  ["allowed", (c) => c, true],
  ["production", (c) => ({ ...c, environment: "production" }), false],
  ["default", () => ({}), false],
  ["missing_flag", (c) => ({ ...c, featureFlags: { emailPasswordAuthUi: true } }), false],
  ["wrong_fingerprint", (c) => ({ ...c, projectFingerprint: "0".repeat(64) }), false],
  ["wrong_manifest", (c) => ({ ...c, developmentEmailSignInManifest: { ...c.developmentEmailSignInManifest, projectFingerprint: "0".repeat(64) } }), false],
  ["wrong_origin", (c) => ({ ...c, developmentEmailSignInManifest: { ...c.developmentEmailSignInManifest, supabaseOrigin: "https://different-project.supabase.co" } }), false],
  ["wrong_environment", (c) => ({ ...c, developmentEmailSignInManifest: { ...c.developmentEmailSignInManifest, environment: "production" } }), false],
];
const layouts = [{width:390,height:844},{width:768,height:1024},{width:1366,height:900},{width:844,height:390}];
function readFile(mode, pathname) {
  const base = mode === "private" ? root : publicRoot;
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  const candidate = path.resolve(base, relative);
  if (!candidate.startsWith(path.resolve(base) + path.sep)) throw new Error("test_path_escape");
  const projected = mode === "public" && path.resolve(projectedRoot, relative);
  const selected = projected && fs.existsSync(projected) ? projected : candidate;
  return fs.readFileSync(selected);
}
async function main() {
  const modes = privateSource ? ["private",...(publicRoot&&projectedRoot?["public"]:[])] : ["public"];
  let mode = "private", currentConfig = config();
  const server = http.createServer((req,res) => {
    const pathname = new URL(req.url,"http://127.0.0.1").pathname;
    if (pathname.endsWith("/shared/config.local.js")) {
      res.writeHead(200,{"content-type":"text/javascript"});
      res.end(`window.TENNISNOTE_CONFIG=${JSON.stringify(currentConfig)};window.TENNIS_NOTE_PAYMENT_CONFIG={enabled:false,allowedMethods:[]};`);return;
    }
    try {
      let data = readFile(mode,pathname);
      if (pathname.endsWith("/tennis-note-member-app/app.js")) data = Buffer.from(data.toString().replace("void initApp();","// synthetic test: boot held; real binding called below"));
      const mime=pathname.endsWith(".html")?"text/html":pathname.endsWith(".js")?"text/javascript":pathname.endsWith(".css")?"text/css":"application/octet-stream";
      res.writeHead(200,{"content-type":mime,"cache-control":"no-store"});res.end(data);
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=`http://127.0.0.1:${server.address().port}`;
  let checks=0,contexts=0,externalAttempts=0,syntheticImages=0;
  try {
    const selectedEngine=process.env.TENNISNOTE_BROWSER_ENGINE;
    for (const engine of (selectedEngine ? [selectedEngine==="webkit"?webkit:chromium] : [chromium,webkit])) {
      const browser=await engine.launch({headless:true});
      try {
        for (mode of modes) {
          for (const [name,make,allowed] of cases) {
            for (const [layout,colorScheme] of (name==="allowed" ? layouts.flatMap(v=>[[v,"light"],[v,"dark"]]) : [[layouts[0],"light"]])) {
              currentConfig=make(config());
              const context=await browser.newContext({viewport:layout,colorScheme,serviceWorkers:"block"});
              const page=await context.newPage();const errors=[];
              page.on("pageerror",e=>errors.push(e.message));
              await page.route("**/*",route=>{
                if(new URL(route.request().url()).origin!==address){
                  // 기존 데모 사진도 외부로 가져오지 않는다. Auth/fetch 차단은 약화하지 않는다.
                  if(route.request().resourceType()==="image"){
                    syntheticImages++;
                    return route.fulfill({status:200,contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'});
                  }
                  externalAttempts++;
                  return route.abort();
                }
                return route.continue();
              });
              const prefix=mode==="private"?"90-Dashboard":"app";
              await page.goto(`${address}/${prefix}/tennis-note-member-app/index.html`,{waitUntil:"load"});
              await page.waitForFunction(()=>typeof loginWithEmail==="function" && typeof emailPasswordSignInUiEnabled==="function");
              const result=await page.evaluate(async ({allowed,mode})=>{
                const calls=[]; const client=window.TennisNoteDataClient;
                client.signInWithPassword=async()=>{calls.push("login");};
                client.signUpWithPassword=async()=>{calls.push("signup");};
                client.sendPasswordResetEmail=async()=>{calls.push("reset");};
                client.updatePassword=async()=>{calls.push("update");};
                client.signOut=async()=>{calls.push("signout");};
                identityAuthCapabilities={status:"ready",providers:{email:true,apple:true,naver:true,kakao:true,phone:true},checkedAt:Date.now()};
                document.querySelector("#loginScreen").hidden=false;document.querySelector("#appScreen").hidden=true;
                document.querySelector("#publicOnboardingLoginActions").hidden=false;
                // 부팅을 보류한 합성 검사에서는 초기 splash도 명시적으로 종료한다.
                window.__tennisNoteBootReady?.();
                document.querySelector("#brandSplash").style.display="none";
                if(mode==="public") bindAccountEvents(); else bindEvents();
                syncAuthProviderCapabilityControls();
                const available=emailPasswordSignInUiEnabled();
                const panel=document.querySelector("#memberEmailAuthPanel");
                const signin=document.querySelector("#memberEmailLoginForm");
                const event=id=>({preventDefault(){},currentTarget:document.getElementById(id)});
                await signUpWithEmail(event("memberEmailSignupForm"));
                await requestPasswordReset();await updateRecoveredPassword(event("memberPasswordRecoveryForm"));
                for(const id of ["memberEmailSignupForm","memberPasswordRecoveryForm"]){document.getElementById(id).dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));}
                const rejectedModes=[setEmailAuthMode("signup",{focus:false}),setEmailAuthMode("recovery",{focus:false})];
                const forbiddenCalls=calls.filter(x=>["signup","reset","update"].includes(x));
                let invalidSafe=true,duplicateCalls=0,approvedCoach=false,unapprovedCoach=false;
                if(allowed){
                  setEmailAuthMode("login",{focus:false});panel.open=true;
                  document.querySelector("#memberLoginEmail").value="synthetic@example.invalid";
                  document.querySelector("#memberLoginPassword").value="synthetic-local-fixture-only";
                  client.signInWithPassword=async()=>{throw new Error("invalid_credentials synthetic-secret");};
                  await loginWithEmail(event("memberEmailLoginForm"));
                  invalidSafe=/로그인|비밀번호|이메일/.test(document.querySelector("#memberEmailLoginStatus").textContent)&&!document.querySelector("#memberEmailLoginStatus").textContent.includes("synthetic-secret");
                  const originalApply=applySupabaseMemberSession;
                  let release;client.signInWithPassword=()=>{calls.push("login");return new Promise(resolve=>{release=resolve;});};
                  // 실제 등록된 submit listener를 통과시킨다. 직접 함수 호출만으로 PASS하지 않는다.
                  signin.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
                  signin.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
                  duplicateCalls=calls.filter(x=>x==="login").length;
                  applySupabaseMemberSession=async()=>false;release();
                  await new Promise(resolve=>setTimeout(resolve,0));
                  if(signin.querySelector('[type="submit"]').disabled)throw new Error("synthetic_submit_not_completed");
                  applySupabaseMemberSession=originalApply;
                  client.signInWithPassword=async()=>{calls.push("login");};
                  client.readiness=()=>({ready:true});client.consumeOAuthRedirect=async()=>{};
                  client.ensureSession=async()=>({access_token:"synthetic-local-session",provider:"이메일"});
                  client.selectCurrentProfile=async()=>({user:{id:"synthetic-auth"},profile:{id:"synthetic-profile",role:"coach",status:"active",name:"합성 검증"},coachRole:{status:"approved"}});
                  activateLiveMemberProfile=()=>{};rememberRecentLoginProvider=()=>{};
                  memberCurriculumUI.clear=()=>{};let opened=0;openCoachMode=()=>{opened++;};
                  await loginWithEmail(event("memberEmailLoginForm"));approvedCoach=opened===1&&canUseCoachMode();
                  state.member.coachApproved=false;unapprovedCoach=!canUseCoachMode();
                  client.selectCurrentProfile=async()=>({profileBootstrapError:{code:"auth_profile_mapping_ambiguous"}});
                  await loginWithEmail(event("memberEmailLoginForm"));unapprovedCoach=unapprovedCoach&&opened===1;
                }else{
                  await loginWithEmail(event("memberEmailLoginForm"));
                  signin.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
                }
                const reset=document.querySelector("#memberPasswordResetButton");
                const controls=[...signin.querySelectorAll("input,button")].filter(el=>!el.hidden&&!el.disabled&&el.getClientRects().length);
                return {available,broad:window.TennisNoteRuntimeEnvironment.features.emailPasswordAuthUi,
                  hidden:panel.hidden,inert:panel.inert,rejectedModes,forbiddenCalls,invalidSafe,duplicateCalls,approvedCoach,unapprovedCoach,
                  calls,signupVisible:document.querySelector("#memberEmailSignupForm").getClientRects().length>0,
                  resetVisible:reset.getClientRects().length>0,resetDisabled:reset.disabled,
                  minFont:Math.min(...controls.filter(el=>el.matches("input,select,textarea")).map(el=>parseFloat(getComputedStyle(el).fontSize))),
                  submitHeight:signin.querySelector('[type="submit"]').getBoundingClientRect().height,
                  overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};
              },{allowed,mode});
              assert.equal(result.available,allowed,`${mode}/${name} admission`);checks++;
              assert.equal(result.broad,false);checks++;
              assert.deepEqual(result.forbiddenCalls,[]);checks++;
              assert.deepEqual(result.rejectedModes,[false,false]);checks++;
              assert.equal(result.signupVisible,false);checks++;
              assert.equal(result.resetVisible,false);checks++;
              if(allowed){
                assert(!result.hidden&&!result.inert);checks++;
                assert(result.resetDisabled&&result.invalidSafe);checks++;
                assert.equal(result.duplicateCalls,1);checks++;
                assert(result.approvedCoach&&result.unapprovedCoach);checks++;
                assert(result.minFont>=16&&result.submitHeight>=44, `${mode}/${name}/${layout.width} font=${result.minFont} submit=${result.submitHeight}`);checks++;
              }else {assert(result.hidden&&result.inert);checks++;assert.deepEqual(result.calls,[]);checks++;}
              assert.equal(result.overflow,0);checks++;
              assert.deepEqual(errors,[]);checks++;
              if(allowed&&process.env.TENNISNOTE_QA_OUTPUT){
                await page.locator("#memberEmailAuthPanel").scrollIntoViewIfNeeded();
                const hit=await page.locator('#memberEmailLoginForm [type="submit"]').evaluate(el=>{
                  const r=el.getBoundingClientRect();
                  return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
                });
                assert(hit,"synthetic login form must not be covered by boot splash");checks++;
                fs.mkdirSync(process.env.TENNISNOTE_QA_OUTPUT,{recursive:true});
                await page.screenshot({path:path.join(process.env.TENNISNOTE_QA_OUTPUT,`${mode}-${engine.name()}-${layout.width}x${layout.height}-${colorScheme}.png`)});
              }
              contexts++;await context.close();
            }
          }
        }
      }finally{await browser.close();}
    }
    assert.equal(externalAttempts,0);
    console.log(JSON.stringify({result:"PASS",checks,contexts,engines:selectedEngine?1:2,sourceModes:modes,externalAttempts,syntheticImages,realAuth:0,credentialsRead:0}));
  }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
