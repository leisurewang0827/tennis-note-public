(function installProductDraftHost(root, document) {
  "use strict";
  const select = document.getElementById("r4ManagedBranch");
  const panel = document.getElementById("r4BranchHoursPanel");
  if (!select || !panel) return;
  let revision = 0, controller = null, container = null, hoursButton = null, demotedHours = false;
  function close() {
    revision++;
    controller?.destroy(); controller = null;
    if (container) { container.remove(); container = null; }
    if (hoursButton && demotedHours) { hoursButton.classList.remove("ghost-button"); hoursButton.classList.add("primary-button"); }
    hoursButton = null; demotedHours = false;
  }
  select.addEventListener("change", close);
  root.TennisNoteR4ProductDraftHost = Object.freeze({
    close,
    open({ client, branchId }) {
      close();
      if (!client?.sessionSubject?.() || !branchId || select.value !== branchId ||
        !root.TennisNoteR4ProductDraftCandidate || !root.TennisNoteR4ExistingAccount?.isProductionTarget?.()) return false;
      container = document.createElement("section");
      container.id = "r4ProductDraftHost";
      container.setAttribute("aria-label", "상품 설정 초안");
      panel.append(container);
      try {
        controller = root.TennisNoteR4ProductDraftCandidate.mount(container, {
          client, branchId, currentBranch: () => select.value, scopeRevision: () => revision, storage: root.localStorage,
        });
        hoursButton = document.querySelector('#r4BranchHoursForm button[type="submit"]');
        if (hoursButton?.classList.contains("primary-button") && !hoursButton.classList.contains("ghost-button")) {
          hoursButton.classList.remove("primary-button"); hoursButton.classList.add("ghost-button"); demotedHours = true;
        }
        return true;
      } catch { close(); return false; }
    },
  });
})(window, document);
