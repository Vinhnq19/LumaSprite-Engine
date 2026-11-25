import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from '../src/core/renderer/png.ts';

mkdirSync('.cache', { recursive: true });
const temp = mkdtempSync(join('.cache', 'cli-'));
try {
  const out = join(temp, 'chest.png');
  const run = execFileSync(process.execPath, ['dist/cli/main.js', '--seed', '43', '--out', out], { encoding: 'utf8' });
  assert.equal(JSON.parse(run).technical, 'PASS');
  const image = decodePng(readFileSync(out));
  assert.equal(image.w, 32);
  assert.equal(image.h, 32);
  assert.equal(image.rgba.readUInt32BE(0), 0);
  const failed = spawnSync(process.execPath, ['dist/cli/main.js', '--seed', '-1', '--out', out]);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr.toString(), /seed/);
  assert.deepEqual(decodePng(readFileSync(out)), image);
  const characterOut = join(temp, 'surveyor');
  const characterRun = execFileSync(process.execPath, ['dist/cli/character.js', '--candidate', 'b', '--out', characterOut], { encoding: 'utf8' });
  assert.equal(JSON.parse(characterRun).technical, 'PASS');
  assert.equal(JSON.parse(characterRun).artistic, 'PENDING_SHAPE_REVIEW');
  const surveyor = decodePng(readFileSync(join(characterOut, 'silhouette.png')));
  assert.equal(surveyor.w, 64);
  assert.equal(surveyor.h, 64);
  assert.equal(surveyor.rgba.readUInt32BE(0), 0);
  const material = join(temp, 'surveyor-material');
  const materialRun = execFileSync(process.execPath, ['dist/cli/character.js', '--material', 'm2', '--shape-lock',
    'benchmarks/results/e42/b1-shape-lock.json', '--out', material], { encoding: 'utf8' });
  assert.equal(JSON.parse(materialRun).technical, 'PASS');
  assert.deepEqual(readFileSync(join(material, 'silhouette.png')), readFileSync('benchmarks/results/e41r/b1/silhouette.png'));
  const source = 'benchmarks/results/e44/packages/r2';
  const idle = join(temp, 'surveyor-idle');
  execFileSync(process.execPath, ['dist/cli/animation.js', '--source', source, '--spec', 'benchmarks/fixtures/e51/surveyor-idle.json', '--out', idle]);
  const verified = execFileSync(process.execPath, ['dist/cli/animation.js', '--source', source, '--verify', idle], { encoding: 'utf8' });
  assert.equal(JSON.parse(verified).frameCount, 4);
  assert.deepEqual(readFileSync(join(idle, 'timing.json')), readFileSync('benchmarks/results/e51/package/timing.json'));
  console.log('CLI smoke passed.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
