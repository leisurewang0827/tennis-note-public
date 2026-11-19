const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='release-sources/absence-simple-preview',m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(m.kind,'ABSENCE_SIMPLE_DEV_PREVIEW_V41');assert.equal(m.parent,'42c356e90e45824c770015b04400802b6068857f');assert.equal(m.branch,'codex/tennisnote-r4-admin-prod-candidate');assert.equal(m.previewBranch,'r4-absence-group-qa');assert.equal(m.coach.project,'tennisnote-app-dev');assert.equal(m.admin.project,'tennisnote-admin-dev');
assert.equal(Object.keys(m.coach.baseline).length,254);assert.equal(Object.keys(m.admin.baseline).length,173);assert.equal(Object.keys(m.coach.changed).length,9);assert.equal(Object.keys(m.admin.changed).length,4);
for(const mode of ['coach','admin'])for(const [name,sha] of Object.entries(m[mode].changed)){assert(m[mode].baseline[name]);assert.equal(hash(fs.readFileSync(path.join(root,'assets',mode,name))),sha,'asset mismatch '+mode+'/'+name)}
for(const n of ['_headers','_redirects','_worker.js'])assert.equal(hash(fs.readFileSync(path.join(root,'admin-controls',n))),m.admin.baseline[n]);
assert(!fs.existsSync(path.join(root,'assets/coach/shared/config.local.js')));assert(!fs.existsSync(path.join(root,'assets/admin/shared/config.local.js')));
console.log('PASS: exact preview target, 13 sealed assets, admin control hashes, no committed runtime config');
