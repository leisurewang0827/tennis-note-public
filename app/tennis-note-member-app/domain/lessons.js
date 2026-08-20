// 수업 하나를 어떻게 보여주고 정렬할지 정하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function isOwnMemberScheduleLesson(lesson = {}) {
  if (typeof lesson.isOwnLesson === "boolean") return lesson.isOwnLesson;
  return isCurrentMemberName(lesson.member);
}

function normalizeAdminLessonForMember(lesson, snapshot) {
  const coach = adminCoachNameForLesson(lesson, snapshot);
  const rawText = `${lesson.type || ""} ${lesson.status || ""} ${coach}`;
  if (/무인|볼머신/.test(rawText)) return null;
  const memberName = lesson.member === "빈자리" || lesson.member === "보강대기" ? "" : lesson.member || "";
  const isAvailable = lesson.status === "available" || !memberName;
  const isMine = isCurrentMemberName(memberName);
  const isPending = lesson.status === "pending" || /요청|접수/.test(rawText);
  return {
    id: `admin-${lesson.id}`,
    day: lesson.day,
    time: lesson.time,
    coach,
    member: memberName,
    type: isAvailable ? "수업 변경 가능" : isPending && isMine ? "수업 변경 요청" : "정규",
    status: isAvailable ? "available" : isPending && isMine ? "requested" : isMine ? "scheduled" : "occupied",
    policy: isPending ? "coach" : "auto",
    durationMinutes: Number(lesson.durationMinutes) || 20,
    lessonSource: lesson.lessonSource || (lesson.makeup ? "makeup" : "regular"),
    source: "admin",
  };
}

function nextMemberLesson() {
  const now = new Date();
  return memberLessons()
    .filter((lesson) => memberLessonPriority(lesson, now).group < 2)
    .sort((left, right) => compareMemberLessonsByNearest(left, right, now))[0] || null;
}

function memberLessonTicketId(lesson = {}) {
  return String(lesson.ticketId || lesson.member_ticket_id || lesson.memberTicketId || "");
}

function memberLessonPriority(lesson = {}, now = new Date()) {
  const lessonDate = lesson.lessonDate || memberScheduleDateForDay(lesson.day);
  const startAt = lessonDate && lesson.time ? new Date(`${lessonDate}T${lesson.time}:00`) : null;
  if (!startAt || Number.isNaN(startAt.getTime())) {
    return { group: 3, distance: Number.MAX_SAFE_INTEGER, startsAt: Number.MAX_SAFE_INTEGER };
  }
  const startsAt = startAt.getTime();
  const endsAt = startsAt + Math.max(1, Number(lesson.durationMinutes) || lessonDuration(lesson)) * 60_000;
  const current = now.getTime();
  if (startsAt <= current && current < endsAt) return { group: 0, distance: 0, startsAt };
  if (startsAt > current) return { group: 1, distance: startsAt - current, startsAt };
  return { group: 2, distance: current - endsAt, startsAt: -startsAt };
}

function compareMemberLessonsByNearest(left, right, now = new Date()) {
  const leftPriority = memberLessonPriority(left, now);
  const rightPriority = memberLessonPriority(right, now);
  return leftPriority.group - rightPriority.group
    || leftPriority.distance - rightPriority.distance
    || leftPriority.startsAt - rightPriority.startsAt;
}

function memberLessonVisualKind(lesson = {}) {
  const source = String(lesson.lessonSource || lesson.lesson_source || "").toLowerCase();
  if (["no_show", "cancelled_late"].includes(String(lesson.serverStatus || lesson.status || "").toLowerCase())) return "noShow";
  if (source === "makeup" || String(lesson.type || "").includes("보강")) return "makeup";
  if (source === "coupon" || String(lesson.type || "").includes("쿠폰")) return "coupon";
  if (lessonDuration(lesson) === 30) return "regular30";
  return "regular";
}

function memberLessonColorStyle(lesson, policy) {
  const kind = memberLessonVisualKind(lesson);
  const fallback = { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" };
  const custom = (policy?.lessonColorRules || []).find((rule) => rule.match && `${lesson.type || ""} ${lesson.lessonSource || ""}`.includes(rule.match));
  const saved = custom?.color || policy?.lessonColors?.[kind] || "";
  const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : fallback[kind];
  return `--lesson-color:${color}`;
}

function memberLessonTitle(lesson, isMine) {
  if (!isMine) return lesson?.oneDayBooking ? "원데이 예약" : "수업중";
  if (lesson.status === "requested") return "변경요청";
  const kind = memberLessonVisualKind(lesson);
  if (kind === "makeup") return "보강";
  if (kind === "coupon") return "쿠폰";
  return "내 수업";
}

function memberLessonStateClass(lesson = {}) {
  return String(lesson.serverStatus || lesson.status || "").toLowerCase() === "completed"
    ? "status-completed"
    : "";
}

function lessonDetailDateTimeLabel(lesson = {}) {
  if (lesson.lessonDate) {
    const date = new Date(`${lesson.lessonDate}T12:00:00`);
    if (!Number.isNaN(date.getTime())) {
      const dateLabel = date.toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
      });
      return `${dateLabel} · ${lesson.time || "시간 확인"}`;
    }
  }
  return `${lesson.day ? `${lesson.day}요일` : "날짜 확인"} · ${lesson.time || "시간 확인"}`;
}

function lessonDetailStatusInfo(lesson = {}) {
  const status = String(lesson.serverStatus || lesson.status || "scheduled").toLowerCase();
  const kind = memberLessonVisualKind(lesson);
  if (status === "requested" || status === "pending_change") {
    return {
      label: memberStatusLabel("lesson", "pending_change", "변경 요청 중"),
      message: "요청을 확인하고 있습니다. 처리 결과는 알림으로 알려드립니다.",
      primaryAction: "",
    };
  }
  if (status === "makeup_due" || ["absence", "absent"].includes(status) || lesson.makeupEntitlementId) {
    return {
      label: memberStatusLabel("lesson", "makeup_available", "보강 가능"),
      message: "운영 규칙에 맞는 보강 가능 시간을 선택할 수 있습니다.",
      primaryAction: "makeup",
    };
  }
  if (status === "completed") {
    return {
      label: memberStatusLabel("lesson", "completed", "완료"),
      message: "수업 내용을 운동기록에 남겨 보세요.",
      primaryAction: "",
    };
  }
  if (status === "no_show") {
    return {
      label: memberStatusLabel("lesson", "no_show", "노쇼"),
      message: "당일 불참으로 처리된 수업입니다.",
      primaryAction: "",
    };
  }
  if (status === "holiday") {
    return {
      label: memberStatusLabel("lesson", "holiday", "휴무"),
      message: "센터 휴무로 처리되었으며 회원권은 차감되지 않습니다.",
      primaryAction: "",
    };
  }
  if (status === "cancelled") {
    return {
      label: memberStatusLabel("lesson", "cancelled", "취소"),
      message: "취소된 수업입니다.",
      primaryAction: "",
    };
  }
  return {
    label: kind === "makeup"
      ? memberStatusLabel("lesson", "makeup_booked", "보강 예약")
      : memberStatusLabel("lesson", "scheduled", "예정"),
    message: "수업 변경 가능 시간은 센터 운영 규칙에 따라 표시됩니다.",
    primaryAction: "change",
  };
}
