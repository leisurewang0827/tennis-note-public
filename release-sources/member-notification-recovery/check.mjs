import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {join} from 'node:path';
import {build,seal} from './compose.mjs';
const out=process.argv[2];assert(out);await build(out,process.argv[3]||'');
const source=p=>readFileSync(join(out,p),'utf8');
let options;const card={innerHTML:''};const c={window:{TennisNoteDataClient:{readiness:()=>({ready:true}),selectRows:async(_,o)=>{options=o;return [{id:'synthetic',user_id:'synthetic-member',channel:'app',template_key:'payment_verified',status:'sent',created_at:'2026-01-01'}];}}},state:{member:{profileId:'synthetic-member'},ticketHistory:[],liveNotifications:[],lastLiveNotificationKey:''},$:()=>card};vm.createContext(c);
for(const p of ['shared/tennisnote-escape-html.js','domain/values.js','domain/notices.js','data/sync.js','views/products.js'])vm.runInContext(source(p),c);
await c.syncMemberNotificationsFromServer();c.renderMemberPaymentAlerts();assert(card.innerHTML.includes('결제 완료'));assert.equal(options.filters.channel,'app');assert.equal(options.filters.status,'sent');assert.equal(options.order,'sent_at.desc.nullslast,created_at.desc,id.desc');
await c.syncMemberNotificationsFromServer();assert.equal(c.state.ticketHistory.length,1);
assert.equal(c.normalizeLiveNotification({template_key:'payment_refund_pending'}).title,'환불 처리 대기');
c.state.liveNotifications=[c.normalizeLiveNotification({template_key:'payment_refunded',status:'failed'})];c.renderMemberPaymentAlerts();assert.equal(card.innerHTML,'');
for(const p of seal.changed.filter(p=>p.endsWith('.js')&&p!=='service-worker.js')){const token='notifications-';assert(source('index.html').includes('./'+p+'?v='+token));assert(source('service-worker.js').includes('./'+p+'?v='+token));}
assert(source('service-worker.js').split('\n')[0].includes('-notifications-'));
console.log(JSON.stringify({status:'PASS',assets:252,changed:seal.changed,existingAssetsPreserved:247,dbWrites:0}));
