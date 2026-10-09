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
    let sends = 0, verifies = 0, patches = 0;
    const revision = "2026-01-01T00:00:00.000Z";
    const rpcCalls = [];
    const durableReads = [];
    let savedProfileRow = null;
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    client.getSession = () => ({ access_token: "synthetic-session", user: { id: currentAuthId } });
    client.selectRows = async (table, options) => {
      durableReads.push({ table, options });
      if (table !== "tn_users" || options.filters?.id !== profileId
        || Object.keys(options.filters || {}).length !== 1 || options.limit !== 2
        || options.requireFresh !== true || options.requireCurrentSession !== true || options.retryAuth !== false)
        throw new Error("unexpected_durable_read");
      return savedProfileRow ? [structuredClone(savedProfileRow)] : [];
    };
    client.getAuthUser = async () => authUser;
    client.getAuthSettings = async () => ({ external: { phone: true, email: true } });
    client.requestPhoneChangeVerification = async () => { sends += 1; return { ok: true }; };
    client.verifyPhoneChange = async () => {
      verifies += 1;
      authUser = { id: authId, phone: `82${nextPhone.slice(1)}`, phone_confirmed_at: new Date().toISOString() };
      return { ok: true };
    };
    const reply = (parameters) => {
      const { expected_revision, ...values } = parameters.target_profile;
      const profile = { id: profileId, role: "member", status: "active", profile_photo_url: null, dominant_hand: "오른손", backhand_style: "투핸드 백핸드",
        tennis_started_on: null, tennis_goal: null, play_style_memo: null, self_ntrp: 2.5, ntrp_survey: {},
        ntrp_requested_at: parameters.target_profile.ntrp_requested ? revision : null,
        ...values, updated_at: revision };
      savedProfileRow = structuredClone(profile);
      return { ok: true, phoneVerified: parameters.target_profile.phone !== oldPhone,
        styleSaved: Boolean(expected_revision), profileContract: "atomic-self-profile/1", profile };
    };
    client.rpc = async (name, parameters) => { rpcCalls.push({ name, parameters }); return reply(parameters); };
    // Hosted-like failure, not the old unrestricted test double.
    client.updateRows = async () => { patches += 1; throw Object.assign(new Error("permission denied"), { code: "42501" }); };
    state.member = { ...state.member, id: profileId, profileId, authUserId: authId, role: "member", status: "active" };
    state.liveProfileId = profileId;
    state.profile.name = "합성 회원"; state.profile.nickname = "합성별명"; state.profile.phone = oldPhone;
    state.profile.serverRevision = revision;
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
    const beforeSaveReads = durableReads.length;
    document.querySelector("#profileGoal").value = "합성 새 목표";
    const saveBackSettled = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("profile_save_back_not_settled")), 2000);
      window.addEventListener("popstate", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    await Promise.all([saveProfileInfo(), saveProfileInfo()]);
    await saveBackSettled; // Finish the real close/history lifecycle before reopening.
    check("save_click_lock_rpc_one", rpcCalls.length === beforeSave + 1 && !profileInfoSaving && frozenDuringSave && !input.readOnly);
    check("atomic_style_save_no_direct_patch", patches === 0 && state.profile.goal === "합성 새 목표"
      && rpcCalls.at(-1).parameters.target_profile.tennis_goal === "합성 새 목표");
    check("atomic_save_fresh_exact_self_read", durableReads.length === beforeSaveReads + 1
      && savedProfileRow.tennis_goal === state.profile.goal);
    openProfileEditor(); await tick();
    const savedGoal = state.profile.goal;
    document.querySelector("#profileGoal").value = "합성 보존할 초안";
    const beforeFailure = rpcCalls.length;
    client.rpc = async (name, parameters) => { rpcCalls.push({name,parameters}); throw Object.assign(new Error("permission denied"), {code:"42501"}); };
    check("permission_failure_not_success_draft_preserved", await saveProfileInfo() === false
      && state.profile.goal === savedGoal && document.querySelector("#profileGoal").value === "합성 보존할 초안"
      && !document.querySelector("#profileEditorSheet").hidden && rpcCalls.length === beforeFailure + 1 && patches === 0);
    check("permission_failure_no_retry_advice", profileSaveErrorMessage({code:"42501"}).includes("관리자"));
    const lossKeys = [];
    client.rpc = async (name, parameters) => { lossKeys.push(parameters.target_operation_key); throw new TypeError("Failed to fetch"); };
    await saveProfileInfo();
    check("unknown_result_not_all_failed", profileSaveErrorMessage(new TypeError("Failed to fetch")).includes("결과를 확인하지 못했습니다")
      && state.profile.goal === savedGoal && !document.querySelector("#profileEditorSheet").hidden);
    client.rpc = async (name, parameters) => { lossKeys.push(parameters.target_operation_key); return reply(parameters); };
    const settleReplay = new Promise(resolve=>window.addEventListener("popstate",resolve,{once:true}));
    check("response_loss_atomic_replay_success", await saveProfileInfo() === true);
    await settleReplay;
    check("response_loss_same_key_no_patch", lossKeys.length === 2 && lossKeys[0] === lossKeys[1] && patches === 0);
    const priorRequested = state.profile.ntrpCheckRequested;
    client.rpc = async () => { throw new Error("profile_revision_stale"); };
    check("ntrp_failed_no_local_export_success", await requestNtrpCheck() === false && state.profile.ntrpCheckRequested === priorRequested);
    let ntrpCalls = 0;
    client.rpc = async (name, parameters) => { ntrpCalls++; await tick(); return reply(parameters); };
    const ntrpResults = await Promise.all([requestNtrpCheck(),requestNtrpCheck()]);
    check("ntrp_self_rpc_once_no_otp_no_coach_rating", ntrpResults[0] && !ntrpResults[1] && ntrpCalls === 1
      && patches === 0 && state.profile.ntrpCheckRequested);
    const savedRevision = state.profile.serverRevision;
    state.profile.serverRevision = "";
    check("no_revision_fail_closed_no_rpc", await requestNtrpCheck() === false && ntrpCalls === 1);
    state.profile.serverRevision = savedRevision;
    check("unknown_fields_fail_closed", !(await updateMemberProfileOnServer({coach_ntrp:4})).ok && ntrpCalls === 1);
    client.rpc = async (_name,parameters)=>({...reply(parameters),styleSaved:false});
    check("old_server_cannot_fake_style_success", !(await updateMemberProfileOnServer({tennis_goal:"합성 서버 계약"})).ok);
    client.rpc = async (_name,parameters)=>reply(parameters);
    // Independent review regressions use the actual UI functions and DOM. No
    // external Auth/SMS/DB calls or raw values leave this page-memory fixture.
    openProfileEditor(); await tick();
    const draftIds = ["profileRealNameInput", "profileNicknameInput", "profilePhoneInput",
      "profileHand", "profileBackhand", "profileStartedAt", "profileGoal", "profileStyleMemo"];
    const draftSnapshot = () => JSON.stringify(draftIds.map(id => document.getElementById(id).value));
    document.querySelector("#profileRealNameInput").value = "합성 초안 이름";
    document.querySelector("#profileNicknameInput").value = "합성새별명";
    setPhone(otherPhone);
    document.querySelector("#profileGoal").value = "저장하지 않은 합성 목표";
    document.querySelector("#profileStyleMemo").value = "저장하지 않은 합성 메모";
    state.profile.photoDataUrl = "https://fixture.invalid/unsaved-photo.png";
    const unsavedDraft = draftSnapshot(), unsavedPhoto = state.profile.photoDataUrl;
    const previousSavedGoal = state.profile.goal, previousSavedMemo = state.profile.styleMemo;
    const reviewCalls = [];
    const revisedReply = (parameters, nextRevision) => {
      const result = reply(parameters);
      result.profile.updated_at = nextRevision;
      savedProfileRow = structuredClone(result.profile);
      return result;
    };
    client.rpc = async (name, parameters) => { reviewCalls.push({name,parameters}); throw Object.assign(new Error("permission denied"), {code:"42501"}); };
    check("review_ntrp_failure_preserves_open_draft", await requestNtrpCheck() === false
      && draftSnapshot() === unsavedDraft && state.profile.photoDataUrl === unsavedPhoto
      && !document.querySelector("#profileEditorSheet").hidden);
    client.rpc = async (name, parameters) => { reviewCalls.push({name,parameters}); return revisedReply(parameters,"2026-01-01T00:00:02.000Z"); };
    check("review_ntrp_success_preserves_open_draft", await requestNtrpCheck() === true
      && draftSnapshot() === unsavedDraft && state.profile.photoDataUrl === unsavedPhoto
      && !document.querySelector("#profileEditorSheet").hidden
      && state.profile.goal === previousSavedGoal && state.profile.styleMemo === previousSavedMemo);
    check("review_ntrp_only_explicit_fields_and_revision_readback", reviewCalls.every(({parameters}) =>
      !Object.hasOwn(parameters.target_profile,"tennis_goal") && !Object.hasOwn(parameters.target_profile,"play_style_memo")
      && parameters.target_profile.phone === nextPhone)
      && profilePhoneEditorOwner.revision === state.profile.serverRevision);

    const replayCalls = [];
    client.rpc = async (name, parameters) => { replayCalls.push({name,parameters}); throw new TypeError("Failed to fetch"); };
    check("review_atomic_loss_fail_closed", !(await updateMemberProfileOnServer({tennis_goal:"합성 재확인 목표"})).ok);
    client.rpc = async (name, parameters) => { replayCalls.push({name,parameters}); return revisedReply(parameters,state.profile.serverRevision); };
    check("review_atomic_loss_same_revision_exact_replay", (await updateMemberProfileOnServer({tennis_goal:"합성 재확인 목표"})).ok
      && JSON.stringify(replayCalls[0].parameters) === JSON.stringify(replayCalls[1].parameters));
    client.rpc = async (name, parameters) => { replayCalls.push({name,parameters}); throw new Error("profile_revision_stale"); };
    check("review_stale_no_auto_retry", !(await updateMemberProfileOnServer({tennis_goal:"합성 재확인 목표"})).ok && replayCalls.length === 3);
    state.profile.serverRevision = "2026-01-01T00:00:03.000Z"; // authoritative refresh, not automatic retry
    client.rpc = async (name, parameters) => { replayCalls.push({name,parameters}); return revisedReply(parameters,state.profile.serverRevision); };
    check("review_fresh_revision_rotates_key_and_payload", (await updateMemberProfileOnServer({tennis_goal:"합성 재확인 목표"})).ok
      && replayCalls.length === 4 && replayCalls[2].parameters.target_operation_key !== replayCalls[3].parameters.target_operation_key
      && replayCalls[3].parameters.target_profile.expected_revision === state.profile.serverRevision);
    profilePhoneEditorOwner = {...profilePhoneEditorOwner,revision:state.profile.serverRevision};

    for (const first of ["ntrp","save"]) {
      setPhone(nextPhone); // this case tests the mutation lock, not new-phone proof
      const currentDraft = draftSnapshot(); let releaseMutation;
      const interleaved = [];
      client.rpc = async (name, parameters) => {
        interleaved.push({name,parameters}); await new Promise(resolve=>{releaseMutation=resolve;});
        return revisedReply(parameters,state.profile.serverRevision);
      };
      const pending = first === "ntrp" ? requestNtrpCheck() : saveProfileInfo();
      while (!releaseMutation) await tick();
      check(`review_${first}_both_controls_busy`, document.querySelector("#saveProfileInfo").disabled
        && document.querySelector("#requestNtrpCheck").disabled);
      const blocked = await Promise.all([requestNtrpCheck(),saveProfileInfo()]);
      check(`review_${first}_interleaving_rpc_one`, blocked.every(value=>value===false) && interleaved.length === 1);
      let settled = Promise.resolve();
      if (first === "save") settled = new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error("review_save_back_not_settled")),2000);
        window.addEventListener("popstate",()=>{clearTimeout(timer);resolve();},{once:true});
      });
      releaseMutation(); const completed = await pending; await settled;
      check(`review_${first}_completion_restores_controls`, completed && interleaved.length === 1
        && !profileInfoSaving && !ntrpCheckSaving
        && !document.querySelector("#saveProfileInfo").disabled && !document.querySelector("#requestNtrpCheck").disabled);
      if (first === "ntrp") check("review_ntrp_no_rerender_close", draftSnapshot() === currentDraft
        && !document.querySelector("#profileEditorSheet").hidden);
      else { openProfileEditor(); await tick(); }
    }
    check("review_all_direct_patches_zero", patches === 0);
    check("review_all_successes_use_fresh_self_readback", durableReads.length >= 6
      && durableReads.every(({ table, options }) => table === "tn_users" && options.filters.id === profileId
        && options.requireFresh === true && options.requireCurrentSession === true && options.retryAuth === false));
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
    const verifyButton = document.querySelector("#profilePhoneVerifyButton");
    const verifyStyle = getComputedStyle(verifyButton);
    const verifyText = document.createRange(); verifyText.selectNodeContents(verifyButton);
    const verifyLines = [...verifyText.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
    const verifyInnerWidth = verifyRect.width - parseFloat(verifyStyle.paddingLeft) - parseFloat(verifyStyle.paddingRight)
      - parseFloat(verifyStyle.borderLeftWidth) - parseFloat(verifyStyle.borderRightWidth);
    check("otp_confirm_one_line_and_44px_width", verifyRect.width >= 44 && verifyStyle.whiteSpace === "nowrap"
      && verifyLines.length === 1 && verifyLines[0].width <= verifyInnerWidth + 1);
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
// 실제 modular entry의 기본 10개 설문을 빈 선택값과 함께 전송한다.
// SQL/RPC 자체 증명은 private PG rollback acceptance가 별도로 담당한다.
async function optionalProfileContracts(page) {
  return page.evaluate(async () => {
    const checks = {}, check = (name, ok) => { checks[name] = Boolean(ok); };
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const phone = "01" + "0".repeat(7) + "81";
    const profileId = id(781), authId = id(881);
    const keys = ["rally", "forehand", "backhand", "serve", "return", "net", "game", "movement", "control", "doubles"];
    let server = { id: profileId, role: "member", status: "active", name: "합성 회원", nickname: "합성테니스", phone,
      profile_photo_url: null, dominant_hand: "오른손", backhand_style: "투핸드 백핸드",
      tennis_started_on: null, tennis_goal: null, play_style_memo: null, self_ntrp: null,
      ntrp_survey: {}, updated_at: "2026-01-01T00:00:00.000Z" };
    let sms = 0, patches = 0, commits = 0, calls = 0, reads = 0;
    const receipts = new Map();
    const client = window.TennisNoteDataClient;
    client.getSession = () => ({ access_token: "synthetic-only", user: { id: authId } });
    client.selectRows = async (table, options) => {
      reads++;
      if (table !== "tn_users" || options.filters?.id !== profileId
        || Object.keys(options.filters || {}).length !== 1 || options.limit !== 2
        || options.requireFresh !== true || options.requireCurrentSession !== true || options.retryAuth !== false)
        throw new Error("unexpected_optional_durable_read");
      return [structuredClone(server)];
    };
    client.getAuthUser = async () => ({ id: authId, phone: "82" + phone.slice(1), phone_confirmed_at: "2026-01-01T00:00:00Z" });
    client.getAuthSettings = async () => ({ external: { phone: true } });
    client.requestPhoneChangeVerification = async () => { sms++; throw new Error("unexpected_sms"); };
    client.updateRows = async () => { patches++; throw new Error("unexpected_patch"); };
    client.rpc = async (name, parameters) => {
      calls++;
      if (name !== "tn_save_my_verified_profile_phone") throw new Error("unexpected_rpc");
      const payload = parameters.target_profile;
      if (Object.keys(payload.ntrp_survey).some(key => !keys.includes(key))
        || Object.values(payload.ntrp_survey).some(value => ![1.5, 2, 2.5, 3, 3.5, 4].includes(value)))
        throw new Error("profile_style_input_invalid");
      check("actual_ten_survey_keys", JSON.stringify(Object.keys(payload.ntrp_survey)) === JSON.stringify(keys));
      check("empty_optionals_are_null_not_invalid_empty_date", ["profile_photo_url", "tennis_started_on", "tennis_goal", "play_style_memo", "self_ntrp"].every(key => payload[key] === null));
      check("existing_verified_identity_and_revision", parameters.target_profile_id === profileId
        && parameters.target_expected_phone === phone && payload.phone === phone
        && payload.expected_revision === "2026-01-01T00:00:00.000Z");
      if (receipts.has(parameters.target_operation_key)) return receipts.get(parameters.target_operation_key);
      await new Promise(resolve => setTimeout(resolve, 10));
      const { expected_revision, ...values } = payload;
      server = { ...server, ...values, updated_at: "2026-01-01T00:00:01.000Z" };
      const reply = { ok: true, phoneVerified: true, phoneChanged: false, styleSaved: true,
        profileContract: "atomic-self-profile/1", profile: { ...server } };
      receipts.set(parameters.target_operation_key, reply); commits++;
      return reply;
    };
    state.member = { ...state.member, id: profileId, profileId, authUserId: authId, role: "member", status: "active" };
    state.liveProfileId = profileId;
    Object.assign(state.profile, { name: server.name, nickname: server.nickname, phone, hand: server.dominant_hand,
      backhand: server.backhand_style, goal: "", styleMemo: "", startedAt: "", photoDataUrl: "", selfNtrp: "", ntrpSurvey: {}, serverRevision: server.updated_at });
    document.querySelector("#identitySetupModal").hidden = true;
    document.querySelector("#loginScreen").hidden = true;
    document.querySelector("#appScreen").hidden = false;
    document.body.dataset.screen = "app";
    renderProfile(); navigateMemberView("profileView"); openProfileEditor();
    // 미선택/비숫자 placeholder는 새 rating을 주지 않고 null로 직렬화한다.
    document.querySelector("#profileSelfNtrp").value = "";
    const before = ["profileRealNameInput", "profileNicknameInput", "profilePhoneInput", "profileHand", "profileBackhand"]
      .map(key => document.getElementById(key).value);
    const settled = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("optional_save_close_not_settled")), 3000);
      document.getElementById("profileEditorSheet").addEventListener("tennisnote:sheet-closed", () => {
        clearTimeout(timer); resolve();
      }, { once: true });
    });
    document.getElementById("saveProfileInfo").click();
    await settled;
    check("real_bound_click_rpc_once_and_closed", calls === 1 && commits === 1 && document.getElementById("profileEditorSheet").hidden);
    check("real_bound_click_fresh_self_read_once", reads === 1 && server.id === profileId);
    check("saved_empty_values_and_rating_not_fabricated", server.tennis_goal === null && server.play_style_memo === null
      && server.tennis_started_on === null && server.self_ntrp === null && state.profile.selfNtrp === "");
    openProfileEditor();
    check("reopen_existing_fields_unchanged", JSON.stringify(before) === JSON.stringify(
      ["profileRealNameInput", "profileNicknameInput", "profilePhoneInput", "profileHand", "profileBackhand"].map(key => document.getElementById(key).value)));
    check("reopen_optional_empty_and_full_survey_readback", ["profileStartedAt", "profileGoal", "profileStyleMemo"].every(key => document.getElementById(key).value === "")
      && JSON.stringify(state.profile.ntrpSurvey) === JSON.stringify(server.ntrp_survey));
    check("sms_and_direct_patch_zero", sms === 0 && patches === 0);
    return checks;
  });
}

// 실제 저장 버튼과 원본 함수만 실행한다. transport는 합성 메모리 경계다.
async function profileOperationStatusContracts(page, ownershipOnly = false) {
  return page.evaluate(async ownershipOnly => {
    const checks = {}, check = (name, ok) => { checks[name] = Boolean(ok); };
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    const until = async (predicate, label) => {
      for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); }
      throw new Error("operation_status_" + label);
    };
    const sheet = document.getElementById("profileEditorSheet");
    let toast;
    const button = document.getElementById("saveProfileInfo");
    const originalPersist = persistIdentityProfile;
    const client = window.TennisNoteDataClient;
    let calls = 0, externalCalls = 0, outcome = "failure", release;
    for (const method of ["rpc", "updateRows", "requestPhoneChangeVerification", "verifyPhoneChange"]) {
      client[method] = async () => { externalCalls++; throw new Error("unexpected_external_call"); };
    }
    client.getSession = () => null;
    client.getAuthUser = async () => null;
    client.getAuthSettings = async () => ({ external: { phone: true } });
    client.readiness = () => ({ ready: true });
    state.member = { ...state.member, role: "coach", id: "synthetic-profile" };
    Object.assign(state.profile, { name: "합성 코치", nickname: "합성테니스", phone: "",
      goal: "", styleMemo: "", startedAt: "", photoDataUrl: "", serverRevision: "synthetic-revision" });
    document.getElementById("identitySetupModal").hidden = true;
    document.getElementById("loginScreen").hidden = true;
    document.getElementById("appScreen").hidden = false;
    document.body.dataset.screen = "app";
    renderProfile(); navigateMemberView("profileView"); openProfileEditor(); await tick();
    document.getElementById("profileGoal").value = "합성 미저장 목표";
    const draftFields = ["profileRealNameInput", "profileNicknameInput", "profilePhoneInput",
      "profileGoal", "profileStyleMemo", "profileHand", "profileBackhand"];
    const draft = () => JSON.stringify(draftFields.map(id => document.getElementById(id).value));
    const before = draft(), verification = JSON.stringify(profilePhoneVerification);
    persistIdentityProfile = async values => {
      calls++;
      if (outcome === "failure") throw new Error("profile_style_input_invalid");
      await new Promise(resolve => { release = resolve; });
      // 합성 권위 readback 완료 뒤에만 성공한다. 실제 RPC/DB는 호출하지 않는다.
      state.profile.goal = values.profileStyle.tennis_goal || "";
      state.profile.styleMemo = values.profileStyle.play_style_memo || "";
      return { ok: true };
    };
    try {
      if (ownershipOnly) {
        for (const kind of ["owned", "different", "same", "missing"]) {
          if (sheet.hidden) { await tick(); openProfileEditor(); await tick(); }
          const expectedCalls = calls + 2;
          outcome = "failure"; release = null; button.click();
          await until(() => calls === expectedCalls - 1 && !profileInfoSaving, kind + "_failure");
          toast = document.getElementById("appToast");
          const failureText = toast.textContent, ownedNode = toast.firstChild;
          check(kind + "_failure_current_draft", !sheet.hidden && draft() === before
            && toast.classList.contains("is-visible") && failureText.includes("저장되지")
            && document.getElementById("profileNicknameStatus").textContent === failureText);
          if (kind === "same") showToast(failureText);
          if (kind === "different") showToast("다른 작업 안내");
          if (kind === "missing") toast.remove();
          const currentNode = toast.firstChild, currentText = toast.textContent;
          if (kind === "same" || kind === "different") check(kind + "_actual_producer_new_text_node",
            currentNode !== ownedNode && currentNode.nodeType === Node.TEXT_NODE);
          outcome = "success"; release = null; button.click();
          await until(() => calls === expectedCalls && typeof release === "function", kind + "_pending");
          if (kind === "owned") check("owned_exact_node_is_cleared", toast.textContent === "" && !toast.classList.contains("is-visible"));
          if (kind === "same" || kind === "different") check(kind + "_other_notice_preserved",
            toast.firstChild === currentNode && toast.textContent === currentText && toast.classList.contains("is-visible"));
          if (kind === "missing") check("missing_toast_fail_safe", !document.getElementById("appToast") && !sheet.hidden);
          check(kind + "_pending_draft_and_lock", !sheet.hidden && draft() === before && button.disabled
            && document.getElementById("requestNtrpCheck").disabled && draftFields.slice(0,3).every(id=>document.getElementById(id).readOnly));
          button.click(); check(kind + "_duplicate_ntrp_zero", await saveProfileInfo() === false
            && await requestNtrpCheck() === false && calls === expectedCalls);
          const closed = new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(Error("ownership_close")),3000);
            sheet.addEventListener("tennisnote:sheet-closed",()=>{clearTimeout(timer);resolve();},{once:true});
          });
          release(); await closed; await until(()=>!profileInfoSaving,kind+"_unlock");
          check(kind + "_success_after_readback", sheet.hidden
            && document.getElementById("appToast").textContent === "내 정보와 테니스 스타일을 저장했습니다."
            && state.member.role === "coach" && JSON.stringify(profilePhoneVerification) === verification
            && calls === expectedCalls && externalCalls === 0);
        }
        return checks;
      }
      button.click();
      await until(() => calls === 1 && !profileInfoSaving, "first_failure");
      toast = document.getElementById("appToast");
      const failureText = toast.textContent;
      check("bound_failure_once_current_error_draft_open", calls === 1 && !sheet.hidden
        && toast.classList.contains("is-visible") && failureText.includes("저장되지")
        && draft() === before && document.getElementById("profileNicknameStatus").textContent === failureText);
      outcome = "success"; button.click();
      await until(() => calls === 2 && typeof release === "function", "pending");
      check("owned_previous_error_cleared_while_pending", toast.textContent === ""
        && !toast.classList.contains("is-visible") && !sheet.hidden && draft() === before);
      check("pending_controls_and_identity_readonly", button.disabled
        && document.getElementById("requestNtrpCheck").disabled
        && draftFields.slice(0, 3).every(id => document.getElementById(id).readOnly));
      button.click();
      const duplicate = await saveProfileInfo(), ntrp = await requestNtrpCheck();
      check("duplicate_and_ntrp_mutation_zero", duplicate === false && ntrp === false && calls === 2);
      const closed = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("operation_status_close")), 3000);
        sheet.addEventListener("tennisnote:sheet-closed", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      release(); await closed; await until(() => !profileInfoSaving, "success_unlock");
      check("success_only_after_readback_replaces_previous_error", sheet.hidden
        && toast.textContent === "내 정보와 테니스 스타일을 저장했습니다."
        && toast.classList.contains("is-visible") && !toast.textContent.includes(failureText));
      check("success_unlock_role_verification_preserved", !button.disabled
        && !document.getElementById("requestNtrpCheck").disabled
        && draftFields.slice(0, 3).every(id => !document.getElementById(id).readOnly)
        && state.member.role === "coach" && JSON.stringify(profilePhoneVerification) === verification);
      await tick(); openProfileEditor(); await tick();
      check("saved_readback_reopen_keeps_draft_values", draft() === before && !sheet.hidden);
      outcome = "failure"; button.click();
      await until(() => calls === 3 && !profileInfoSaving, "second_failure");
      check("new_failure_is_current_not_success", toast.textContent === failureText && !sheet.hidden && draft() === before);
      showToast("다른 작업 안내"); outcome = "success"; release = null; button.click();
      await until(() => calls === 4 && typeof release === "function", "unrelated_pending");
      check("pending_does_not_erase_other_operation_notice", toast.textContent === "다른 작업 안내"
        && toast.classList.contains("is-visible") && draft() === before);
      release(); await until(() => !profileInfoSaving, "second_success");
      await until(() => sheet.hidden, "second_close");
      check("four_explicit_attempts_no_automatic_retry", calls === 4 && externalCalls === 0);
      check("success_current_operation_and_no_false_role_change", toast.textContent === "내 정보와 테니스 스타일을 저장했습니다."
        && state.member.role === "coach" && JSON.stringify(profilePhoneVerification) === verification);
      return checks;
    } finally { persistIdentityProfile = originalPersist; }
  }, ownershipOnly);
}

async function main() {
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,"http://127.0.0.1").pathname;
    const file=path.resolve(root,"."+decodeURIComponent(pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(pathname.endsWith("config.local.js")){res.writeHead(200,{"content-type":"text/javascript","cache-control":"no-store"}).end("window.TENNIS_NOTE_SUPABASE_CONFIG = {};");return;}
    try {
      let data=fs.readFileSync(file);
      if(pathname.endsWith("/app.js")) data=Buffer.from(data.toString().replace("void initApp();","// 합성 검사: 실제 이벤트는 직접 바인딩"));
      res.writeHead(200,{"content-type":pathname.endsWith(".js")?"text/javascript":pathname.endsWith(".css")?"text/css":pathname.endsWith(".html")?"text/html":"application/octet-stream","cache-control":"no-store"});res.end(data);
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const captureDir=process.env.TENNISNOTE_PROFILE_CAPTURE_DIR;
  const captureOnly=process.env.TENNISNOTE_PROFILE_CAPTURE_ONLY==="true";
  const optionalOnly=process.env.TENNISNOTE_PROFILE_OPTIONAL_ONLY==="true";
  const statusOnly=process.env.TENNISNOTE_PROFILE_STATUS_FOCUSED==="1";
  const ownershipOnly=process.env.TENNISNOTE_PROFILE_OWNERSHIP_FOCUSED==="1";
  assert(!captureOnly || captureDir,"capture_only_requires_private_output_directory");
  if(captureDir)fs.mkdirSync(captureDir,{recursive:true});
  let contexts=0,predicates=0;
  try {
    for(const selected of ["chromium","webkit"]){
      if(process.env.TENNISNOTE_BROWSER_ENGINE && process.env.TENNISNOTE_BROWSER_ENGINE!==selected)continue;
      const browser=await (selected==="webkit"?webkit:chromium).launch({headless:true,
        ...(selected==="chromium" && process.env.TENNISNOTE_CHROMIUM_EXECUTABLE ? {executablePath:process.env.TENNISNOTE_CHROMIUM_EXECUTABLE} : {})});
      try {
        for(const colorScheme of colorSchemes) for(const viewport of viewports){
          if(ownershipOnly && viewport.width!==390)continue;
          if(statusOnly && ![390,768,1366,844].includes(viewport.width))continue;
          if(captureOnly && ![390,768,1366].includes(viewport.width))continue;
          if(optionalOnly && ![390,768,1366].includes(viewport.width))continue;
          let context=await browser.newContext({viewport,colorScheme,serviceWorkers:"block"});
          await context.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
          let page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
          await page.goto(`${origin}/app/tennis-note-member-app/index.html`,{waitUntil:"load"});
          await page.waitForFunction(()=>typeof saveProfileInfoOnce==="function");
          await page.evaluate(()=>{
            window.__tennisNoteBootReady?.();document.querySelector("#brandSplash").style.display="none";
            window.TennisNoteDataClient.readiness=()=>({ready:true});
            bindProfileEvents();identityAuthCapabilities={status:"ready",providers:{phone:true},checkedAt:Date.now()};
          });
          const legacyResult=optionalOnly || statusOnly || ownershipOnly ? {} : await profileContracts(page);
          if(!optionalOnly && !statusOnly && !ownershipOnly){
            // Reload alone retains the legacy snapshot and its editor draft.
            // Isolate the second contract in a genuinely empty browser context.
            await context.close();
            context=await browser.newContext({viewport,colorScheme,serviceWorkers:"block"});
            await context.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
            page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
            await page.goto(`${origin}/app/tennis-note-member-app/index.html`,{waitUntil:"load"});
            await page.waitForFunction(()=>typeof saveProfileInfoOnce==="function");
            await page.evaluate(()=>{
              window.__tennisNoteBootReady?.();document.querySelector("#brandSplash").style.display="none";
              window.TennisNoteDataClient.readiness=()=>({ready:true});
              bindProfileEvents();identityAuthCapabilities={status:"ready",providers:{phone:true},checkedAt:Date.now()};
            });
          }
          const result=ownershipOnly ? await profileOperationStatusContracts(page,true) : statusOnly ? await profileOperationStatusContracts(page) : {...legacyResult,...await optionalProfileContracts(page)};
          if(!statusOnly && !captureOnly && !ownershipOnly) Object.assign(result, await profileOperationStatusContracts(page));
          for(const [name,ok] of Object.entries(result))assert(ok,`${selected}/${viewport.width}/${colorScheme}: ${name}`);
          assert(errors.length===0,`page_errors:${errors.join("|")}`);
          if(captureDir && [390,768,1366].includes(viewport.width)){
            await page.evaluate(()=>{
              // All Auth/RPC data are synthetic. Clear even synthetic contact
              // and OTP fields from private QA screenshots; keep OTP row open.
              document.querySelector("#profilePhoneInput").value="";
              document.querySelector("#profilePhoneCode").value="";
            });
            await page.screenshot({path:path.join(captureDir,`atomic-profile-${selected}-${viewport.width}-${colorScheme}.png`)});
          }
          predicates+=Object.keys(result).length;contexts++;
          await context.close();
        }
      } finally {await browser.close();}
    }
    console.log(JSON.stringify({status:"PASS",modularEntry:true,contexts,predicates,captureOnly,optionalOnly,statusOnly,ownershipOnly,externalWrites:0,actualDevice:"NOT VERIFIED"}));
  } finally {await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error("FAIL "+e.message);process.exitCode=1;});
