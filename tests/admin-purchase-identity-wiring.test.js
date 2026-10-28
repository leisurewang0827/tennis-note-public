import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

// 실제 submit 본문을 실행하는 합성 RPC fixture. 네트워크·DB·금융 호출 없음.
const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const publicSource = read("app/admin/actions/member.js") + "\n" + read("app/admin/domain/members.js");
const privateSource = process.env.TENNISNOTE_PRIVATE_ADMIN_SOURCE
  ? readFileSync(process.env.TENNISNOTE_PRIVATE_ADMIN_SOURCE, "utf8").replace(/\r\n/g, "\n") : null;
const sources = [["public", publicSource], ...(privateSource ? [["private", privateSource]] : [])];
function extract(source, name) {
  const result = source.match(new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^}`, "m"));
  assert.ok(result, `source function: ${name}`);
  return result[0];
}
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(source, options = {}) {
  const action = options.action || "create";
  const trace = [], readbacks = [], messages = [];
  const button = { disabled: false, textContent: "등록 확정" };
  const message = { textContent: "" };
  const modal = { hidden: false };
  const form = {
    isConnected: true, dataset: {}, values: { memberName: "합성 대상", productId: "synthetic-product" },
    elements: { productId: { value: "synthetic-product" } },
    querySelector: () => button,
  };
  const runtime = { token: "synthetic-session", branch: "synthetic-branch", previews: 0, saves: 0, confirmations: 0, closed: false };
  const record = {
    branchId: runtime.branch, userId: action === "create" ? null : "synthetic-member",
    productId: "synthetic-product", name: "합성 대상", phone: "synthetic-contact",
    createWithoutSchedule: Boolean(options.deferred),
    ...(options.existingPayment ? { existingPaymentId: "synthetic-payment" } : {}),
  };
  const schedules = [{ dayOfWeek: 2, startTime: "synthetic-slot", coachRoleId: "synthetic-coach" }];
  const context = {
    window: {}, JSON,
    FormData: class { constructor(f) { this.form = f; } entries() { return Object.entries(this.form.values); } },
    members: [{ id: 1, serverUserId: "synthetic-member" }], tickets: [], expiredTickets: [],
    state: {}, adminImportAuthState: { profile: { id: "synthetic-admin", role: "admin" } },
    memberManagementModalState: { action, memberId: action === "create" ? null : 1, purchaseTargetUserId: "synthetic-member" },
    adminLiveDataState: { products: [{ id: record.productId, group_size: options.group ? 2 : 1 }] },
    $: selector => ({ "#memberManagementForm": form, "#memberManagementModal": modal, "#memberManagementMessage": message })[selector],
    $$: () => [], activeOperationBranchId: () => runtime.branch,
    memberManagementActionAllowed: () => true, validateRequiredMemberProfile: () => true,
    syncMemberManagementBalance() {}, syncMemberManagementPaymentFields() {}, normalizeMemberManagementTicketPayload() {},
    automaticMemberManagementReason: () => "synthetic-reason", memberManagementDatabasePayload: () => record,
    memberInlineScheduleValues: () => schedules, createMemberChangeBatchId: () => "synthetic-operation-key",
    resolveManualRegistrationMember: async () => {
      if (options.resolveHook) await options.resolveHook(context, runtime, form);
      return options.existingMember ? { id: "synthetic-member", name: record.name, phone: record.phone } : null;
    },
    normalizedRpcResult: value => Array.isArray(value) ? value[0] || {} : value || {},
    syncAdminLiveData: async (...args) => { readbacks.push(plain(args)); return true; },
    memberManagementWriteVerification: () => "",
    closeMemberManagementModal: () => { runtime.closed = true; modal.hidden = true; },
    renderMembers() {}, memberManagementActionLabel: () => "회원권 추가",
    memberManagementProductSupportsRegularSchedule: () => true,
    showToast: value => messages.push(value),
  };
  context.window.confirm = () => { runtime.confirmations++; return options.confirm !== false; };
  context.window.TennisNoteDataClient = {
    getSession: () => runtime.token ? { access_token: runtime.token } : null,
    rpc: async (name, args, config) => {
      trace.push({ name, args: plain(args), config: plain(config || {}) });
      if (name === "tn_admin_preview_purchase_identity") {
        runtime.previews++;
        if (options.previewHook) await options.previewHook(context, runtime, form, args, schedules);
        if (options.previewError) throw new Error(options.previewError);
        const response = {
          revision: "a".repeat(64), branchId: args.target_record.branchId, userId: args.target_record.userId,
          people: [{ providers: ["email"], phoneVerified: false, phoneMasked: null, identityTag: "b".repeat(8) }],
        };
        return options.response ? options.response(response) : response;
      }
      runtime.saves++;
      if (!args.target_record.identityProof) throw new Error("purchase_identity_proof_required");
      if (options.saveError) throw new Error(options.saveError);
      return { ok: true, userId: args.target_record.userId || "synthetic-member", ticketId: "synthetic-ticket" };
    },
  };
  vm.createContext(context);
  for (const name of ["onsitePurchaseIdentitySnapshot", "captureMemberPurchaseIdentityContext", "confirmMemberPurchaseIdentity", "memberManagementErrorText", "submitMemberManagementForm"]) {
    if (new RegExp(`function ${name}\\(`).test(source)) vm.runInContext(extract(source, name), context);
  }
  return { context, runtime, form, button, message, modal, record, schedules, trace, readbacks, messages,
    run: () => context.submitMemberManagementForm({ preventDefault() {}, target: form }) };
}

test("기존 공개 HEAD 재현: 대상 확인 누락으로 서버 proof_required", async () => {
  const baseline = execFileSync("git", ["show", "b18de04ee6e883ecf4f530aee678732fb5e0d783:app/admin/actions/member.js"], { cwd: root, encoding: "utf8" });
  const f = fixture(baseline + "\n" + read("app/admin/domain/members.js"));
  await f.run();
  assert.equal(f.runtime.previews, 0);
  assert.equal(f.runtime.saves, 1); // 합성 서버에서 거절: 실제 DB 쓰기 0.
  assert.equal(f.runtime.closed, false);
  assert.match(f.message.textContent, /업데이트/);
});

for (const [label, source] of sources) {
  for (const [name, options, kind, rpc] of [
    ["신규", {}, "create", "tn_admin_create_paid_member_and_regular_schedule"],
    ["기존 회원 발견", { existingMember: true }, "assign", "tn_admin_assign_paid_member_ticket_and_regular_schedule"],
    ["기존 그룹 발견", { existingMember: true, group: true }, "group", "tn_admin_assign_paid_group_member_ticket_and_regular_schedule"],
    ["회원권 추가", { action: "assign" }, "assign", "tn_admin_assign_paid_member_ticket_and_regular_schedule"],
    ["그룹 추가", { action: "assign", group: true }, "group", "tn_admin_assign_paid_group_member_ticket_and_regular_schedule"],
    ["기존 결제 연결", { action: "assign", existingPayment: true }, "assign", "tn_admin_assign_paid_member_ticket_and_regular_schedule"],
    ["시간표 추후 배정", { deferred: true }, "create", "tn_admin_create_paid_member_and_regular_schedule"],
  ]) test(`${label} ${name}: preview1→저장1·동일 요청/키·대상 readback`, async () => {
    const f = fixture(source, options);
    await Promise.all([f.run(), f.run()]);
    assert.equal(f.runtime.previews, 1); assert.equal(f.runtime.saves, 1);
    assert.equal(f.runtime.confirmations, 1); assert.equal(f.runtime.closed, true);
    assert.equal(f.form.dataset.purchaseSubmitting, undefined);
    const [preview, save] = f.trace;
    assert.equal(preview.args.target_kind, kind); assert.equal(save.name, rpc);
    const { identityProof, ...saved } = save.args.target_record;
    assert.equal(identityProof, "a".repeat(64)); assert.deepEqual(saved, preview.args.target_record);
    assert.deepEqual(save.args.target_schedules, preview.args.target_schedules);
    assert.equal(save.args.target_operation_key, preview.args.target_operation_key);
    for (const call of f.trace) assert.deepEqual(call.config, { requireCurrentSession: true, retryAuth: false });
    assert.equal(f.readbacks[0][1].memberWriteReadbackUserId, "synthetic-member");
    assert.equal(f.record.identityProof, undefined);
  });

  for (const [name, change] of [
    ["로그아웃", (_, r) => { r.token = ""; }],
    ["다른 세션", (_, r) => { r.token = "synthetic-new-session"; }],
    ["관리자 변경", c => { c.adminImportAuthState.profile.id = "synthetic-other-admin"; }],
    ["권한 해제", c => { c.adminImportAuthState.profile.role = "member"; }],
    ["지점 변경", (_, r) => { r.branch = "synthetic-other-branch"; }],
    ["다른 회원", c => { c.memberManagementModalState.memberId = 2; }],
    ["다른 작업", c => { c.memberManagementModalState.action = "profile"; }],
    ["폼 닫기", (_, __, f) => { f.isConnected = false; }],
    ["입력 변경", (_, __, f) => { f.values.memberName = "수정된 합성 대상"; }],
    ["요청 변경", (_, __, ___, args) => { args.target_record.productId = "synthetic-other-product"; }],
    ["시간표 변경", (_, __, ___, ____, slots) => { slots[0].dayOfWeek = 3; }],
  ]) test(`${label} 확인 도중 ${name}: 저장0·자동 재시도0`, async () => {
    const f = fixture(source, { previewHook: change });
    await f.run();
    assert.equal(f.runtime.previews, 1); assert.equal(f.runtime.saves, 0);
    assert.equal(f.runtime.closed, false); assert.equal(f.runtime.confirmations, 0);
    assert.equal(f.form.dataset.purchaseSubmitting, undefined);
    assert.match(f.message.textContent, /다시 선택/);
  });

  test(`${label} 기존 회원 검색 중 세션 변경: preview0·저장0`, async () => {
    const f = fixture(source, { existingMember: true, resolveHook: (_, r) => { r.token = "synthetic-other-session"; } });
    await f.run(); assert.equal(f.runtime.previews, 0); assert.equal(f.runtime.saves, 0);
  });
  test(`${label} 중복 local id: preview0·저장0`, async () => {
    const f = fixture(source, { action: "assign" });
    f.context.members.push({ id: 1, serverUserId: "synthetic-other-member" });
    await f.run(); assert.equal(f.runtime.previews, 0); assert.equal(f.runtime.saves, 0);
  });
  for (const [name, response] of [
    ["revision 누락", p => ({ ...p, revision: "" })],
    ["지점 불일치", p => ({ ...p, branchId: "synthetic-other-branch" })],
    ["대상 불일치", p => ({ ...p, userId: "synthetic-other-member" })],
    ["대상 없음", p => ({ ...p, people: [] })],
  ]) test(`${label} ${name}: 저장0`, async () => {
    const f = fixture(source, { response }); await f.run();
    assert.equal(f.runtime.previews, 1); assert.equal(f.runtime.saves, 0);
  });
  test(`${label} preview 오류·명시 재시도: 초안/키 보존·자동 저장0`, async () => {
    const options = { previewError: "purchase_identity_stale" };
    const f = fixture(source, options); await f.run();
    assert.equal(f.runtime.previews, 1); assert.equal(f.runtime.saves, 0);
    assert.equal(f.button.disabled, false); assert.equal(f.form.values.memberName, "합성 대상");
    const key = f.form.dataset.createOperationKey;
    options.previewError = ""; await f.run();
    assert.equal(f.runtime.previews, 2); assert.equal(f.runtime.saves, 1);
    assert.equal(f.trace.at(-1).args.target_operation_key, key);
  });
  test(`${label} 확인 취소: 저장0·초안 유지`, async () => {
    const f = fixture(source, { confirm: false }); await f.run();
    assert.equal(f.runtime.saves, 0); assert.equal(f.form.values.memberName, "합성 대상");
    assert.match(f.message.textContent, /입력값은 유지/);
  });
  for (const error of ["purchase_identity_stale", "purchase_identity_operation_conflict", "server_request_timeout"]) {
    test(`${label} 저장 ${error}: 재전송0·명시적 결과 확인`, async () => {
      const f = fixture(source, { saveError: error }); await f.run();
      assert.equal(f.runtime.previews, 1); assert.equal(f.runtime.saves, 1);
      assert.equal(f.runtime.closed, false); assert.equal(f.form.dataset.createOperationKey, "synthetic-operation-key");
      assert.equal(f.button.disabled, error === "server_request_timeout");
      assert.ok(f.message.textContent.length > 0);
    });
  }
}

test("공개 실행 entry·exact 원본 helper/호출 parity", { skip: !privateSource && "TENNISNOTE_PRIVATE_ADMIN_SOURCE로 원본 대조 필요" }, () => {
  for (const name of ["onsitePurchaseIdentitySnapshot", "captureMemberPurchaseIdentityContext", "confirmMemberPurchaseIdentity"]) {
    assert.equal(extract(publicSource, name), extract(privateSource, name));
  }
  const dispatch = source => {
    const submit = extract(source, "submitMemberManagementForm");
    const start = submit.indexOf("    if (isCreate) {", submit.indexOf("  try {"));
    return submit.slice(start, submit.indexOf('    } else if (action === "link_existing")', start));
  };
  assert.equal(dispatch(publicSource), dispatch(privateSource));
  assert.ok(read("app/admin/index.html").includes("actions/member.js?v="));
  assert.ok(read("app/admin/index.html").includes("events/delegated.js?v="));
  assert.ok(read("app/admin/app.js").includes("bindDelegatedEvents();"));
  assert.ok(read("app/admin/events/delegated.js").includes('if (event.target.id === "memberManagementForm") await submitMemberManagementForm(event);'));
  assert.match(read("app/admin/ui/member.js"), /purchaseTargetUserId: targetUserId/);
});
