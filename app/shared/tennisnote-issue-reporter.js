(function () {
  const surface = document.documentElement.dataset.tennisnoteSurface || "member";
  const labels = { error: "오류", inconvenience: "불편", improvement: "개선 제안" };
  const release = window.TENNIS_NOTE_RELEASE || {};
  const client = window.TennisNoteDataClient;
  let submitting = false;

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function safeMessage(value) {
    return String(value || "오류 내용 없음")
      .replace(/(token|password|apikey|authorization)[=: ]+[^\s,;]+/gi, "$1=[숨김]")
      .slice(0, 1000);
  }

  function fingerprint(message, source, line) {
    const input = `${surface}|${message}|${source}|${line}`.slice(0, 500);
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `auto-${(hash >>> 0).toString(16)}`;
  }

  async function submit(payload) {
    if (!client?.rpc || !client.readiness?.().ready || !client.getSession?.()?.access_token) {
      throw new Error("로그인 후 접수할 수 있습니다.");
    }
    const result = await client.rpc("tn_submit_product_report", {
      target_surface: surface,
      target_report_kind: payload.kind,
      target_priority: payload.priority || "normal",
      target_title: payload.title,
      target_description: payload.description || "",
      target_error_message: payload.errorMessage || "",
      target_page_path: `${location.pathname}${location.hash || ""}`,
      target_app_version: release.version || "",
      target_release_id: release.releaseId || "",
      target_fingerprint: payload.fingerprint || "",
      target_device_context: {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language || "",
        platform: navigator.userAgentData?.platform || navigator.platform || "",
      },
    });
    return Array.isArray(result) ? result[0] : result;
  }

  async function captureError(message, source, line, column) {
    const clean = safeMessage(message);
    try {
      await submit({
        kind: "error",
        priority: "high",
        title: "앱 자동 오류 감지",
        description: "사용 중 자동으로 감지된 오류입니다.",
        errorMessage: `${clean} (${String(source || "화면").split("/").pop()}:${line || 0}:${column || 0})`,
        fingerprint: fingerprint(clean, source, line),
      });
    } catch (_) {
      // Automatic reporting must never interrupt the app.
    }
  }

  function modalHtml() {
    return `<section class="tn-report-modal" data-tn-report-modal hidden>
      <button class="tn-report-backdrop" type="button" aria-label="닫기" data-tn-report-close></button>
      <form class="tn-report-card" data-tn-report-form>
        <header><div><small>테니스노트 개선</small><h2>불편·오류 접수</h2></div><button type="button" data-tn-report-close aria-label="닫기">×</button></header>
        <label><span>구분</span><select name="kind"><option value="inconvenience">불편사항</option><option value="error">오류</option><option value="improvement">개선 제안</option></select></label>
        <label><span>제목</span><input name="title" maxlength="120" required placeholder="어떤 문제가 있었나요?" /></label>
        <label><span>내용</span><textarea name="description" rows="5" maxlength="2000" required placeholder="어느 화면에서 무엇을 하다가 발생했는지 적어주세요."></textarea></label>
        <p class="tn-report-message" data-tn-report-message></p>
        <button class="tn-report-submit" type="submit">접수하기</button>
      </form>
    </section>`;
  }

  function installManualEntry() {
    document.body.insertAdjacentHTML("beforeend", modalHtml());
    const modal = document.querySelector("[data-tn-report-modal]");
    const form = document.querySelector("[data-tn-report-form]");
    const message = document.querySelector("[data-tn-report-message]");
    const open = () => { modal.hidden = false; form.querySelector("input")?.focus(); };
    const close = () => { modal.hidden = true; };
    document.querySelectorAll("[data-open-product-report]").forEach((button) => button.addEventListener("click", open));
    modal.querySelectorAll("[data-tn-report-close]").forEach((button) => button.addEventListener("click", close));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      submitting = true;
      message.textContent = "접수 중입니다.";
      try {
        const data = new FormData(form);
        const saved = await submit({
          kind: data.get("kind"),
          priority: data.get("kind") === "error" ? "high" : "normal",
          title: data.get("title"),
          description: data.get("description"),
          fingerprint: `manual-${Date.now()}`,
        });
        message.textContent = `접수 완료 · ${saved?.error_code || "확인번호 생성됨"}`;
        form.reset();
        setTimeout(close, 1400);
        if (surface === "admin") loadAdminReports();
      } catch (error) {
        message.textContent = safeMessage(error.message || error);
      } finally {
        submitting = false;
      }
    });
  }

  function reportCard(row) {
    const priorityLabel = row.priority === "urgent" ? "긴급" : row.priority === "high" ? "높음" : "일반";
    const statusLabel = { new: "신규", reviewing: "확인중", planned: "개선예정", resolved: "완료", closed: "종료" }[row.status] || row.status;
    return `<article class="tn-report-row ${escapeHtml(row.priority)}" data-report-id="${escapeHtml(row.id)}">
      <div><span>${escapeHtml(row.error_code)} · ${escapeHtml(row.surface)} · ${escapeHtml(labels[row.report_kind])}</span><strong>${escapeHtml(row.title)}</strong><p>${escapeHtml(row.description || row.error_message)}</p><small>${new Date(row.last_seen_at).toLocaleString("ko-KR")} · ${row.occurrence_count}회 발생 · v${escapeHtml(row.app_version)}</small></div>
      <div class="tn-report-controls"><select data-report-priority><option value="urgent" ${row.priority === "urgent" ? "selected" : ""}>긴급</option><option value="high" ${row.priority === "high" ? "selected" : ""}>높음</option><option value="normal" ${row.priority === "normal" ? "selected" : ""}>일반</option></select><select data-report-status><option value="new" ${row.status === "new" ? "selected" : ""}>신규</option><option value="reviewing" ${row.status === "reviewing" ? "selected" : ""}>확인중</option><option value="planned" ${row.status === "planned" ? "selected" : ""}>개선예정</option><option value="resolved" ${row.status === "resolved" ? "selected" : ""}>완료</option><option value="closed" ${row.status === "closed" ? "selected" : ""}>종료</option></select><button type="button" data-save-report>저장</button><b>${priorityLabel} · ${statusLabel}</b></div>
    </article>`;
  }

  async function loadAdminReports() {
    const target = document.querySelector("[data-product-report-list]");
    if (!target || !client?.selectRows) return;
    target.innerHTML = "<p>접수 내역을 불러오는 중입니다.</p>";
    try {
      const rows = await client.selectRows("tn_product_reports", { select: "*", limit: 500 });
      const score = { urgent: 3, high: 2, normal: 1 };
      rows.sort((a, b) => (score[b.priority] - score[a.priority]) || Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
      target.innerHTML = rows.map(reportCard).join("") || "<p>접수된 불편·오류가 없습니다.</p>";
    } catch (error) {
      target.innerHTML = `<p>${escapeHtml(safeMessage(error.message || error))}</p>`;
    }
  }

  function bindAdmin() {
    document.querySelector('[data-view="issues"]')?.addEventListener("click", loadAdminReports);
    document.querySelector("[data-product-report-refresh]")?.addEventListener("click", loadAdminReports);
    document.querySelector("[data-product-report-list]")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-save-report]");
      if (!button) return;
      const row = button.closest("[data-report-id]");
      button.disabled = true;
      try {
        await client.rpc("tn_admin_update_product_report", {
          target_report_id: row.dataset.reportId,
          target_status: row.querySelector("[data-report-status]").value,
          target_priority: row.querySelector("[data-report-priority]").value,
          target_admin_note: "",
        });
        await loadAdminReports();
      } catch (error) {
        alert(safeMessage(error.message || error));
      } finally {
        button.disabled = false;
      }
    });
  }

  window.addEventListener("error", (event) => captureError(event.message, event.filename, event.lineno, event.colno));
  window.addEventListener("unhandledrejection", (event) => captureError(event.reason?.message || event.reason, "promise", 0, 0));
  window.TennisNoteIssueReporter = { submit, loadAdminReports };
  document.addEventListener("DOMContentLoaded", () => {
    installManualEntry();
    if (surface === "admin") bindAdmin();
  }, { once: true });
})();
