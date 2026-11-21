(function () {
  const release = Object.freeze({
    version: "1.0.566",
    releaseId: "2026.11.03.02",
    appSurfaceVersion: "1.0.566",
    deployedAt: "2026-11-03T16:48:13+09:00",
    minimumNativeShellVersion: "1.0.118",
    nativeShell: {
      version: "1.0.428",
      androidVersion: "1.0.474",
      androidBuild: 103,
      iosVersion: "1.0.428",
      iosBuild: 101,
    },
    store: {
      androidVersion: "1.0.474",
      androidBuild: 103,
      androidAvailability: "available",
      iosVersion: "1.0.474",
      iosBuild: null,
      iosAvailability: "available",
    },
    prepared: { availability: "not_verified" },
  });

  window.TENNIS_NOTE_RELEASE = release;

  function nativeAppVersionLabel() {
    const capacitor = window.Capacitor;
    let native = false;
    try {
      const platform = capacitor?.getPlatform?.();
      native = platform === "android" || platform === "ios" || capacitor?.isNativePlatform?.() === true;
    } catch {
      return Promise.resolve("앱 버전 확인 불가");
    }
    if (!native) return null;
    const app = capacitor?.Plugins?.App;
    if (typeof app?.getInfo !== "function") return Promise.resolve("앱 버전 확인 불가");
    return new Promise((resolve) => {
      let settled = false;
      let timer;
      const finish = (info) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        const version = String(info?.version || "").trim();
        const build = String(info?.build || "").trim();
        if (version.length > 64 || !/^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
          resolve("앱 버전 확인 불가");
          return;
        }
        const buildLabel = /^\d{1,10}$/.test(build) && Number(build) > 0 ? ` (${build})` : "";
        resolve(`앱 버전 ${version}${buildLabel}`);
      };
      // 네이티브 조회가 멈춰도 웹 버전을 설치 버전으로 잘못 표시하지 않는다.
      timer = window.setTimeout(() => finish(null), 2500);
      Promise.resolve().then(() => app.getInfo()).then(finish, () => finish(null));
    });
  }

  function renderReleaseLabels() {
    const storeLabel = `A ${release.store.androidVersion} / iOS ${release.store.iosVersion}`;
    // A build-source declaration is not evidence of an available internal artifact.
    const preparedLabel = "내부 빌드 미확인";
    const nativeLabel = nativeAppVersionLabel();
    const appLabel = nativeLabel ? "앱 버전 확인 중…" : `웹 버전 ${release.appSurfaceVersion || release.version}`;
    document.querySelectorAll("[data-tennisnote-release]").forEach((element) => {
      const detail = element.dataset.tennisnoteRelease === "detail";
      const appOnly = element.dataset.tennisnoteRelease === "app";
      element.textContent = detail
        ? `웹 ${release.version} · 스토어 ${storeLabel} · 준비 ${preparedLabel}`
        : appOnly
          ? appLabel
          : `웹 v${release.version} · ${release.releaseId}`;
    });
    if (nativeLabel) {
      void nativeLabel.then((label) => {
        document.querySelectorAll('[data-tennisnote-release="app"]').forEach((element) => {
          element.textContent = label;
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderReleaseLabels, { once: true });
  } else {
    renderReleaseLabels();
  }
})();
