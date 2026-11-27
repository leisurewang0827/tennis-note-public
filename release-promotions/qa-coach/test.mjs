import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
const worker=(await import(pathToFileURL(process.argv[2]))).default;
const browserLib=await import(pathToFileURL(process.argv[3]));
const origin="https://tennisnote-app-dev.pages.dev", dev="https://udjmiezroipctytmztwz.supabase.co";
const fp="63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const url=origin+"/qa-coach-login"; const jwt="mock."+Buffer.from(JSON.stringify({sub:id(1)})).toString("base64url")+".fixture";
for (const [u,method] of [[url+"?x=1","GET"],[url,"POST"],[url+"-bad","GET"],[url.replace("app-dev","app"),"GET"],[url.replace("app-dev","12345678.tennisnote-app-dev"),"GET"]]) {
  assert.equal((await worker.fetch(new Request(u,{method}),{})).status,404);
}
for(const engine of process.argv.slice(4)){
 const browser=await browserLib[engine].launch(process.env.SYSTEM_CHROME && engine==="chromium"?{executablePath:process.env.SYSTEM_CHROME}:{});
 try{
  for(const mode of ["ok","wrong-mail","wrong-branch","wrong-actor","ordinary","assigned","auth-fail","existing","wrong-runtime"]){
   const ctx=await browser.newContext({serviceWorkers:"block"}); const p=await ctx.newPage();
   let auth=0,proof=0,entered=0,unexpected=0;
   try{
    if(mode==="existing")await p.addInitScript(()=>localStorage.setItem("tennis-note-supabase-session",'{"test":"preserve"}'));
    await ctx.route("**/*",async r=>{
     const req=r.request(), u=new URL(req.url());
     const headers={"access-control-allow-origin":origin,"access-control-allow-methods":"OPTIONS,POST","access-control-allow-headers":"apikey,authorization,content-type"};
     if(u.origin===dev && req.method()==="OPTIONS")return r.fulfill({status:204,headers});
     if(u.href===url||u.href===url+"-client.js"){
      const resp=await worker.fetch(new Request(u),{});
      return r.fulfill({status:resp.status,headers:Object.fromEntries(resp.headers),body:await resp.text()});
     }
     if(u.href===origin+"/shared/config.local.js")return r.fulfill({contentType:"application/javascript",body:"window.TENNISNOTE_CONFIG="+JSON.stringify({environment:mode==="wrong-runtime"?"production":"development",projectFingerprint:fp,supabaseUrl:dev,supabasePublishableKey:"fixture-only"})});
     if(u.href===dev+"/auth/v1/token?grant_type=password"&&req.method()==="POST"){
      auth++; assert.deepEqual(req.postDataJSON(),{email:"one@test.invalid",password:"fixture-only"});
      return r.fulfill({headers,status:mode==="auth-fail"?400:200,json:{access_token:jwt,refresh_token:"fixture",user:{id:id(1),email:"one@test.invalid"}}});
     }
     if(u.href===dev+"/rest/v1/rpc/tn_dev_normal_coach_work"&&req.method()==="POST"){
      proof++;assert.equal(req.headers().authorization,"Bearer "+jwt);
      return r.fulfill({headers,json:{eligible:mode!=="ordinary",assigned:mode==="assigned",self:{
       actorId:id(mode==="wrong-actor"?9:2),coachRoleId:id(3),branchId:id(mode==="wrong-branch"?9:4)}}});
     }
     if(u.href===origin+"/tennis-note-coach-app/"){entered++;return r.fulfill({contentType:"text/html",body:"fixture schedule"});}
     unexpected++;return r.abort();
    });
    await p.goto(url);const f=p.locator("fieldset"),button=p.getByRole("button");
    if(["existing","wrong-runtime"].includes(mode)){
     assert.equal(await button.isDisabled(),true);
     if(mode==="existing")assert.equal(await p.evaluate(()=>localStorage.getItem("tennis-note-supabase-session")),'{"test":"preserve"}');
    }else{
     await p.getByLabel("검증 이메일").fill(mode==="wrong-mail"?"other@test.invalid":"one@test.invalid");
     await p.getByLabel("비밀번호").fill("fixture-only");await button.click({timeout:4000});
     if(mode==="ok")await p.waitForURL(origin+"/tennis-note-coach-app/",{timeout:4000});
     else await p.getByText("지정 코치와 지점을 확인하지 못했습니다.",{exact:false}).waitFor({timeout:4000});
     assert.equal(await p.evaluate(()=>sessionStorage.getItem("tennis-note-supabase-session")!==null),mode==="ok");
    }
    assert.deepEqual([auth,proof,entered,unexpected],
     [["existing","wrong-runtime","wrong-mail"].includes(mode)?0:1,["existing","wrong-runtime","wrong-mail","auth-fail"].includes(mode)?0:1,mode==="ok"?1:0,0],mode);
   }finally{await ctx.close();}
  }
  console.log(engine+": 9/9 isolated form/session/role cases; zero live traffic");
 }finally{await browser.close();}
}
