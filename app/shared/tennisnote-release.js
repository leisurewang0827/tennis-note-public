(function () {
  const release = Object.freeze({
    version: "1.0.226",
    releaseId: "2026.07.30.49",
    deployedAt: "2026-07-30T22:40:00+09:00",
    minimumNativeShellVersion: "1.0.118",
    nativeShell: {
      version: "1.0.127",
      androidBuild: 50,
      iosBuild: 54,
    },
  });

  window.TENNIS_NOTE_RELEASE = release;

  function renderReleaseLabels() {
    const nativeBuildLabel = `Android ${release.nativeShell.androidBuild} / iOS ${release.nativeShell.iosBuild}`;
    document.querySelectorAll("[data-tennisnote-release]").forEach((element) => {
      const detail = element.dataset.tennisnoteRelease === "detail";
      const appOnly = element.dataset.tennisnoteRelease === "app";
      element.textContent = detail
        ? `웹 v${release.version} · 배포 ${release.releaseId} · 스토어 v${release.nativeShell.version} (${nativeBuildLabel})`
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
