import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readExactGitHubRelease } from './r4-off-only-github-admission.mjs';

const sha = x => createHash('sha256').update(x).digest('hex');
const run = promisify(execFile);
const source = '30bdd59100426cc6cee740c9b52b84c1e6c10c5d';
const project = 'tennisnote-admin';
const origin = `https://${project}.pages.dev`;
const recovery = '80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4';
const recoverySource = '81046af5ff14184585533f1a72b22f29a0298050';
const recoveryIndex = '66fb7b87c4a9984e85b462968b1682329a177bf41062656737885f659f7d1ef0';
const helperSha = 'e74e98d70cbfdc33d0d6031589365094d2f8a932d01ac40dfb642a40df7361b4';
const id = v => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const immutable = v => `https://${v.slice(0,8)}.${project}.pages.dev`;
const metadata = d => d?.deployment_trigger?.metadata;
const marker = p => `r4-off-${p.commit}-${p.operation}`;

export function classifyPages(plan, current, prior, digests) {
  const recoveryVerified = prior?.id === recovery && prior.environment === 'production' &&
    prior.latest_stage?.status === 'success' && metadata(prior)?.branch === 'main' &&
    metadata(prior)?.commit_hash === recoverySource && digests?.recoveryIndex === recoveryIndex;
  if (!id(current?.id) || !recoveryVerified || current.environment !== 'production') return null;
  const mine = metadata(current)?.commit_hash === source && metadata(current)?.commit_message === marker(plan) &&
    metadata(current)?.branch === 'main' && current.id !== recovery;
  return { candidate: plan.commit, packageSha: plan.packageSha, operation: plan.operation, project,
    id: current.id, recoveryVerified, canonicalMatchesRecovery: current.id === recovery && digests.currentIndex === recoveryIndex,
    source: mine ? source : null, publicationOperation: mine ? plan.operation : null,
    status: current.latest_stage?.status === 'success' && digests.canonicalBytes && digests.immutableBytes ? 'verified' : 'unverified',
    canonicalBytes: digests.canonicalBytes === true, immutableBytes: digests.immutableBytes === true,
    // The old canonical may remain visible while a submitted deployment is still being promoted.
    noPublicationFinal: false,
  };
}

export function bindOffOnlyPages({ checkout, assets, publisher, account, accountSha, pagesToken, githubToken, packageSha, claimOnce }) {
  if (process.env.GITHUB_ACTIONS !== 'true' || !/^[a-f0-9]{32}$/.test(account ?? '') || sha(account) !== accountSha ||
      !pagesToken || !githubToken || !/^[a-f0-9]{64}$/.test(packageSha ?? '') || typeof claimOnce !== 'function')
    throw Error('R4_PAGES_BINDINGS_UNAVAILABLE');
  const api = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`;
  const promotion = import(pathAsUrl(join(checkout,'release-promotions/r4-first-issue-admin/first-issue-admin-promotion.mjs')));
  const sealBytes = readFileSync(join(checkout, 'release-sources/r4-first-issue-candidate/admin-overlay-seal-v4.json'));
  const boundedSha = async url => {
    const res = await fetch(url, { redirect:'error', cache:'no-store', signal:AbortSignal.timeout(7000) });
    if (res.status !== 200 || !res.body) return null;
    const reader = res.body.getReader(), h = createHash('sha256');
    let n=0;
    try { for (;;) { const {done,value}=await reader.read(); if(done) return h.digest('hex');
      n+=value.length; if(n>8*1024*1024) return null; h.update(value); } }
    finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
  };
  const call = async (suffix='', method='GET') => {
    const r = await fetch(api + suffix, { method, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(20000),
      headers:{Authorization:'Bearer '+pagesToken,Accept:'application/json'} });
    if (r.status !== 200) throw Error('R4_PAGES_RESPONSE_UNKNOWN');
    const j=await r.json(); if(j.success!==true) throw Error('R4_PAGES_PROVIDER_ERROR'); return j.result;
  };
  const canonical = async () => { const v=await call(); if(v.name!==project || v.production_branch!=='main') throw Error('R4_PAGES_PROJECT');
    return v.canonical_deployment; };
  const authorized = p => p.commit===process.env.GITHUB_SHA && p.runId===Number(process.env.GITHUB_RUN_ID) &&
    p.packageSha===packageSha && readExactGitHubRelease(p,githubToken);
  const observe = async p => {
    const [current,prior,recoveryBytes] = await Promise.all([canonical(), call('/deployments/'+recovery), boundedSha(immutable(recovery)+'/')]);
    const { checkArtifact, publicAssetRoute } = await promotion;
    const seal = checkArtifact(sealBytes, assets);
    const digests = { recoveryIndex: recoveryBytes, currentIndex: await boundedSha(origin+'/') };
    if (id(current?.id) && current.id !== recovery && metadata(current)?.commit_message === marker(p) &&
        metadata(current)?.commit_hash === source && current.latest_stage?.status === 'success') {
      const selected = Object.entries(seal.assets).map(([name,want])=>[publicAssetRoute(name),want]).filter(([path])=>path!==null);
      digests.canonicalBytes = digests.immutableBytes = true;
      for(let i=0;i<selected.length;i+=8){
        const result=await Promise.all(selected.slice(i,i+8).map(async ([path,want])=>
          Promise.all([boundedSha(origin+path),boundedSha(immutable(current.id)+path)]).then(v=>v.map(x=>x===want))));
        digests.canonicalBytes &&= result.every(x=>x[0]); digests.immutableBytes &&= result.every(x=>x[1]);
        if(!digests.canonicalBytes || !digests.immutableBytes) break;
      }
    }
    return classifyPages(p,current,prior,digests);
  };
  return Object.freeze({ observe, async publish(p) {
    const helper=join(checkout,'scripts/r4_internal_registration_prod_promotion.mjs');
    if(sha(readFileSync(helper))!==helperSha) throw Error('R4_PAGES_TOOL_DRIFT');
    const {patchProductionWrangler}=await import(pathAsUrl(helper));
    const expected=patchProductionWrangler(readFileSync(new URL('./cli.js',pathAsUrl(publisher))));
    if(!Buffer.from(expected).equals(readFileSync(publisher))) throw Error('R4_PAGES_TOOL_DRIFT');
    const before=await observe(p);
    if(!before?.canonicalMatchesRecovery || await authorized(p)!==true || await claimOnce(p,'admin-publish')!==true)
      throw Error('R4_PAGES_PUBLISH_PRECONDITION');
    await run(process.execPath,[publisher,'pages','deploy',assets,`--project-name=${project}`,'--branch=main',
      '--commit-hash='+source,'--commit-dirty=false','--commit-message='+marker(p)],
    {timeout:120000,maxBuffer:512*1024,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,
      CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:pagesToken}}).catch(()=>{throw Error('R4_PAGES_POST_OUTCOME_UNKNOWN');});
  }, async restore(p, observed) {
    if(await authorized(p)!==true || await claimOnce(p,'admin-restore')!==true) throw Error('R4_PAGES_RESTORE_PRECONDITION');
    const now=await canonical();
    if(!id(now?.id) || now.id!==observed?.id || now.id===recovery || metadata(now)?.commit_message!==marker(p) ||
        metadata(now)?.commit_hash!==source) throw Error('R4_PAGES_CANONICAL_CHANGED');
    await call('/deployments/'+recovery+'/rollback','POST');
  } });
}

import { pathToFileURL as pathAsUrl } from 'node:url';
