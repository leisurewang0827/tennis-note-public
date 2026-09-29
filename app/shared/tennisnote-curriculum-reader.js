/* CUR04: disabled-by-default data adapter. No endpoint, timers on import or UI writes. */
(function (root) {
  "use strict";
  const C = root.TennisNoteCurriculumContract;
  const LIMITS = Object.freeze({ checkIntervalMs: 60000, timeoutMs: 5000, manifestBytes: 8192, payloadBytes: 2000000, cacheBytes: 12060000 });
  const CACHE_KEY = "tennisnote.cur04.member-cache.v1";
  const copy = v => v === null ? null : JSON.parse(JSON.stringify(v));
  const hex = v => typeof v === "string" && v.length === 64 && /^[a-f0-9]{64}$/.test(v) && v !== "0".repeat(64);
  const defaultDigest = async raw => {
    const bytes = new TextEncoder().encode(raw);
    const result = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(result)].map(n => n.toString(16).padStart(2, "0")).join("");
  };
  function create(options = {}) {
    if (!C) throw new Error("curriculum_contract_required");
    const { require, ContractError } = C;
    const enabled = options.enabled === true;
    const clock = options.clock || Date.now;
    const digest = options.digest || defaultDigest;
    const storage = options.storage; // Explicit synchronous, atomic single-key adapter; never discover global storage.
    const transport = options.transport;
    const verifyManifest = options.verifyManifest || (() => false); // Independent auth/access proof, NOT self hash.
    const baseline = copy(options.baseline), bundled = copy(options.bundledCatalog || null);
    const readerVersion = options.readerVersion || "1.0.0";
    const interval = options.checkIntervalMs ?? LIMITS.checkIntervalMs;
    const timeout = options.timeoutMs ?? LIMITS.timeoutMs;
    require(Number.isInteger(interval) && interval >= 1000 && interval <= 3600000, "reader_configuration_invalid");
    require(Number.isInteger(timeout) && timeout >= 1 && timeout <= 10000, "reader_configuration_invalid");
    C.readerCompatible(readerVersion, readerVersion);
    let session = null, epoch = 0, job = null, active = null, pending = null, lastCheck = -Infinity;
    let hydrated = false, purgeBlocked = false, status = "LOCKED", activity = { lessonOpen: false, videoPlaying: false };
    let highestSequence = 0, highestIdentity = "", knownVersions = new Map();
    const busy = () => activity.lessonOpen || activity.videoPlaying;
    function clearStorage() {
      if (!storage) return true;
      try { storage.removeItem(CACHE_KEY); return true; } catch { return false; }
    }
    function invalidate() {
      epoch++; job?.controller.abort(); job = null; session = null; active = null; pending = null;
      highestSequence = 0; highestIdentity = ""; knownVersions = new Map(); hydrated = false; lastCheck = -Infinity;
      activity = { lessonOpen: false, videoPlaying: false };
      purgeBlocked = !clearStorage(); status = purgeBlocked ? "CACHE_CLEAR_FAILED" : "LOCKED";
    }
    function authorized() {
      if (session && session.expiresAt <= clock()) invalidate();
      return Boolean(session && session.authorized && !purgeBlocked);
    }
    function snapshot() {
      if (!authorized()) return { status, source: "none", contentVersion: null, data: null, updatePending: false };
      // Cache access proof also expires; keep bytes quarantined but never expose expired remote content.
      const visible = active && C.timestamp(active.manifest.expiresAt) > BigInt(Math.floor(clock())) * 1000n;
      return { status, source: visible ? "validated-cache" : "bundled", contentVersion: visible ? active.manifest.contentVersion : null,
        data: copy(visible ? active.data : bundled), updatePending: Boolean(pending) };
    }
    function setSession(value) {
      if (!value || value.authorized !== true || !hex(value.scope) || !Number.isFinite(value.expiresAt) || value.expiresAt <= clock()) { invalidate(); return snapshot(); }
      if (session?.scope === value.scope && authorized()) {
        session.expiresAt = value.expiresAt; return snapshot();
      }
      // On first owner entry a stored entry may be restored only after independent proof. On switch purge it.
      if (session || purgeBlocked) invalidate();
      if (purgeBlocked) return snapshot();
      epoch++; session = { scope: value.scope, expiresAt: value.expiresAt, authorized: true };
      status = enabled ? "BUNDLED" : "OFF"; return snapshot();
    }
    function current(j) { return authorized() && j.epoch === epoch && !j.controller.signal.aborted; }
    function assertCurrent(j) { require(current(j), "session_changed"); }
    function parseManifest(raw, j) {
      const m = C.parse(raw, LIMITS.manifestBytes);
      C.fields(m, ["formatVersion", "sequence", "action", "contentVersion", "sourceDigest", "payloadDigest", "payloadBytes", "schemaVersion", "minReaderVersion", "publishedAt", "expiresAt", "accessScope", "rollbackOf"]);
      require(m.formatVersion === 1, "manifest_unsupported");
      require(Number.isSafeInteger(m.sequence) && m.sequence > 0, "manifest_invalid");
      require(["publish", "rollback"].includes(m.action), "manifest_invalid");
      require(typeof m.contentVersion === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}(?![\s\S])/.test(m.contentVersion), "content_version_invalid");
      require(hex(m.sourceDigest) && hex(m.payloadDigest), "manifest_invalid");
      require(Number.isSafeInteger(m.payloadBytes) && m.payloadBytes > 0 && m.payloadBytes <= LIMITS.payloadBytes, "payload_too_large");
      require(m.schemaVersion === 1, "schema_unsupported");
      require(C.readerCompatible(readerVersion, m.minReaderVersion), "reader_too_old");
      require(C.timestamp(m.publishedAt) <= BigInt(Math.floor(clock())) * 1000n && C.timestamp(m.expiresAt) > BigInt(Math.floor(clock())) * 1000n, "manifest_expired");
      require(m.accessScope === session.scope, "access_scope_mismatch");
      require(m.action === "publish" ? m.rollbackOf === null : hex(m.rollbackOf), "manifest_invalid");
      assertCurrent(j); return m;
    }
    async function attest(raw, m, j) {
      const verdict = await verifyManifest(raw, { manifest: copy(m), scope: session.scope, signal: j.controller.signal });
      assertCurrent(j);
      require(verdict && verdict.trusted === true && verdict.scope === session.scope, "manifest_untrusted");
      return { allowRollback: verdict.allowRollback === true };
    }
    const identity = m => [m.contentVersion, m.sourceDigest, m.payloadDigest, m.publishedAt, m.schemaVersion, m.minReaderVersion, m.payloadBytes].join("|");
    const pointerIdentity = m => [identity(m), m.sequence, m.action, m.expiresAt, m.accessScope, m.rollbackOf].join("|");
    async function validateBody(raw, m, j) {
      require(typeof raw === "string", "json_invalid");
      const data = C.parse(raw, LIMITS.payloadBytes);
      require(new TextEncoder().encode(raw).byteLength === m.payloadBytes, "payload_size_mismatch");
      const hash = await digest(raw); assertCurrent(j);
      require(hash === m.payloadDigest, "payload_digest_mismatch");
      const validated = C.validate(data, { readerVersion, expectedSourceDigest: m.sourceDigest, baseline });
      require(validated.contentVersion === m.contentVersion && validated.publishedAt === m.publishedAt && validated.schemaVersion === m.schemaVersion && validated.minReaderVersion === m.minReaderVersion, "manifest_body_mismatch");
      return validated;
    }
    function persist(entry, j) {
      assertCurrent(j);
      if (storage) {
        try { storage.setItem(CACHE_KEY, JSON.stringify({ formatVersion: 1, owner: session.scope, manifestRaw: entry.manifestRaw, raw: entry.raw })); }
        catch { throw new ContractError("cache_write_failed"); }
      }
      // Synchronous adapter contract: setItem must either atomically replace or throw without altering the key.
      assertCurrent(j); active = entry; pending = null;
      knownVersions.set(entry.manifest.contentVersion, identity(entry.manifest));
    }
    async function hydrate(j) {
      if (hydrated || !storage) return;
      hydrated = true;
      let saved;
      try { saved = storage.getItem(CACHE_KEY); } catch { throw new ContractError("cache_read_failed"); }
      if (!saved) return;
      try {
        const value = C.parse(saved, LIMITS.cacheBytes);
        C.fields(value, ["formatVersion", "owner", "manifestRaw", "raw"]);
        require(value.formatVersion === 1 && value.owner === session.scope, "cache_owner_mismatch");
        const m = parseManifest(value.manifestRaw, j);
        await attest(value.manifestRaw, m, j);
        const data = await validateBody(value.raw, m, j); assertCurrent(j);
        const restored = { manifest: m, manifestRaw: value.manifestRaw, raw: value.raw, data };
        if (busy()) pending = restored; else active = restored;
        highestSequence = m.sequence; highestIdentity = pointerIdentity(m); knownVersions.set(m.contentVersion, identity(m));
        status = busy() ? "UPDATE_DEFERRED" : "CACHE_RESTORED";
      } catch (error) {
        assertCurrent(j);
        if (!clearStorage()) { invalidate(); throw new ContractError("cache_clear_failed"); }
        status = error instanceof ContractError && error.message === "manifest_expired" ? "CACHE_EXPIRED" : "CACHE_CORRUPT";
      }
    }
    async function run(j) {
      await hydrate(j); assertCurrent(j);
      // A queued payload is applied only on entry, never just because a player closes.
      if (pending && C.timestamp(pending.manifest.expiresAt) <= BigInt(Math.floor(clock())) * 1000n) { pending = null; status = "PENDING_EXPIRED"; }
      if (pending && !busy()) {
        persist(pending, j); status = "APPLIED_DEFERRED";
      }
      if (clock() - lastCheck < interval) { if (status !== "APPLIED_DEFERRED") status = "CHECK_THROTTLED"; return snapshot(); }
      lastCheck = clock();
      require(transport && typeof transport.readManifest === "function" && typeof transport.readPayload === "function", "transport_not_configured");
      const rawManifest = await transport.readManifest({ signal: j.controller.signal, maxBytes: LIMITS.manifestBytes }); assertCurrent(j);
      const m = parseManifest(rawManifest, j), proof = await attest(rawManifest, m, j), id = identity(m);
      require(m.sequence >= highestSequence, "response_out_of_order");
      require(m.sequence !== highestSequence || pointerIdentity(m) === highestIdentity, "response_conflict");
      const previous = pending || active;
      if (previous && identity(previous.manifest) === id) {
        const refreshed = { ...previous, manifest: m, manifestRaw: rawManifest };
        if (pending) { pending = refreshed; status = "UPDATE_DEFERRED"; }
        else { persist(refreshed, j); status = "UNCHANGED"; }
        highestSequence = m.sequence; highestIdentity = pointerIdentity(m);
        return snapshot(); // same content identity: payload requests exactly zero
      }
      if (knownVersions.has(m.contentVersion)) require(knownVersions.get(m.contentVersion) === id, "content_version_reused");
      require(knownVersions.has(m.contentVersion) || knownVersions.size < 128, "session_update_limit");
      if (m.action === "rollback") {
        require(active && proof.allowRollback && m.rollbackOf === active.manifest.payloadDigest && m.sequence > highestSequence, "rollback_not_authorized");
      } else if (active) {
        require(!knownVersions.has(m.contentVersion) && C.timestamp(m.publishedAt) >= C.timestamp(active.manifest.publishedAt), "rollback_required");
      }
      const raw = await transport.readPayload({ manifest: copy(m), signal: j.controller.signal, maxBytes: LIMITS.payloadBytes }); assertCurrent(j);
      const data = await validateBody(raw, m, j); assertCurrent(j);
      const entry = { manifest: m, manifestRaw: rawManifest, raw, data };
      if (busy()) { pending = entry; status = "UPDATE_DEFERRED"; }
      else { persist(entry, j); status = m.action === "rollback" ? "ROLLED_BACK" : "APPLIED"; }
      highestSequence = m.sequence; highestIdentity = pointerIdentity(m);
      return snapshot();
    }
    async function enter() {
      if (!authorized()) return snapshot();
      if (!enabled) { status = "OFF"; return snapshot(); }
      if (job) return job.promise;
      const j = { epoch, controller: new AbortController(), promise: null };
      job = j;
      let timer;
      const timeoutPromise = new Promise((_, reject) => { timer = setTimeout(() => { j.controller.abort(); reject(new C.ContractError("request_timeout")); }, timeout); });
      j.promise = Promise.race([run(j), timeoutPromise]).catch(error => {
        if (j.epoch !== epoch || !authorized()) return snapshot();
        status = error instanceof C.ContractError ? error.message.toUpperCase() : "NETWORK_ERROR";
        return snapshot();
      }).finally(() => { clearTimeout(timer); if (job === j) job = null; });
      return j.promise;
    }
    function setActivity(value = {}) {
      activity = { lessonOpen: value.lessonOpen === true, videoPlaying: value.videoPlaying === true };
      return snapshot(); // never applies or rerenders data here
    }
    return Object.freeze({ enter, snapshot, setSession, logout: () => { invalidate(); return snapshot(); }, setActivity,
      configuration: Object.freeze({ enabled, checkIntervalMs: interval, timeoutMs: timeout, ...{ manifestBytes: LIMITS.manifestBytes, payloadBytes: LIMITS.payloadBytes } }) });
  }
  root.TennisNoteCurriculumReader = Object.freeze({ create, LIMITS, CACHE_KEY });
})(typeof window === "undefined" ? globalThis : window);
