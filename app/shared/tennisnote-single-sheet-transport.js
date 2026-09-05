(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TennisNoteSingleSheetRemotePreview = api;
})(globalThis, function (root) {
  "use strict";

  const PROTOCOL = "scoped-postgrest-import/2";
  const TIMEOUT_MS = 9000;
  const DEVELOPMENT_ORIGIN = "https://tennisnote-admin-dev.pages.dev";
  const PRODUCTION_ORIGIN = "https://tennisnote-admin.pages.dev";
  const ORIGINS = Object.freeze({ development: DEVELOPMENT_ORIGIN, production: PRODUCTION_ORIGIN });
  const ROW_KEYS = Object.freeze(["coach", "group", "name", "phone", "product", "slots", "startDate", "total", "used"]);
  const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const fail = code => { const error = new Error(code); error.code = code; throw error; };
  const sameScope = (a, b) => ["environment", "projectFingerprint", "branchId"].every(key => a?.[key] && a[key] === b?.[key]);
  const normalizedMode = value => ["preview", "apply"].includes(String(value || "").trim().toLowerCase())
    ? String(value).trim().toLowerCase()
    : "off";

  async function fingerprintFor(url) {
    const match = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(String(url || "").trim().toLowerCase());
    if (!match || !root.crypto?.subtle || typeof root.TextEncoder !== "function") return "";
    const bytes = await root.crypto.subtle.digest("SHA-256", new root.TextEncoder().encode(match[1]));
    return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
  }

  function sessionReady(session) {
    const token = String(session?.access_token || "");
    const part = token.split(".")[1] || "";
    if (!part) return false;
    try {
      const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      const payload = JSON.parse(root.atob(padded));
      return payload?.role === "authenticated" && Number(payload?.exp || 0) > Math.floor(Date.now() / 1000);
    } catch (_) {
      return false;
    }
  }

  function scopeFrom(client, getBranchId) {
    const config = client?.loadConfig?.() || {};
    return {
      config,
      scope: Object.freeze({
        environment: String(config.environment || "").trim().toLowerCase(),
        projectFingerprint: String(config.projectFingerprint || "").trim().toLowerCase(),
        branchId: String(getBranchId?.() || "").trim(),
      }),
      mode: normalizedMode(config.singleSheetImportMode),
      reverseEnabled: config.singleSheetImportReverseEnabled === true,
    };
  }

  function sessionGate(client, getBranchId, canOpen) {
    const current = scopeFrom(client, getBranchId);
    let reason = "";
    if (!ORIGINS[current.scope.environment] || String(root.location?.origin || "") !== ORIGINS[current.scope.environment]) reason = "SHEET_IMPORT_ENVIRONMENT_BLOCKED";
    else if (!digest(current.scope.projectFingerprint) || !uuid(current.scope.branchId)) reason = "TARGET_UNVERIFIED";
    else if (canOpen?.() !== true || !sessionReady(client?.getSession?.())) reason = "SHEET_IMPORT_SESSION_REQUIRED";
    else if (current.mode === "off") reason = "SHEET_IMPORT_SCOPE_DISABLED";
    return { ...current, reason };
  }

  async function inspect(client, getBranchId, canOpen) {
    const current = sessionGate(client, getBranchId, canOpen);
    if (!current.reason && current.scope.projectFingerprint !== await fingerprintFor(current.config.supabaseUrl)) {
      current.reason = "TARGET_OR_REVISION_MISMATCH";
    }
    return current;
  }

  function unitsValid(units) {
    if (!Array.isArray(units) || units.length < 1 || units.length > 500) return false;
    let rows = 0;
    for (const unit of units) {
      if (!unit || Object.keys(unit).length !== 1 || !Array.isArray(unit.rows) || unit.rows.length < 1 || unit.rows.length > 2) return false;
      rows += unit.rows.length;
      for (const row of unit.rows) {
        if (!row || Object.keys(row).sort().join("|") !== ROW_KEYS.join("|")) return false;
        if (!Array.isArray(row.slots) || row.slots.length > 3) return false;
      }
    }
    return rows <= 500;
  }

  function mutationArgsValid(unit, revision, planHash, expiresAt, fileHash, operationKey) {
    return unitsValid([unit]) && digest(revision) && digest(planHash) && digest(fileHash)
      && Number.isFinite(Date.parse(expiresAt)) && digest(operationKey);
  }

  function mapFailure(error, fallback) {
    const raw = `${error?.code || ""} ${error?.message || ""}`.toUpperCase();
    if (error?.status === 401 || raw.includes("ADMIN_SESSION_EXPIRED")) return "SHEET_IMPORT_SESSION_REQUIRED";
    if (error?.status === 403 && (raw.includes("42501") || raw.includes("SHEET_SCOPE_OFF_OR_MISMATCH") || raw.includes("SHEET_ADMIN_REQUIRED"))) return "SHEET_IMPORT_SCOPE_DISABLED";
    if (raw.includes("SERVER_REQUEST_TIMEOUT") || raw.includes("ABORTERROR")) return "SHEET_IMPORT_TIMEOUT";
    if (raw.includes("SHEET_PREVIEW_STALE")) return "STALE_PREVIEW";
    if (raw.includes("SHEET_PLAN_CHANGED")) return "TARGET_OR_REVISION_MISMATCH";
    if (raw.includes("SHEET_LATER_ACTIVITY_REVIEW")) return "SHEET_IMPORT_REVERSE_HOLD";
    if (raw.includes("SHEET_RECEIPT_NOT_FOUND")) return "SHEET_IMPORT_RECEIPT_REQUIRED";
    if (raw.includes("SHEET_OPERATION_REUSED")) return "SHEET_IMPORT_OPERATION_CONFLICT";
    return fallback;
  }

  async function create({ client, getBranchId, canOpen } = {}) {
    const initial = await inspect(client, getBranchId, canOpen);
    const initialUrl = String(initial.config.supabaseUrl || "").trim().toLowerCase().replace(/\/$/, "");
    const requireCurrent = async capability => {
      const current = await inspect(client, getBranchId, canOpen);
      if (current.reason) fail(current.reason);
      if (!sameScope(initial.scope, current.scope) || initialUrl !== String(current.config.supabaseUrl || "").trim().toLowerCase().replace(/\/$/, "")) fail("TARGET_OR_REVISION_MISMATCH");
      if (capability === "apply" && current.mode !== "apply") fail("SHEET_IMPORT_APPLY_DISABLED");
      if (capability === "reverse" && (current.mode !== "apply" || current.reverseEnabled !== true)) fail("SHEET_IMPORT_REVERSE_DISABLED");
      return current;
    };
    const call = async (capability, name, parameters, fallback) => {
      const before = await requireCurrent(capability);
      if (typeof client?.rpc !== "function") fail("SHEET_IMPORT_TRANSPORT_UNAVAILABLE");
      try {
        const response = await client.rpc(name, parameters(before), { timeoutMs: TIMEOUT_MS, requireCurrentSession: true, retryAuth: false });
        await requireCurrent(capability);
        return clone(response);
      } catch (error) {
        if (/^(SHEET_IMPORT_|TARGET_|STALE_PREVIEW)/.test(String(error?.code || ""))) throw error;
        fail(mapFailure(error, fallback));
      }
    };
    async function preview(requestScope, units) {
      if (initial.reason) fail(initial.reason);
      if (!sameScope(requestScope, initial.scope)) fail("TARGET_OR_REVISION_MISMATCH");
      if (!unitsValid(units)) fail("SHEET_PAYLOAD_INVALID");
      return call("preview", "tn_preview_single_sheet_import", current => ({ scope: clone(current.scope), units: clone(units) }), "SHEET_IMPORT_PREVIEW_FAILED");
    }
    async function apply(requestScope, unit, expectedRevision, expectedPlanHash, previewExpiresAt, fileHash, operationKey) {
      if (!sameScope(requestScope, initial.scope)) fail("TARGET_OR_REVISION_MISMATCH");
      if (!mutationArgsValid(unit, expectedRevision, expectedPlanHash, previewExpiresAt, fileHash, operationKey)) fail("SHEET_PAYLOAD_INVALID");
      return call("apply", "tn_apply_single_sheet_import_unit", current => ({
        scope: clone(current.scope), unit: clone(unit), expected_revision: expectedRevision, expected_plan_hash: expectedPlanHash,
        preview_expires_at: previewExpiresAt, file_hash: fileHash, operation_key: operationKey,
      }), "SHEET_IMPORT_APPLY_FAILED");
    }
    async function reverse(requestScope, operationKey) {
      if (!sameScope(requestScope, initial.scope)) fail("TARGET_OR_REVISION_MISMATCH");
      if (!digest(operationKey)) fail("SHEET_PAYLOAD_INVALID");
      return call("reverse", "tn_reverse_single_sheet_import_unit", current => ({ scope: clone(current.scope), operation_key: operationKey }), "SHEET_IMPORT_REVERSE_FAILED");
    }
    const currentScope = () => scopeFrom(client, getBranchId).scope;
    const isReady = () => {
      const current = sessionGate(client, getBranchId, canOpen);
      return !current.reason && sameScope(initial.scope, current.scope)
        && initialUrl === String(current.config.supabaseUrl || "").trim().toLowerCase().replace(/\/$/, "")
        && current.mode === initial.mode && current.reverseEnabled === initial.reverseEnabled;
    };
    const canApply = initial.reason === "" && initial.mode === "apply";
    const canReverse = canApply && initial.reverseEnabled === true;
    return Object.freeze({
      protocol: PROTOCOL,
      enabled: initial.reason === "",
      reason: initial.reason,
      origin: String(root.location?.origin || ""),
      host: String(root.location?.hostname || ""),
      scope: initial.scope,
      canApply,
      canReverse,
      cleanupContinuityRequired: true,
      currentScope,
      isReady,
      preview,
      ...(canApply ? { apply } : {}),
      ...(canReverse ? { reverse } : {}),
    });
  }

  function recognized(transport) {
    return transport?.protocol === PROTOCOL && typeof transport.preview === "function"
      && typeof transport.currentScope === "function" && typeof transport.isReady === "function"
      && typeof transport.canApply === "boolean" && typeof transport.canReverse === "boolean";
  }

  return Object.freeze({ PROTOCOL, TIMEOUT_MS, DEVELOPMENT_ORIGIN, PRODUCTION_ORIGIN, ORIGINS, fingerprintFor, recognized, create });
});
