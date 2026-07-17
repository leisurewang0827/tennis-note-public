(function () {
  const storageKey = "tennis-note-supabase-config";
  const authStorageKey = "tennis-note-supabase-session";
  const authPersistenceKey = "tennis-note-auth-persistence";
  const placeholderMarkers = ["your_", "_here", "publishable_key"];

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

  async function refreshSession() {
    const session = getSession();
    if (!session?.refresh_token || !readiness().ready) return null;
    const config = loadConfig();
    const response = await fetch(authUrl("token?grant_type=refresh_token"), {
      method: "POST",
      headers: {
        apikey: config.supabasePublishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) {
      removeStoredSession();
      return null;
    }
    const payload = await response.json();
    return saveSession({ ...payload, provider: session.provider });
  }

  async function ensureSession() {
    const session = getSession();
    if (!session?.access_token || !sessionNeedsRefresh(session)) return session;
    return refreshSession();
  }

  function consumeOAuthRedirect() {
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
    return session;
  }

  function isNativeApp() {
    const capacitor = window.Capacitor;
    return Boolean(capacitor && (capacitor.isNativePlatform?.() || capacitor.getPlatform?.() !== "web"));
  }

  function nativeOAuthRedirect() {
    const target = window.location.pathname.includes("coach") ? "coach" : "member";
    return `com.tennisclubhouse.tennisnote://oauth/${target}`;
  }

  function handleNativeOAuthUrl(url) {
    if (!url || !url.startsWith("com.tennisclubhouse.tennisnote://oauth/")) return false;
    const parsed = new URL(url);
    const session = saveOAuthSession(parsed.hash);
    if (!session) return false;
    window.location.reload();
    return true;
  }

  function handleNativePaymentUrl(url) {
    if (!url || !url.startsWith("com.tennisclubhouse.tennisnote://")) return false;
    const parsed = new URL(url);
    const paymentId = parsed.searchParams.get("paymentId") || "";
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(paymentId)) return false;
    const target = new URL(window.location.href);
    ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => {
      if (parsed.searchParams.has(key)) target.searchParams.set(key, parsed.searchParams.get(key) || "");
    });
    window.location.assign(target.toString());
    return true;
  }

  function handleNativeAppUrl(url) {
    return handleNativeOAuthUrl(url) || handleNativePaymentUrl(url);
  }

  function installNativeOAuthListener() {
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (!isNativeApp() || !appPlugin?.addListener) return;
    appPlugin.addListener("appUrlOpen", ({ url }) => handleNativeAppUrl(url));
    appPlugin.getLaunchUrl?.().then((result) => handleNativeAppUrl(result?.url)).catch(() => {});
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

    const session = await ensureSession();
    const response = await fetch(apiUrl(path), {
      method: options.method || "GET",
      headers: {
        ...authHeaders({}, session),
        Prefer: options.prefer || "return=representation",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Supabase request failed: ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async function invokeFunction(functionName, options = {}) {
    if (!readiness().ready) {
      throw new Error("Supabase publishable config is missing. Demo data is still active.");
    }

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
    Object.entries(options.filters || {}).forEach(([key, value]) => {
      query.set(key, `eq.${value}`);
    });
    return request(`${tableName}?${query.toString()}`, { prefer: "return=representation" });
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

  function signInWithOAuth(provider, options = {}) {
    if (!readiness().ready) {
      throw new Error("Supabase publishable config is missing. Demo login is still active.");
    }
    const key = providerKey(provider);
    const slug = providerSlug(provider);
    const redirectTo = options.redirectTo || (isNativeApp()
      ? nativeOAuthRedirect()
      : `${window.location.origin}${window.location.pathname}${window.location.search}`);
    saveProvider(provider || slug);
    const query = new URLSearchParams({
      provider: slug,
      redirect_to: redirectTo,
    });
    // Naver otherwise reuses the browser's signed-in account without offering an account choice.
    if (key === "naver") query.set("auth_type", "reauthenticate");
    window.location.href = authUrl(`authorize?${query.toString()}`);
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

  async function getAuthUser() {
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const response = await fetch(authUrl("user"), {
      method: "GET",
      headers: authHeaders({}, session),
    });
    if (!response.ok) return null;
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
    const session = await ensureSession();
    if (!readiness().ready || !session?.access_token) throw new Error("Login is required for private deletion.");
    const response = await fetch(storageObjectUrl(bucketName, objectPath), {
      method: "DELETE",
      headers: authHeaders({}, session),
    });
    if (!response.ok) throw new Error(await response.text() || `Storage deletion failed: ${response.status}`);
    return true;
  }

  async function selectCurrentProfile() {
    const session = getSession();
    const user = await getAuthUser();
    if (!user?.id) return { user, profile: null };
    const profileSelect = "id,name,nickname,phone,role,member_kind,profile_photo_url,dominant_hand,backhand_style,tennis_started_on,self_ntrp,coach_ntrp,tennis_goal,play_style_memo,ntrp_survey,ntrp_requested_at,profile_completed_at,privacy_consent_version,privacy_consented_at,status";
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
          select: "id,user_id,display_name,status",
          filters: { user_id: profile.id, status: "approved" },
          limit: 1,
        });
        coachRole = coachRows?.[0] || null;
      } catch (error) {
        coachRole = null;
      }
    }

    return { user, profile, coachRole };
  }

  async function signOut() {
    const session = getSession();
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
    signInWithOAuth,
    signInWithPassword,
    providerSlug,
    getAuthUser,
    getAuthSettings,
    bootstrapCurrentProfile,
    selectCurrentProfile,
    signOut,
    countRows,
    selectRows,
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
