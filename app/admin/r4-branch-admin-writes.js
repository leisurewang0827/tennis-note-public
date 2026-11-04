(function installR4BranchAdminWrites(root, document) {
  const branch = document.getElementById("r4ManagedBranch");
  const form = document.getElementById("r4BranchSaveForm");
  const status = document.getElementById("r4BranchSaveStatus");
  const setup = document.getElementById("r4FirstLessonSetup");
  const setupSubmit = setup?.querySelector('button[type="submit"]');
  if (!branch || !form || !status) return;
  const fields = form.elements;
  const submit = form.querySelector("button[type=submit]");
  const groups = [...form.querySelectorAll("[data-r4-write]")];
  const auth = Object.freeze({ requireCurrentSession: true, retryAuth: false });
  let client, actor, roster, state, pendingLesson, epoch = 0, saving = false;
  let setupBusy = false;
  const current = (stamp, branchId) => stamp === epoch && actor &&
    actor === client?.sessionSubject?.() && branch.value === branchId;
  const option = (value, name) => {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = name;
    return item;
  };
  const setOptions = (select, prompt, list) => select.replaceChildren(option("", prompt),
    ...list.map(({ id, name }) => option(id, name)));
  const ticket = () => roster?.tickets.find(row => row.id === fields.ticket.value);
  const singleLessonEligible = row => row?.status === "active" &&
    ["regular", "coupon"].includes(row.productKind) && [20, 30, 40, 60].includes(row.lessonMinutes);
  const paint = () => {
    const action = fields.action.value;
    const ticketReady = Boolean(state && ticket()?.id === state.ticketId);
    for (const group of groups) {
      group.hidden = group.dataset.r4Write !== action;
      group.disabled = group.hidden || !ticketReady || saving;
    }
    submit.disabled = saving || !ticketReady ||
      (action === "memo" && !state.membership) ||
      (action === "lesson" && (!singleLessonEligible(ticket()) || !fields.coach.value));
  };
  const clearTicket = () => {
    state = null;
    fields.memo.value = "";
    paint();
  };
  const rpc = (name, args) => client.rpc(name, args, auth);
  async function readTicket(branchId, ticketId) {
    const result = await rpc("tn_r4_get_ticket_write_state", { target_branch_id: branchId, target_ticket_id: ticketId });
    if (result?.branchId !== branchId || result.ticketId !== ticketId) {
      throw Error("r4_ticket_response_mismatch");
    }
    return result;
  }
  function showTicket(result) {
    state = result;
    fields.memo.value = state.membership?.memo || "";
    paint();
  }
  async function loadBranch() {
    const stamp = ++epoch, branchId = branch.value;
    roster = null;
    form.hidden = true;
    if (setup) {
      setup.hidden = true;
      setupSubmit.disabled = true;
      setup.reset();
    }
    clearTicket();
    status.textContent = "";
    if (!branchId || !current(stamp, branchId)) return;
    try {
      const result = await rpc("tn_r4_admin_save_options", { target_branch_id: branchId });
      if (!current(stamp, branchId)) return;
      if (result?.branchId !== branchId || !Array.isArray(result.tickets) || !Array.isArray(result.coaches)) {
        throw Error("r4_roster_response_mismatch");
      }
      roster = result;
      setOptions(fields.ticket, "회원권 선택", result.tickets.map(t => ({ id: t.id, name: t.name + " · " + t.productName })));
      setOptions(fields.coach, "코치 선택", result.coaches);
      form.hidden = !result.tickets.length;
      if (setup && form.hidden && !result.coaches.length && root.TennisNoteR4Onboarding?.ownsApprovedBranch(branchId)) {
        setup.hidden = false;
        setupSubmit.disabled = setupBusy;
      } else if (form.hidden) status.textContent = "이 지점에 표시할 회원권이 없습니다.";
    } catch {
      if (current(stamp, branchId)) status.textContent = "이 지점의 업무 자료를 조회할 수 없습니다.";
    }
  }
  async function loadTicket() {
    const stamp = ++epoch, branchId = branch.value, selected = ticket();
    clearTicket();
    status.textContent = "";
    if (!selected || !current(stamp, branchId) || roster.branchId !== branchId) return;
    status.textContent = "회원권을 불러오는 중입니다.";
    try {
      const result = await readTicket(branchId, selected.id);
      if (current(stamp, branchId) && ticket()?.id === selected.id) {
        showTicket(result);
        status.textContent = "";
      }
    } catch {
      if (current(stamp, branchId)) status.textContent = "회원권을 조회할 수 없습니다.";
    }
  }
  branch.addEventListener("change", loadBranch);
  setup?.addEventListener("submit", async event => {
    event.preventDefault();
    const branchId = branch.value, stamp = epoch, originalActor = actor;
    if (setupBusy || setup.hidden || setupSubmit.disabled || !current(stamp, branchId)
        || roster?.branchId !== branchId || roster.coaches.length || roster.tickets.length
        || !setup.reportValidity()) return;
    const names = ["coachName", "productName", "memberName"].map(name => setup.elements[name].value.trim());
    if (names.some(name => name.length < 2)) return;
    setupBusy = true;
    setupSubmit.disabled = true;
    status.textContent = "첫 수업 준비 결과를 확인하는 중입니다.";
    try {
      const saved = await rpc("tn_r4_initialize_first_lesson", {
        target_branch_id: branchId, target_coach_name: names[0], target_product_name: names[1], target_member_name: names[2],
      });
      if (!current(stamp, branchId)) return;
      if (saved?.branchId !== branchId || saved.paymentEnabled !== false ||
          !saved.ticketId || !saved.coachId || !saved.memberId || !saved.productId) throw Error("r4_setup_receipt");
      await loadBranch();
      if (actor !== originalActor || actor !== client?.sessionSubject?.() || branch.value !== branchId) return;
      if (!roster?.coaches.some(row => row.id === saved.coachId && row.name === names[0]) ||
          !roster?.tickets.some(row => row.id === saved.ticketId && row.userId === saved.memberId &&
            row.name === names[2] && row.productName === names[1])) throw Error("r4_setup_readback");
      status.textContent = "등록을 확인했습니다. 단일 수업을 저장할 수 있습니다.";
    } catch {
      if (actor === originalActor && actor === client?.sessionSubject?.() && branch.value === branchId) {
        status.textContent = "등록 결과를 확인할 수 없습니다. 지점을 다시 선택해 기록부터 확인해 주세요.";
      }
    } finally {
      setupBusy = false;
    }
  });
  fields.ticket.addEventListener("change", loadTicket);
  fields.action.addEventListener("change", paint);
  fields.coach.addEventListener("change", paint);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const stamp = epoch, branchId = branch.value, selected = ticket(), action = fields.action.value;
    if (submit.disabled || !current(stamp, branchId) || roster?.branchId !== branchId ||
      !selected || state?.ticketId !== selected.id || !form.reportValidity()) return;
    const scope = { target_branch_id: branchId, target_ticket_id: selected.id };
    saving = true;
    paint();
    status.textContent = "저장 결과를 확인하는 중입니다.";
    try {
      if (action === "memo") {
        const memo = fields.memo.value.trim();
        const saved = await rpc("tn_r4_save_ticket_memo", {
          ...scope, target_expected_updated_at: state.membership.updatedAt, target_memo: memo,
        });
        if (!current(stamp, branchId)) return;
        const after = await readTicket(branchId, selected.id);
        if (!current(stamp, branchId)) return;
        if (after.membership?.memo !== memo || after.membership.updatedAt !== saved?.updatedAt) throw Error("r4_memo_readback");
        showTicket(after);
      } else if (action === "lesson" && singleLessonEligible(selected) &&
        roster.coaches.some(c => c.id === fields.coach.value)) {
        const args = {
          target_branch_id: branchId, target_coach_role_id: fields.coach.value,
          target_lesson_date: fields.date.value, target_start_time: fields.time.value,
          target_duration_minutes: selected.lessonMinutes, target_schedule_kind: selected.productKind,
          target_participants: [{ userId: selected.userId, ticketId: selected.id }],
          target_request_id: null,
        };
        const fingerprint = JSON.stringify(args);
        if (pendingLesson && pendingLesson.fingerprint !== fingerprint) {
          throw Error("r4_previous_lesson_unconfirmed");
        }
        pendingLesson ||= { fingerprint, key: "r4-admin-" + root.crypto.randomUUID() };
        args.target_operation_key = pendingLesson.key;
        const saved = await rpc("tn_schedule_v2_save_lesson", args);
        if (!current(stamp, branchId)) return;
        if (saved?.ok !== true || !saved.lessonId) throw Error("r4_lesson_receipt");
        const read = await rpc("tn_r4_admin_saved_lesson", { ...scope, target_lesson_id: saved.lessonId });
        if (!current(stamp, branchId)) return;
        if (read?.id !== saved.lessonId || read.branchId !== branchId || read.ticketId !== selected.id ||
          read.coachId !== args.target_coach_role_id || read.date !== args.target_lesson_date ||
          !String(read.time).startsWith(args.target_start_time) || read.minutes !== selected.lessonMinutes) {
          throw Error("r4_lesson_readback");
        }
        fields.date.value = "";
        fields.time.value = "";
        pendingLesson = null;
      } else throw Error("r4_invalid_action");
      if (current(stamp, branchId)) status.textContent = "저장하고 다시 확인했습니다.";
    } catch {
      if (current(stamp, branchId)) {
        if (action === "lesson") {
          fields.date.value = "";
          fields.time.value = "";
        }
        clearTicket();
        fields.ticket.value = "";
        status.textContent = "저장을 확인할 수 없습니다. 같은 작업을 반복하기 전에 기록을 확인해 주세요.";
      }
    } finally {
      saving = false;
      paint();
    }
  });
  root.TennisNoteR4BranchAdminWrites = Object.freeze({
    refresh({ allowed, client: next }) {
      const nextActor = allowed ? next?.sessionSubject?.() : null;
      if (nextActor === actor && next === client) return;
      ++epoch;
      client = next;
      actor = nextActor;
      roster = null;
      pendingLesson = null;
      form.hidden = true;
      if (setup) {
        setup.hidden = true;
        setupSubmit.disabled = true;
        setup.reset();
      }
      status.textContent = "";
      clearTicket();
      setOptions(fields.ticket, "회원권 선택", []);
      setOptions(fields.coach, "코치 선택", []);
    },
  });
})(window, document);
