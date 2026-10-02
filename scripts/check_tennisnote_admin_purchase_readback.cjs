// Synthetic VM contract tests. No browser/network/account/financial writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = ['actions/common.js','actions/member.js','domain/common.js','domain/payment.js','domain/tickets.js'].map(file => fs.readFileSync(path.join(__dirname, '../app/admin', file), 'utf8')).join('\n');
function extract(name) {
  let start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  const open = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw Error(`unterminated ${name}`);
}
async function main() {
  let checks = 0;
  const check = (name, value) => { assert.ok(value, name); checks++; };
  const context = { adminLiveDataState: {users:[{id:'member-a'}], tickets:[],memberDatabaseRecords:[],memberMembershipRecords:[]}, memberPaymentRecordStates:new Set(['unentered','complete','transfer_zero','incomplete']) };
  vm.createContext(context);
  for (const name of ['loadAdminPostWriteMemberRows','normalizeMemberPaymentMethod','memberPaymentRecordState','memberPaymentRecordMatchesPayload','normalizedRpcResult','memberManagementTicketMatchesPayload','memberManagementWriteVerification']) vm.runInContext(extract(name),context);
  const payload={userId:'member-a',productId:'product',totalSessions:4,usedSessions:0,remainingSessions:4,startsOn:'2040-01-01',expiresOn:'2040-02-01',ticketStatus:'active',paymentRecordState:'complete',paymentDate:'2039-12-31',paymentMethod:'cash',paymentAmount:1000};
  const ticket={serverTicketId:'ticket-a',productId:'product',total:4,used:0,remaining:4,purchased:payload.startsOn,expires:payload.expiresOn,status:'active',memberRecord:null};
  context.adminLiveDataState.tickets=[ticket];
  const result={userId:'member-a',ticketId:'ticket-a'};
  check('reproduce false negative before hydration',context.memberManagementWriteVerification('assign',payload,result)==='member_management_write_not_confirmed:assign');
  let reads=0, fallbacks=0;
  const fresh={id:'record-a',user_id:'member-a',ticket_id:'ticket-a',payment_recorded_on:payload.paymentDate,payment_method:'cash',payment_amount:1000};
  const client={async selectAllRows(table,options){
    assert.equal(this,client);assert.equal(table,'tn_member_membership_records');assert.equal(options.filters.user_id,'member-a');reads++;return [fresh];
  }};
  const fallback=()=>{fallbacks++;return []};
  await context.loadAdminPostWriteMemberRows(client,'','memberMembershipRecords','tn_member_membership_records',fallback);
  check('startup remains lazy',reads===0 && fallbacks===1);
  context.adminLiveDataState.memberMembershipRecords=[{user_id:'other-member',ticket_id:'other-ticket'},{user_id:'member-a',ticket_id:'ticket-a',payment_amount:0}];
  const rows=await context.loadAdminPostWriteMemberRows(client,'member-a','memberMembershipRecords','tn_member_membership_records',fallback);
  check('exact read once no fallback',reads===1 && fallbacks===1);
  check('unrelated cached member preserved',rows.some(x=>x.user_id==='other-member'));
  check('stale scoped record replaced',rows.filter(x=>x.ticket_id==='ticket-a').length===1 && rows.find(x=>x.ticket_id==='ticket-a').payment_amount===1000);
  ticket.memberRecord=rows.find(x=>x.ticket_id==='ticket-a');
  for(const action of ['create','assign'])check(action+' successful readback',context.memberManagementWriteVerification(action,payload,result)==='');
  check('wrong amount not concealed',context.memberManagementWriteVerification('assign',{...payload,paymentAmount:1001},result)!=='');
  check('wrong ticket not concealed',context.memberManagementWriteVerification('assign',payload,{...result,ticketId:'missing'})!=='');
  const empty=await context.loadAdminPostWriteMemberRows({selectRows:async()=>[]},'member-a','memberMembershipRecords','tn_member_membership_records',fallback);
  check('empty fresh response removes stale member',empty.every(x=>x.user_id!=='member-a'));
  ticket.memberRecord=empty.find(x=>x.ticket_id==='ticket-a')||null;
  check('missing evidence remains fail closed',context.memberManagementWriteVerification('assign',payload,result)!=='');
  for(const response of [null,[{user_id:'wrong-member'}]]) {
    await assert.rejects(context.loadAdminPostWriteMemberRows({selectRows:async()=>response},'member-a','memberMembershipRecords','tn_member_membership_records',fallback),/scope_mismatch/);checks++;
  }
  await assert.rejects(context.loadAdminPostWriteMemberRows({selectRows:async()=>{throw Error('synthetic_network_failure')}},'member-a','memberMembershipRecords','tn_member_membership_records',fallback),/synthetic_network_failure/);checks++;
  const submit=extract('submitMemberManagementForm');
  check('actual submit uses fresh scoped sync',submit.includes('syncAdminLiveData(true, { memberWriteReadbackUserId })'));
  check('hydrate precedes unchanged verification',submit.indexOf('syncAdminLiveData(true, { memberWriteReadbackUserId })')<submit.indexOf('const verificationError = memberManagementWriteVerification'));
  const sync=extract('performAdminLiveDataSync');
  check('actual sync hydrates both record arrays',sync.includes('loadAdminPostWriteMemberRows(client, options.memberWriteReadbackUserId, "memberDatabaseRecords"') && sync.includes('loadAdminPostWriteMemberRows(client, options.memberWriteReadbackUserId, "memberMembershipRecords"'));
  check('ticket exact record authority preserved',sync.includes('const memberRecord = membershipRecordByTicketId.get(ticket.id)'));
  check('readback never writes or retries purchase',!extract('loadAdminPostWriteMemberRows').match(/\.rpc\(|\.insert\(|\.update\(|\.delete\(/));
  console.log(JSON.stringify({result:'PASS',checks,mode:'source-functions VM',network:0,purchaseWrites:0}));
}
// Optional actual-entry browser lane; all transport is synthetic and external
// requests are blocked. This does not impersonate a signed administrator.
async function browserMain() {
  const http = require('node:http');
  const { chromium, webkit } = require('playwright');
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (pathname.endsWith('config.local.js')) {
      res.writeHead(200, {'Content-Type':'text/javascript'}).end('window.TENNISNOTE_CONFIG={};'); return;
    }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end(); return;
    }
    const types = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'};
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [engine, type] of Object.entries({chromium, webkit})) {
      const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const browser = await type.launch({headless:true, ...(engine === 'chromium' && fs.existsSync(chrome) ? {executablePath:chrome} : {})});
      let cases = 0;
      try {
        for (const [width,height] of [[390,844],[768,1024],[1366,900],[844,390]]) for (const theme of ['light','dark']) {
          const context = await browser.newContext({viewport:{width,height},colorScheme:theme,serviceWorkers:'block'});
          let external = 0, writes = 0, errors = 0;
          const errorKinds = [];
          await context.route('**/*', route => {
            if (!route.request().url().startsWith(origin + '/')) { external++; return route.abort(); }
            if (route.request().method() !== 'GET') { writes++; return route.abort(); }
            return route.continue();
          });
          const page = await context.newPage(); page.on('pageerror', error => {
            errors++; errorKinds.push(String(error.message).replace(/[^a-zA-Z0-9_. :]/g,'').slice(0,110));
          });
          await page.goto(origin + '/app/admin/index.html', {waitUntil:'load'});
          await page.waitForFunction(() => typeof window.loadAdminPostWriteMemberRows === 'function');
          const result = await page.evaluate(async theme => {
            document.documentElement.dataset.theme = theme;
            Object.assign(adminImportAuthState, {profile:{id:'synthetic-admin',role:'admin'}});
            // Settings/auth are test boundaries; actual roster sync, mapping,
            // exact hydration and verifier functions remain unmodified.
            loadAdminStartupSettingsFromServer = async () => {};
            state.view = 'dashboard';
            const payload = {userId:'synthetic-member',productId:'synthetic-product',totalSessions:4,usedSessions:0,remainingSessions:4,startsOn:'2040-01-01',expiresOn:'2040-02-01',ticketStatus:'active',paymentRecordState:'complete',paymentDate:'2039-12-31',paymentMethod:'cash',paymentAmount:1000};
            const ticket = {id:'synthetic-ticket',user_id:payload.userId,product_id:payload.productId,branch_id:'synthetic-branch',total_sessions:4,used_sessions:0,remaining_sessions:4,starts_on:payload.startsOn,expires_on:payload.expiresOn,status:'active',purchased_price:1000};
            const roster = {users:[{id:payload.userId,role:'member',status:'active',name:'합성 회원'}],tickets:[ticket]};
            let reads = 0, mutationCalls = 0, mode = 'fresh';
            const unexpectedRpc = [];
            const read = async (table, options = {}) => {
              if (table === 'tn_membership_products') return [{id:payload.productId,name:'합성 회원권',group_size:1,product_kind:'regular',lesson_minutes:20}];
              if (table === 'tn_branches') return [{id:'synthetic-branch',name:'합성 지점',status:'active'}];
              if (['tn_member_database_records','tn_member_membership_records'].includes(table)) {
                if (options.filters?.user_id !== payload.userId) throw Error('synthetic_scope_failure');
                reads++;
                if (mode === 'failure') throw Error('synthetic_read_failure');
                if (mode === 'empty' || table === 'tn_member_database_records') return [];
                return [{user_id:payload.userId,ticket_id:ticket.id,payment_recorded_on:payload.paymentDate,payment_method:'cash',payment_amount:1000}];
              }
              return [];
            };
            window.TennisNoteDataClient = {selectRows:read,selectAllRows:read,
              getSession:()=>({access_token:'synthetic-local-only'}),loadConfig:()=>({environment:'local'}),
              rpc:async name => {
                if (name === 'tn_admin_operational_roster_core') return roster;
                if (name === 'tn_admin_member_payment_projections') return [];
                if (name === 'tn_schedule_revision_snapshot') return {revision:'synthetic-stable'};
                mutationCalls++; unexpectedRpc.push(name); throw Error('synthetic_unexpected_rpc');
              }};
            adminLiveDataState.memberMembershipRecords = [];
            adminLiveDataState.memberDatabaseRecords = [];
            const response = {userId:payload.userId,ticketId:ticket.id};
            const initial = await performAdminLiveDataSync();
            const before = memberManagementWriteVerification('assign',payload,response);
            const startupReads = reads;
            const hydrated = await performAdminLiveDataSync({memberWriteReadbackUserId:payload.userId});
            const after = ['create','assign'].map(action=>memberManagementWriteVerification(action,payload,response));
            const mapped = adminLiveDataState.tickets.find(t=>t.serverTicketId===ticket.id);
            const wrong = memberManagementWriteVerification('assign',{...payload,paymentAmount:1001},response);
            const freshReads = reads;
            mode = 'empty';
            const emptySync = await performAdminLiveDataSync({memberWriteReadbackUserId:payload.userId});
            const missing = memberManagementWriteVerification('assign',payload,response);
            mode = 'failure';
            const failedSync = await performAdminLiveDataSync({memberWriteReadbackUserId:payload.userId});
            return {initial,before,startupReads,hydrated,after,exact: mapped?.memberRecord?.ticket_id===ticket.id,
              wrong,freshReads,emptySync,missing,failedSync,mutationCalls,unexpectedRpc};
          }, theme);
          assert.ok(result.initial && result.before.includes('write_not_confirmed'), 'browser baseline false negative');
          assert.equal(result.startupReads, 0, 'startup lazy');
          assert.ok(result.hydrated && result.after.every(v=>v==='') && result.exact, 'actual sync exact success');
          assert.equal(result.freshReads, 2, 'two exact table reads');
          assert.ok(result.wrong && result.emptySync && result.missing && result.failedSync===false, 'fail closed');
          assert.deepEqual([result.mutationCalls,external,writes,errors],[0,0,0,0], 'no writes/external/page errors '+JSON.stringify({rpc:result.unexpectedRpc,external,writes,errors,errorKinds}));
          cases++; await context.close();
        }
        console.log(JSON.stringify({result:'PASS',engine,cases,assertions:cases*6,actualEntry:true,transport:'synthetic',hosted:0,submitE2E:false}));
      } finally { await browser.close(); }
    }
  } finally { await new Promise(resolve=>server.close(resolve)); }
}
(process.argv.includes('--browser') ? browserMain() : main()).catch(error=>{
  console.error('FAIL admin purchase readback: '+String(error.message).split('\n')[0]);process.exitCode=1;
});
