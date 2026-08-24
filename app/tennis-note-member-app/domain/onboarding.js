// 공개 온보딩 — 값을 받아 판정해 돌려주는 것만.
//
// 비회원이 QR·카카오채널 등으로 들어왔을 때 어떤 단계에 있고 무엇을 고를 수
// 있는지 계산한다. DOM 도 서버도 만지지 않는다.

function normalizeOnboardingStart(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replaceAll("_", "-");
  if (["oneday", "one-day", "trial"].includes(normalized)) return "one-day";
  return onboardingIntentStartValues.has(normalized) ? normalized : "";
}

function normalizeOnboardingSource(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replaceAll("-", "_");
  return onboardingIntentSourceValues.has(normalized) ? normalized : "";
}

function onboardingIntentCopy(intent = storedOnboardingIntent()) {
  if (intent?.start === "one-day") {
    return {
      eyebrow: "원데이 체험 신청",
      title: "코치와 시간을 먼저 고른 뒤 로그인합니다.",
      detail: "로그인 후 빈 시간을 다시 확인하고 최종 결제합니다.",
    };
  }
  if (intent?.start === "membership") {
    return {
      eyebrow: "정규 회원권 등록",
      title: "평일·주말, 코치, 횟수와 시간을 먼저 선택합니다.",
      detail: "로그인 후 선택 내용을 그대로 불러와 최종 결제합니다.",
    };
  }
  return {
    eyebrow: "테니스노트 시작",
    title: "원하는 수업을 먼저 고른 뒤 가입합니다.",
    detail: "기존 회원은 일반 앱 화면에서 바로 로그인할 수 있습니다.",
  };
}

function publicOnboardingStage(intent = storedOnboardingIntent()) {
  if (!intent?.choiceKind) return "kind";
  if (intent.choiceKind === "regular" && !intent.scheduleScope) return "scope";
  if (!intent.coachRoleId) return "coach";
  if (intent.choiceKind === "regular" && !intent.frequency) return "frequency";
  const required = intent.choiceKind === "regular" ? Math.max(1, Number(intent.frequency) || 1) : 1;
  if ((intent.preferredSchedules || []).length !== required) return "time";
  return "login";
}

function publicOnboardingProduct(intent = storedOnboardingIntent()) {
  const products = publicProductPreviewProducts();
  if (intent?.choiceKind === "one-day") {
    return products.find((product) => isOneDayMembershipProduct(product)) || null;
  }
  if (intent?.choiceKind === "regular" && intent.scheduleScope) {
    return publicOnboardingRegularProduct(intent.scheduleScope, intent.frequency || 1, intent.coachRoleId);
  }
  return null;
}

function publicOnboardingRegularProduct(scope = "weekday", frequency = 1, coachRoleId = "") {
  return publicProductPreviewProducts().find((product) => (
    membershipProductFacet(product, "productKind") === "regular"
    && membershipProductFacet(product, "scheduleScope") === scope
    && Number(product.groupSize || 1) === 1
    && Number(product.lessonMinutes || 20) === 20
    && Number(product.frequencyPerWeek || 0) === Number(frequency || 1)
    && membershipProductFamilyId(product) === "four-week"
    && (!coachRoleId || purchaseProductAllowsCoach(product, coachRoleId))
  )) || null;
}

function publicOnboardingSummary(intent = storedOnboardingIntent(), product = publicOnboardingProduct(intent)) {
  const scope = intent?.scheduleScope === "weekend" ? "주말" : "평일";
  const lesson = intent?.choiceKind === "one-day" ? "원데이" : `${scope} · 주 ${intent?.frequency || 1}회`;
  const schedules = (intent?.preferredSchedules || []).map((item) => `${purchaseDateLabel(item.lessonDate)} ${item.startTime}`).join(" · ");
  return `${lesson} · ${memberCoachShortName(intent?.coachName || "선택 코치")} 코치${schedules ? ` · ${schedules}` : ""}${product ? ` · ${publicProductPreviewPrice(product)}` : ""}`;
}

function publicOnboardingCoaches(product = publicOnboardingProduct()) {
  const directory = publicOnboardingDirectory(product);
  return (directory?.coaches || [])
    .map(normalizePurchaseDirectoryCoach)
    .filter((coach) => purchaseProductAllowsCoach(product || {}, coach.serverRoleId || coach.roleId || coach.id))
    .sort((left, right) => memberScheduleLaneOrder(left) - memberScheduleLaneOrder(right));
}

function publicOnboardingDirectory(product = publicOnboardingProduct()) {
  const context = publicOnboardingDirectoryContext(product);
  return publicPurchaseDirectoryCache?.key === context.key ? publicPurchaseDirectoryCache.directory : null;
}

function publicOnboardingDirectoryContext(product = publicOnboardingProduct()) {
  const start = localDateKey();
  const endValue = new Date(`${start}T12:00:00`);
  endValue.setDate(endValue.getDate() + 27);
  const end = localDateKey(endValue);
  const branchId = String(product?.branchId || "");
  return { branchId, from: start, to: end, key: `${branchId}:${start}:${end}` };
}

function publicOnboardingOccupancy(directory = publicOnboardingDirectory()) {
  return (directory?.occupancy || []).map((occupied, index) => ({
    id: `public-occupancy-${index}`,
    lessonDate: String(occupied.lessonDate || ""),
    time: String(occupied.startTime || "").slice(0, 5),
    coachRoleId: String(occupied.coachRoleId || ""),
    coach_role_id: String(occupied.coachRoleId || ""),
    durationMinutes: Math.max(10, Number(occupied.durationMinutes) || 20),
    status: "occupied",
    serverStatus: "occupied",
  }));
}

function publicOnboardingSchedulePolicy(directory = publicOnboardingDirectory()) {
  return {
    ...loadAdminSchedulePolicy(),
    openStart: String(directory?.openStart || "06:40").slice(0, 5),
    openEnd: String(directory?.openEnd || "22:00").slice(0, 5),
    breakRules: (directory?.breakRules || []).map((rule, index) => ({
      id: rule.id || `public-break-${index}`,
      days: [days[Number(rule.dayOfWeek) === 0 ? 6 : Number(rule.dayOfWeek) - 1]].filter(Boolean),
      start: String(rule.startTime || "").slice(0, 5),
      end: String(rule.endTime || "").slice(0, 5),
      label: "예약 불가",
    })),
  };
}

function publicOnboardingAvailableSlots(product = publicOnboardingProduct(), coachRoleId = "") {
  const directory = publicOnboardingDirectory(product);
  if (!product || !directory) return [];
  const policy = publicOnboardingSchedulePolicy(directory);
  const lessons = publicOnboardingOccupancy(directory);
  const durationMinutes = Math.max(10, Number(product.lessonMinutes) || 20);
  const scopes = purchaseProductScheduleScopes(product);
  const coaches = publicOnboardingCoaches(product).filter((coach) => (
    !coachRoleId || String(coach.serverRoleId || coach.roleId || coach.id || "") === String(coachRoleId)
  ));
  const operations = Array.isArray(directory.operationDays) ? directory.operationDays : [];
  const slots = [];
  const now = Date.now();
  let dateKey = String(directory.from || localDateKey());
  const end = String(directory.to || dateKey);
  while (dateKey <= end) {
    const day = purchaseDateDay(dateKey);
    const dateScope = ["토", "일"].includes(day) ? "weekend" : "weekday";
    const operation = operations.find((item) => String(item.date || "") === dateKey) || null;
    if (scopes.has(dateScope) && !(durationMinutes === 30 && dateScope === "weekend") && operation?.mode !== "closed") {
      coaches.forEach((coach) => {
        memberCoachBookableTimes(coach, day, durationMinutes).forEach((time) => {
          if (new Date(`${dateKey}T${time}:00`).getTime() <= now) return;
          if (!purchaseOperationAllowsSlot(operation, time, durationMinutes)) return;
          if (memberBreakRuleOverlaps(policy, day, time, durationMinutes)) return;
          if (!isMemberCoachWorking(coach, day, time, durationMinutes)) return;
          if (purchaseHasCoachLessonAtDate(lessons, dateKey, time, coach, durationMinutes, policy)) return;
          if (!purchaseSlotInsideAnchorWindow(lessons, product, dateKey, time, coach, policy)) return;
          const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
          slots.push({
            lessonDate: dateKey,
            day,
            startTime: time,
            coachRoleId: roleId,
            coachName: coach.name || "담당 코치",
            durationMinutes,
          });
        });
      });
    }
    const next = new Date(`${dateKey}T12:00:00`);
    next.setDate(next.getDate() + 1);
    dateKey = localDateKey(next);
  }
  return slots.sort((left, right) => `${left.lessonDate} ${left.startTime}`.localeCompare(`${right.lessonDate} ${right.startTime}`));
}

function publicProductPreviewProducts() {
  if (state.publicMembershipProducts.length) return state.publicMembershipProducts;
  return defaultProducts.filter((product) => product.status !== "hidden");
}

function publicProductPreviewPrice(product = {}) {
  const firstLessonPrice = Number(product.firstLessonOfferPrice || 0);
  if (isOneDayMembershipProduct(product) && product.firstLessonOfferEnabled === true && firstLessonPrice > 0) {
    return `신규 ${formatWon(firstLessonPrice)}`;
  }
  const cash = Number(product.cashAmount || product.settlementBase || 0);
  const card = Number(product.cardAmount || product.listAmount || product.amount || 0);
  if (cash > 0 && card > 0) return `계좌 ${formatWon(cash)} · 토스 ${formatWon(card)}`;
  return formatWon(cash || card);
}
