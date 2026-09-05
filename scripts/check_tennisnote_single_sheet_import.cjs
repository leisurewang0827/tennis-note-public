/* Synthetic in-memory fixtures only. Never print source cells or assertion values. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const api = require("../app/shared/tennisnote-single-sheet-import.js");
const XLSX = require("../app/shared/vendor/xlsx.full.min.js");
const modulePath = path.resolve(__dirname, "../app/shared/tennisnote-single-sheet-import.js");
let assertions = 0;
let scenarios = 0;
function check(condition, code) { assertions += 1; if (!condition) throw new Error(code); }
const copy = value => JSON.parse(JSON.stringify(value));
const NOW = "2030-01-07T00:00:00Z"; // Monday 09:00 KST; synthetic calendar, not live data.
const FILE_HASH = "a".repeat(64);
const syntheticPhone = n => "010" + String(n).padStart(8, "0");
function row(overrides = {}) {
  return { "회원명": "합성회원A", "연락처": syntheticPhone(1), "코치": "합성코치A", "회원권": "합성개인권", "시작일": "2030-01-07", "총횟수": 5, "사용횟수": 0, ...overrides };
}
function workbook(rows = [row()], headers = api.HEADERS.map(h => h + (api.HEADERS.indexOf(h) < 6 ? "*" : ""))) {
  const sheet = {};
  headers.forEach((value, index) => { sheet[XLSX.utils.encode_cell({ r: 0, c: index })] = { t: "s", v: value }; });
  rows.forEach((values, index) => {
    if (!values) return;
    headers.forEach((header, column) => {
      const value = values[header.replace(/\*$/, "")];
      if (value === undefined) return;
      sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })] = { t: typeof value === "number" ? "n" : "s", v: value };
    });
  });
  sheet["!ref"] = `A1:N${rows.length + 1}`;
  return { SheetNames: [api.SHEET], Sheets: { [api.SHEET]: sheet }, Workbook: { Sheets: [{ Hidden: 0 }], WBProps: {} } };
}
function context() {
  const scope = { environment: "development", projectFingerprint: "synthetic-project-fingerprint", branchId: "synthetic-branch", revision: "synthetic-revision-1" };
  return { ...scope, expected: { ...scope }, expiresAt: "2030-01-07T00:10:00Z", snapshotComplete: true,
    policy: { confirmed: true, timezone: "Asia/Seoul", closureMode: "skip" },
    members: [], coaches: [{ id: "synthetic-coach-a", branchId: scope.branchId, name: "합성코치A", active: true }],
    products: [{ id: "synthetic-product-a", branchId: scope.branchId, name: "합성개인권", active: true, groupSize: 1, lessonMinutes: 20, unitMinutes: 20, validityDays: 90, validityKind: "days_inclusive" }],
    tickets: [], reservations: [], availability: [{ branchId: scope.branchId, coachId: "synthetic-coach-a", days: ["월", "수", "금"], start: "09:00", end: "18:00" }], closures: [], receipts: [] };
}
const parse = wb => api.parseWorkbook(wb, FILE_HASH);
const preview = async (rows = [row()], ctx = context()) => api.buildPreview(await parse(workbook(rows)), ctx, NOW);
const withSlot = (overrides = {}) => row({ "요일1": "월", "시간1": "10:00", ...overrides });
const hasReason = (p, reason) => p.rows.some(r => r.reasons.includes(reason));
async function test(name, run) {
  try { await run(); scenarios += 1; process.stdout.write(`PASS ${name}\n`); }
  catch (error) { process.stderr.write(`FAIL ${name} code=${/^[A-Z_0-9]+$/.test(error.message) ? error.message : "UNEXPECTED_EXCEPTION"}\n`); process.exitCode = 1; throw error; }
}
async function rejection(action, code) {
  let actual = null;
  try { await action(); } catch (error) { actual = error.message; }
  check(actual === code, "REJECTION_CODE");
}
async function main() {
  await test("headers-star-order-and-physical-row", async () => {
    const result = await parse(workbook([null, row()], [...api.HEADERS].reverse().map(h => `${h}*`)));
    check(result.errors.length === 0, "HEADER_PARSE");
    check(result.rows.length === 1 && result.rows[0].rowNumber === 3, "PHYSICAL_ROW");
    check(result.rows[0].status === "PARSED", "PARSED_STATUS");
    check(!JSON.stringify(result).includes(syntheticPhone(1)) && !JSON.stringify(result).includes("합성회원A"), "PARSED_PRIVACY");
    check(result.canApply === false && Object.isFrozen(result.rows[0]), "PARSED_IMMUTABLE");
  });
  await test("file-schema-gates", async () => {
    const badName = workbook(); badName.SheetNames = ["다른시트"];
    check((await parse(badName)).errors.includes("SINGLE_SHEET_REQUIRED"), "SHEET_NAME");
    const extra = workbook(); extra.SheetNames.push("추가시트"); extra.Sheets["추가시트"] = {};
    check((await parse(extra)).errors.includes("SINGLE_SHEET_REQUIRED"), "EXTRA_SHEET");
    check((await parse(workbook([], api.HEADERS))).errors.includes("EMPTY_DATA"), "EMPTY_DATA");
    for (const [headers, code] of [[api.HEADERS.slice(1), "HEADER_MISSING"], [[...api.HEADERS.slice(0, -1), "회원명"], "HEADER_DUPLICATE"], [[...api.HEADERS.slice(0, -1), "미허용"], "HEADER_UNKNOWN"]]) {
      check((await parse(workbook([row()], headers))).errors.includes(code), "HEADER_GATE");
    }
    const fifth = workbook(); fifth.Sheets[api.SHEET].O1 = { t: "s", v: "요일4" };
    check((await parse(fifth)).errors.includes("ROW_OR_COLUMN_LIMIT"), "EXTRA_COLUMN");
    const missingOptional = workbook([row()], api.HEADERS.slice(0, 7)); missingOptional.Sheets[api.SHEET].H2 = { t: "s", v: "월" };
    check((await parse(missingOptional)).rows[0].reasons.includes("UNHEADED_CELL"), "UNHEADED_DATA");
  });
  await test("authoritative-blank-template", async () => {
    const template = api.buildTemplateWorkbook(XLSX);
    check(api.TEMPLATE_FILE_NAME.endsWith(".xlsx"), "TEMPLATE_XLSX_NAME");
    check(template.SheetNames.length === 1 && template.SheetNames[0] === api.SHEET && Object.keys(template.Sheets).length === 1, "TEMPLATE_SINGLE_SHEET");
    const sheet = template.Sheets[api.SHEET];
    check(api.HEADERS.every((header, index) => sheet[XLSX.utils.encode_cell({ r: 0, c: index })]?.v === header), "TEMPLATE_EXACT_HEADERS");
    check(sheet.B2?.t === "s" && sheet.B2?.v === "" && sheet.B2?.z === "@" && sheet.B501?.z === "@", "TEMPLATE_PHONE_TEXT_COLUMN");
    check(!Object.entries(sheet).some(([key, cell]) => /^[A-Z]+\d+$/.test(key) && (cell?.f != null || cell?.F != null || cell?.l != null || cell?.t === "e")), "TEMPLATE_FORMULA_LINK_ERROR_ZERO");
    const bytes = XLSX.write(template, { type: "buffer", bookType: "xlsx", compression: true });
    const parsed = await api.readFile(new Uint8Array(bytes), XLSX);
    check(parsed.errors.length === 1 && parsed.errors[0] === "EMPTY_DATA" && parsed.rows.length === 0, "TEMPLATE_SERIALIZED_EMPTY_ACCEPTED");
  });
  await test("bounds-500-and-501", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => row({ "연락처": syntheticPhone(i + 1) }));
    check((await parse(workbook(rows))).rows.length === 500, "MAX_ROWS_ACCEPTED");
    check((await parse(workbook([...rows, row()]))).errors.includes("ROW_LIMIT"), "MAX_ROWS_REJECTED");
    const far = workbook(); far.Sheets[api.SHEET].A999999 = { t: "s", v: "합성" };
    check((await parse(far)).errors.includes("ROW_OR_COLUMN_LIMIT"), "FAR_ROW_BOUND");
    await rejection(() => api.readFile(new Uint8Array(), XLSX), "FILE_SIZE_INVALID");
    await rejection(() => api.readFile(new TextEncoder().encode("not-an-xlsx"), XLSX), "XLSX_REQUIRED");
    await rejection(() => api.readFile(new Uint8Array(api.LIMITS.bytes + 1), XLSX), "FILE_SIZE_INVALID");
  });
  await test("formula-link-hidden-external-rejection", async () => {
    for (const mutation of [c => { c.f = "1+1"; }, c => { c.F = "A2:A3"; }, c => { c.l = { Target: "https://example.invalid" }; }, c => { c.t = "e"; }]) {
      const wb = workbook(); mutation(wb.Sheets[api.SHEET].F2);
      check((await parse(wb)).rows[0].reasons.includes("FORMULA_OR_LINK_FORBIDDEN"), "UNSAFE_CELL");
    }
    for (const mutation of [w => { w.vbaraw = [1]; }, w => { w.files = { "xl/externalLinks/externalLink1.xml": {} }; }, w => { w.Workbook.Names = [{ Name: "synthetic" }]; }, w => { w.Workbook.Sheets[0].Hidden = 1; }]) {
      const wb = workbook(); mutation(wb); check((await parse(wb)).errors.includes("WORKBOOK_UNSAFE"), "UNSAFE_WORKBOOK");
    }
    const hidden = workbook(); hidden.Sheets[api.SHEET]["!rows"] = [{}, { hidden: true }];
    check((await parse(hidden)).errors.includes("HIDDEN_OR_MERGED_CELLS"), "HIDDEN_ROW");
  });
  await test("phone-date-time-count-normalization", async () => {
    const serial = (Date.parse("2030-01-07T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000;
    const a = await parse(workbook([withSlot()]));
    const b = await parse(workbook([withSlot({ "연락처": "+82 10-0000-0001", "시작일": serial, "시간1": 10 / 24, "요일1": "월요일" })]));
    check(a.rows[0].rowHash === b.rows[0].rowHash, "NORMALIZED_HASH");
    const wb = workbook([withSlot({ "시작일": serial - 1462 })]); wb.Workbook.WBProps.date1904 = true;
    check((await parse(wb)).rows[0].rowHash === a.rows[0].rowHash, "EPOCH_1904");
    for (const [changes, reason] of [[{ "연락처": 1000000001 }, "PHONE_TEXT_REQUIRED"], [{ "연락처": "1e10" }, "PHONE_INVALID"], [{ "시작일": "2030-02-30" }, "DATE_INVALID"], [{ "시작일": 60 }, "DATE_INVALID"], [{ "시작일": "01/07/2030" }, "DATE_INVALID"], [{ "시간1": "24:00" }, "SLOT_INVALID"], [{ "시간1": "10:00:30" }, "SLOT_INVALID"], [{ "총횟수": -1 }, "SESSION_COUNTS_INVALID"], [{ "총횟수": 2.5 }, "SESSION_COUNTS_INVALID"], [{ "사용횟수": 6 }, "SESSION_COUNTS_INVALID"], [{ "사용횟수": "" }, "REQUIRED_VALUE_MISSING"], [{ "회원명": "<synthetic>" }, "TEXT_UNSAFE"]]) {
      check(hasReason(await preview([withSlot(changes)]), reason), "NORMALIZATION_REJECT");
    }
  });
  await test("no-slots-manual-and-partial-slot-hold", async () => {
    const p = await preview(); const s = api.safeSummary(p);
    check(s.newMembers === 1 && s.newTickets === 1 && s.manualSchedule === 1 && s.plannedLessons === 0, "MANUAL_PLAN");
    check(p.canApply === false && p.rows[0].status === "SERVER_REVIEW_REQUIRED", "NOT_AUTHORITY");
    check(hasReason(await preview([row({ "요일1": "월" })]), "SLOT_PAIR_INCOMPLETE"), "HALF_PAIR");
    check(hasReason(await preview([withSlot({ "요일2": "월", "시간2": "10:00" })]), "SLOT_DUPLICATE"), "DUPLICATE_SLOT");
  });
  await test("future-remaining-three-slots-and-unit-meaning", async () => {
    const p = await preview([withSlot({ "사용횟수": 2, "요일2": "수", "시간2": "11:00", "요일3": "금", "시간3": "12:00" })]);
    check(p.plans.length === 3 && p.rows[0].remaining === 3, "REMAINING_COUNT");
    check(p.plans.map(p => p.date).join() === "2030-01-07,2030-01-09,2030-01-11", "ORDERED_FUTURE");
    const sameDayPast = await preview([withSlot({ "시간1": "09:00" })]);
    check(sameDayPast.plans[0].date === "2030-01-14", "NO_PAST_OR_NOW");
    const c = context(); c.products[0].lessonMinutes = 40;
    const two = await preview([withSlot({ "총횟수": 4 })], c);
    check(two.plans.length === 2 && two.plans.every(p => p.unitsPerParticipant === 2), "FORTY_OVER_TWENTY");
    check(hasReason(await preview([withSlot()], c), "SESSION_UNIT_REMAINDER"), "NO_PARTIAL_UNIT");
    c.products[0].unitMinutes = 40;
    check((await preview([withSlot()], c)).plans.length === 5, "FORTY_OVER_FORTY");
    check((await preview([withSlot({ "사용횟수": 5 })])).plans.length === 0, "ZERO_BALANCE");
  });
  await test("exact-branch-identity-coach-product-ticket", async () => {
    const c = context(); c.members.push({ id: "synthetic-member-a", branchId: c.branchId, phone: syntheticPhone(1) });
    check(api.safeSummary(await preview([row()], c)).existingMembers === 1, "EXACT_MEMBER");
    c.members.push({ ...c.members[0], id: "synthetic-member-b" });
    check(hasReason(await preview([row()], c), "MEMBER_AMBIGUOUS"), "MULTIPLE_MEMBER");
    c.members.pop(); c.tickets.push({ id: "synthetic-ticket-a", branchId: c.branchId, memberId: c.members[0].id, coachId: c.coaches[0].id, productId: c.products[0].id, status: "active", total: 4, used: 4 });
    const before = JSON.stringify(c); const renewal = await preview([withSlot()], c);
    check(hasReason(renewal, "RENEWAL_SERVER_DECISION_REQUIRED") && renewal.plans.length === 0, "RENEWAL_HOLD");
    check(JSON.stringify(c) === before, "HISTORY_PRESERVED");
    c.tickets.push({ ...c.tickets[0], id: "synthetic-ticket-b" });
    check(hasReason(await preview([withSlot()], c), "ACTIVE_TICKET_AMBIGUOUS"), "MULTIPLE_TICKET");
    c.tickets = [{ ...c.tickets[0], coachId: "synthetic-other-coach" }];
    check((await preview([withSlot()], c)).rows[0].ticketKind === "NEW_CANDIDATE", "NO_OTHER_COACH_RENEWAL");
    c.coaches[0].branchId = "synthetic-other-branch";
    check(hasReason(await preview([row()], c), "COACH_NOT_EXACT"), "BRANCH_EXACT");
    const p = context(); p.products.push({ ...p.products[0], id: "synthetic-product-b" });
    check(hasReason(await preview([row()], p), "PRODUCT_NOT_EXACT"), "PRODUCT_AMBIGUOUS");
  });
  await test("period-closure-availability-no-partial", async () => {
    const c = context(); c.closures = [{ branchId: c.branchId, date: "2030-01-07" }];
    check((await preview([withSlot()], c)).plans[0].date === "2030-01-14", "CLOSURE_SKIP_EXPLICIT");
    c.policy.closureMode = "hold";
    check(hasReason(await preview([withSlot()], c), "CLOSED_DATE"), "CLOSURE_HOLD");
    c.closures = []; c.availability = [];
    check(hasReason(await preview([withSlot()], c), "AVAILABILITY_UNCONFIRMED"), "NO_AVAILABILITY");
    const short = context(); short.products[0].validityDays = 1;
    const p = await preview([withSlot()], short);
    check(hasReason(p, "INSUFFICIENT_FUTURE_SLOTS") && p.plans.length === 0, "NO_PARTIAL_PLAN");
    check(hasReason(await preview([row({ "시작일": "2029-01-01" })]), "TICKET_PERIOD_EXPIRED"), "EXPIRED_MANUAL_HOLD");
  });
  await test("existing-and-proposed-reservation-conflicts", async () => {
    const c = context(); c.reservations = [{ id: "synthetic-lesson", branchId: c.branchId, date: "2030-01-14", time: "10:00", durationMinutes: 20, coachId: c.coaches[0].id, memberIds: [], status: "scheduled" }];
    const p = await preview([withSlot()], c);
    check(hasReason(p, "SCHEDULE_CONFLICT") && p.plans.length === 0, "EXISTING_CONFLICT_ALL_OR_NONE");
    c.reservations[0].status = "cancelled";
    check((await preview([withSlot()], c)).plans.length === 5, "CANCELLED_EXCLUDED");
    const two = await preview([withSlot(), withSlot({ "회원명": "합성회원B", "연락처": syntheticPhone(2) })]);
    check(two.rows.every(r => r.reasons.includes("PROPOSED_SCHEDULE_CONFLICT")) && two.plans.length === 0, "BOTH_ROWS_HOLD");
    c.reservations[0].status = "unrecognized";
    check((await preview([withSlot()], c)).errors.includes("SNAPSHOT_INVALID"), "UNKNOWN_RESERVATION_STATE");
  });
  await test("group-explicit-reciprocal-atomic", async () => {
    const c = context(); c.products[0].groupSize = 2;
    const rows = [withSlot({ "그룹코드": "합성그룹" }), withSlot({ "회원명": "합성회원B", "연락처": syntheticPhone(2), "그룹코드": "합성그룹" })];
    const p = await preview(rows, c);
    check(p.rows.every(r => r.status === "SERVER_REVIEW_REQUIRED") && p.plans.length === 5, "GROUP_SHARED_FIVE_NOT_TEN");
    check(p.plans.every(p => p.participantRows.length === 2), "GROUP_PARTICIPANTS");
    for (const changes of [{ "사용횟수": 1 }, { "시간1": "11:00" }, { "연락처": "" }, { "시작일": "2030-01-08" }]) {
      const bad = await preview([rows[0], { ...rows[1], ...changes }], c);
      check(bad.rows.every(r => r.status === "HOLD") && bad.plans.length === 0, "GROUP_ALL_HOLD");
    }
    check(hasReason(await preview([withSlot()], c), "GROUP_CODE_REQUIRED"), "NO_IMPLICIT_GROUP");
    const single = await preview([rows[0]], c);
    check(hasReason(single, "GROUP_MISMATCH"), "GROUP_PARTNER_MISSING");
  });
  await test("stable-operations-replay-and-context-stale", async () => {
    const wb = workbook([withSlot()]);
    const a = await parse(wb), b = await parse(wb);
    check(a.rows[0].operationKey === b.rows[0].operationKey, "SAME_FILE_OPERATION");
    const moved = await parse(workbook([null, withSlot()]));
    check(a.rows[0].operationKey !== moved.rows[0].operationKey, "PHYSICAL_PROVENANCE");
    const c = context(); c.receipts.push({ operationKey: a.rows[0].operationKey, status: "applied", branchId: c.branchId });
    const p = await api.buildPreview(a, c, NOW);
    check(p.rows[0].status === "NO_OP" && p.plans.length === 0 && api.safeSummary(p).newTickets === 0, "REPLAY_NO_CREATE");
    const live = await api.buildPreview(a, context(), NOW);
    check((await api.checkFresh(live, context(), NOW)).ok, "FRESH_CONTEXT");
    const changed = context(); changed.coaches[0].active = false;
    check(!(await api.checkFresh(live, changed, NOW)).ok, "CONTENT_DRIFT_SAME_REVISION");
    check(!(await api.checkFresh(live, context(), "2030-01-07T00:10:00Z")).ok, "EXPIRY_BOUNDARY");
    for (const key of ["environment", "projectFingerprint", "branchId", "revision"]) {
      const mismatch = context(); mismatch[key] = "wrong";
      const blocked = await preview([row()], mismatch);
      check(blocked.errors.length > 0 && blocked.rows.length === 0, "TARGET_FAIL_CLOSED");
    }
    check((await api.checkFresh(live, context(), NOW)).canApply === false, "NEVER_APPLY");
  });
  await test("privacy-and-no-network-browser-global", async () => {
    const source = fs.readFileSync(modulePath, "utf8");
    check(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage)\s*[.(]|\.rpc\s*\(/.test(source), "NO_NETWORK_STORAGE");
    const sandbox = { TextEncoder, crypto: webcrypto };
    vm.runInNewContext(source, sandbox, { timeout: 2000 });
    const browserApi = sandbox.TennisNoteSingleSheetImport;
    check(browserApi.VERSION === api.VERSION, "UMD_BROWSER_ENTRY");
    const p = await browserApi.buildPreview(await browserApi.parseWorkbook(workbook([withSlot()]), FILE_HASH), context(), NOW);
    check(p.plans.length === 5 && p.canApply === false, "BROWSER_GLOBAL_EXECUTED");
    const serialized = JSON.stringify(browserApi.safeSummary(p));
    check(!serialized.includes(syntheticPhone(1)) && !/합성회원|합성코치|synthetic-branch/.test(serialized), "SAFE_SUMMARY");
    check(!JSON.stringify(p).includes(syntheticPhone(1)) && !JSON.stringify(p).includes("합성회원A"), "PUBLIC_PREVIEW_PRIVACY");
    await rejection(() => api.buildPreview({ rows: [], errors: [] }, context(), NOW), "PARSED_INPUT_REQUIRED");
    await rejection(() => api.safeSummary(copy(p)), "PREVIEW_REQUIRED");
  });
  await test("additional-identity-group-replay-and-resource-gates", async () => {
    const c = context(); c.products.push({ ...c.products[0], id: "synthetic-product-b", name: "합성다른권" });
    const mismatch = await preview([row(), row({ "회원명": "합성다른이름", "회원권": "합성다른권" })], c);
    check(mismatch.rows.every(r => r.reasons.includes("IDENTITY_NAME_CONFLICT")), "SAME_PHONE_DIFFERENT_NAME");
    check((await preview([row(), row()], c)).rows.every(r => r.reasons.includes("DUPLICATE_TICKET_INTENT")), "DUPLICATE_INTENT_ALL_HOLD");
    c.products[0].groupSize = 2;
    const group = await parse(workbook([withSlot({ "그룹코드": "합성그룹" }), withSlot({ "회원명": "합성회원B", "연락처": syntheticPhone(2), "그룹코드": "합성그룹" })]));
    c.receipts.push({ operationKey: group.rows[0].operationKey, status: "applied", branchId: c.branchId });
    const partial = await api.buildPreview(group, c, NOW);
    check(partial.rows.every(r => r.status === "HOLD") && partial.plans.length === 0, "PARTIAL_GROUP_RECEIPT_HOLD");
    c.receipts.push({ operationKey: group.rows[1].operationKey, status: "applied", branchId: c.branchId });
    const replay = await api.buildPreview(group, c, NOW);
    check(api.safeSummary(replay).noOpRows === 2 && replay.plans.length === 0, "GROUP_REPLAY_ZERO_PLAN");
    const duplicate = context(); duplicate.coaches.push(copy(duplicate.coaches[0]));
    check((await preview([row()], duplicate)).errors.includes("SNAPSHOT_AMBIGUOUS"), "DUPLICATE_SNAPSHOT_ID");
    const incomplete = context(); delete incomplete.closures;
    check((await preview([row()], incomplete)).errors.includes("SNAPSHOT_INCOMPLETE"), "ABSENT_NOT_EMPTY");
    const unknown = context(); delete unknown.products[0].validityKind;
    check(hasReason(await preview([row()], unknown), "PRODUCT_POLICY_UNCONFIRMED"), "NO_PERIOD_GUESS");
  });
  await test("slot-passed-during-preview-and-manual-unit", async () => {
    const p = await preview([withSlot({ "시간1": "09:05" })]);
    check(!(await api.checkFresh(p, context(), "2030-01-07T00:06:00Z")).ok, "PASSED_SLOT_STALE");
    const c = context(); c.products[0].lessonMinutes = 40;
    check((await preview([row()], c)).rows[0].manualSchedule, "MANUAL_NO_PARTIAL_AUTO_PLAN");
    const blocked = await preview([row()], {});
    check(api.safeSummary(blocked).errors.length > 0 && !(await api.checkFresh(blocked, context(), NOW)).ok, "BLOCKED_SUMMARY_FRESHNESS");
  });
  await test("existing-session-unit-contract-and-determinism", async () => {
    const app = fs.readFileSync(path.resolve(__dirname, "../app/admin/domain/lessons.js"), "utf8");
    const body = app.match(/function lessonTicketUnits\(lesson, ticket\) \{[\s\S]*?\n\}/)?.[0];
    check(Boolean(body), "EXISTING_UNIT_CONTRACT_FOUND");
    const reference = vm.runInNewContext(`(${body})`, { getTicketDurationMinutes: t => t.durationMinutes });
    for (const lessonMinutes of [20, 30, 40, 60]) for (const unitMinutes of [20, 30, 40, 60]) {
      const c = context(); c.products[0].lessonMinutes = lessonMinutes; c.products[0].unitMinutes = unitMinutes;
      const units = reference({ durationMinutes: lessonMinutes }, { durationMinutes: unitMinutes });
      const p = await preview([withSlot({ "총횟수": 6 * units })], c);
      check(p.plans.length === 6 && p.plans.every(p => p.unitsPerParticipant === units), "UNIT_PARITY_MATRIX");
    }
    const parsed = await parse(workbook([withSlot()])); const c = context(); const before = JSON.stringify(c);
    const [one, two] = await Promise.all([api.buildPreview(parsed, c, NOW), api.buildPreview(parsed, c, NOW)]);
    check(JSON.stringify(one) === JSON.stringify(two) && JSON.stringify(c) === before, "PARALLEL_PURE_PREVIEW");
    check(one.canApply === false && two.canApply === false, "NO_TRANSACTION_CLAIM");
  });
  // Optional read-only contract check against the user's existing blank template.
  if (process.argv[2]) await test("existing-blank-template-reader", async () => {
    const bytes = fs.readFileSync(process.argv[2]);
    const parsed = await api.readFile(new Uint8Array(bytes), XLSX);
    check(parsed.errors.length === 1 && parsed.errors[0] === "EMPTY_DATA", "TEMPLATE_SCHEMA_SUPPORTED");
    check(parsed.rows.length === 0, "TEMPLATE_STILL_BLANK");
  });
  process.stdout.write(`SINGLE_SHEET_PREVIEW_PASS scenarios=${scenarios} assertions=${assertions} database=0 network=0 apply=0\n`);
}
main().catch(() => { process.exitCode = 1; });
