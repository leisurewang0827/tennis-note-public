(function installR4PhoneVerification(root, document) {
  "use strict";
  const panel = document.getElementById("r4PhoneVerification");
  const form = document.getElementById("r4PhoneVerificationForm");
  const phone = document.getElementById("r4VerificationPhone");
  const code = document.getElementById("r4VerificationCode");
  const send = document.getElementById("r4VerificationSend");
  const confirm = document.getElementById("r4VerificationConfirm");
  const note = document.getElementById("r4VerificationStatus");
  if (![panel, form, phone, code, send, confirm, note].every(Boolean)) return;
  let context = null;
  const sentUntil = new Map();
  const current = ctx => context === ctx && ctx.actor === ctx.client.sessionSubject?.();
  const e164 = value => {
    const text = String(value || "").replace(/[\s()-]/g, "");
    if (/^01[0-9]{8,9}$/.test(text)) return "+82" + text.slice(1);
    return /^\+821[0-9]{8,9}$/.test(text) ? text : "";
  };
  const authPhone = value => {
    const text = String(value || "");
    return /^\+?[1-9][0-9]{7,14}$/.test(text) ? "+" + text.replace(/^\+/, "") : "";
  };
  const confirmed = user => {
    const within = value => Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now();
    return Boolean((user.email?.trim() && within(user.email_confirmed_at))
      || (authPhone(user.phone) && within(user.phone_confirmed_at)));
  };
  function controls(ctx) {
    if (!current(ctx)) return;
    phone.disabled = ctx.busy;
    code.disabled = ctx.busy || !ctx.pending;
    send.disabled = ctx.busy || Date.now() < (sentUntil.get(ctx.actor) || 0);
    confirm.disabled = ctx.busy || !ctx.pending || ctx.pending !== e164(phone.value);
  }
  async function userFor(ctx) {
    if (!current(ctx) || ctx.client.isOnline?.() === false) throw Error("r4_session_changed");
    const user = await ctx.client.getAuthUser();
    if (!current(ctx) || user?.id !== ctx.actor) throw Error("r4_session_changed");
    return user;
  }
  async function complete(ctx) {
    if (!current(ctx)) return;
    ctx.pending = null;
    form.reset();
    panel.hidden = true;
    await ctx.onVerified();
  }
  send.addEventListener("click", async () => {
    const ctx = context;
    if (!ctx || !current(ctx) || ctx.busy || Date.now() < (sentUntil.get(ctx.actor) || 0)) return;
    const destination = e164(phone.value);
    if (!destination) { note.textContent = "휴대전화 번호를 확인해 주세요."; return; }
    ctx.busy = true;
    controls(ctx);
    note.textContent = "확인 중입니다.";
    try {
      const user = await userFor(ctx);
      if (confirmed(user)) return await complete(ctx);
      const admission = await ctx.readAdmission();
      if (!current(ctx)) return;
      if (admission?.identityVerificationEnabled !== true) throw Error("r4_phone_unavailable");
      const settings = await ctx.client.getAuthSettings();
      if (!current(ctx)) return;
      if (settings?.external?.phone !== true) throw Error("r4_phone_unavailable");
      // 응답 유실 시에도 자동 재전송하지 않는다. 서버 제한도 그대로 유지한다.
      sentUntil.set(ctx.actor, Date.now() + 60_000);
      ctx.pending = null;
      await ctx.client.requestPhoneChangeVerification(destination);
      if (!current(ctx) || destination !== e164(phone.value)) return;
      ctx.pending = destination;
      code.value = "";
      note.textContent = "문자로 받은 6자리를 입력해 주세요.";
    } catch (error) {
      if (current(ctx)) note.textContent = error.message === "r4_phone_unavailable"
        ? "문자 인증을 준비 중입니다. 잠시 후 다시 확인해 주세요."
        : "전송 결과를 확인하지 못했습니다. 잠시 후 상태를 다시 확인해 주세요.";
    } finally {
      if (current(ctx)) {
        ctx.busy = false;
        controls(ctx);
        root.clearTimeout(ctx.timer);
        ctx.timer = root.setTimeout(() => controls(ctx), Math.max(0, (sentUntil.get(ctx.actor) || 0) - Date.now()));
      }
    }
  });
  phone.addEventListener("input", () => {
    const ctx = context;
    if (!ctx || !current(ctx)) return;
    if (ctx.pending !== e164(phone.value)) { ctx.pending = null; code.value = ""; }
    controls(ctx);
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const ctx = context;
    if (!ctx || !current(ctx) || ctx.busy || !ctx.pending || ctx.pending !== e164(phone.value)) return;
    const token = code.value.trim();
    if (!/^[0-9]{6}$/.test(token)) { note.textContent = "인증번호 6자리를 입력해 주세요."; return; }
    ctx.busy = true;
    controls(ctx);
    note.textContent = "확인 중입니다.";
    try {
      await userFor(ctx);
      if (!current(ctx)) return;
      const destination = ctx.pending;
      await ctx.client.verifyPhoneChange(destination, token);
      if (!current(ctx)) return;
      code.value = "";
      const user = await userFor(ctx);
      if (authPhone(user.phone) !== destination || !user.phone_confirmed_at || !confirmed(user)) throw Error("r4_phone_not_confirmed");
      await complete(ctx);
    } catch {
      if (current(ctx)) note.textContent = "인증 상태를 확인하지 못했습니다. 번호와 유효시간을 확인해 주세요.";
    } finally {
      if (current(ctx)) { ctx.busy = false; controls(ctx); }
    }
  });
  root.TennisNoteR4PhoneVerification = Object.freeze({
    reset() {
      if (context) root.clearTimeout(context.timer);
      context = null;
      form.reset();
      panel.hidden = true;
      note.textContent = "";
    },
    async refresh({ client, onVerified, readAdmission }) {
      const actor = client?.sessionSubject?.();
      if (!actor || !client?.getAuthUser) throw Error("r4_current_identity_required");
      if (context?.actor !== actor || context.client !== client) {
        this.reset();
        context = { actor, client, onVerified, busy: false, pending: null };
      }
      const ctx = context;
      ctx.onVerified = onVerified;
      ctx.readAdmission = readAdmission || (() => client.rpc("tn_r4_prod_my_selfserve_branch", {}, { requireCurrentSession: true, retryAuth: false }));
      const user = await userFor(ctx);
      if (confirmed(user)) { panel.hidden = true; return true; }
      panel.hidden = false;
      note.textContent = "내 지점을 만들기 전에 휴대전화를 확인해 주세요.";
      controls(ctx);
      return false;
    },
  });
})(window, document);
