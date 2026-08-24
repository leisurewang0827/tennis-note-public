(function () {
  const surface = document.documentElement.dataset.tennisnoteSurface || "member";
  const labels = { error: "오류", inconvenience: "불편", improvement: "개선 제안" };
  const release = window.TENNIS_NOTE_RELEASE || {};
  const client = window.TennisNoteDataClient;
  const queueStorageKey = "tennis-note-client-error-queue-v1";
  const clientIdStorageKey = "tennis-note-client-error-id-v1";
  const maxQueueSize = 30;
  const maxQueueAgeMs = 7 * 24 * 60 * 60 * 1000;
  let submitting = false;
  let flushing = false;
  const adminReportState = {
    rows: [],
    page: 0,
    pageSize: 20,
    status: "active",
  };

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function safeMessage(value) {
    return String(value || "오류 내용 없음")
      .replace(/(token|password|apikey|authorization)[=: ]+[^\s,;]+/gi, "$1=[숨김]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일]")
      .replace(/(?:\+?82[- ]?)?0?1[016789][- ]?\d{3,4}[- ]?\d{4}/g, "[전화번호]")
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[토큰]")
      .replace(/([?&#](?:code|token|email|phone|password)=)[^&#\s]+/gi, "$1[숨김]")
      .slice(0, 1000);
  }

  function safeCode(value) {
    return safeMessage(value || "unknown_error")
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, "_")
      .slice(0, 120) || "unknown_error";
  }

  function clientSessionId() {
    try {
      const saved = window.localStorage.getItem(clientIdStorageKey);
      if (/^[a-z0-9-]{12,80}$/i.test(saved || "")) return saved;
      const created = window.crypto?.randomUUID?.() || `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(clientIdStorageKey, created);
      return created;
    } catch (_) {
      return `session-${Date.now().toString(36)}`;
    }
  }

  function platformContext() {
    const capacitor = window.Capacitor;
    const nativePlatform = capacitor?.getPlatform?.() || "web";
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language || "",
      platform: navigator.userAgentData?.platform || navigator.platform || "",
      nativePlatform,
      online: navigator.onLine !== false,
      clientSessionId: clientSessionId(),
    };
  }

  function readQueue() {
    try {
      const rows = JSON.parse(window.localStorage.getItem(queueStorageKey) || "[]");
      const cutoff = Date.now() - maxQueueAgeMs;
      return (Array.isArray(rows) ? rows : [])
        .filter((row) => Number(row?.capturedAt || 0) >= cutoff)
        .slice(-maxQueueSize);
    } catch (_) {
      return [];
    }
  }

  function writeQueue(rows) {
    try {
      window.localStorage.setItem(queueStorageKey, JSON.stringify(rows.slice(-maxQueueSize)));
    } catch (_) {
      // Logging must never interrupt the app when storage is unavailable.
    }
  }

  function queueDiagnostic(payload) {
    const rows = readQueue();
    const duplicate = rows.find((row) => row.fingerprint === payload.fingerprint && Date.now() - row.capturedAt < 60_000);
    if (duplicate) duplicate.occurrences = Math.min(Number(duplicate.occurrences || 1) + 1, 20);
    else rows.push({ ...payload, capturedAt: Date.now(), occurrences: 1 });
    writeQueue(rows);
    void flushQueue();
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
        ...platformContext(),
      },
    });
    return Array.isArray(result) ? result[0] : result;
  }

  async function captureError(message, source, line, column) {
    const clean = safeMessage(message);
    queueDiagnostic({
      category: "runtime",
      stage: "runtime_error",
      code: safeCode(clean),
      message: clean,
      source: String(source || "화면").split("/").pop(),
      line: Number(line || 0),
      column: Number(column || 0),
      fingerprint: fingerprint(clean, source, line),
    });
  }

  function captureClientError(detail = {}) {
    const category = detail.category === "auth" ? "auth" : "runtime";
    const stage = safeCode(detail.stage || (category === "auth" ? "login_unknown" : "runtime_error"));
    const code = safeCode(detail.code || detail.message);
    const message = safeMessage(detail.message || detail.code);
    queueDiagnostic({
      category,
      stage,
      code,
      message,
      status: Number(detail.status || 0),
      provider: safeCode(detail.provider || "unknown"),
      native: Boolean(detail.native),
      source: "client-event",
      line: 0,
      column: 0,
      fingerprint: fingerprint(`${category}|${stage}|${code}`, "client-event", 0),
    });
  }

  async function sendQueuedDiagnostic(row) {
    return client.invokeFunction("tennisnote-client-error-report", {
      body: {
        surface,
        category: row.category,
        stage: row.stage,
        code: row.code,
        message: row.message,
        status: row.status || 0,
        provider: row.provider || "unknown",
        source: row.source || "",
        line: row.line || 0,
        column: row.column || 0,
        fingerprint: row.fingerprint,
        occurrences: row.occurrences || 1,
        pagePath: `${location.pathname}${location.hash || ""}`,
        appVersion: release.version || "",
        releaseId: release.releaseId || "",
        deviceContext: platformContext(),
      },
    });
  }

  async function flushQueue() {
    if (flushing || navigator.onLine === false || !client?.invokeFunction || !client.readiness?.().ready) return;
    const rows = readQueue();
    if (!rows.length) return;
    flushing = true;
    const remaining = [...rows];
    try {
      while (remaining.length) {
        await sendQueuedDiagnostic(remaining[0]);
        remaining.shift();
        writeQueue(remaining);
      }
    } catch (_) {
      // Keep unsent diagnostics for the next online/app-focus attempt.
    } finally {
      flushing = false;
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
        <div class="tn-report-actions">
          <button class="tn-report-cancel" type="button" data-tn-report-close data-tn-report-cancel>취소</button>
          <button class="tn-report-submit" type="submit">접수하기</button>
        </div>
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
    const legacyAutomation = String(row.admin_note || "").match(/^AUTO_([A-Z_]+):\s*(.*)$/);
    const automationStatus = row.automation_status || legacyAutomation?.[1]?.toLowerCase() || "idle";
    const automationMessage = row.automation_message || legacyAutomation?.[2] || "";
    const automationLabel = {
      idle: "수정 검토 요청 전",
      queued: "수정 검토 대기",
      running: "수정 작업 중",
      review_required: "Codex 검토 대기",
      pr_ready: "수정안 검토 가능",
      failed: "수정 작업 확인 필요",
      merged: "수정 반영",
    }[automationStatus] || "수정 상태 확인 필요";
    const automationAction = ["queued", "running"].includes(automationStatus)
      ? `<button type="button" disabled>수정 검토 대기</button>`
      : row.automation_url
        ? `<a class="tn-report-link" href="${escapeHtml(row.automation_url)}" target="_blank" rel="noopener">수정안 확인</a>`
        : automationStatus === "review_required"
          ? `<button type="button" disabled>검토 요청됨</button>`
          : `<button type="button" data-request-autofix>수정 검토 요청</button>`;
    const errorDetails = row.error_message
      ? `<details class="tn-report-error-details"><summary>오류 상세 보기</summary><code>${escapeHtml(safeMessage(row.error_message))}</code></details>`
      : "";
    return `<article class="tn-report-row ${escapeHtml(row.priority)}" data-report-id="${escapeHtml(row.id)}">
      <div><span>${escapeHtml(row.error_code)} · ${escapeHtml(row.surface)} · ${escapeHtml(labels[row.report_kind])}</span><strong>${escapeHtml(row.title)}</strong><p>${escapeHtml(row.description || row.error_message)}</p>${errorDetails}<small>${new Date(row.last_seen_at).toLocaleString("ko-KR")} · ${row.occurrence_count}회 발생 · v${escapeHtml(row.app_version)}</small><em class="tn-report-automation">${escapeHtml(automationLabel)}${automationMessage ? ` · ${escapeHtml(automationMessage)}` : ""}</em></div>
      <div class="tn-report-controls"><select data-report-priority><option value="urgent" ${row.priority === "urgent" ? "selected" : ""}>긴급</option><option value="high" ${row.priority === "high" ? "selected" : ""}>높음</option><option value="normal" ${row.priority === "normal" ? "selected" : ""}>일반</option></select><select data-report-status><option value="new" ${row.status === "new" ? "selected" : ""}>신규</option><option value="reviewing" ${row.status === "reviewing" ? "selected" : ""}>확인중</option><option value="planned" ${row.status === "planned" ? "selected" : ""}>개선예정</option><option value="resolved" ${row.status === "resolved" ? "selected" : ""}>완료</option><option value="closed" ${row.status === "closed" ? "selected" : ""}>종료</option></select><button type="button" data-save-report>상태 저장</button>${automationAction}<b>${priorityLabel} · ${statusLabel}</b></div>
    </article>`;
  }

  function adminReportFilters() {
    if (adminReportState.status === "active") return { status: { in: ["new", "reviewing", "planned"] } };
    if (adminReportState.status === "resolved") return { status: { in: ["resolved", "closed"] } };
    return {};
  }

  function renderAdminReportPage() {
    const target = document.querySelector("[data-product-report-list]");
    const pager = document.querySelector("[data-product-report-pager]");
    const summary = document.querySelector("[data-product-report-summary]");
    if (!target) return;
    const pageCount = Math.max(1, Math.ceil(adminReportState.rows.length / adminReportState.pageSize));
    adminReportState.page = Math.min(Math.max(adminReportState.page, 0), pageCount - 1);
    const start = adminReportState.page * adminReportState.pageSize;
    const visibleRows = adminReportState.rows.slice(start, start + adminReportState.pageSize);
    target.innerHTML = visibleRows.map(reportCard).join("") || "<p>선택한 상태의 불편·오류가 없습니다.</p>";
    if (summary) {
      const first = adminReportState.rows.length ? start + 1 : 0;
      const last = Math.min(start + adminReportState.pageSize, adminReportState.rows.length);
      summary.textContent = `최근 ${adminReportState.rows.length}건 중 ${first}-${last}건`;
    }
    if (pager) {
      pager.hidden = pageCount <= 1;
      pager.innerHTML = pageCount <= 1
        ? ""
        : `
          <button type="button" data-report-page="${adminReportState.page - 1}" ${adminReportState.page === 0 ? "disabled" : ""} aria-label="이전 페이지">&lsaquo;</button>
          <span>${adminReportState.page + 1} / ${pageCount}</span>
          <button type="button" data-report-page="${adminReportState.page + 1}" ${adminReportState.page === pageCount - 1 ? "disabled" : ""} aria-label="다음 페이지">&rsaquo;</button>`;
    }
  }

  async function loadAdminReports() {
    const target = document.querySelector("[data-product-report-list]");
    if (!target || !client?.selectRows) return;
    target.innerHTML = "<p>접수 내역을 불러오는 중입니다.</p>";
    try {
      const rows = await client.selectRows("tn_product_reports", {
        select: "id,error_code,surface,report_kind,priority,title,description,error_message,status,occurrence_count,last_seen_at,app_version,admin_note,automation_status,automation_message,automation_url",
        filters: adminReportFilters(),
        order: "last_seen_at.desc",
        limit: 100,
      });
      const score = { urgent: 3, high: 2, normal: 1 };
      rows.sort((a, b) => (score[b.priority] - score[a.priority]) || Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
      adminReportState.rows = rows;
      renderAdminReportPage();
    } catch (error) {
      target.innerHTML = `<p>${escapeHtml(safeMessage(error.message || error))}</p>`;
    }
  }

  function bindAdmin() {
    document.querySelector('[data-view="issues"]')?.addEventListener("click", loadAdminReports);
    document.querySelector("[data-product-report-refresh]")?.addEventListener("click", loadAdminReports);
    document.querySelector("[data-product-report-status]")?.addEventListener("change", (event) => {
      adminReportState.status = event.target.value || "active";
      adminReportState.page = 0;
      loadAdminReports();
    });
    document.querySelector("[data-product-report-pager]")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-report-page]");
      if (!button || button.disabled) return;
      adminReportState.page = Number(button.dataset.reportPage) || 0;
      renderAdminReportPage();
    });
    document.querySelector("[data-product-report-list]")?.addEventListener("click", async (event) => {
      const autoFixButton = event.target.closest("[data-request-autofix]");
      if (autoFixButton) {
        const reportRow = autoFixButton.closest("[data-report-id]");
        autoFixButton.disabled = true;
        autoFixButton.textContent = "검토 요청 중";
        try {
          const response = await client.invokeFunction("tennisnote-product-report-autofix", {
            body: { reportId: reportRow.dataset.reportId },
          });
          alert(response?.message || "수정 검토 요청을 접수했습니다.");
          await loadAdminReports();
        } catch (error) {
          alert(safeMessage(error.message || error));
          autoFixButton.disabled = false;
          autoFixButton.textContent = "수정 검토 요청";
        }
        return;
      }
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
  window.addEventListener("tennisnote:client-error", (event) => captureClientError(event.detail || {}));
  window.addEventListener("online", () => void flushQueue());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushQueue();
  });
  window.TennisNoteIssueReporter = { submit, loadAdminReports, captureClientError, flushQueue };
  document.addEventListener("DOMContentLoaded", () => {
    installManualEntry();
    if (surface === "admin") bindAdmin();
    void flushQueue();
  }, { once: true });
})();
