import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const root='benchmarks/results/e101/', replay='benchmarks/results/run/e101/';
const before='996b01032d346d69e808e80d2fd62d1f3efe1dd8';
const read=(path:string)=>readFileSync(path);
const json=(path:string)=>JSON.parse(read(path).toString('utf8'));
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const run=(script:string)=>execFileSync(process.execPath,[script],{encoding:'utf8'});
const audit=json(root+'checkpoint-audit.json');
const previous=json('benchmarks/results/e9h1-closeout/workspace-audit.json');
const csv=read(root+'legacy-report-audit.csv').toString('utf8').trim().split(/\r?\n/);
assert.equal(csv[0],'PATH,GIT_STATUS,HISTORICAL_REFERENCE,MANIFEST_PROTECTED,SAFE_ACTION,REASON');
const existing:string[]=previous.files.map((row:{path:string})=>row.path);
assert.deepEqual(csv.slice(1).map(row=>row.split(',')[0]),existing);
assert.deepEqual([audit.files,audit.trackedClean,audit.filesRemoved],[38,38,0]);
git('diff','--exit-code',before,'--',...existing,'src','package.json','package-lock.json',
  'benchmarks/fixtures/e9h1','benchmarks/fixtures/e9h1r','benchmarks/fixtures/e9h1-closeout',
  'benchmarks/results/e9h1','benchmarks/results/e9h1r','benchmarks/results/e9h1-closeout',
  'docs/reports/E9-H1-HYBRID-CHARACTER-PILOT.html','docs/reports/E9-H1R-ART-DIRECTED-QUALITY-REVIEW.html',
  'docs/reports/E9-H1-CLOSEOUT-ART-QUALITY-DECISION.html');

run('scripts/benchmark-e9h1-closeout.ts');
run('scripts/verify-e9h1-closeout.ts');
const retained=json('benchmarks/results/e9h1-closeout/technical-qa.json');
assert.deepEqual([retained.historical,retained.originalH1,retained.originalH1R,retained.deterministicEntries,retained.studio.images.length],[805,101,172,81,18]);
const former=json('benchmarks/results/e9h1-closeout/human-review.json');
assert.equal(former.state,'UNSIGNED');
assert.equal(former.signature,null);

run('scripts/benchmark-e101.ts');
function manifest(path:string) {
  const rows=read(path+'SHA256SUMS').toString('utf8').trim().split(/\r?\n/);
  for(const row of rows) {
    const [digest,name]=row.split('  ');
    assert.equal(sha256(read(path+name)),digest,name);
  }
  return rows.length;
}
const count=manifest(root);
assert.equal(manifest(replay),count);
assert.deepEqual(read(root+'SHA256SUMS'),read(replay+'SHA256SUMS'));
const proof=json(root+'workflow-proof.json');
const pack=json(root+'reference-pack.json');
const form=json(root+'human-review.json');
assert.equal(proof.status,'TECHNICAL_VALID');
assert.equal(sha256(read(proof.source.path)),proof.source.sha256);
assert.deepEqual([proof.refs.groups,proof.refs.candidates,proof.refs.diagnostics],[9,11,9]);
assert.equal(pack.referenceGroups.length,9);
assert.equal(form.selectedPilot,null);
assert.equal(form.architectureDecision,null);
assert.equal(form.signature,null);
assert.equal(form.e102Authorization,null);
assert.equal(form.state,'UNSIGNED');
for(const row of [...pack.candidates,...pack.diagnostics]) {
  const bytes=read(row.pngPath);
  assert.equal(sha256(bytes),row.pngSha256);
  const raster=decodePng(bytes);
  assert.deepEqual([raster.w,raster.h],row.extent);
  assert.equal(row.humanReview,'PENDING');
  assert.deepEqual(row.approvedFeatures,[]);
}
for(const row of pack.candidates) {
  assert.equal(sha256(read(row.source)),row.sourceSha256);
  assert.deepEqual(row.extent,[64,64]);
  assert.equal(row.provenance.externalArt,false);
  assert.equal(row.provenance.modelGenerated,false);
  assert.equal(row.license,null);
  assert.equal(row.licenseStatus,'INTERNAL_REVIEW_SCOPE_ONLY');
}
assert.ok(pack.diagnostics.every((x:{kind:string})=>x.kind==='DIAGNOSTIC_REFERENCE'));
const r1=json(root+'proof/r1.json'), r2=json(root+'proof/r2.json');
assert.deepEqual([r1.revision,r2.revision,r1.parent,r2.parent],[1,2,null,sha256(read(root+'proof/r1.json'))]);
assert.deepEqual([r1.anchors,r1.maskSha256,r1.provenance],[r2.anchors,r2.maskSha256,r2.provenance]);
assert.equal(proof.proof.outside,0);
assert.ok(proof.proof.changed>0);
assert.equal(proof.proof.rollbackRgbaSha256,proof.proof.revision1RgbaSha256);
assert.equal(proof.studio.samples.length,4);
assert.equal(git('-C','../LumaSprite-Studio','status','--porcelain'),'');
const qa={status:'PASS',gate:'E10_1_READY_FOR_OWNER_ART_REFERENCE_REVIEW',checkpoint:before,historical:805,
  protectedE9:{h1:101,h1r:172,closeout:81},originalStudioRoundTrips:18,deterministicEntries:count,
  legacyReports:{retained:38,manifestProtected:audit.manifestExactMatches,removed:0},
  proof:proof.proof,studio:proof.studio,referenceGroups:pack.referenceGroups.length,
  artisticOwnerApproval:'PENDING',productionRightsConfirmation:'PENDING',e102:'NOT_AUTHORIZED'};
writeFileSync(root+'technical-qa.json',JSON.stringify(qa,null,2)+'\n');
console.log({status:qa.status,gate:qa.gate,historical:805,proofFiles:count,studio:proof.studio.samples.length});
