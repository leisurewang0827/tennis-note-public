// 운동노트를 서버와 주고받는 함수들.
//
// 서버(Supabase)에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function syncMemberJournalEntriesFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !client.downloadObject || !profileId) return false;
  try {
    const [journalRows, mediaRows, recordRows, curriculumRows, lessonChartRows] = await Promise.all([
      client.selectRows("tn_journal_entries", {
        select: "id,user_id,lesson_id,entry_date,entry_type,body,created_at,updated_at",
        filters: { user_id: profileId },
        limit: 100,
      }),
      client.selectRows("tn_media_files", {
        select: "id,owner_user_id,journal_entry_id,storage_path,media_type,created_at",
        filters: { owner_user_id: profileId },
        limit: 200,
      }),
      client.selectRows("tn_lesson_records", {
        select: "lesson_id,coach_comment,next_curriculum_ref_id,deducted_sessions,completed_at",
        limit: 100,
      }).catch(() => []),
      client.selectRows("tn_curriculum_refs", {
        select: "id,skill_label,title,notion_url,status",
        filters: { status: "active" },
        limit: 200,
      }).catch(() => []),
      client.rpc
        ? client.rpc("tn_member_lesson_chart", {
          target_user_id: profileId,
          target_limit: 50,
        }).catch(() => [])
        : Promise.resolve([]),
    ]);
    const ownLessonIds = new Set(state.liveLessons.filter((lesson) => lesson.isOwnLesson).map((lesson) => lesson.id));
    const recordsByLesson = new Map((recordRows || [])
      .filter((record) => ownLessonIds.has(record.lesson_id))
      .map((record) => [record.lesson_id, record]));
    const curriculaById = new Map((curriculumRows || []).map((curriculum) => [curriculum.id, curriculum]));

    for (const row of (journalRows || []).sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))) {
      const payload = parseServerJournalBody(row.body);
      if (!payload) continue;
      const rowsForJournal = (mediaRows || [])
        .filter((media) => media.journal_entry_id === row.id)
        .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
      const mediaItems = await Promise.all(rowsForJournal.map((media, index) => (
        downloadServerMediaItem(client, media, payload.mediaNames?.[index] || `첨부 ${index + 1}`)
      )));
      const record = recordsByLesson.get(row.lesson_id);
      const recordCurriculum = curriculaById.get(record?.next_curriculum_ref_id);
      const nextCurriculumId = recordCurriculum?.skill_label || payload.nextCurriculumId || payload.curriculumId;
      const curriculum = curriculumById(nextCurriculumId, curriculumSteps[0]);
      const log = {
        id: payload.clientLogId || `server-journal-${row.id}`,
        serverJournalId: row.id,
        serverLessonId: row.lesson_id || "",
        lessonId: payload.lessonId || "",
        lessonLabel: payload.lessonLabel || "서버 수업기록",
        round: Number(payload.round) || lessonRound(),
        journalDate: row.entry_date,
        content: payload.content || "수업 내용 미입력",
        selfMemo: payload.selfMemo || "자기 운동 일지 미입력",
        mediaNames: payload.mediaNames || mediaItems.map((item) => item.name),
        mediaItems,
        status: record ? "confirmed" : "coach_pending",
        curriculum,
        nextCurriculumId: nextCurriculumId || curriculum.id,
        coachComment: record?.coach_comment || "",
        memberVisibleSummary: record ? `다음 수업 등록 완료: ${curriculum.id} · ${curriculum.title}` : "",
        ticketDeducted: Boolean(record && Number(record.deducted_sessions) > 0),
        submittedAt: payload.submittedAt || row.created_at,
      };
      const existingIndex = state.lessonLogs.findIndex((item) => (
        item.serverJournalId === row.id
        || item.id === log.id
        || (row.lesson_id && String(item.serverLessonId || "") === String(row.lesson_id))
      ));
      if (existingIndex >= 0) state.lessonLogs[existingIndex] = { ...state.lessonLogs[existingIndex], ...log };
      else state.lessonLogs.unshift(log);
    }

    const existingChartLessonIds = new Set(state.lessonLogs
      .map((item) => String(item.serverLessonId || ""))
      .filter(Boolean));
    const chartLogs = (Array.isArray(lessonChartRows) ? lessonChartRows : [])
      .filter((record) => record.lessonId && !existingChartLessonIds.has(String(record.lessonId)))
      .map((record, index) => {
        existingChartLessonIds.add(String(record.lessonId));
        const nextCurriculumId = record.nextCurriculumSkillLabel || "";
        const curriculum = nextCurriculumId ? curriculumById(nextCurriculumId, curriculumSteps[0]) : null;
        const outcomeLabel = {
          completed: "수업 완료",
          no_show: "노쇼",
          absence: "불참",
          cancelled: "취소",
          holiday: "휴무",
        }[String(record.outcome || "").toLowerCase()] || "수업 기록";
        const lessonType = scheduleV2MemberLessonKind(record.scheduleKind || "regular");
        return {
          id: `member-chart-${record.id || record.lessonId}`,
          serverJournalId: "",
          serverLessonId: record.lessonId,
          lessonId: `server-${record.lessonId}`,
          lessonLabel: `${record.startTime || ""} · ${record.coachName || "담당 코치"} · ${lessonType}`.replace(/^ · /, ""),
          round: Math.max(1, (Array.isArray(lessonChartRows) ? lessonChartRows.length : 1) - index),
          journalDate: record.lessonDate || String(record.finalizedAt || record.updatedAt || "").slice(0, 10),
          content: [record.technique, record.strength, record.improvement].filter(Boolean).join(" · ") || outcomeLabel,
          selfMemo: "회원 운동일지 미작성",
          mediaNames: [],
          mediaItems: [],
          status: "confirmed",
          curriculum,
          nextCurriculumId,
          coachComment: record.coachComment || "",
          memberVisibleSummary: record.nextGoal
            ? `다음 수업 목표: ${record.nextGoal}`
            : record.nextCurriculumTitle
              ? `다음 수업: ${record.nextCurriculumTitle}`
              : "",
          ticketDeducted: Number(record.deductedSessions) > 0,
          deductedSessions: Number(record.deductedSessions) || 0,
          participantOutcome: record.outcome || "completed",
          submittedAt: record.finalizedAt || record.updatedAt || "",
        };
      });
    if (chartLogs.length) state.lessonLogs = [...chartLogs, ...state.lessonLogs];

    const existingRecordLessonIds = new Set(state.lessonLogs
      .map((item) => item.serverLessonId)
      .filter(Boolean));
    const recordOnlyLogs = (recordRows || [])
      .filter((record) => ownLessonIds.has(record.lesson_id))
      .sort((left, right) => String(left.completed_at || "").localeCompare(String(right.completed_at || "")))
      .map((record, index) => ({ record, round: index + 1 }))
      .filter(({ record }) => !existingRecordLessonIds.has(record.lesson_id))
      .map(({ record, round }) => {
        const lesson = state.liveLessons.find((item) => item.id === record.lesson_id || item.serverLessonId === record.lesson_id) || {};
        const recordCurriculum = curriculaById.get(record.next_curriculum_ref_id);
        const nextCurriculumId = recordCurriculum?.skill_label || "FH-01";
        const curriculum = curriculumById(nextCurriculumId, curriculumSteps[0]);
        return {
          id: `server-record-${record.lesson_id}`,
          serverJournalId: "",
          serverLessonId: record.lesson_id,
          lessonId: lesson.id || `server-${record.lesson_id}`,
          lessonLabel: `${lesson.day || lesson.lessonDate || "수업"} ${lesson.time || ""} · ${lesson.type || "레슨"}`.trim(),
          round,
          journalDate: lesson.lessonDate || String(record.completed_at || "").slice(0, 10),
          content: "회원 운동일지 미작성 · 코치 수업기록",
          selfMemo: "운동일지 미작성",
          mediaNames: [],
          mediaItems: [],
          status: "confirmed",
          curriculum,
          nextCurriculumId,
          coachComment: record.coach_comment || "",
          memberVisibleSummary: `다음 수업 등록 완료: ${curriculum.id} · ${curriculum.title}`,
          ticketDeducted: Number(record.deducted_sessions) > 0,
          submittedAt: record.completed_at,
        };
      })
      .reverse();
    if (recordOnlyLogs.length) state.lessonLogs = [...recordOnlyLogs, ...state.lessonLogs];
    return true;
  } catch (error) {
    console.warn("Tennis Note member journal sync failed", error);
    return false;
  }
}

async function persistLessonJournalToServer(log, files = []) {
  const client = window.TennisNoteDataClient;
  const profileId = state.member?.profileId || "";
  if (!profileId || !client?.insertRows || !client?.uploadObject || !client.getSession?.()?.access_token) return false;
  const liveLesson = liveLessonForJournal(log);
  const inserted = await client.insertRows("tn_journal_entries", {
    user_id: profileId,
    lesson_id: liveLesson?.id || null,
    entry_date: log.journalDate,
    entry_type: "lesson",
    practice_type: null,
    body: serverJournalBody(log),
  });
  const journal = inserted?.[0];
  if (!journal?.id) throw new Error("journal_insert_failed");

  const uploadedPaths = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const storagePath = `${profileId}/${journal.id}/${safeJournalObjectName(file, index)}`;
      await client.uploadObject(journalMediaBucket, storagePath, file);
      uploadedPaths.push(storagePath);
      await client.insertRows("tn_media_files", {
        owner_user_id: profileId,
        journal_entry_id: journal.id,
        storage_path: storagePath,
        media_type: journalMediaType(file),
      });
    }
  } catch (error) {
    await Promise.allSettled(uploadedPaths.map((storagePath) => client.deleteObject(journalMediaBucket, storagePath)));
    await client.deleteRows?.("tn_journal_entries", { id: journal.id }).catch(() => {});
    throw error;
  }

  log.serverJournalId = journal.id;
  log.serverLessonId = liveLesson?.id || "";
  return true;
}
