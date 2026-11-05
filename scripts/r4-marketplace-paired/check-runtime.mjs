// DEV-only config checks; never prints credential values.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const [rootArg,mode]=process.argv.slice(2);
assert.ok(rootArg&&['--synthetic','--live'].includes(mode),'expected candidate root and explicit mode');
const root=resolve(rootArg), configs=[];
for(const side of ['admin','member']){
 const text=await readFile(join(root,side,'shared/config.local.js'),'utf8');
 const core=text.match(/window\.TENNISNOTE_CONFIG\s*=\s*(\{[\s\S]*?\});/);
 const payment=text.match(/window\.TENNIS_NOTE_PAYMENT_CONFIG\s*=\s*(\{[\s\S]*?\});/);
 assert.ok(core&&payment,'configuration missing');
 const cfg=JSON.parse(core[1]), pay=JSON.parse(payment[1]);
 assert.equal(cfg.environment,'development');
 assert.equal(cfg.supabaseUrl,'https://udjmiezroipctytmztwz.supabase.co');
 const project=new URL(cfg.supabaseUrl);assert.equal(project.protocol,'https:');assert.equal(project.hostname,'udjmiezroipctytmztwz.supabase.co');
 assert.equal(cfg.projectFingerprint,createHash('sha256').update(project.hostname.split('.')[0]).digest('hex'));
 assert.equal(cfg.projectFingerprint,'63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba');
 assert.equal(pay.enabled,false);assert.equal(pay.mode,'disabled');assert.deepEqual(pay.allowedMethods,[]);assert.equal(pay.bankTransfer.enabled,false);
 assert.equal(pay.storeId,'');assert.equal(pay.channelKey,'');
 const key=cfg.supabasePublishableKey||cfg.supabaseAnonKey;
 assert.ok(typeof key==='string'&&key.length>0,'client config absent');
 assert.equal(key==='sb_publishable_r4_local_artifact_only',mode==='--synthetic','runtime mode mismatch');
 if(mode==='--live'){
  let valid=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if(!valid&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)){
   try{const [h,p,s]=key.split('.');const header=JSON.parse(Buffer.from(h,'base64url').toString('utf8')),claims=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));valid=header?.alg==='HS256'&&claims?.role==='anon'&&claims?.iss==='supabase'&&claims?.ref==='udjmiezroipctytmztwz'&&Buffer.from(s,'base64url').length===32;}catch{valid=false;}
  }
  assert.ok(valid,'public client key required');
 }
 configs.push(text);
}
assert.ok(configs[0]===configs[1],'runtime configurations differ');
console.log(JSON.stringify({status:'DEVELOPMENT_RUNTIME_CHECK_PASS',mode,projectMatch:true,paymentDisabled:true,configsEqual:true}));
