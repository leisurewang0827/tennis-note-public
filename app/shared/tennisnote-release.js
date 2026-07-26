(function () {
  const release = Object.freeze({
    version: "1.0.94",
    releaseId: "2026.07.26.25",
    nativeShell: {
      version: "1.0.94",
      androidBuild: 39,
      iosBuild: 44,
    },
  });

  window.TENNIS_NOTE_RELEASE = release;

  function renderReleaseLabels() {
    const nativeBuildLabel = `Android ${release.nativeShell.androidBuild} / iOS ${release.nativeShell.iosBuild}`;
    document.querySelectorAll("[data-tennisnote-release]").forEach((element) => {
      const detail = element.dataset.tennisnoteRelease === "detail";
      element.textContent = detail
        ? `웹 v${release.version} · 배포 ${release.releaseId} · 스토어 v${release.nativeShell.version} (${nativeBuildLabel})`
        : `웹 v${release.version} · ${release.releaseId}`;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderReleaseLabels, { once: true });
  } else {
    renderReleaseLabels();
  }
})();
