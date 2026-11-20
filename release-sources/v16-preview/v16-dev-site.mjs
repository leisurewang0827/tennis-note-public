// DEV runtime selection follows the earlier protected preview's pinned config.
// Pure function; this does not generate credentials, write, or publish.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compose} from './v16-site-overlay.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const DEV_RUNTIME='2876392b257795e386dacf06b07a3ce568dcdaa27357d5e91961564e697cc3de';
const ADMIN_REDIRECT='29cdc87d91a19f8fe58d011f57e62016a04bcb41329049a4f3b222f6e87b4ac6';
export function composeDev(args, runtime, adminRedirect){
 assert(Buffer.isBuffer(runtime)&&hash(runtime)===DEV_RUNTIME,'DEV_RUNTIME_MISMATCH');
 if(args.surface==='admin')assert(Buffer.isBuffer(adminRedirect)&&hash(adminRedirect)===ADMIN_REDIRECT,'DEV_REDIRECT_MISMATCH');
 const result=compose(args),files={...result.files};
 assert(Object.hasOwn(files,'shared/config.local.js'));
 assert.notEqual(hash(files['shared/config.local.js']),DEV_RUNTIME,'PRODUCTION_RUNTIME_MISMATCH');
 files['shared/config.local.js']=runtime;
 if(args.surface==='admin')files['_redirects']=adminRedirect;
 const hashes=Object.fromEntries(Object.entries(files).map(([n,b])=>[n,hash(b)]));
 assert.equal(Object.keys(files).length,args.surface==='admin'?182:253);
 return {files,hashes,runtime:'development',changed:result.changed};
}
export {DEV_RUNTIME,ADMIN_REDIRECT};
