(function () {
  const config = window.TENNISNOTE_CONFIG || {};
  const configuredEnvironment = String(config.environment || "production").trim().toLowerCase();
  const supportedEnvironments = new Set(["development", "production"]);
  const environment = supportedEnvironments.has(configuredEnvironment) ? configuredEnvironment : "unsupported";
  const portalContracts = Object.freeze({
    development: Object.freeze({
      member: "https://tennisnote-app-dev.pages.dev/",
      coach: "https://tennisnote-app-dev.pages.dev/tennis-note-coach-app/",
      admin: "https://tennisnote-admin-dev.pages.dev/",
    }),
    production: Object.freeze({
      member: "https://tennisnote-app.pages.dev/",
      coach: "https://tennisnote-app.pages.dev/tennis-note-coach-app/",
      admin: "https://tennisnote-admin.pages.dev/",
    }),
  });
  const publicOriginsByEnvironment = Object.freeze({
    development: new Set(["https://tennisnote-app-dev.pages.dev", "https://tennisnote-admin-dev.pages.dev"]),
    production: new Set(["https://tennisnote-app.pages.dev", "https://tennisnote-admin.pages.dev"]),
  });

  function currentPublicEnvironment() {
    const origin = String(window.location?.origin || "").toLowerCase();
    return Object.entries(publicOriginsByEnvironment)
      .find(([, origins]) => origins.has(origin))?.[0] || "";
  }

  function resolvePortal(kind) {
    if (!supportedEnvironments.has(environment)) {
      return { ok: false, code: "runtime_environment_unsupported", url: "" };
    }
    if (!Object.prototype.hasOwnProperty.call(portalContracts[environment], kind)) {
      return { ok: false, code: "portal_kind_unsupported", url: "" };
    }
    const pageEnvironment = currentPublicEnvironment();
    if (pageEnvironment && pageEnvironment !== environment) {
      return { ok: false, code: "runtime_origin_mismatch", url: "" };
    }
    const url = new URL(portalContracts[environment][kind]);
    if (!publicOriginsByEnvironment[environment].has(url.origin)) {
      return { ok: false, code: "portal_environment_mismatch", url: "" };
    }
    return { ok: true, code: "", url: url.href };
  }

  function stableFingerprint(value) {
    let hash = 0x811c9dc5;
    for (const character of String(value || "").normalize("NFC")) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function noticeAcknowledgementKey(notice = {}) {
    const release = window.TENNIS_NOTE_RELEASE || {};
    const releaseKey = String(release.releaseId || release.version || "unversioned");
    const contentRevision = String(notice.acknowledgementRevision || "") || stableFingerprint([
      notice.id || "notice",
      notice.updatedAt || notice.updated_at || "",
      notice.title || "",
      notice.body || "",
      notice.actionLabel || notice.action_label || "",
      notice.actionUrl || notice.action_url || "",
    ].join("\u241f"));
    return `tennis-note-notice-ack:${releaseKey}:${String(notice.id || "notice")}:${contentRevision}`;
  }

  function hasNoticeAcknowledgement(notice, audience) {
    try {
      return window.sessionStorage.getItem(noticeAcknowledgementKey(notice, audience)) === "done";
    } catch {
      return false;
    }
  }

  function acknowledgeNotice(notice, audience) {
    try {
      window.sessionStorage.setItem(noticeAcknowledgementKey(notice, audience), "done");
      return true;
    } catch {
      return false;
    }
  }

  function localizeSyntheticNotice(notice = {}) {
    if (environment !== "development") return notice;
    const scan = [notice.id, notice.title, notice.body]
      .map((value) => String(value || "").normalize("NFKC").toLowerCase())
      .join(" ");
    if (!/(?:^|[^a-z])(synthetic|fixture|test(?:ing)?)(?:[^a-z]|$)/.test(scan)) return notice;
    return {
      ...notice,
      acknowledgementRevision: stableFingerprint([
        notice.id || "notice",
        notice.updatedAt || notice.updated_at || "",
        notice.title || "",
        notice.body || "",
      ].join("\u241f")),
      title: "개발 검증 안내",
      body: "서울 개발 환경의 화면 흐름을 확인하기 위한 합성 안내입니다.",
    };
  }

  window.TennisNoteRuntimeEnvironment = Object.freeze({
    environment,
    resolvePortal,
    noticeAcknowledgementKey,
    hasNoticeAcknowledgement,
    acknowledgeNotice,
    localizeSyntheticNotice,
  });
  document.documentElement.dataset.tennisnoteEnvironment = environment;
  if (environment !== "development") return;

  // The Pages builder also emits an environment banner before JavaScript loads.
  // Adopt that exact banner instead of stacking another over modal controls.
  if (window.__tennisnoteDevelopmentBanner) {
    window.__tennisnoteDevelopmentBanner();
    return;
  }
  const render = () => {
    const banners = [...document.querySelectorAll(
      '[data-tennisnote-internal-qa-banner], body > aside[role="status"][aria-label="개발계 안내"]',
    )].filter((node) => node.hasAttribute("data-tennisnote-internal-qa-banner")
      || node.textContent.trim() === "개발계 · 실제 결제·푸시 차단");
    const banner = banners.find((node) => node.hasAttribute("data-tennisnote-internal-qa-banner"))
      || banners[0] || document.createElement("aside");
    banners.filter((node) => node !== banner).forEach((duplicate) => duplicate.remove());
    banner.dataset.tennisnoteInternalQaBanner = "true";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-label", "서울 개발 내부 QA 안내");
    const copy = "서울 개발 · 내부 QA · 실제 결제·푸시 차단";
    if (banner.textContent !== copy) banner.textContent = copy;
    Object.assign(banner.style, {
      position: "sticky",
      top: "0",
      zIndex: "2147483647",
      padding: "max(8px, env(safe-area-inset-top)) 12px 8px",
      background: "#7c2d12",
      color: "#fff",
      textAlign: "center",
      font: "700 13px/1.4 system-ui, sans-serif",
    });
    if (document.body.firstElementChild !== banner) document.body.prepend(banner);
    const measure = () => {
      if (banner.isConnected) document.documentElement.style.setProperty(
        "--tn-dev-qa-banner-height", `${Math.ceil(banner.getBoundingClientRect().height)}px`,
      );
    };
    measure();
    if (!banner.dataset.tennisnoteQaMeasured) {
      banner.dataset.tennisnoteQaMeasured = "true";
      if (typeof ResizeObserver === "function") new ResizeObserver(measure).observe(banner);
      else window.addEventListener("resize", measure);
    }
  };
  const mount = () => {
    if (!document.querySelector("[data-tennisnote-dev-qa-layout]")) {
      const style = document.createElement("style");
      style.dataset.tennisnoteDevQaLayout = "single-banner-modal-safe-v1";
      // Development only. The banner owns its top safe-area; a modal reserves
      // its measured height once. Production/native fallback CSS is unchanged.
      style.textContent = `
        html[data-tennisnote-environment="development"] .lesson-edit-modal {
          top: var(--tn-dev-qa-banner-height, 0px);
          padding-top: 12px;
        }
        html[data-tennisnote-environment="development"] .lesson-edit-modal > .modal-card {
          max-height: min(92vh, 760px, calc(100dvh - var(--tn-dev-qa-banner-height, 0px) - 12px - max(12px, env(safe-area-inset-bottom))));
        }
        @media (max-width: 1024px) {
          html[data-tennisnote-environment="development"] .lesson-edit-modal > .modal-card {
            max-height: calc(100dvh - var(--tn-dev-qa-banner-height, 0px) - 12px - max(12px, env(safe-area-inset-bottom)));
          }
        }
      `;
      document.head.append(style);
    }
    render();
    new MutationObserver(render).observe(document.body, { childList: true });
  };
  window.__tennisnoteDevelopmentBanner = () => { if (document.body) render(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
