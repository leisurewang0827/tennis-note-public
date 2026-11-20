// Exact Git object checks for V16 source S and DEV executor E. No network or writes.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const BASE='8a038d4f7687190d28edc965a5a7f30001e890ef';
const PRODUCT=Object.freeze({
 'app/admin/actions/settings.js':'ac7261ccf58242697aa41d6d398e7073aa11cafe96041f574e0ce7c37738f83a',
 'app/admin/data/common.js':'b856dde5b3b84123af3cbea6165010ce51453564d2a37db6f23c98990bdbf09e',
 'app/admin/events/common.js':'ccd94e1a6fbe853f375ca8f7db29ea268fcb46775315167f9609e6b011a388a0',
 'app/admin/index.html':'cc3b9b5d6f5e0766471060e71043df358c1523c0c04398cded7dad8d7295407c',
 'app/shared/tennisnote-release-updater.js':'4c4fb51c1238f2a0819c465aba829846d3bb140c9b858e17ebe6453061504567',
 'app/tennis-note-coach-app/index.html':'3a27bd7946fb53954f2dd1d2794941281a061a4ea80e72104c6c1659ea7d492a',
 'app/tennis-note-coach-app/service-worker.js':'da23ec3d01219879d47739beae734f56997d5434e5c370fb40a938224af93e3c',
 'app/tennis-note-member-app/index.html':'81ee101b0498a2b5755eff11f46d3eeae8b7d1327b4ef2b30a38a32c2c7426d4',
 'app/tennis-note-member-app/service-worker.js':'6a47bcfb760aa6cdad83eb51b9c75e77d17b3246703623f51d853d8aa17e9dd5'
});
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{maxBuffer:20000000,env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});
const lines=b=>b.toString('utf8').trim().split('\n').filter(Boolean);
export function verifySource(source){
 assert.match(source||'',/^[a-f0-9]{40}$/);assert.equal(git('rev-list','--parents','-n','1',source).toString().trim(),source+' '+BASE);
 assert.deepEqual(lines(git('diff-tree','--no-commit-id','--name-only','-r',BASE,source)).sort(),Object.keys(PRODUCT).sort());
 for(const [p,h] of Object.entries(PRODUCT))assert.equal(hash(git('show',source+':'+p)),h,p);
 return true;
}
export {BASE,PRODUCT};
