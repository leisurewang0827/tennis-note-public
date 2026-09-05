(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TennisNoteSingleSheetSnapshot = api;
})(globalThis, function () {
  "use strict";
  const SOURCES = Object.freeze({
    users: ["tn_user_directory_safe", "id,name,phone,role,status"],
    memberRecords: ["tn_member_database_records", "user_id,branch_id"],
    coaches: ["tn_coach_roles", "id,user_id,branch_id,display_name,status,employment_status,archived_at,deleted_at"],
    availability: ["tn_coach_availability", "coach_role_id,day_of_week,start_time,end_time,availability_type"],
    products: ["tn_membership_products", "id,branch_id,name,is_active,lesson_minutes,group_size,group_deduction_policy,validity_days,grace_days"],
    tickets: ["tn_member_tickets", "id,user_id,branch_id,coach_role_id,product_id,status"],
    lessons: ["tn_lessons", "id,branch_id,member_ticket_id,coach_role_id,lesson_date,start_time,duration_minutes,status"],
    participants: ["tn_lesson_participants", "lesson_id,user_id,ticket_id"],
    closures: ["tn_schedule_v2_closures", "branch_id,closure_date,all_day,status"],
  });
  const cleanTime = value => /^\d\d:\d\d(?::00)?$/.test(String(value)) ? String(value).slice(0, 5) : null;
  const pick = (item, columns) => Object.fromEntries(columns.split(",").map(key => [key, item[key]]));
  // Projection of already-read sources. Does not call a client, RPC or persistence.
  function captureExisting(raw, scope) {
    return { scope: { ...scope }, reads: Object.fromEntries(Object.entries(SOURCES).map(([key, [, columns]]) => [key, {
      rows: Array.isArray(raw[key]) ? raw[key].map(row => pick(row, columns)) : null,
      complete: false, // Existing operational roster/window/limits prove no full coverage.
    }])), proof: null, receipts: null };
  }
  function adapt(packet, expected, now) {
    const errors = [];
    const hold = code => { if (!errors.includes(code)) errors.push(code); };
    const result = () => ({ context: null, errors, canApply: false });
    if (!packet || expected?.authorized !== true) { hold("ADMIN_SNAPSHOT_REQUIRED"); return result(); }
    for (const key of ["environment", "projectFingerprint", "branchId"]) {
      if (!expected[key] || !packet.scope?.[key]) hold("TARGET_UNVERIFIED");
      else if (packet.scope[key] !== expected[key]) hold("TARGET_OR_REVISION_MISMATCH");
    }
    const proof = packet.proof;
    if (!proof || !proof.before || proof.before !== proof.after) hold("REVISION_UNCONFIRMED");
    if (proof?.scope !== "all_import_dependencies") hold("REVISION_SCOPE_INCOMPLETE");
    if (!Number.isFinite(Date.parse(now)) || !Number.isFinite(Date.parse(proof?.expiresAt)) || Date.parse(now) >= Date.parse(proof?.expiresAt)) hold("STALE_PREVIEW");
    if (!Array.isArray(packet.receipts)) hold("IMPORT_RECEIPTS_UNAVAILABLE");
    if (proof?.policy !== "product_validity_plus_grace_inclusive" || proof?.capacity !== "complete_regular_constraints" || !["skip", "hold"].includes(proof?.closureMode)) hold("POLICY_UNCONFIRMED");
    for (const key of Object.keys(SOURCES)) {
      const read = packet.reads?.[key];
      if (!Array.isArray(read?.rows) || read.complete !== true || read.totalCount !== read.rows.length || read.revision !== proof?.before) hold("SNAPSHOT_INCOMPLETE");
    }
    // None of the above proof fields are fabricated by captureExisting or read from UI arrays.
    if (errors.length) return result();
    const rows = key => packet.reads[key].rows;
    const branchId = expected.branchId;
    const records = rows("memberRecords").filter(r => r.branch_id === branchId);
    const memberIds = new Set(records.map(r => r.user_id));
    const users = rows("users");
    if ([...memberIds].some(id => users.filter(u => u.id === id && u.role === "member").length !== 1)) hold("IDENTITY_SCOPE_INCOMPLETE");
    const members = users.filter(u => memberIds.has(u.id) && u.role === "member").map(u => ({ id: u.id, branchId, phone: u.phone }));
    const coaches = rows("coaches").map(c => ({ id: c.id, branchId: c.branch_id, name: c.display_name,
      active: c.status === "approved" && c.employment_status === "active" && !c.archived_at && !c.deleted_at }));
    const products = rows("products").map(p => {
      if (!Number.isInteger(p.validity_days) || p.validity_days < 1 || !Number.isInteger(p.grace_days) || p.grace_days < 0) hold("PRODUCT_POLICY_UNCONFIRMED");
      // No unsupported shared-ticket/group deduction semantics are silently converted.
      if (p.group_size === 2) hold("GROUP_POLICY_SERVER_REQUIRED");
      return { id: p.id, branchId: p.branch_id, name: p.name, active: p.is_active === true, groupSize: p.group_size,
        lessonMinutes: p.lesson_minutes, unitMinutes: p.lesson_minutes,
        validityDays: p.validity_days + p.grace_days, validityKind: "days_inclusive" };
    });
    const tickets = rows("tickets").map(t => {
      if (!["active", "expired", "cancelled", "void"].includes(t.status)) hold("TICKET_STATE_UNSUPPORTED");
      return { id: t.id, memberId: t.user_id, branchId: t.branch_id, coachId: t.coach_role_id, productId: t.product_id, status: t.status };
    });
    const availability = rows("availability").map(a => {
      const role = rows("coaches").find(c => c.id === a.coach_role_id);
      if (!role || a.availability_type !== "available" || !Number.isInteger(a.day_of_week) || a.day_of_week < 0 || a.day_of_week > 6) hold("AVAILABILITY_POLICY_UNCONFIRMED");
      return { branchId: role?.branch_id, coachId: a.coach_role_id, days: [["일", "월", "화", "수", "목", "금", "토"][a.day_of_week]], start: cleanTime(a.start_time), end: cleanTime(a.end_time) };
    });
    const reservations = rows("lessons").map(l => {
      const participants = rows("participants").filter(p => p.lesson_id === l.id);
      const ticket = rows("tickets").find(t => t.id === l.member_ticket_id);
      const ids = [...new Set([ticket?.user_id, ...participants.map(p => p.user_id)].filter(Boolean))];
      if (!ids.length || participants.some(p => !rows("tickets").some(t => t.id === p.ticket_id))) hold("PARTICIPANT_SCOPE_INCOMPLETE");
      if (!["scheduled", "completed", "absence", "no_show", "cancelled"].includes(l.status)) hold("LESSON_STATE_UNSUPPORTED");
      return { id: l.id, branchId: l.branch_id, date: l.lesson_date, time: cleanTime(l.start_time), durationMinutes: l.duration_minutes, coachId: l.coach_role_id, memberIds: ids, status: l.status };
    });
    const closures = rows("closures").filter(c => c.status !== "cancelled").map(c => {
      if (c.all_day !== true || c.status !== "active") hold("CLOSURE_POLICY_UNCONFIRMED");
      return { branchId: c.branch_id, date: c.closure_date };
    });
    if (errors.length) return result();
    const scope = { environment: expected.environment, projectFingerprint: expected.projectFingerprint, branchId, revision: proof.before };
    return { errors: [], canApply: false, context: { ...scope, expected: scope, snapshotComplete: true,
      expiresAt: proof.expiresAt, policy: { confirmed: true, timezone: "Asia/Seoul", closureMode: proof.closureMode },
      members, coaches, products, tickets, reservations, availability, closures, receipts: packet.receipts } };
  }
  const SERVER_REASONS = Object.freeze({
    SHEET_REQUEST_BUDGET_REQUIRED: "서버 실행 시간 제한이 설정되지 않았습니다. 등록을 중단했습니다.",
    SHEET_PLAN_CHANGED: "미리보기 이후 계획이 달라졌습니다. 다시 확인해 주세요.",
    SHEET_PREVIEW_STALE: "미리보기 유효 시간이 지났습니다. 다시 확인해 주세요.",
    SHEET_UNEXPECTED_SIDE_EFFECT: "허용되지 않은 영향이 감지되어 이 단위를 전부 취소했습니다.",
    SHEET_DIRECTORY_SIDE_EFFECT: "기존 회원 기록 보존 조건이 맞지 않아 등록하지 않았습니다.",
    SHEET_EXISTING_TICKET_REVIEW: "기존 회원권 갱신 대상 확인이 필요합니다.",
    SHEET_EXISTING_PROJECTION_REVIEW: "기존 회원 기록을 보존하려면 관리자 검토가 필요합니다.",
    SHEET_IDENTITY_AMBIGUOUS: "연락처에 여러 회원이 연결되어 보류했습니다.",
    SHEET_IDENTITY_CONFLICT: "기존 회원 정보와 일치하지 않아 보류했습니다.",
    SHEET_GROUP_INCOMPLETE: "같은 그룹의 두 회원 행이 모두 필요합니다.",
    SHEET_GROUP_MISMATCH: "그룹의 상품·코치·회차·일정이 일치해야 합니다.",
    SHEET_GROUP_POLICY_REVIEW: "그룹 차감 정책을 먼저 확인해 주세요.",
    SHEET_COURT_POLICY_REVIEW: "코트 정원 정책은 서버 검토가 필요합니다.",
    SHEET_CLOSURE_REVIEW: "휴무와 겹칩니다. 다른 일정으로 다시 확인해 주세요.",
    SHEET_AVAILABILITY_UNCONFIRMED: "코치의 가능 시간이 확인되지 않았습니다.",
    SHEET_SLOT_CONFLICT: "기존 수업·요청 또는 파일 안의 시간과 겹칩니다.",
    SHEET_BATCH_CONFLICT: "파일 안의 다른 등록 계획과 시간이 겹칩니다. 충돌한 양쪽 행을 함께 확인해 주세요.",
    SHEET_INSUFFICIENT_FUTURE_CAPACITY: "기간 안에 잔여 횟수 전체를 배정할 수 없습니다.",
    SHEET_LATER_ACTIVITY_REVIEW: "등록 이후 변경이 있어 자동 원복하지 않았습니다.",
  });
  function serverReason(code) { return SERVER_REASONS[code] || "서버 등록 조건을 확인한 뒤 다시 미리보기해 주세요."; }
  // This is a server-result adapter, not a fabricated roster completeness proof.
  // It never supplies legacy context or enables the current UI/live apply path.
  function adaptServer(packet, expected, now) {
    const errors = [];
    const held = code => ({ context: null, serverPreview: null, canApply: false, errors: [code] });
    const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
    if (expected?.authorized !== true) return held("ADMIN_SNAPSHOT_REQUIRED");
    if (packet?.contract !== "single-sheet-server/2") return held("SERVER_CONTRACT_REQUIRED");
    for (const key of ["environment", "projectFingerprint", "branchId"]) {
      if (!expected[key] || packet.scope?.[key] !== expected[key]) return held("TARGET_OR_REVISION_MISMATCH");
    }
    const p = packet.proof;
    if (!p || p.complete !== true || p.scope !== "unit_dependencies" || p.statementBudgetMs !== 10000 ||
      !Number.isInteger(p.unitCount) || p.unitCount !== packet.units?.length) return held("SNAPSHOT_INCOMPLETE");
    if (!Number.isFinite(Date.parse(now)) || !Number.isFinite(Date.parse(p.expiresAt)) || Date.parse(now) >= Date.parse(p.expiresAt)) return held("STALE_PREVIEW");
    if (!Array.isArray(packet.units) || packet.units.length < 1 || packet.units.length > 500) return held("SERVER_UNITS_INVALID");
    const seen = new Set();
    const units = [];
    for (const unit of packet.units) {
      if (!digest(unit.unitHash) || !digest(unit.planHash) || !digest(unit.revision) || seen.has(unit.unitHash) || !["READY", "HOLD", "APPLIED", "REVERSED"].includes(unit.status)) return held("SERVER_UNITS_INVALID");
      seen.add(unit.unitHash);
      if (!Number.isInteger(unit.rowCount) || unit.rowCount < 0 || unit.rowCount > 2) return held("SERVER_UNITS_INVALID");
      const replay = ["APPLIED", "REVERSED"].includes(unit.status);
      if (unit.status === "READY" || replay) {
        if (unit.rowCount < 1 || !Number.isInteger(unit.newMembers) || unit.newMembers < 0 || unit.newMembers > unit.rowCount ||
          unit.newTickets !== (replay ? 0 : 1) || !Number.isInteger(unit.newLessons) || unit.newLessons < 0 || unit.newLessons > 1000 ||
          (replay && (unit.newMembers !== 0 || unit.newLessons !== 0 || typeof unit.verified !== "boolean"))) return held("SERVER_COUNTS_INVALID");
      } else if (!/^SHEET_[A-Z_]+$/.test(unit.reason || "")) return held("SERVER_UNITS_INVALID");
      units.push(Object.freeze({ status: unit.status, unitHash: unit.unitHash, planHash: unit.planHash, revision: unit.revision, verified: unit.verified === true, rowCount: unit.rowCount,
        newMembers: unit.newMembers || 0, newTickets: unit.newTickets || 0, newLessons: unit.newLessons || 0,
        reversible: unit.status === "APPLIED" && unit.reversible === true,
        reason: unit.status === "HOLD" ? serverReason(unit.reason) : "" }));
    }
    return { context: null, canApply: false, errors, serverPreview: Object.freeze({ expiresAt: p.expiresAt,
      units: Object.freeze(units), rowCount: units.reduce((n, u) => n + u.rowCount, 0),
      newTickets: units.reduce((n, u) => n + u.newTickets, 0), newLessons: units.reduce((n, u) => n + u.newLessons, 0) }) };
  }
  return Object.freeze({ SOURCES, captureExisting, adapt, adaptServer, serverReason });
});
