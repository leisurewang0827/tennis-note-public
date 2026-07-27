(function () {
  const officialAppUrl = "https://tennisnote-app.pages.dev/";
  const defaultManifestUrl = "../release.json";
  const checkIntervalMs = 5 * 60 * 1000;
  let started = false;
  let registration = null;
  let remoteRelease = null;
  let updateInProgress = false;
  let lastCheckAt = 0;

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
    return candidate.releaseId !== current.releaseId;
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
      <button type="button" data-tennisnote-update-now>지금 업데이트</button>
    `;
    notice.querySelector("[data-tennisnote-update-now]")?.addEventListener("click", () => {
      void applyUpdate(remoteRelease, { manual: true });
    });
    document.body.appendChild(notice);
    return notice;
  }

  function showUpdateNotice(candidate) {
    if (candidate) remoteRelease = candidate;
    ensureUpdateNotice().hidden = false;
  }

  function hideUpdateNotice() {
    const notice = document.querySelector("[data-tennisnote-update-notice]");
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
    if (!registration.waiting) await registration.update().catch(() => undefined);
    if (!registration.waiting) return false;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  async function applyUpdate(candidate, options = {}) {
    if (!candidate?.releaseId || updateInProgress) return;
    remoteRelease = candidate;
    updateInProgress = true;
    const reloadKey = `tennis-note-release-controller:${candidate.releaseId}`;
    try {
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
        "Cache-Control": "no-cache",
      },
    });
    if (!response.ok) throw new Error("release_manifest_unavailable");
    const candidate = await response.json();
    if (!candidate?.version || !candidate?.releaseId) throw new Error("release_manifest_invalid");
    return candidate;
  }

  async function checkForUpdate(manifestUrl, options = {}) {
    if (!navigator.onLine || updateInProgress) return null;
    const now = Date.now();
    if (!options.force && now - lastCheckAt < 30_000) return remoteRelease;
    lastCheckAt = now;
    try {
      const candidate = await fetchRelease(manifestUrl);
      remoteRelease = candidate;
      if (!isNewerRelease(candidate)) {
        hideUpdateNotice();
        return candidate;
      }
      if (options.manualOnly) {
        showUpdateNotice(candidate);
      } else {
        await applyUpdate(candidate);
      }
      return candidate;
    } catch {
      // Offline and temporary release endpoint failures keep the current cached app.
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
    const manifestUrl = options.manifestUrl || defaultManifestUrl;
    const workerUrl = options.workerUrl || "";
    let controllerReloaded = false;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (controllerReloaded) return;
        controllerReloaded = true;
        const releaseId = remoteRelease?.releaseId || currentRelease().releaseId;
        if (!releaseId) return;
        const key = `tennis-note-release-controller:${releaseId}`;
        if (sessionStorage.getItem(key) === "done") return;
        sessionStorage.setItem(key, "done");
        window.location.replace(releaseUrl(releaseId));
      });
    }

    const update = () => {
      void registration?.update().catch(() => undefined);
      void checkForUpdate(manifestUrl);
    };

    const boot = async () => {
      try {
        await registerWorker(workerUrl);
      } catch {
        // The release manifest can still refresh ordinary browser pages.
      }
      update();
    };

    if (document.readyState === "complete") {
      void boot();
    } else {
      window.addEventListener("load", () => void boot(), { once: true });
    }
    window.addEventListener("focus", update);
    window.addEventListener("online", () => void checkForUpdate(manifestUrl, { force: true }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") update();
    });
    window.setInterval(() => void checkForUpdate(manifestUrl), checkIntervalMs);
  }

  window.TennisNoteReleaseUpdater = Object.freeze({
    officialAppUrl,
    start,
    checkForUpdate: () => checkForUpdate(defaultManifestUrl, { force: true }),
  });
})();
