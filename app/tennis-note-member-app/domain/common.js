// common 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function latestCurriculumLog() {
  return state.lessonLogs.find((log) => log.nextCurriculumId || log.curriculum?.id) || state.lessonLogs[0] || null;
}

function ensureDemoPresentation() {
  if (state.demoPresentationVersion === 6) return;
  state.demoPresentationVersion = 6;
  state.remaining = 6;
  state.lessonLogs = [
    {
      id: "demo-log-1",
      lessonId: "mon-1840",
      lessonLabel: "월 18:40 · 노 코치",
      round: 4,
      content: "포핸드 연결, 짧은 공 전진 스텝",
      selfMemo: "타점이 늦어질 때 준비가 늦었습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[0],
      nextCurriculumId: "BH-R1",
      coachComment: "준비 자세는 좋아졌고, 전진할 때 라켓면만 더 고정하면 됩니다.",
      memberVisibleSummary: "다음 수업: 백핸드 리턴 준비",
      ticketDeducted: true,
      mediaNames: ["포핸드-레슨영상.mp4"],
      submittedAt: "2026-07-01T10:00:00.000Z",
      journalDate: "2026-07-01",
    },
    {
      id: "demo-log-2",
      lessonId: "wed-2000",
      lessonLabel: "수 20:00 · 노 코치",
      round: 5,
      content: "백핸드 리턴 타이밍",
      selfMemo: "스플릿 스텝 후 어깨 회전이 늦었습니다.",
      status: "coach_pending",
      curriculum: curriculumSteps[1],
      nextCurriculumId: "BH-R1",
      coachComment: "",
      memberVisibleSummary: "",
      ticketDeducted: false,
      mediaNames: ["백핸드-리턴.jpg"],
      submittedAt: "2026-07-03T10:00:00.000Z",
      journalDate: "2026-07-03",
    },
    {
      id: "demo-log-3",
      lessonId: "mon-1840",
      lessonLabel: "월 18:40 · 노 코치",
      round: 3,
      content: "포핸드 크로스 코스와 회복 스텝",
      selfMemo: "크로스 방향은 좋아졌지만 회복이 늦었습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[2],
      nextCurriculumId: "FH-C01",
      coachComment: "방향은 안정됐고, 타구 후 첫 발 회복만 더 빠르게 가져가면 됩니다.",
      memberVisibleSummary: "다음 수업: 포핸드 크로스 반복",
      ticketDeducted: true,
      mediaNames: ["포핸드-크로스.jpg"],
      submittedAt: "2026-06-28T10:00:00.000Z",
      journalDate: "2026-06-28",
    },
    {
      id: "demo-log-4",
      lessonId: "wed-2000",
      lessonLabel: "수 20:00 · 노 코치",
      round: 2,
      content: "풋워크 입문, 스플릿 스텝",
      selfMemo: "공을 기다릴 때 발이 멈추는 습관이 있었습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[3],
      nextCurriculumId: "ST-01",
      coachComment: "공이 오기 전 작게 뛰는 리듬은 좋아졌습니다.",
      memberVisibleSummary: "다음 수업: 첫 발 반응",
      ticketDeducted: true,
      mediaNames: ["풋워크-스플릿.mp4"],
      submittedAt: "2026-06-25T10:00:00.000Z",
      journalDate: "2026-06-25",
    },
    {
      id: "demo-log-5",
      lessonId: "mon-1840",
      lessonLabel: "월 18:40 · 노 코치",
      round: 1,
      content: "기본 준비 자세와 포핸드 제자리 컨트롤",
      selfMemo: "라켓면을 오래 유지하는 게 어려웠습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[0],
      nextCurriculumId: "FH-01",
      coachComment: "손목을 쓰기보다 어깨 회전으로 보내는 감각을 유지하세요.",
      memberVisibleSummary: "다음 수업: 포핸드 연결",
      ticketDeducted: true,
      mediaNames: ["기본자세-demo.jpg"],
      submittedAt: "2026-06-21T10:00:00.000Z",
      journalDate: "2026-06-21",
    },
    {
      id: "demo-log-6",
      lessonId: "wed-2000",
      lessonLabel: "수 20:00 · 노 코치",
      round: 0,
      content: "체험 레슨, 레벨 체크와 목표 설정",
      selfMemo: "랠리가 길어질수록 자세가 무너졌습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[0],
      nextCurriculumId: "GM-01",
      coachComment: "기본기는 충분히 시작 가능하고, 포핸드 안정화부터 진행하면 좋겠습니다.",
      memberVisibleSummary: "다음 수업: 등록 후 포핸드 기본",
      ticketDeducted: true,
      mediaNames: ["체험레슨-demo.jpg"],
      submittedAt: "2026-06-18T10:00:00.000Z",
      journalDate: "2026-06-18",
    },
  ];
  state.practiceLogs = [
    {
      id: "practice-demo-1",
      date: "2026. 7. 2.",
      type: "레슨복습",
      memo: "포핸드 전진 스텝 30분, 짧은 공 접근 연습",
      next: "라켓면 고정 후 크로스 방향으로 보내기",
      mediaNames: ["포핸드-전진스텝.mp4"],
      feedbackQuestion: "전진할 때 타점이 늦는지 봐주세요.",
      feedbackStatus: "코치 피드백 요청",
      coachFeedback: "첫 발은 좋아졌고, 마지막 스텝만 조금 늦습니다.",
      submittedAt: "2026-07-02T11:00:00.000Z",
      journalDate: "2026-07-02",
    },
    {
      id: "practice-demo-2",
      date: "2026. 7. 3.",
      type: "랠리 및 게임",
      memo: "친구와 랠리 40분, 백핸드 리턴 타이밍 확인",
      next: "리턴 후 첫 발 회복 연습",
      mediaNames: ["랠리-백핸드.mov"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-07-03T12:00:00.000Z",
      journalDate: "2026-07-03",
    },
    {
      id: "practice-demo-3",
      date: "2026. 6. 30.",
      type: "개인연습",
      memo: "포핸드 크로스 20분, 준비 자세 반복",
      next: "타구 후 회복 스텝",
      mediaNames: ["포핸드-크로스-복습.mp4"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-06-30T12:00:00.000Z",
      journalDate: "2026-06-30",
    },
    {
      id: "practice-demo-4",
      date: "2026. 6. 27.",
      type: "랠리 및 게임",
      memo: "친구와 랠리, 짧은 공 접근 연습",
      next: "짧은 공에서 라켓면 고정",
      mediaNames: ["짧은공-접근.jpg"],
      feedbackQuestion: "앞으로 들어갈 때 스윙이 커지는지 확인해주세요.",
      feedbackStatus: "코치 피드백 요청",
      coachFeedback: "첫 발은 좋아졌고 마지막 스텝을 더 작게 가져가면 안정됩니다.",
      submittedAt: "2026-06-27T12:00:00.000Z",
      journalDate: "2026-06-27",
    },
    {
      id: "practice-demo-5",
      date: "2026. 6. 23.",
      type: "개인연습",
      memo: "백핸드 준비 자세와 어깨 회전 연습",
      next: "스플릿 스텝 후 어깨 먼저 돌리기",
      mediaNames: ["백핸드-준비자세.mov"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-06-23T12:00:00.000Z",
      journalDate: "2026-06-23",
    },
    {
      id: "practice-demo-6",
      date: "2026. 6. 19.",
      type: "기타",
      memo: "서브 토스 위치 확인과 루틴 연습",
      next: "토스 높이 일정하게 맞추기",
      mediaNames: ["서브-토스.jpg"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-06-19T12:00:00.000Z",
      journalDate: "2026-06-19",
    },
  ];
  state.ticketHistory = [
    { text: "7/3 수업기록 제출 · 피드백 대기", tone: "wait" },
    { text: "7/1 4회차 수업 완료 · 1회 차감", tone: "done" },
    { text: "잔여 6회 · 정상 이용중", tone: "done" },
  ];
  if (!state.makeupRequests.length) {
    state.makeupRequests = [
      {
        absence: "수 20:00 기존 수업",
        makeup: "금 19:00 수업 변경 희망 · 강 코치",
        reason: "회사 일정",
        policy: "24시간 이전 요청이라 자동 변경됩니다.",
        status: "자동 변경 완료",
      },
    ];
  }
}

async function promptPwaInstall() {
  if (!deferredPwaInstallPrompt) return;
  deferredPwaInstallPrompt.prompt();
  await deferredPwaInstallPrompt.userChoice.catch(() => null);
  deferredPwaInstallPrompt = null;
  updatePwaInstallButtons();
}

function bankNotificationAdminAllowed() {
  return nativeAppPlatform() === "android"
    && ["admin", "owner", "manager"].includes(String(state.member?.role || ""));
}

function setPushNotificationState(permission, status, detail) {
  state.pushNotifications = { permission, status, detail };
  renderPushNotificationSettings();
  saveSnapshot();
}

function memberCandidateEmptyReason(source = null) {
  if (!source?.couponBooking) {
    return "담당 코치, 운영시간, 회원권 규칙에 맞는 빈 시간이 없습니다.";
  }
  const period = memberCouponPeriodInfo(source);
  const week = activeMemberWeek();
  const exclusions = state.serverChangeCandidateExclusions || {};
  if (period?.startsOn && week.endDate < period.startsOn) {
    return `이 회원권은 ${memberReadableDate(period.startsOn)}부터 사용할 수 있습니다.`;
  }
  if (period?.expiresOn && week.startDate > period.expiresOn) {
    return `이 회원권은 ${memberReadableDate(period.expiresOn)}에 만료되어 선택한 주에는 예약할 수 없습니다.`;
  }
  if (period?.expiresOn && Number(exclusions.ticket_period) > 0) {
    const mismatch = period.isShorterThanProduct
      ? ` 상품 기본 ${period.expectedDays}일보다 짧게 등록되어 관리자 확인이 필요합니다.`
      : "";
    return `회원권은 ${memberReadableDate(period.expiresOn)}까지입니다. 이용기간 안에 담당 코치의 예약 가능한 시간이 없습니다.${mismatch}`;
  }
  if (Number(exclusions.occupied) > 0) {
    return "이용기간 안의 담당 코치 시간이 이미 예약되었습니다. 다른 주를 확인해 주세요.";
  }
  return "이용기간 안에 담당 코치의 예약 가능한 시간이 없습니다.";
}

function lessonReviewTitle(log) {
  const lesson = [...(state.liveLessons || []), ...lessons].find((item) => (
    String(item.id || item.serverLessonId || "") === String(log?.lessonId || log?.serverLessonId || "")
  ));
  const dateValue = log?.journalDate || lesson?.lessonDate || String(log?.submittedAt || "").slice(0, 10);
  const time = lesson?.time || String(log?.lessonLabel || "").match(/(?:[01]\d|2[0-3]):[0-5]\d/)?.[0] || "";
  const dateLabel = compactLessonDateLabel(dateValue, lesson?.day || String(log?.lessonLabel || "").split(" ")[0]);
  if (dateLabel) return `${dateLabel}${time ? ` ${time}` : ""} 피드백`;
  if (Number(log?.round) > 0) return `${Number(log.round)}회차 피드백`;
  return "수업 피드백";
}

function memberHoldingRequests(ticketId = state.selectedHoldingTicketId) {
  const shared = loadSharedData();
  const memberName = state.member?.name || state.profile.name;
  return (shared.holdingRequests || []).filter((request) => (
    request.member === memberName
    && (!ticketId || String(request.ticketId || "") === String(ticketId))
  ));
}

function memberKind() {
  return String(state.member?.memberKind || "journal_only");
}

function purchaseFlowState() {
  if (!state.purchaseFlow || typeof state.purchaseFlow !== "object") {
    state.purchaseFlow = {
      open: false,
      step: 1,
      familyId: "four-week",
      productId: "",
      renewalTicketId: "",
      purchasePurpose: "",
      showMoreSlots: false,
      scheduleMode: "keep",
      coachRoleId: "",
      coachName: "",
      preferredDate: "",
      preferredDay: "",
      preferredTime: "",
      preferredSchedules: [],
      discountIssueId: "",
      discountSelectionMode: "auto",
      completionStatus: "",
    };
  }
  state.purchaseFlow.familyId = membershipProductFamilyDefinition(state.purchaseFlow.familyId).id;
  state.purchaseFlow.purchasePurpose = String(state.purchaseFlow.purchasePurpose || "");
  state.purchaseFlow.showMoreSlots = state.purchaseFlow.showMoreSlots === true;
  state.purchaseFlow.preferredDate = String(state.purchaseFlow.preferredDate || "");
  state.purchaseFlow.preferredSchedules = Array.isArray(state.purchaseFlow.preferredSchedules)
    ? state.purchaseFlow.preferredSchedules
      .filter((schedule) => schedule && typeof schedule === "object")
      .map((schedule) => ({
        lessonDate: String(schedule.lessonDate || schedule.lesson_date || ""),
        day: String(schedule.day || schedule.preferredDay || ""),
        startTime: String(schedule.startTime || schedule.preferredTime || "").slice(0, 5),
        coachRoleId: String(schedule.coachRoleId || schedule.coach_role_id || ""),
        coachName: String(schedule.coachName || ""),
        durationMinutes: Math.max(10, Number(schedule.durationMinutes) || 20),
      }))
      .filter((schedule) => schedule.lessonDate && schedule.startTime && schedule.coachRoleId)
    : [];
  state.purchaseFlow.discountIssueId = String(state.purchaseFlow.discountIssueId || "");
  state.purchaseFlow.discountSelectionMode = state.purchaseFlow.discountSelectionMode === "manual" ? "manual" : "auto";
  return state.purchaseFlow;
}

function purchaseAvailabilityRange() {
  const today = purchaseEffectiveStartDate();
  const workspace = memberScheduleV2WorkspaceCache?.workspace || {};
  const start = [today, String(workspace.from || "")].filter(Boolean).sort().at(-1) || today;
  const defaultEndDate = new Date(`${start}T12:00:00`);
  defaultEndDate.setDate(defaultEndDate.getDate() + 20);
  const defaultEnd = localDateKey(defaultEndDate);
  const end = workspace.to && String(workspace.to) < defaultEnd ? String(workspace.to) : defaultEnd;
  return { start, end };
}

function normalizePage(type, total) {
  const key = pageStateKey(type);
  const maxPage = pageCount(total) - 1;
  state[key] = Math.min(Math.max(Number(state[key]) || 0, 0), maxPage);
  return state[key];
}

function paymentMethodDefinition(methodId = state.selectedPaymentMethod) {
  const base = paymentMethodDefinitions.find((method) => method.id === methodId)
    || paymentMethodDefinitions.find((method) => method.id === "tosspay")
    || paymentMethodDefinitions[0];
  const configured = (state.livePaymentOptions?.paymentMethods || []).find((method) => method.id === base.id) || {};
  return {
    ...base,
    label: String(configured.title || base.label),
    shortLabel: String(configured.title || base.shortLabel),
    displayOrder: Number(configured.displayOrder || 999),
    priceBasis: String(configured.priceBasis || (base.id === "bank_transfer" ? "cash" : "card")),
    couponAllowed: configured.couponAllowed !== false,
  };
}

function couponBookingPopupNotices() {
  if (state.dataMode !== "live" || !state.liveLessonsLoaded) return [];
  return (state.liveTickets || [])
    .filter((ticket) => isActiveCouponLiveTicket(ticket) && !liveTicketHasUpcomingLesson(ticket))
    .map((ticket) => ({
      id: `coupon-next-booking-${ticket.id}`,
      title: "다음 수업을 예약해 주세요",
      body: `${ticket.title || "쿠폰제 회원권"}이 ${Number(ticket.remaining) || 0}회 남아 있습니다. 시간표에서 다음 수업을 선택해 주세요.`,
      audience: "member",
      priority: "important",
      status: "active",
      showOncePerDay: true,
      source: "coupon-booking",
      actionLabel: "시간표 보기",
      actionRoute: "schedule",
      startDate: "",
      endDate: "",
      imageUrl: "",
      imageAlt: "",
    }));
}

function journalActivityItems() {
  const monthValue = state.activeJournalMonth || (state.selectedJournalDate || localDateKey()).slice(0, 7);
  const sourceLessons = state.liveLessonsLoaded ? state.liveLessons : memberScheduleLessons();
  const seenLessons = new Set();
  const lessonItems = sourceLessons
    .filter((lesson) => isOwnMemberScheduleLesson(lesson))
    .map((lesson) => {
      const id = String(lesson.serverLessonId || lesson.id || "");
      const dateValue = lesson.lessonDate || memberScheduleDateForDay(lesson.day);
      const status = journalActivityLessonStatus(lesson);
      return { id, dateValue, status };
    })
    .filter((item) => {
      if (!item.id || seenLessons.has(item.id) || !item.status || !item.dateValue?.startsWith(monthValue)) return false;
      seenLessons.add(item.id);
      return true;
    });

  const absenceItems = (state.liveMakeupEntitlements || [])
    .filter((entitlement) => (
      entitlement.lessonDate?.startsWith(monthValue)
      && !seenLessons.has(String(entitlement.sourceLessonId || ""))
    ))
    .map((entitlement) => ({
      id: `absence-${entitlement.id}`,
      dateValue: entitlement.lessonDate,
      status: "absent",
    }));

  return [...lessonItems, ...absenceItems];
}

function journalEntries() {
  const lessonEntries = state.lessonLogs.map((log) => {
    const dateValue = log.journalDate || new Date(log.submittedAt || Date.now()).toISOString().slice(0, 10);
    return {
      id: log.id,
      serverLessonId: log.serverLessonId || "",
      lessonId: log.lessonId || "",
      kind: "레슨",
      day: new Date(`${dateValue}T00:00:00`).getDate(),
      dateLabel: dateValue,
      dateValue,
      title: lessonReviewTitle(log),
      subtitle: log.lessonLabel,
      body: log.selfMemo,
      note: log.coachComment || "코치 피드백 대기",
      next: log.memberVisibleSummary || selectedNextText(log),
      outcome: log.participantOutcome || "",
      deductedSessions: Number(log.deductedSessions) || (log.ticketDeducted ? 1 : 0),
      curriculumStep: curriculumById(log.nextCurriculumId || log.curriculum?.id, log.curriculum),
      mediaNames: log.mediaNames || [],
      mediaItems: normalizeMediaItems(log),
    };
  });
  const practiceEntries = state.practiceLogs.map((log) => {
    const dateValue = log.journalDate || new Date(log.submittedAt || Date.now()).toISOString().slice(0, 10);
    return {
      id: log.id,
      kind: "개인운동",
      day: new Date(`${dateValue}T00:00:00`).getDate(),
      dateLabel: dateValue,
      dateValue,
      title: `${log.type} 기록`,
      subtitle: log.date,
      body: log.memo,
      note: log.coachFeedback || log.feedbackStatus || "개인 기록",
      next: log.next,
      mediaNames: log.mediaNames || [],
      mediaItems: normalizeMediaItems(log),
    };
  });
  return [...lessonEntries, ...practiceEntries];
}

function memberApprovalStatus() {
  return state.member?.status || state.member?.approvalStatus || "active";
}

function isApprovalPending() {
  return ["inactive", "archived"].includes(memberApprovalStatus());
}

function changePagedList(type, pageIndex) {
  if (type === "lesson") {
    state.lessonLogPage = pageIndex;
    normalizePage("lesson", state.lessonLogs.length);
    renderLessonLogs();
  }
  if (type === "ticket") {
    state.ticketHistoryPage = pageIndex;
    normalizePage("ticket", state.lessonLogs.length);
    renderTickets();
  }
  if (type === "expired") {
    state.expiredTicketPage = pageIndex;
    normalizePage("expired", membershipPassRecords().length);
    renderProducts();
  }
  if (type === "practice") {
    state.practiceLogPage = pageIndex;
    normalizePage("practice", state.practiceLogs.length);
    renderPracticeLogs();
  }
  saveSnapshot();
}

function memberRevisionBranchId() {
  const currentBranchId = currentLiveTicket()?.branchId || upcomingLiveTickets()[0]?.branchId;
  if (currentBranchId) return currentBranchId;
  return [...(state.liveTickets || [])]
    .filter((ticket) => ticket.branchId)
    .sort((left, right) => String(right.expiresOn || "").localeCompare(String(left.expiresOn || "")))[0]
    ?.branchId || "";
}
