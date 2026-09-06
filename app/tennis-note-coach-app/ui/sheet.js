// 모달과 토스트를 여닫는 공통 장치.
//
// DOM 을 직접 만진다. app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라
// 호출부는 예전과 같다.

function hideCoachBrandSplash() {
  const splash = document.querySelector("#coachBrandSplash");
  if (!splash) return;
  const delay = Math.max(0, brandSplashMinimumDuration - (performance.now() - brandSplashStartedAt));
  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => {
      splash.hidden = true;
      window.TennisNoteModeTransition?.finish("coach", {
        view: document.body.dataset.activeView || "todayView",
      });
    }, 220);
  }, delay);
}

function refreshCoachModalState() {
  const modalOpen = Boolean(activeCoachModalId);
  document.body.classList.toggle("modal-open", modalOpen);
  const tabbar = $(".tabbar");
  if (tabbar) {
    if (modalOpen) tabbar.setAttribute("aria-hidden", "true");
    else tabbar.removeAttribute("aria-hidden");
  }
}

function captureCoachModalReturnContext() {
  const activeElement = document.activeElement;
  return {
    focusTarget: activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null,
    viewId: document.body.dataset.activeView || $(".view.is-active")?.id || "",
    lessonId: String(state.editingLessonId || ""),
    scrollX: Number(window.scrollX || document.documentElement.scrollLeft || 0),
    scrollY: Number(window.scrollY || document.documentElement.scrollTop || 0),
  };
}

function coachModalReturnFocusTarget(context) {
  if (context?.focusTarget?.isConnected) return context.focusTarget;
  if (context?.lessonId) {
    const lessonTrigger = $$('[data-edit-lesson-id]')
      .find((element) => String(element.dataset.editLessonId || "") === context.lessonId);
    if (lessonTrigger) return lessonTrigger;
  }
  return context?.viewId ? $(`#${context.viewId} .view-title, #${context.viewId} h1, #${context.viewId} h2`) : null;
}

function restoreCoachModalReturnContext(context) {
  if (!context) return;
  if (context.viewId && document.body.dataset.activeView !== context.viewId && $(`#${context.viewId}`)) {
    setView(context.viewId, { replaceHistory: true });
  }
  window.requestAnimationFrame(() => {
    window.scrollTo(Number(context.scrollX) || 0, Number(context.scrollY) || 0);
    coachModalReturnFocusTarget(context)?.focus?.({ preventScroll: true });
  });
}

function restorePendingCoachModalReturnContext() {
  const context = pendingCoachModalReturnContext;
  const queuedModalId = queuedCoachModalOpenId;
  pendingCoachModalReturnContext = null;
  pendingCoachModalHistoryCloseId = "";
  queuedCoachModalOpenId = "";
  restoreCoachModalReturnContext(context);
  if (queuedModalId) window.requestAnimationFrame(() => openCoachModal(queuedModalId));
}

function openCoachModal(modalId) {
  const modal = $(`#${modalId}`);
  if (!modal) return;
  if (pendingCoachModalHistoryCloseId) {
    queuedCoachModalOpenId = modalId;
    return;
  }
  if (activeCoachModalId && activeCoachModalId !== modalId) closeCoachModal(activeCoachModalId, true);
  coachModalReturnContext = captureCoachModalReturnContext();
  modal.hidden = false;
  activeCoachModalId = modalId;
  refreshCoachModalState();
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  if (historyState.tennisNoteModal !== modalId) {
    history.pushState({ ...historyState, tennisNoteMode: "coach", tennisNoteModal: modalId }, "", window.location.href);
  }
  window.setTimeout(() => coachFocusableElements(modal)[0]?.focus({ preventScroll: true }), 40);
}

function closeCoachModal(modalId, fromHistory = false) {
  const modal = $(`#${modalId}`);
  if (!modal || modal.hidden || activeCoachModalId !== modalId || pendingCoachModalHistoryCloseId) return;
  const returnContext = coachModalReturnContext;
  coachModalReturnContext = null;
  modal.hidden = true;
  if (activeCoachModalId === modalId) activeCoachModalId = "";
  refreshCoachModalState();
  if (!fromHistory && history.state?.tennisNoteModal === modalId) {
    pendingCoachModalReturnContext = returnContext;
    pendingCoachModalHistoryCloseId = modalId;
    history.back();
    return;
  }
  restoreCoachModalReturnContext(returnContext);
}
