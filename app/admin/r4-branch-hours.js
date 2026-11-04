(function installR4BranchHours(root, document) {
  const el = (id) => document.getElementById(id);
  const panel = el("r4BranchHoursPanel");
  const select = el("r4ManagedBranch");
  const form = el("r4BranchHoursForm");
  const start = el("r4BranchOpenStart");
  const end = el("r4BranchOpenEnd");
  const status = el("r4BranchHoursStatus");
  if (![panel, select, form, start, end, status].every(Boolean)) return;
  let client;
  let actor = "";
  let generation = 0;
  let branchHours = null;
  let saving = false;
  const options = Object.freeze({ requireCurrentSession: true, retryAuth: false });
  const currentActor = () => String(client?.sessionSubject?.() || "");
  const valid = (stamp) => stamp === generation && Boolean(actor) && actor === currentActor();
  const reset = () => {
    ++generation;
    actor = "";
    branchHours = null;
    panel.hidden = true;
    form.hidden = true;
    select.replaceChildren();
    start.value = "";
    end.value = "";
    status.textContent = "";
  };
  async function loadBranch() {
    if (saving) return;
    const stamp = ++generation;
    const target = select.value;
    branchHours = null;
    form.hidden = true;
    status.textContent = "운영시간을 불러오는 중입니다.";
    try {
      const data = await client.rpc("tn_r4_get_operating_hours", { target_branch: target }, options);
      if (!valid(stamp) || target !== select.value) return;
      if (data?.branchId !== target || !data.openStart || !data.openEnd) throw Error("branch_response_mismatch");
      branchHours = data;
      start.value = data.openStart;
      end.value = data.openEnd;
      form.hidden = false;
      status.textContent = "";
    } catch {
      if (valid(stamp)) status.textContent = "이 지점의 운영시간을 조회할 수 없습니다.";
    }
  }
  select.addEventListener("change", loadBranch);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving || !valid(generation) || !branchHours || branchHours.branchId !== select.value) return;
    const stamp = generation;
    saving = true;
    select.disabled = true;
    form.querySelector("button[type=submit]").disabled = true;
    status.textContent = "저장 결과를 확인하는 중입니다.";
    try {
      const result = await client.rpc("tn_r4_save_operating_hours", {
        target_branch: branchHours.branchId, expected_start: branchHours.openStart, expected_end: branchHours.openEnd,
        new_start: start.value, new_end: end.value,
      }, options);
      if (!valid(stamp)) return;
      if (result?.branchId !== select.value || !result.openStart || !result.openEnd) throw Error("branch_response_mismatch");
      branchHours = result;
      start.value = result.openStart;
      end.value = result.openEnd;
      status.textContent = "운영시간을 저장했습니다.";
    } catch {
      if (valid(stamp)) {
        branchHours = null;
        form.hidden = true;
        status.textContent = "저장 결과를 확인할 수 없습니다. 지점을 다시 선택해 확인해 주세요.";
        select.value = "";
      }
    } finally {
      saving = false;
      select.disabled = false;
      form.querySelector("button[type=submit]").disabled = false;
    }
  });
  root.TennisNoteR4BranchHours = Object.freeze({
    async refresh({ allowed, client: nextClient }) {
      if (!allowed || !nextClient?.rpc || !nextClient?.sessionSubject?.()) {
        if (actor) reset();
        return;
      }
      if (client === nextClient && actor === currentActor()) return;
      reset();
      client = nextClient;
      actor = currentActor();
      const stamp = generation;
      try {
        const branches = await client.rpc("tn_r4_my_managed_branches", {}, options);
        if (!valid(stamp) || !Array.isArray(branches) || !branches.length) return;
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "지점 선택";
        const choices = branches.filter((branch) => branch?.branch_id && branch.branch_name).map((branch) => {
          const option = document.createElement("option");
          option.value = branch.branch_id;
          option.textContent = branch.branch_name;
          return option;
        });
        if (!choices.length) return;
        select.replaceChildren(placeholder, ...choices);
        panel.hidden = false;
      } catch {
        // Pre-R4 deployments have no RPC. Leave the existing login path untouched.
      }
    },
  });
})(window, document);
