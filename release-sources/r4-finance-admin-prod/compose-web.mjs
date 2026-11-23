// 현재 운영 392 산출물을 재현한 뒤, 총관리자 패널 3경로만 추가한다.
import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{join}from'node:path';
import{composeWeb as composeOwner,hash,walk}from'../r4-finance-owner-prod/compose-web.mjs';
export{hash,walk};
export function composeWeb(base,out){
 const before=composeOwner(base,out);assert.deepEqual(before.files,JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8')).baselineFiles);
 const m=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
 const files=walk(join(out,'site'));
 for(const p of ['r4-finance-admin-control.js','r4-finance-admin-control.css']){assert(!files[p]);files[p]=readFileSync(new URL(p,import.meta.url));assert.equal(hash(files[p]),m.payload[p]);}
 const old=files['index.html'].toString('utf8');assert(!old.includes('r4-finance-admin-control.'));const end=old.lastIndexOf('</body>');assert(end>=0);
 const tags='<link rel="stylesheet" href="./r4-finance-admin-control.css?v='+hash(files['r4-finance-admin-control.css']).slice(0,16)+'" />\n<script src="./r4-finance-admin-control.js?v='+hash(files['r4-finance-admin-control.js']).slice(0,16)+'"></script>\n';
 files['index.html']=Buffer.from(old.slice(0,end)+tags+old.slice(end));
 const changes=['index.html','r4-finance-admin-control.css','r4-finance-admin-control.js'];
 for(const p of changes)writeFileSync(join(out,'site',p),files[p]);
 const result={baseline:{deployment:'24ac9b9c-6a5d-4bf1-9800-4d04a858b830'},changes,prior:m.currentFiles,files:Object.fromEntries(Object.entries(files).map(([p,b])=>[p,hash(b)]))};
 assert.equal(Object.keys(result.files).length,184);assert.equal(result.files['shared/config.local.js'],before.files['shared/config.local.js']);
 writeFileSync(join(out,'seal.json'),JSON.stringify(result,null,2)+'\n');return result;
}
