import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const [indexPath,expected]=process.argv.slice(2);
assert.match(expected||'',/^[a-f0-9]{64}$/,'pin the exact approved admin index');
const index=readFileSync(indexPath);
assert.equal(createHash('sha256').update(index).digest('hex'),expected,'base index changed');
const ui=readFileSync(new URL('../app/admin/r4-scoped-coach.js',import.meta.url));
const id=createHash('sha256').update(ui).digest('hex').slice(0,16);
const html=index.toString('utf8');
for(const key of ['r4Onboarding','r4BranchHoursPanel','r4ManagedBranch']) assert.equal(html.split('id="'+key+'"').length,2);
assert.ok(!html.includes('r4-scoped-coach.js'));
assert.equal(html.split('</body>').length,2);
assert.ok(html.indexOf('tennisnote-data-client.js')>0 && html.indexOf('tennisnote-data-client.js')<html.indexOf('</body>'));
process.stdout.write(html.replace('</body>',()=>`  <script defer src="./r4-scoped-coach.js?v=${id}"></script>\n</body>`));
