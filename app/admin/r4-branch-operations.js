(function (root, document) {
  const panel = document.getElementById("r4BranchOperations");
  const branch = document.getElementById("r4ManagedBranch");
  if (!panel || !branch) return;
  const select = panel.querySelector("[name=action]");
  const body = panel.querySelector("fieldset");
  const status = panel.querySelector("[role=status]");
  const submit = panel.querySelector("button[type=submit]");
  const issueOption = select.querySelector('[value="issue"]');
  const ticketForm = document.getElementById("r4BranchSaveForm");
  const options = Object.freeze({ requireCurrentSession: true, retryAuth: false });
  const uuid = (id) => typeof id === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id);
  const date = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  let client, actor, active, snapshot, scopedCatalog, preview, generation = 0, busy = false;
  let dependencies;
  const current = (stamp, target = active) => stamp === generation && actor &&
    client?.sessionSubject?.() === actor && target === branch.value;
  const call = (name, args) => client.rpc(name, args, options);
  function catalogCall(target, action, params = {}) {
    return call("tn_r4_dev_branch_catalog", { p_branch: target, p_action: action, ...params });
  }
  function devCatalogEnabled() {
    const cfg = client?.loadConfig?.();
    return cfg?.environment === "development" &&
      cfg.projectFingerprint === "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba" &&
      cfg.supabaseUrl === "https://udjmiezroipctytmztwz.supabase.co";
  }
  function setCatalog(data, target) {
    scopedCatalog = data?.branchId === target && Array.isArray(data.products) && Array.isArray(data.members) ? data : null;
    if (issueOption) issueOption.hidden = issueOption.disabled = !scopedCatalog;
    if (!scopedCatalog && select.value === "issue") select.value = "policy";
  }
  function setChoices(field, rows, blank, title) {
    field.append(new Option(blank, ""));
    for (const row of rows) if (uuid(row.id)) field.append(new Option(title(row), row.id));
  }
  const canIssue = () => scopedCatalog?.products.some(row => row.price === 0 && uuid(row.id)) &&
    scopedCatalog.members.some(row => uuid(row.id));
  const disabled = () => !snapshot || !controls[select.value] || busy ||
    (select.value === "policy" && !["approval", "blocked"].includes(snapshot?.mode)) ||
    (select.value === "issue" && !canIssue());
  const controls = {
    policy: '<label>코치의 단일 수업 추가 <select name="mode"><option value="approval">관리자 승인 필요</option><option value="blocked">추가 차단</option></select></label>',
    product: '<label>상품 이름 <input name="label" minlength="2" maxlength="80" required></label><label>수업 시간 <select name="minutes"><option value="20">20분</option><option value="40">40분</option></select></label><label>횟수 <input name="sessions" type="number" min="1" max="52" step="1" required></label>',
    issue: '<label>0원 상품 <select name="catalogProduct" required></select></label><label>이 지점 회원 <select name="catalogMember" required></select></label>',
    import: '<p>개인 정규권 1행만 등록합니다. 수업은 등록 후 시간표에서 지정하세요.</p><label>회원등록 엑셀 <input name="file" type="file" accept=".xlsx" required></label><label>회원권 종료일 <input name="expires" type="date" required></label>',
  };
  function paint() {
    preview = null;
    const action = select.value;
    body.innerHTML = controls[action] || "";
    submit.textContent = { policy: "정책 저장", product: "상품 등록", issue: "회원권 등록", import: "미리보기" }[action] || "저장";
    if (action === "product" && scopedCatalog) {
      panel.elements.minutes.replaceChildren(new Option("20분", "20"), new Option("30분", "30"));
      body.insertAdjacentHTML("beforeend", '<label>유효기간(일) <input name="days" type="number" min="1" max="366" step="1" required></label><label>상품 가격(원) <input name="price" type="number" min="0" max="99999999" step="1" required></label>');
    }
    if (action === "issue" && scopedCatalog) {
      setChoices(panel.elements.catalogProduct, scopedCatalog.products.filter(row => row.price === 0), "상품 선택",
        row => `${row.name} · ${row.minutes}분 · ${row.sessions}회 · ${row.days}일`);
      setChoices(panel.elements.catalogMember, scopedCatalog.members, "회원 선택", row => row.name);
    }
    if (action === "policy" && snapshot && ["approval", "blocked"].includes(snapshot.mode)) {
      panel.elements.mode.value = snapshot.mode;
    }
    const unsupported = action === "policy" && snapshot && !["approval", "blocked"].includes(snapshot.mode);
    submit.disabled = disabled();
    status.textContent = unsupported ? "이 지점의 현재 정책은 여기서 변경할 수 없습니다."
      : action === "issue" && !canIssue() ? "이 지점의 0원 상품과 회원이 있어야 등록할 수 있습니다." : "";
  }
  function clear() {
    ++generation;
    active = snapshot = preview = null;
    setCatalog(null, "");
    panel.hidden = true;
    body.replaceChildren();
    status.textContent = "";
    submit.disabled = true;
  }
  async function load() {
    clear();
    if (!actor || !uuid(branch.value) || client?.sessionSubject?.() !== actor) return;
    const target = branch.value, stamp = generation;
    try {
      const data = await call("tn_r4_branch_operations_options", { branch: target });
      if (!current(stamp, target)) return;
      if (data?.branchId !== target || !Number.isSafeInteger(data.revision) || data.revision < 0 ||
          !Array.isArray(data.coaches) || !Array.isArray(data.products)) return;
      active = target;
      snapshot = data;
      if (devCatalogEnabled()) {
        const catalog = await catalogCall(target, "options").catch(() => null);
        if (!current(stamp, target)) return;
        setCatalog(catalog, target);
      }
      panel.hidden = false;
      paint();
    } catch {
      // The scoped controls stay hidden if this session or release has no access.
    }
  }
  function exact(items, name) {
    const matched = items.filter(item => item.name === name && uuid(item.id));
    if (matched.length !== 1) throw Error("r4_reference_not_unique");
    return matched[0];
  }
  function dependency(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => ready() ? resolve() : reject(Error("r4_dependency_missing"));
      script.onerror = () => { script.remove(); reject(Error("r4_dependency_missing")); };
      document.head.append(script);
    });
  }
  async function parseRow(file, expires, catalog) {
    if (!file || !date(expires)) throw Error("r4_file");
    dependencies ||= Promise.all([
      dependency("../shared/tennisnote-single-sheet-import.js?v=r4-operations1", () => root.TennisNoteSingleSheetImport),
      dependency("../shared/vendor/xlsx.full.min.js?v=0.18.5", () => root.XLSX),
    ]).catch(error => { dependencies = null; throw error; });
    await dependencies;
    const parser = root.TennisNoteSingleSheetImport;
    if (!file || !parser || !root.XLSX || !date(expires) || file.size > parser.LIMITS.bytes) throw Error("r4_file");
    const parsed = await parser.readFile(new Uint8Array(await file.arrayBuffer()), root.XLSX);
    const units = await parser.serverUnits(parsed);
    const row = units.units[0]?.unit?.rows?.[0];
    if (units.held.length || units.units.length !== 1 || units.units[0].unit.rows.length !== 1 ||
        !row || row.group || row.slots.length || !date(row.startDate)) throw Error("r4_one_individual_row_required");
    const coach = exact(catalog.coaches, row.coach);
    const product = exact(catalog.products, row.product);
    if (row.total !== product.sessions || expires < row.startDate) throw Error("r4_import_ticket");
    return { name: row.name, phone: row.phone, coachId: coach.id, productId: product.id,
      startsOn: row.startDate, expiresOn: expires, usedSessions: row.used };
  }
  branch.addEventListener("change", load);
  select.addEventListener("change", paint);
  body.addEventListener("change", () => {
    if (preview) {
      preview = null;
      submit.textContent = "미리보기";
      status.textContent = "";
    }
  });
  panel.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !snapshot || !current(generation) || submit.disabled) return;
    const target = active, stamp = generation, catalog = snapshot;
    const action = select.value, previous = preview;
    const branchCatalog = scopedCatalog;
    const values = new FormData(panel);
    busy = true;
    select.disabled = body.disabled = submit.disabled = true;
    status.textContent = "확인 중입니다.";
    try {
      if (action === "policy") {
        const mode = values.get("mode");
        const revision = await call("tn_r4_save_lesson_policy", { branch: target, mode, expected_revision: catalog.revision });
        if (!current(stamp)) return;
        const refreshed = await call("tn_r4_branch_operations_options", { branch: target });
        if (!current(stamp)) return;
        if (refreshed?.branchId !== target || refreshed.mode !== mode || refreshed.revision !== revision) throw Error("r4_readback");
        snapshot = refreshed;
        status.textContent = "정책을 저장하고 확인했습니다.";
      } else if (action === "product") {
        const label = String(values.get("label") || "").trim();
        if (branchCatalog) {
          const terms = { name: label, minutes: Number(values.get("minutes")), sessions: Number(values.get("sessions")),
            days: Number(values.get("days")), price: Number(values.get("price")) };
          if (["days", "price"].some(key => !/^\d+$/.test(String(values.get(key) ?? "")))) throw Error("r4_catalog_terms");
          const saved = await catalogCall(target, "product", { p_terms: terms });
          if (!current(stamp)) return;
          const refreshed = await catalogCall(target, "options");
          if (!current(stamp)) return;
          if (saved?.branchId !== target || refreshed?.branchId !== target || !uuid(saved.product?.id) ||
              !refreshed.products?.some(row => row.id === saved.product.id &&
                Object.entries(terms).every(([key, value]) => row[key] === value))) throw Error("r4_catalog_product_readback");
          setCatalog(refreshed, target);
          paint();
          status.textContent = "비공개 상품 조건을 저장하고 확인했습니다.";
          return;
        }
        const id = await call("tn_r4_create_branch_product", { branch: target, label,
          minutes: Number(values.get("minutes")), sessions: Number(values.get("sessions")) });
        if (!current(stamp)) return;
        const refreshed = await call("tn_r4_branch_operations_options", { branch: target });
        if (!current(stamp)) return;
        if (refreshed?.branchId !== target || !uuid(id) || !refreshed.products.some(product => product.id === id && product.name === label)) throw Error("r4_readback");
        snapshot = refreshed;
        panel.elements.label.value = "";
        status.textContent = "상품을 등록하고 확인했습니다.";
      } else if (action === "issue") {
        const product = branchCatalog?.products.find(row => row.id === values.get("catalogProduct") && row.price === 0);
        const member = branchCatalog?.members.find(row => row.id === values.get("catalogMember"));
        if (!uuid(product?.id) || !uuid(member?.id)) throw Error("r4_catalog_selection");
        const targetIds = { p_product: product.id, p_member: member.id };
        const saved = await catalogCall(target, "issue", targetIds);
        if (!current(stamp)) return;
        const read = await catalogCall(target, "read", targetIds);
        if (!current(stamp)) return;
        if (!uuid(saved?.ticketId) || read?.ticketId !== saved.ticketId || read.branchId !== target ||
            read.productId !== product.id || read.memberId !== member.id || read.price !== 0 || read.payment !== false ||
            read.total !== product.sessions || read.minutes !== product.minutes || read.days !== product.days) {
          throw Error("r4_catalog_ticket_readback");
        }
        status.textContent = `등록 확인 · ${read.minutes}분 · ${read.total}회 · ${read.expiresOn}까지`;
        if (ticketForm) branch.dispatchEvent(new Event("r4-ticket-imported"));
      } else if (action === "import") {
        if (!previous) {
          const row = await parseRow(values.get("file"), values.get("expires"), catalog);
          if (!current(stamp)) return;
          const operation_id = root.crypto.randomUUID();
          const result = await call("tn_r4_initial_sheet_row", { branch: target, operation_id, row_data: row, expected_digest: null });
          if (!current(stamp)) return;
          if (result?.branchId !== target || !/^[\da-f]{64}$/.test(result.digest)) throw Error("r4_preview_readback");
          preview = { operation_id, row_data: row, expected_digest: result.digest };
          submit.textContent = "회원권 1건 등록";
          status.textContent = `회원권 1건 · 남은 수업 ${result.remainingSessions}회. 등록할지 확인해 주세요.`;
        } else {
          const result = await call("tn_r4_initial_sheet_row", { branch: target, ...previous });
          if (!current(stamp)) return;
          if (result?.branchId !== target || !uuid(result.ticketId)) throw Error("r4_import_readback");
          const readback = await call("tn_r4_get_ticket_write_state", { target_branch_id: target, target_ticket_id: result.ticketId });
          if (!current(stamp)) return;
          if (readback?.branchId !== target || readback?.ticketId !== result.ticketId) throw Error("r4_import_readback");
          paint();
          status.textContent = "회원권을 등록하고 확인했습니다. 아래에서 단일 수업을 저장할 수 있습니다.";
          if (ticketForm) branch.dispatchEvent(new Event("r4-ticket-imported"));
        }
      }
    } catch {
      if (current(stamp)) {
        if (action === "import") status.textContent = previous
          ? "결과를 확인하지 못했습니다. 같은 요청으로 다시 확인할 수 있습니다."
          : "파일·지점의 코치 및 상품·기간·중복 여부를 확인해 주세요.";
        else if (action === "issue") {
          status.textContent = "등록 결과를 확인하지 못했습니다. 같은 회원과 상품으로 다시 확인해도 중복 등록되지 않습니다.";
        } else {
          snapshot = null;
          status.textContent = "저장 결과를 확인하지 못했습니다. 지점을 다시 선택해 확인해 주세요.";
        }
      }
    } finally {
      busy = false;
      select.disabled = body.disabled = false;
      submit.disabled = panel.hidden || disabled();
    }
  });
  root.TennisNoteR4BranchOperations = Object.freeze({
    refresh({ allowed, client: next }) {
      const nextActor = allowed && next?.sessionSubject?.();
      if (!nextActor) { clear(); client = actor = null; return; }
      if (client === next && actor === nextActor) return;
      client = next; actor = nextActor; load();
    },
  });
})(window, document);
