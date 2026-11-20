// Only new legacy raw-checkout admission tests. Prior nineteen checks are not replayed.
import assert from 'node:assert/strict';import {validateCheckout} from './runner.mjs';
const names=['release-promotions/absence-v8-web/assets/admin/index.html','release-promotions/absence-v8-web/assets/admin/styles.css'];const raw=Buffer.from('same\r\n');
validateCheckout(names,{read:()=>raw,blob:()=>raw});
assert.throws(()=>validateCheckout(names,{read:()=>Buffer.from('changed'),blob:()=>raw}));
assert.throws(()=>validateCheckout(['unapproved/file'],{read:()=>raw,blob:()=>raw}));
assert.throws(()=>validateCheckout([names[0],names[1]],{read:p=>p===names[1]?Buffer.from('changed'):raw,blob:()=>raw}));
console.log(JSON.stringify({status:'V9_NEW_LEGACY_ADMISSION_PASS',checks:4,network:0,writes:0,priorNineteenReplayed:0}));
