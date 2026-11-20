/* Local candidate: handoff carries scope only; the administrator server remains authoritative. */
(function (root) {
  "use strict";
  const key = "tennis-note-pending-absence-handoff-v1";
  const usedKey = "tennis-note-consumed-absence-handoff-v1";
  const prefix = "#tn-absence=";
  const maxAge = 5 * 60 * 1000;
  const allowedOrigins = new Set(["https://tennisnote-admin.pages.dev", "https://tennisnote-admin-dev.pages.dev", "https://r4-absence-group-qa.tennisnote-admin-dev.pages.dev"]);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let inFlight = false;

  async function runtime(client, surface) {
    try {
      const config = client?.loadConfig?.() || {};
      const environment = String(config.environment || "").toLowerCase();
      const targets = {
        production: {origin: "https://tennisnote-admin.pages.dev", app: "https://tennisnote-app.pages.dev", fingerprint: "3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a"},
        development: {origin: "https://tennisnote-admin-dev.pages.dev", app: "https://tennisnote-app-dev.pages.dev", previewOrigin: "https://r4-absence-group-qa.tennisnote-admin-dev.pages.dev", previewApp: "https://r4-absence-group-qa.tennisnote-app-dev.pages.dev", fingerprint: "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba"},
      };
      const target = targets[environment];
      const match = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(String(config.supabaseUrl || "").toLowerCase());
      if (!target || !match || config.projectFingerprint !== target.fingerprint || !root.crypto?.subtle || !root.TextEncoder) return "";
      const bytes = await root.crypto.subtle.digest("SHA-256", new root.TextEncoder().encode(match[1]));
      const actual = Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
      if (actual !== target.fingerprint) return "";
      const origin = String(root.location?.origin || "");
      const native = root.Capacitor?.isNativePlatform?.() === true && /^(?:(?:capacitor|ionic):\/\/localhost|https?:\/\/localhost)$/.test(origin);
      const preview = environment === "development" && (surface === "admin" ? origin === target.previewOrigin : surface === "coach" && origin === target.previewApp);
      if (surface === "admin" ? origin !== target.origin && !preview : surface !== "coach" || (origin !== target.app && !preview && !native)) return "";
      return preview ? target.previewOrigin : target.origin;
    } catch (_) { return ""; }
  }

  function valid(value, now = Date.now()) {
    if (!value || Object.keys(value).sort().join(",") !== "branchId,createdAt,date,lessonId,v") return false;
    if (value.v !== 1 || !uuid.test(value.branchId) || !uuid.test(value.lessonId)
      || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isSafeInteger(value.createdAt)
      || value.createdAt > now || now - value.createdAt > maxAge) return false;
    const parsed = new Date(`${value.date}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value.date;
  }

  function link(portal, scope, expectedOrigin, now = Date.now()) {
    if (!portal?.ok) throw new Error("portal_unavailable");
    const url = new URL(portal.url);
    if (!allowedOrigins.has(expectedOrigin) || url.origin !== expectedOrigin || url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("portal_invalid");
    const payload = {v: 1, branchId: scope.branchId, lessonId: scope.lessonId, date: scope.date, createdAt: now};
    if (!valid(payload, now)) throw new Error("scope_invalid");
    url.hash = prefix.slice(1) + encodeURIComponent(JSON.stringify(payload));
    return url.href;
  }

  function capture(location, history, storage, expectedOrigin, now = Date.now()) {
    if (!location.hash.startsWith(prefix)) return "none";
    let payload = null;
    try { payload = JSON.parse(decodeURIComponent(location.hash.slice(prefix.length))); } catch (_) { /* fail closed */ }
    if (!allowedOrigins.has(expectedOrigin) || location.origin !== expectedOrigin || !valid(payload, now)) return "invalid";
    try {
      const encoded = JSON.stringify(payload);
      if (storage.getItem(usedKey) === encoded || storage.getItem(key) === encoded) {
        history.replaceState(history.state, "", location.pathname + location.search);
        return "duplicate";
      }
      storage.setItem(key, encoded);
      if (storage.getItem(key) !== encoded) return "unavailable";
      history.replaceState(history.state, "", location.pathname + location.search);
      return "captured";
    } catch (_) { return "unavailable"; }
  }

  function hasPending(storage) {
    try { return storage.getItem(key) !== null; } catch (_) { return false; }
  }

  async function resume({storage, origin, expectedOrigin, role, authenticated, unlocked, selectedBranch, openLesson, isCurrent}, now = Date.now()) {
    if (inFlight) return "busy";
    let payload;
    try { payload = JSON.parse(storage.getItem(key)); } catch (_) {
      try { storage.removeItem(key); } catch (_) { /* storage unavailable: do not open */ }
      return "invalid";
    }
    if (!payload) return "none";
    if (!allowedOrigins.has(expectedOrigin) || origin !== expectedOrigin || !valid(payload, now)) return "invalid_or_expired";
    if (authenticated !== true) return "login_required";
    if (role !== "admin") return "admin_required";
    if (unlocked !== true) return "unlock_required";
    if (selectedBranch !== payload.branchId) return "branch_mismatch";
    if (typeof isCurrent !== "function" || isCurrent() !== true) return "context_changed";
    const encoded = JSON.stringify(payload);
    try {
      if (storage.getItem(usedKey) === encoded) return "duplicate";
    } catch (_) { return "unavailable"; }
    const stillCurrent = () => {
      try { return storage.getItem(key) === encoded && isCurrent() === true; } catch (_) { return false; }
    };
    inFlight = true;
    try {
      const opened = await openLesson({lessonId: payload.lessonId, lessonDate: payload.date, expectedBranchId: payload.branchId, absenceOnly: true, isCurrent: stillCurrent});
      if (opened !== true || !stillCurrent()) return "source_not_verified";
      try {
        storage.setItem(usedKey, encoded);
        if (storage.getItem(usedKey) !== encoded) return "opened_unsealed";
        if (storage.getItem(key) === encoded) storage.removeItem(key);
      } catch (_) { return "opened_unsealed"; }
      return "opened";
    } catch (_) { return "source_not_verified"; }
    finally { inFlight = false; }
  }
  root.TennisNoteAbsenceHandoff = Object.freeze({runtime, link, capture, hasPending, resume});
})(globalThis);
