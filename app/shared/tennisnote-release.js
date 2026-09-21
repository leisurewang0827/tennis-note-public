(function () {
  const release = Object.freeze({
    version: "1.0.511",
    releaseId: "2026.09.21.02",
    appSurfaceVersion: "1.0.511",
    deployedAt: "2026-09-21T21:25:06+09:00",
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

  function renderReleaseLabels() {
    const storeLabel = `A ${release.store.androidVersion} / iOS ${release.store.iosVersion}`;
    // A build-source declaration is not evidence of an available internal artifact.
    const preparedLabel = "내부 빌드 미확인";
    document.querySelectorAll("[data-tennisnote-release]").forEach((element) => {
      const detail = element.dataset.tennisnoteRelease === "detail";
      const appOnly = element.dataset.tennisnoteRelease === "app";
      element.textContent = detail
        ? `웹 ${release.version} · 스토어 ${storeLabel} · 준비 ${preparedLabel}`
        : appOnly
          ? `앱 버전 ${release.appSurfaceVersion || release.version}`
          : `웹 v${release.version} · ${release.releaseId}`;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderReleaseLabels, { once: true });
  } else {
    renderReleaseLabels();
  }
})();
