(() => {
  const rootSelector = "[data-tn-bottom-sheet]";
  const panelSelector = "[data-tn-sheet-panel]";
  const scrollSelector = "[data-tn-sheet-scroll]";
  const focusableSelector = [
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  const stateBySheet = new WeakMap();
  let activeSheet = null;
  let scrollLock = null;
  let dragState = null;
  let visibilityFrame = 0;
  let visibilityTimer = 0;
  let stableViewportBottom = 0;
  let stableViewportWidth = 0;
  let keyboardWasVisible = false;
  let systemSurfaceState = null;
  let accessoryBarQueue = Promise.resolve();

  function isAndroidViewport() {
    const capacitorPlatform = String(
      window.Capacitor?.getPlatform?.()
      || window.Capacitor?.platform
      || "",
    ).toLowerCase();
    return capacitorPlatform === "android" || /android/i.test(navigator.userAgent || "");
  }

  function androidSystemBottomInset({ height, offsetTop, width }) {
    if (!isAndroidViewport()) return 0;
    const screenHeight = Math.max(0, Math.round(Number(window.screen?.height) || 0));
    const measuredGap = Math.max(0, screenHeight - Math.round(offsetTop + height));
    const conservativeFloor = width > height ? 24 : 40;
    return Math.min(48, Math.max(conservativeFloor, measuredGap));
  }

  function viewportGeometry() {
    const viewport = window.visualViewport;
    const layoutHeight = Math.max(1, Math.round(window.innerHeight || viewport?.height || 1));
    const rawHeight = Math.max(1, Math.round(viewport?.height || layoutHeight));
    const rawOffsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    const offsetTop = Math.min(rawOffsetTop, Math.max(0, layoutHeight - 1));
    const height = Math.max(1, Math.min(rawHeight, layoutHeight - offsetTop));
    const layoutWidth = Math.max(1, Math.round(window.innerWidth || viewport?.width || 1));
    const width = Math.max(1, Math.min(Math.round(viewport?.width || layoutWidth), layoutWidth));
    const systemBottomInset = androidSystemBottomInset({ height, offsetTop, width });
    const usableHeight = Math.max(1, height - systemBottomInset);
    return {
      height,
      offsetTop,
      width,
      visibleBottom: offsetTop + height,
      systemBottomInset,
      usableHeight,
    };
  }

  function resolveSheet(target) {
    if (target instanceof HTMLElement) return target.matches(rootSelector) ? target : null;
    if (!target) return null;
    return document.getElementById(String(target).replace(/^#/, ""));
  }

  function resolveWithin(sheet, target) {
    if (target instanceof HTMLElement) return sheet.contains(target) ? target : null;
    if (!target) return null;
    try {
      return sheet.querySelector(target);
    } catch {
      return null;
    }
  }

  function focusableElements(sheet) {
    return [...sheet.querySelectorAll(focusableSelector)].filter((element) => (
      !element.hidden
      && element.getAttribute("aria-hidden") !== "true"
      && element.getClientRects().length > 0
    ));
  }

  function resetViewportBaseline() {
    const { visibleBottom, width } = viewportGeometry();
    stableViewportBottom = visibleBottom;
    stableViewportWidth = width;
    keyboardWasVisible = false;
  }

  function syncViewport() {
    const {
      height,
      offsetTop,
      width,
      visibleBottom,
      systemBottomInset,
      usableHeight,
    } = viewportGeometry();
    const activeElement = document.activeElement;
    const focusedEditor = Boolean(
      activeSheet
      && activeElement instanceof HTMLElement
      && activeSheet.contains(activeElement)
      && activeElement.matches("input, textarea, select, [contenteditable='true']"),
    );
    if (!stableViewportBottom || Math.abs(stableViewportWidth - width) > 60) resetViewportBaseline();
    const keyboardThreshold = Math.max(140, Math.round(stableViewportBottom * 0.18));
    const occludedBottom = Math.max(0, Math.round(stableViewportBottom - visibleBottom));
    const viewportAlreadyExcludesKeyboard = occludedBottom > keyboardThreshold
      && height + offsetTop <= stableViewportBottom - keyboardThreshold;
    const keyboardOffset = focusedEditor
      && occludedBottom > keyboardThreshold
      && !viewportAlreadyExcludesKeyboard
      ? occludedBottom
      : 0;
    if (occludedBottom > keyboardThreshold) keyboardWasVisible = true;
    if (!focusedEditor && keyboardWasVisible && visibleBottom >= stableViewportBottom - keyboardThreshold) {
      keyboardWasVisible = false;
    }
    document.documentElement.style.setProperty("--tn-visual-viewport-height", `${height}px`);
    document.documentElement.style.setProperty("--tn-visual-viewport-offset-top", `${offsetTop}px`);
    document.documentElement.style.setProperty("--tn-system-bottom-inset", `${systemBottomInset}px`);
    document.documentElement.style.setProperty("--tn-usable-viewport-height", `${usableHeight}px`);
    document.documentElement.style.setProperty("--tn-sheet-viewport-height", `${Math.round(usableHeight * 0.86)}px`);
    document.documentElement.style.setProperty("--tn-sheet-keyboard-offset", `${keyboardOffset}px`);
    if (focusedEditor) scheduleFieldVisibility(activeSheet, activeElement);
    return { height, offsetTop, width, systemBottomInset, usableHeight, keyboardOffset };
  }

  function stabilizeViewport() {
    resetViewportBaseline();
    syncViewport();
    window.requestAnimationFrame(syncViewport);
    window.setTimeout(syncViewport, 240);
  }

  function setNativeAccessoryBarVisible(sheet, isVisible) {
    if (sheet?.dataset.tnSheetHideAccessoryBar !== "true") return;
    const keyboard = window.Capacitor?.Plugins?.Keyboard;
    if (typeof keyboard?.setAccessoryBarVisible !== "function") return;
    accessoryBarQueue = accessoryBarQueue
      .catch(() => undefined)
      .then(() => keyboard.setAccessoryBarVisible({ isVisible }))
      .catch(() => undefined);
  }

  function activateSystemSurface(sheet) {
    const panel = sheet.querySelector(panelSelector);
    const panelColor = panel instanceof HTMLElement ? getComputedStyle(panel).backgroundColor : "";
    const surfaceColor = panelColor && panelColor !== "rgba(0, 0, 0, 0)" ? panelColor : "#f3f7f4";
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    systemSurfaceState = systemSurfaceState || {
      themeMeta,
      themeColor: themeMeta?.getAttribute("content") || "",
    };
    document.documentElement.style.setProperty("--tn-sheet-system-surface", surfaceColor);
    document.documentElement.classList.add("tn-sheet-system-surface-active");
    themeMeta?.setAttribute("content", surfaceColor);
    setNativeAccessoryBarVisible(sheet, false);
  }

  function restoreSystemSurface(sheet) {
    document.documentElement.classList.remove("tn-sheet-system-surface-active");
    document.documentElement.style.removeProperty("--tn-sheet-system-surface");
    document.documentElement.style.removeProperty("--tn-sheet-keyboard-offset");
    if (systemSurfaceState?.themeMeta) {
      systemSurfaceState.themeMeta.setAttribute("content", systemSurfaceState.themeColor);
    }
    systemSurfaceState = null;
    setNativeAccessoryBarVisible(sheet, true);
  }

  function lockBackground() {
    if (scrollLock) return;
    const scrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
    scrollLock = {
      scrollY,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.classList.add("sheet-open");
  }

  function unlockBackground() {
    if (!scrollLock) return;
    const saved = scrollLock;
    scrollLock = null;
    document.body.style.position = saved.bodyPosition;
    document.body.style.top = saved.bodyTop;
    document.body.style.left = saved.bodyLeft;
    document.body.style.right = saved.bodyRight;
    document.body.style.width = saved.bodyWidth;
    document.documentElement.style.overscrollBehavior = saved.htmlOverscrollBehavior;
    document.body.classList.remove("sheet-open");
    window.scrollTo({ top: saved.scrollY, left: 0, behavior: "auto" });
  }

  function ensureFieldVisible(sheet, target, behavior = "auto") {
    const scroller = sheet?.querySelector(scrollSelector);
    if (!(scroller instanceof HTMLElement) || !(target instanceof HTMLElement) || !scroller.contains(target)) return;
    const targetBox = target.closest("label") || target;
    const scrollRect = scroller.getBoundingClientRect();
    const targetRect = targetBox.getBoundingClientRect();
    const topLimit = scrollRect.top + 14;
    const bottomLimit = scrollRect.bottom - 18;
    let delta = 0;
    if (targetRect.bottom > bottomLimit) delta = targetRect.bottom - bottomLimit;
    else if (targetRect.top < topLimit) delta = targetRect.top - topLimit;
    if (Math.abs(delta) < 1) return;
    scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + delta), behavior });
  }

  function scheduleFieldVisibility(sheet, target, options = {}) {
    window.cancelAnimationFrame(visibilityFrame);
    window.clearTimeout(visibilityTimer);
    visibilityFrame = window.requestAnimationFrame(() => ensureFieldVisible(sheet, target, options.behavior));
    visibilityTimer = window.setTimeout(
      () => ensureFieldVisible(sheet, target, options.behavior),
      options.delay ?? 180,
    );
  }

  function focusTarget(sheet, target, options = {}) {
    const element = resolveWithin(sheet, target);
    if (!(element instanceof HTMLElement) || element.hasAttribute("disabled") || element.hidden) return false;
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
    scheduleFieldVisibility(sheet, element, options);
    return document.activeElement === element;
  }

  function dragParts(sheet) {
    return {
      panel: sheet.querySelector(panelSelector),
      backdrop: sheet.querySelector("[data-tn-sheet-backdrop]"),
    };
  }

  function setDragOffset(sheet, offset) {
    const { panel, backdrop } = dragParts(sheet);
    if (!(panel instanceof HTMLElement)) return;
    const height = Math.max(1, panel.getBoundingClientRect().height);
    const clamped = Math.min(height * 1.1, Math.max(-24, offset));
    const translated = clamped < 0 ? clamped * 0.18 : clamped;
    panel.style.transform = `translate3d(0, ${translated}px, 0)`;
    if (backdrop instanceof HTMLElement) {
      backdrop.style.opacity = String(Math.max(0, 1 - Math.max(0, translated) / height));
    }
  }

  function releaseDragStyles(sheet) {
    const { panel, backdrop } = dragParts(sheet);
    delete sheet.dataset.tnSheetDragging;
    panel?.getBoundingClientRect();
    if (panel instanceof HTMLElement) panel.style.removeProperty("transform");
    if (backdrop instanceof HTMLElement) backdrop.style.removeProperty("opacity");
  }

  function requestUserClose(sheet, reason) {
    const closeControl = sheet.querySelector("[data-tn-sheet-close]:not([data-tn-sheet-backdrop])")
      || sheet.querySelector("[data-tn-sheet-close]");
    if (closeControl instanceof HTMLElement) {
      closeControl.click();
      return activeSheet !== sheet || sheet.dataset.tnSheetState === "closing" || sheet.hidden;
    }
    return close(sheet, { reason });
  }

  function startDrag(event, handle) {
    const sheet = handle.closest(rootSelector);
    if (!sheet || sheet !== activeSheet || sheet.dataset.tnSheetState !== "open") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const panel = sheet.querySelector(panelSelector);
    if (!(panel instanceof HTMLElement)) return;
    const now = performance.now();
    dragState = {
      sheet,
      handle,
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastAt: now,
      velocityY: 0,
      offset: 0,
      panelHeight: Math.max(1, panel.getBoundingClientRect().height),
    };
    sheet.dataset.tnSheetDragging = "true";
    try {
      handle.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic events and older WebViews may not expose active pointer capture.
    }
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const now = performance.now();
    const elapsed = Math.max(1, now - dragState.lastAt);
    const stepVelocity = (event.clientY - dragState.lastY) / elapsed;
    dragState.velocityY = dragState.velocityY * 0.45 + stepVelocity * 0.55;
    dragState.lastY = event.clientY;
    dragState.lastAt = now;
    dragState.offset = event.clientY - dragState.startY;
    setDragOffset(dragState.sheet, dragState.offset);
    event.preventDefault();
  }

  function finishDrag(event, cancelled = false) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const current = dragState;
    dragState = null;
    try {
      current.handle.releasePointerCapture?.(event.pointerId);
    } catch {
      // Browsers can release capture before pointercancel reaches the page.
    }
    const distance = Math.max(0, current.offset);
    const distanceThreshold = Math.min(180, current.panelHeight * 0.28);
    const fastDistance = Math.min(96, Math.max(56, current.panelHeight * 0.12));
    const fastSwipe = current.velocityY > 0.55 && distance >= fastDistance;
    const shouldClose = !cancelled && (distance >= distanceThreshold || fastSwipe);
    if (shouldClose) {
      const accepted = requestUserClose(current.sheet, "drag");
      releaseDragStyles(current.sheet);
      if (!accepted) current.sheet.dataset.tnSheetState = "open";
      return;
    }
    releaseDragStyles(current.sheet);
  }

  function open(target, options = {}) {
    const sheet = resolveSheet(target);
    if (!sheet?.matches?.(rootSelector)) return false;
    if (activeSheet && activeSheet !== sheet) {
      close(activeSheet, { fromHistory: true, restoreFocus: false, immediate: true, reason: "replace" });
    }
    const previous = stateBySheet.get(sheet) || {};
    window.clearTimeout(previous.closeTimer);
    window.clearTimeout(previous.inputReadyTimer);
    const returnFocus = options.returnFocus instanceof HTMLElement
      ? options.returnFocus
      : document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheet.dataset.tnSheetInputReady = "false";
    const inputReadyTimer = window.setTimeout(() => {
      if (activeSheet === sheet && !sheet.hidden) sheet.dataset.tnSheetInputReady = "true";
    }, 220);
    stateBySheet.set(sheet, { ...previous, options, returnFocus, closeTimer: 0, inputReadyTimer });
    resetViewportBaseline();
    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
    sheet.dataset.tnSheetState = "opening";
    activeSheet = sheet;
    activateSystemSurface(sheet);
    lockBackground();
    syncViewport();
    const scroller = sheet.querySelector(scrollSelector);
    if (scroller instanceof HTMLElement && options.resetScroll !== false) scroller.scrollTop = 0;
    window.requestAnimationFrame(() => {
      if (activeSheet === sheet && !sheet.hidden) sheet.dataset.tnSheetState = "open";
    });
    const fallback = sheet.querySelector("[data-tn-sheet-close]:not([data-tn-sheet-backdrop])")
      || focusableElements(sheet)[0];
    const preferred = options.initialFocus || sheet.dataset.tnSheetInitialFocus;
    if (preferred) focusTarget(sheet, preferred, { delay: options.visibilityDelay });
    else if (fallback instanceof HTMLElement) fallback.focus({ preventScroll: true });
    if (options.history !== false) {
      const historyState = typeof history.state === "object" && history.state ? history.state : {};
      if (historyState.tennisNoteSheet !== sheet.id) {
        history.pushState({ ...historyState, tennisNoteSheet: sheet.id }, "", window.location.href);
      }
    }
    sheet.dispatchEvent(new CustomEvent("tennisnote:sheet-opened", { bubbles: true, detail: { id: sheet.id } }));
    return true;
  }

  function finishClose(sheet, options, savedState) {
    window.clearTimeout(savedState?.inputReadyTimer);
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    delete sheet.dataset.tnSheetState;
    delete sheet.dataset.tnSheetInputReady;
    if (!activeSheet) {
      unlockBackground();
      restoreSystemSurface(sheet);
      resetViewportBaseline();
    }
    if (options.restoreFocus !== false && savedState?.returnFocus?.isConnected) {
      savedState.returnFocus.focus({ preventScroll: true });
    }
    sheet.dispatchEvent(new CustomEvent("tennisnote:sheet-closed", { bubbles: true, detail: { id: sheet.id } }));
  }

  function close(target, options = {}) {
    const sheet = resolveSheet(target);
    if (!sheet?.matches?.(rootSelector) || sheet.hidden) return false;
    const beforeClose = new CustomEvent("tennisnote:sheet-before-close", {
      bubbles: true,
      cancelable: true,
      detail: { id: sheet.id, reason: options.reason || "api" },
    });
    if (!sheet.dispatchEvent(beforeClose)) return false;
    const savedState = stateBySheet.get(sheet) || {};
    window.clearTimeout(savedState.closeTimer);
    if (activeSheet === sheet) activeSheet = null;
    sheet.dataset.tnSheetState = "closing";
    const finish = () => finishClose(sheet, options, savedState);
    const closeTimer = options.immediate ? 0 : window.setTimeout(finish, 220);
    stateBySheet.set(sheet, { ...savedState, closeTimer });
    if (options.immediate) finish();
    if (!options.fromHistory && options.history !== false && history.state?.tennisNoteSheet === sheet.id) {
      history.back();
    }
    return true;
  }

  function trapFocus(event) {
    if (event?.key !== "Tab" || !activeSheet) return false;
    const focusable = focusableElements(activeSheet);
    if (!focusable.length) {
      event.preventDefault();
      return true;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return true;
    }
    return false;
  }

  document.addEventListener("focusin", (event) => {
    if (!activeSheet || !(event.target instanceof HTMLElement) || !activeSheet.contains(event.target)) return;
    syncViewport();
    if (event.target.matches("input, select, textarea, [contenteditable='true']")) {
      scheduleFieldVisibility(activeSheet, event.target);
    }
  });
  document.addEventListener("focusout", () => window.requestAnimationFrame(syncViewport));
  document.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest?.("[data-tn-sheet-handle]");
    if (handle instanceof HTMLElement) startDrag(event, handle);
  });
  document.addEventListener("pointermove", moveDrag, { passive: false });
  document.addEventListener("pointerup", (event) => finishDrag(event));
  document.addEventListener("pointercancel", (event) => finishDrag(event, true));
  window.addEventListener("resize", syncViewport, { passive: true });
  window.addEventListener("pageshow", stabilizeViewport, { passive: true });
  window.addEventListener("orientationchange", stabilizeViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", syncViewport, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncViewport, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") stabilizeViewport();
  });
  resetViewportBaseline();
  syncViewport();

  window.TennisNoteBottomSheet = Object.freeze({
    open,
    close,
    closeActive: (options = {}) => activeSheet ? close(activeSheet, options) : false,
    activeId: () => activeSheet?.id || "",
    focus: (target, options = {}) => activeSheet ? focusTarget(activeSheet, target, options) : false,
    ensureFieldVisible: (target, options = {}) => {
      const element = activeSheet ? resolveWithin(activeSheet, target) : null;
      if (!element) return false;
      scheduleFieldVisibility(activeSheet, element, options);
      return true;
    },
    trapFocus,
    viewportGeometry,
    syncViewport,
  });
})();
