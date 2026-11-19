// Read-only post-publication admission; never publishes, changes credentials or rolls back.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
export async function verifyReady({expected,assets,observe,fetcher=fetch,clock=()=>performance.now(),pause=ms=>new Promise(r=>setTimeout(r,ms)),budgetMs=60000}) {
  assert(expected?.project==='tennisnote-app'&&expected.environment==='production'&&expected.branch==='main','TARGET_DENIED');
  assert(/^[a-f0-9-]{36}$/.test(expected.id)&&/^[a-f0-9]{40}$/.test(expected.source),'IDENTITY_DENIED');
  assert(Number.isSafeInteger(budgetMs)&&budgetMs>0&&budgetMs<=60000,'BUDGET_DENIED');
  const hosts=[`https://${expected.id.slice(0,8)}.tennisnote-app.pages.dev`,'https://tennisnote-app.pages.dev'];
  const pending=[];for(const [name,sha] of Object.entries(assets)){assert(!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').some(x=>!x||x==='.'||x==='..')&&!/[?#]/.test(name),'PATH_DENIED');assert(/^[a-f0-9]{64}$/.test(sha),'HASH_DENIED');for(const host of hosts)pending.push({host,name,sha})}assert(pending.length>0,'EMPTY_ASSETS');
  const proof=[],started=clock(),deadline=started+budgetMs;
  const bound=async()=>{const actual=await observe();for(const k of ['project','id','source','environment','branch'])assert.equal(actual[k],expected[k],'DEPLOYMENT_MOVED_'+k);assert.equal(actual.status,'success','DEPLOYMENT_NOT_SUCCESS')};
  let round=0;
  while(pending.length){await bound();if(clock()>=deadline)throw Object.assign(Error('READINESS_DEADLINE'),{proof});
    const again=[];for(let i=0;i<pending.length;i+=8)await Promise.all(pending.slice(i,i+8).map(async x=>{if(clock()>=deadline)throw Object.assign(Error('READINESS_DEADLINE'),{proof});const route='/'+(x.name.endsWith('index.html')?x.name.slice(0,-10):x.name.replace(/\.html$/,''));
      const response=await fetcher(x.host+route,{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(Math.max(1,Math.min(10000,Math.floor(deadline-clock()))))});
      const entry={round,host:x.host,path:route,status:response.status,elapsedMs:Math.round(clock()-started),ray:response.headers.get('cf-ray')?.slice(0,100)||null};proof.push(entry);
      if(response.status===404){again.push(x);return}if(response.status!==200)throw Object.assign(Error('READINESS_HTTP_'+response.status),{proof});
      const actual=digest(Buffer.from(await response.arrayBuffer()));entry.sha256=actual;assert.equal(actual,x.sha,'READINESS_HASH_DRIFT');
    }));pending.splice(0,pending.length,...again);
    if(pending.length){round++;if(round>=6||clock()>=deadline)throw Object.assign(Error('READINESS_DEADLINE'),{proof});await pause(Math.min(1000*2**Math.min(round,3),Math.max(0,deadline-clock())))}
  }
  await bound();if(clock()>=deadline)throw Object.assign(Error('READINESS_DEADLINE'),{proof});return {status:'READINESS_PASS',deploymentId:expected.id,source:expected.source,proof,writeRequests:0};
}
