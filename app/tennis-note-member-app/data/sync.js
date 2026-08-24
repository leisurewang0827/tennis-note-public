// 서버에서 회원 데이터를 불러와 화면 상태에 채우는 함수들.
//
// 서버(Supabase)에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function syncMemberNotificationsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_notifications", {
      select: "id,user_id,channel,template_key,title,body,payload,scheduled_at,sent_at,status,created_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    const notifications = (rows || [])
      .filter((row) => row.channel === "app")
      .map((row) => normalizeLiveNotification(row))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const previousKey = state.lastLiveNotificationKey;
    state.liveNotifications = notifications;
    const latest = notifications[0];
    const latestKey = latest ? `${latest.id}:${latest.status}` : "";
    if (latest && latestKey !== state.lastLiveNotificationKey) {
      state.lastLiveNotificationKey = latestKey;
      state.ticketHistory.unshift({ text: `${latest.title} · ${latest.body}`, tone: latest.tone });
    }
    return {
      ok: true,
      newNotification: previousKey && latest && latestKey !== previousKey ? latest : null,
    };
  } catch {
    return false;
  }
}

async function syncMemberEnrollmentFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !client.readiness?.().ready || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_member_enrollments", {
      select: "id,user_id,branch_id,requested_product_id,form_version,status,applicant_name,phone,birth_year,neighborhood,gender,experience_level,lesson_goal,preferred_schedule,group_size,partner_name,partner_phone,partner_birth_year,partner_neighborhood,partner_gender,submitted_at,approved_at,updated_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    state.memberEnrollment = (rows || [])
      .filter((row) => row.form_version === memberEnrollmentFormVersion)
      .sort((left, right) => new Date(right.submitted_at || 0) - new Date(left.submitted_at || 0))[0] || null;
    return true;
  } catch {
    state.memberEnrollment = null;
    return false;
  }
}

async function syncMemberChangeCandidates(source = null) {
  if (!memberChangeUsesServerCandidates(source)) {
    state.serverChangeCandidateStatus = "fallback";
    state.serverChangeCandidateKey = "";
    state.serverChangeCandidates = [];
    state.serverChangeCandidateError = "";
    state.serverChangeCandidateExclusions = {};
    state.serverChangeAnchorGapMinutes = 40;
    state.serverChangePolicySnapshot = null;
    state.serverChangeBlockedReason = "";
    return false;
  }
  // A pending request keeps its source lesson scheduled. Use the same local
  // slot preview while editing and let the update RPC perform the final,
  // locked server validation before it changes the held target.
  if (state.editingChangeRequestId) {
    state.serverChangeCandidateStatus = "fallback";
    state.serverChangeCandidateKey = memberChangeCandidateKey(source);
    state.serverChangeCandidates = [];
    state.serverChangeCandidateError = "";
    state.serverChangeCandidateExclusions = {};
    state.serverChangeAnchorGapMinutes = 40;
    state.serverChangePolicySnapshot = null;
    state.serverChangeBlockedReason = "";
    renderSelects();
    renderAvailableSlots();
    renderSchedule();
    return false;
  }
  const week = { ...activeMemberWeek() };
  const range = memberChangeCandidateRange(source, week);
  const key = memberChangeCandidateKey(source, week);
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    state.serverChangeCandidateStatus = "error";
    state.serverChangeCandidateKey = key;
    state.serverChangeCandidates = [];
    state.serverChangeCandidateError = "로그인 연결을 다시 확인한 뒤 가능한 시간을 조회해 주세요.";
    renderSelects();
    renderAvailableSlots();
    renderSchedule();
    return false;
  }
  const requestId = ++memberChangeCandidateRequestSequence;
  state.serverChangeCandidateStatus = "loading";
  state.serverChangeCandidateKey = key;
  state.serverChangeCandidates = [];
  state.serverChangeCandidateError = "";
  state.serverChangeCandidateExclusions = {};
  state.serverChangeAnchorGapMinutes = 40;
  state.serverChangePolicySnapshot = null;
  state.serverChangeBlockedReason = "";
  renderSelects();
  renderAvailableSlots();
  renderSchedule();
  try {
    const ticketId = source.member_ticket_id || source.ticketId || "";
    const candidateArgs = source.couponBooking
      ? {
        target_ticket_id: ticketId,
        target_from: range.from,
        target_to: range.to,
      }
      : {
        target_lesson_id: source.serverLessonId,
        target_from: range.from,
        target_to: range.to,
      };
    let result;
    if (source.couponBooking) {
      result = await client.rpc("tn_member_coupon_candidates", candidateArgs, { timeoutMs: 12_000 });
    } else {
      try {
        result = await client.rpc("tn_member_change_candidates_v2", candidateArgs, { timeoutMs: 12_000 });
      } catch (error) {
        const errorText = `${error?.payload?.message || ""} ${error?.message || ""}`;
        if (!/tn_member_change_candidates_v2|PGRST202|42883|schema cache/i.test(errorText)) throw error;
        result = await client.rpc("tn_member_change_candidates", candidateArgs, { timeoutMs: 12_000 });
      }
    }
    if (requestId !== memberChangeCandidateRequestSequence || memberChangeCandidateKey(source) !== key) return false;
    if (!result || !Array.isArray(result.candidates)) {
      state.serverChangeCandidateStatus = source.couponBooking ? "error" : "fallback";
      state.serverChangeCandidateError = source.couponBooking
        ? "쿠폰 예약 가능 시간을 서버에서 확인하지 못했습니다. 다시 확인해 주세요."
        : "";
      renderSelects();
      renderAvailableSlots();
      renderSchedule();
      return false;
    }
    const reportedGap = result.anchorGapMinutes ?? result.anchorRule?.gapMinutes;
    state.serverChangeAnchorGapMinutes = reportedGap === null ? null : Math.max(0, Number(reportedGap) || 40);
    state.serverChangePolicySnapshot = result.policySnapshot && typeof result.policySnapshot === "object"
      ? result.policySnapshot
      : null;
    state.serverChangeBlockedReason = String(result.blockedReason || "");
    const mappedCandidates = memberUniqueAvailableSlots(
      result.candidates.map((candidate) => mapServerMemberChangeCandidate(candidate, source)),
    );
    state.serverChangeCandidates = mappedCandidates;
    state.serverChangeCandidateExclusions = result.exclusionSummary && typeof result.exclusionSummary === "object"
      ? result.exclusionSummary
      : {};
    state.serverChangeCandidateStatus = "ready";
    renderSelects();
    renderAvailableSlots();
    renderSchedule();
    return true;
  } catch (error) {
    if (requestId !== memberChangeCandidateRequestSequence) return false;
    const errorText = `${error?.payload?.message || ""} ${error?.message || ""}`;
    if (/tn_member_(change|coupon)_candidates|PGRST202|42883|schema cache/i.test(errorText)) {
      state.serverChangeCandidateStatus = source.couponBooking ? "error" : "fallback";
      state.serverChangeCandidateError = source.couponBooking
        ? "쿠폰 예약 가능 시간을 서버에서 확인하지 못했습니다. 다시 확인해 주세요."
        : "";
      renderSelects();
      renderAvailableSlots();
      renderSchedule();
      return false;
    }
    const failure = memberChangeCandidateFailure(errorText);
    state.serverChangeCandidateStatus = "error";
    state.serverChangeCandidateError = failure.message;
    state.scheduleV2SyncErrorCode = failure.code;
    renderSelects();
    renderAvailableSlots();
    renderSchedule();
    return false;
  }
}

async function syncMemberScheduleV2(profile = null, options = {}) {
  const client = window.TennisNoteDataClient;
  const requestId = options.requestId || ++memberScheduleV2RequestSequence;
  const context = memberScheduleV2Context(profile, options.week || activeMemberWeek());
  const { profileId, week, workspaceEndDate, key: cacheKey } = context;
  if (!client?.rpc || !client.getSession?.()?.access_token || !profileId) return false;
  const cached = memberScheduleV2WorkspaceCache;
  if (!options.force && cached?.key === cacheKey && Date.now() - cached.loadedAt < 10_000) {
    if (requestId !== memberScheduleV2RequestSequence) return false;
    const identityIssue = memberScheduleIdentityIssue(cached.workspace, cached.integrity, profileId);
    if (identityIssue) return rejectMemberScheduleIdentity(identityIssue, cached.integrity);
    state.scheduleV2Integrity = cached.integrity || null;
    const applied = applyScheduleV2MemberWorkspace(cached.workspace, cached.releasedMakeupSlots, cached.oneDaySlots);
    if (applied) state.scheduleV2LoadedKey = cacheKey;
    return applied;
  }
  try {
    const [workspace, releasedMakeupSlots, oneDaySlots, integrity] = await Promise.all([
      client.rpc("tn_schedule_v2_member_workspace", {
        target_from: week.startDate,
        target_to: workspaceEndDate,
      }),
      client.rpc("tn_member_released_makeup_slots", {}).catch(() => []),
      client.rpc("tn_member_one_day_schedule_slots", {}).catch(() => []),
      client.rpc("tn_current_member_schedule_integrity", {}).catch(() => null),
    ]);
    if (requestId !== memberScheduleV2RequestSequence) return false;
    if (!workspace?.actorUserId || !Array.isArray(workspace.lessons)) return false;
    const branchIds = [...new Set((workspace.branches || []).map((branch) => branch.id).filter(Boolean))];
    const operationDays = (await Promise.all(branchIds.map((branchId) => (
      client.rpc("tn_schedule_v2_operation_days_between", {
        target_branch_id: branchId,
        target_from: week.startDate,
        target_to: workspaceEndDate,
      }).catch(() => [])
    )))).flat();
    if (requestId !== memberScheduleV2RequestSequence) return false;
    workspace.operationDays = operationDays;
    state.scheduleOperationDays = operationDays;
    const identityIssue = memberScheduleIdentityIssue(workspace, integrity, profileId);
    if (identityIssue) return rejectMemberScheduleIdentity(identityIssue, integrity);
    memberScheduleV2WorkspaceCache = {
      key: cacheKey,
      loadedAt: Date.now(),
      workspace,
      releasedMakeupSlots: Array.isArray(releasedMakeupSlots) ? releasedMakeupSlots : [],
      oneDaySlots: Array.isArray(oneDaySlots) ? oneDaySlots : [],
      integrity,
    };
    state.scheduleV2Integrity = integrity || null;
    const applied = applyScheduleV2MemberWorkspace(
      workspace,
      memberScheduleV2WorkspaceCache.releasedMakeupSlots,
      memberScheduleV2WorkspaceCache.oneDaySlots,
    );
    if (applied) state.scheduleV2LoadedKey = cacheKey;
    return applied;
  } catch (error) {
    const text = `${error?.payload?.message || ""} ${error?.message || ""}`;
    if (!/tn_schedule_v2_member_workspace|PGRST202|42883|schema cache/i.test(text)) {
      console.warn("Tennis Note Schedule V2 member feed failed; using the compatible feed.", error);
    }
    return false;
  }
}

async function syncMemberLessonsFromServer(profile = null, options = {}) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.rpc || !client.getSession?.()?.access_token || !profileId) return false;
  const requestId = options.requestId || ++memberScheduleV2RequestSequence;
  if (await syncMemberScheduleV2(profile, { ...options, requestId })) return true;
  if (requestId !== memberScheduleV2RequestSequence) return false;
  if (state.scheduleV2SyncErrorCode && state.scheduleV2SyncErrorCode !== "member_schedule_load_failed") {
    state.liveLessonsLoaded = true;
    renderMemberRuntimeDiagnostics();
    return false;
  }
  if (!state.scheduleV2WorkspaceLoaded) {
    state.liveLessons = [];
    state.liveMakeupEntitlements = [];
    state.liveReleasedMakeupSlots = [];
  }
  state.liveLessonsLoaded = true;
  state.scheduleV2SyncError = "시간표를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
  state.scheduleV2SyncErrorCode = "member_schedule_load_failed";
  renderMemberRuntimeDiagnostics();
  return false;
}

async function syncLegacyMemberLessonsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !profileId) return false;
  try {
    if (await syncMemberScheduleV2(profile)) return true;
    const participants = await client.selectRows("tn_lesson_participants", {
      select: "lesson_id,ticket_id,user_id",
      filters: { user_id: profileId },
      limit: 100,
    });
    const ownLessonIds = new Set((participants || []).map((item) => item.lesson_id));
    const [scheduleRows, coachRoles, makeupEntitlementRows, releasedMakeupSlots, oneDaySlots] = await Promise.all([
      client.selectRows("tn_lessons", {
        select: "id,member_ticket_id,coach_role_id,lesson_date,start_time,duration_minutes,status,lesson_source",
        limit: 1000,
      }),
      client.selectRows("tn_coach_roles", {
        select: "id,display_name,color,status",
        filters: { status: "approved" },
        limit: 50,
      }).catch(() => []),
      client.selectRows("tn_makeup_entitlements", {
        select: "id,source_lesson_id,ticket_id,coach_role_id,duration_minutes,status,reason,marked_at,booked_lesson_id,booked_at",
        limit: 100,
      }).catch(() => []),
      client.rpc
        ? client.rpc("tn_member_released_makeup_slots", {}).catch(() => [])
        : Promise.resolve([]),
      client.rpc
        ? client.rpc("tn_member_one_day_schedule_slots", {}).catch(() => [])
        : Promise.resolve([]),
    ]);
    const loadedLessonIds = new Set((scheduleRows || []).map((lesson) => lesson.id));
    const missingOwnLessonIds = [...ownLessonIds].filter((lessonId) => !loadedLessonIds.has(lessonId));
    const missingOwnLessonRows = missingOwnLessonIds.length
      ? await Promise.all(missingOwnLessonIds.map((lessonId) =>
        client.selectRows("tn_lessons", {
          select: "id,member_ticket_id,coach_role_id,lesson_date,start_time,duration_minutes,status,lesson_source",
          filters: { id: lessonId },
          limit: 1,
        }).catch(() => [])))
      : [];
    const rows = [...(scheduleRows || []), ...missingOwnLessonRows.flat()]
      .filter((lesson, index, items) => items.findIndex((candidate) => candidate.id === lesson.id) === index);
    const coachNames = new Map((coachRoles || []).map((coach) => [coach.id, coach.display_name]));
    const lessonsById = new Map((rows || []).map((lesson) => [lesson.id, lesson]));
    const memberName = currentMemberName();
    state.liveMakeupEntitlements = (makeupEntitlementRows || [])
      .filter((entitlement) => ownLessonIds.has(entitlement.source_lesson_id))
      .map((entitlement) => {
        const sourceLesson = lessonsById.get(entitlement.source_lesson_id) || {};
        const lessonDate = sourceLesson.lesson_date || "";
        const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
        return {
          id: entitlement.id,
          sourceLessonId: entitlement.source_lesson_id,
          ticketId: entitlement.ticket_id,
          coachRoleId: entitlement.coach_role_id,
          coach: coachNames.get(entitlement.coach_role_id) || "담당 코치",
          lessonDate,
          day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
          time: String(sourceLesson.start_time || "").slice(0, 5),
          durationMinutes: Number(entitlement.duration_minutes) || Number(sourceLesson.duration_minutes) || 20,
          status: entitlement.status,
          reason: entitlement.reason || "회원 불참",
          markedAt: entitlement.marked_at || "",
          bookedLessonId: entitlement.booked_lesson_id || "",
          bookedAt: entitlement.booked_at || "",
        };
      });
    state.liveReleasedMakeupSlots = (releasedMakeupSlots || []).map((slot) => ({
      id: slot.slot_id,
      coachRoleId: slot.coach_role_id,
      lessonDate: slot.lesson_date,
      time: String(slot.start_time || "").slice(0, 5),
      durationMinutes: Number(slot.duration_minutes) || 20,
    }));
    const mappedLessons = (rows || [])
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const isOwnLesson = ownLessonIds.has(lesson.id);
        const ticket = (state.liveTickets || []).find((item) => item.id === lesson.member_ticket_id) || {};
        const lessonSource = lesson.lesson_source === "makeup"
          ? "보강"
          : lesson.lesson_source === "coupon"
            ? "쿠폰"
            : lesson.lesson_source === "coach_change"
              ? "코치변경"
              : "정규";
        const visibleStatus = isOwnLesson
          ? lesson.status === "pending_change" ? "requested" : lesson.status
          : "occupied";
        return {
          ...lesson,
          serverStatus: lesson.status,
          serverLessonId: lesson.id,
          lessonDate: lesson.lesson_date,
          day: days[new Date(`${lesson.lesson_date}T00:00:00`).getDay() === 0 ? 6 : new Date(`${lesson.lesson_date}T00:00:00`).getDay() - 1],
          time: String(lesson.start_time || "").slice(0, 5),
          coach: coachNames.get(lesson.coach_role_id) || "담당 코치",
          originalCoachRoleId: lesson.original_coach_role_id || "",
          member: isOwnLesson ? memberName : "",
          type: `${lessonSource} ${lesson.duration_minutes}분`,
          lessonSource: lesson.lesson_source || "regular",
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketTotalSessions: Number(ticket.total) || 0,
          ticketUsedSessions: Number(ticket.used) || 0,
          ticketRemainingSessions: Number(ticket.remaining) || 0,
          ticketLessonMinutes: Number(ticket.lessonMinutes) || Number(lesson.duration_minutes) || 20,
          status: visibleStatus,
          isOwnLesson,
        };
      });
    const oneDayOccupancy = (oneDaySlots || []).map((slot) => {
      const lessonDate = slot.booking_date || "";
      const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
      return {
        id: `one-day-${slot.id}`,
        oneDayBooking: true,
        serverOneDayBookingId: slot.id,
        lessonDate,
        day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
        time: String(slot.start_time || "").slice(0, 5),
        coach: coachNames.get(slot.coach_role_id) || "담당 코치",
        coach_role_id: slot.coach_role_id,
        member: "",
        type: "원데이 예약",
        lessonSource: "one_day",
        durationMinutes: Number(slot.duration_minutes) || 20,
        status: "occupied",
        isOwnLesson: false,
      };
    });
    state.liveLessons = [...mappedLessons, ...oneDayOccupancy];
    state.liveLessonsLoaded = true;
    return true;
  } catch {
    state.liveLessons = [];
    state.liveMakeupEntitlements = [];
    state.liveReleasedMakeupSlots = [];
    state.liveLessonsLoaded = state.dataMode === "live";
    return false;
  }
}

async function syncMemberChangeRequestsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !profileId) return false;
  try {
    let rows;
    try {
      rows = await client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,policy_snapshot,policy_revision,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_at,created_at",
        filters: { requester_user_id: profileId },
        limit: 100,
      });
    } catch {
      rows = await client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,decided_at,created_at",
        filters: { requester_user_id: profileId },
        limit: 100,
      });
    }
    const statusLabel = {
      pending: "변경 확인 중",
      approved: "변경 완료",
      rejected: "변경되지 않았습니다",
      auto_approved: "변경 완료",
      cancelled: "변경 요청 취소",
    };
    state.makeupRequests = (rows || [])
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
      .map((row) => {
        const sourceLesson = state.liveLessons.find((lesson) => lesson.serverLessonId === row.lesson_id) || {};
        const originalDate = row.original_lesson_date || sourceLesson.lessonDate || "";
        const originalTime = String(row.original_start_time || sourceLesson.time || "").slice(0, 5);
        const targetDate = row.requested_lesson_date || "";
        const targetTime = String(row.requested_start_time || "").slice(0, 5);
        const policySnapshot = row.policy_snapshot && typeof row.policy_snapshot === "object" ? row.policy_snapshot : null;
        return {
          id: row.id,
          serverRequestId: row.id,
          lessonId: row.lesson_id,
          originalDate,
          originalTime,
          targetDate,
          targetTime,
          absence: `${compactLessonDateLabel(originalDate)} ${originalTime}`.trim(),
          makeup: `${compactLessonDateLabel(targetDate)} ${targetTime}`.trim(),
          reason: row.reason === "정책상 사유 없음" ? "사유 없음" : row.reason || "이유 미입력",
          policy: policyDetail(
            policySnapshot?.outcome === "auto" || row.policy_window === "auto_before_24h" ? "auto" : "coach",
            policySnapshot,
          ),
          policySnapshot,
          status: statusLabel[row.status] || row.status,
          rawStatus: row.status,
          editable: row.status === "pending",
          cancelable: ["pending", "approved", "auto_approved"].includes(row.status),
          cancelKind: "change",
          createdAt: row.created_at || "",
          source: "server",
        };
      });
    return true;
  } catch {
    return false;
  }
}

async function syncMemberGroupAccountFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const ownRows = await client.selectRows("tn_group_account_members", {
      select: "id,group_account_id,user_id,display_name,participant_order,app_status,can_manage_schedule,can_pay",
      filters: { user_id: profileId },
      limit: 20,
    });
    const activeGroupAccountId = currentLiveTickets().find((ticket) => ticket.groupAccountId)?.groupAccountId || "";
    const ownMembership = (ownRows || []).find((row) => row.group_account_id === activeGroupAccountId) || ownRows?.[0];
    if (!ownMembership?.group_account_id) {
      state.groupAccount = null;
      return true;
    }
    const [accountRows, memberRows] = await Promise.all([
      client.selectRows("tn_group_accounts", {
        select: "id,coach_role_id,display_name,status,payment_mode,next_payer_user_id,schedule_sync_required",
        filters: { id: ownMembership.group_account_id },
        limit: 1,
      }),
      client.selectRows("tn_group_account_members", {
        select: "id,group_account_id,user_id,display_name,participant_order,app_status,can_manage_schedule,can_pay",
        filters: { group_account_id: ownMembership.group_account_id },
        limit: 2,
      }),
    ]);
    const account = accountRows?.[0];
    if (!account) {
      state.groupAccount = null;
      return true;
    }
    let coachName = "담당 코치";
    if (account.coach_role_id) {
      const coachRows = await client.selectRows("tn_coach_roles", {
        select: "id,display_name",
        filters: { id: account.coach_role_id },
        limit: 1,
      }).catch(() => []);
      coachName = coachRows?.[0]?.display_name || coachName;
    }
    const members = [...(memberRows || [])]
      .sort((a, b) => Number(a.participant_order) - Number(b.participant_order))
      .map((member, index) => ({
        userId: member.user_id,
        name: member.display_name || `회원 ${index + 1}`,
        appStatus: member.app_status || "not_joined",
        canManageSchedule: member.can_manage_schedule === true,
        canPay: member.can_pay === true,
      }));
    state.groupAccount = {
      id: account.id,
      demoOnly: false,
      name: account.display_name || members.map((member) => member.name).join(" · "),
      schedule: "공동 시간표",
      coach: coachName,
      paymentMode: account.payment_mode || "representative",
      nextPayerUserId: account.next_payer_user_id || "",
      nextPayer: members.find((member) => member.userId === account.next_payer_user_id)?.name || members[0]?.name || "대표회원",
      scheduleSyncRequired: account.schedule_sync_required !== false,
      members,
    };
    return true;
  } catch {
    state.groupAccount = null;
    return false;
  }
}

async function syncMemberHoldingRequestsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_holding_requests", {
      select: "id,ticket_id,request_type,requested_start_on,requested_end_on,reason_summary,evidence_object_path,evidence_status,status,reviewed_at,created_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    const shared = loadSharedData();
    const otherMembers = (shared.holdingRequests || []).filter((request) => request.member !== (state.member?.name || state.profile.name));
    const ownRequests = (rows || []).map((row) => ({
      id: row.id,
      member: state.member?.name || state.profile.name,
      ticketId: row.ticket_id,
      ticketTitle: state.profile.ticket || "회원권",
      type: row.request_type,
      typeLabel: row.request_type === "injury" ? "부상·입원" : "개인 사유",
      startDate: row.requested_start_on,
      endDate: row.requested_end_on,
      days: holdingRequestDays(row.requested_start_on, row.requested_end_on),
      reason: row.reason_summary || "",
      evidencePath: row.evidence_object_path || "",
      evidenceLabel: row.request_type === "injury" ? "증빙 첨부" : "증빙 없음",
      status: row.status || "pending",
      source: "server",
      reviewedAt: row.reviewed_at || "",
      createdAt: row.created_at || "",
    }));
    shared.holdingRequests = [...ownRequests, ...otherMembers];
    saveSharedData(shared);
    return true;
  } catch {
    return false;
  }
}

async function syncMemberAccountDeletionRequestFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_account_deletion_requests", {
      select: "*",
      filters: { user_id: profileId },
      limit: 20,
    });
    state.accountDeletionRequest = (rows || [])
      .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))[0] || null;
    renderAccountDeletionSettings();
    return true;
  } catch {
    state.accountDeletionRequest = null;
    renderAccountDeletionSettings();
    return false;
  }
}

async function syncMemberHoldingPolicyFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: holdingPolicyKey },
      limit: 1,
    });
    if (rows?.[0]?.value) state.holdingPolicySettings = { ...state.holdingPolicySettings, ...rows[0].value };
    return true;
  } catch {
    return false;
  }
}

async function syncLiveMembershipProductsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_membership_products", {
      select: "id,branch_id,product_code,name,lesson_minutes,machine_minutes,frequency_per_week,total_sessions,group_size,schedule_scope,term_weeks,card_price,cash_price,settlement_base_price,validity_days,grace_days,product_kind,discount_enabled,coach_discount_allowed,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,makeup_anchor_minutes,is_active,policy_settings,display_order",
      filters: { is_active: true },
      limit: 500,
    });
    const products = (rows || [])
      .filter((row) => numericValue(row.card_price) > 0)
      .sort((left, right) => numericValue(left.display_order, 999) - numericValue(right.display_order, 999))
      .map(membershipProductFromServer);
    state.liveMembershipProducts = products;
    await syncMembershipPricingQuotesFromServer(products);
    return products.length > 0;
  } catch {
    if (state.dataMode === "live") {
      state.liveMembershipProducts = [];
      state.membershipPricingQuotes = {};
    }
    return false;
  }
}

async function syncMemberTicketsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;

  state.ticketSyncStatus = { tone: "wait", text: "서버 회원권 확인 중" };
  try {
    let rows;
    try {
      rows = await client.selectRows("tn_member_tickets", {
        select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,refund_hold_refund_id,refund_hold_at,created_at,tn_membership_products(product_code,name,lesson_minutes,product_kind,total_sessions,frequency_per_week,group_size,schedule_scope,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,makeup_anchor_minutes,validity_days,grace_days)",
        filters: { user_id: profileId },
        limit: 20,
      });
    } catch {
      rows = await client.selectRows("tn_member_tickets", {
        select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at",
        filters: { user_id: profileId },
        limit: 20,
      });
    }

    const sharedLinks = await client.selectRows("tn_group_ticket_links", {
      select: "group_account_id,ticket_id,status",
      filters: { user_id: profileId },
      limit: 20,
    }).catch(() => []);
    const activeSharedLinks = (sharedLinks || [])
      .filter((link) => !["pending_payment", "expired", "refunded"].includes(String(link.status || "").toLowerCase()));
    const sharedTicketIds = new Set(activeSharedLinks
      .map((link) => link.ticket_id)
      .filter(Boolean));
    const sharedAccountIdByTicketId = new Map(activeSharedLinks
      .filter((link) => link.ticket_id && link.group_account_id)
      .map((link) => [link.ticket_id, link.group_account_id]));
    const ownedTicketIds = new Set((rows || []).map((row) => row.id));
    const sharedTicketRows = await Promise.all(activeSharedLinks
      .filter((link) => link.ticket_id && !ownedTicketIds.has(link.ticket_id))
      .map(async (link) => {
        try {
          return await client.selectRows("tn_member_tickets", {
            select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,refund_hold_refund_id,refund_hold_at,created_at,tn_membership_products(product_code,name,lesson_minutes,product_kind,total_sessions,frequency_per_week,group_size,schedule_scope,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,makeup_anchor_minutes,validity_days,grace_days)",
            filters: { id: link.ticket_id },
            limit: 1,
          });
        } catch {
          return client.selectRows("tn_member_tickets", {
            select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at",
            filters: { id: link.ticket_id },
            limit: 1,
          }).catch(() => []);
        }
      }));
    rows = [...(rows || []), ...sharedTicketRows.flat()]
      .filter((row) => String(row.status || "").toLowerCase() !== "pending_payment")
      .map((row) => ({
        ...row,
        shared_group_ticket: sharedTicketIds.has(row.id),
        shared_group_account_id: sharedAccountIdByTicketId.get(row.id) || "",
      }));

    rows = await attachLiveTicketProducts(client, rows || []);
    rows = await attachLiveTicketPayments(client, rows || []);
    state.liveTickets = Array.isArray(rows) ? rows.map(normalizeLiveTicket) : [];
    const paymentRequestsChanged = reconcileVerifiedPaymentRequests();
    const currentTickets = currentLiveTickets();
    const ticket = currentTickets[0] || upcomingLiveTickets()[0] || null;
    if (!ticket) {
      state.remaining = 0;
      state.profile.ticket = "현재 이용권 없음";
      state.ticketSyncStatus = { tone: "wait", text: "현재 이용 가능한 회원권 없음 · 결제 또는 관리자 충전 필요" };
      return true;
    }

    const aggregate = liveTicketAggregate(currentTickets.length ? currentTickets : [ticket]);
    const renewalOverlapCount = currentLiveTicketOverlapCount();
    state.remaining = aggregate.remaining;
    state.profile.ticket = currentTickets.length > 1
      ? `현재 회원권 ${aggregate.count}개 · 총 ${aggregate.total}회`
      : `${ticket.title} · 총 ${ticket.total || 0}회`;
    if (currentTickets.length && state.member) state.member.memberKind = "lesson_member";
    const derivedStatusLabel = window.TennisNoteTicketState?.label?.(ticket) || ticket.statusLabel;
    state.ticketSyncStatus = {
      tone: renewalOverlapCount > 0 ? "alert" : ticket.tone,
      text: renewalOverlapCount > 0
        ? `재등록 회원권 ${renewalOverlapCount}건 연결 확인 중 · 현재 연결권 잔여 ${aggregate.remaining}`
        : currentTickets.length > 1
        ? `회원권 ${aggregate.count}개 적용 · 총 ${aggregate.total} / 소진 ${aggregate.used} / 잔여 ${aggregate.remaining}`
        : `${derivedStatusLabel} · 총 ${ticket.total || 0} / 소진 ${ticket.used || 0} / 잔여 ${ticket.remaining || 0}`,
    };
    const syncKey = currentTickets.length > 1
      ? currentTickets.map((item) => `${item.id}:${item.status}:${item.remaining}:${item.total}`).join("|")
      : `${ticket.id}:${ticket.status}:${ticket.remaining}:${ticket.total}`;
    if (syncKey !== state.lastLiveTicketKey) {
      state.lastLiveTicketKey = syncKey;
      state.ticketHistory.unshift({
        text: currentTickets.length > 1
          ? `회원권 ${aggregate.count}개 · 총 ${aggregate.total} / 소진 ${aggregate.used} / 잔여 ${aggregate.remaining}`
          : `${ticket.title} · ${derivedStatusLabel} · 총 ${ticket.total || 0} / 소진 ${ticket.used || 0} / 잔여 ${ticket.remaining || 0}`,
        tone: ticket.tone,
      });
    }
    if (paymentRequestsChanged) saveSnapshot();
    return true;
  } catch {
    state.liveTickets = [];
    state.remaining = 0;
    state.profile.ticket = "회원권 확인 필요";
    state.ticketSyncStatus = { tone: "alert", text: "서버 회원권 확인 실패 · 다시 로그인하거나 관리자에게 문의해주세요" };
    return false;
  }
}

async function refreshMemberLiveSchedule(options = {}) {
  const client = window.TennisNoteDataClient;
  const force = options.force === true;
  if (memberLiveScheduleRefreshInFlight) {
    if (force) memberLiveScheduleRefreshQueued = true;
    return false;
  }
  if (
    document.hidden
    || state.dataMode !== "live"
    || !state.member?.profileId
    || !client?.readiness?.().ready
    || !client?.getSession?.()?.access_token
    || (!force && Date.now() - memberLiveScheduleLastRefreshAt < MEMBER_LIVE_REFRESH_STALE_MS)
  ) return false;

  memberLiveScheduleRefreshInFlight = true;
  try {
    await syncMemberTicketsFromServer();
    const [lessonsSynced, requestsSynced, notificationResult] = await Promise.all([
      syncMemberLessonsFromServer(null, { force }),
      syncMemberChangeRequestsFromServer(),
      syncMemberNotificationsFromServer(),
      syncMemberPaymentOptionsFromServer(),
      syncMemberDiscountCouponsFromServer(),
    ]);
    if (options.render !== false) renderActiveMemberView();
    if (notificationResult?.newNotification) {
      showToast(`${notificationResult.newNotification.title} · 시간표에서 확인해 주세요.`);
    }
    memberLiveScheduleLastRefreshAt = Date.now();
    return Boolean(lessonsSynced || requestsSynced || notificationResult?.ok);
  } finally {
    memberLiveScheduleRefreshInFlight = false;
    if (memberLiveScheduleRefreshQueued) {
      memberLiveScheduleRefreshQueued = false;
      queueMicrotask(() => {
        void refreshMemberLiveSchedule({ force: true, render: options.render !== false });
      });
    }
  }
}
