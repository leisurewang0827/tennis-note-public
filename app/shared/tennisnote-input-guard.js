(() => {
  const ROOT_SELECTOR = "[data-tn-input-guard]";
  const CLOSE_SELECTOR = [
    "[data-tn-guard-close]",
    "[data-close-journal-composer]",
    "[data-close-profile-editor]",
    "[data-close-change-modal]",
    "[data-close-holding-modal]",
    "[data-close-member-enrollment]",
    "[data-close-account-deletion-modal]",
    "[data-close-lesson-modal]",
    "[data-close-member-management]",
    "[data-close-lesson-record]",
    "[data-cancel-schedule-edit]",
    "#closeLessonModal",
    "#cancelLessonModal",
    "#closeSubstituteModal",
    "#cancelSubstituteModal",
    "#closeCoachStaffModal",
    "#cancelCoachStaffModal",
    "#closeOneDayBookingModal",
    "#cancelOneDayBookingModal",
  ].join(",");
  const draftPrefix = "tennisnote-input-draft:";
  const stateByRoot = new WeakMap();
  const restoringRoots = new WeakSet();
  let activePrompt = null;
  let bypassClose = false;
  let bypassPopstate = false;
  let promptRoot = null;
  let promptLeave = null;

  function fieldElements(root) {
    return [...root.querySelectorAll("input, select, textarea")].filter((field) => (
      !field.disabled
      && !["button", "submit", "reset", "file", "password"].includes(field.type)
      && !field.hasAttribute("data-tn-draft-ignore")
    ));
  }

  function fieldKey(field, index) {
    return field.name || field.id || `field-${index}`;
  }

  function values(root) {
    return fieldElements(root).reduce((result, field, index) => {
      const key = fieldKey(field, index);
      result[key] = field.type === "checkbox" || field.type === "radio" ? Boolean(field.checked) : field.value;
      return result;
    }, {});
  }

  function signature(root) {
    return JSON.stringify(values(root));
  }

  function draftKey(root) {
    return `${draftPrefix}${location.pathname}:${root.dataset.tnInputGuard || root.id}`;
  }

  function saveDraft(root) {
    const payload = { savedAt: Date.now(), values: values(root) };
    try {
      sessionStorage.setItem(draftKey(root), JSON.stringify(payload));
      root.dataset.tnDraftState = "saved";
      return true;
    } catch (error) {
      console.warn("Tennis Note input draft could not be saved.", error);
      root.dataset.tnDraftState = "failed";
      return false;
    }
  }

  function clearDraft(root) {
    try {
      sessionStorage.removeItem(draftKey(root));
    } catch (error) {
      console.warn("Tennis Note input draft could not be cleared.", error);
    }
    delete root.dataset.tnDraftState;
  }

  function restoreDraft(root) {
    if (root.dataset.tnRestoreDraft !== "true") return false;
    let draft = null;
    try {
      draft = JSON.parse(sessionStorage.getItem(draftKey(root)) || "null");
    } catch {
      clearDraft(root);
      return false;
    }
    if (!draft?.savedAt || Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
      clearDraft(root);
      return false;
    }
    restoringRoots.add(root);
    try {
      fieldElements(root).forEach((field, index) => {
        const key = fieldKey(field, index);
        if (!Object.prototype.hasOwnProperty.call(draft.values || {}, key)) return;
        if (field.type === "checkbox" || field.type === "radio") field.checked = Boolean(draft.values[key]);
        else field.value = String(draft.values[key] ?? "");
        field.dispatchEvent(new Event("change", { bubbles: true }));
      });
    } finally {
      restoringRoots.delete(root);
    }
    root.dataset.tnDraftState = "restored";
    return true;
  }

  function begin(root) {
    const existing = stateByRoot.get(root);
    if (existing?.open) return;
    stateByRoot.set(root, { open: true, initial: "", submitted: false });
    const restored = restoreDraft(root);
    stateByRoot.set(root, {
      open: true,
      initial: restored ? "" : signature(root),
      submitted: false,
    });
  }

  function end(root) {
    const state = stateByRoot.get(root);
    if (state?.submitted) clearDraft(root);
    stateByRoot.set(root, { open: false, initial: "", submitted: false });
  }

  function isVisible(root) {
    return !root.hidden && root.getAttribute("aria-hidden") !== "true";
  }

  function isDirty(root) {
    const state = stateByRoot.get(root);
    if (!state?.open) begin(root);
    const current = stateByRoot.get(root);
    return Boolean(current && (current.initial === "" ? root.dataset.tnDraftState : signature(root) !== current.initial));
  }

  function visibleDirtyRoot() {
    return [...document.querySelectorAll(ROOT_SELECTOR)].reverse().find((root) => isVisible(root) && isDirty(root)) || null;
  }

  function ensurePrompt() {
    if (activePrompt) return activePrompt;
    const wrapper = document.createElement("section");
    wrapper.className = "tn-unsaved-prompt";
    wrapper.hidden = true;
    wrapper.innerHTML = `
      <div class="tn-unsaved-backdrop"></div>
      <article role="dialog" aria-modal="true" aria-labelledby="tnUnsavedTitle">
        <strong id="tnUnsavedTitle">작성 중인 내용이 있습니다</strong>
        <p>계속 작성하거나, 이 기기에 임시 저장한 뒤 나갈 수 있습니다.</p>
        <div>
          <button type="button" class="primary-button" data-tn-unsaved-action="continue">계속 작성</button>
          <button type="button" class="small-button" data-tn-unsaved-action="draft">임시 저장</button>
          <button type="button" class="small-button danger-button" data-tn-unsaved-action="leave">나가기</button>
        </div>
      </article>`;
    document.body.appendChild(wrapper);
    wrapper.addEventListener("click", (event) => {
      const action = event.target.closest("[data-tn-unsaved-action]")?.dataset.tnUnsavedAction;
      if (!action || !promptRoot) return;
      if (action === "continue") {
        closePrompt();
        return;
      }
      if (action === "draft") saveDraft(promptRoot);
      if (action === "leave") clearDraft(promptRoot);
      const leave = promptLeave;
      closePrompt();
      leave?.();
    });
    activePrompt = wrapper;
    return wrapper;
  }

  function closePrompt() {
    if (activePrompt) activePrompt.hidden = true;
    document.body.classList.remove("tn-unsaved-open");
    promptRoot = null;
    promptLeave = null;
  }

  function ask(root, onLeave) {
    saveDraft(root);
    promptRoot = root;
    promptLeave = onLeave;
    const prompt = ensurePrompt();
    prompt.hidden = false;
    document.body.classList.add("tn-unsaved-open");
    prompt.querySelector('[data-tn-unsaved-action="continue"]')?.focus({ preventScroll: true });
  }

  function markSaved(rootOrSelector) {
    const root = typeof rootOrSelector === "string" ? document.querySelector(rootOrSelector) : rootOrSelector;
    if (!root) return;
    clearDraft(root);
    stateByRoot.set(root, { open: isVisible(root), initial: signature(root), submitted: false });
  }

  function initializeRoots() {
    document.querySelectorAll(ROOT_SELECTOR).forEach((root) => {
      if (isVisible(root)) begin(root);
    });
  }

  document.addEventListener("input", (event) => {
    const root = event.target.closest?.(ROOT_SELECTOR);
    if (!root || !isVisible(root) || restoringRoots.has(root)) return;
    if (!stateByRoot.get(root)?.open) begin(root);
    saveDraft(root);
  }, true);

  document.addEventListener("change", (event) => {
    const root = event.target.closest?.(ROOT_SELECTOR);
    if (!root || !isVisible(root) || restoringRoots.has(root)) return;
    if (!stateByRoot.get(root)?.open) begin(root);
    saveDraft(root);
  }, true);

  document.addEventListener("submit", (event) => {
    const root = event.target.closest?.(ROOT_SELECTOR);
    const state = root ? stateByRoot.get(root) : null;
    if (state) state.submitted = true;
  }, true);

  document.addEventListener("click", (event) => {
    if (bypassClose) {
      bypassClose = false;
      return;
    }
    const trigger = event.target.closest?.(CLOSE_SELECTOR)
      || (event.target.matches?.(`${ROOT_SELECTOR}.modal-backdrop`) ? event.target : null);
    const root = trigger?.matches?.(ROOT_SELECTOR) ? trigger : trigger?.closest?.(ROOT_SELECTOR);
    if (!trigger || !root || !isDirty(root)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ask(root, () => {
      bypassClose = true;
      trigger.click();
    });
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const root = visibleDirtyRoot();
    if (!root) return;
    if (root.contains(document.activeElement) && document.activeElement?.matches?.("input, textarea, select")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.activeElement.blur();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    ask(root, () => {
      const trigger = root.querySelector(CLOSE_SELECTOR);
      if (trigger) {
        bypassClose = true;
        trigger.click();
      }
    });
  }, true);

  window.addEventListener("popstate", (event) => {
    if (bypassPopstate) {
      bypassPopstate = false;
      return;
    }
    const root = visibleDirtyRoot();
    if (!root) return;
    event.stopImmediatePropagation();
    const restoredState = { ...(event.state || {}) };
    if (root.classList.contains("app-bottom-sheet")) {
      delete restoredState.tennisNoteModal;
      restoredState.tennisNoteSheet = root.id;
    } else {
      delete restoredState.tennisNoteSheet;
      restoredState.tennisNoteModal = root.id;
    }
    history.pushState(restoredState, "", window.location.href);
    ask(root, () => {
      bypassPopstate = true;
      history.back();
    });
  }, true);

  window.addEventListener("beforeunload", (event) => {
    const root = visibleDirtyRoot();
    if (!root) return;
    saveDraft(root);
    event.preventDefault();
    event.returnValue = "";
  });

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      const root = record.target.closest?.(ROOT_SELECTOR) || (record.target.matches?.(ROOT_SELECTOR) ? record.target : null);
      if (!root) return;
      if (isVisible(root)) begin(root);
      else end(root);
    });
  });

  function install() {
    initializeRoots();
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden"] });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  window.TennisNoteInputGuard = Object.freeze({
    markSaved,
    saveDraft,
    clearDraft,
    isDirty,
  });
})();
