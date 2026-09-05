(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TennisNoteSingleSheetImport = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  // Preview only: no database, storage, network, payment or apply dependency.
  const VERSION = "single-sheet-preview/1";
  const SHEET = "회원등록";
  const HEADERS = Object.freeze(["회원명", "연락처", "코치", "회원권", "시작일", "총횟수", "사용횟수", "요일1", "시간1", "요일2", "시간2", "요일3", "시간3", "그룹코드"]);
  const LIMITS = Object.freeze({ rows: 500, physicalRows: 5001, bytes: 5 * 1024 * 1024, cells: 70014, sessions: 1000, horizonDays: 1096 });
  const DAY = 86400000;
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const parsedState = new WeakMap();
  const previewState = new WeakMap();
  const text = value => String(value ?? "").normalize("NFC").trim();
  const canonical = value => JSON.stringify(value, function (_key, item) {
    return item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
  });
  const clone = value => JSON.parse(JSON.stringify(value));
  const frozen = value => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(frozen);
      Object.freeze(value);
    }
    return value;
  };
  async function hash(value) {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
  }
  function fail(code) { throw new Error(code); }
  function date(value, epoch1904 = false) {
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value < (epoch1904 ? 0 : 61) || value > 2958465) return null;
      value = new Date(Date.UTC(epoch1904 ? 1904 : 1899, epoch1904 ? 0 : 11, epoch1904 ? 1 : 30) + value * DAY).toISOString().slice(0, 10);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return null;
    const result = Date.parse(`${text(value)}T00:00:00Z`);
    return Number.isFinite(result) && new Date(result).toISOString().slice(0, 10) === text(value) ? text(value) : null;
  }
  function time(value) {
    if (typeof value === "number") {
      if (value < 0 || value >= 1 || Math.abs(value * 1440 - Math.round(value * 1440)) > 0.000001) return null;
      const minutes = Math.round(value * 1440);
      value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text(value)) ? text(value) : null;
  }
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  function phone(value) {
    if (typeof value !== "string" || !/^(?:\+82|0)[\d -]+$/.test(text(value))) return null;
    const normalized = text(value).replace(/[ -]/g, "").replace(/^\+82/, "0");
    return /^0\d{8,10}$/.test(normalized) ? normalized : null;
  }
  function count(value) {
    if (!/^\d+$/.test(text(value))) return null;
    const n = Number(value);
    return Number.isSafeInteger(n) && n <= LIMITS.sessions ? n : null;
  }
  const unsafeCell = cell => cell && (cell.f != null || cell.F != null || cell.l != null || cell.t === "e");
  const occupied = cell => Boolean(cell && (unsafeCell(cell) || text(cell.v) !== ""));
  function normalizeRow(values, epoch1904) {
    const problems = [];
    const problem = code => { if (!problems.includes(code)) problems.push(code); };
    HEADERS.slice(0, 7).forEach(key => { if (text(values[key]) === "") problem("REQUIRED_VALUE_MISSING"); });
    const row = {
      name: text(values["회원명"]), phone: phone(values["연락처"]), coach: text(values["코치"]),
      product: text(values["회원권"]), startDate: date(values["시작일"], epoch1904),
      total: count(values["총횟수"]), used: count(values["사용횟수"]), group: text(values["그룹코드"]), slots: [],
    };
    if (!row.phone) problem(typeof values["연락처"] === "number" ? "PHONE_TEXT_REQUIRED" : "PHONE_INVALID");
    if (!row.startDate) problem("DATE_INVALID");
    if (row.total === null || row.total === 0 || row.used === null || row.used > row.total) problem("SESSION_COUNTS_INVALID");
    for (const key of ["name", "coach", "product", "group"]) {
      if (row[key].length > 160 || /[\p{Cc}\p{Cf}<>]/u.test(row[key]) || /^[=+@]/.test(row[key])) problem("TEXT_UNSAFE");
    }
    for (let i = 1; i <= 3; i += 1) {
      const dayValue = text(values[`요일${i}`]);
      const timeValue = values[`시간${i}`];
      if (!dayValue && text(timeValue) === "") continue;
      if (!dayValue || text(timeValue) === "") { problem("SLOT_PAIR_INCOMPLETE"); continue; }
      const day = dayValue.replace(/요일$/, "");
      const slotTime = time(timeValue);
      if (!DAYS.includes(day) || !slotTime) { problem("SLOT_INVALID"); continue; }
      if (row.slots.some(slot => slot.day === day && slot.time === slotTime)) problem("SLOT_DUPLICATE");
      row.slots.push({ day, time: slotTime });
    }
    row.slots.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.time.localeCompare(b.time));
    return { row, problems };
  }
  function packageSafe(workbook) {
    if (workbook.vbaraw || workbook.Workbook?.Sheets?.some(s => s.Hidden)) return false;
    if (workbook.Workbook?.Names?.length) return false;
    return !Object.keys(workbook.files || {}).some(name => /externalLinks|vbaProject|embeddings|connections\.xml/i.test(name));
  }
  async function parseWorkbook(workbook, fileHash) {
    if (!/^[a-f0-9]{64}$/.test(fileHash || "")) fail("FILE_HASH_REQUIRED");
    const errors = [];
    const rows = [];
    const privateRows = [];
    const block = code => { if (!errors.includes(code)) errors.push(code); };
    if (workbook?.SheetNames?.length !== 1 || workbook.SheetNames[0] !== SHEET || Object.keys(workbook.Sheets || {}).length !== 1) block("SINGLE_SHEET_REQUIRED");
    if (!workbook || !packageSafe(workbook)) block("WORKBOOK_UNSAFE");
    const sheet = workbook?.Sheets?.[SHEET];
    if (!sheet || errors.length) return finish();
    if (sheet["!merges"]?.length || sheet["!rows"]?.some(r => r?.hidden) || sheet["!cols"]?.some(c => c?.hidden)) block("HIDDEN_OR_MERGED_CELLS");
    const addresses = Object.keys(sheet).filter(key => /^[A-Z]+\d+$/.test(key));
    if (addresses.length > LIMITS.cells) block("WORKBOOK_LIMIT");
    const cellRows = new Map();
    for (const address of addresses) {
      const cell = sheet[address];
      if (!occupied(cell)) continue;
      const [, column, number] = /^([A-Z]+)(\d+)$/.exec(address);
      const rowNumber = Number(number);
      if (rowNumber > LIMITS.physicalRows || rowNumber < 1 || !/^[A-N]$/.test(column)) { block("ROW_OR_COLUMN_LIMIT"); continue; }
      if (!cellRows.has(rowNumber)) cellRows.set(rowNumber, {});
      cellRows.get(rowNumber)[column] = cell;
    }
    const headers = Object.create(null);
    for (const [column, cell] of Object.entries(cellRows.get(1) || {})) {
      const key = text(cell.v).replace(/\s*\*$/, "");
      if (unsafeCell(cell) || !HEADERS.includes(key)) block("HEADER_UNKNOWN");
      if (Object.values(headers).includes(key)) block("HEADER_DUPLICATE");
      headers[column] = key;
    }
    if (HEADERS.slice(0, 7).some(key => !Object.values(headers).includes(key))) block("HEADER_MISSING");
    const data = [...cellRows.entries()].filter(([n]) => n > 1).sort(([a], [b]) => a - b);
    if (data.length > LIMITS.rows) block("ROW_LIMIT");
    if (data.length === 0) block("EMPTY_DATA");
    if (errors.length) return finish();
    for (const [rowNumber, cells] of data) {
      const values = Object.create(null);
      const reasons = [];
      for (const [column, cell] of Object.entries(cells)) {
        if (!headers[column]) reasons.push("UNHEADED_CELL");
        if (unsafeCell(cell)) reasons.push("FORMULA_OR_LINK_FORBIDDEN");
        values[headers[column]] = cell.v;
      }
      const normalized = normalizeRow(values, Boolean(workbook.Workbook?.WBProps?.date1904));
      const rowHash = await hash(canonical(normalized.row));
      const operationKey = await hash(canonical([VERSION, fileHash, SHEET, rowNumber, rowHash]));
      privateRows.push({ ...normalized.row, rowNumber, rowHash, operationKey, reasons: [...new Set([...reasons, ...normalized.problems])] });
    }
    const seen = new Map();
    const identityNames = new Map();
    for (const row of privateRows) {
      const key = canonical([row.phone, row.coach, row.product]);
      if (row.phone && seen.has(key)) {
        row.reasons.push("DUPLICATE_TICKET_INTENT");
        seen.get(key).reasons.push("DUPLICATE_TICKET_INTENT");
      } else seen.set(key, row);
      if (row.phone) {
        if (!identityNames.has(row.phone)) identityNames.set(row.phone, []);
        identityNames.get(row.phone).push(row);
      }
    }
    for (const sameIdentity of identityNames.values()) {
      if (new Set(sameIdentity.map(row => row.name)).size > 1) sameIdentity.forEach(row => row.reasons.push("IDENTITY_NAME_CONFLICT"));
    }
    return finish();
    function finish() {
      for (const row of privateRows) rows.push({ rowNumber: row.rowNumber, rowHash: row.rowHash, operationKey: row.operationKey, status: row.reasons.length ? "HOLD" : "PARSED", reasons: [...new Set(row.reasons)], display: `행 ${row.rowNumber} · 식별정보 비공개` });
      const result = frozen({ contractVersion: VERSION, sheet: SHEET, fileHash, errors, rows, canApply: false });
      parsedState.set(result, privateRows);
      return result;
    }
  }
  async function readFile(bytes, xlsx) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > LIMITS.bytes) fail("FILE_SIZE_INVALID");
    // XLSX only; reject CSV/HTML/legacy binary auto-detection by the vendor reader.
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) fail("XLSX_REQUIRED");
    if (typeof xlsx?.read !== "function") fail("XLSX_READER_REQUIRED");
    let workbook;
    try { workbook = xlsx.read(bytes, { type: "array", cellFormula: true, cellDates: false, cellStyles: true, bookFiles: true, bookVBA: true }); }
    catch { fail("XLSX_PARSE_FAILED"); }
    return parseWorkbook(workbook, await hash(bytes));
  }
  const validStamp = value => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
  function contextError(context, now) {
    if (!context || !context.expected || !["development", "production"].includes(context.environment)) return "CONTEXT_REQUIRED";
    for (const key of ["environment", "projectFingerprint", "branchId", "revision"]) {
      if (!text(context[key]) || context[key] !== context.expected[key]) return "TARGET_OR_REVISION_MISMATCH";
    }
    if (!validStamp(now) || !validStamp(context.expiresAt) || Date.parse(now) >= Date.parse(context.expiresAt)) return "STALE_PREVIEW";
    if (context.snapshotComplete !== true || context.policy?.confirmed !== true || context.policy.timezone !== "Asia/Seoul" || !["skip", "hold"].includes(context.policy.closureMode)) return "POLICY_UNCONFIRMED";
    for (const key of ["members", "coaches", "products", "tickets", "reservations", "availability", "closures", "receipts"]) {
      if (!Array.isArray(context[key])) return "SNAPSHOT_INCOMPLETE";
    }
    for (const key of ["members", "coaches", "products", "tickets", "reservations"]) {
      if (context[key].some(item => !text(item.id) || !text(item.branchId)) || new Set(context[key].map(item => item.id)).size !== context[key].length) return "SNAPSHOT_AMBIGUOUS";
    }
    if (context.members.some(m => !phone(m.phone)) || context.tickets.some(t => !t.memberId || !t.coachId || !t.productId || !["active", "expired", "void", "cancelled"].includes(t.status))) return "SNAPSHOT_INVALID";
    if (context.reservations.some(r => !date(r.date) || !time(r.time) || !Number.isInteger(r.durationMinutes) || r.durationMinutes <= 0 || !r.coachId || !Array.isArray(r.memberIds) || !["scheduled", "completed", "absence", "no_show", "cancelled"].includes(r.status))) return "SNAPSHOT_INVALID";
    if (context.availability.some(a => !a.branchId || !a.coachId || !Array.isArray(a.days) || a.days.some(d => !DAYS.includes(d)) || !time(a.start) || !time(a.end) || a.start >= a.end || (a.from && !date(a.from)) || (a.to && !date(a.to)))) return "SNAPSHOT_INVALID";
    if (context.closures.some(c => !c.branchId || !date(c.date)) || context.receipts.some(r => !/^[a-f0-9]{64}$/.test(r.operationKey || "") || r.status !== "applied" || r.branchId !== context.branchId)) return "SNAPSHOT_INVALID";
    return null;
  }
  function overlaps(a, b) { return a.date === b.date && minutes(a.time) < minutes(b.time) + b.durationMinutes && minutes(b.time) < minutes(a.time) + a.durationMinutes; }
  function planUnit(unit, context, now) {
    const first = unit[0];
    const product = first.product;
    // Same ceil(duration / ticketDuration) meaning as existing lessonTicketUnits.
    const units = Math.max(1, Math.ceil(product.lessonMinutes / product.unitMinutes));
    const remaining = first.source.total - first.source.used;
    const required = remaining / units;
    const start = Date.parse(`${first.source.startDate}T00:00:00Z`);
    const end = start + (product.validityDays - 1) * DAY;
    const today = Date.parse(`${new Date(Date.parse(now) + 9 * 3600000).toISOString().slice(0, 10)}T00:00:00Z`);
    if (end < today) return { error: "TICKET_PERIOD_EXPIRED" };
    if (!first.source.slots.length) return { plans: [], manual: true };
    if (remaining % units !== 0) return { error: "SESSION_UNIT_REMAINDER" };
    const plans = [];
    for (let cursor = Math.max(start, today); cursor <= end && plans.length < required; cursor += DAY) {
      const dt = new Date(cursor);
      const day = DAYS[dt.getUTCDay()];
      const dateValue = dt.toISOString().slice(0, 10);
      for (const slot of first.source.slots.filter(s => s.day === day)) {
        if (plans.length === required) break;
        if (Date.parse(`${dateValue}T${slot.time}:00+09:00`) <= Date.parse(now)) continue;
        const closed = context.closures.some(c => c.branchId === context.branchId && c.date === dateValue && (!c.coachId || c.coachId === first.coach.id));
        if (closed) { if (context.policy.closureMode === "hold") return { error: "CLOSED_DATE" }; continue; }
        if (minutes(slot.time) + product.lessonMinutes > 1440) return { error: "CROSS_DAY_SLOT" };
        const available = context.availability.some(a => a.branchId === context.branchId && a.coachId === first.coach.id && a.days.includes(day) && a.start <= slot.time && minutes(a.end) >= minutes(slot.time) + product.lessonMinutes && (!a.from || a.from <= dateValue) && (!a.to || a.to >= dateValue));
        if (!available) return { error: "AVAILABILITY_UNCONFIRMED" };
        const plan = { date: dateValue, time: slot.time, durationMinutes: product.lessonMinutes, unitsPerParticipant: units, participantRows: unit.map(r => r.source.rowNumber) };
        const conflict = context.reservations.some(r => r.status !== "cancelled" && overlaps(plan, r) && (r.coachId === first.coach.id || unit.some(u => u.member && r.memberIds.includes(u.member.id))));
        if (conflict || plans.some(p => overlaps(p, plan))) return { error: "SCHEDULE_CONFLICT" };
        plans.push(plan);
      }
    }
    return plans.length === required ? { plans, manual: false } : { error: "INSUFFICIENT_FUTURE_SLOTS" };
  }
  async function buildPreview(parsed, inputContext, now) {
    if (!parsedState.has(parsed)) fail("PARSED_INPUT_REQUIRED");
    const context = clone(inputContext || {});
    const error = contextError(context, now);
    const errors = [...parsed.errors, ...(error ? [error] : [])];
    const result = { contractVersion: VERSION, canApply: false, serverRevalidationRequired: true, errors, rows: [], plans: [] };
    previewState.set(result, { parsed, contextHash: null, identities: [] });
    if (errors.length) return frozen(result);
    const contextHash = await hash(canonical(context));
    const records = parsedState.get(parsed).map(source => ({ source, reasons: [...source.reasons], memberKind: null, ticketKind: null, plans: [], manual: false, replay: false }));
    const hold = (record, reason) => { if (!record.reasons.includes(reason)) record.reasons.push(reason); record.plans = []; record.manual = false; };
    for (const record of records) {
      const row = record.source;
      const members = context.members.filter(m => m.branchId === context.branchId && phone(m.phone) === row.phone);
      const coaches = context.coaches.filter(c => c.branchId === context.branchId && text(c.name) === row.coach && c.active === true);
      const products = context.products.filter(p => p.branchId === context.branchId && text(p.name) === row.product && p.active === true);
      if (members.length > 1) hold(record, "MEMBER_AMBIGUOUS");
      else { record.member = members[0]; record.memberKind = members.length ? "EXISTING" : "NEW"; }
      if (coaches.length !== 1) hold(record, "COACH_NOT_EXACT"); else record.coach = coaches[0];
      if (products.length !== 1) hold(record, "PRODUCT_NOT_EXACT"); else record.product = products[0];
      const product = record.product;
      if (product && (![1, 2].includes(product.groupSize) || ![20, 30, 40, 60].includes(product.lessonMinutes) || ![20, 30, 40, 60].includes(product.unitMinutes) || product.validityKind !== "days_inclusive" || !Number.isInteger(product.validityDays) || product.validityDays < 1 || product.validityDays > LIMITS.horizonDays)) hold(record, "PRODUCT_POLICY_UNCONFIRMED");
      if (record.reasons.length) continue;
      const tickets = context.tickets.filter(t => record.member && t.memberId === record.member.id && t.branchId === context.branchId && t.coachId === record.coach.id && t.productId === product.id && t.status === "active");
      record.ticketKind = tickets.length ? "RENEWAL_CANDIDATE" : "NEW_CANDIDATE";
      if (tickets.length > 1) hold(record, "ACTIVE_TICKET_AMBIGUOUS");
      else if (context.receipts.some(r => r.operationKey === row.operationKey)) record.replay = true;
      else if (tickets.length === 1) hold(record, "RENEWAL_SERVER_DECISION_REQUIRED");
      if (product.groupSize === 2 && !row.group) hold(record, "GROUP_CODE_REQUIRED");
      if (product.groupSize === 1 && row.group) hold(record, "GROUP_PRODUCT_MISMATCH");
    }
    const groups = new Map();
    for (const record of records) {
      const key = record.source.group ? `group:${record.source.group}` : `row:${record.source.rowNumber}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    const units = [...groups.values()];
    for (const unit of units) {
      const first = unit[0];
      if (first.source.group) {
        const signatures = unit.map(r => canonical([r.source.coach, r.source.product, r.source.startDate, r.source.total, r.source.used, r.source.slots]));
        if (unit.length !== 2 || new Set(unit.map(r => r.source.phone)).size !== 2 || new Set(signatures).size !== 1) unit.forEach(r => hold(r, "GROUP_MISMATCH"));
        if (unit.some(r => r.reasons.length)) unit.forEach(r => hold(r, "GROUP_ATOMIC_HOLD"));
        if (unit.some(r => r.replay) && !unit.every(r => r.replay)) unit.forEach(r => hold(r, "GROUP_REPLAY_MISMATCH"));
      }
      if (unit.some(r => r.reasons.length) || unit.every(r => r.replay)) continue;
      const plan = planUnit(unit, context, now);
      if (plan.error) unit.forEach(r => hold(r, plan.error));
      else unit.forEach(r => { r.plans = plan.plans; r.manual = plan.manual; });
    }
    // Compare proposed units before invalidating either one; never privilege file order.
    const conflicts = new Set();
    for (let i = 0; i < units.length; i += 1) for (let j = i + 1; j < units.length; j += 1) {
      const a = units[i], b = units[j];
      if (a[0].plans.some(x => b[0].plans.some(y => overlaps(x, y))) && (a[0].coach.id === b[0].coach.id || a.some(x => b.some(y => x.source.phone === y.source.phone)))) { conflicts.add(a); conflicts.add(b); }
    }
    for (const unit of conflicts) unit.forEach(r => hold(r, "PROPOSED_SCHEDULE_CONFLICT"));
    for (const record of records) {
      result.rows.push({ rowNumber: record.source.rowNumber, operationKey: record.source.operationKey, display: `행 ${record.source.rowNumber} · 식별정보 비공개`, status: record.reasons.length ? "HOLD" : record.replay ? "NO_OP" : "SERVER_REVIEW_REQUIRED", memberKind: record.memberKind, ticketKind: record.ticketKind, reasons: record.reasons, remaining: record.source.total === null || record.source.used === null ? null : record.source.total - record.source.used, manualSchedule: record.manual, plannedLessons: record.plans.length });
    }
    for (const unit of units) {
      const operationKey = await hash(canonical([VERSION, ...unit.map(r => r.source.operationKey).sort()]));
      for (const plan of unit[0].plans) result.plans.push({ ...plan, operationKey });
    }
    previewState.set(result, { parsed, contextHash, identities: records.map(r => r.source.phone) });
    return frozen(result);
  }
  async function checkFresh(preview, context, now) {
    const state = previewState.get(preview);
    if (!state?.contextHash || contextError(context, now) || preview.plans.some(p => Date.parse(`${p.date}T${p.time}:00+09:00`) <= Date.parse(now))) return { ok: false, reason: "STALE_PREVIEW", canApply: false };
    const same = state.contextHash === await hash(canonical(context));
    return { ok: same, reason: same ? "SERVER_REVALIDATION_REQUIRED" : "STALE_PREVIEW", canApply: false };
  }
  function safeSummary(preview) {
    if (!previewState.has(preview)) fail("PREVIEW_REQUIRED");
    const reasons = Object.create(null);
    for (const row of preview.rows) for (const reason of row.reasons) reasons[reason] = (reasons[reason] || 0) + 1;
    const identities = previewState.get(preview)?.identities || [];
    const members = kind => new Set(preview.rows.filter(r => r.status === "SERVER_REVIEW_REQUIRED" && r.memberKind === kind).map(r => identities[preview.rows.indexOf(r)])).size;
    return frozen({ contractVersion: VERSION, canApply: false, errors: preview.errors, totalRows: preview.rows.length, newMembers: members("NEW"), existingMembers: members("EXISTING"), newTickets: preview.rows.filter(r => r.status === "SERVER_REVIEW_REQUIRED" && r.ticketKind === "NEW_CANDIDATE").length, renewalCandidates: preview.rows.filter(r => r.ticketKind === "RENEWAL_CANDIDATE").length, plannedLessons: preview.plans.length, manualSchedule: preview.rows.filter(r => r.manualSchedule).length, holdRows: preview.rows.filter(r => r.status === "HOLD").length, noOpRows: preview.rows.filter(r => r.status === "NO_OP").length, reasons });
  }
  // Explicit ephemeral transport projection. Never return raw cells in presentation,
  // logs or storage; invalid groups travel as HOLD metadata, not partial input.
  async function serverUnits(parsed) {
    if (!parsedState.has(parsed) || parsed.errors.length) fail("PARSED_INPUT_REQUIRED");
    const groups = new Map();
    for (const row of parsedState.get(parsed)) {
      const key = row.group ? `group:${row.group}` : `row:${row.rowNumber}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const units = [], held = [];
    for (const rows of groups.values()) {
      const reasons = [...new Set(rows.flatMap(r => r.reasons))];
      if (rows[0].group && rows.length !== 2) reasons.push("GROUP_MISMATCH");
      if (reasons.length) { held.push(...rows.map(r => ({ rowNumber: r.rowNumber, reasons }))); continue; }
      units.push({ rowNumbers: rows.map(r => r.rowNumber), operationKey: await hash(canonical([VERSION, ...rows.map(r => r.operationKey).sort()])),
        unit: { rows: rows.map(({ name, phone, coach, product, startDate, total, used, group, slots }) => ({ name, phone, coach, product, startDate, total, used, group, slots })) } });
    }
    return { protocol: "local-synthetic/1", fileHash: parsed.fileHash, units, held };
  }
  return Object.freeze({ VERSION, SHEET, HEADERS, LIMITS, readFile, parseWorkbook, buildPreview, checkFresh, safeSummary, serverUnits });
});
