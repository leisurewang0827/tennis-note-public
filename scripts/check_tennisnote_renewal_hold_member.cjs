/* Offline contract checks of actual private functions; no Auth/DB/provider calls. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {appSource} = require("../tests/helpers/renewal-hold-port.cjs");
const source = appSource("tennis-note-member-app");
function definition(name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, "m").exec(source);
  assert(match, `missing production function ${name}`);
  const end = source.indexOf("\n}\n", match.index);
  assert(end > match.index, `function boundary ${name}`);
  return source.slice(match.index, end + 3);
}
const names = [
  "membershipProducts", "isDirectPurchaseMembershipProduct", "purchaseFlowSourceTicket",
  "purchaseFlowProduct", "renewalProductIsForSale", "purchaseRenewalSourceIssue",
  "purchaseRenewalPaymentIssue", "blockPurchaseRenewal", "setPurchaseRevalidationNotice",
  "purchaseStepCanContinue", "purchaseContinueReason", "openMembershipPurchaseFlow",
  "selectPurchasePurpose", "selectPurchaseRenewalTicket", "selectPurchaseFamily",
  "selectPurchaseProduct", "prepareServerPayment", "startProductPayment", "completePreparedPayment",
];
for (const name of ["openMembershipPurchaseFlow", "selectPurchasePurpose"]) {
  assert(!definition(name).includes("recommendedMembershipProducts("), `${name}: no automatic product substitution`);
}
assert(!definition("purchasePurposeOptionsHtml").includes("flow.renewalTicketId = returningTicket.id"), "render must not repair an absent exact target");
assert(definition("revalidatePurchaseBeforePrepare").includes("purchaseRenewalSourceIssue()"), "post-refresh revalidation must reject hidden source");

const bootstrap = `
let state, preparedPaymentContext, counters, membershipPurchasePaymentInFlight = false;
const window = {};
const history = { state: {}, pushState() {} };
window.location = { href: 'https://fixture.invalid/' };
window.requestAnimationFrame = () => {};
const $ = () => null;
const purchaseFlowState = () => state.purchaseFlow;
const currentLiveTickets = () => state.liveTickets.filter(t => ['active','paused'].includes(t.status));
const latestPreviousMembershipTicket = () => state.expiredTickets[0] || null;
const membershipTicketCanKeepSchedule = t => t?.status === 'active';
const membershipProductFamilyId = p => p.familyId || (p.termWeeks >= 12 ? 'three-month' : 'four-week');
const membershipProductFamilyDefinition = id => ({ id: id || 'four-week', filters: {} });
const activeMembershipPresetId = () => 'four-week';
const purchaseProductFrequency = p => p.frequencyPerWeek || 1;
const membershipProductFacet = () => 'weekday';
const purchaseUsesFlexibleCouponSchedule = () => false;
const purchaseTicketLesson = () => null;
const memberScheduleTicketCoachName = () => 'Synthetic coach';
const purchaseWeekStartDate = value => value;
const purchaseEffectiveStartDate = () => 'fixture-day';
const saveSnapshot = () => { counters.snapshots++; };
const renderMembershipPurchaseFlow = () => { counters.renders++; };
const renderProducts = () => { counters.renders++; };
const showToast = text => { counters.toast = text; };
const refreshPurchaseScheduleAvailability = async () => { counters.refresh++; return true; };
const ensureMembershipPurchaseData = async () => true;
const syncMemberPaymentOptionsFromServer = async () => true;
const clearPurchaseSchedules = () => { state.purchaseFlow.preferredSchedules = []; };
const clearPurchasePaymentError = () => { state.purchaseFlow.paymentErrorCode = ''; };
const isPaymentGatewayReady = () => true;
const normalizeSelectedPaymentMethod = () => 'tosspay';
const paymentMethodIdForRequest = method => method;
const purchasePaymentAmount = () => 1;
const purchaseSelectedSchedules = () => [];
const purchaseRequiredScheduleCount = () => 0;
const purchaseSchedulesAvailableNow = () => true;
window.TennisNoteDataClient = {
  getSession: () => ({ access_token: 'synthetic-not-a-credential' }),
  invokeFunction: async (route, request) => { counters.prepare++; counters.last = request.body; return {ok: true}; }
};
function reset({ hidden = false, expired = false } = {}) {
  counters = {prepare:0, provider:0, renders:0, refresh:0, snapshots:0, toast:''};
  const product = {id:'source-product', branchId:'branch-fixture', title:'Synthetic regular', detail:'', status:hidden?'hidden':'sale', productKind:'regular', termWeeks:4, frequencyPerWeek:1};
  const other = {...product,id:'term-product',status:'sale',termWeeks:12};
  const ticket = {id:'source-ticket',productId:product.id,status:expired?'expired':'active',weeklyFrequencyStatus:'ticket_exact',productKind:'regular',coachRoleId:'coach-fixture',remaining:5};
  state = {dataMode:'live',liveMembershipProducts:[product,other],livePaymentOptions:{},liveTickets:expired?[]:[ticket],expiredTickets:expired?[ticket]:[],membershipFilters:{},selectedPaymentMethod:'tosspay',purchaseFlow:{open:true,purchasePurpose:'renew_same',renewalTicketId:ticket.id,productId:product.id,familyId:'four-week',scheduleMode:'keep',coachRoleId:'coach-fixture',preferredSchedules:[{draft:'preserve'}],discountIssueId:'stale-discount'}};
  preparedPaymentContext = {product:other,preparedPayment:{paymentId:'synthetic'},sdk:{requestPayment:async()=>{counters.provider++;}}};
  return {product,other,ticket};
}
`;

async function scenarios() {
  let checks = 0;
  const check = (condition, name) => { if (!condition) throw new Error(name); checks++; };
  const rejectsPrepare = async (product, code) => {
    let failure = '';
    try { await prepareServerPayment(product, 'synthetic', 'tosspay'); } catch (error) { failure = error.message; }
    check(failure === code, 'deterministic rejection');
    check(counters.prepare === 0 && counters.provider === 0, 'prepare/provider zero');
  };
  let fixture = reset({hidden:true});
  const baseline = JSON.stringify(state.liveTickets);
  selectPurchasePurpose('renew_same');
  check(state.purchaseFlow.productId === '', 'hidden source no fallback and stale product cleared');
  check(state.purchaseFlow.renewalTicketId === 'source-ticket', 'exact source remains selected');
  check(state.purchaseFlow.discountIssueId === '' && preparedPaymentContext === null, 'stale checkout invalidated');
  check(!purchaseStepCanContinue(), 'hidden source CTA disabled');
  check(purchaseContinueReason().includes('온라인 연장이 불가'), 'Korean reason');
  check(JSON.stringify(state.liveTickets) === baseline && state.purchaseFlow.preferredSchedules[0].draft === 'preserve', 'owned rights and draft unchanged');
  await rejectsPrepare(fixture.other, 'renewal_source_checkout_unavailable');
  await startProductPayment(fixture.other.id);
  check(counters.prepare === 0 && counters.refresh === 0, 'blocked entry does not launch checkout or directory');
  fixture = reset({hidden:true});
  check(openMembershipPurchaseFlow('source-ticket','','renew_same') === false, 'open path rejects hidden source');
  check(state.purchaseFlow.productId === '' && counters.refresh === 0, 'open path no recommendation');
  await completePreparedPayment();
  check(counters.provider === 0, 'invalidated preprepared context no provider');
  fixture = reset({hidden:true});
  await completePreparedPayment();
  check(counters.provider === 0 && preparedPaymentContext === null, 'existing preprepared context rechecks source');
  for (const sourceId of ['missing-ticket','']) {
    fixture = reset(); state.purchaseFlow.renewalTicketId = sourceId;
    selectPurchasePurpose('renew_same');
    check(state.purchaseFlow.renewalTicketId === sourceId && state.purchaseFlow.productId === '', 'no first-ticket fallback');
    check(purchaseContinueReason().includes('정확히 다시 선택'), 'missing source guidance');
    await rejectsPrepare(fixture.other, 'exact_renewal_source_ticket_required');
    fixture = reset();
    check(openMembershipPurchaseFlow(sourceId,'','renew_same') === false, 'explicit renewal open missing source rejected');
  }
  fixture = reset(); selectPurchaseRenewalTicket('missing-ticket');
  check(state.purchaseFlow.renewalTicketId === 'missing-ticket' && state.purchaseFlow.productId === '', 'stale select event does not change exact target');
  for (const status of ['hidden','consult','soldout','paused','']) {
    fixture = reset(); fixture.product.status = status;
    check(Boolean(purchaseRenewalSourceIssue()), 'non-sale source blocked: '+status);
    await rejectsPrepare(fixture.other, 'renewal_source_checkout_unavailable');
  }
  for (const policy of [{importOnly:true},{memberCheckoutVisible:false}]) {
    fixture = reset(); fixture.product.policy_settings = policy;
    await rejectsPrepare(fixture.product, 'renewal_source_checkout_unavailable');
  }
  fixture = reset(); state.liveMembershipProducts = [];
  await rejectsPrepare(fixture.product, 'renewal_source_checkout_unavailable');
  fixture = reset(); state.purchaseFlow.productId = 'stale-product';
  await rejectsPrepare(fixture.product, 'renewal_source_checkout_unavailable');
  fixture = reset(); fixture.ticket.status = 'cancelled';
  await rejectsPrepare(fixture.product, 'exact_renewal_source_ticket_required');
  fixture = reset(); fixture.ticket.refundHoldId = 'synthetic-hold';
  await rejectsPrepare(fixture.product, 'exact_renewal_source_ticket_required');
  fixture = reset(); state.liveTickets.push({...fixture.ticket,id:'other-ticket',productId:'term-product'});
  selectPurchaseRenewalTicket('other-ticket');
  check(state.purchaseFlow.renewalTicketId === 'other-ticket' && state.purchaseFlow.productId === 'term-product', 'explicit second exact ticket retained');
  fixture = reset(); selectPurchasePurpose('renew_same');
  check(purchaseStepCanContinue(), 'normal same-product renewal ready');
  await prepareServerPayment(fixture.product,'synthetic');
  check(counters.prepare === 1 && counters.last.renewalSourceTicketId === 'source-ticket', 'same-product exact prepare once');
  fixture = reset({expired:true}); selectPurchasePurpose('renew_same');
  check(purchaseFlowSourceTicket()?.id === 'source-ticket' && !purchaseRenewalSourceIssue(), 'expired exact source retained');
  await prepareServerPayment(fixture.product,'synthetic');
  check(counters.prepare === 1 && counters.last.purchasePurpose === 'renew_same', 'expired normal prepare preserved');
  fixture = reset();
  selectPurchaseFamily('three-month'); selectPurchaseProduct('term-product');
  check(state.purchaseFlow.productId === 'term-product' && state.purchaseFlow.renewalTicketId === 'source-ticket', 'explicit 4wk to 3mo choice preserved');
  await prepareServerPayment(fixture.other,'synthetic');
  check(counters.prepare === 1 && counters.last.productKey === 'term-product' && counters.last.renewalSourceTicketId === 'source-ticket', 'explicit conversion payload preserved, not server mapping proof');
  fixture = reset({hidden:true});
  selectPurchaseFamily('three-month'); selectPurchaseProduct('term-product');
  await rejectsPrepare(fixture.other, 'renewal_source_checkout_unavailable');
  for (const purpose of ['new_purchase','add_coach','one_day']) {
    fixture = reset({hidden:true}); state.purchaseFlow.purchasePurpose = purpose;
    check(purchaseRenewalSourceIssue() === null, 'unrelated purpose unchanged: '+purpose);
  }
  fixture = reset();
  await prepareServerPayment(fixture.product,'synthetic','bank_transfer');
  check(counters.prepare === 1 && counters.last.method === 'bank_transfer' && counters.last.priceType === 'cash', 'existing bank prepare method preserved');
  return {checks, realNetwork:0, databaseWrites:0};
}

const harness = bootstrap + names.map(definition).join("\n") + "\n" + scenarios.toString() + "\nscenarios();";
(async () => {
  const result = await vm.runInNewContext(harness, { console });
  console.log(`PASS node focused ${result.checks} contracts; real network/DB writes 0`);
  if (process.argv.includes("--browsers") || process.env.TENNISNOTE_TEST_BASE) {
    const {chromium, webkit} = require("playwright");
    for (const [engine, browserType] of Object.entries({chromium,webkit})) {
      const browser = await browserType.launch({headless:true});
      try {
        for (const [width,height] of [[390,844],[844,390]]) {
          for (const colorScheme of ['light','dark']) {
            const context = await browser.newContext({viewport:{width,height},colorScheme});
            await context.route('**/*', route => route.abort());
            const page = await context.newPage();
            const errors=[]; page.on('pageerror',error=>errors.push(error.message));
            const actual = await page.evaluate(harness);
            assert.equal(actual.checks,result.checks); assert.deepEqual(errors,[]);
            console.log(`PASS ${engine} ${width}x${height} ${colorScheme}: ${actual.checks} extracted-source contracts`);
            await context.close();
          }
        }
      } finally {await browser.close();}
    }
  }
})().catch(error => {console.error(error);process.exitCode=1;});
