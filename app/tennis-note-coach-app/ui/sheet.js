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

function openCoachModal(modalId) {
  const modal = $(`#${modalId}`);
  if (!modal) return;
  if (activeCoachModalId && activeCoachModalId !== modalId) closeCoachModal(activeCoachModalId, true);
  coachModalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
  if (!modal) return;
  modal.hidden = true;
  if (activeCoachModalId === modalId) activeCoachModalId = "";
  refreshCoachModalState();
  if (!fromHistory && history.state?.tennisNoteModal === modalId) {
    history.back();
    return;
  }
  coachModalReturnFocus?.focus?.({ preventScroll: true });
  coachModalReturnFocus = null;
}
