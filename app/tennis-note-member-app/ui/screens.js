// 화면별 모달과 시트를 여닫는 함수들.
//
// DOM 을 직접 만진다. app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라
// 호출부는 예전과 같다.

function openAccountDeletionModal() {
  const client = window.TennisNoteDataClient;
  if (!state.member?.profileId || !client?.getSession?.()?.access_token) {
    showToast("로그인한 회원만 탈퇴 요청을 접수할 수 있습니다");
    return;
  }
  $("#accountDeletionForm")?.reset();
  if ($("#accountDeletionMessage")) $("#accountDeletionMessage").textContent = "요청 접수 후 관리자가 처리 상태를 확인합니다.";
  if ($("#accountDeletionModal")) $("#accountDeletionModal").hidden = false;
}

function closeAccountDeletionModal() {
  if ($("#accountDeletionModal")) $("#accountDeletionModal").hidden = true;
}

function openMemberNotificationTarget(data = {}, route = "home") {
  const lesson = memberNotificationLesson(data);
  if (route === "schedule" && lesson) {
    state.selectedMemberScheduleTicketId = String(memberLessonTicketId(lesson) || "");
    state.selectedScheduleDay = lesson.day || state.selectedScheduleDay;
    state.memberScheduleMode = "mine";
    state.memberScheduleFullView = false;
    renderSchedule();
    openLessonDetailSheet(lesson.id);
    return true;
  }
  if (["feedback", "journal"].includes(route)) {
    const entry = memberNotificationJournalEntry(data);
    if (entry) {
      openJournalDetail(entry.id);
      return true;
    }
  }
  if (route === "membership") {
    const ticketId = String(data.ticketId || data.ticket_id || "").trim();
    const ticketCard = $$('[data-member-ticket-id]').find((item) => item.dataset.memberTicketId === ticketId);
    if (ticketCard) {
      window.setTimeout(() => ticketCard.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
      return true;
    }
  }
  if ((route === "schedule" || ["feedback", "journal"].includes(route)) && !lesson) {
    showToast("알림에 연결된 수업을 찾지 못했습니다. 최신 일정을 다시 확인해 주세요.");
  }
  jumpToTop();
  return false;
}

function openNtrpReference(referenceId) {
  const item = ntrpReferences.find((reference) => reference.id === referenceId);
  if (!item) return;
  const isPoster = Boolean(item.image);
  $("#ntrpReferenceContent").innerHTML = `
    <div class="section-title compact-title">
      <h2>${item.title}</h2>
      <span>${item.detail}</span>
    </div>
    ${
      isPoster
        ? `<img class="ntrp-modal-image" src="${item.image}" alt="${item.title}" />`
        : `<div class="ntrp-official-summary">
            ${ntrpQuickLevels
              .map(
                (level) => `
                  <article>
                    <strong>NTRP ${level.level}</strong>
                    <span>${level.label}</span>
                    <small>${level.detail}</small>
                  </article>`,
              )
              .join("")}
            <a class="small-button" href="${item.url}" target="_blank" rel="noreferrer">공식 PDF 열기</a>
          </div>`
    }`;
  $("#ntrpReferenceModal").hidden = false;
}

function closeNtrpReference() {
  $("#ntrpReferenceModal").hidden = true;
}

function openHoldingRequestModal(ticketId = "") {
  state.selectedHoldingTicketId = ticketId || currentLiveTicket()?.id || "";
  if (!currentHoldingTicket()) return;
  const today = new Date();
  $("#holdingRequestForm")?.reset();
  $("#holdingStartDate").value = today.toISOString().slice(0, 10);
  $("#holdingEndDate").value = new Date(today.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  $("#holdingRequestMessage").textContent = "승인되면 해당 기간만큼 회원권 종료일이 연장됩니다.";
  updateHoldingEvidenceFields();
  $("#holdingRequestModal").hidden = false;
  void ensureMemberHoldingData();
}

function closeHoldingRequestModal() {
  $("#holdingRequestModal").hidden = true;
}

function openMemberEnrollmentModal(productId, message = "") {
  const product = membershipProducts().find((item) => item.id === productId);
  const modal = $("#memberEnrollmentModal");
  if (!product || !modal) return;
  state.pendingPurchaseProductId = productId;
  const enrollment = state.memberEnrollment || {};
  const productSummary = $("#memberEnrollmentProduct");
  if (productSummary) {
    productSummary.innerHTML = `
      <span>선택 회원권</span>
      <strong>${escapeHtml(product.title)}</strong>
      <small>${escapeHtml(product.detail)} · ${formatWon(onlinePaymentAmount(product))}</small>`;
  }
  setEnrollmentInputValue("#enrollmentName", enrollment.applicant_name || state.member?.name || state.profile.name || "");
  setEnrollmentInputValue("#enrollmentPhone", enrollment.phone || state.profile.phone || "");
  setEnrollmentInputValue("#enrollmentBirthYear", enrollment.birth_year || state.member?.birthYear || "");
  setEnrollmentInputValue("#enrollmentNeighborhood", enrollment.neighborhood || state.member?.neighborhood || "");
  setEnrollmentInputValue("#enrollmentGender", enrollment.gender || state.member?.gender || "");
  setEnrollmentInputValue("#enrollmentPartnerName", enrollment.partner_name || "");
  setEnrollmentInputValue("#enrollmentPartnerPhone", enrollment.partner_phone || "");
  setEnrollmentInputValue("#enrollmentPartnerBirthYear", enrollment.partner_birth_year || "");
  setEnrollmentInputValue("#enrollmentPartnerNeighborhood", enrollment.partner_neighborhood || "");
  setEnrollmentInputValue("#enrollmentPartnerGender", enrollment.partner_gender || "");
  if ($("#enrollmentPrivacyConsent")) $("#enrollmentPrivacyConsent").checked = false;
  if ($("#enrollmentTermsConsent")) $("#enrollmentTermsConsent").checked = false;
  const maxBirthYear = new Date().getFullYear() - 5;
  if ($("#enrollmentBirthYear")) $("#enrollmentBirthYear").max = String(maxBirthYear);
  if ($("#enrollmentPartnerBirthYear")) $("#enrollmentPartnerBirthYear").max = String(maxBirthYear);
  if ($("#memberEnrollmentMessage")) $("#memberEnrollmentMessage").textContent = message;
  if ($("#memberEnrollmentOptionalDetails")) $("#memberEnrollmentOptionalDetails").open = false;
  updateEnrollmentPartnerFields(product);
  modal.hidden = false;
  window.setTimeout(() => $("#enrollmentName")?.focus(), 40);
}

function closeMemberEnrollmentModal() {
  const modal = $("#memberEnrollmentModal");
  if (modal) modal.hidden = true;
}

function openMembershipPurchaseFlow(renewalTicketId = "", productId = "", requestedPurpose = "") {
  const flow = purchaseFlowState();
  const activeTickets = currentLiveTickets();
  const returningSource = !activeTickets.length && !["add_coach", "one_day"].includes(requestedPurpose)
    ? latestPreviousMembershipTicket()
    : null;
  const requestedSource = (state.liveTickets || []).find((ticket) => String(ticket.id || "") === String(renewalTicketId || "")) || null;
  const sourceTicket = requestedSource
    || returningSource
    || (!["add_coach", "new_purchase", "one_day"].includes(requestedPurpose) ? activeTickets[0] || null : null);
  const sourceCanKeepSchedule = membershipTicketCanKeepSchedule(sourceTicket);
  const products = membershipProducts();
  const exactProduct = products.find((product) => (
    String(product.id || "") === String(productId || sourceTicket?.productId || "")
    && isDirectPurchaseMembershipProduct(product)
  )) || null;
  const inferredSourceFamilyId = sourceTicket ? membershipProductFamilyId({
    title: sourceTicket.title || "",
    group: sourceTicket.group || "",
    productKind: sourceTicket.productKind || "regular",
    mode: sourceTicket.productKind === "coupon" ? "pass" : "fixed",
    groupSize: sourceTicket.groupSize || 1,
    lessonMinutes: sourceTicket.lessonMinutes || 20,
    scheduleScope: sourceTicket.scheduleScope || (/주말/.test(sourceTicket.title || "") ? "weekend" : "weekday"),
  }) : "";
  const matchingProduct = exactProduct
    || (sourceTicket ? recommendedMembershipProducts(products, inferredSourceFamilyId, sourceTicket)[0] : null)
    || null;
  const lesson = sourceTicket ? purchaseTicketLesson(sourceTicket) : null;
  flow.open = true;
  flow.renewalTicketId = sourceTicket?.id || "";
  flow.productId = matchingProduct?.id || "";
  flow.familyId = matchingProduct
    ? membershipProductFamilyId(matchingProduct)
    : requestedPurpose === "one_day" ? "one-day" : activeMembershipPresetId() || "four-week";
  flow.step = 1;
  flow.purchasePurpose = ["renew_same", "add_coach", "new_purchase", "one_day"].includes(requestedPurpose)
    ? (requestedPurpose === "new_purchase" && returningSource ? "renew_same" : requestedPurpose)
    : sourceTicket ? "renew_same" : "new_purchase";
  flow.showMoreSlots = false;
  flow.showAllProducts = false;
  flow.productFrequency = matchingProduct ? purchaseProductFrequency(matchingProduct) : 1;
  flow.productScheduleScope = matchingProduct && ["weekday", "weekend"].includes(membershipProductFacet(matchingProduct, "scheduleScope"))
    ? membershipProductFacet(matchingProduct, "scheduleScope")
    : "weekday";
  flow.scheduleMode = purchaseUsesFlexibleCouponSchedule(matchingProduct, flow)
    ? "flex"
    : sourceCanKeepSchedule && matchingProduct ? "keep" : "change";
  flow.scheduleWeekStart = purchaseWeekStartDate(lesson?.lessonDate || purchaseEffectiveStartDate());
  flow.scheduleAvailableOnly = true;
  flow.coachRoleId = sourceTicket?.coachRoleId || "";
  flow.coachName = sourceTicket?.coach || memberScheduleTicketCoachName(sourceTicket || {}) || "";
  flow.preferredDate = lesson?.lessonDate || "";
  flow.preferredDay = lesson?.day || "";
  flow.preferredTime = lesson?.time || "";
  flow.preferredSchedules = [];
  flow.discountIssueId = "";
  flow.discountSelectionMode = "auto";
  flow.paymentErrorCode = "";
  flow.paymentErrorMessage = "";
  flow.completionStatus = "";
  state.membershipFilters = { ...membershipProductFamilyDefinition(flow.familyId).filters };
  state.membershipSelectedFamilyId = flow.familyId;
  saveSnapshot();
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  if (!historyState.tennisNotePurchase) {
    history.pushState({
      ...historyState,
      tennisNoteMode: "member",
      tennisNoteView: "shopView",
      tennisNotePurchase: true,
    }, "", window.location.href);
  }
  renderMembershipPurchaseFlow();
  void ensureMembershipPurchaseData().then(() => {
    if (!purchaseFlowState().open) return false;
    renderMembershipPurchaseFlow();
    return refreshPurchaseScheduleAvailability();
  });
  window.requestAnimationFrame(() => $("#membershipPurchaseFlow")?.scrollIntoView({ block: "start" }));
}

function closeMembershipPurchaseFlow(options = {}) {
  if (options.fromHistory !== true && history.state?.tennisNotePurchase) {
    history.back();
    return;
  }
  const flow = purchaseFlowState();
  flow.open = false;
  flow.step = 1;
  flow.completionStatus = "";
  saveSnapshot();
  renderProducts();
  if (options.skipScroll === true) return;
  window.requestAnimationFrame(() => {
    const target = $("#membershipProductBrowser");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function openBankTransferInstructions(preparedPayment = {}, product = {}, amount = 0) {
  const account = preparedPayment?.bankTransferAccount || {};
  bankTransferAccountNumberForCopy = String(account.accountNumber || "");
  bankTransferPaymentIdForCancel = String(preparedPayment?.paymentId || "");
  if ($("#bankTransferProductName")) $("#bankTransferProductName").textContent = product.title || "회원권";
  if ($("#bankTransferAmount")) $("#bankTransferAmount").textContent = formatWon(Number(preparedPayment?.amount || amount || 0));
  if ($("#bankTransferBankName")) $("#bankTransferBankName").textContent = account.bankName || "관리자 확인 필요";
  if ($("#bankTransferAccountNumber")) $("#bankTransferAccountNumber").textContent = bankTransferAccountNumberForCopy || "관리자 확인 필요";
  if ($("#bankTransferAccountHolder")) $("#bankTransferAccountHolder").textContent = account.accountHolder || "관리자 확인 필요";
  if ($("#bankTransferDepositorName")) $("#bankTransferDepositorName").textContent = preparedPayment?.depositorName || state.profile?.name || "신청자명";
  if ($("#bankTransferDepositDueAt")) {
    const dueAt = new Date(preparedPayment?.depositDueAt || "");
    $("#bankTransferDepositDueAt").textContent = Number.isFinite(dueAt.getTime())
      ? dueAt.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : `${Number(account.depositDeadlineHours || 24)}시간 이내`;
  }
  if ($("#bankTransferCustomInstructions")) {
    $("#bankTransferCustomInstructions").textContent = account.instructions || "신청자 이름으로 입금해 주세요.";
  }
  openAppSheet("bankTransferInstructionsSheet", { initialFocus: "#copyBankTransferAccountButton" });
}

function showNoticeIfNeeded() {
  const today = localDateKey();
  const activeNotices = activeNoticesForApp("member");
  const hiddenToday = new Set(state.noticeHiddenDate === today
    ? [...(Array.isArray(state.noticeHiddenIds) ? state.noticeHiddenIds : []), state.noticeHiddenId].filter(Boolean)
    : []);
  const notice = activeNotices.find((item) => !noticeSessionSeenIds.has(item.id) && !(item.showOncePerDay && hiddenToday.has(item.id)));
  if (!notice) {
    setNoticeDialogOpen(false);
    return;
  }
  const noticeIndex = activeNotices.findIndex((item) => item.id === notice.id);
  $("#noticeEyebrow").textContent = notice.source === "coupon-booking" ? "회원권 알림" : "공지사항";
  $("#noticeTitle").textContent = notice.title;
  $("#noticeBody").textContent = notice.body;
  $("#noticeMeta").textContent = `${noticeMetaText(notice)} · ${noticeIndex + 1}/${activeNotices.length}`;
  const noticeImage = $("#noticeImage");
  noticeImage.hidden = !notice.imageUrl;
  noticeImage.src = notice.imageUrl || "";
  noticeImage.alt = notice.imageAlt || notice.title;
  const noticeAction = $("#noticeAction");
  const safeActionUrl = /^https?:\/\//i.test(notice.actionUrl) ? notice.actionUrl : "";
  const actionRoute = notice.actionRoute === "schedule" ? "schedule" : "";
  const hasAction = Boolean(safeActionUrl || actionRoute);
  noticeAction.hidden = !hasAction;
  noticeAction.href = safeActionUrl || "#";
  noticeAction.dataset.route = actionRoute;
  noticeAction.target = safeActionUrl ? "_blank" : "_self";
  noticeAction.textContent = notice.actionLabel || "자세히 보기";
  $("#noticeDialog").dataset.noticeId = notice.id;
  setNoticeDialogOpen(true);
}

function closePaymentConfirmationModal() {
  closeAppSheet("paymentConfirmationModal");
  preparedPaymentContext = null;
}

function openPaymentConfirmationModal({ product, paymentId, preparedPayment, methodId, sdk }) {
  const enforcedMethodId = paymentMethodIdForRequest(methodId);
  preparedPaymentContext = { product, paymentId, preparedPayment, methodId: enforcedMethodId, sdk };
  const modal = $("#paymentConfirmationModal");
  if (!modal) return;
  const amount = purchasePaymentAmount(product, enforcedMethodId);
  const method = paymentMethodDefinition(enforcedMethodId);
  $("#paymentConfirmationProduct").textContent = product.title;
  $("#paymentConfirmationAmount").textContent = `${amount.toLocaleString("ko-KR")}원`;
  $("#paymentConfirmationMethod").textContent = method.label;
  $("#paymentConfirmationMessage").textContent = "결제창에서 결제 정보를 확인한 뒤 최종 결제를 완료합니다.";
  const button = $("#openPreparedPaymentButton");
  const bankButton = $("#switchPaymentToBankTransferButton");
  if (bankButton) bankButton.hidden = true;
  if (button) {
    button.disabled = false;
    button.textContent = `${amount.toLocaleString("ko-KR")}원 결제창 열기`;
  }
  openAppSheet("paymentConfirmationModal", { initialFocus: "#openPreparedPaymentButton" });
}

function openJournalComposer(dateValue = "") {
  const selectedDate = dateValue || state.selectedJournalDate || $("#journalDate")?.value || localDateKey();
  selectJournalDate(selectedDate);
  if ($("#journalDate")) $("#journalDate").value = selectedDate;
  if ($("#journalComposerDateLabel")) $("#journalComposerDateLabel").textContent = journalDateLabel(selectedDate);
  renderJournalMode();
  const initialFocus = $("#journalMode")?.value === "lesson" ? "#todayLessonContent" : "#practiceMemo";
  openAppSheet("journalComposerSheet", { initialFocus });
}

function openMembershipDetails(detailsId) {
  const target = $(`#${detailsId}`);
  if (!target) return;
  target.open = true;
  let ancestor = target.parentElement?.closest("details");
  while (ancestor) {
    ancestor.open = true;
    ancestor = ancestor.parentElement?.closest("details");
  }
  window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
}

function openJournalDetail(id) {
  const entry = journalEntries().find((item) => item.id === id);
  if (!entry) return;
  const curriculumBlock = entry.curriculumStep
    ? `
      <section class="journal-curriculum-card">
        <span>다음 수업 커리큘럼</span>
        <strong>${entry.curriculumStep.id} · ${entry.curriculumStep.title}</strong>
        <p>${entry.curriculumStep.focus}</p>
        <a class="small-button notion-link" href="${entry.curriculumStep.notionUrl || "https://www.notion.so/"}" target="_blank" rel="noreferrer">노션에서 자세히 보기</a>
      </section>`
    : "";
  const attendanceBlock = entry.kind === "레슨"
    ? `<div class="journal-lesson-result"><span>${{
      completed: "수업 완료",
      no_show: "노쇼",
      absence: "불참",
      cancelled: "취소",
      holiday: "휴무",
    }[String(entry.outcome || "").toLowerCase()] || "수업 기록"}</span><strong>${Number(entry.deductedSessions) > 0 ? `${Number(entry.deductedSessions)}회 차감` : "차감 없음"}</strong></div>`
    : "";
  $("#journalDetailContent").innerHTML = `
    <div class="section-title compact-title">
      <h2>${entry.title}</h2>
      <span>${entry.subtitle || entry.dateLabel}</span>
    </div>
    <article class="journal-detail-card">
      ${attendanceBlock}
      <section class="journal-feedback-block member-note">
        <strong>내 기록</strong>
        <p>${entry.body || "작성한 기록이 없습니다."}</p>
      </section>
      ${entry.mediaItems?.length ? `<strong>첨부</strong>${renderMediaPreview(entry.mediaItems)}` : ""}
      <section class="journal-feedback-block coach-note">
        <strong>코치 피드백</strong>
        <p>${entry.note || "코치 피드백을 기다리고 있습니다."}</p>
      </section>
      ${entry.next ? `<section class="journal-feedback-block next-note"><strong>다음 수업</strong><p>${entry.next}</p></section>` : ""}
      ${curriculumBlock}
    </article>`;
  $("#journalDetailModal").hidden = false;
}

function openJournalDay(day) {
  const monthValue = state.activeJournalMonth || new Date().toISOString().slice(0, 7);
  const dateValue = `${monthValue}-${String(day).padStart(2, "0")}`;
  const entries = journalEntries().filter((item) => item.dateValue === dateValue);
  if (!entries.length) return;
  if (entries.length === 1) {
    openJournalDetail(entries[0].id);
    return;
  }
  $("#journalDetailContent").innerHTML = `
    <div class="section-title compact-title">
      <h2>${day}일 운동 기록</h2>
      <span>하루에 작성한 기록을 모두 확인합니다.</span>
    </div>
    <div class="journal-entry-list">
      ${entries
        .map(
          (entry) => `
            <button class="journal-entry-button" type="button" data-open-journal-detail="${entry.id}">
              <strong>${entry.kind}</strong>
              <span>${entry.title}</span>
              <small>${entry.subtitle}</small>
            </button>`,
        )
        .join("")}
    </div>`;
  $("#journalDetailModal").hidden = false;
}

function closeJournalDetail() {
  $("#journalDetailModal").hidden = true;
}

function openCoachMode() {
  if (!canUseCoachMode()) return;
  coachModeNavigationStarted = true;
  sessionStorage.setItem(appModePreferenceKey, "coach");
  sessionStorage.setItem("tennis-note-coach-mode-entry", "member-profile");
  saveSnapshot();
  const target = window.TennisNoteModeTransition?.saved("coach", "todayView") || { view: "todayView" };
  const params = new URLSearchParams({ v: "1.0.435", view: target.view || "todayView" });
  const url = `../tennis-note-coach-app/index.html?${params.toString()}`;
  if (!window.TennisNoteModeTransition?.navigate(url, {
    from: "member",
    to: "coach",
    sourceView: document.body.dataset.activeMemberView || "profileView",
    targetView: target.view || "todayView",
    label: "코치 화면을 여는 중",
  })) window.location.replace(url);
}

function openMemberHelpModal() {
  memberHelpCategory = "all";
  memberHelpQuery = "";
  if ($("#memberHelpSearch")) $("#memberHelpSearch").value = "";
  renderMemberHelp();
  openAppModal("memberHelpModal", "#memberHelpSearch");
}

function closeMemberHelpModal() {
  closeAppModal("memberHelpModal");
}

function openKakaoInquiryModal(context = "support") {
  const modal = $("#kakaoInquiryModal");
  if (!modal) return;
  const oneDay = context === "one-day";
  if ($("#kakaoInquiryTitle")) $("#kakaoInquiryTitle").textContent = oneDay ? "원데이 레슨 문의" : "카카오로 문의하기";
  const description = modal.querySelector(".support-modal-card > p:not(.eyebrow)");
  if (description) {
    description.textContent = oneDay
      ? "희망 날짜, 시간, 레슨 경험을 남기면 가능한 코치와 결제 방법을 안내합니다."
      : "수업 변경, 회원권, 결제 관련 내용을 남겨주시면 운영시간에 순서대로 답변드립니다.";
  }
  modal.hidden = false;
  $("#kakaoChannelLink")?.focus();
}

function closeKakaoInquiryModal() {
  const modal = $("#kakaoInquiryModal");
  if (!modal) return;
  modal.hidden = true;
  $("#openKakaoInquiryButton")?.focus();
}

function openLessonDetailSheet(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId)
    || memberMakeupDueLessons().find((item) => item.id === lessonId)
    || (state.liveLessons || []).find((item) => item.id === lessonId);
  if (!lesson || !isOwnMemberScheduleLesson(lesson)) return;
  state.selectedLessonDetailId = lesson.id;
  renderLessonDetailSheet(lesson);
  openAppSheet("lessonDetailSheet");
}

function closeLessonDetailForAction() {
  closeAppSheet("lessonDetailSheet", true, { restoreFocus: false, immediate: true });
  if (history.state?.tennisNoteSheet === "lessonDetailSheet") {
    const nextState = { ...history.state };
    delete nextState.tennisNoteSheet;
    history.replaceState(nextState, "", window.location.href);
  }
}

function toggleRegularInitialScheduleSlot(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId && item.status === "available");
  const source = regularInitialSourceLesson();
  if (!lesson || !source) return;
  const requiredCount = Math.max(1, Number(source.frequencyPerWeek) || 1);
  const selected = [...state.regularInitialSelections];
  const existingIndex = selected.indexOf(lessonId);
  if (existingIndex >= 0) {
    selected.splice(existingIndex, 1);
  } else {
    const differentCoachSelected = selected.some((id) => {
      const selectedLesson = memberScheduleOptions().find((item) => item.id === id);
      return String(selectedLesson?.coachRoleId || "") !== String(lesson.coachRoleId || "");
    });
    if (differentCoachSelected) {
      selected.splice(0, selected.length);
      showToast("첫 정규시간은 같은 코치로 선택합니다.");
    }
    if (selected.length >= requiredCount) selected.shift();
    selected.push(lessonId);
  }
  state.regularInitialSelections = selected;
  renderSchedule();
  saveSnapshot();
}

async function openChangeRequestModal(preferredLessonId = "", options = {}) {
  if (!options.editing) {
    state.editingChangeRequestId = "";
    state.memberLessonChangeOperationKey = "";
    state.memberLessonChangeOperationSignature = "";
  }
  state.memberChangeCompactSelection = false;
  $("#changeRequestModal")?.classList.remove("is-inline-confirmation");
  const sourceId = await prepareChangeRequestSource(preferredLessonId);
  renderSelects();
  if (sourceId && [...$("#absenceLesson").options].some((option) => option.value === sourceId)) {
    $("#absenceLesson").value = sourceId;
    state.selectedMemberChangeSourceId = sourceId;
  }
  renderSelects();
  renderAvailableSlots();
  renderChangeModalSummary();
  openAppModal("changeRequestModal", "#absenceLesson");
  const source = currentScheduledLessonsForChange().find((lesson) => lesson.id === $("#absenceLesson")?.value);
  await syncMemberChangeCandidates(source);
}

async function openMemberChangeTimetable(preferredLessonId = "") {
  state.memberScheduleMode = "availability";
  state.memberScheduleModeTouched = true;
  state.memberScheduleFullView = false;
  if (preferredLessonId) {
    state.selectedMemberChangeSourceId = preferredLessonId;
    const preferredSource = currentScheduledLessonsForChange().find((lesson) => lesson.id === preferredLessonId);
    if (preferredSource) ensureMemberScheduleTicketSelection(memberLessonTicketId(preferredSource));
  }
  setView("scheduleView");
  renderSchedule();
  const preparedSourceId = await prepareChangeRequestSource(preferredLessonId || state.selectedMemberChangeSourceId);
  const sources = memberInlineChangeSources();
  if (preparedSourceId && sources.some((lesson) => lesson.id === preparedSourceId)) {
    state.selectedMemberChangeSourceId = preparedSourceId;
  }
  if (!sources.some((lesson) => lesson.id === state.selectedMemberChangeSourceId)) {
    state.selectedMemberChangeSourceId = "";
  }
  renderSchedule();
  renderSelects();
  const source = sources.find((lesson) => lesson.id === state.selectedMemberChangeSourceId);
  await syncMemberChangeCandidates(source);
  jumpToTop();
}

function closeChangeRequestModal() {
  state.regularInitialSelections = [];
  state.regularInitialOperationKey = "";
  state.memberLessonChangeOperationKey = "";
  state.memberLessonChangeOperationSignature = "";
  state.memberChangeCompactSelection = false;
  state.editingChangeRequestId = "";
  $("#changeRequestModal")?.classList.remove("is-inline-confirmation");
  closeAppModal("changeRequestModal");
}

function openChangeHistoryModal() {
  renderRequests();
  openAppModal("changeHistoryModal", "[data-history-top-close]");
}

function closeChangeHistoryModal() {
  closeAppModal("changeHistoryModal");
}

function syncIdentitySetupModal(user = null) {
  const modal = $("#identitySetupModal");
  if (!modal) return;
  if (!hasLiveMemberSession() || identityProfileComplete()) {
    modal.hidden = true;
    document.body.classList.remove("identity-setup-required");
    return;
  }
  state.profile.suggestedNickname = state.profile.suggestedNickname || suggestedNicknameFromUser(user);
  populateIdentitySetup(user);
  modal.hidden = false;
  document.body.classList.add("identity-setup-required");
  window.setTimeout(() => $("#identityRealName")?.focus(), 40);
}

function openAppFromSession(showNotice = false) {
  if (!state.member) return;
  $("#loginScreen").hidden = true;
  $("#appScreen").hidden = false;
  document.body.dataset.screen = "app";
  renderPendingApprovalGate();
  updateCoachModeAccess();
  void refreshBankNotificationBridge();
  applyRequestedMemberView();
  setView(activeMemberViewId(), { replaceHistory: true });
  jumpToTop();
  if (showNotice && !isApprovalPending()) showNoticeAfterLiveSync();
}

function openLocalCurriculumPreview() {
  const localHost = ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
  const previewRequested = new URLSearchParams(window.location.search).get("curriculumPreview") === "1";
  if (!localHost || !previewRequested) return false;
  state.dataMode = "demo";
  state.member = {
    provider: "local-preview",
    name: "커리큘럼 미리보기",
    nickname: "미리보기",
    profileId: "local-curriculum-preview",
    role: "member",
    memberKind: "lesson_member",
    status: "active",
    coachApproved: false,
  };
  state.profile = {
    ...state.profile,
    name: "커리큘럼 미리보기",
    nickname: "미리보기",
    branch: "테클하",
    mainCoach: "담당 코치",
    ticket: "커리큘럼 화면 검증",
  };
  ensureDemoPresentation();
  renderAll();
  openAppFromSession(false);
  setView("curriculumView");
  return true;
}

async function openOneDayPurchaseFlow(trigger = null) {
  return openMembershipPurchaseEntry({ purpose: "one_day", trigger });
}

async function openMembershipPurchaseEntry({ purpose = "new_purchase", productId = "", renewalTicketId = "", trigger = null } = {}) {
  if (membershipPurchaseEntryInFlight) return false;
  membershipPurchaseEntryInFlight = true;
  const button = trigger instanceof HTMLElement ? trigger : null;
  const originalLabel = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "회원권 확인 중";
  }
  try {
    setView("shopView", { replaceHistory: true });
    const ready = await ensureMembershipPurchaseData();
    const directProducts = membershipProducts().filter(isDirectPurchaseMembershipProduct);
    if (!ready || !directProducts.length) {
      const message = !ready
        ? "회원권 정보를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요."
        : "현재 구매 가능한 회원권이 없습니다. 관리자에게 문의해 주세요.";
      state.pendingPaymentCheckStatus = { tone: "alert", text: message };
      renderProducts();
      showToast(message);
      return false;
    }
    let selectedProductId = productId;
    if (purpose === "one_day") {
      const oneDayProduct = directProducts
        .filter((product) => membershipProductFamilyId(product) === "one-day")
        .sort((left, right) => Number(left.displayOrder || 999) - Number(right.displayOrder || 999))[0] || null;
      if (!oneDayProduct) {
        const message = "현재 예약 가능한 원데이 상품이 없습니다. 관리자에게 문의해 주세요.";
        state.pendingPaymentCheckStatus = { tone: "alert", text: message };
        renderProducts();
        showToast(message);
        return false;
      }
      selectedProductId = oneDayProduct.id;
    }
    openMembershipPurchaseFlow(renewalTicketId, selectedProductId, purpose);
    return true;
  } catch {
    const message = "회원권 구매 화면을 열지 못했습니다. 잠시 후 다시 시도해 주세요.";
    state.pendingPaymentCheckStatus = { tone: "alert", text: message };
    window.dispatchEvent(new CustomEvent("tennisnote:client-error", {
      detail: { category: "runtime", stage: "purchase_entry", code: "purchase_entry_failed", message },
    }));
    renderProducts();
    showToast(message);
    return false;
  } finally {
    membershipPurchaseEntryInFlight = false;
    if (button?.isConnected) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = originalLabel;
    }
  }
}
