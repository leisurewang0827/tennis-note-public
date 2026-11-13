// Operational pre-push check for the shared release queue; all transport is GET.
const ownerRepo='leisurewang0827/tennis-note-public';
const statuses=['in_progress','queued','pending','waiting','requested'];
const need=(ok,reason)=>{if(!ok)throw Error(reason);};
const pathForRun=p=>String(p??'').split('@')[0];
// These immutable runs were checked by exact commit and job graph. They only
// collect review evidence and have no Cloudflare write step or shared queue.
const evidenceOnly = new Map([
  [43223731149,['24afd3baf9def07bdd8db59ccfcc03834640d907','.github/workflows/r4-first-issue-event-proof.yml']],
  [43046451534,['2d0760e8a59433113e4152cd3c4529fdd429c493','.github/workflows/r4-first-issue-correction.yml']],
  [43033784044,['30bdd59100426cc6cee740c9b52b84c1e6c10c5d','.github/workflows/r4-first-issue-binding-protected.yml']],
]);
const separateEvidence=run=>{
  const pin=evidenceOnly.get(run.id);
  return pin && run.run_attempt===1 && run.status==='waiting' && run.head_sha===pin[0] && pathForRun(run.path)===pin[1];
};

export function queueVerdict(lists,{ownRun=null}={}) {
  need(Array.isArray(lists) && lists.length===statuses.length,'QUEUE_SNAPSHOTS_INCOMPLETE');
  const seen=new Map();
  for(const snapshot of lists){
    need(Array.isArray(snapshot?.workflow_runs) && snapshot.total_count===snapshot.workflow_runs.length,
      'QUEUE_SNAPSHOT_TRUNCATED');
    for(const run of snapshot.workflow_runs){
      need(Number.isSafeInteger(run?.id) && run.id>0 && statuses.includes(run.status) &&
        /^\.github\/workflows\/[a-z0-9_.-]+\.ya?ml$/.test(pathForRun(run.path)),'QUEUE_RUN_UNCLASSIFIED');
      if(run.id!==ownRun && !separateEvidence(run))seen.set(run.id,{id:run.id,status:run.status,path:pathForRun(run.path)});
    }
  }
  // Every non-pinned legacy execution can contend for production.
  const busy=[...seen.values()].sort((a,b)=>a.id-b.id);
  return {ready:busy.length===0,busy,mutationAllowed:false};
}

export async function readQueue({token,ownRun=null,fetchRead=fetch}) {
  need(typeof token==='string' && token && !/[\r\n]/.test(token),'QUEUE_READ_TOKEN_REQUIRED');
  const origin=`https://api.github.com/repos/${ownerRepo}/actions/runs`;
  const results=await Promise.all(statuses.map(async status=>{
    const r=await fetchRead(`${origin}?status=${status}&per_page=100`,{method:'GET',redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}});
    need(r.status===200,'QUEUE_READ_UNCONFIRMED');
    return r.json();
  }));
  return queueVerdict(results,{ownRun});
}
