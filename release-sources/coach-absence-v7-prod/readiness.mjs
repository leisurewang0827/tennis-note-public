// Read-only post-publication admission; never publishes, changes credentials or rolls back.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
export async function verifyReady({expected,assets,previous={},phase='publication',observe,fetcher=fetch,clock=()=>performance.now(),pause=ms=>new Promise(r=>setTimeout(r,ms)),budgetMs=60000}) {
  assert(expected?.project==='tennisnote-app'&&expected.environment==='production'&&expected.branch==='main','TARGET_DENIED');
  assert(/^[a-f0-9-]{36}$/.test(expected.id)&&/^[a-f0-9]{40}$/.test(expected.source),'IDENTITY_DENIED');
  assert(Number.isSafeInteger(budgetMs)&&budgetMs>0&&budgetMs<=60000,'BUDGET_DENIED');
  const hosts=[`https://${expected.id.slice(0,8)}.tennisnote-app.pages.dev`,'https://tennisnote-app.pages.dev'];
  assert(['publication','recovery'].includes(phase),'PHASE_DENIED');
  const pending=[];for(const [name,sha] of Object.entries(assets)){assert(!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').some(x=>!x||x==='.'||x==='..')&&!/[?#]/.test(name),'PATH_DENIED');assert(/^[a-f0-9]{64}$/.test(sha),'HASH_DENIED');if(Object.hasOwn(previous,name))assert(/^[a-f0-9]{64}$/.test(previous[name]),'PREVIOUS_HASH_DENIED');for(const host of hosts)pending.push({host,name,sha})}assert(pending.length>0,'EMPTY_ASSETS');
  const proof=[],started=clock(),deadline=started+budgetMs;
  const bound=async()=>{const actual=await observe();for(const k of ['project','id','source','environment','branch'])assert.equal(actual[k],expected[k],'DEPLOYMENT_MOVED_'+k);assert.equal(actual.status,'success','DEPLOYMENT_NOT_SUCCESS')};
  let round=0;
  try { while(pending.length){await bound();if(clock()>=deadline)throw Object.assign(Error('READINESS_DEADLINE'),{proof});
    const again=[];for(let i=0;i<pending.length;i+=8)await Promise.all(pending.slice(i,i+8).map(async x=>{if(clock()>=deadline)throw Object.assign(Error('READINESS_DEADLINE'),{proof});const route='/'+(x.name.endsWith('index.html')?x.name.slice(0,-10):x.name.replace(/\.html$/,''));
      let response;try{response=await fetcher(x.host+route,{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(Math.max(1,Math.min(10000,Math.floor(deadline-clock()))))})}catch{proof.push({phase,round,host:x.host,path:route,error:'NETWORK',elapsedMs:Math.round(clock()-started)});throw Error('READINESS_NETWORK')}
      const header=n=>response.headers.get(n)?.replace(/[\r\n]/g,'').slice(0,200)||null;
      const entry={phase,round,host:x.host,path:route,status:response.status,elapsedMs:Math.round(clock()-started),ray:header('cf-ray'),date:header('date'),cache:header('cf-cache-status'),age:header('age'),cacheControl:header('cache-control'),etag:header('etag'),expectedSha256:x.sha,previousSha256:previous[x.name]||null};proof.push(entry);
      if(response.status===404){entry.classification='pending-404';again.push(x);return}if(response.status!==200){entry.classification='reject-http';throw Error('READINESS_HTTP_'+response.status)}
      let actual;try{actual=digest(Buffer.from(await response.arrayBuffer()))}catch{entry.classification='reject-body-network';throw Error('READINESS_BODY_NETWORK')}entry.sha256=actual;
      if(actual===x.sha){entry.classification='target';return}
      if(Object.hasOwn(previous,x.name)&&previous[x.name]!==x.sha&&actual===previous[x.name]){entry.classification='pending-known-previous';again.push(x);return}
      entry.classification='reject-unknown-hash';throw Error('READINESS_HASH_DRIFT');
    }));pending.splice(0,pending.length,...again);
    if(pending.length){round++;if(round>=6||clock()>=deadline)throw Object.assign(Error('READINESS_DEADLINE'),{proof});await pause(Math.min(1000*2**Math.min(round,3),Math.max(0,deadline-clock())))}
  }
  await bound();if(clock()>=deadline)throw Object.assign(Error('READINESS_DEADLINE'),{proof});return {status:'READINESS_PASS',phase,deploymentId:expected.id,source:expected.source,pendingPreviousObservations:proof.filter(x=>x.classification==='pending-known-previous').length,proof,writeRequests:0};
  } catch(error){if(!error.proof)error.proof=proof;throw error}
}
