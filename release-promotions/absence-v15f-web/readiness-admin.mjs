// Pure read-only convergence guard. No publishing or credential access.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyAdmin({expected,assets,previous,observe,fetcher=fetch,clock=()=>performance.now(),pause=ms=>new Promise(r=>setTimeout(r,ms)),budgetMs=60000}) {
  assert.equal(expected.project,'tennisnote-admin');assert.equal(expected.branch,'main');assert.equal(expected.environment,'production');
  assert.match(expected.id,/^[a-f0-9-]{36}$/);assert.match(expected.source,/^[a-f0-9]{40}$/);assert(budgetMs>0&&budgetMs<=60000);
  const names=Object.keys(assets);assert.equal(names.length,Object.hasOwn(assets,"shared/tennisnote-absence-handoff.js")?179:178);assert.deepEqual(Object.keys(previous).sort(),names.slice().sort());
  const hosts=[`https://${expected.id.slice(0,8)}.tennisnote-admin.pages.dev`,'https://tennisnote-admin.pages.dev'];
  const work=[];for(const name of names){assert(!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').some(x=>!x||x==='.'||x==='..')&&!/[?#]/.test(name));assert.match(assets[name],/^[a-f0-9]{64}$/);assert.match(previous[name],/^[a-f0-9]{64}$/);for(const host of hosts)work.push({name,host})}
  const bind=async()=>{const x=await observe();for(const k of ['project','id','source','branch','environment'])assert.equal(x[k],expected[k],'IDENTITY_'+k);assert.equal(x.status,'success')};
  const started=clock(),deadline=started+budgetMs,proof=[];let pending=work,round=0;
  try {
  while(pending.length){await bind();assert(clock()<deadline,'READINESS_DEADLINE');const retry=[];
    for(let i=0;i<pending.length;i+=8)await Promise.all(pending.slice(i,i+8).map(async ({name,host})=>{
      assert(clock()<deadline,'READINESS_DEADLINE');const path='/'+(name.endsWith('index.html')?name.slice(0,-10):name.replace(/\.html$/,''));
      const record={name,host,path,status:null,actual:null,expected:assets[name],previous:previous[name],elapsedMs:Math.round(clock()-started)};proof.push(record);
      const r=await fetcher(host+path,{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(Math.max(1,Math.min(10000,Math.floor(deadline-clock()))))});
      record.status=r.status;record.cache={age:r.headers.get('age'),status:r.headers.get('cf-cache-status'),control:r.headers.get('cache-control')};
      if(r.status===404){proof.push({name,host,status:404,classification:'pending'});retry.push({name,host});return}
      if(name.startsWith('tennis-note-member-app/')){assert.equal(r.status,302,'REDIRECT_STATUS');assert.equal(new URL(r.headers.get('location'),host+path).href,'https://tennisnote-app.pages.dev/','REDIRECT_DRIFT');proof.push({name,host,status:302,classification:'target-redirect'});return}
      assert.equal(r.status,200,'HTTP_DENIED');const got=hash(Buffer.from(await r.arrayBuffer()));record.actual=got;
      if(got===assets[name]){proof.push({name,host,status:200,classification:'target'});return}
      if(previous[name]!==assets[name]&&got===previous[name]){proof.push({name,host,status:200,classification:'pending-previous'});retry.push({name,host});return}
      throw Error('UNKNOWN_HASH');
    }));
    pending=retry;if(pending.length){round++;assert(round<6&&clock()<deadline,'READINESS_DEADLINE');await pause(Math.min(1000*2**Math.min(round,3),Math.max(0,deadline-clock())))}
  }
  await bind();assert(clock()<deadline,'READINESS_DEADLINE');return {status:'READINESS_PASS',deploymentId:expected.id,source:expected.source,responses:names.length*2,mismatch:0,observations:proof.length,proof};
  }catch(error){error.readiness={deploymentId:expected.id,source:expected.source,elapsedMs:Math.round(clock()-started),round,proof};throw error}
}
