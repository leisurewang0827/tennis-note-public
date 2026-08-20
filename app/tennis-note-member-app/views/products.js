// 회원권 상품과 구매 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderMembershipProductPresets() {
  const target = $("#membershipProductPresets");
  if (!target) return;
  const activePresetId = activeMembershipPresetId();
  const products = membershipProducts();
  target.innerHTML = `
    <div class="membership-product-presets-heading"><strong>수업 형태 ${membershipPresetDefinitions.length}가지</strong><small>원하는 이용 방식부터 고르세요.</small></div>
    <div class="membership-product-presets-grid" role="group" aria-label="회원권 수업 형태 선택">
      ${membershipPresetDefinitions.map((preset) => `
        <button class="membership-preset-chip ${preset.id === activePresetId ? "is-selected" : ""}" type="button"
          data-membership-preset="${preset.id}" aria-pressed="${preset.id === activePresetId}">
          <strong>${preset.label}</strong><small>${preset.description}</small><b>${distinctMembershipProductsForFamily(preset.id, products).length}개</b>
        </button>`).join("")}
    </div>`;
}

function renderMembershipProductFilters(products, visibleProducts) {
  const target = $("#membershipProductFilters");
  if (!target) return;
  renderMembershipProductPresets();
  const visibleProductCount = activeMembershipPresetId() === "coupon"
    ? distinctMembershipProductsForFamily("coupon", visibleProducts).length
    : visibleProducts.length;
  const summary = $("#membershipProductFilterSummary");
  if (summary) summary.textContent = `${visibleProductCount}개 상품`;
  const availableByKey = Object.fromEntries(membershipFilterDefinitions.map(({ key }) => [
    key,
    new Set(products
      .filter((product) => matchesMembershipFilters(product, key))
      .map((product) => membershipProductFacet(product, key))),
  ]));
  const filterDefinitions = activeMembershipPresetId() === "coupon"
    ? membershipFilterDefinitions.filter(({ key }) => key !== "scheduleScope")
    : membershipFilterDefinitions;
  const filterRows = filterDefinitions.map(({ key, label, options }) => {
    const selected = state.membershipFilters[key] || "all";
    const optionButtons = options
      .filter(([value]) => value === "all" || availableByKey[key].has(value))
      .map(([value, optionLabel]) => `
        <button class="membership-filter-chip ${selected === value ? "is-selected" : ""}" type="button"
          data-membership-filter="${key}" data-membership-filter-value="${value}"
          aria-pressed="${selected === value}">${optionLabel}</button>`)
      .join("");
    return `
      <div class="membership-filter-row">
        <strong>${label}</strong>
        <div class="membership-filter-options" role="group" aria-label="${label} 선택">${optionButtons}</div>
      </div>`;
  }).join("");
  target.innerHTML = `
    <div class="membership-filter-heading">
      <div>
        <strong>상세 조건</strong>
        <span>${visibleProductCount}개 상품</span>
      </div>
      <button class="small-button membership-filter-reset" type="button" data-membership-filter-reset>조건 지우기</button>
    </div>
    ${filterRows}`;
}

function renderMemberPaymentAlerts() {
  const target = $("#memberPaymentAlerts");
  if (!target) return;
  const alerts = (state.liveNotifications || [])
    .filter((item) => ["payment_cancelled", "payment_request_cancelled", "payment_refunded"].includes(item.templateKey))
    .slice(0, 3);
  if (!alerts.length) {
    target.innerHTML = "";
    return;
  }
  target.innerHTML = `
    <section class="member-alert-list" aria-label="최근 결제 알림">
      ${alerts
        .map((alert) => `
          <article class="member-alert-card ${alert.tone || "wait"}">
            <div>
              <strong>${escapeHtml(alert.title)}</strong>
              <span>${escapeHtml(alert.body)}</span>
              <small>${escapeHtml(formatDateTimeLabel(alert.createdAt))}</small>
            </div>
            <b>${alert.status === "sent" ? "확인 가능" : "처리중"}</b>
          </article>`)
        .join("")}
    </section>`;
}

function renderRegistrationFlow() {
  const target = $("#registrationFlow");
  if (!target) return;
  const status = memberEnrollmentStatusInfo();
  target.innerHTML = `
    <article class="member-enrollment-status ${status.tone}">
      <span>현재 계정</span>
      <strong>${escapeHtml(status.title)}</strong>
      <p>${escapeHtml(status.detail)}</p>
    </article>
    ${registrationFlows
      .map(
        (flow) => `
          <article class="flow-card">
            <strong>${flow.title}</strong>
            <p>${flow.detail}</p>
            <div>${flow.steps.map((step) => `<span>${step}</span>`).join("")}</div>
          </article>`,
      )
      .join("")}`;
}

function renderPurchasePaymentMethodSheet() {
  const options = $("#purchasePaymentMethodSheetOptions");
  if (options) options.innerHTML = purchasePaymentMethodOptionsHtml();
}

function renderMembershipPurchaseFlow() {
  const flow = purchaseFlowState();
  const container = $("#membershipPurchaseFlow");
  const browser = $("#membershipProductBrowser");
  const currentMembershipDetails = $("#currentMembershipDetails");
  const supportDetails = $("#membershipSupportDetails");
  if (!container) return;
  const purchaseFlowVisible = Boolean(flow.open && activeMemberViewId() === "shopView");
  document.body.classList.toggle("purchase-flow-open", purchaseFlowVisible);
  container.hidden = !flow.open;
  if (browser) browser.hidden = flow.open;
  if (currentMembershipDetails) currentMembershipDetails.hidden = flow.open;
  if (supportDetails) supportDetails.hidden = flow.open;
  if (!flow.open) return;
  const sourceTicket = purchaseFlowSourceTicket();
  if ($("#membershipPurchaseFlowEyebrow")) $("#membershipPurchaseFlowEyebrow").textContent = sourceTicket ? "회원권 연장" : "회원권 구매";
  if ($("#membershipPurchaseFlowTitle")) $("#membershipPurchaseFlowTitle").textContent = flow.step === 4 ? "신청이 접수되었습니다" : "한 화면에서 바로 선택하세요";
  if ($("#membershipPurchaseProgress")) {
    $("#membershipPurchaseProgress").hidden = true;
    $("#membershipPurchaseProgress").innerHTML = "";
  }
  const stepHtml = flow.step === 4 ? purchaseStepFourHtml() : purchaseSinglePageHtml();
  const controls = flow.step === 4 ? "" : `
    <div class="purchase-step-actions">
      <button class="small-button" type="button" data-close-purchase-flow>취소</button>
      <button class="primary-button" type="button" data-purchase-pay ${purchaseStepCanContinue() ? "" : "disabled"}>${escapeHtml(formatWon(purchasePaymentAmount(purchaseFlowProduct() || {}, normalizeSelectedPaymentMethod())))} 결제</button>
    </div>`;
  if ($("#membershipPurchaseStep")) $("#membershipPurchaseStep").innerHTML = `${stepHtml}${controls}`;
  renderPurchasePaymentMethodSheet();
  if (flow.step !== 4 && normalizeSelectedPaymentMethod() !== "bank_transfer") preloadPortOneSdk();
}

function renderProducts() {
  renderPaymentGatewayStatus();
  renderCurrentTicketPanel();
  renderGroupAccountPanel();
  renderMemberPaymentAlerts();
  const activeProducts = membershipProducts();
  normalizeMembershipFilters(activeProducts);
  const matchingProducts = filteredMembershipProducts(activeProducts);
  const activeFamilyId = activeMembershipPresetId();
  const visibleProducts = recommendedMembershipProducts(matchingProducts, activeFamilyId);
  const matchingProductCount = activeFamilyId === "coupon"
    ? distinctMembershipProductsForFamily("coupon", matchingProducts).length
    : matchingProducts.length;
  renderMembershipProductFilters(activeProducts, matchingProducts);
  renderRegistrationFlow();
  $("#productGrid").innerHTML = visibleProducts.length
    ? `
        <section class="product-group">
          <div class="product-group-heading">
            <h3>${escapeHtml(activeFamilyId ? membershipProductFamilyDefinition(activeFamilyId).label : "조건 맞춤 회원권")}</h3>
            <span>${matchingProductCount}개 중 추천 ${visibleProducts.length}개</span>
          </div>
          <div class="product-group-grid">
            ${visibleProducts
              .map(
                (product) => `
        <article class="product-card ${product.mode}">
          <div class="product-card-summary">
            <div class="product-card-title">
              <i>${escapeHtml(product.status === "consult" ? "상담" : product.badge)}</i>
              <strong>${escapeHtml(purchaseProductDisplayTitle(product))}</strong>
            </div>
            <div class="product-meta-pills">${productUsagePills(product)}</div>
          </div>
          ${productPriceRows(product)}
          <details class="product-card-details">
            <summary>이용 조건</summary>
            <div>
              <p>${escapeHtml(product.detail)}</p>
              <small>${escapeHtml(product.rule)}</small>
              <small>${escapeHtml(productOperationNote(product))}</small>
              <small>${escapeHtml(product.coach)}</small>
            </div>
          </details>
          <button class="primary-button" type="button" data-buy-product="${product.id}">${product.status === "consult" || !product.amount ? "상담 단계로" : "이 회원권 선택"}</button>
        </article>`,
              )
              .join("")}
          </div>
        </section>`
    : memberEmptyState({
      title: "선택한 조건의 회원권이 없습니다",
      reason: "다른 이용 요일이나 수업 조건을 선택해 주세요.",
      compact: true,
    });

  const passItems = membershipPassRecords();
  const passPage = normalizePage("expired", passItems.length);
  const visiblePassItems = paginateItems(passItems, passPage);
  $("#paymentRequests").innerHTML =
    visiblePassItems
      .map(
        (pass) => `
          <article class="history-card pass-history-card ${pass.tone || "done"}">
            <div>
              <strong>${pass.title}</strong>
              <span>${pass.period}</span>
              <small>${pass.coach || "상담 후 배정"} · ${pass.unavailable ? `총 ${pass.total} / 소진 ${pass.used} / 사용 불가 · 잔여 0` : `총 ${pass.total} / 소진 ${pass.used} / 잔여 ${Math.max(0, Number(pass.remaining ?? (Number(pass.total || 0) - Number(pass.used || 0))))}`} · ${pass.paid}</small>
            </div>
            <b>${pass.status}</b>
            ${pass.note ? `<small>${pass.note}</small>` : ""}
          </article>`,
      )
      .join("") || "<p class='empty-text'>아직 만기 이용권이 없습니다.</p>";
  renderListPager("paymentRequestsPager", "expired", passPage, passItems.length);
  renderMembershipPurchaseFlow();
}

function renderPaymentGatewayStatus() {
  const target = $("#paymentGatewayStatus");
  if (!target) return;
  const selectedMethodId = normalizeSelectedPaymentMethod();
  const config = paymentGatewayConfig();
  const readyMethods = paymentMethodDefinitions
    .map((method) => paymentMethodDefinition(method.id))
    .filter((method) => isPaymentGatewayReady(method.id, config))
    .sort((left, right) => Number(left.displayOrder || 999) - Number(right.displayOrder || 999));
  const readyCount = readyMethods.length;
  const ready = readyCount > 0;
  const methodButtons = readyMethods.map((method) => {
    const selected = method.id === selectedMethodId;
    return `
      <button class="payment-method-option ${selected ? "is-selected" : ""}" type="button" data-select-payment-method="${method.id}" aria-pressed="${selected}">
        <strong>${method.label}</strong>
        <small>${method.detail}</small>
      </button>`;
  }).join("");
  target.innerHTML = `
    <article class="payment-status-card ${ready ? "ready" : "setup"}">
      <div>
        <strong>${ready ? "안전결제 연결됨" : "결제 연결 설정 필요"}</strong>
        <span>${ready ? `${readyMethods.map((method) => method.label).join("·")} 결제를 사용할 수 있습니다.` : "결제 채널 연결 후 회원권을 구매할 수 있습니다."}</span>
      </div>
      <b>${ready ? paymentMethodDefinition(selectedMethodId).shortLabel : "설정 대기"}</b>
    </article>
    <section class="payment-method-selector" aria-label="결제수단 선택">
      <div class="payment-method-selector-title">
        <strong>결제수단</strong>
        <span>${config.mode === "multi" ? "승인된 결제수단만 표시됩니다." : "현재 토스페이로 안전하게 결제합니다."}</span>
      </div>
      <div class="payment-method-segments" role="group" aria-label="결제수단">${methodButtons}</div>
    </section>`;
}
