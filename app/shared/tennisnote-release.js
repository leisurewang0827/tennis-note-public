(function () {
  const release = Object.freeze({
    version: "1.0.381",
    releaseId: "2026.08.21.03",
    appSurfaceVersion: "1.0.381",
    deployedAt: "2026-08-21T09:30:43+09:00",
    minimumNativeShellVersion: "1.0.118",
    nativeShell: {
      version: "1.0.377",
      androidVersion: "1.0.377",
      androidBuild: 91,
      iosVersion: "1.0.377",
      iosBuild: 90,
    },
    store: {
      androidVersion: "1.0.371",
      androidBuild: 89,
      iosVersion: "1.0.359",
      iosBuild: 85,
    },
  });

  window.TENNIS_NOTE_RELEASE = release;

  function renderReleaseLabels() {
    const storeLabel = `A ${release.store.androidVersion} / iOS ${release.store.iosVersion}`;
    const preparedLabel = release.nativeShell.androidVersion === release.nativeShell.iosVersion
      ? release.nativeShell.androidVersion
      : `A ${release.nativeShell.androidVersion} / iOS ${release.nativeShell.iosVersion}`;
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
