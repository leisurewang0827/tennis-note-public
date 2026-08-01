(function () {
  const storageKey = "tennis-note-supabase-config";
  const authStorageKey = "tennis-note-supabase-session";
  const authPersistenceKey = "tennis-note-auth-persistence";
  const oauthCodeVerifierKey = "tennis-note-oauth-code-verifier";
  const nativeUrlFingerprintKey = "tennis-note-native-url-fingerprint";
  const offlineDatabaseName = "tennis-note-offline-cache";
  const offlineDatabaseVersion = 1;
  const offlineResponseStore = "responses";
  const offlineCacheMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
  const placeholderMarkers = ["your_", "_here", "publishable_key"];
  let sessionRefreshPromise = null;
  let currentProfilePromise = null;
  let pendingOAuthCredentialCapture = Promise.resolve(null);
  let offlineDatabasePromise = null;
  let nativeOAuthInFlightProvider = "";

  function parseStoredConfig() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (error) {
      localStorage.removeItem(storageKey);
      return {};
    }
  }

  function compactConfig(source) {
    const supabase = source?.supabase || source || {};
    const authProviderOverrides =
      supabase.authProviderOverrides ||
      supabase.providerOverrides ||
      source?.authProviderOverrides ||
      source?.providerOverrides ||
      {};
    return {
      supabaseUrl: supabase.supabaseUrl || supabase.url || "",
      supabasePublishableKey: supabase.supabasePublishableKey || supabase.publishableKey || supabase.anonKey || "",
      authProviderOverrides,
    };
  }

  function loadConfig() {
    const fileConfig = compactConfig(window.TENNISNOTE_CONFIG);
    const storedConfig = compactConfig(parseStoredConfig());
    return {
      supabaseUrl: isReadyValue(storedConfig.supabaseUrl) ? storedConfig.supabaseUrl : fileConfig.supabaseUrl,
      supabasePublishableKey: isReadyValue(storedConfig.supabasePublishableKey)
        ? storedConfig.supabasePublishableKey
        : fileConfig.supabasePublishableKey,
      authProviderOverrides: {
        ...(storedConfig.authProviderOverrides || {}),
        ...(fileConfig.authProviderOverrides || {}),
      },
    };
  }

  function isReadyValue(value) {
    if (!value || typeof value !== "string") return false;
    const cleanValue = value.trim().toLowerCase();
    if (!cleanValue) return false;
    return !placeholderMarkers.some((marker) => cleanValue.includes(marker));
  }

  function readiness() {
    const config = loadConfig();
    const ready = isReadyValue(config.supabaseUrl) && isReadyValue(config.supabasePublishableKey);
    return {
      ready,
      hasUrl: isReadyValue(config.supabaseUrl),
      hasPublishableKey: isReadyValue(config.supabasePublishableKey),
      mode: ready ? "supabase" : "demo",
    };
  }

  function apiUrl(path) {
    const config = loadConfig();
    return `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path.replace(/^\//, "")}`;
  }

  function authUrl(path) {
    const config = loadConfig();
    return `${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/${path.replace(/^\//, "")}`;
  }

  function functionUrl(functionName) {
    const config = loadConfig();
    return `${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName.replace(/^\//, "")}`;
  }

  function storageObjectUrl(bucketName, objectPath) {
    const config = loadConfig();
    const encodedPath = `${objectPath || ""}`.split("/").map(encodeURIComponent).join("/");
    return `${config.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(bucketName)}/${encodedPath}`;
  }

  function getSession() {
    for (const storage of authSessionStores()) {
      try {
        const session = JSON.parse(storage.getItem(authStorageKey) || "null");
        if (!session?.access_token) continue;
        writeStoredSession(session);
        return session;
      } catch (error) {
        try {
          storage.removeItem(authStorageKey);
        } catch (storageError) {
          // Continue to the fallback store when this storage area is unavailable.
        }
      }
    }
    return null;
  }

  function sessionSubject(session = getSession()) {
    const directId = session?.user?.id || "";
    if (directId) return directId;
    const token = `${session?.access_token || ""}`;
    const payloadPart = token.split(".")[1] || "";
    if (!payloadPart) return "";
    try {
      const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      return JSON.parse(window.atob(padded))?.sub || "";
    } catch (error) {
      return "";
    }
  }

  function isOnline() {
    return navigator.onLine !== false;
  }

  function offlineError(code = "offline_online_required") {
    const error = new Error(code);
    error.code = code;
    error.offline = true;
    return error;
  }

  function isOfflineError(error) {
    return Boolean(error?.offline)
      || ["offline_online_required", "offline_cache_miss"].includes(error?.code || error?.message);
  }

  function openOfflineDatabase() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (!offlineDatabasePromise) {
      offlineDatabasePromise = new Promise((resolve) => {
        let request;
        try {
          request = window.indexedDB.open(offlineDatabaseName, offlineDatabaseVersion);
        } catch (error) {
          resolve(null);
          return;
        }
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(offlineResponseStore)) {
            const store = database.createObjectStore(offlineResponseStore, { keyPath: "key" });
            store.createIndex("identity", "identity", { unique: false });
            store.createIndex("savedAt", "savedAt", { unique: false });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => {
            database.close();
            offlineDatabasePromise = null;
          };
          resolve(database);
        };
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      });
    }
    return offlineDatabasePromise;
  }

  function resetOfflineDatabase(database) {
    try {
      database?.close();
    } catch (error) {
      // The connection may already be closing.
    }
    offlineDatabasePromise = null;
  }

  async function runOfflineTransaction(mode, handler) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const database = await openOfflineDatabase();
      if (!database) return null;
      try {
        const transaction = database.transaction(offlineResponseStore, mode);
        return await handler(transaction);
      } catch (error) {
        resetOfflineDatabase(database);
      }
    }
    return null;
  }

  function offlineResponseKey(path, session = getSession()) {
    const identity = sessionSubject(session);
    return identity ? `${identity}:${path}` : "";
  }

  async function readOfflineResponse(path, session = getSession()) {
    const key = offlineResponseKey(path, session);
    if (!key) return null;
    return runOfflineTransaction("readonly", (transaction) => new Promise((resolve) => {
      const request = transaction.objectStore(offlineResponseStore).get(key);
      request.onsuccess = () => {
        const record = request.result;
        if (!record || Date.now() - Number(record.savedAt || 0) > offlineCacheMaxAgeMs) {
          resolve(null);
          return;
        }
        resolve(record.payload);
      };
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    }));
  }

  async function writeOfflineResponse(path, payload, session = getSession()) {
    const identity = sessionSubject(session);
    const key = offlineResponseKey(path, session);
    if (!key) return false;
    return (await runOfflineTransaction("readwrite", (transaction) => new Promise((resolve) => {
      transaction.objectStore(offlineResponseStore).put({
        key,
        identity,
        savedAt: Date.now(),
        payload,
      });
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    }))) === true;
  }

  async function clearOfflineResponses(identity = sessionSubject()) {
    if (!identity) return false;
    return (await runOfflineTransaction("readwrite", (transaction) => new Promise((resolve) => {
      const index = transaction.objectStore(offlineResponseStore).index("identity");
      const request = index.openKeyCursor(window.IDBKeyRange.only(identity));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        transaction.objectStore(offlineResponseStore).delete(cursor.primaryKey);
        cursor.continue();
      };
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    }))) === true;
  }

  function sessionPersistence() {
    return window.localStorage.getItem(authPersistenceKey) === "session" ? "session" : "local";
  }

  function authSessionStores() {
    return sessionPersistence() === "session"
      ? [window.sessionStorage]
      : [window.localStorage, window.sessionStorage];
  }

  function setSessionPersistence(remember) {
    const current = getSession();
    window.localStorage.setItem(authPersistenceKey, remember ? "local" : "session");
    if (remember) {
      if (current?.access_token) window.localStorage.setItem(authStorageKey, JSON.stringify(current));
      return "local";
    }
    if (current?.access_token) window.sessionStorage.setItem(authStorageKey, JSON.stringify(current));
    window.localStorage.removeItem(authStorageKey);
    window.localStorage.removeItem(`${authStorageKey}-provider`);
    return "session";
  }

  function writeStoredSession(session) {
    const serialized = JSON.stringify(session);
    authSessionStores().forEach((storage) => {
      try {
        storage.setItem(authStorageKey, serialized);
      } catch (error) {
        // One available storage area is enough to keep the signed-in session.
      }
    });
    if (sessionPersistence() === "session") {
      try {
        window.localStorage.removeItem(authStorageKey);
      } catch (error) {
        // The active tab session remains available.
      }
    }
  }

  function removeStoredSession() {
    authSessionStores().forEach((storage) => {
      try {
        storage.removeItem(authStorageKey);
      } catch (error) {
        // Keep clearing the other storage area.
      }
    });
  }

  function storedProvider() {
    for (const storage of authSessionStores()) {
      try {
        const provider = storage.getItem(`${authStorageKey}-provider`);
        if (provider) return provider;
      } catch (error) {
        // Continue to the fallback store.
      }
    }
    return "";
  }

  function saveProvider(provider) {
    authSessionStores().forEach((storage) => {
      try {
        storage.setItem(`${authStorageKey}-provider`, provider);
      } catch (error) {
        // One available storage area is enough.
      }
    });
  }

  function saveSession(session) {
    if (!session?.access_token) return null;
    const rawExpiresAt = Number(session.expires_at || 0);
    const normalized = {
      access_token: session.access_token,
      refresh_token: session.refresh_token || "",
      token_type: session.token_type || "bearer",
      expires_at: rawExpiresAt
        ? (rawExpiresAt < 1_000_000_000_000 ? rawExpiresAt * 1000 : rawExpiresAt)
        : (session.expires_in ? Date.now() + Number(session.expires_in) * 1000 : 0),
      provider: session.provider || storedProvider() || "Supabase",
    };
    writeStoredSession(normalized);
    return normalized;
  }

  function sessionNeedsRefresh(session) {
    if (!session?.access_token) return false;
    const expiresAt = Number(session.expires_at || 0);
    return Boolean(expiresAt && Date.now() >= expiresAt - 60_000);
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function oauthStorageValue() {
    for (const storage of authSessionStores()) {
      try {
        const value = storage.getItem(oauthCodeVerifierKey);
        if (value) return value;
      } catch (error) {
        // Continue with the fallback storage area.
      }
    }
    return "";
  }

  function clearOAuthStorageValue() {
    authSessionStores().forEach((storage) => {
      try { storage.removeItem(oauthCodeVerifierKey); } catch (error) { /* best effort */ }
    });
  }

  function base64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function createOAuthPkcePair() {
    const bytes = new Uint8Array(48);
    window.crypto?.getRandomValues?.(bytes);
    const verifier = base64Url(bytes);
    if (!verifier || !window.crypto?.subtle) throw new Error("oauth_pkce_unavailable");
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = base64Url(new Uint8Array(digest));
    authSessionStores().forEach((storage) => {
      try { storage.setItem(oauthCodeVerifierKey, verifier); } catch (error) { /* fallback storage may still work */ }
    });
    return { challenge };
  }

  async function exchangeOAuthCode(code) {
    const verifier = oauthStorageValue();
    if (!code || !verifier) throw new Error("oauth_code_verifier_missing");
    const config = loadConfig();
    const response = await fetch(authUrl("token?grant_type=pkce"), {
      method: "POST",
      headers: { apikey: config.supabasePublishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    });
    if (!response.ok) throw new Error("oauth_code_exchange_failed");
    const payload = await response.json();
    clearOAuthStorageValue();
    return saveSession({ ...payload, provider: storedProvider() || "Supabase" });
  }

  function transientNetworkError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return error instanceof TypeError
      || message.includes("failed to fetch")
      || message.includes("networkerror")
      || message.includes("load failed");
  }

  function isTransientConnectionError(error) {
    const message = String(error?.code || error?.message || error || "").toLowerCase();
    return isOfflineError(error)
      || transientNetworkError(error)
      || Number(error?.status || 0) >= 500
      || [
        "session_refresh_temporarily_unavailable",
        "server_request_timeout",
        "request_timeout",
      ].some((code) => message.includes(code));
  }

  async function performRefreshSession() {
    const session = getSession();
    if (!session?.refresh_token || !readiness().ready) return null;
    const config = loadConfig();
    let response = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(authUrl("token?grant_type=refresh_token"), {
          method: "POST",
          headers: {
            apikey: config.supabasePublishableKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        if (response.ok || response.status < 500) break;
      } catch (error) {
        if (!transientNetworkError(error) || attempt === 1) throw error;
      }
      await wait(500 * (attempt + 1));
    }
    if (!response) throw new Error("session_refresh_temporarily_unavailable");
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        removeStoredSession();
        return null;
      }
      throw new Error("session_refresh_temporarily_unavailable");
    }
    const payload = await response.json();
    return saveSession({ ...payload, provider: session.provider });
  }

  function refreshSession() {
    if (!sessionRefreshPromise) {
      sessionRefreshPromise = performRefreshSession().finally(() => {
        sessionRefreshPromise = null;
      });
    }
    return sessionRefreshPromise;
  }

  async function ensureSession() {
    const session = getSession();
    if (!session?.access_token || !sessionNeedsRefresh(session)) return session;
    if (!isOnline()) return session;
    return refreshSession();
  }

  async function consumeOAuthRedirect() {
    const query = new URLSearchParams(window.location.search || "");
    if (query.get("error")) throw new Error(query.get("error_description") || query.get("error"));
    if (query.get("code")) {
      const session = await exchangeOAuthCode(query.get("code"));
      window.history.replaceState({}, document.title, `${window.location.pathname}`);
      return session;
    }
    if (!window.location.hash || !window.location.hash.includes("access_token=")) return getSession();
    const session = saveOAuthSession(window.location.hash);
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    return session;
  }

  function saveOAuthSession(hash) {
    if (!hash || !hash.includes("access_token=")) return null;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const session = saveSession({
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token"),
      token_type: params.get("token_type"),
      expires_in: params.get("expires_in"),
    });
    scheduleOAuthProviderCredentialCapture(params, session);
    return session;
  }

  function scheduleOAuthProviderCredentialCapture(params, session) {
    const providerToken = params?.get?.("provider_token") || "";
    const providerRefreshToken = params?.get?.("provider_refresh_token") || "";
    if (providerKey(session?.provider) !== "apple" || (!providerToken && !providerRefreshToken)) {
      pendingOAuthCredentialCapture = Promise.resolve(null);
      return pendingOAuthCredentialCapture;
    }
    pendingOAuthCredentialCapture = invokeFunction("tennisnote-account-deletion", {
      body: {
        action: "capture_apple_token",
        providerToken,
        providerRefreshToken,
      },
    }).catch(() => null);
    return pendingOAuthCredentialCapture;
  }

  function flushOAuthProviderCredentialCapture() {
    return pendingOAuthCredentialCapture;
  }

  function emitOAuthResult(detail) {
    window.dispatchEvent(new CustomEvent("tennisnote:oauth-result", { detail }));
  }

  function isNativeApp() {
    const capacitor = window.Capacitor;
    return Boolean(capacitor && (capacitor.isNativePlatform?.() || capacitor.getPlatform?.() !== "web"));
  }

  function nativeOAuthRedirect() {
    const target = window.location.pathname.includes("coach") ? "coach" : "member";
    return `com.tennisclubhouse.tennisnote://oauth/${target}`;
  }

  function nativeUrlFingerprint(url) {
    let hash = 2166136261;
    for (let index = 0; index < url.length; index += 1) {
      hash ^= url.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${(hash >>> 0).toString(36)}:${url.length}`;
  }

  function recentlyHandledNativeUrl(url) {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(nativeUrlFingerprintKey) || "null");
      return saved?.fingerprint === nativeUrlFingerprint(url) && Date.now() - Number(saved?.handledAt || 0) < 60_000;
    } catch (error) {
      try {
        window.sessionStorage.removeItem(nativeUrlFingerprintKey);
      } catch (storageError) {
        // Treat unavailable session storage as having no previous callback.
      }
      return false;
    }
  }

  function rememberNativeUrl(url) {
    try {
      window.sessionStorage.setItem(nativeUrlFingerprintKey, JSON.stringify({
        fingerprint: nativeUrlFingerprint(url),
        handledAt: Date.now(),
      }));
    } catch (error) {
      // URL handling still works when session storage is unavailable.
    }
  }

  function forgetNativeUrl() {
    try {
      window.sessionStorage.removeItem(nativeUrlFingerprintKey);
    } catch (error) {
      // There is no stored marker to clear when session storage is unavailable.
    }
  }

  async function handleNativeOAuthUrl(url) {
    if (!url || !url.startsWith("com.tennisclubhouse.tennisnote://oauth/")) return false;
    try {
      const parsed = new URL(url);
      const error = parsed.searchParams.get("error");
      if (error) {
        clearOAuthStorageValue();
        const provider = nativeOAuthInFlightProvider || storedProvider() || "간편";
        nativeOAuthInFlightProvider = "";
        await window.Capacitor?.Plugins?.Browser?.close?.().catch?.(() => {});
        emitOAuthResult({
          ok: false,
          provider,
          cancelled: ["access_denied", "user_cancelled", "canceled", "cancelled"].includes(error.toLowerCase()),
        });
        return true;
      }
      const code = parsed.searchParams.get("code");
      const session = code
        ? await exchangeOAuthCode(code)
        : saveOAuthSession(parsed.hash);
      if (!session) return false;
      await flushOAuthProviderCredentialCapture();
      nativeOAuthInFlightProvider = "";
      await window.Capacitor?.Plugins?.Browser?.close?.().catch?.(() => {});
      window.location.reload();
      return true;
    } catch (error) {
      const provider = nativeOAuthInFlightProvider || storedProvider() || "간편";
      nativeOAuthInFlightProvider = "";
      clearOAuthStorageValue();
      await window.Capacitor?.Plugins?.Browser?.close?.().catch?.(() => {});
      emitOAuthResult({ ok: false, provider, cancelled: false });
      return true;
    }
  }

  function handleNativePaymentUrl(url) {
    if (!url || !url.startsWith("com.tennisclubhouse.tennisnote://")) return false;
    try {
      const parsed = new URL(url);
      const paymentId = parsed.searchParams.get("paymentId") || "";
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(paymentId)) return false;
      const target = new URL(window.location.href);
      ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => {
        if (parsed.searchParams.has(key)) target.searchParams.set(key, parsed.searchParams.get(key) || "");
      });
      window.location.assign(target.toString());
      return true;
    } catch (error) {
      return false;
    }
  }

  async function handleNativeAppUrl(url) {
    if (!url || recentlyHandledNativeUrl(url)) return Boolean(url);
    rememberNativeUrl(url);
    const handled = await handleNativeOAuthUrl(url) || handleNativePaymentUrl(url);
    if (!handled) forgetNativeUrl();
    return handled;
  }

  function installNativeOAuthListener() {
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (!isNativeApp() || !appPlugin?.addListener) return;
    appPlugin.addListener("appUrlOpen", ({ url }) => void handleNativeAppUrl(url));
    appPlugin.getLaunchUrl?.().then((result) => handleNativeAppUrl(result?.url)).catch(() => {});
    window.Capacitor?.Plugins?.Browser?.addListener?.("browserFinished", () => {
      if (!nativeOAuthInFlightProvider) return;
      const provider = nativeOAuthInFlightProvider;
      nativeOAuthInFlightProvider = "";
      clearOAuthStorageValue();
      emitOAuthResult({ ok: false, provider, cancelled: true });
    });
  }

  function authHeaders(extraHeaders = {}, sessionOverride = undefined) {
    const config = loadConfig();
    const session = sessionOverride === undefined ? getSession() : sessionOverride;
    return {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${session?.access_token || config.supabasePublishableKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    };
  }

  async function request(path, options = {}) {
    if (!readiness().ready) {
      throw new Error("Supabase publishable config is missing. Demo data is still active.");
    }

    const method = `${options.method || "GET"}`.toUpperCase();
    if (!isOnline() && method !== "GET") throw offlineError();
    const session = await ensureSession();
    if (!isOnline() && method === "GET") {
      const cached = await readOfflineResponse(path, session);
      if (cached !== null) return cached;
      throw offlineError("offline_cache_miss");
    }
    let response;
    const controller = new AbortController();
    const timeoutMs = Math.max(
      5_000,
      Number(options.timeoutMs || (method === "GET" ? 45_000 : 30_000)),
    );
    const timeoutId = window.setTimeout(() => controller.abort("request_timeout"), timeoutMs);
    try {
      response = await fetch(apiUrl(path), {
        method,
        headers: {
          ...authHeaders({}, session),
          Prefer: options.prefer || "return=representation",
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("server_request_timeout");
        timeoutError.code = "server_request_timeout";
        throw timeoutError;
      }
      if (method === "GET" && transientNetworkError(error)) {
        const cached = await readOfflineResponse(path, session);
        if (cached !== null) return cached;
        throw offlineError("offline_cache_miss");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const message = await response.text();
      const error = new Error(message || `Supabase request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) return null;
    const payload = await response.json();
    if (method === "GET") void writeOfflineResponse(path, payload, session);
    return payload;
  }

  async function invokeFunction(functionName, options = {}) {
    if (!readiness().ready) {
      throw new Error("Supabase publishable config is missing. Demo data is still active.");
    }

    if (!isOnline()) throw offlineError();
    const session = await ensureSession();
    const response = await fetch(functionUrl(functionName), {
      method: options.method || "POST",
      headers: {
        ...authHeaders({}, session),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(payload.message || payload.code || `Supabase function failed: ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function countRows(tableName, options = {}) {
    if (!readiness().ready) {
      throw new Error("Supabase publishable config is missing. Demo data is still active.");
    }

    const query = new URLSearchParams();
    query.set("select", options.select || "id");
    query.set("limit", "1");

    const session = await ensureSession();
    const response = await fetch(apiUrl(`${tableName}?${query.toString()}`), {
      method: "GET",
      headers: {
        ...authHeaders({}, session),
        Prefer: "count=exact",
      },
    });

    if (!response.ok) {
      const message = await response.text();
      const error = new Error(message || `Supabase count failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const range = response.headers.get("content-range") || "";
    const match = range.match(/\/(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  function selectRows(tableName, options = {}) {
    const query = new URLSearchParams();
    query.set("select", options.select || "*");
    if (options.limit) query.set("limit", String(options.limit));
    if (options.offset) query.set("offset", String(options.offset));
    if (options.order) query.set("order", String(options.order));
    Object.entries(options.filters || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.entries(value).forEach(([operator, operand]) => {
          if (!["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"].includes(operator)) return;
          const encodedOperand = operator === "in" && Array.isArray(operand)
            ? `(${operand.join(",")})`
            : operand;
          query.append(key, `${operator}.${encodedOperand}`);
        });
        return;
      }
      query.set(key, `eq.${value}`);
    });
    return request(`${tableName}?${query.toString()}`, { prefer: "return=representation" });
  }

  async function selectAllRows(tableName, options = {}) {
    const pageSize = Math.min(Math.max(Number(options.pageSize) || 500, 1), 1000);
    const maxRows = Math.max(Number(options.maxRows) || 10000, pageSize);
    const rows = [];
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const page = await selectRows(tableName, {
        ...options,
        limit: pageSize,
        offset,
      });
      rows.push(...(Array.isArray(page) ? page : []));
      if (!Array.isArray(page) || page.length < pageSize) break;
    }
    return rows;
  }

  function insertRows(tableName, rows) {
    return request(tableName, {
      method: "POST",
      body: Array.isArray(rows) ? rows : [rows],
      prefer: "return=representation",
    });
  }

  function updateRows(tableName, filters, values) {
    const query = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      query.set(key, `eq.${value}`);
    });
    return request(`${tableName}?${query.toString()}`, {
      method: "PATCH",
      body: values,
      prefer: "return=representation",
    });
  }

  function providerKey(provider) {
    const value = `${provider || ""}`.trim().toLowerCase();
    if (value.includes("\uce74\uce74\uc624") || value.includes("kakao")) return "kakao";
    if (value.includes("\ub124\uc774\ubc84") || value.includes("naver")) return "naver";
    if (value.includes("\uc560\ud50c") || value.includes("apple")) return "apple";
    if (value.includes("\uc774\uba54\uc77c") || value.includes("email")) return "email";
    return value || "kakao";
  }

  function providerSlug(provider) {
    const key = providerKey(provider);
    const overrides = loadConfig().authProviderOverrides || {};
    if (key === "kakao") {
      return overrides[key] && overrides[key] !== "kakao" ? overrides[key] : "custom:kakao";
    }
    if (overrides[key]) return overrides[key];
    if (key === "naver") return "custom:naver";
    return overrides[key] || key;
  }

  async function signInWithOAuth(provider, options = {}) {
    if (!readiness().ready) {
      throw new Error("Supabase publishable config is missing. Demo login is still active.");
    }
    const key = providerKey(provider);
    const slug = providerSlug(provider);
    const pkce = await createOAuthPkcePair();
    const redirectTo = options.redirectTo || (isNativeApp()
      ? nativeOAuthRedirect()
      : `${window.location.origin}${window.location.pathname}${window.location.search}`);
    saveProvider(provider || slug);
    const query = new URLSearchParams({
      provider: slug,
      redirect_to: redirectTo,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
    });
    // Naver otherwise reuses the browser's signed-in account without offering an account choice.
    if (key === "naver") query.set("auth_type", "reauthenticate");
    const authorizeUrl = authUrl(`authorize?${query.toString()}`);
    const browserPlugin = window.Capacitor?.Plugins?.Browser;
    if (isNativeApp() && browserPlugin?.open) {
      nativeOAuthInFlightProvider = provider || slug;
      try {
        await browserPlugin.open({
          url: authorizeUrl,
          presentationStyle: "popover",
        });
      } catch (error) {
        nativeOAuthInFlightProvider = "";
        clearOAuthStorageValue();
        throw error;
      }
      return;
    }
    window.location.href = authorizeUrl;
  }

  async function signInWithPassword(email, password) {
    if (!readiness().ready) {
      throw new Error("Supabase publishable config is missing. Email login is unavailable.");
    }
    const normalizedEmail = `${email || ""}`.trim().toLowerCase();
    if (!normalizedEmail || !password) throw new Error("email_credentials_required");
    const config = loadConfig();
    const response = await fetch(authUrl("token?grant_type=password"), {
      method: "POST",
      headers: {
        apikey: config.supabasePublishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.msg || payload?.message || payload?.error_description || "email_login_failed");
      error.code = payload?.error_code || payload?.code || "email_login_failed";
      error.status = response.status;
      throw error;
    }
    return saveSession({ ...payload, provider: "\uc774\uba54\uc77c" });
  }

  async function signUpWithPassword(email, password) {
    if (!readiness().ready) throw new Error("Supabase publishable config is missing. Email signup is unavailable.");
    const normalizedEmail = `${email || ""}`.trim().toLowerCase();
    if (!normalizedEmail || !password) throw new Error("email_credentials_required");
    const config = loadConfig();
    const response = await fetch(authUrl("signup"), {
      method: "POST",
      headers: { apikey: config.supabasePublishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.msg || payload?.message || "email_signup_failed");
    return payload;
  }

  async function sendPasswordResetEmail(email, redirectTo = window.location.href) {
    if (!readiness().ready) throw new Error("Supabase publishable config is missing. Password reset is unavailable.");
    const normalizedEmail = `${email || ""}`.trim().toLowerCase();
    if (!normalizedEmail) throw new Error("email_required");
    const config = loadConfig();
    const response = await fetch(authUrl("recover"), {
      method: "POST",
      headers: { apikey: config.supabasePublishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, redirect_to: redirectTo }),
    });
    if (!response.ok) throw new Error("password_reset_failed");
    return true;
  }

  async function getAuthUser() {
    const session = await ensureSession();
    if (!session?.access_token) return null;
    if (!isOnline()) {
      const id = sessionSubject(session);
      return id ? { id } : null;
    }
    let response;
    try {
      response = await fetch(authUrl("user"), {
        method: "GET",
        headers: authHeaders({}, session),
      });
    } catch (error) {
      if (!transientNetworkError(error)) throw error;
      const id = sessionSubject(session);
      return id ? { id } : null;
    }
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        removeStoredSession();
        return null;
      }
      const error = new Error(await response.text() || `Supabase auth user failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function getAuthSettings() {
    if (!readiness().ready) {
      throw new Error("Supabase publishable config is missing. Auth settings cannot be checked.");
    }
    const response = await fetch(authUrl("settings"), {
      method: "GET",
      headers: authHeaders(),
    });
    if (!response.ok) {
      const error = new Error(await response.text() || `Supabase auth settings failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function bootstrapCurrentProfile(options = {}) {
    const session = getSession();
    if (!session?.access_token) return null;
    return invokeFunction("tennisnote-profile-bootstrap", {
      body: {
        providerHint: providerSlug(session.provider || options.providerHint || ""),
      },
    });
  }

  function deleteRows(tableName, filters) {
    const query = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      query.set(key, `eq.${value}`);
    });
    return request(`${tableName}?${query.toString()}`, {
      method: "DELETE",
      prefer: "return=representation",
    });
  }

  function rpc(functionName, parameters = {}) {
    return request(`rpc/${functionName}`, {
      method: "POST",
      body: parameters,
      prefer: "return=representation",
    });
  }

  async function uploadObject(bucketName, objectPath, file) {
    if (!isOnline()) throw offlineError();
    const session = await ensureSession();
    if (!readiness().ready || !session?.access_token) throw new Error("Login is required for private upload.");
    const response = await fetch(storageObjectUrl(bucketName, objectPath), {
      method: "POST",
      headers: authHeaders({
        "Content-Type": file?.type || "application/octet-stream",
        "x-upsert": "false",
      }, session),
      body: file,
    });
    if (!response.ok) throw new Error(await response.text() || `Storage upload failed: ${response.status}`);
    return response.json().catch(() => ({ path: objectPath }));
  }

  async function downloadObject(bucketName, objectPath) {
    if (!isOnline()) throw offlineError();
    const session = await ensureSession();
    if (!readiness().ready || !session?.access_token) throw new Error("Login is required for private download.");
    const response = await fetch(storageObjectUrl(bucketName, objectPath), {
      method: "GET",
      headers: authHeaders({ "Content-Type": "application/octet-stream" }, session),
    });
    if (!response.ok) throw new Error(await response.text() || `Storage download failed: ${response.status}`);
    return response.blob();
  }

  async function deleteObject(bucketName, objectPath) {
    if (!isOnline()) throw offlineError();
    const session = await ensureSession();
    if (!readiness().ready || !session?.access_token) throw new Error("Login is required for private deletion.");
    const response = await fetch(storageObjectUrl(bucketName, objectPath), {
      method: "DELETE",
      headers: authHeaders({}, session),
    });
    if (!response.ok) throw new Error(await response.text() || `Storage deletion failed: ${response.status}`);
    return true;
  }

  async function performSelectCurrentProfile() {
    await flushOAuthProviderCredentialCapture();
    const session = getSession();
    const user = await getAuthUser();
    if (!user?.id) return { user, profile: null };
    const profileSelect = "id,name,nickname,phone,birth_year,neighborhood,gender,role,member_kind,profile_photo_url,dominant_hand,backhand_style,tennis_started_on,self_ntrp,coach_ntrp,tennis_goal,play_style_memo,ntrp_survey,ntrp_requested_at,profile_completed_at,privacy_consent_version,privacy_consented_at,status";
    let rows = await selectRows("tn_users", {
      select: profileSelect,
      filters: { auth_user_id: user.id },
      limit: 1,
    });

    if (!rows?.length) {
      try {
        const links = await selectRows("tn_user_auth_links", {
          select: "user_id",
          filters: { auth_user_id: user.id },
          limit: 1,
        });
        if (links?.[0]?.user_id) {
          rows = await selectRows("tn_users", {
            select: profileSelect,
            filters: { id: links[0].user_id },
            limit: 1,
          });
        }
      } catch (error) {
        rows = [];
      }
    }

    if (!rows?.length && session?.access_token) {
      try {
        const result = await bootstrapCurrentProfile({ providerHint: session.provider });
        if (result?.profile?.id) rows = [result.profile];
      } catch (error) {
        rows = [];
      }
    }

    const profile = rows?.[0] || null;
    let coachRole = null;
    if (profile?.id) {
      try {
        const coachRows = await selectRows("tn_coach_roles", {
          select: "id,user_id,branch_id,display_name,status,employment_status,archived_at,deleted_at",
          filters: { user_id: profile.id, status: "approved" },
          limit: 1,
        });
        const candidate = coachRows?.[0] || null;
        coachRole = candidate
          && (candidate.employment_status || "active") === "active"
          && !candidate.archived_at
          && !candidate.deleted_at
          ? candidate
          : null;
      } catch (error) {
        coachRole = null;
      }
    }

    return { user, profile, coachRole };
  }

  function selectCurrentProfile() {
    if (!currentProfilePromise) {
      currentProfilePromise = performSelectCurrentProfile().finally(() => {
        currentProfilePromise = null;
      });
    }
    return currentProfilePromise;
  }

  async function signOut() {
    const session = getSession();
    const identity = sessionSubject(session);
    if (session?.access_token && readiness().ready) {
      try {
        await fetch(authUrl("logout"), {
          method: "POST",
          headers: authHeaders(),
        });
      } catch (error) {
        // Local session cleanup below is still the important browser-side step.
      }
    }
    removeStoredSession();
    authSessionStores().forEach((storage) => {
      try {
        storage.removeItem(`${authStorageKey}-provider`);
      } catch (error) {
        // Keep clearing the other storage area.
      }
    });
    if (identity) await clearOfflineResponses(identity);
  }

  window.TennisNoteDataClient = {
    storageKey,
    authStorageKey,
    authPersistenceKey,
    loadConfig,
    readiness,
    getSession,
    sessionPersistence,
    setSessionPersistence,
    refreshSession,
    ensureSession,
    consumeOAuthRedirect,
    flushOAuthProviderCredentialCapture,
    signInWithOAuth,
    signInWithPassword,
    sendPasswordResetEmail,
    signUpWithPassword,
    providerSlug,
    getAuthUser,
    getAuthSettings,
    bootstrapCurrentProfile,
    selectCurrentProfile,
    signOut,
    isOnline,
    isOfflineError,
    isTransientConnectionError,
    clearOfflineResponses,
    countRows,
    selectRows,
    selectAllRows,
    insertRows,
    updateRows,
    deleteRows,
    rpc,
    uploadObject,
    downloadObject,
    deleteObject,
    invokeFunction,
  };
  installNativeOAuthListener();
})();
