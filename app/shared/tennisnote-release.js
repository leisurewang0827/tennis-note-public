(function () {
  const release = Object.freeze({
    version: "1.0.4",
    releaseId: "2026.07.18.3",
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
        ? `Web v${release.version} | Release ${release.releaseId} | Store v${release.nativeShell.version} (${release.nativeShell.build})`
        : `Web v${release.version} | ${release.releaseId}`;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderReleaseLabels, { once: true });
  } else {
    renderReleaseLabels();
  }
})();
