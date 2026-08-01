(function () {
  const release = Object.freeze({
    version: "1.0.257",
    releaseId: "2026.08.01.05",
    deployedAt: "2026-08-01T19:58:28+09:00",
    minimumNativeShellVersion: "1.0.118",
    nativeShell: {
      version: "1.0.245",
      androidVersion: "1.0.245",
      androidBuild: 55,
      iosVersion: "1.0.127",
      iosBuild: 54,
    },
  });

  window.TENNIS_NOTE_RELEASE = release;

  function renderReleaseLabels() {
    const nativeBuildLabel =
      `Android ${release.nativeShell.androidVersion} (${release.nativeShell.androidBuild})` +
      ` / iOS ${release.nativeShell.iosVersion} (${release.nativeShell.iosBuild})`;
    document.querySelectorAll("[data-tennisnote-release]").forEach((element) => {
      const detail = element.dataset.tennisnoteRelease === "detail";
      const appOnly = element.dataset.tennisnoteRelease === "app";
      element.textContent = detail
        ? `웹 v${release.version} · 배포 ${release.releaseId} · 스토어 ${nativeBuildLabel}`
        : appOnly
          ? `앱 버전 ${release.version}`
          : `웹 v${release.version} · ${release.releaseId}`;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderReleaseLabels, { once: true });
  } else {
    renderReleaseLabels();
  }
})();
