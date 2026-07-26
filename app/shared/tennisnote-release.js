(function () {
  const release = Object.freeze({
    version: "1.0.109",
    releaseId: "2026.07.27.09",
    nativeShell: {
      version: "1.0.100",
      androidBuild: 45,
      iosBuild: 50,
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
