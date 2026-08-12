(function () {
  const officialAppUrl = "https://tennisnote-app.pages.dev/";
  const defaultManifestUrl = "../release.json";
  const checkIntervalMs = 5 * 60 * 1000;
  let started = false;
  let registration = null;
  let remoteRelease = null;
  let activeRemoteAppUrl = "";
  let updateInProgress = false;
  let lastCheckAt = 0;
  let lastSuccessfulCheckAt = 0;
  let lastManifestUrl = defaultManifestUrl;
  let shouldDeferUpdate = null;
  let nativeAppInfoPromise = null;
  let activeNativeUpdate = null;

  function currentRelease() {
    return window.TENNIS_NOTE_RELEASE || {};
  }

  function numericVersion(value) {
    return String(value || "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  }

  function compareVersions(left, right) {
    const a = numericVersion(left);
    const b = numericVersion(right);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const difference = (a[index] || 0) - (b[index] || 0);
      if (difference) return difference;
    }
    return 0;
  }

  function isNewerRelease(candidate) {
    if (!candidate?.releaseId || !candidate?.version) return false;
    const current = currentRelease();
    const versionDifference = compareVersions(candidate.version, current.version);
    if (versionDifference !== 0) return versionDifference > 0;
    return String(candidate.releaseId).localeCompare(String(current.releaseId || "")) > 0;
  }

  function isNativeWebView() {
    const platform = window.Capacitor?.getPlatform?.();
    return Boolean(platform && platform !== "web");
  }

  function nativePlatform() {
    const platform = window.Capacitor?.getPlatform?.();
    return platform === "android" || platform === "ios" ? platform : "";
  }

  function normalizeBuild(value) {
    const parsed = Number.parseInt(String(value || "0"), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function nativePlatformPolicy(candidate, platform) {
    const explicit = candidate?.nativePlatforms?.[platform] || {};
    const current = currentRelease().nativeShell || {};
    const platformVersion = platform === "ios" ? current.iosVersion : current.androidVersion;
    const platformBuild = platform === "ios" ? current.iosBuild : current.androidBuild;
    return {
      minimumVersion: explicit.minimumVersion || candidate?.minimumNativeShellVersion || platformVersion || "0",
      minimumBuild: normalizeBuild(explicit.minimumBuild),
      latestVersion: explicit.latestVersion || platformVersion || "0",
      latestBuild: normalizeBuild(explicit.latestBuild || platformBuild),
      storeUrl: explicit.storeUrl || (platform === "ios"
        ? "https://apps.apple.com/app/id6790994818"
        : "https://play.google.com/store/apps/details?id=com.tennisclubhouse.tennisnote"),
    };
  }

  function evaluateNativeUpdate(candidate, installed) {
    const platform = installed?.platform || nativePlatform();
    if (!platform || !installed?.version) return { status: "unknown", platform, policy: null, installed };
    const policy = nativePlatformPolicy(candidate, platform);
    const installedBuild = normalizeBuild(installed.build);
    const belowMinimumVersion = compareVersions(installed.version, policy.minimumVersion) < 0;
    const belowMinimumBuild = policy.minimumBuild > 0 && installedBuild > 0 && installedBuild < policy.minimumBuild;
    const belowLatestVersion = compareVersions(installed.version, policy.latestVersion) < 0;
    const belowLatestBuild = policy.latestBuild > 0 && installedBuild > 0 && installedBuild < policy.latestBuild;
    return {
      status: belowMinimumVersion || belowMinimumBuild
        ? "required"
        : belowLatestVersion || belowLatestBuild
          ? "optional"
          : "current",
      platform,
      policy,
      installed: { ...installed, build: installedBuild },
    };
  }

  async function installedNativeAppInfo() {
    if (!isNativeWebView()) return null;
    if (nativeAppInfoPromise) return nativeAppInfoPromise;
    nativeAppInfoPromise = (async () => {
      const platform = nativePlatform();
      const appPlugin = window.Capacitor?.Plugins?.App;
      if (!platform || !appPlugin?.getInfo) return null;
      try {
        const info = await appPlugin.getInfo();
        return {
          platform,
          version: String(info?.version || ""),
          build: normalizeBuild(info?.build),
        };
      } catch {
        return null;
      }
    })();
    return nativeAppInfoPromise;
  }

  function hasUnsavedChanges() {
    try {
      if (typeof shouldDeferUpdate === "function" && shouldDeferUpdate()) return true;
    } catch {
      // A page-specific guard must not break release checks.
    }
    if (document.querySelector('[data-dirty="true"]')) return true;
    const inputGuard = window.TennisNoteInputGuard;
    if (!inputGuard?.isDirty) return false;
    return [...document.querySelectorAll("[data-tn-input-guard]")].some((root) => (
      !root.hidden
      && root.getAttribute("aria-hidden") !== "true"
      && inputGuard.isDirty(root)
    ));
  }

  function ensureUpdateNotice() {
    let notice = document.querySelector("[data-tennisnote-update-notice]");
    if (notice) return notice;
    notice = document.createElement("section");
    notice.className = "tennisnote-update-notice";
    notice.dataset.tennisnoteUpdateNotice = "";
    notice.hidden = true;
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.innerHTML = `
      <div>
        <strong>새 버전이 있습니다</strong>
        <span>현재 화면을 유지한 채 최신 버전으로 바꿉니다.</span>
      </div>
      <div class="tennisnote-update-actions">
        <button type="button" class="tennisnote-update-dismiss" data-tennisnote-update-dismiss aria-label="나중에 닫기" title="나중에">×</button>
        <button type="button" data-tennisnote-update-now>지금 업데이트</button>
      </div>
    `;
    notice.querySelector("[data-tennisnote-update-now]")?.addEventListener("click", () => {
      void applyUpdate(remoteRelease, { manual: true, remoteAppUrl: activeRemoteAppUrl });
    });
    notice.querySelector("[data-tennisnote-update-dismiss]")?.addEventListener("click", () => {
      if (remoteRelease?.releaseId) {
        sessionStorage.setItem(`tennis-note-update-dismissed:${remoteRelease.releaseId}`, "done");
      }
      hideUpdateNotice();
    });
    document.body.appendChild(notice);
    return notice;
  }

  function showUpdateNotice(candidate, options = {}) {
    if (candidate) remoteRelease = candidate;
    const releaseId = remoteRelease?.releaseId;
    if (!options.force && releaseId && sessionStorage.getItem(`tennis-note-update-dismissed:${releaseId}`) === "done") {
      hideUpdateNotice();
      return;
    }
    const notice = ensureUpdateNotice();
    const deferred = options.deferred === true || hasUnsavedChanges();
    const nativeDecision = options.nativeDecision || activeNativeUpdate;
    const nativeStoreUpdate = nativeDecision?.status === "required" || nativeDecision?.status === "optional";
    const required = nativeDecision?.status === "required";
    notice.dataset.updateKind = nativeStoreUpdate ? "native-store" : "web";
    notice.dataset.updateRequired = required ? "true" : "false";
    const title = notice.querySelector("strong");
    const detail = notice.querySelector("span");
    const updateButton = notice.querySelector("[data-tennisnote-update-now]");
    const dismissButton = notice.querySelector("[data-tennisnote-update-dismiss]");
    if (title) title.textContent = nativeStoreUpdate
      ? required ? "앱 업데이트가 필요합니다" : "새 앱 버전이 있습니다"
      : deferred ? "업데이트 대기 중" : "새 버전이 있습니다";
    if (detail) {
      detail.textContent = nativeStoreUpdate
        ? required
          ? "계속 사용하려면 현재 기기의 스토어에서 업데이트해 주세요."
          : "현재 기능은 계속 사용할 수 있습니다. 편할 때 업데이트해 주세요."
        : deferred
        ? "작성 중인 내용을 먼저 저장하면 안전하게 업데이트할 수 있습니다."
        : "현재 화면을 유지한 채 최신 버전으로 바꿉니다.";
    }
    if (updateButton) {
      updateButton.textContent = nativeStoreUpdate
        ? "스토어에서 업데이트"
        : deferred
        ? "저장 후 업데이트"
        : "지금 업데이트";
    }
    if (dismissButton) dismissButton.hidden = required;
    notice.hidden = false;
  }

  function hideUpdateNotice() {
    const notice = document.querySelector("[data-tennisnote-update-notice]");
    if (notice) notice.hidden = true;
  }

  function ensureReleaseCheckNotice() {
    let notice = document.querySelector("[data-tennisnote-release-check]");
    if (notice) return notice;
    notice = document.createElement("section");
    notice.className = "tennisnote-release-check-notice";
    notice.dataset.tennisnoteReleaseCheck = "";
    notice.hidden = true;
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.innerHTML = `
      <div>
        <strong data-release-check-title>최신 버전을 확인하지 못했습니다</strong>
        <span data-release-check-detail></span>
        <small data-release-check-meta></small>
      </div>
      <button type="button" data-release-check-retry>다시 확인</button>
    `;
    notice.querySelector("[data-release-check-retry]")?.addEventListener("click", () => {
      void checkForUpdate(lastManifestUrl, {
        force: true,
        remoteAppUrl: activeRemoteAppUrl,
      });
    });
    document.body.appendChild(notice);
    return notice;
  }

  function formatCheckTime(value) {
    if (!value) return "확인 기록 없음";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function showReleaseCheckFailure(reason) {
    const notice = ensureReleaseCheckNotice();
    const offline = reason === "offline" || !navigator.onLine;
    notice.querySelector("[data-release-check-title]").textContent = offline
      ? "인터넷 연결을 확인해 주세요"
      : "서버에서 최신 버전을 확인하지 못했습니다";
    notice.querySelector("[data-release-check-detail]").textContent = offline
      ? "저장된 운동일지와 회원권은 계속 볼 수 있습니다."
      : "현재 화면은 계속 사용할 수 있습니다. 잠시 후 다시 확인해 주세요.";
    notice.querySelector("[data-release-check-meta]").textContent =
      `현재 ${currentRelease().version || "버전 확인 중"} · 마지막 확인 ${formatCheckTime(lastSuccessfulCheckAt)}`;
    notice.hidden = false;
  }

  function hideReleaseCheckFailure() {
    const notice = document.querySelector("[data-tennisnote-release-check]");
    if (notice) notice.hidden = true;
  }

  function releaseUrl(releaseId) {
    const url = new URL(window.location.href);
    url.searchParams.set("__tn_release", releaseId);
    return url.toString();
  }

  function reloadOnce(releaseId, mode) {
    if (!releaseId) return false;
    const key = `tennis-note-release-${mode}:${releaseId}`;
    if (sessionStorage.getItem(key) === "done") return false;
    sessionStorage.setItem(key, "done");
    window.location.replace(releaseUrl(releaseId));
    return true;
  }

  async function activateWaitingWorker() {
    if (!registration) return false;
    if (hasUnsavedChanges()) {
      if (remoteRelease) showUpdateNotice(remoteRelease, { force: true, deferred: true });
      return false;
    }
    if (!registration.waiting) await registration.update().catch(() => undefined);
    if (!registration.waiting) return false;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  async function applyNativeRemoteShell(candidate, remoteAppUrl) {
    // Native releases use only the web assets bundled in the signed store app.
    // Loading a remote root document can trigger its meta refresh as an external
    // browser intent, which makes an installed app look like a PWA shortcut.
    void candidate;
    void remoteAppUrl;
    return false;
  }

  async function openNativeStoreUpdate() {
    const storeUrl = activeNativeUpdate?.policy?.storeUrl
      || (nativePlatform() === "ios"
        ? "https://apps.apple.com/app/id6790994818"
        : "https://play.google.com/store/apps/details?id=com.tennisclubhouse.tennisnote");
    const launcher = window.Capacitor?.Plugins?.AppLauncher;
    if (launcher?.openUrl) {
      await launcher.openUrl({ url: storeUrl });
      return true;
    }
    window.open(storeUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  async function applyUpdate(candidate, options = {}) {
    if (!candidate?.releaseId || updateInProgress) return;
    remoteRelease = candidate;
    if (hasUnsavedChanges()) {
      showUpdateNotice(candidate, { force: true, deferred: true });
      return;
    }
    updateInProgress = true;
    const reloadKey = `tennis-note-release-controller:${candidate.releaseId}`;
    try {
      if (isNativeWebView()) {
        const installed = await installedNativeAppInfo();
        activeNativeUpdate = evaluateNativeUpdate(candidate, installed);
        if (activeNativeUpdate.status === "required" || activeNativeUpdate.status === "optional") {
          if (options.manual) await openNativeStoreUpdate();
          else showUpdateNotice(candidate, { nativeDecision: activeNativeUpdate });
          return;
        }
        hideUpdateNotice();
        return;
      }
      if (await applyNativeRemoteShell(candidate, options.remoteAppUrl)) return;
      sessionStorage.removeItem(reloadKey);
      if (registration) {
        await registration.update();
        if (await activateWaitingWorker()) {
          window.setTimeout(() => {
            if (!reloadOnce(candidate.releaseId, "fallback")) showUpdateNotice(candidate);
          }, 3500);
          return;
        }
      }
      if (hasUnsavedChanges()) {
        showUpdateNotice(candidate, { force: true, deferred: true });
        return;
      }
      if (!reloadOnce(candidate.releaseId, options.manual ? "manual" : "fallback")) {
        showUpdateNotice(candidate);
      }
    } catch {
      showUpdateNotice(candidate);
    } finally {
      updateInProgress = false;
    }
  }

  async function fetchRelease(manifestUrl) {
    const url = new URL(manifestUrl || defaultManifestUrl, window.location.href);
    url.searchParams.set("_", Date.now().toString());
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error("release_manifest_unavailable");
    const candidate = await response.json();
    if (!candidate?.version || !candidate?.releaseId) throw new Error("release_manifest_invalid");
    return candidate;
  }

  async function checkForUpdate(manifestUrl, options = {}) {
    lastManifestUrl = manifestUrl || defaultManifestUrl;
    if (updateInProgress) return null;
    if (!navigator.onLine) {
      showReleaseCheckFailure("offline");
      return null;
    }
    const now = Date.now();
    if (!options.force && now - lastCheckAt < 30_000) return remoteRelease;
    lastCheckAt = now;
    try {
      const candidate = await fetchRelease(manifestUrl);
      lastSuccessfulCheckAt = Date.now();
      hideReleaseCheckFailure();
      remoteRelease = candidate;
      if (isNativeWebView()) {
        const installed = await installedNativeAppInfo();
        activeNativeUpdate = evaluateNativeUpdate(candidate, installed);
        if (activeNativeUpdate.status === "required" || activeNativeUpdate.status === "optional") {
          showUpdateNotice(candidate, { nativeDecision: activeNativeUpdate });
          return candidate;
        }
        hideUpdateNotice();
        return candidate;
      }
      if (!isNewerRelease(candidate)) {
        hideUpdateNotice();
        return candidate;
      }
      if (options.manualOnly) {
        showUpdateNotice(candidate);
      } else {
        await applyUpdate(candidate, { remoteAppUrl: options.remoteAppUrl });
      }
      return candidate;
    } catch {
      // Offline and temporary release endpoint failures keep the current cached app.
      showReleaseCheckFailure(navigator.onLine ? "server" : "offline");
      return null;
    }
  }

  async function registerWorker(workerUrl) {
    if (!("serviceWorker" in navigator) || !workerUrl) return null;
    registration = await navigator.serviceWorker.register(workerUrl, { updateViaCache: "none" });
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          void activateWaitingWorker();
        }
      });
    });
    if (registration.waiting) void activateWaitingWorker();
    return registration;
  }

  function start(options = {}) {
    if (started) return;
    started = true;
    const nativeWebView = isNativeWebView();
    const remoteAppUrl = options.remoteAppUrl || "";
    shouldDeferUpdate = typeof options.shouldDeferUpdate === "function" ? options.shouldDeferUpdate : null;
    activeRemoteAppUrl = remoteAppUrl;
    const manifestUrl = nativeWebView
      ? new URL("release.json", officialAppUrl).toString()
      : options.manifestUrl || defaultManifestUrl;
    const workerUrl = options.workerUrl || "";
    let controllerReloaded = false;

    if (!nativeWebView && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (controllerReloaded) return;
        const releaseId = remoteRelease?.releaseId || currentRelease().releaseId;
        if (!releaseId) return;
        if (hasUnsavedChanges()) {
          if (remoteRelease) showUpdateNotice(remoteRelease, { force: true, deferred: true });
          return;
        }
        const key = `tennis-note-release-controller:${releaseId}`;
        if (sessionStorage.getItem(key) === "done") return;
        controllerReloaded = true;
        sessionStorage.setItem(key, "done");
        window.location.replace(releaseUrl(releaseId));
      });
    }

    const update = () => {
      void registration?.update().catch(() => undefined);
      void checkForUpdate(manifestUrl, { remoteAppUrl });
    };

    const boot = async () => {
      if (!nativeWebView) {
        try {
          await registerWorker(workerUrl);
        } catch {
          // The release manifest can still refresh ordinary browser pages.
        }
      }
      update();
    };

    if (document.readyState === "complete") {
      void boot();
    } else {
      window.addEventListener("load", () => void boot(), { once: true });
    }
    window.addEventListener("focus", update);
    window.addEventListener("online", () => void checkForUpdate(manifestUrl, { force: true, remoteAppUrl }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") update();
    });
    window.setInterval(() => void checkForUpdate(manifestUrl, { remoteAppUrl }), checkIntervalMs);
  }

  window.TennisNoteReleaseUpdater = Object.freeze({
    officialAppUrl,
    start,
    hasUnsavedChanges,
    evaluateNativeUpdate,
    checkForUpdate: () => checkForUpdate(
      isNativeWebView() ? new URL("release.json", officialAppUrl).toString() : defaultManifestUrl,
      { force: true, remoteAppUrl: activeRemoteAppUrl },
    ),
  });
})();
