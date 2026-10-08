const { chromium, webkit } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");


const engineName = String(process.env.TENNISNOTE_BROWSER_ENGINE || "chromium").toLowerCase();
const engine = engineName === "webkit" ? webkit : chromium;
const viewports = [
  { width: 320, height: 780 }, { width: 360, height: 800 }, { width: 375, height: 812 },
  { width: 390, height: 844 }, { width: 393, height: 852 }, { width: 402, height: 874 },
  { width: 412, height: 915 }, { width: 430, height: 932 }, { width: 768, height: 1024 },
  { width: 1366, height: 900 }, { width: 667, height: 375 }, { width: 844, height: 390 },
  { width: 932, height: 430 },
];
const colorSchemes = ["light", "dark"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const http = require("node:http");
const root = path.resolve(__dirname, "..");
// 실제 modular HTML과 이벤트를 사용하되 외부 Auth/SMS/DB는 차단한다.
async function profileContracts(page) {
  return page.evaluate(async () => {
    const checks = {};
    const check = (name, condition) => { checks[name] = Boolean(condition); };
    const client = window.TennisNoteDataClient;
    const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const phone = (n) => `01${"0".repeat(7)}${String(n).padStart(2, "0")}`;
    const oldPhone = phone(1), nextPhone = phone(3), otherPhone = phone(4);
    const profileId = id(1), authId = id(101);
    let currentAuthId = authId;
    let authUser = { id: authId, user_metadata: {} };
    let sends = 0, verifies = 0;
    const rpcCalls = [];
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    client.getSession = () => ({ access_token: "synthetic-session", user: { id: currentAuthId } });
    client.getAuthUser = async () => authUser;
    client.getAuthSettings = async () => ({ external: { phone: true, email: true } });
    client.requestPhoneChangeVerification = async () => { sends += 1; return { ok: true }; };
    client.verifyPhoneChange = async () => {
      verifies += 1;
      authUser = { id: authId, phone: `82${nextPhone.slice(1)}`, phone_confirmed_at: new Date().toISOString() };
      return { ok: true };
    };
    const reply = (parameters) => ({ ok: true, phoneVerified: parameters.target_profile.phone !== oldPhone,
      profile: { id: profileId, ...parameters.target_profile } });
    client.rpc = async (name, parameters) => { rpcCalls.push({ name, parameters }); return reply(parameters); };
    client.updateRows = async (_table, filter) => [{ id: filter.id }];
    state.member = { ...state.member, id: profileId, profileId, authUserId: authId };
    state.liveProfileId = profileId;
    state.profile.name = "합성 회원"; state.profile.nickname = "합성별명"; state.profile.phone = oldPhone;
    document.querySelector("#identitySetupModal").hidden = true;
    document.querySelector("#brandSplash").hidden = true;
    // Auth is synthetic; expose the approved app surface instead of measuring
    // descendants of the intentionally hidden logged-out screen (height zero).
    document.querySelector("#loginScreen").hidden = true;
    document.querySelector("#appScreen").hidden = false;
    document.body.dataset.screen = "app";
    renderProfile();
    navigateMemberView("profileView");
    openProfileEditor();
    await tick();
    const input = document.querySelector("#profilePhoneInput");
    const status = document.querySelector("#profilePhoneStatus");
    const code = document.querySelector("#profilePhoneCode");
    const send = document.querySelector("#profilePhoneSendButton");
    const row = document.querySelector("#profilePhoneCodeRow");
    const setPhone = (value) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); };
    const save = () => persistIdentityProfile({ realName: "합성 회원", nickname: "합성별명", phone: input.value, profileEditor: true });
    const rejected = async (fn) => { try { await fn(); return ""; } catch (error) { return error.message; } };
    await save();
    check("unchanged_no_sms_no_fake_proof", sends === 0 && rpcCalls.length === 1 && !status.classList.contains("is-verified"));
    check("dedicated_rpc_not_signup", rpcCalls.every((call) => call.name === "tn_save_my_verified_profile_phone"));
    check("profile_save_does_not_invent_signup_completion_consent", !state.profile.profileCompletedAt && !state.profile.privacyConsentedAt);
    setPhone(otherPhone); markIdentityPhoneVerified(nextPhone, "server", "profile");
    check("late_proof_cannot_mark_different_input_verified", profilePhoneVerification.status !== "verified" && !status.classList.contains("is-verified"));
    setPhone(oldPhone);
    const liveSession = client.getSession;
    client.getSession = () => null;
    check("lost_session_cannot_save_local_profile", await rejected(save) === "login_required" && rpcCalls.length === 1);
    client.getSession = liveSession;
    setPhone(nextPhone);
    authUser = { id: authId, user_metadata: { phone: nextPhone, phone_verified: true } };
    const beforeUnverified = rpcCalls.length;
    check("metadata_hint_cannot_verify_profile", await rejected(save) === "phone_verification_required" && rpcCalls.length === beforeUnverified);
    authUser = { id: authId, user_metadata: {} };
    client.getAuthSettings = async () => ({ external: { phone: false } });
    const beforeOff = sends;
    check("profile_capability_off_rpc_sms_zero", await requestIdentityPhoneVerification("profile") === false && send.disabled && sends === beforeOff);
    client.getAuthSettings = async () => { throw new TypeError("Failed to fetch"); };
    check("profile_unknown_capability_retry_without_sms", await requestIdentityPhoneVerification("profile") === false && !send.disabled && sends === beforeOff);
    client.getAuthSettings = async () => ({ external: { phone: true, email: true } });
    client.requestPhoneChangeVerification = async () => { sends += 1; throw Object.assign(new Error("Request failed"), { code: "phone_exists" }); };
    const beforeDuplicate = sends;
    await Promise.all([requestIdentityPhoneVerification("profile"), requestIdentityPhoneVerification("profile")]);
    check("duplicate_request_failure_once_draft_retry", sends === beforeDuplicate + 1 && !send.disabled && row.hidden
      && normalizeIdentityPhone(input.value) === nextPhone && status.classList.contains("is-error"));
    client.requestPhoneChangeVerification = async () => { sends += 1; return { ok: true }; };
    send.click(); await tick();
    check("profile_dom_request_entry_pending", !row.hidden && send.textContent.includes("다시 받기"));
    code.value = "123456";
    client.verifyPhoneChange = async () => { verifies += 1; throw Object.assign(new Error("expired"), { code: "otp_expired" }); };
    const expiry = await confirmIdentityPhoneVerification("profile");
    check("expiry_requires_resend_preserves_phone", expiry === false && row.hidden && !send.disabled && status.textContent.includes("만료")
      && normalizeIdentityPhone(input.value) === nextPhone);
    await requestIdentityPhoneVerification("profile");
    code.value = "123456";
    client.verifyPhoneChange = async () => { verifies += 1; throw Object.assign(new Error("mismatch"), { code: "phone_otp_invalid" }); };
    check("otp_error_retry_not_save", await confirmIdentityPhoneVerification("profile") === false && !row.hidden && status.textContent.includes("6자리"));
    let releaseVerify;
    client.verifyPhoneChange = async () => { verifies += 1; await new Promise((resolve) => { releaseVerify = resolve; }); };
    const changedDuringVerify = confirmIdentityPhoneVerification("profile");
    setPhone(otherPhone); releaseVerify();
    check("input_change_discards_late_otp", await changedDuringVerify === false && profilePhoneVerification.status !== "verified" && row.hidden);
    setPhone(nextPhone);
    authUser = { id: authId, user_metadata: {} };
    await requestIdentityPhoneVerification("profile"); code.value = "123456";
    client.verifyPhoneChange = async () => {
      verifies += 1; await tick();
      authUser = { id: authId, phone: `82${nextPhone.slice(1)}`, phone_confirmed_at: new Date().toISOString() };
    };
    const beforeVerify = verifies;
    const confirmed = await Promise.all([confirmIdentityPhoneVerification("profile"), confirmIdentityPhoneVerification("profile")]);
    check("confirm_once_exact_fresh_auth", confirmed[0] && !confirmed[1] && verifies === beforeVerify + 1 && row.hidden && send.disabled);
    const keys = [];
    client.rpc = async (name, parameters) => {
      rpcCalls.push({ name, parameters }); keys.push(parameters.target_operation_key);
      if (keys.length === 1) throw new TypeError("Failed to fetch");
      return reply(parameters);
    };
    check("response_loss_draft_original_retained", await rejected(save) === "Failed to fetch" && state.profile.phone === oldPhone
      && normalizeIdentityPhone(input.value) === nextPhone && keys.length === 1);
    await save();
    check("manual_retry_same_operation_exact_readback", keys.length === 2 && keys[0] === keys[1] && state.profile.phone === nextPhone);
    check("payload_has_no_role_link_membership", rpcCalls.every(({ parameters }) => parameters.target_profile_id === profileId
      && Object.keys(parameters.target_profile).sort().join(",") === "name,nickname,phone"));
    setPhone(otherPhone); authUser = { id: authId, phone: `82${otherPhone.slice(1)}`, phone_confirmed_at: new Date().toISOString() };
    client.rpc = async () => { throw new Error("profile_phone_stale"); };
    check("stale_save_original_and_draft_retained", await rejected(save) === "profile_phone_stale" && state.profile.phone === nextPhone
      && normalizeIdentityPhone(input.value) === otherPhone);
    client.rpc = async (_name, parameters) => ({ ...reply(parameters), profile: { ...parameters.target_profile, id: id(2) } });
    check("wrong_profile_readback_fail_closed", await rejected(save) === "profile_phone_readback_unconfirmed" && state.profile.phone === nextPhone);
    authUser = { id: authId, user_metadata: {} }; setPhone(phone(6));
    let releaseAuth;
    client.getAuthUser = () => new Promise((resolve) => { releaseAuth = resolve; });
    const staleRequest = requestIdentityPhoneVerification("profile");
    const beforeContextSend = sends;
    currentAuthId = id(102); releaseAuth(authUser);
    check("account_switch_before_request_sms_zero", await staleRequest === false && sends === beforeContextSend);
    currentAuthId = authId; client.getAuthUser = async () => authUser;
    closeAppSheet("profileEditorSheet", true, { immediate: true, discardDraft: false });
    openProfileEditor(); await tick();
    check("back_reopen_draft_preserved", normalizeIdentityPhone(input.value) === phone(6));
    let frozenDuringSave = false;
    client.rpc = async (name, parameters) => {
      rpcCalls.push({ name, parameters });
      frozenDuringSave = ["profileRealNameInput", "profileNicknameInput", "profilePhoneInput"].every((id) => document.getElementById(id).readOnly);
      await tick(); return reply(parameters);
    };
    setPhone(nextPhone); // unchanged baseline: saving must not require another OTP.
    const beforeSave = rpcCalls.length;
    const saveBackSettled = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("profile_save_back_not_settled")), 2000);
      window.addEventListener("popstate", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    await Promise.all([saveProfileInfo(), saveProfileInfo()]);
    await saveBackSettled; // Finish the real close/history lifecycle before reopening.
    check("save_click_lock_rpc_one", rpcCalls.length === beforeSave + 1 && !profileInfoSaving && frozenDuringSave && !input.readOnly);
    openProfileEditor(); await tick(); setPhone(phone(6));
    await requestIdentityPhoneVerification("profile");
    code.focus();
    const controls = [input, code, send, document.querySelector("#profilePhoneVerifyButton")];
    const sheet = document.querySelector("#profileEditorSheet");
    check("strict_invalid_future_proof_rejected", !verifiedPhoneFromAuthUser({ phone: nextPhone, phone_confirmed_at: "invalid" }, true)
      && !verifiedPhoneFromAuthUser({ phone: nextPhone, phone_confirmed_at: new Date(Date.now() + 86400000).toISOString() }, true));
    await new Promise((resolve, reject) => {
      const deadline = performance.now() + 2000;
      const settled = () => {
        const panel = sheet.querySelector("[data-tn-sheet-panel]");
        const transform = panel && getComputedStyle(panel).transform;
        const offset = transform && transform !== "none" ? new DOMMatrix(transform).m42 : 0;
        if (sheet.dataset.tnSheetInputReady === "true" && Math.abs(offset) < 0.2) resolve();
        else if (performance.now() > deadline) reject(new Error("profile_sheet_open_not_settled"));
        else requestAnimationFrame(settled);
      };
      settled();
    });
    // Finish the OTP's deferred focus/viewport adjustment before exercising a
    // manual scroll to its sibling button. Otherwise a later focus task scrolls
    // back to the code field and invalidates the measured manual-scroll result.
    await new Promise((resolve) => setTimeout(resolve, 240));
    window.TennisNoteBottomSheet.ensureFieldVisible("#profilePhoneVerifyButton");
    await new Promise((resolve) => setTimeout(resolve, 240));
    // Measure the final interactive surface, not fractional rects while the
    // shared sheet is still translating. Keep the exact 16px/44px thresholds.
    const controlGeometry = controls.map((element) => {
      const rect = element.getBoundingClientRect();
      return { id: element.id, height: rect.height, width: rect.width,
        font: parseFloat(getComputedStyle(element).fontSize), left: rect.left, right: rect.right };
    });
    check("controls_16px_44px", controlGeometry.every(({ height, width, font }) => height >= 44 && width > 0 && font >= 16));
    check("sheet_horizontal_overflow_zero", sheet.scrollWidth - sheet.clientWidth <= 1);
    check("phone_controls_inside_viewport", controlGeometry.every(({ left, right }) => left >= -1 && right <= innerWidth + 1));
    if (!checks.controls_16px_44px) throw new Error(JSON.stringify({ code: "profile_control_geometry_diagnosis", controls: controlGeometry }));
    const verifyRect = document.querySelector("#profilePhoneVerifyButton").getBoundingClientRect();
    const hit = document.elementFromPoint(verifyRect.left + verifyRect.width / 2, verifyRect.top + verifyRect.height / 2);
    check("scroll_to_verify_button_hit_target", verifyRect.top >= 0 && verifyRect.bottom <= innerHeight
      && Boolean(hit?.closest("#profilePhoneVerifyButton")));
    if (!checks.scroll_to_verify_button_hit_target) throw new Error(JSON.stringify({ code: "profile_verify_hit_diagnosis",
      top: verifyRect.top, bottom: verifyRect.bottom, viewportHeight: innerHeight, hitId: hit?.id,
      activeSheet: window.TennisNoteBottomSheet.activeId(), sheetHidden: sheet.hidden,
      activeElementId: document.activeElement?.id, scrollerBottom: sheet.querySelector("[data-tn-sheet-scroll]")?.getBoundingClientRect().bottom,
      sheetTop:sheet.getBoundingClientRect().top, sheetHeight:sheet.getBoundingClientRect().height,
      ancestorTransform:getComputedStyle(document.querySelector("#profileView")).transform,
      viewport:window.TennisNoteBottomSheet.viewportGeometry(), windowScroll:scrollY }));
    // Return only aggregate predicates, never contact, Auth, OTP or RPC payload.
    return checks;
  });
}
async function main() {
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,"http://127.0.0.1").pathname;
    const file=path.resolve(root,"."+decodeURIComponent(pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try {
      let data=fs.readFileSync(file);
      if(pathname.endsWith("/app.js")) data=Buffer.from(data.toString().replace("void initApp();","// 합성 검사: 실제 이벤트는 직접 바인딩"));
      res.writeHead(200,{"content-type":pathname.endsWith(".js")?"text/javascript":pathname.endsWith(".css")?"text/css":pathname.endsWith(".html")?"text/html":"application/octet-stream","cache-control":"no-store"});res.end(data);
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let contexts=0,predicates=0;
  try {
    for(const selected of ["chromium","webkit"]){
      if(process.env.TENNISNOTE_BROWSER_ENGINE && process.env.TENNISNOTE_BROWSER_ENGINE!==selected)continue;
      const browser=await (selected==="webkit"?webkit:chromium).launch({headless:true});
      try {
        for(const colorScheme of colorSchemes) for(const viewport of viewports){
          const context=await browser.newContext({viewport,colorScheme,serviceWorkers:"block"});
          await context.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
          const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
          await page.goto(`${origin}/app/tennis-note-member-app/index.html`,{waitUntil:"load"});
          await page.waitForFunction(()=>typeof saveProfileInfoOnce==="function");
          await page.evaluate(()=>{
            window.__tennisNoteBootReady?.();document.querySelector("#brandSplash").style.display="none";
            window.TennisNoteDataClient.readiness=()=>({ready:true});
            bindProfileEvents();identityAuthCapabilities={status:"ready",providers:{phone:true},checkedAt:Date.now()};
          });
          const result=await profileContracts(page);
          for(const [name,ok] of Object.entries(result))assert(ok,`${selected}/${viewport.width}/${colorScheme}: ${name}`);
          assert(errors.length===0,`page_errors:${errors.join("|")}`);
          predicates+=Object.keys(result).length;contexts++;
          await context.close();
        }
      } finally {await browser.close();}
    }
    console.log(JSON.stringify({status:"PASS",modularEntry:true,contexts,predicates,externalWrites:0,actualDevice:"NOT VERIFIED"}));
  } finally {await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error("FAIL "+e.message);process.exitCode=1;});
