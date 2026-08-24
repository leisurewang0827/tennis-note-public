(() => {
  const transitionKey = "tennis-note-mode-transition-v1";
  const savedStatePrefix = "tennis-note-mode-state-v1:";
  const transitionMaxAgeMs = 30_000;
  let navigationStarted = false;

  function readJson(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function currentScrollY() {
    return Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
  }

  function remember(mode, view, scrollY = currentScrollY()) {
    if (!mode) return null;
    const snapshot = {
      mode,
      view: String(view || ""),
      scrollY: Math.max(0, Number(scrollY) || 0),
      savedAt: Date.now(),
    };
    writeJson(`${savedStatePrefix}${mode}`, snapshot);
    return snapshot;
  }

  function saved(mode, fallbackView = "") {
    const snapshot = readJson(`${savedStatePrefix}${mode}`);
    if (!snapshot || snapshot.mode !== mode) return { mode, view: fallbackView, scrollY: 0 };
    return {
      mode,
      view: String(snapshot.view || fallbackView),
      scrollY: Math.max(0, Number(snapshot.scrollY) || 0),
    };
  }

  function transitionPayload() {
    const payload = readJson(transitionKey);
    if (!payload || Date.now() - Number(payload.startedAt || 0) > transitionMaxAgeMs) {
      try { sessionStorage.removeItem(transitionKey); } catch {}
      return null;
    }
    return payload;
  }

  function transitionCardMarkup(label, detail) {
    return `
      <div class="tn-mode-transition-card">
        <span class="tn-mode-transition-mark" aria-hidden="true">TN</span>
        <div>
          <strong>${label}</strong>
          <small>${detail}</small>
        </div>
        <i class="tn-mode-transition-spinner" aria-hidden="true"></i>
      </div>`;
  }

  function showSourceOverlay(label, detail) {
    let overlay = document.querySelector("#tennisNoteModeTransitionOverlay");
    if (!overlay) {
      overlay = document.createElement("section");
      overlay.id = "tennisNoteModeTransitionOverlay";
      overlay.className = "tn-mode-transition-overlay";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = transitionCardMarkup(label, detail);
    overlay.hidden = false;
    document.documentElement.classList.add("tn-mode-transitioning");
    return overlay;
  }

  function decorateDestinationSplash(payload, splashSelector) {
    const splash = document.querySelector(splashSelector);
    if (!splash) return;
    splash.classList.add("is-mode-transition");
    const label = payload.to === "coach" ? "코치 화면을 여는 중" : "회원 화면을 여는 중";
    const detail = "저장된 화면을 먼저 표시하고 최신 정보를 확인합니다.";
    if (!splash.querySelector(".tn-mode-transition-card")) {
      splash.insertAdjacentHTML("beforeend", transitionCardMarkup(label, detail));
    }
    splash.setAttribute("aria-label", label);
  }

  function begin({ from, to, sourceView = "", targetView = "", label = "화면을 전환하는 중" } = {}) {
    if (navigationStarted || !from || !to) return null;
    navigationStarted = true;
    const source = remember(from, sourceView);
    const target = saved(to, targetView);
    const resolvedTargetView = String(targetView || target.view || "");
    const payload = {
      from,
      to,
      sourceView: String(sourceView || ""),
      sourceScrollY: source?.scrollY || 0,
      targetView: resolvedTargetView,
      targetScrollY: target.view === resolvedTargetView ? target.scrollY : 0,
      startedAt: Date.now(),
    };
    writeJson(transitionKey, payload);
    if (to === "member") sessionStorage.setItem("tennis-note-member-mode-transition", String(payload.startedAt));
    showSourceOverlay(label, "현재 화면을 유지한 채 다음 화면을 준비합니다.");
    return payload;
  }

  function navigate(url, options = {}) {
    const payload = begin(options);
    if (!payload) return false;
    const target = new URL(url, window.location.href);
    target.searchParams.set("modeTransition", "1");
    if (payload.targetView) target.searchParams.set("view", payload.targetView);
    const navigateNow = () => window.location.replace(target.href);
    window.requestAnimationFrame(() => window.requestAnimationFrame(navigateNow));
    return true;
  }

  function consume(mode, { splashSelector = "" } = {}) {
    const payload = transitionPayload();
    if (!payload || payload.to !== mode) return null;
    if (splashSelector) decorateDestinationSplash(payload, splashSelector);
    document.documentElement.classList.add("tn-mode-transitioning");
    return payload;
  }

  function clearTransitionQueryParam() {
    try {
      const current = new URL(window.location.href);
      if (!current.searchParams.has("modeTransition")) return;
      current.searchParams.delete("modeTransition");
      window.history.replaceState(window.history.state, "", current.toString());
    } catch {}
  }

  function finish(mode, { view = "" } = {}) {
    const payload = transitionPayload();
    document.querySelector("#tennisNoteModeTransitionOverlay")?.remove();
    document.documentElement.classList.remove("tn-mode-transitioning");
    navigationStarted = false;
    clearTransitionQueryParam();
    if (!payload || payload.to !== mode) {
      remember(mode, view);
      return false;
    }
    const targetScrollY = payload.targetView && view && payload.targetView !== view
      ? 0
      : Math.max(0, Number(payload.targetScrollY) || 0);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetScrollY, left: 0, behavior: "auto" });
      remember(mode, view, targetScrollY);
    }));
    try { sessionStorage.removeItem(transitionKey); } catch {}
    return true;
  }

  window.TennisNoteModeTransition = Object.freeze({ begin, consume, finish, navigate, remember, saved });
})();
