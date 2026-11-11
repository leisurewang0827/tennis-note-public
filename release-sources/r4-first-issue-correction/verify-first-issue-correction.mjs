// Correction-only CI. No external credentials, DB or deployment access.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const FIX = Object.freeze({
  source: '30bdd59100426cc6cee740c9b52b84c1e6c10c5d',
  sourceRun: 43033784106,
  artifact: 13861437991,
  artifactSha: '26ff7deb94d407f83da4c40856bab75ac1756fd7d412f8c99f85de1357664f1e',
  recovery: '80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4',
  original: 'ddc5691f8977dadcb0091cd2a6f49122f8c82f121caab6a675e1108f8efb1063',
  install: 'e63110be73bddee0bf1cb91f58b4cda753f1b8aa4891d755c637001eab5f7b23',
  off: '06b8d930275ee7b98d2796a5decd158994f572b1d5a25f0e60967126e204feb0',
  readback: '6a4afce725c7b1c1fe09692f046fe3ffe83133e54c730b780ee17bc2bebaf6a8',
  restore: '29ad67c914d1a2efff2c8d3bfcc8f78b64eb63ab21787b426f6a02472c9715d6',
  webSeal: '7db1d490e7422665c7bfeeb20451ed134b31e13f6979bcf865899985a174346e',
});
export const STOP = "do $external$ begin raise exception 'r4_external_authority_unbound'; end $external$;";

export function checkCorrection(baseDir, correctedPath) {
  const old = readFileSync(join(baseDir,'prod-install-template-v2.sql'));
  const fix = readFileSync(correctedPath);
  assert.equal(sha(old),FIX.original,'ORIGINAL_DRIFT');
  assert.equal(sha(fix),FIX.install,'CORRECTION_DRIFT');
  const original = old.toString('utf8'), corrected = fix.toString('utf8');
  const split = text => {
    const parts = text.split('do $pre$ declare ');
    assert.equal(parts.length,2,'PREIMAGE_START');
    const rest = parts[1].split('end $pre$;');
    assert.equal(rest.length,2,'PREIMAGE_END');
    return [parts[0],rest[0],rest[1]];
  };
  const a=split(original), b=split(corrected);
  assert.equal(a[0],b[0],'OUTER_GUARD_DRIFT');
  assert.equal(a[2],b[2],'MUTATION_BODY_DRIFT');
  assert.equal(a[0].split(STOP).length,2,'EXTERNAL_STOP_MISSING');
  assert.equal(b[1].replaceAll('v_expected_routine','r').replaceAll('v_catalog_proc','p'),a[1],'NOT_VARIABLE_ONLY');
  for (const name of ['off','readback','restore']) {
    const bytes=readFileSync(join(baseDir,`prod-${name}-template-v2.sql`));
    assert.equal(sha(bytes),FIX[name],`${name.toUpperCase()}_DRIFT`);
    assert.equal(bytes.toString('utf8').split(STOP).length,2,'EXTERNAL_STOP_MISSING');
  }
  const seal=readFileSync(join(baseDir,'admin-overlay-seal-v4.json'));
  assert.equal(sha(seal),FIX.webSeal,'WEB_SEAL_DRIFT');
  assert.equal(JSON.parse(seal).recoveryDeployment,FIX.recovery,'RECOVERY_DRIFT');
  return Object.freeze({variableOnly:true,externalStopPreserved:true,oldChecksReused:true,productionWriteAllowed:false,
    webSource:FIX.source,correctedInstallSha:FIX.install});
}

if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url){
  const base = process.argv[2] ?? fileURLToPath(new URL('../r4-first-issue-candidate/',import.meta.url));
  const fixed = fileURLToPath(new URL('./prod-install-corrected.sql',import.meta.url));
  console.log(JSON.stringify(checkCorrection(base,fixed)));
}
