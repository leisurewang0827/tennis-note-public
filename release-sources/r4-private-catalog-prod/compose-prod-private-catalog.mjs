// Local deterministic assembly only. No upload, config edits or writes to a checkout.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
const prodSeal='dc73cac7dde5074a073ce1d55464d809a0e4f499b26a995f5efed018ec5de2c1';
const devSeal='14f8006070bbf9cd61c6aa893143b29fcf061f3b6aa9c00e829149a6a104a0eb';
const prodOrigin='https://tennisnote-admin.pages.dev';
const devOrigin='https://r4-product-draft-qa.tennisnote-admin-dev.pages.dev';
const prodRef='cnympiwrwgouuvhaivbc',devRef='udjmiezroipctytmztwz';
const prodFp='3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a';
const devFp='63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba';
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'EXPECTED_ONE_PINNED_ANCHOR');return s.replace(a,()=>b);};
function walk(dir,prefix=''){
  const found={};
  for(const e of readdirSync(dir,{withFileTypes:true})){
    assert.ok(!e.isSymbolicLink(),'SYMLINK_NOT_ALLOWED');
    const n=prefix+e.name;
    if(e.isDirectory())Object.assign(found,walk(join(dir,e.name),n+'/'));
    else {assert.ok(e.isFile());found[n]=readFileSync(join(dir,e.name));}
  }
  return found;
}
function base(path,hash,source,count){
  const bytes=readFileSync(join(path,'seal.json'));assert.equal(sha(bytes),hash);
  const seal=JSON.parse(bytes);assert.equal(seal.source,source);
  const files=walk(join(path,'admin'));assert.equal(Object.keys(files).length,count);
  assert.deepEqual(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,sha(b)])),seal.admin);
  return files;
}
export function compose(prodDir,devDir){
  const prod=base(prodDir,prodSeal,'498cdb4167021c032bfa8fd79c1ee92ef31a4f14',172);
  const dev=base(devDir,devSeal,'e60857d8fc3f1630aed03bbaa0bf3733f69523e9',177);
  let port=dev['dev-private-catalog-admin-port.js'].toString('utf8');
  for(const [a,b] of [[devOrigin,prodOrigin],[devFp,prodFp],['bindDevPrivateCatalog','bindProdPrivateCatalog']])port=once(port,a,b);
  port=port.replaceAll('tn_r4_dev_private_catalog_','tn_r4_prod_private_catalog_');
  assert.equal((port.match(/tn_r4_prod_private_catalog_/g)||[]).length,3);
  const portHash=sha(port);
  let host=dev['r4-product-draft-host-candidate.js'].toString('utf8');
  for(const [a,b] of [[devOrigin,prodOrigin],[devRef,prodRef],["environment==='development'","environment==='production'"],
      ["config().supabaseUrl===", "config().projectFingerprint==='"+prodFp+"'&&config().supabaseUrl==="],
      ['dev-private-catalog-admin-port.js?1fb9c7175bfcf6aa','r4-prod-private-catalog-port.js?v='+portHash.slice(0,16)],
      ['TennisNoteR4ProductDraftHost','TennisNoteR4ProdPrivateCatalogHost'],['tennis-note-r4-private-catalog-pending-v2:','tennis-note-r4-prod-private-catalog-pending-v2:']])
    host=once(host,a,b);
  host=host.replaceAll('bindDevPrivateCatalog','bindProdPrivateCatalog');
  let onboarding=prod['r4-onboarding.js'].toString('utf8');
  onboarding=once(onboarding,
    '      if (row.selfServe && seoulProduction) await root.TennisNoteR4ProductionDraftHost?.open({client:ctx.client,branchId:row.branch_id,currentContext:()=>session===ctx});',
    `      if (row.selfServe && seoulProduction) {
        root.TennisNoteR4ProductionDraftHost?.close();
        const scoped = await root.TennisNoteR4ProdPrivateCatalogHost?.open({
          client:ctx.client,branchId:row.branch_id,expectedActor:ctx.actor,currentContext:()=>session===ctx,
        });
        if (!current(ctx)) return;
        if (!scoped) await root.TennisNoteR4ProductionDraftHost?.open({client:ctx.client,branchId:row.branch_id,currentContext:()=>session===ctx});
      }`);
  onboarding=once(onboarding,'      root.TennisNoteR4ProductionDraftHost?.close();\n      session = null;',
    '      root.TennisNoteR4ProductionDraftHost?.close();\n      root.TennisNoteR4ProdPrivateCatalogHost?.close();\n      session = null;');
  const token=sha(host+port+onboarding).slice(0,16);
  let index=prod['index.html'].toString('utf8');
  index=once(index,'r4-onboarding.js?v=r4-prod-workspace-a000a3108920-775152337b2ce116',
    'r4-onboarding.js?v=r4-prod-workspace-a000a3108920-'+token);
  index=once(index,'    <script src="./r4-production-draft-host.js?v=775152337b2ce116"></script>',
    '    <script src="./r4-production-draft-host.js?v=775152337b2ce116"></script>\n'+
    '    <script src="./r4-prod-private-catalog-host.js?v='+token+'"></script>');
  const delta={'index.html':Buffer.from(index),'r4-onboarding.js':Buffer.from(onboarding),
    'r4-prod-private-catalog-host.js':Buffer.from(host),'r4-prod-private-catalog-port.js':Buffer.from(port)};
  for(const k of ['shared/config.local.js','release.json','r4-admin-release.json','_worker.js','_headers','_redirects'])
    assert.ok(prod[k]&&!delta[k],'PROTECTED_ASSET_SCOPE');
  assert.ok(Object.values(delta).every(b=>!b.toString().includes(devRef)&&!b.toString().includes(devOrigin)),'DEV_ENVIRONMENT_LEAK');
  const files={...prod,...delta};
  assert.equal(Object.keys(files).length,174);
  const seal={schema:1,status:'LOCAL_CANDIDATE_NOT_DEPLOYED',prodBaseArtifact:13651365401,prodBaseSeal:prodSeal,
    testedDevSource:'e60857d8fc3f1630aed03bbaa0bf3733f69523e9',testedDevSeal:devSeal,
    sql:sha(readFileSync(new URL('./prod-private-catalog-install-off.sql',import.meta.url))),
    off:sha(readFileSync(new URL('./prod-private-catalog-emergency-off.sql',import.meta.url))),
    readback:sha(readFileSync(new URL('./prod-private-catalog-readback.sql',import.meta.url))),
    delta:Object.fromEntries(Object.entries(delta).map(([n,b])=>[n,sha(b)])),
    admin:Object.fromEntries(Object.keys(files).sort().map(n=>[n,sha(files[n])]))};
  return {files,delta,seal};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [prod,dev,out]=process.argv.slice(2);
  assert.ok(prod&&dev&&out&&!existsSync(out),'NEW_OUTPUT_DIRECTORY_REQUIRED');
  const {files,seal}=compose(prod,dev);
  for(const [n,b] of Object.entries(files)){
    const p=join(out,'admin',n);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b,{flag:'wx'});
  }
  const sealBytes=JSON.stringify(seal,null,2)+'\n';writeFileSync(join(out,'seal.json'),sealBytes,{flag:'wx'});
  console.log(JSON.stringify({assets:Object.keys(files).length,seal:sha(sealBytes),delta:seal.delta,sql:seal.sql,off:seal.off,readback:seal.readback}));
}
