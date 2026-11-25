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
  console.log('CLI smoke passed.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
