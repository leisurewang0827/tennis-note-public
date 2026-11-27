// 공식 개발 Auth의 성공 응답은 지정 코치·지점 확인 전에는 앱에 저장하지 않는다.
// 이 코드는 동결된 공식 client의 전용 사본 내부에서만 사용한다.
const qaOrigin = "https://tennisnote-app-dev.pages.dev";
const qaProject = "https://udjmiezroipctytmztwz.supabase.co";
const qaFingerprint = "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
const qaMailTag = "__MAIL_TAG__", qaScopeTag = "__SCOPE_TAG__";
function qaExact() {
  const c = loadConfig(), f = window.TENNISNOTE_CONFIG;
  return location.href === qaOrigin + "/qa-coach-login" && window.top === window.self &&
    !navigator.serviceWorker?.controller && c.environment === "development" &&
    c.projectFingerprint === qaFingerprint && c.supabaseUrl === qaProject &&
    f?.environment === c.environment && f.projectFingerprint === c.projectFingerprint &&
    f.supabaseUrl === c.supabaseUrl && !!f.supabasePublishableKey &&
    f.supabasePublishableKey === c.supabasePublishableKey;
}
function qaEmpty() {
  return !(authStorageKey in window.localStorage) && !(authStorageKey in window.sessionStorage) && !sessionSubject();
}
async function qaTag(kind, value) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("tn-dev-coach:v1:" + kind + ":" + value));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function qaBeforeAuth(email) {
  if (!qaExact() || !qaEmpty() || await qaTag("mail", email) !== qaMailTag) throw Error("scope");
}
async function qaBeforeSave(payload, email) {
  const u = payload?.user;
  if (!qaExact() || !qaEmpty() || !payload?.access_token || !payload.refresh_token ||
      !u?.id || u.email?.toLowerCase() !== email || sessionSubject({access_token: payload.access_token}) !== u.id) throw Error("session");
  const response = await fetch(qaProject + "/rest/v1/rpc/tn_dev_normal_coach_work", {
    method: "POST", credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
    headers: {apikey: loadConfig().supabasePublishableKey, Authorization: "Bearer " + payload.access_token,
      "Content-Type": "application/json"}, body: "{}"
  });
  if (!response.ok) throw Error("scope");
  const work = await response.json(), s = work?.self;
  if (work?.eligible !== true || work.assigned !== false || !s ||
      ![u.id,s.actorId,s.coachRoleId,s.branchId].every(v=>typeof v === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(v)) ||
      await qaTag("scope",[u.id,s.actorId,s.coachRoleId,s.branchId].join(":")) !== qaScopeTag ||
      !qaExact() || !qaEmpty()) throw Error("scope");
  setSessionPersistence(false);
}
function qaForm() {
  const form = document.querySelector("form"), fields = form.querySelector("fieldset"), status = document.querySelector("[role=status]");
  let started = false;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (started || !event.isTrusted || !qaExact() || !qaEmpty() || !form.reportValidity()) return;
    started = true; fields.disabled = true;
    try {
      await signInWithPassword(form.elements.email.value, form.elements.password.value);
      if (!sessionSubject() || !qaExact()) throw Error("session");
      location.replace(qaOrigin + "/tennis-note-coach-app/");
    } catch { status.textContent = "지정 코치와 지점을 확인하지 못했습니다. 수업은 변경되지 않았습니다."; }
    finally { form.elements.password.value = ""; }
  });
  if (!qaExact() || !qaEmpty()) {
    status.textContent = "기존 로그인은 그대로 유지됩니다. 서울 개발 주소의 새 비공개 창에서만 이용할 수 있습니다.";
    return;
  }
  fields.disabled = false;
  status.textContent = "등록된 검증 계정으로 로그인하세요.";
}
qaForm();
