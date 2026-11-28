import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const root = 'benchmarks/results/e91/';
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const verifyManifest = (path: string, expected: number, prefix = dirname(path)) => {
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  assert.equal(lines.length, expected, path);
  for (const line of lines) {
    const [hash, relative] = line.split('  ');
    const file = join(prefix, relative);
    assert.equal(sha256(readFileSync(file)), hash, file);
  }
  return lines.length;
};
const e90 = '4b34ec262b33665a389d9ff3435423c64fdb07e7';
const parent = 'd87422e88fd83212b0493e980bf9eb2b72e294aa';
const e85 = '2933cf4675f69f8bac9d01b1be60cd07854f3896';
assert.deepEqual(git('rev-list', '--first-parent', '--max-count=3', e90).split(/\r?\n/), [e90, parent, e85]);
const historical = Object.entries<number>(readJson('docs/e53-evidence.json').catalogs)
  .reduce((count, [path, entries]) => count + verifyManifest('docs/' + path, entries, ''), 0);
assert.equal(historical, 805);
const catalogs = Object.fromEntries(Object.entries({e76r:142,e8:42,e83:52,e85:56,e90:3})
  .map(([name,count]) => [name,verifyManifest('benchmarks/results/' + name + '/SHA256SUMS', count)]));
const audit = readJson('benchmarks/results/e90/audit-evidence.json');
assert.equal(sha256(readFileSync(audit.rubricV2.file)), audit.rubricV2.sha256);
assert.equal(sha256(readFileSync('docs/reports/e90-art-quality-audit.md')), audit.auditDocSha256);
assert.equal(audit.evidencePngs.length, 30);
for (const item of audit.evidencePngs) {
  const bytes = readFileSync(item.file);
  const png = decodePng(bytes);
  assert.deepEqual([sha256(bytes),png.w,png.h],[item.sha256,item.w,item.h]);
}
const e90Html = readJson('benchmarks/results/e90/portable-verification.json');
assert.equal(sha256(readFileSync(e90Html.html)), e90Html.sha256);
const protectedPaths = ['src/generators','src/specs','src/cli','src/server','package.json','package-lock.json',
  'docs/art-quality/art-quality-rubric-v2.json', 'benchmarks/results/e90','benchmarks/results/e85',
  'benchmarks/results/e83','benchmarks/results/e8','benchmarks/results/e76r'];
git('diff','--exit-code',e90,'--',...protectedPaths);

const result = readJson(root + 'benchmark.json');
const manifestCount = verifyManifest(root + 'SHA256SUMS', Object.keys(result.files).length + 1);
const replay = 'benchmarks/results/run/e91/';
verifyManifest(replay + 'SHA256SUMS', manifestCount);
assert.deepEqual(readFileSync(replay + 'SHA256SUMS'), readFileSync(root + 'SHA256SUMS'));
const studio = readJson(root + 'studio-parity.json');
assert.equal(studio.samples.length, 9);
const summary = { historical, catalogs, e90EvidencePngs: 30, protectedPaths,
  rebuiltFiles: manifestCount, deterministic: true, studioPngs: studio.samples.length,
  sceneChecks: result.cases.reduce((count: number,row: { variants: unknown[] }) => count + row.variants.length * 2,0),
  failures: result.cases.flatMap((row: { failures: string[] }) => row.failures),
  unity: 'NOT_RUN', gameplay: 'STATIC_PLACEMENT_ONLY', human: 'HUMAN_REVIEW_PENDING' };
writeFileSync(root + 'regression-integrity.json', JSON.stringify(summary,null,2) + '\n');
console.log(summary);
