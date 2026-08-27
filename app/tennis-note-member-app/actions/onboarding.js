// 공개 온보딩 — 사용자가 누른 것을 처리.
//
// applyPendingOnboardingIntent 는 로그인 직후에 돈다. 들어올 때 담아둔
// 의도(원데이/정규, 고른 코치와 시간)를 실제 구매 흐름으로 이어준다.

async function handlePublicOnboardingAction(target) {
  if (!target) return false;
  const intent = storedOnboardingIntent();
  if (target.closest("[data-public-onboarding-retry]")) {
    await syncPublicPurchaseDirectory(publicOnboardingProduct(intent), { force: true });
    return true;
  }
  if (target.closest("[data-public-onboarding-back]")) {
    const stage = publicOnboardingStage(intent);
    if (stage === "login") updatePublicOnboardingIntent({ preferredSchedules: [] });
    else if (stage === "time" && intent.choiceKind === "regular") {
      updatePublicOnboardingIntent({ frequency: 0, productId: "", preferredSchedules: [] });
    } else if (stage === "time") {
      updatePublicOnboardingIntent({ coachRoleId: "", coachName: "", preferredSchedules: [] });
    } else if (stage === "frequency") {
      updatePublicOnboardingIntent({ coachRoleId: "", coachName: "", frequency: 0, productId: "", preferredSchedules: [] });
    } else if (stage === "coach" && intent.choiceKind === "regular") {
      updatePublicOnboardingIntent({ scheduleScope: "", coachRoleId: "", coachName: "", frequency: 0, productId: "", preferredSchedules: [] });
    } else {
      updatePublicOnboardingIntent({ start: "join", choiceKind: "", scheduleScope: "", coachRoleId: "", coachName: "", frequency: 0, familyId: "", productId: "", preferredSchedules: [] });
    }
    return true;
  }
  const kindButton = target.closest("[data-public-onboarding-kind]");
  if (kindButton) {
    const choiceKind = kindButton.dataset.publicOnboardingKind === "one-day" ? "one-day" : "regular";
    const product = choiceKind === "one-day"
      ? publicProductPreviewProducts().find((item) => isOneDayMembershipProduct(item)) || null
      : null;
    const next = updatePublicOnboardingIntent({
      start: choiceKind === "one-day" ? "one-day" : "membership",
      choiceKind,
      scheduleScope: "",
      frequency: 0,
      familyId: product ? membershipProductFamilyId(product) : "",
      productId: String(product?.id || ""),
      coachRoleId: "",
      coachName: "",
      preferredSchedules: [],
    });
    if (choiceKind === "one-day") await syncPublicPurchaseDirectory(publicOnboardingProduct(next));
    return true;
  }
  const scopeButton = target.closest("[data-public-onboarding-scope]");
  if (scopeButton) {
    const scheduleScope = scopeButton.dataset.publicOnboardingScope === "weekend" ? "weekend" : "weekday";
    const product = publicOnboardingRegularProduct(scheduleScope, 1);
    const next = updatePublicOnboardingIntent({
      scheduleScope,
      frequency: 0,
      familyId: product ? membershipProductFamilyId(product) : "four-week",
      productId: String(product?.id || ""),
      coachRoleId: "",
      coachName: "",
      preferredSchedules: [],
    });
    await syncPublicPurchaseDirectory(publicOnboardingProduct(next));
    return true;
  }
  const coachButton = target.closest("[data-public-onboarding-coach]");
  if (coachButton) {
    const product = publicOnboardingProduct(intent);
    updatePublicOnboardingIntent({
      familyId: product ? membershipProductFamilyId(product) : intent.familyId,
      productId: String(product?.id || intent.productId || ""),
      coachRoleId: String(coachButton.dataset.publicOnboardingCoach || ""),
      coachName: String(coachButton.dataset.publicOnboardingCoachName || ""),
      preferredSchedules: [],
    });
    return true;
  }
  const frequencyButton = target.closest("[data-public-onboarding-frequency]");
  if (frequencyButton) {
    const frequency = Math.max(1, Math.min(3, Number(frequencyButton.dataset.publicOnboardingFrequency) || 1));
    const product = publicOnboardingRegularProduct(intent.scheduleScope, frequency, intent.coachRoleId);
    if (!product) return false;
    updatePublicOnboardingIntent({
      frequency,
      familyId: membershipProductFamilyId(product),
      productId: String(product.id || ""),
      preferredSchedules: [],
    });
    return true;
  }
  const slotButton = target.closest("[data-public-onboarding-slot]");
  if (slotButton) {
    const product = publicOnboardingProduct(intent);
    const key = String(slotButton.dataset.publicOnboardingSlot || "");
    const available = publicOnboardingAvailableSlots(product, intent.coachRoleId);
    const slot = available.find((item) => `${item.lessonDate}:${item.startTime}:${item.coachRoleId}` === key);
    if (!slot) {
      if ($("#publicProductPreviewStatus")) $("#publicProductPreviewStatus").textContent = "방금 마감된 시간입니다. 가능한 시간을 다시 선택해 주세요.";
      return false;
    }
    const required = intent.choiceKind === "regular" ? Math.max(1, Number(intent.frequency) || 1) : 1;
    const schedules = [...(intent.preferredSchedules || [])];
    const existingIndex = schedules.findIndex((item) => `${item.lessonDate}:${item.startTime}:${item.coachRoleId}` === key);
    if (existingIndex >= 0) schedules.splice(existingIndex, 1);
    else if (required === 1) schedules.splice(0, schedules.length, slot);
    else if (schedules.length < required) {
      const selectedWeek = schedules[0] ? purchaseWeekStartDate(schedules[0].lessonDate) : "";
      if (selectedWeek && selectedWeek !== purchaseWeekStartDate(slot.lessonDate)) {
        schedules.splice(0, schedules.length, slot);
      } else if (schedules.some((item) => item.lessonDate === slot.lessonDate)) {
        if ($("#publicProductPreviewStatus")) $("#publicProductPreviewStatus").textContent = `주 ${required}회는 서로 다른 요일을 선택해 주세요.`;
        return false;
      } else schedules.push(slot);
    }
    updatePublicOnboardingIntent({ preferredSchedules: schedules });
    return true;
  }
  return false;
}

async function applyPendingOnboardingIntent() {
  const intent = storedOnboardingIntent();
  renderOnboardingEntryIntro();
  if (!intent || intent.applied || onboardingIntentApplying || !state.member) return false;
  void recordOnboardingIntent(intent);
  if (!identityProfileComplete()) {
    if ($("#identitySetupTitle")) $("#identitySetupTitle").textContent = "가입 정보를 확인해 주세요";
    if ($("#identitySetupMessage")) $("#identitySetupMessage").textContent = "이름·휴대전화·출생연도 확인 후 수업 신청으로 이어집니다.";
    return false;
  }
  onboardingIntentApplying = true;
  try {
    if (intent.start === "one-day") {
      await ensureMembershipPurchaseData();
      const selectedProduct = membershipProducts().find((product) => (
        String(product.id || "") === String(intent.productId || "")
        && isOneDayMembershipProduct(product)
      ));
      if (selectedProduct) {
        setView("shopView", { replaceHistory: true });
        openMembershipPurchaseFlow("", selectedProduct.id, "one_day");
        const flow = purchaseFlowState();
        flow.coachRoleId = intent.coachRoleId || "";
        flow.coachName = intent.coachName || "";
        flow.preferredSchedules = (intent.preferredSchedules || []).map((schedule) => ({ ...schedule }));
        syncLegacyPurchaseScheduleFields();
        saveSnapshot();
        renderMembershipPurchaseFlow();
      }
      else await openOneDayPurchaseFlow();
    } else if (intent.start === "membership") {
      setView("shopView", { replaceHistory: true });
      await ensureMembershipPurchaseData();
      const selectedProduct = membershipProducts().find((product) => (
        String(product.id || "") === String(intent.productId || "")
        && isDirectPurchaseMembershipProduct(product)
      ));
      openMembershipPurchaseFlow("", selectedProduct?.id || "", "new_purchase");
      if (selectedProduct) {
        const flow = purchaseFlowState();
        flow.productFrequency = Math.max(1, Number(intent.frequency) || purchaseProductFrequency(selectedProduct));
        flow.productScheduleScope = intent.scheduleScope || membershipProductFacet(selectedProduct, "scheduleScope");
        flow.coachRoleId = intent.coachRoleId || "";
        flow.coachName = intent.coachName || "";
        flow.preferredSchedules = (intent.preferredSchedules || []).map((schedule) => ({ ...schedule }));
        syncLegacyPurchaseScheduleFields();
        saveSnapshot();
        renderMembershipPurchaseFlow();
      }
    } else if (intent.start === "renew") {
      setView("shopView", { replaceHistory: true });
      openMembershipPurchaseFlow(currentLiveTickets()[0]?.id || "", "", "renew_same");
    } else {
      setView("homeView", { replaceHistory: true });
    }
    markOnboardingIntentApplied(intent);
    return true;
  } finally {
    onboardingIntentApplying = false;
  }
}

function updatePublicOnboardingIntent(changes = {}) {
  const current = storedOnboardingIntent() || { start: "join", source: "direct", capturedAt: new Date().toISOString() };
  saveOnboardingIntent({ ...current, ...changes, applied: false });
  renderOnboardingEntryIntro();
  renderPublicProductPreview();
  return storedOnboardingIntent();
}
// 이름은 open* 이지만 여기 둔다. 하는 일이 updatePublicOnboardingIntent 와 같다 —
// 담아둔 의도를 지우고 주소를 정리한 뒤 화면을 다시 그린다.

function openExistingMemberLoginFromOnboarding() {
  saveOnboardingIntent(null);
  const url = new URL(window.location.href);
  url.searchParams.delete("start");
  url.searchParams.delete("source");
  const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentState = typeof history.state === "object" && history.state ? history.state : {};
  history.replaceState({ ...currentState, tennisNoteOnboardingCaptured: false }, "", cleanUrl);
  renderOnboardingEntryIntro();
  renderPublicProductPreview();
  const existingMemberNote = $("#publicOnboardingExistingMemberNote");
  if (existingMemberNote) existingMemberNote.hidden = false;
  const status = $("#memberEmailLoginStatus");
  if (status) status.textContent = "로그인하면 등록된 전화번호로 기존 회원권과 시간표를 연결합니다.";
  window.setTimeout(() => $("#publicOnboardingLoginActions [data-login-provider]")?.focus(), 40);
}
