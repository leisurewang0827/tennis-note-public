// 시트·모달·토스트를 여닫는 공통 장치.
//
// DOM 을 직접 만진다. app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라
// 호출부는 예전과 같다.

function hideBrandSplash() {
  window.__tennisNoteBootReady?.();
  const splash = document.querySelector("#brandSplash");
  if (!splash) return;
  const elapsed = performance.now() - brandSplashStartedAt;
  const delay = Math.max(0, brandSplashMinimumDuration - elapsed);
  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => {
      splash.hidden = true;
      window.TennisNoteModeTransition?.finish("member", {
        view: document.body.dataset.activeMemberView || "homeView",
      });
    }, 240);
  }, delay);
}

function lockAppSheetBackground() {
  if (appSheetScrollLock) return;
  const scrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
  appSheetScrollLock = {
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
}

function unlockAppSheetBackground() {
  if (!appSheetScrollLock) return;
  const saved = appSheetScrollLock;
  appSheetScrollLock = null;
  document.body.style.position = saved.bodyPosition;
  document.body.style.top = saved.bodyTop;
  document.body.style.left = saved.bodyLeft;
  document.body.style.right = saved.bodyRight;
  document.body.style.width = saved.bodyWidth;
  document.documentElement.style.overscrollBehavior = saved.htmlOverscrollBehavior;
  window.scrollTo({ top: saved.scrollY, left: 0, behavior: "auto" });
}

function refreshAppSheetState() {
  const sheetOpen = Boolean(activeAppSheetId);
  document.body.classList.toggle("sheet-open", sheetOpen);
  if (sheetOpen) lockAppSheetBackground();
  else unlockAppSheetBackground();
}

function openAppSheet(sheetId, options = {}) {
  const target = $(`#${sheetId}`);
  if (!target) return;
  if (activeAppSheetId && activeAppSheetId !== sheetId) {
    closeAppSheet(activeAppSheetId, true, { restoreFocus: false, immediate: true });
  }
  activeAppSheetId = sheetId;
  if (window.TennisNoteBottomSheet?.open?.(target, options)) return;
  target.hidden = false;
  refreshAppSheetState();
  if (options.history !== false) {
    const historyState = typeof history.state === "object" && history.state ? history.state : {};
    if (historyState.tennisNoteSheet !== sheetId) {
      history.pushState({ ...historyState, tennisNoteSheet: sheetId }, "", window.location.href);
    }
  }
}

function closeAppSheet(sheetId, fromHistory = false, options = {}) {
  const target = $(`#${sheetId}`);
  if (!target) return false;
  if (activeAppSheetId === sheetId) activeAppSheetId = "";
  if (window.TennisNoteBottomSheet?.close?.(target, { ...options, fromHistory })) return true;
  target.hidden = true;
  refreshAppSheetState();
  if (!fromHistory && history.state?.tennisNoteSheet === sheetId) history.back();
  return true;
}

function closeVisibleAppSheet(fromHistory = false, options = {}) {
  const trackedSheet = activeAppSheetId ? $(`#${activeAppSheetId}`) : null;
  const visibleSheet = trackedSheet && !trackedSheet.hidden
    ? trackedSheet
    : document.querySelector(".app-bottom-sheet:not([hidden])");
  if (!visibleSheet?.id) return false;
  closeAppSheet(visibleSheet.id, fromHistory, options);
  return true;
}

function refreshAppModalState() {
  const modalOpen = Boolean(activeAppModalId);
  document.body.classList.toggle("modal-open", modalOpen);
  const tabbar = $(".tabbar");
  if (tabbar) {
    if (modalOpen) tabbar.setAttribute("aria-hidden", "true");
    else tabbar.removeAttribute("aria-hidden");
  }
}

function openAppModal(modalId, focusSelector = "") {
  const target = $(`#${modalId}`);
  if (!target) return;
  if (activeAppModalId && activeAppModalId !== modalId) closeAppModal(activeAppModalId, true);
  appModalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  target.hidden = false;
  activeAppModalId = modalId;
  refreshAppModalState();
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  if (historyState.tennisNoteModal !== modalId) {
    history.pushState({ ...historyState, tennisNoteModal: modalId }, "", window.location.href);
  }
  window.setTimeout(() => {
    const preferred = focusSelector ? target.querySelector(focusSelector) : null;
    const focusTarget = preferred && !preferred.disabled ? preferred : focusableElements(target)[0];
    focusTarget?.focus({ preventScroll: true });
  }, 40);
}

function closeAppModal(modalId, fromHistory = false) {
  const target = $(`#${modalId}`);
  if (!target) return;
  target.hidden = true;
  if (activeAppModalId === modalId) activeAppModalId = "";
  refreshAppModalState();
  if (!fromHistory && history.state?.tennisNoteModal === modalId) {
    history.back();
    return;
  }
  appModalReturnFocus?.focus?.({ preventScroll: true });
  appModalReturnFocus = null;
}

function closeVisibleAppModal(fromHistory = false) {
  const trackedModal = activeAppModalId ? $(`#${activeAppModalId}`) : null;
  const visibleModal = trackedModal && !trackedModal.hidden
    ? trackedModal
    : document.querySelector(".change-request-modal:not([hidden]), .modal:not([hidden])");
  if (!visibleModal?.id) return false;
  closeAppModal(visibleModal.id, fromHistory);
  return true;
}
