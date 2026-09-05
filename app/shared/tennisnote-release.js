(function () {
  const release = Object.freeze({
    version: "1.0.475",
    releaseId: "2026.09.06.01",
    appSurfaceVersion: "1.0.475",
    deployedAt: "2026-09-06T00:00:03+09:00",
    minimumNativeShellVersion: "1.0.118",
    nativeShell: {
      version: "1.0.428",
      androidVersion: "1.0.428",
      androidBuild: 101,
      iosVersion: "1.0.428",
      iosBuild: 101,
    },
    store: {
      androidVersion: "1.0.428",
      androidBuild: 101,
      iosVersion: "1.0.428",
      iosBuild: 101,
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
