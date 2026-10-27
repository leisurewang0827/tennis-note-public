(function attachTennisNoteSettlementAdjustment(global) {
  "use strict";

  function money(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function normalized(value) {
    return String(value || "").trim().toLowerCase();
  }

  function paymentAmounts(payment = {}) {
    const grossAmount = money(payment.finalAmount ?? payment.final_amount ?? payment.amount);
    const refundedAmount = Math.min(
      grossAmount,
      money(payment.refundedAmount ?? payment.refunded_amount),
    );
    const netAmount = Math.max(0, grossAmount - refundedAmount);
    const originalSettlementBase = money(
      payment.settlementBaseAmount
        ?? payment.settlement_base_amount
        ?? payment.settlementBase
        ?? grossAmount,
    );
    const settlementBase = grossAmount > 0
      ? Math.round(originalSettlementBase * netAmount / grossAmount)
      : 0;
    return {
      grossAmount,
      refundedAmount,
      netAmount,
      originalSettlementBase,
      settlementBase,
      refundAdjusted: refundedAmount > 0,
    };
  }

  function isIncluded(payment = {}) {
    const status = normalized(payment.serverStatus || payment.status);
    const refundStatus = normalized(payment.refundStatus || payment.refund_status);
    if (["processing", "reconcile_required"].includes(refundStatus)) return false;
    const amounts = paymentAmounts(payment);
    return ["paid", "verified", "refunded"].includes(status) && amounts.netAmount > 0;
  }

  // Projection only: formulas and rounding belong to the server calculator.
  function effectiveProjection(value, scope) {
    if (!value?.ok || value.calculationVersion !== "r3_effective_settlement_v2"
      || value.scope?.branchId !== scope.branchId || value.scope?.coachRoleId !== scope.coachRoleId
      || value.scope?.settlementMonth !== scope.settlementMonth
      || !/^[0-9a-f]{64}$/.test(value.sourceFingerprint || "")
      || !Array.isArray(value.lines) || !Array.isArray(value.sourceManifest?.tickets)) {
      throw new Error("settlement_scope_or_version_mismatch");
    }
    for (const key of ["totalSettlementAmount", "ownSettlementAmount", "substituteSettlementAmount", "substituteSessionCount", "revenueAmount", "settledSessions", "settledMinutes", "paymentCount"]) {
      if (!Number.isSafeInteger(value.totals?.[key]) || value.totals[key] < 0) throw new Error("settlement_total_invalid");
    }
    if (value.totals.ownSettlementAmount + value.totals.substituteSettlementAmount !== value.totals.totalSettlementAmount) {
      throw new Error("settlement_split_total_mismatch");
    }
    const policyV2 = value.sourceManifest?.substituteContractVersion === "r3_substitute_policy_v2";
    if (!policyV2 && value.sourceManifest?.substituteContractVersion !== "r3_substitute_safe_v1"
      && value.lines.some((line) => line.lineKind === "substitute_session")) {
      throw new Error("settlement_substitute_contract_unknown");
    }
    if (policyV2 && (!Number.isSafeInteger(value.totals?.branchSubstituteExpenseAmount)
      || value.totals.branchSubstituteExpenseAmount < 0
      || value.totals.branchSubstituteExpenseAmount > value.totals.substituteSettlementAmount)) {
      throw new Error("settlement_branch_expense_total_invalid");
    }
    const lineIndexes = new Set();
    const contributions = new Set();
    const physicalSources = new Map();
    const split = { own_payment: 0, substitute_session: 0 };
    let branchExpense = 0;
    for (const line of value.lines) {
      if (!Number.isSafeInteger(line.lineIndex) || line.lineIndex <= 0 || lineIndexes.has(line.lineIndex)
        || !Object.hasOwn(split, line.lineKind)
        || !Number.isSafeInteger(line.settlementAmount) || line.settlementAmount < 0) {
        throw new Error("settlement_line_scope_mismatch");
      }
      lineIndexes.add(line.lineIndex);
      for (const key of ["settledSessions", "settledMinutes", "totalSessions", "netAmount"]) {
        if (!Number.isSafeInteger(line[key]) || line[key] < 0) throw new Error("settlement_line_scope_mismatch");
      }
      if (line.lineKind === "substitute_session" && (!line.sourceLessonId || !line.sourceSessionId || !line.sourceSubstituteAssignmentId)) {
        throw new Error("settlement_substitute_source_missing");
      }
      if (line.lineKind === "substitute_session") {
        const components = line.calculationComponents;
        const key = components?.physicalKey;
        // Server UUID/date/time keys are bounded; never normalize distinct source handles.
        if (typeof key !== "string" || !key || key.length > 512 || key !== key.trim()
          || /[\u0000-\u001f\u007f]/.test(key) || !Array.isArray(components.contributions)) {
          throw new Error("settlement_substitute_physical_key_invalid");
        }
        const source = physicalSources.get(key) || {
          lessonId: line.sourceLessonId, assignmentId: line.sourceSubstituteAssignmentId,
          payable: false, nonPayable: false,
        };
        if (source.lessonId !== line.sourceLessonId || source.assignmentId !== line.sourceSubstituteAssignmentId) {
          throw new Error("settlement_substitute_physical_source_conflict");
        }
        const exactSession = policyV2
          ? (value.sourceManifest.sessions || []).filter((item) => item.id === line.sourceSessionId)
          : [];
        if (policyV2 && (exactSession.length !== 1 || exactSession[0].lessonId !== line.sourceLessonId
          || exactSession[0].substituteAssignmentId !== line.sourceSubstituteAssignmentId
          || exactSession[0].accountingClass !== components.accountingClass)) {
          throw new Error("settlement_substitute_accounting_source_mismatch");
        }
        const excludedLesson = policyV2 && components.nonPayableDecision === true;
        if (excludedLesson) {
          const session = exactSession[0];
          const expectedReason = session.substitutePolicy === "none" ? "explicit_no_settlement"
            : session.substitutePolicy === "originalCoach" ? "recipient_original_coach" : null;
          const expectedClass = session.substitutePolicy === "none" ? "explicit_no_settlement"
            : session.substitutePolicy === "originalCoach" ? "original_coach_settlement" : null;
          const expectedKey = [session.groupAccountId || session.lessonId, session.coachRoleId,
            session.lessonDate, session.startTime].join("|");
          if (!expectedReason || session.outcome !== "completed"
            || session.coachRoleId !== scope.coachRoleId
            || session.recipientCoachRoleId === scope.coachRoleId
            || components.accountingClass !== expectedClass || key !== expectedKey
            || (components.nonPayableReason !== expectedReason
              && !(components.duplicateSharedTime === true && components.nonPayableReason == null))) {
            throw new Error("settlement_substitute_nonpayable_reason_invalid");
          }
        }
        if (components.duplicateSharedTime === true || excludedLesson) {
          if (line.settlementAmount !== 0 || line.settledSessions !== 0 || line.settledMinutes !== 0
            || components.contributions.length !== 0) {
            throw new Error("settlement_substitute_duplicate_trace_invalid");
          }
          if (excludedLesson) {
            source.nonPayable = true;
          }
        } else {
          if (line.settledSessions <= 0 || components.contributions.length === 0
            || components.contributions.some((item) => !item || item.sessionId !== line.sourceSessionId
              || item.lessonId !== line.sourceLessonId || item.substituteAssignmentId !== line.sourceSubstituteAssignmentId)) {
            throw new Error("settlement_substitute_payable_source_invalid");
          }
          source.payable = true; // A valid occurrence can have a legitimate zero-won payout.
          if (policyV2 && components.accountingClass === "branch_substitute_expense") {
            branchExpense += line.settlementAmount;
          }
        }
        physicalSources.set(key, source);
      }
      for (const item of line.calculationComponents?.contributions || []) {
        const key = item.sessionId ? `session:${item.sessionId}` : item.paymentId ? `payment:${item.paymentId}` : "";
        if (!key || contributions.has(key)) throw new Error("settlement_contribution_duplicate_or_missing");
        contributions.add(key);
      }
      split[line.lineKind] += line.settlementAmount;
    }
    if ([...physicalSources.values()].some((source) => source.payable === source.nonPayable
      || (!source.payable && !policyV2))) {
      throw new Error("settlement_substitute_duplicate_trace_orphan");
    }
    if ([...physicalSources.values()].filter((source) => source.payable).length !== value.totals.substituteSessionCount) {
      throw new Error("settlement_substitute_physical_count_mismatch");
    }
    if (policyV2 && branchExpense !== value.totals.branchSubstituteExpenseAmount) {
      throw new Error("settlement_branch_expense_total_mismatch");
    }
    if (split.own_payment !== value.totals.ownSettlementAmount || split.substitute_session !== value.totals.substituteSettlementAmount) {
      throw new Error("settlement_split_line_mismatch");
    }
    if (value.lines.reduce((sum, line) => sum + Number(line.settlementAmount), 0) !== value.totals.totalSettlementAmount) {
      throw new Error("settlement_line_total_mismatch");
    }
    const ticketById = new Map(value.sourceManifest.tickets.map((ticket) => [ticket.id, ticket]));
    if (ticketById.size !== value.sourceManifest.tickets.length || ticketById.has(undefined) || ticketById.has(null)) {
      throw new Error("settlement_ticket_source_ambiguous");
    }
    return {
      ...value, coachRoleId: scope.coachRoleId, branchId: scope.branchId,
      confirmationReady: value.confirmationReady === true,
      month: scope.settlementMonth.slice(0, 7), ruleType: "effective_periods",
      estimatedSettlement: value.totals.totalSettlementAmount,
      ownSettlement: value.totals.ownSettlementAmount,
      substituteSettlement: value.totals.substituteSettlementAmount,
      branchSubstituteExpense: policyV2 ? value.totals.branchSubstituteExpenseAmount : 0,
      substituteSessionCount: value.totals.substituteSessionCount,
      revenueAmount: value.totals.revenueAmount, settledSessions: value.totals.settledSessions,
      paymentCount: value.totals.paymentCount, settledMinutes: value.totals.settledMinutes,
      rows: value.lines.map((line) => {
        const ticket = ticketById.get(line.sourceTicketId);
        const session = policyV2 && line.lineKind === "substitute_session"
          ? (value.sourceManifest.sessions || []).find((item) => item.id === line.sourceSessionId) : null;
        if (!ticket || !Number.isSafeInteger(line.settlementAmount) || line.settlementAmount < 0) {
          throw new Error("settlement_line_scope_mismatch");
        }
        if (line.lineKind === "own_payment" && ticket.coachRoleId !== scope.coachRoleId) {
          throw new Error("settlement_line_scope_mismatch");
        }
        if (line.lineKind === "substitute_session") {
          const exact = (value.sourceManifest.assignments || []).filter((item) => item.id === line.sourceSubstituteAssignmentId);
          if (exact.length !== 1
            || exact[0].lessonId !== line.sourceLessonId || exact[0].branchId !== scope.branchId
            || exact[0].substituteCoachRoleId !== scope.coachRoleId || exact[0].originalCoachRoleId !== ticket.coachRoleId
            || !["assigned", "completed"].includes(exact[0].status)
            || (policyV2
              ? !["actual_coach", "hourly", "none"].includes(exact[0].settlementMode)
                || !session || session.substituteSettlementMode !== exact[0].settlementMode
                || (line.calculationComponents?.nonPayableDecision === true
                  ? session.recipientCoachRoleId === scope.coachRoleId
                  : session.recipientCoachRoleId !== scope.coachRoleId)
              : exact[0].settlementMode !== "actual_coach")) {
            throw new Error("settlement_substitute_source_mismatch");
          }
        }
        return { ticketId: ticket.id, userId: ticket.userId, coachRoleId: scope.coachRoleId,
          lineKind: line.lineKind, sourceLessonId: line.sourceLessonId,
          sourceSessionId: line.sourceSessionId, sourceSubstituteAssignmentId: line.sourceSubstituteAssignmentId,
          sourceIds: line.sourceIds,
          estimatedSettlement: line.settlementAmount, settledSessions: line.settledSessions,
          settledMinutes: line.settledMinutes, totalSessions: line.totalSessions,
          amount: line.netAmount, memberName: "회원권별 계산 근거", productName: "적용일별 정산",
          method: line.lineKind === "substitute_session"
            ? line.calculationComponents?.accountingClass === "branch_substitute_expense"
              ? "대타 · 지점 별도 비용 · 적용일별 조건"
              : line.calculationComponents?.nonPayableDecision === true
                ? (line.calculationComponents?.nonPayableReason === "recipient_original_coach"
                  || (line.calculationComponents?.nonPayableReason == null && session?.substitutePolicy === "originalCoach"))
                  ? "대타 · 원코치 귀속 · 0원 근거"
                  : "대타 · 지급 제외 · 0원 근거"
                : "대타 · 실제 진행 코치 · 적용일별 조건"
            : line.sourcePaymentId ? "결제 근거 보존" : "미입금 포함 · 시간제",
          calculationComponents: line.calculationComponents };
      }),
    };
  }

  function unpaidProjection(value, scope, expected) {
    const a=value?.adjustment,snapshot=value?.snapshot,validHash=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
    if(!snapshot&&value?.state==="EMPTY"&&value.scope?.branchId===scope.branchId&&value.scope?.coachRoleId===scope.coachRoleId
      &&value.scope?.settlementMonth===scope.settlementMonth&&a?.version==="r3_unpaid_adjustment_v1"&&a.head===null
      &&a.headFingerprint==="0".repeat(64)&&a.originalAmount===0&&a.finalAmount===0&&Array.isArray(a.events)&&a.events.length===0
      &&a.response===null&&typeof a.writesEnabled==="boolean"&&a.hasAnyPayout===false)return value;
    if(!a||a.version!=="r3_unpaid_adjustment_v1"||value.scope?.branchId!==scope.branchId
      ||value.scope?.coachRoleId!==scope.coachRoleId||value.scope?.settlementMonth!==scope.settlementMonth
      ||!snapshot||snapshot.snapshotId!==expected?.snapshotId||snapshot.revision!==expected?.revision
      ||snapshot.sourceFingerprint!==expected?.sourceFingerprint||!Number.isSafeInteger(a.originalAmount)
      ||a.originalAmount!==expected?.totals?.totalSettlementAmount||!Number.isSafeInteger(a.finalAmount)
      ||a.finalAmount<0||a.finalAmount>2147483647||typeof a.writesEnabled!=="boolean"||typeof a.hasAnyPayout!=="boolean"
      ||!validHash(a.headFingerprint)||!Array.isArray(a.events))throw Error("adjustment_scope_or_version_mismatch");
    let amount=a.originalAmount;const seen=new Set();
    for(const [index,event]of a.events.entries()){
      if(!event.eventId||seen.has(event.eventId)||event.revision!==index+1||!Number.isSafeInteger(event.deltaAmount)
        ||!validHash(event.headFingerprint)||!validHash(event.operationKeyHash)||typeof event.reason!=="string"
        ||event.reason.trim().length<2||event.reason.length>240)throw Error("adjustment_event_invalid");
      seen.add(event.eventId);amount+=event.deltaAmount;
      if(!Number.isSafeInteger(amount)||amount<0||amount>2147483647||event.finalAmount!==amount)throw Error("adjustment_sum_invalid");
    }
    const last=a.events.length ? a.events[a.events.length-1] : undefined;
    if(amount!==a.finalAmount||(a.head?!last||last.eventId!==a.head||last.revision!==a.revision||last.headFingerprint!==a.headFingerprint
      :a.events.length||a.headFingerprint!=="0".repeat(64)))throw Error("adjustment_head_stale");
    if(a.response&&(!a.head||a.response.headFingerprint!==a.headFingerprint||!validHash(a.response.operationKeyHash)
      ||!["acknowledged","disputed"].includes(a.response.status)
      ||(a.response.status==="acknowledged"?a.response.reason!=null:typeof a.response.reason!=="string"||a.response.reason.trim().length<2)))throw Error("adjustment_response_invalid");
    return value;
  }

  async function readUnpaidState(client,scope){
    try{
      const raw=await client.rpc("tn_monthly_settlement_adjustment_state",{b:scope.branchId,c:scope.coachRoleId,m:scope.settlementMonth});
      const value=Array.isArray(raw)?raw[0]:raw;return unpaidProjection(value,scope,value?.snapshot);
    }catch(error){
      if(String(error?.payload?.code||"")!=="PGRST202")throw error;
      return client.rpc("tn_monthly_settlement_payout_state",{target_branch_id:scope.branchId,target_coach_role_id:scope.coachRoleId,target_month:scope.settlementMonth});
    }
  }

  const unpaidControllers=new WeakMap();
  function unpaidSignature(ctx){
    return JSON.stringify([ctx.role,ctx.actorKey,ctx.scope,ctx.snapshot?.snapshotId,ctx.snapshot?.revision,ctx.snapshot?.sourceFingerprint,ctx.payload?.adjustment?.headFingerprint]);
  }
  function mountUnpaidDetail(root,factory){
    if(!root)return;
    let control=unpaidControllers.get(root);
    if(!control){
      const node=(tag,text="")=>{const el=document.createElement(tag);el.textContent=text;return el;};
      const box=node("details"),summary=node("p"),history=node("ul"),fields=node("div"),message=node("p");
      const delta=node("input"),reason=node("textarea"),answer=node("select"),submit=node("button");
      delta.type="number";delta.step="1";delta.inputMode="numeric";reason.maxLength=240;reason.rows=3;
      submit.type="button";submit.className="ghost-button";
      delta.setAttribute("aria-label","가감액");reason.setAttribute("aria-label","필수 조정 또는 이의 사유");answer.setAttribute("aria-label","최신 조정 확인");
      for(const [value,text]of [["acknowledged","최신 조정 확인"],["disputed","이의 있음"]]){const option=node("option",text);option.value=value;answer.append(option);}
      const amountLabel=node("label","가감액 (+/-원)"),reasonLabel=node("label","사유 (개인정보 없이)");
      amountLabel.append(delta);reasonLabel.append(reason);fields.append(amountLabel,answer,reasonLabel,submit);
      message.setAttribute("role","status");message.setAttribute("aria-live","polite");box.dataset.r3UnpaidAdjustment="true";box.className="r3-unpaid-adjustment";
      box.append(node("summary","정산 조정 이력"),summary,history,fields,message);root.append(box);
      control={box,summary,history,fields,message,delta,reason,answer,submit,amountLabel,reasonLabel,factory,busy:false,uncertain:false,operation:null,signature:"",lastHead:false};
      unpaidControllers.set(root,control);answer.addEventListener("change",()=>drawUnpaid(control));
      submit.addEventListener("click",()=>void saveUnpaid(control,"adjustment"));
    }
    control.factory=factory;const ctx=factory(),record=ctx?.recordButton;
    if(record&&!record.dataset.r3AdjustedCapture){
      record.dataset.r3AdjustedCapture="true";record.addEventListener("click",event=>{
        if(!control.factory()?.payload?.adjustment?.head&&!control.lastHead)return;
        event.preventDefault();event.stopImmediatePropagation();void saveUnpaid(control,"record");
      },true);
    }
    drawUnpaid(control);
  }
  function drawUnpaid(control){
    const ctx=control.factory(),a=ctx?.payload?.adjustment;control.box.hidden=!ctx?.authorized||!a||!ctx.snapshot;if(control.box.hidden)return;
    try{unpaidProjection(ctx.payload,ctx.scope,ctx.snapshot);}catch(_){control.box.hidden=true;if(ctx.recordButton)ctx.recordButton.disabled=true;return;}
    const signature=unpaidSignature(ctx);
    if(!control.busy&&signature!==control.signature){
      const identity=JSON.stringify([ctx.role,ctx.actorKey,ctx.scope,ctx.snapshot?.snapshotId,ctx.snapshot?.revision,ctx.snapshot?.sourceFingerprint]);
      if(control.identity!==identity){control.delta.value="";control.reason.value="";}
      control.identity=identity;control.signature=signature;control.operation=null;control.uncertain=false;control.message.textContent="";
    }
    control.lastHead=Boolean(a.head);const won=n=>new Intl.NumberFormat("ko-KR").format(n)+"원";
    control.summary.textContent="원본 "+won(a.originalAmount)+" · 조정 "+won(a.finalAmount-a.originalAmount)+" · 최종 "+won(a.finalAmount)+". 원본 계산은 보존됩니다.";
    control.history.replaceChildren();
    for(const event of a.events){const item=document.createElement("li");item.textContent=event.revision+"차 · "+won(event.deltaAmount)+" · "+event.reason;control.history.append(item);}
    const admin=ctx.role==="admin",response=a.response,ready=ctx.originalAck===true;
    control.amountLabel.hidden=!admin;control.answer.hidden=admin;control.reasonLabel.hidden=!admin&&control.answer.value!=="disputed";
    control.submit.textContent=control.busy?"확인 중":control.uncertain?"요청 결과 다시 확인":admin?"조정 기록 추가":"최신 조정 응답 저장";
    const locked=control.busy||!a.writesEnabled||a.hasAnyPayout||!ctx.authorized;
    control.submit.disabled=locked||(!admin&&(!a.head||response||!ready));
    for(const input of [control.delta,control.reason,control.answer])input.disabled=locked||control.uncertain;
    const derivedMessage=!a.writesEnabled?"조정 기능이 잠겨 있습니다.":a.hasAnyPayout?"지급·원복 기록이 있는 정산은 조정할 수 없습니다."
      :!admin&&!ready?"원본 계산본 확인 후 최신 조정에 응답해 주세요.":response?response.status==="acknowledged"?"최신 조정 확인 완료":"이의 확인 필요 · 지급 기록 차단"
        :a.head?"최신 조정에 대한 코치 재확인이 필요합니다.":"가감액과 필수 사유를 별도 이력으로 남깁니다.";
    // 상태에서 만든 안내만 갱신하고 요청 중·오류·저장 재조회 메시지는 보존한다.
    if(!control.message.textContent||control.message.textContent===control.derivedMessage)control.message.textContent=derivedMessage;
    control.derivedMessage=derivedMessage;
    if(ctx.recordButton&&a.head)ctx.recordButton.disabled=control.busy||control.uncertain||!ready||!a.writesEnabled||a.hasAnyPayout
      ||a.finalAmount<=0||response?.status!=="acknowledged"||ctx.payload.payout?.recordingEnabled!==true;
  }
  async function saveUnpaid(control,kind){
    if(control.busy)return false;const ctx=control.factory(),a=ctx?.payload?.adjustment;
    if(!ctx?.authorized||!a||!a.writesEnabled||a.hasAnyPayout)return false;
    try{unpaidProjection(ctx.payload,ctx.scope,ctx.snapshot);}catch(_){return false;}
    const token=ctx.client?.getSession?.()?.access_token,signature=unpaidSignature(ctx);
    if(!token||!ctx.client?.rpc||!ctx.actorKey)return false;
    const current=()=>{const next=control.factory();return next?.authorized&&next.client===ctx.client&&unpaidSignature(next)===signature&&token===next.client.getSession?.()?.access_token;};
    let rpc,extra;
    if(kind==="record"){
      const date=ctx.dateInput?.value,method=ctx.methodInput?.value;
      if(ctx.role!=="admin"||!ctx.originalAck||!a.head||a.response?.status!=="acknowledged"||a.finalAmount<=0||ctx.payload.payout?.recordingEnabled!==true
        ||!/^\d{4}-\d{2}-\d{2}$/.test(date||"")||!["bank_transfer","cash","other_manual"].includes(method))return false;
      rpc="tn_admin_record_adjusted_monthly_settlement_payout";extra={paid_on:date,method};
    }else if(ctx.role==="admin"){
      const delta=Number(control.delta.value),reason=control.reason.value.trim();
      if(control.delta.value.trim()===""||!Number.isSafeInteger(delta)||reason.length<2||reason.length>240||a.finalAmount+delta<0||a.finalAmount+delta>2147483647){
        control.message.textContent="가감액과 2~240자 사유를 확인해 주세요. 최종액은 0원 이상이어야 합니다.";return false;
      }
      rpc="tn_admin_append_monthly_settlement_adjustment";extra={delta,reason};
    }else{
      if(!ctx.originalAck||!a.head||a.response)return false;const answer=control.answer.value,reason=answer==="disputed"?control.reason.value.trim():null;
      if(!["acknowledged","disputed"].includes(answer)||(answer==="disputed"&&(!reason||reason.length<2||reason.length>240)))return false;
      rpc="tn_coach_respond_monthly_settlement_adjustment";extra={answer,reason};
    }
    const operationSignature=JSON.stringify([signature,kind,extra]);
    if(!control.operation||control.operation.signature!==operationSignature)control.operation={signature:operationSignature,key:"r3-adjust-"+global.crypto.randomUUID(),hash:""};
    const operation=control.operation;control.busy=true;control.message.textContent="요청과 서버 결과를 확인하고 있습니다.";drawUnpaid(control);let attempted=false;
    const proof=value=>{
      unpaidProjection(value,ctx.scope,ctx.snapshot);
      return rpc==="tn_admin_append_monthly_settlement_adjustment"?value.adjustment.events.some(e=>e.operationKeyHash===operation.hash&&e.deltaAmount===extra.delta&&e.reason===extra.reason)
        :rpc==="tn_coach_respond_monthly_settlement_adjustment"?value.adjustment.response?.operationKeyHash===operation.hash&&value.adjustment.response.status===extra.answer
          :value.payout?.events?.some(e=>e.operationKeyHash===operation.hash&&e.adjustmentHead===a.headFingerprint&&e.amount===a.finalAmount&&e.paidOn===extra.paid_on&&e.paymentMethod===extra.method);
    };
    try{
      if(!operation.hash){const digest=await global.crypto.subtle.digest("SHA-256",new TextEncoder().encode(operation.key));operation.hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");}
      if(!current())return false;
      if(!control.uncertain){attempted=true;await ctx.client.rpc(rpc,{b:ctx.scope.branchId,c:ctx.scope.coachRoleId,m:ctx.scope.settlementMonth,
        s:ctx.snapshot.snapshotId,r:ctx.snapshot.revision,f:ctx.snapshot.sourceFingerprint,expected_head:a.headFingerprint,...extra,op:operation.key});}
      if(!current())return false;const value=await readUnpaidState(ctx.client,ctx.scope);
      if(!current()||!proof(value))throw Error("adjustment_readback_not_proven");
      control.uncertain=false;control.delta.value="";control.reason.value="";ctx.accept(value);control.message.textContent="서버 저장과 재조회를 확인했습니다. 실제 송금은 하지 않았습니다.";return true;
    }catch(error){
      if(!current())return false;
      const rejected=/^(adjustment_(reason_required|reason_sensitive|total_invalid|delta_required|head_stale|response_conflict|latest_ack_required|payout_history_exists|writes_disabled)|approved_coach_scope_required|admin_role_required)$/.test(String(error?.payload?.message||""));
      if(attempted){try{const value=await readUnpaidState(ctx.client,ctx.scope);if(current()&&proof(value)){control.uncertain=false;control.delta.value="";control.reason.value="";ctx.accept(value);control.message.textContent="응답 유실 후 서버의 동일 요청 저장을 확인했습니다.";return true;}if(current()&&rejected){control.uncertain=false;ctx.accept(value);control.message.textContent="저장은 거절됐습니다. 최신 상태와 입력을 확인해 주세요.";return false;}}catch(_error){}control.uncertain=!rejected;}
      control.message.textContent="저장 결과를 확인하지 못했습니다. 원본과 입력은 보존하며 자동 재저장하지 않습니다.";return false;
    }finally{control.busy=false;drawUnpaid(control);}
  }

  function effectiveError(error) {
    const code = String(error?.payload?.message || error?.message || "");
    if (/lock timeout|lock_not_available|55P03/.test(code)) return "정산 근거가 변경 중입니다. 잠시 후 다시 확인해 주세요. 이번 계산은 확정하지 않았습니다.";
    if (code.includes("settlement_hold_substitute_")) return "대타 확인 필요: 배정·적용기간·지급 기준 또는 승인 근거를 확인해 주세요. 임의 금액은 계산하지 않았습니다.";
    if (code.includes("settlement_hold_")) return "확인 필요: 구매·수업·적용기간 또는 환불 조정 근거를 확인해 주세요. 임의 금액은 계산하지 않았습니다.";
    if (/scope|forbidden|authentication/.test(code)) return "현재 지점과 코치 권한을 다시 확인해 주세요.";
    return "정산 자료를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.";
  }

  global.TennisNoteSettlementAdjustment = Object.freeze({
    paymentAmounts,
    isIncluded,
    effectiveProjection,
    effectiveError,
    unpaidProjection,
    readUnpaidState,
    mountUnpaidDetail,
  });
})(window);
