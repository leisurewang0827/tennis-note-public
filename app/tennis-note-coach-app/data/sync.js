// 서버에서 코치 데이터를 불러와 화면 상태에 채우는 함수들.
//
// 서버(Supabase)에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function syncCoachScheduleV2(options = {}) {
  const client = window.TennisNoteDataClient;
  const requestId = ++coachScheduleV2RequestSequence;
  const branchId = state.coach?.branchId || "";
  if (!client?.rpc || !client.getSession?.()?.access_token || !branchId) return false;
  const week = activeScheduleWeek();
  const syncRange = coachScheduleV2SyncRange(week);
  const cacheKey = `${branchId}:${syncRange.startDate}:${syncRange.endDate}`;
  const cached = coachScheduleV2WorkspaceCache;
  if (!options.force && cached?.key === cacheKey && Date.now() - cached.loadedAt < 10_000) {
    return applyScheduleV2CoachWorkspace(cached.workspace, cached.oneDayRows, cached.roster, cached.legacyChangeRequests);
  }
  try {
    const [workspace, oneDayRows, roster, operationDays, legacyChangeRequests] = await Promise.all([
      client.rpc("tn_schedule_v2_coach_workspace", {
        target_branch_id: branchId,
        target_from: syncRange.startDate,
        target_to: syncRange.endDate,
      }),
      client.rpc("tn_visible_one_day_bookings", {}).catch(() => []),
      client.rpc("tn_schedule_v2_coach_member_roster", {
        target_branch_id: branchId,
      }).catch(() => null),
      client.rpc("tn_schedule_v2_operation_days_between", {
        target_branch_id: branchId,
        target_from: week.startDate,
        target_to: week.endDate,
      }).catch(() => []),
      client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,policy_snapshot,policy_revision,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_at,created_at,updated_at",
        filters: { status: "pending" },
        order: "created_at.desc",
        limit: 300,
      }).catch(() => client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_at,created_at",
        filters: { status: "pending" },
        order: "created_at.desc",
        limit: 300,
      }).catch(() => [])),
    ]);
    if (requestId !== coachScheduleV2RequestSequence) return false;
    if (!workspace?.branchId || !Array.isArray(workspace.lessons)) return false;
    workspace.operationDays = Array.isArray(operationDays) ? operationDays : [];
    coachScheduleV2WorkspaceCache = {
      key: cacheKey,
      loadedAt: Date.now(),
      workspace,
      oneDayRows: Array.isArray(oneDayRows) ? oneDayRows : [],
      roster,
      legacyChangeRequests: Array.isArray(legacyChangeRequests) ? legacyChangeRequests : [],
    };
    return applyScheduleV2CoachWorkspace(
      workspace,
      coachScheduleV2WorkspaceCache.oneDayRows,
      roster,
      coachScheduleV2WorkspaceCache.legacyChangeRequests,
    );
  } catch (error) {
    const text = `${error?.payload?.message || ""} ${error?.message || ""}`;
    if (!/tn_schedule_v2_coach_workspace|PGRST202|42883|schema cache/i.test(text)) {
      console.warn("Tennis Note Schedule V2 coach feed failed; using the compatible feed.", error);
    }
    return false;
  }
}

async function syncLegacyCoachSchedulePreview() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) return false;
  if (await syncCoachScheduleV2()) return true;
  const selectedWeek = activeScheduleWeek();
  const payload = await client.rpc("tn_coach_schedule_feed", {
    target_start_date: selectedWeek.startDate,
    target_end_date: selectedWeek.endDate,
  });
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.lessons)
      ? payload.lessons
      : [];
  if (!rows.length) return false;
  const oneDayLessons = state.liveLessons.filter((lesson) => lesson.oneDayBooking);
  state.liveLessons = [
    ...rows
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const dayIndex = new Date(`${lesson.lesson_date}T00:00:00`).getDay();
        const participantIds = Array.isArray(lesson.participant_user_ids) ? lesson.participant_user_ids : [];
        const memberNames = Array.isArray(lesson.participant_names) ? lesson.participant_names : [];
        const groupSize = Number(lesson.product_group_size) || participantIds.length || 1;
        return {
          id: lesson.id,
          serverLessonId: lesson.id,
          lessonDate: lesson.lesson_date,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          time: String(lesson.start_time || "").slice(0, 5),
          coach: lesson.coach_name || "담당 코치",
          coachRoleId: lesson.coach_role_id,
          originalCoachRoleId: lesson.original_coach_role_id || "",
          originalCoach: lesson.original_coach_name || "",
          isSubstitute: Boolean(lesson.original_coach_role_id && lesson.original_coach_role_id !== lesson.coach_role_id),
          member: memberNames.join("&") || "회원",
          memberUserIds: participantIds,
          type: `${groupSize > 1 ? "2대1" : "개인"} ${Number(lesson.duration_minutes) || 20}분`,
          lessonSource: lesson.lesson_source || "regular",
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketLessonMinutes: Number(lesson.product_lesson_minutes) || Number(lesson.duration_minutes) || 20,
          ticketId: lesson.member_ticket_id || "",
          totalSessions: Number(lesson.ticket_total_sessions) || 0,
          usedSessions: Number(lesson.ticket_used_sessions) || 0,
          ticket: `${groupSize > 1 ? "2대1" : "개인"} ${lesson.ticket_total_sessions || ""}회`.replace("  회", ""),
          status: serverLessonStatusLabel(lesson.status),
          serverStatus: lesson.status,
          remaining: Number(lesson.ticket_remaining_sessions) || 0,
          task: lesson.status === "pending_change" ? "변경 요청 확인" : "수업 후 코멘트/다음 커리큘럼",
        };
      }),
    ...oneDayLessons,
  ];
  state.liveLessonsLoaded = true;
  return true;
}

async function syncCoachLessonsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc) return false;
  const activeSession = client.ensureSession
    ? await client.ensureSession().catch(() => client.getSession?.())
    : client.getSession?.();
  if (!activeSession?.access_token || !state.coach?.branchId) return false;
  if (await syncCoachScheduleV2({ force: true })) return true;
  // Keep the last confirmed schedule and member cache during a transient read
  // failure. The visible error and retry action explain that it may be stale.
  state.liveLessonsLoaded = true;
  state.liveMembersLoaded = true;
  state.scheduleV2SyncError = "시간표를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
  return false;
}

async function syncLegacyCoachLessonsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows) return false;
  try {
    const activeSession = client.ensureSession
      ? await client.ensureSession().catch(() => client.getSession?.())
      : client.getSession?.();
    if (!activeSession?.access_token) return false;
    const currentProfile = client.selectCurrentProfile
      ? await client.selectCurrentProfile().catch(() => null)
      : null;
    if (state.coach?.branchId && await syncCoachScheduleV2()) return true;
    const scheduleRangeStart = new Date();
    scheduleRangeStart.setDate(scheduleRangeStart.getDate() - 31);
    const scheduleRangeEnd = new Date();
    scheduleRangeEnd.setDate(scheduleRangeEnd.getDate() + 370);
    let scheduleFeedError = null;
    const [scheduleFeedPayload, scheduleRows, participantRows, userRows, coachRows, ticketRows, productRows, recordRows, changeRequestRows, makeupEntitlementRows, oneDayBookingRows] = await Promise.all([
      client.rpc
        ? client.rpc("tn_coach_schedule_feed", {
          target_start_date: localDateKey(scheduleRangeStart),
          target_end_date: localDateKey(scheduleRangeEnd),
        }).catch((error) => {
          scheduleFeedError = error;
          return [];
        })
        : Promise.resolve([]),
      client.selectRows("tn_lessons", {
        select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,day_of_week,start_time,duration_minutes,status,lesson_source",
        limit: 1000,
      }).catch((error) => {
        console.warn("Tennis Note coach full schedule read failed; retrying with the signed-in coach scope.", error);
        return [];
      }),
      client.selectRows("tn_lesson_participants", {
        select: "lesson_id,user_id,ticket_id",
        limit: 2000,
      }).catch(() => []),
      client.selectRows("tn_user_directory_safe", { select: "id,name,phone,birth_year,neighborhood,gender,role,member_kind,status,profile_photo_url,self_ntrp,coach_ntrp,ntrp_requested_at,ntrp_survey,tennis_goal,play_style_memo", limit: 1000 }).catch(() => []),
      client.selectRows("tn_coach_roles", { select: "id,display_name,color,status,employment_status,archived_at,deleted_at", limit: 100 }).catch(() => []),
      client.selectRows("tn_member_tickets", { select: "id,user_id,product_id,coach_role_id,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,status,created_at", limit: 1000 }).catch(() => []),
      client.selectRows("tn_membership_products", { select: "id,name,group_size,lesson_minutes", limit: 200 }).catch(() => []),
      client.selectRows("tn_lesson_records", { select: "lesson_id,deducted_sessions,completed_at", limit: 1000 }).catch(() => []),
      client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,policy_snapshot,policy_revision,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_at,created_at,updated_at",
        limit: 300,
      }).catch(() => []),
      client.selectRows("tn_makeup_entitlements", {
        select: "id,source_lesson_id,ticket_id,branch_id,coach_role_id,duration_minutes,status,reason,marked_at,booked_lesson_id,booked_at",
        limit: 300,
      }).catch(() => []),
      client.rpc
        ? client.rpc("tn_visible_one_day_bookings", {}).catch(() => [])
        : Promise.resolve([]),
    ]);
    let scheduleFeedRows = Array.isArray(scheduleFeedPayload)
      ? scheduleFeedPayload
      : Array.isArray(scheduleFeedPayload?.lessons)
        ? scheduleFeedPayload.lessons
        : [];
    if (!scheduleFeedRows.length && currentProfile?.coachRole?.id && client.rpc) {
      scheduleFeedRows = await client.rpc("tn_coach_schedule_feed", {
        target_start_date: localDateKey(scheduleRangeStart),
        target_end_date: localDateKey(scheduleRangeEnd),
      }).then((payload) => (
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.lessons)
            ? payload.lessons
            : []
      )).catch((error) => {
        scheduleFeedError = error;
        return [];
      });
    }
    if (scheduleFeedError && !scheduleFeedRows.length) {
      console.warn("Tennis Note coach schedule feed failed after profile confirmation.", scheduleFeedError);
    }
    const currentCoachRoleId = currentProfile?.coachRole?.id || "";
    const currentCoachRows = currentCoachRoleId
      ? (await Promise.all([
        client.selectRows("tn_lessons", {
          select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,day_of_week,start_time,duration_minutes,status,lesson_source",
          filters: { coach_role_id: currentCoachRoleId },
          limit: 1000,
        }).catch(() => []),
        client.selectRows("tn_lessons", {
          select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,day_of_week,start_time,duration_minutes,status,lesson_source",
          filters: { original_coach_role_id: currentCoachRoleId },
          limit: 1000,
        }).catch(() => []),
      ])).flat()
      : [];
    const directLessonRows = [...(scheduleRows || []), ...currentCoachRows]
      .filter((lesson, index, items) => items.findIndex((candidate) => candidate.id === lesson.id) === index);
    const lessonRows = Array.isArray(scheduleFeedRows) && scheduleFeedRows.length
      ? scheduleFeedRows
      : directLessonRows;
    const usersById = new Map((userRows || []).map((user) => [
      user.id,
      normalizeCoachScheduleMemberName(user.name, ""),
    ]));
    const coachesById = new Map((coachRows || [])
      .filter((coach) => (
        coach.status === "approved"
        && (coach.employment_status || "active") === "active"
        && !coach.archived_at
        && !coach.deleted_at
      ))
      .map((coach) => [coach.id, coach]));
    if (currentProfile?.coachRole?.id && !coachesById.has(currentProfile.coachRole.id)) {
      coachesById.set(currentProfile.coachRole.id, currentProfile.coachRole);
    }
    const ticketsById = new Map((ticketRows || []).map((ticket) => [ticket.id, ticket]));
    const productsById = new Map((productRows || []).map((product) => [product.id, product]));
    const participantIdsByLesson = new Map();
    (participantRows || []).forEach((participant) => {
      if (!participantIdsByLesson.has(participant.lesson_id)) participantIdsByLesson.set(participant.lesson_id, []);
      participantIdsByLesson.get(participant.lesson_id).push(participant.user_id);
    });
    const recordsByLessonId = new Map((recordRows || []).map((record) => [record.lesson_id, record]));
    const completedLessonIds = new Set(recordsByLessonId.keys());

    const mappedLessons = (lessonRows || [])
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const feedParticipantIds = Array.isArray(lesson.participant_user_ids) ? lesson.participant_user_ids : [];
        const feedParticipantNames = Array.isArray(lesson.participant_names) ? lesson.participant_names : [];
        const participantIds = feedParticipantIds.length ? feedParticipantIds : (participantIdsByLesson.get(lesson.id) || []);
        const memberNames = (feedParticipantNames.length
          ? feedParticipantNames
          : participantIds.map((userId) => usersById.get(userId)).filter(Boolean)
        ).map((name) => normalizeCoachScheduleMemberName(name, "")).filter(Boolean);
        const ticket = ticketsById.get(lesson.member_ticket_id) || {};
        const product = productsById.get(ticket.product_id) || {};
        const coach = coachesById.get(lesson.coach_role_id) || {};
        const originalCoach = coachesById.get(lesson.original_coach_role_id) || {};
        const isSubstitute = Boolean(lesson.original_coach_role_id && lesson.original_coach_role_id !== lesson.coach_role_id);
        const lessonRecord = recordsByLessonId.get(lesson.id);
        const lessonKind = lesson.lesson_source === "makeup"
          ? "보강"
          : lesson.lesson_source === "coupon"
            ? "쿠폰"
            : lesson.lesson_source === "coach_change"
              ? "코치변경"
              : "정규";
        const dayIndex = new Date(`${lesson.lesson_date}T00:00:00`).getDay();
        return {
          id: `server-${lesson.id}`,
          serverLessonId: lesson.id,
          lessonDate: lesson.lesson_date,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          time: String(lesson.start_time || "").slice(0, 5),
          coach: lesson.coach_name || coach.display_name || "담당 코치",
          coachRoleId: lesson.coach_role_id,
          originalCoachRoleId: lesson.original_coach_role_id || "",
          originalCoach: lesson.original_coach_name || originalCoach.display_name || "",
          isSubstitute,
          member: memberNames.join("&") || "회원",
          memberUserIds: participantIds,
          type: `${lessonKind} ${lesson.duration_minutes}분`,
          lessonSource: lesson.lesson_source || "regular",
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketLessonMinutes: Number(lesson.product_lesson_minutes) || Number(product.lesson_minutes) || Number(lesson.duration_minutes) || 20,
          ticketId: lesson.member_ticket_id || "",
          totalSessions: Number(lesson.ticket_total_sessions ?? ticket.total_sessions) || 0,
          usedSessions: Number(lesson.ticket_used_sessions ?? ticket.used_sessions) || 0,
          ticket: `${Number(lesson.product_group_size ?? product.group_size) > 1 || participantIds.length > 1 ? "2대1" : "개인"} ${lesson.ticket_total_sessions ?? ticket.total_sessions ?? ""}회`.replace("  회", ""),
          status: serverLessonStatusLabel(lesson.status),
          serverStatus: lesson.status,
          remaining: Number(lesson.ticket_remaining_sessions ?? ticket.remaining_sessions) || 0,
          deductedSessions: lessonRecord ? Number(lessonRecord.deducted_sessions) || 0 : null,
          completedAt: lessonRecord?.completed_at || "",
          task: lesson.status === "pending_change" ? "변경 요청 확인" : "수업 후 코멘트/다음 커리큘럼",
        };
      });
    const oneDayLessons = (oneDayBookingRows || [])
      .filter((booking) => ["reserved", "checked_in", "completed"].includes(booking.status))
      .map((booking) => {
        const dayIndex = new Date(`${booking.booking_date}T00:00:00`).getDay();
        const coach = coachesById.get(booking.coach_role_id) || {};
        const bookingStatus = booking.status === "completed"
          ? "원데이 완료"
          : booking.status === "checked_in"
            ? "방문"
            : "원데이 예약";
        return {
          id: `one-day-${booking.id}`,
          serverOneDayBookingId: booking.id,
          oneDayBooking: true,
          lessonDate: booking.booking_date,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          time: String(booking.start_time || "").slice(0, 5),
          coach: coach.display_name || "담당 코치",
          coachRoleId: booking.coach_role_id,
          member: booking.guest_name || "원데이",
          memberUserIds: [],
          type: `원데이 ${booking.duration_minutes}분`,
          lessonSource: "one_day",
          durationMinutes: Number(booking.duration_minutes) || 20,
          ticketLessonMinutes: Number(booking.duration_minutes) || 20,
          ticketId: "",
          totalSessions: 0,
          usedSessions: 0,
          ticket: "원데이",
          status: bookingStatus,
          serverStatus: booking.status,
          remaining: 0,
          task: "원데이 예약",
        };
      });
    state.liveLessons = [...mappedLessons, ...oneDayLessons];

    const lessonRowsById = new Map((lessonRows || []).map((lesson) => [lesson.id, lesson]));
    state.makeupEntitlements = (makeupEntitlementRows || []).map((entitlement) => {
      const sourceLesson = lessonRowsById.get(entitlement.source_lesson_id) || {};
      const participantIds = participantIdsByLesson.get(entitlement.source_lesson_id) || [];
      const memberNames = participantIds.map((userId) => usersById.get(userId)).filter(Boolean);
      const coach = coachesById.get(entitlement.coach_role_id) || {};
      const bookedLesson = lessonRowsById.get(entitlement.booked_lesson_id) || {};
      return {
        id: entitlement.id,
        sourceLessonId: entitlement.source_lesson_id,
        bookedLessonId: entitlement.booked_lesson_id || "",
        ticketId: entitlement.ticket_id,
        coachRoleId: entitlement.coach_role_id,
        coach: coach.display_name || "담당 코치",
        member: memberNames.join("&") || "회원",
        durationMinutes: Number(entitlement.duration_minutes) || 20,
        status: entitlement.status,
        reason: entitlement.reason || "회원 사전 불참",
        originalDate: sourceLesson.lesson_date || "",
        originalTime: String(sourceLesson.start_time || "").slice(0, 5),
        original: `${sourceLesson.lesson_date || "기존일"} ${String(sourceLesson.start_time || "").slice(0, 5)}`.trim(),
        bookedDate: bookedLesson.lesson_date || "",
        bookedTime: String(bookedLesson.start_time || "").slice(0, 5),
      };
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    state.releasedMakeupSlots = state.makeupEntitlements
      .flatMap((entitlement) => {
        const sourceLesson = lessonRowsById.get(entitlement.sourceLessonId);
        if (!["open", "booked"].includes(entitlement.status) || sourceLesson?.status !== "cancelled") return [];
        if (!entitlement.originalDate || !entitlement.originalTime) return [];
        const releasedStart = minutesFromTime(entitlement.originalTime);
        const releasedEnd = releasedStart + entitlement.durationMinutes;
        const occupyingLesson = state.liveLessons.find((lesson) => {
          if (lesson.lessonDate !== entitlement.originalDate || lesson.coachRoleId !== entitlement.coachRoleId) return false;
          const lessonStart = minutesFromTime(lesson.time);
          return releasedStart < lessonStart + lessonDuration(lesson) && lessonStart < releasedEnd;
        });
        if (occupyingLesson) {
          occupyingLesson.releasedOriginMember = entitlement.member;
          occupyingLesson.releasedOriginLabel = `${entitlement.member} 정규 불참 자리`;
          return [];
        }
        const dayIndex = new Date(`${entitlement.originalDate}T00:00:00`).getDay();
        const historicalReleasedSlot = entitlement.originalDate < todayIso;
        return [{
          id: `released-${entitlement.id}`,
          releasedMakeupSlot: true,
          historicalReleasedSlot,
          lessonDate: entitlement.originalDate,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          time: entitlement.originalTime,
          coach: entitlement.coach,
          coachRoleId: entitlement.coachRoleId,
          member: entitlement.member,
          releasedOriginalMember: entitlement.member,
          entitlementId: entitlement.id,
          sourceLessonId: entitlement.sourceLessonId,
          type: historicalReleasedSlot
            ? `정규 · 불참 · 차감 없음 ${entitlement.durationMinutes}분`
            : `정규 · 불참 · 보강·원데이 가능 ${entitlement.durationMinutes}분`,
          lessonSource: "makeup",
          durationMinutes: entitlement.durationMinutes,
          status: "available",
          task: "보강 가능",
        }];
      });

    const ticketIdsByUser = new Map();
    (ticketRows || []).forEach((ticket) => {
      if (!ticket.user_id) return;
      const ids = ticketIdsByUser.get(ticket.user_id) || [];
      ids.push(ticket.id);
      ticketIdsByUser.set(ticket.user_id, ids);
    });
    (participantRows || []).forEach((participant) => {
      if (!participant.user_id || !participant.ticket_id) return;
      const ids = ticketIdsByUser.get(participant.user_id) || [];
      if (!ids.includes(participant.ticket_id)) ids.push(participant.ticket_id);
      ticketIdsByUser.set(participant.user_id, ids);
    });

    const latestLessonByUser = new Map();
    [...state.liveLessons]
      .sort((left, right) => `${right.lessonDate || ""} ${right.time || ""}`.localeCompare(`${left.lessonDate || ""} ${left.time || ""}`))
      .forEach((lesson) => {
        (lesson.memberUserIds || []).forEach((userId) => {
          if (!latestLessonByUser.has(userId)) latestLessonByUser.set(userId, lesson);
        });
      });

    const ticketRank = { active: 0, paused: 1, pending_payment: 2, expired: 3, refunded: 4 };
    const memberRows = (userRows || [])
      .filter((user) => ticketIdsByUser.has(user.id))
      .map((user) => {
        const userTickets = (ticketIdsByUser.get(user.id) || [])
          .map((ticketId) => ticketsById.get(ticketId))
          .filter(Boolean)
          .sort((left, right) => {
            const rank = (ticketRank[left.status] ?? 9) - (ticketRank[right.status] ?? 9);
            return rank || String(right.created_at || "").localeCompare(String(left.created_at || ""));
          });
        const ticketGroups = window.TennisNoteTicketState?.split
          ? window.TennisNoteTicketState.split(userTickets)
          : { current: userTickets.filter((item) => ["active", "paused"].includes(item.status)), upcoming: [] };
        const ticket = ticketGroups.current[0] || ticketGroups.upcoming[0] || userTickets[0] || {};
        const product = productsById.get(ticket.product_id) || {};
        const coach = coachesById.get(ticket.coach_role_id) || {};
        const latestLesson = latestLessonByUser.get(user.id);
        const isActive = ticketGroups.current.length > 0;
        return {
          id: user.id,
          serverUserId: user.id,
          name: user.name || "이름 확인 필요",
          photoUrl: user.profile_photo_url || "",
          coach: coach.display_name || "담당 코치 미지정",
          ticket: product.name || `${ticket.total_sessions || 0}회 회원권`,
          total: Number(ticket.total_sessions) || 0,
          used: Number(ticket.used_sessions) || 0,
          remaining: Number(ticket.remaining_sessions) || 0,
          status: isActive ? "수강중" : "회원권 마감",
          lastLesson: latestLesson ? `${latestLesson.day} ${latestLesson.time}` : "최근 수업 없음",
          expiredAt: ticket.expires_on || "",
          phone: user.phone || "",
          birthYear: user.birth_year || "",
          neighborhood: user.neighborhood || "",
          gender: user.gender || "",
          selfNtrp: user.self_ntrp ? String(user.self_ntrp) : "-",
          coachNtrp: user.coach_ntrp ? String(user.coach_ntrp) : "측정 전",
          ntrpRequest: user.ntrp_requested_at ? (user.coach_ntrp ? "완료" : "요청") : "미요청",
          ntrpSurvey: user.ntrp_survey || {},
          ntrpGoal: user.tennis_goal || "",
          ntrpMemo: user.play_style_memo || "",
        };
      });
    state.members = memberRows.filter((member) => member.status === "수강중");
    state.expiredMembers = memberRows.filter((member) => member.status !== "수강중");
    state.liveMembersLoaded = true;
    state.liveLessonsLoaded = true;

    const requestStatusLabel = {
      pending: "승인 대기",
      approved: "승인 완료",
      rejected: "거절",
      auto_approved: "자동 변경 완료",
      cancelled: "회원 취소",
    };
    state.makeupRequests = (changeRequestRows || [])
      .filter((request) => request.status === "pending")
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
      .map((request) => {
        const lesson = state.liveLessons.find((item) => item.serverLessonId === request.lesson_id) || {};
        if (!lessonAssignedToCurrentCoachForTasks(lesson)) return null;
        const originalDate = request.original_lesson_date || lesson.lessonDate || "";
        const originalTime = String(request.original_start_time || lesson.time || "").slice(0, 5);
        return {
          id: request.id,
          serverRequestId: request.id,
          member: usersById.get(request.requester_user_id) || lesson.member || "회원",
          original: `${originalDate} ${originalTime}`.trim() || "기존 수업",
          requested: `${request.requested_lesson_date || ""} ${String(request.requested_start_time || "").slice(0, 5)}`.trim(),
          reason: request.reason === "정책상 사유 없음" ? "사유 없음" : request.reason || "이유 미입력",
          policy: lessonChangePolicyText(request),
          policySnapshot: lessonChangePolicySnapshot(request),
          requestedAt: lessonChangeRequestedAtText(request.created_at),
          remainingTime: lessonChangeRemainingText(originalDate, originalTime),
          status: requestStatusLabel[request.status] || request.status,
          coach: lesson.coach || "담당 코치",
          coachRoleId: lesson.coachRoleId || "",
          source: "server",
          canReview: true,
        };
      })
      .filter(Boolean);

    const today = localDateKey();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoff = localDateKey(cutoffDate);
    state.liveLessons
      .filter((lesson) => lesson.serverStatus === "scheduled" && lesson.lessonDate >= cutoff && lesson.lessonDate <= today && !completedLessonIds.has(lesson.serverLessonId))
      .forEach((lesson) => {
        if (state.lessonLogs.some((log) => log.serverLessonId === lesson.serverLessonId)) return;
        state.lessonLogs.unshift({
          id: `server-lesson-${lesson.serverLessonId}`,
          serverJournalId: "",
          serverLessonId: lesson.serverLessonId,
          member: lesson.member,
          lesson: `${lesson.day} ${lesson.time} · ${lesson.type}`,
          content: "회원 운동일지 미작성 · 코치 기록으로 수업 완료 가능",
          selfMemo: "회원 일지와 관계없이 코치 코멘트와 다음 커리큘럼을 등록하면 횟수가 차감됩니다.",
          mediaNames: [],
          mediaItems: [],
          curriculumId: "FH-01",
          nextCurriculumId: "FH-01",
          coachComment: "",
          validationMessage: "",
          status: "확인 대기",
          curriculumRegistered: false,
        });
      });
    return true;
  } catch (error) {
    console.warn("Tennis Note coach lesson sync failed", error);
    // Keep the last confirmed schedule visible during transient network or permission failures.
    return false;
  }
}

async function syncCoachJournalEntriesFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const [journalRows, recordRows, userRows, mediaRows] = await Promise.all([
      client.selectRows("tn_journal_entries", {
        select: "id,user_id,lesson_id,entry_date,entry_type,body,created_at,updated_at",
        limit: 100,
      }),
      client.selectRows("tn_lesson_records", {
        select: "lesson_id,coach_comment,deducted_sessions,completed_at",
        limit: 100,
      }).catch(() => []),
      client.selectRows("tn_users", {
        select: "id,name",
        limit: 100,
      }).catch(() => []),
      client.selectRows("tn_media_files", {
        select: "id,owner_user_id,journal_entry_id,storage_path,media_type,created_at",
        limit: 300,
      }).catch(() => []),
    ]);
    const recordsByLesson = new Map((recordRows || []).map((record) => [record.lesson_id, record]));
    const namesByUser = new Map((userRows || []).map((user) => [user.id, user.name]));
    for (const row of (journalRows || []).sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))) {
      const payload = parseServerJournalBody(row.body);
      if (!payload) continue;
      const record = recordsByLesson.get(row.lesson_id);
      const mediaForJournal = (mediaRows || [])
        .filter((media) => media.journal_entry_id === row.id)
        .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
      const mediaItems = (await Promise.all(mediaForJournal.map((media, index) => (
        downloadCoachJournalMedia(client, media, payload.mediaNames?.[index] || `첨부 ${index + 1}`).catch(() => null)
      )))).filter(Boolean);
      const serverLog = {
        id: payload.clientLogId || `server-journal-${row.id}`,
        serverJournalId: row.id,
        serverLessonId: row.lesson_id || "",
        member: namesByUser.get(row.user_id) || "회원",
        lesson: payload.lessonLabel || `${row.entry_date} 서버 수업기록`,
        content: payload.content || "수업 내용 미입력",
        selfMemo: payload.selfMemo || "자기 운동 일지 미입력",
        mediaNames: payload.mediaNames || [],
        mediaItems,
        curriculumId: payload.curriculumId || "FH-01",
        nextCurriculumId: payload.nextCurriculumId || payload.curriculumId || "FH-01",
        coachComment: record?.coach_comment || "",
        validationMessage: "",
        status: record ? "확인 완료" : "확인 대기",
        curriculumRegistered: Boolean(record),
        completedAt: record?.completed_at || "",
      };
      const existingIndex = state.lessonLogs.findIndex((log) => log.serverJournalId === row.id || log.id === serverLog.id || (row.lesson_id && log.serverLessonId === row.lesson_id));
      if (existingIndex >= 0) state.lessonLogs[existingIndex] = { ...state.lessonLogs[existingIndex], ...serverLog };
      else state.lessonLogs.unshift(serverLog);
    }
    return true;
  } catch {
    return false;
  }
}

async function liveCurriculumRefId(step = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows) return null;
  try {
    if (client.rpc && client.getSession?.()?.access_token) {
      const ensuredId = await client.rpc("tn_ensure_curriculum_ref", {
        target_code: step.id,
        target_level: `${step.trackTitle || step.category || "커리큘럼"} · ${step.stageLabel || step.level || "단계"}`,
        target_title: step.title,
        target_notion_url: curriculumNotionUrl(step),
      });
      if (ensuredId) return ensuredId;
    }
    const rows = await client.selectRows("tn_curriculum_refs", {
      select: "id,title,skill_label,status",
      filters: { status: "active" },
      limit: 100,
    });
    const matched = (rows || []).find((row) => row.skill_label === step.id || row.title === step.title);
    return matched?.id || null;
  } catch {
    return null;
  }
}

async function syncCoachSettlementFromServer() {
  const client = window.TennisNoteDataClient;
  if (!state.coach?.coachRoleId || !client?.rpc || !client.getSession?.()?.access_token) return false;
  state.coachSettlementLoading = true;
  state.coachSettlementError = "";
  renderCoachSettlement();
  try {
    const result = await client.rpc("tn_coach_own_settlement", {
      target_month: `${coachSettlementMonth()}-01`,
    });
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("coach_settlement_payload_invalid");
    state.coachSettlement = result;
    return true;
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    state.coachSettlementError = raw.includes("tn_coach_own_settlement") || raw.includes("PGRST202")
      ? "코치 정산 기능을 업데이트하는 중입니다. 잠시 후 다시 확인해 주세요."
      : "정산 자료를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.";
    return false;
  } finally {
    state.coachSettlementLoading = false;
    renderCoachSettlement();
    saveSnapshot();
  }
}

async function syncCoachMemberChart(userId = "", memberName = "", force = false) {
  const normalizedId = String(userId || "");
  if (!normalizedId) return false;
  const cached = coachMemberChartCache.get(normalizedId);
  if (!force && cached?.status === "ready" && Date.now() - Number(cached.loadedAt || 0) < 60_000) return true;
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) return false;
  coachMemberChartCache.set(normalizedId, { ...(cached || {}), status: "loading", error: "" });
  refreshCoachMemberChartBodies(normalizedId);
  try {
    const response = await client.rpc("tn_member_lesson_chart", {
      target_user_id: normalizedId,
      target_limit: 30,
    });
    coachMemberChartCache.set(normalizedId, {
      status: "ready",
      items: Array.isArray(response) ? response : [],
      loadedAt: Date.now(),
      memberName,
    });
    refreshCoachMemberChartBodies(normalizedId);
    return true;
  } catch (error) {
    coachMemberChartCache.set(normalizedId, {
      ...(cached || {}),
      status: "error",
      error: String(error?.payload?.message || error?.message || "member_chart_failed"),
      memberName,
    });
    refreshCoachMemberChartBodies(normalizedId);
    return false;
  }
}

async function refreshCoachLiveSchedule(options = {}) {
  const client = window.TennisNoteDataClient;
  const force = options.force === true;
  if (
    coachLiveScheduleRefreshInFlight
    || document.hidden
    || state.dataMode !== "live"
    || !state.coach
    || !client?.getSession?.()?.access_token
    || (!force && Date.now() - coachLiveScheduleLastRefreshAt < COACH_LIVE_REFRESH_STALE_MS)
  ) return false;

  coachLiveScheduleRefreshInFlight = true;
  try {
    const synced = await syncCoachLessonsFromServer();
    if (synced) coachLiveScheduleLastRefreshAt = Date.now();
    if (synced && options.render !== false) renderAll();
    return synced;
  } finally {
    coachLiveScheduleRefreshInFlight = false;
  }
}
