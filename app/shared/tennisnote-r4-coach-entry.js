/* 기존 회원 로그인에서 서버가 확인한 소속 코치 진입만 연결한다. */
(function (root) {
  "use strict";
  const client = root.TennisNoteDataClient;
  const targets = {
    "https://tennisnote-app.pages.dev": ["production", "cnympiwrwgouuvhaivbc", "3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a"],
    "https://tennisnote-app-dev.pages.dev": ["development", "udjmiezroipctytmztwz", "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba"],
  };
  const native = root.Capacitor?.isNativePlatform?.() === true;
  const platform = root.Capacitor?.getPlatform?.();
  const nativeOrigin = native && ((platform === "android" && root.location.origin === "https://localhost")
    || (platform === "ios" && root.location.protocol === "capacitor:" && root.location.hostname === "localhost"));
  const target = native ? (nativeOrigin ? targets["https://tennisnote-app.pages.dev"] : null) : targets[root.location.origin];
  const config = client?.loadConfig?.();
  const bound = Boolean(target && client?.rpc && config?.environment === target[0]
    && config.supabaseUrl === "https://" + target[1] + ".supabase.co" && config.projectFingerprint === target[2]);
  const ready = (async () => {
    if (!bound) return false;
    if (!native) return true;
    try {
      const app = root.Capacitor.registerPlugin?.("App", {}) || root.Capacitor.Plugins?.App;
      const info = await Promise.race([
        app.getInfo(),
        new Promise((_, reject) => root.setTimeout(() => reject(Error("native_info_timeout")), 3000)),
      ]);
      return info?.id === "com.tennisclubhouse.tennisnote";
    } catch { return false; }
  })();
  const uuid = value => typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
  let generation = 0, capability = null;
  const reset = () => { capability = null; return ++generation; };
  const accepts = attempt => attempt === generation;
  const canUse = member => Boolean(capability && capability.auth === client?.sessionSubject?.()
    && member?.authUserId === capability.auth && member?.profileId === capability.profile);
  async function refresh({ user, profile, coachRole, attempt }) {
    if (!accepts(attempt) || !await ready || !accepts(attempt)) return false;
    const who = user?.id;
    if (!uuid(who) || !uuid(profile?.id) || client.sessionSubject() !== who) return false;
    if (coachRole?.status === "approved") return false; // 기존 전역 코치 판정은 그대로 둔다.
    try {
      const branches = await Promise.race([
        client.rpc("tn_r4_my_scoped_coach_branches", {}, { requireCurrentSession: true, retryAuth: false }),
        new Promise((_, reject) => root.setTimeout(() => reject(Error("coach_entry_timeout")), 4000)),
      ]);
      if (!accepts(attempt) || client.sessionSubject() !== who) return false;
      if (!Array.isArray(branches) || !branches.length || branches.some(item => !uuid(item.id) || typeof item.name !== "string")
        || new Set(branches.map(item => item.id)).size !== branches.length) return false;
      capability = { auth: who, profile: profile.id };
      return true;
    } catch { return false; }
  }
  const memberUrl = () => new URL(native ? "../tennis-note-member-app/index.html?mode=member" : "/?mode=member", root.location.href).href;
  const coachUrl = () => new URL("../tennis-note-coach-app/index.html?view=todayView", root.location.href).href;
  const requested = () => {
    try { return root.sessionStorage.getItem("tennis-note-r4-coach-return") === "1"; } catch { return false; }
  };
  const remember = value => {
    try { if (value) root.sessionStorage.setItem("tennis-note-r4-coach-return", "1");
      else root.sessionStorage.removeItem("tennis-note-r4-coach-return"); } catch { /* 저장소 차단이면 자동 복귀하지 않는다. */ }
  };
  root.TennisNoteR4CoachEntry = Object.freeze({ ready, bound, reset, accepts, refresh, canUse, memberUrl, coachUrl, requested, remember });
})(window);
