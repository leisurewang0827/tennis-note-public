(function () {
  const release = Object.freeze({
    version: "1.0.376",
    releaseId: "2026.08.20.05",
    appSurfaceVersion: "1.0.376",
    deployedAt: "2026-08-20T20:58:08+09:00",
    minimumNativeShellVersion: "1.0.118",
    nativeShell: {
      version: "1.0.375",
      androidVersion: "1.0.375",
      androidBuild: 90,
      iosVersion: "1.0.375",
      iosBuild: 89,
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
