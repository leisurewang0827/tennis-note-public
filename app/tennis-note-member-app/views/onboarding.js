// 공개 온보딩 — 화면을 그리는 것.
//
// renderOnboardingEntryIntro 는 HTML 문자열을 만들지 않고 textContent 만
// 바꾸지만, 이 앱은 render* 를 전부 views/ 에 두고 있어서 선례를 따랐다.

function publicOnboardingStageHtml(intent = storedOnboardingIntent()) {
  const stage = publicOnboardingStage(intent);
  const product = publicOnboardingProduct(intent);
  if (stage === "kind") {
    const oneDay = publicProductPreviewProducts().find((item) => isOneDayMembershipProduct(item));
    const regular = publicOnboardingRegularProduct("weekday", 1);
    return `<div class="public-onboarding-choice-grid">
      <button type="button" data-public-onboarding-kind="one-day"><span>원데이</span><strong>${escapeHtml(oneDay ? publicProductPreviewPrice(oneDay) : "가격 확인")}</strong><small>한 번 체험하기</small></button>
      <button type="button" data-public-onboarding-kind="regular"><span>정규 레슨</span><strong>${escapeHtml(regular ? `${formatWon(regular.cashAmount || regular.cardAmount)}부터` : "가격 확인")}</strong><small>4주부터 시작하기</small></button>
    </div>`;
  }
  if (stage === "scope") {
    return `${publicOnboardingBackButton(stage)}<div class="public-onboarding-choice-grid">
      <button type="button" data-public-onboarding-scope="weekday"><span>평일</span><strong>월–금</strong><small>주 1·2·3회</small></button>
      <button type="button" data-public-onboarding-scope="weekend"><span>주말</span><strong>토–일</strong><small>가능한 상품만 표시</small></button>
    </div>`;
  }
  if (stage === "coach") {
    const coaches = publicOnboardingCoaches(product);
    if (publicPurchaseDirectoryLoad.status === "loading") return `${publicOnboardingBackButton(stage)}<div class="public-onboarding-loading">활동 중인 코치와 시간을 확인하고 있습니다.</div>`;
    if (!coaches.length) return `${publicOnboardingBackButton(stage)}<div class="public-onboarding-empty"><strong>현재 선택 가능한 코치가 없습니다.</strong><button type="button" data-public-onboarding-retry>다시 확인</button></div>`;
    return `${publicOnboardingBackButton(stage)}<div class="public-onboarding-coach-grid">${coaches.map((coach) => {
      const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
      const hasTime = publicOnboardingAvailableSlots(product, roleId).length > 0;
      return `<button type="button" data-public-onboarding-coach="${escapeHtml(roleId)}" data-public-onboarding-coach-name="${escapeHtml(coach.name || "담당 코치")}" ${hasTime ? "" : "disabled"}><strong>${escapeHtml(memberCoachShortName(coach.name || "담당"))} 코치</strong><small>${hasTime ? "가능한 시간 보기" : "현재 가능한 시간 없음"}</small></button>`;
    }).join("")}</div>`;
  }
  if (stage === "frequency") {
    const frequencies = [1, 2, 3].filter((frequency) => publicOnboardingRegularProduct(intent.scheduleScope, frequency, intent.coachRoleId));
    return `${publicOnboardingBackButton(stage)}<div class="public-onboarding-frequency-grid">${frequencies.map((frequency) => `<button type="button" data-public-onboarding-frequency="${frequency}"><strong>주 ${frequency}회</strong><small>4주 · 총 ${frequency * 4}회</small></button>`).join("")}</div>`;
  }
  if (stage === "time") {
    const selectedKeys = new Set((intent.preferredSchedules || []).map((item) => `${item.lessonDate}:${item.startTime}:${item.coachRoleId}`));
    const slots = publicOnboardingAvailableSlots(product, intent.coachRoleId).slice(0, 12);
    const required = intent.choiceKind === "regular" ? Math.max(1, Number(intent.frequency) || 1) : 1;
    return `${publicOnboardingBackButton(stage)}<div class="public-onboarding-selection-count">요일·시간 ${selectedKeys.size}/${required} 선택</div><div class="public-onboarding-slot-grid">${slots.map((slot) => {
      const key = `${slot.lessonDate}:${slot.startTime}:${slot.coachRoleId}`;
      return `<button type="button" class="${selectedKeys.has(key) ? "is-selected" : ""}" data-public-onboarding-slot="${escapeHtml(key)}" data-slot-date="${escapeHtml(slot.lessonDate)}" data-slot-day="${escapeHtml(slot.day)}" data-slot-time="${escapeHtml(slot.startTime)}" aria-pressed="${selectedKeys.has(key)}"><span>${escapeHtml(purchaseDateLabel(slot.lessonDate))}</span><strong>${escapeHtml(slot.startTime)}</strong></button>`;
    }).join("")}</div>${slots.length ? "" : '<div class="public-onboarding-empty"><strong>선택 가능한 시간이 없습니다.</strong><button type="button" data-public-onboarding-retry>다시 확인</button></div>'}`;
  }
  return `${publicOnboardingBackButton(stage)}<article class="public-onboarding-summary"><span>선택 완료</span><strong>${escapeHtml(publicOnboardingSummary(intent, product))}</strong><small>로그인하면 같은 선택으로 최종 결제를 이어갑니다.</small></article>`;
}

function publicOnboardingBackButton(stage = "") {
  return stage === "kind" ? "" : '<button class="public-onboarding-back" type="button" data-public-onboarding-back>이전</button>';
}

function renderPublicProductPreview() {
  const preview = $("#publicProductPreview");
  const list = $("#publicProductPreviewList");
  const status = $("#publicProductPreviewStatus");
  const title = $("#publicProductPreviewTitle");
  const step = $("#publicProductPreviewStep");
  const loginActions = $("#publicOnboardingLoginActions");
  const existingMemberLogin = $("#publicOnboardingExistingLogin");
  const existingMemberNote = $("#publicOnboardingExistingMemberNote");
  if (!list || !status || !title) return;
  let intent = storedOnboardingIntent();
  if (!intent) {
    if (preview) preview.hidden = true;
    if (loginActions) loginActions.hidden = false;
    return;
  }
  if (preview) preview.hidden = false;
  const stage = publicOnboardingStage(intent);
  const labels = {
    kind: ["1단계", "원데이 또는 정규 레슨을 선택하세요"],
    scope: ["2단계", "평일 또는 주말을 선택하세요"],
    coach: [intent.choiceKind === "one-day" ? "2단계" : "3단계", "코치를 선택하세요"],
    frequency: ["4단계", "주 수업 횟수를 선택하세요"],
    time: [intent.choiceKind === "one-day" ? "3단계" : "5단계", "요일과 시간을 선택하세요"],
    login: ["선택 완료", "로그인 후 최종 결제합니다"],
  };
  if (step) step.textContent = labels[stage][0];
  title.textContent = labels[stage][1];
  list.innerHTML = publicOnboardingStageHtml(intent);
  if (loginActions) loginActions.hidden = stage !== "login";
  if (existingMemberLogin) existingMemberLogin.hidden = stage === "login";
  if (existingMemberNote) existingMemberNote.hidden = true;
  if (state.publicMembershipProductStatus === "error") {
    status.textContent = "기준 상품을 표시합니다. 판매 여부와 최종 가격은 로그인 후 다시 확인합니다.";
  } else if (["coach", "time"].includes(stage) && publicPurchaseDirectoryLoad.status === "error") {
    status.textContent = "시간표를 불러오지 못했습니다. 다시 확인해 주세요.";
  } else if (stage === "login") {
    status.textContent = "로그인 직후 선택한 시간이 아직 비어 있는지 다시 확인합니다.";
  } else {
    status.textContent = state.publicMembershipProductStatus === "ready" ? "현재 판매 중인 상품 기준입니다." : "최신 상품을 확인하고 있습니다.";
  }
}

function renderOnboardingEntryIntro() {
  const intro = $("#onboardingEntryIntro");
  if (!intro) return;
  const intent = storedOnboardingIntent();
  intro.hidden = !intent;
  if (!intent) return;
  const copy = onboardingIntentCopy(intent);
  if ($("#onboardingEntryEyebrow")) $("#onboardingEntryEyebrow").textContent = copy.eyebrow;
  if ($("#onboardingEntryTitle")) $("#onboardingEntryTitle").textContent = copy.title;
  if ($("#onboardingEntryDetail")) $("#onboardingEntryDetail").textContent = copy.detail;
}
