// 운영 설정 모달과 패널을 여닫는 함수들.
//
// DOM 을 직접 만진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function openAdminOperationalCache() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("indexeddb_unavailable"));
      return;
    }
    const request = window.indexedDB.open(adminOperationalCacheDbName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(adminOperationalCacheStoreName)) {
        database.createObjectStore(adminOperationalCacheStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("indexeddb_open_failed"));
  });
}

function openPolicyVersionEditor(policyId) {
  const policy = policyVersions.find((item) => item.id === policyId);
  const modal = $("#policyVersionEditorModal");
  const target = $("#policyVersionEditorContent");
  if (!policy || !modal || !target) return;
  policyVersionEditorState.policyId = policy.id;
  const managedSectionIds = new Set(["lesson-operation", "holding", "refund"]);
  const editableSections = policy.sections.filter((section) => !managedSectionIds.has(section.id));
  const managedSections = policy.sections.filter((section) => managedSectionIds.has(section.id));
  $("#policyVersionEditorTitle").textContent = policy.status === "active" ? "적용 정책 수정" : "정책 수정";
  target.innerHTML = `
    <div class="policy-version-editor-grid">
      <label>
        <small>정책명</small>
        <input type="text" maxlength="80" value="${escapeHtml(policy.title)}" data-policy-version-field="title" />
      </label>
      <label>
        <small>적용 시작일</small>
        <input type="date" value="${escapeHtml(policy.effectiveFrom)}" data-policy-version-field="effectiveFrom" />
      </label>
      <label>
        <small>작성 기준</small>
        <input type="text" maxlength="80" value="${escapeHtml(policy.source)}" data-policy-version-field="source" />
      </label>
      <label class="policy-version-summary-field">
        <small>정책 요약</small>
        <textarea rows="2" maxlength="300" data-policy-version-field="summary">${escapeHtml(policy.summary)}</textarea>
      </label>
    </div>
    <section class="policy-managed-section-list">
      <div>
        <strong>별도 설정에서 관리</strong>
        <span>수업·홀딩·환불 수치는 각 설정에서 수정하면 적용 정책에도 반영됩니다.</span>
      </div>
      <div class="policy-managed-section-chips">
        ${managedSections.map((section) => `<span>${escapeHtml(section.title)} ${section.rules.length}개</span>`).join("") || "<span>연결된 별도 설정 없음</span>"}
      </div>
    </section>
    <div class="policy-section-editor-toolbar">
      <div>
        <strong>추가 정책 항목</strong>
        <span>보강, 양도, 코치 변경처럼 안내에 포함할 내용을 관리합니다.</span>
      </div>
      <button class="ghost-button" type="button" id="addPolicyVersionSection">항목 추가</button>
    </div>
    <div id="policyVersionSectionEditors" class="policy-section-editor-list">
      ${editableSections.map((section) => policyVersionEditorSectionMarkup(section)).join("")}
    </div>`;
  modal.removeAttribute("hidden");
  setTimeout(() => target.querySelector("input")?.focus(), 0);
}

function closePolicyVersionEditor() {
  policyVersionEditorState.policyId = "";
  $("#policyVersionEditorModal")?.setAttribute("hidden", "");
}

function showPolicySnapshotPreview(policyId) {
  const policy = policyVersions.find((item) => item.id === policyId) || activePolicyVersion();
  const product = membershipProductDrafts[0] || membershipProductDefaults[0];
  const snapshot = ticketPolicySnapshot(product, policy);
  discountIssueLogs.unshift({
    id: `policy-snapshot-log-${Date.now()}`,
    text: `${snapshot.policyTitle} 스냅샷 확인: ${snapshot.product.title}`,
    at: new Date().toLocaleDateString("ko-KR"),
  });
  saveSnapshot();
  renderScheduleSettings();
  showToast("회원권 구매 시 저장될 정책 스냅샷을 확인했습니다");
}

function openSettingsWorkspace(tab) {
  if (!requestAdminUnlock("settings", () => openSettingsWorkspace(tab))) return;
  state.settingsTab = tab;
  setView("settings", { skipLock: true });
  renderSettingsTabs();
  void ensureAdminViewData("settings", tab);
  $("#settingsView")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
