(function () {
  const release = Object.freeze({
    version: "1.0.5",
    releaseId: "2026.07.19.1",
    nativeShell: {
      version: "1.0.2",
      build: 3,
    },
  });

  window.TENNIS_NOTE_RELEASE = release;

  function renderReleaseLabels() {
    document.querySelectorAll("[data-tennisnote-release]").forEach((element) => {
      const detail = element.dataset.tennisnoteRelease === "detail";
      element.textContent = detail
        ? `웹 v${release.version} · 배포 ${release.releaseId} · 스토어 v${release.nativeShell.version} (${release.nativeShell.build})`
        : `웹 v${release.version} · ${release.releaseId}`;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderReleaseLabels, { once: true });
  } else {
    renderReleaseLabels();
  }
})();
