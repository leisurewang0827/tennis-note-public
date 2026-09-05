/* Synthetic, memory-only input. Never print cells, identifiers or error values. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const snapshot = require("../app/shared/tennisnote-single-sheet-snapshot.js");
const zipGuard = require("../app/shared/tennisnote-single-sheet-worker.js");
const parser = require("../app/shared/tennisnote-single-sheet-import.js");
const XLSX = require("../app/shared/vendor/xlsx.full.min.js");
const scope = { environment: "development", projectFingerprint: "synthetic-project", branchId: "synthetic-branch" };
const expected = { ...scope, authorized: true };
const copy = value => structuredClone(value);
function packet(now = Date.now()) {
  const data = Object.fromEntries(Object.keys(snapshot.SOURCES).map(key => [key, []]));
  data.coaches = [{ id: "synthetic-coach", user_id: "synthetic-coach-profile", branch_id: scope.branchId, display_name: "합성코치", status: "approved", employment_status: "active" }];
  data.products = [{ id: "synthetic-product", branch_id: scope.branchId, name: "합성정규권", is_active: true, lesson_minutes: 20, group_size: 1, validity_days: 90, grace_days: 7 }];
  data.availability = Array.from({ length: 7 }, (_, day) => ({ coach_role_id: "synthetic-coach", day_of_week: day, start_time: "09:00:00", end_time: "18:00:00", availability_type: "available" }));
  return { scope: { ...scope }, reads: Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, { rows, totalCount: rows.length, complete: true, revision: "synthetic-revision" }])),
    proof: { before: "synthetic-revision", after: "synthetic-revision", scope: "all_import_dependencies", expiresAt: new Date(now + 300000).toISOString(), policy: "product_validity_plus_grace_inclusive", capacity: "complete_regular_constraints", closureMode: "skip" }, receipts: [] };
}
function workbookBytes(kind = "valid", now = Date.now()) {
  const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
  const syntheticPhone = "010" + String(1).padStart(8, "0");
  const row = ["합성회원", syntheticPhone, "합성코치", "합성정규권", tomorrow, 5, 0];
  if (kind === "slot") row.push(["일", "월", "화", "수", "목", "금", "토"][new Date(tomorrow + "T00:00:00Z").getUTCDay()], "10:00");
  if (kind === "group") { row.length = 13; row.push("합성그룹"); }
  if (kind === "long") row[0] = "<img src=x onerror=alert(1)>".repeat(12);
  const rows = kind === "empty" ? [] : [row];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([parser.HEADERS, ...rows]), parser.SHEET);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }));
}
// Minimal ZIP fixtures are memory buffers, never workbook files on disk.
function zip(entries, { sizeDelta = 0, crcDelta = 0, method = 8 } = {}) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, data] of entries) {
    const raw = Buffer.from(data), packed = method === 8 ? zlib.deflateRawSync(raw) : raw, n = Buffer.from(name);
    const crc = (zipGuard.crc32(raw) + crcDelta) >>> 0;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length + sizeDelta, 22); local.writeUInt16LE(n.length, 26);
    locals.push(local, n, packed);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(method, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(raw.length + sizeDelta, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42); centrals.push(c, n);
    offset += local.length + n.length + packed.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centrals.reduce((n, b) => n + b.length, 0), 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
async function main() {
  let assertions = 0, scenarios = 0;
  const check = (ok, code) => { assertions++; if (!ok) throw Error(code); };
  const run = async (name, fn) => { await fn(); scenarios++; process.stdout.write(`PASS ${name}\n`); };
  const reject = async (bytes, code) => { let result; try { await zipGuard.boundedZip(bytes); } catch (e) { result = e.message; } check(result === code, "ZIP_REJECTION"); };
  const now = new Date().toISOString();
  await run("snapshot-explicit-proof-and-sql-map", async () => {
    const p = packet(), good = snapshot.adapt(p, expected, now);
    check(good.errors.length === 0 && good.context && good.canApply === false, "COMPLETE_ENVELOPE");
    check(good.context.products[0].validityDays === 97 && good.context.products[0].unitMinutes === 20, "VALIDITY_UNITS");
    check(good.context.coaches[0].active && good.context.availability[0].days[0] === "일" && good.context.availability[0].start === "09:00", "ROLE_AVAILABILITY");
    const parsed = await parser.readFile(workbookBytes("slot"), XLSX);
    const preview = await parser.buildPreview(parsed, good.context, now);
    check(preview.plans.length === 5 && parser.safeSummary(preview).newTickets === 1, "ADAPTER_PARSER_PATH");
    check(preview.canApply === false, "NO_APPLY");
    const raw = Object.fromEntries(Object.entries(p.reads).map(([key, r]) => [key, r.rows])); raw.users.push({ id: "synthetic-profile", name: "합성", phone: "synthetic", secret: "DO_NOT_COPY", payment_amount: 123 });
    const captured = snapshot.captureExisting(raw, scope);
    check(!JSON.stringify(captured).includes("DO_NOT_COPY") && !JSON.stringify(captured).includes("payment_amount"), "PROJECTION_ONLY");
    const held = snapshot.adapt(captured, expected, now);
    check(held.context === null && held.errors.includes("REVISION_UNCONFIRMED") && held.errors.includes("SNAPSHOT_INCOMPLETE"), "ROSTER_NOT_FULL_SNAPSHOT");
  });
  await run("snapshot-missing-page-revision-scope-policy-receipt-fail-closed", async () => {
    for (const [change, code] of [
      [p => { p.scope.branchId = "other-synthetic"; }, "TARGET_OR_REVISION_MISMATCH"],
      [p => { p.scope.projectFingerprint = "other-synthetic"; }, "TARGET_OR_REVISION_MISMATCH"],
      [p => { p.proof.after = "changed"; }, "REVISION_UNCONFIRMED"],
      [p => { p.proof.scope = "schedule_only"; }, "REVISION_SCOPE_INCOMPLETE"],
      [p => { p.receipts = null; }, "IMPORT_RECEIPTS_UNAVAILABLE"],
      [p => { p.proof.capacity = null; }, "POLICY_UNCONFIRMED"],
      [p => { p.proof.expiresAt = new Date(Date.now() - 10000).toISOString(); }, "STALE_PREVIEW"],
    ]) { const p = packet(); change(p); const r = snapshot.adapt(p, expected, now); check(r.context === null && r.errors.includes(code) && !r.canApply, "SNAPSHOT_HOLD"); }
    for (const key of Object.keys(snapshot.SOURCES)) for (const field of ["complete", "totalCount", "revision"]) { const p = packet(); p.reads[key][field] = null; check(snapshot.adapt(p, expected, now).errors.includes("SNAPSHOT_INCOMPLETE"), "EACH_SOURCE_COVERAGE"); }
    check(snapshot.adapt(packet(), { ...expected, authorized: false }, now).errors.includes("ADMIN_SNAPSHOT_REQUIRED"), "AUTH_REQUIRED");
    check(snapshot.adapt(packet(), { ...expected, projectFingerprint: "" }, now).errors.includes("TARGET_UNVERIFIED"), "UNVERIFIED_NOT_MISMATCH");
  });
  await run("snapshot-participant-and-policy-unknown-no-guesses", async () => {
    for (const [key, row, code] of [
      ["memberRecords", { user_id: "unknown", branch_id: scope.branchId }, "IDENTITY_SCOPE_INCOMPLETE"],
      ["availability", { coach_role_id: "synthetic-coach", day_of_week: 1, availability_type: "blocked" }, "AVAILABILITY_POLICY_UNCONFIRMED"],
      ["tickets", { id: "synthetic-ticket", status: "paused" }, "TICKET_STATE_UNSUPPORTED"],
      ["lessons", { id: "synthetic-lesson", status: "scheduled" }, "PARTICIPANT_SCOPE_INCOMPLETE"],
      ["closures", { branch_id: scope.branchId, all_day: false, status: "active" }, "CLOSURE_POLICY_UNCONFIRMED"],
    ]) { const p = packet(); p.reads[key].rows.push(row); p.reads[key].totalCount++; const r = snapshot.adapt(p, expected, now); check(r.context === null && r.errors.includes(code), "UNSUPPORTED_POLICY_HOLD"); }
    const p = packet(); p.reads.products.rows[0].group_size = 2;
    check(snapshot.adapt(p, expected, now).errors.includes("GROUP_POLICY_SERVER_REQUIRED"), "GROUP_NO_INFERRED_POLICY");
    const digest = "a".repeat(64);
    const serverPacket = { contract: "single-sheet-server/2", scope, proof: { complete: true, scope: "unit_dependencies", statementBudgetMs: 10000, unitCount: 1, expiresAt: new Date(Date.now() + 60000).toISOString() }, units: [
      { status: "HOLD", reason: "SHEET_BATCH_CONFLICT", unitHash: digest, planHash: "b".repeat(64), revision: "c".repeat(64), rowCount: 1, newMembers: null, newTickets: null, newLessons: null },
    ] };
    const conflict = snapshot.adaptServer(serverPacket, expected, now);
    check(conflict.serverPreview?.units[0].reason.includes("양쪽 행") && conflict.serverPreview.units[0].reversible === false, "BATCH_CONFLICT_SAFE_REASON");
    serverPacket.units[0] = { status: "APPLIED", unitHash: digest, planHash: "b".repeat(64), revision: "c".repeat(64), rowCount: 1, newMembers: 0, newTickets: 0, newLessons: 0, verified: true, reversible: true };
    check(snapshot.adaptServer(serverPacket, expected, now).serverPreview?.units[0].reversible === true, "ACTOR_OWNED_RECEIPT_REVERSIBLE");
  });
  await run("zip-bounded-inflate-real-xlsx-roundtrip", async () => {
    const data = workbookBytes(), verified = await zipGuard.boundedZip(data);
    check(verified.entries > 1 && verified.inflatedBytes < zipGuard.LIMITS.inflatedBytes, "INFLATED_BUDGET");
    const wb = XLSX.read(verified.bytes, { type: "array" });
    check(wb.SheetNames[0] === parser.SHEET, "VERIFIED_VENDOR_PARSE");
    check(verified.bytes[8] === 0 && verified.bytes[9] === 0, "REPACK_STORE_ONLY");
  });
  await run("zip-adversarial-resource-and-structure-bounds", async () => {
    const minimal = [["[Content_Types].xml", "<Types/>"], ["xl/workbook.xml", "<workbook/>"]];
    await reject(new Uint8Array(0), "FILE_SIZE_INVALID");
    await reject(new Uint8Array(zipGuard.LIMITS.fileBytes + 1), "FILE_SIZE_INVALID");
    await reject(zip(minimal, { crcDelta: 1 }), "ZIP_CRC_MISMATCH");
    await reject(zip(minimal, { sizeDelta: -1 }), "ZIP_LIMIT");
    await reject(zip(minimal, { sizeDelta: 1 }), "ZIP_SIZE_MISMATCH");
    await reject(zip([...minimal, ["../outside", "bad"]]), "ZIP_STRUCTURE_INVALID");
    await reject(zip([...minimal, ["XL/WORKBOOK.XML", "duplicate"]]), "ZIP_STRUCTURE_INVALID");
    await reject(zip([...minimal, ["xl/bomb", Buffer.alloc(zipGuard.LIMITS.entryBytes + 1)]]), "ZIP_LIMIT");
    await reject(zip([...minimal, ...Array.from({ length: 255 }, (_, n) => [`part${n}`, "x"])]), "ZIP_STRUCTURE_INVALID");
    await reject(zip([...minimal, ...Array.from({ length: 4 }, (_, n) => [`part${n}`, Buffer.alloc(7 * 1024 * 1024)] )]), "ZIP_LIMIT");
    const oldDate = Date.now; let ticks = 0;
    try { Date.now = () => ticks++ ? 10001 : 0; await reject(zip(minimal), "PARSING_TIMEOUT"); } finally { Date.now = oldDate; }
    const oldDS = globalThis.DecompressionStream;
    try { globalThis.DecompressionStream = undefined; await reject(zip(minimal), "DECOMPRESSION_UNAVAILABLE"); } finally { globalThis.DecompressionStream = oldDS; }
  });
  await run("actual-entry-ci-and-no-write-boundary", async () => {
    const root = path.resolve(__dirname, "..");
    const html = fs.readFileSync(path.join(root, "app/admin/index.html"), "utf8");
    const actions = fs.readFileSync(path.join(root, "app/admin/actions/common.js"), "utf8");
    const events = fs.readFileSync(path.join(root, "app/admin/events/members.js"), "utf8");
    const permissions = fs.readFileSync(path.join(root, "app/admin/actions/settings.js"), "utf8");
    const app = fs.readFileSync(path.join(root, "app/admin/app.js"), "utf8");
    const client = fs.readFileSync(path.join(root, "app/shared/tennisnote-data-client.js"), "utf8");
    const transport = fs.readFileSync(path.join(root, "app/shared/tennisnote-single-sheet-transport.js"), "utf8");
    const builder = fs.readFileSync(path.join(root, "scripts/build_cloudflare_pages.py"), "utf8");
    check(html.includes('id="openSingleSheetPreviewButton"') && events.includes("bindSingleSheetPreviewEntry();") && actions.includes("function bindSingleSheetPreviewEntry") && actions.includes("TennisNoteExcelPreviewUI?.bind") && actions.includes("getSnapshot: singleSheetPreviewSnapshot") && actions.includes("getPreviewTransport: singleSheetRemotePreviewTransport") && actions.includes("function singleSheetRemotePreviewTransport") && app.includes("let adminSingleSheetReadSnapshot = null") && permissions.includes('"openSingleSheetPreviewButton"'), "ENTRY_BIND");
    check(html.indexOf("tennisnote-single-sheet-transport.js") > html.indexOf("tennisnote-single-sheet-batch.js") && html.indexOf("tennisnote-single-sheet-transport.js") < html.indexOf("tennisnote-single-sheet-preview-ui.js"), "TRANSPORT_LOAD_ORDER");
    check(client.includes("projectFingerprint: fileConfig.projectFingerprint") && client.includes("singleSheetImportMode: fileConfig.singleSheetImportMode") && client.includes("singleSheetImportReverseEnabled: fileConfig.singleSheetImportReverseEnabled") && client.includes("options.retryAuth === false") && client.includes("options.requireCurrentSession === true"), "DATA_CLIENT_SAFE_CONFIG_OPTIONS");
    check(builder.includes("TENNISNOTE_ENVIRONMENT") && builder.includes("TENNISNOTE_SINGLE_SHEET_IMPORT_MODE") && builder.includes("TENNISNOTE_SINGLE_SHEET_IMPORT_REVERSE_ENABLED") && builder.includes('project_fingerprint(env("TENNISNOTE_SUPABASE_URL"))'), "BROWSER_CONFIG_BUILD_PATH");
    check(transport.includes('"tn_preview_single_sheet_import"') && transport.includes('"tn_apply_single_sheet_import_unit"') && transport.includes('"tn_reverse_single_sheet_import_unit"'), "SCOPED_RPC_SET");
    check(transport.includes('singleSheetImportMode') && transport.includes('singleSheetImportReverseEnabled') && transport.includes('retryAuth: false'), "EXPLICIT_EXECUTION_CAPABILITIES");
    for (const file of ["snapshot", "preview-ui", "worker"]) {
      const source = fs.readFileSync(path.join(root, `app/shared/tennisnote-single-sheet-${file}.js`), "utf8");
      check(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB)\b|\.rpc\(/.test(source), "NO_NETWORK_STORAGE");
    }
    const verify = fs.readFileSync(path.join(root, "scripts/verify.sh"), "utf8");
    check(verify.includes("scripts/check_tennisnote_single_sheet_preview.py"), "VERIFY_REGISTRATION");
  });
  process.stdout.write(`Single sheet preview: ${scenarios} scenarios / ${assertions} assertions PASS\n`);
}
module.exports = { packet, expected, workbookBytes, zip };
if (require.main === module) main().catch(e => { process.stderr.write(`FAIL code=${/^[A-Z_0-9]+$/.test(e.message) ? e.message : "UNEXPECTED_EXCEPTION"}\n`); process.exitCode = 1; });
