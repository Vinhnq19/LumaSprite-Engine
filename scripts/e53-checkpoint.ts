import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '../src/quality/raster.ts';
import { json, readJson, rnd } from './e53-common.ts';

const checkpoint = 'f9c6f77';
const area = 'benchmarks/results/run/e53-checks';
const snapshot = join(area, 'rnd-checkpoint');
const archive = join(area, 'rnd-checkpoint.tar');
mkdirSync(snapshot, { recursive: true });
execFileSync('git', ['archive', '--format=tar', '--output=' + archive, checkpoint]);
execFileSync('tar', ['-xf', archive, '-C', snapshot]);
execFileSync(process.execPath, ['research/open-source/art-quality/verify.ts'], { cwd: snapshot, stdio: 'inherit' });
const evidence = readJson<{ hashes: Record<string, string>; historicalEntries: number; deterministicFiles: number }>(join(rnd, 'verification.json'));
assert.equal(evidence.historicalEntries, 805);
assert.equal(evidence.deterministicFiles, 54);
for (const [file, hash] of Object.entries(evidence.hashes)) {
  const previous = join('benchmarks/results/run/art-quality-rnd', file);
  if (existsSync(previous)) assert.equal(sha256(readFileSync(previous)), hash, file + ' frozen output');
}
for (const name of ['ink-and-bones', 'spritekiln', 'texel-color']) {
  const file = 'research/open-source/art-quality/licenses/' + name + '.txt';
  assert.deepEqual(readFileSync(file), readFileSync(join(snapshot, file)), name + ' notice');
}
json('rnd-checkpoint.json', { checkpoint, ...evidence });
