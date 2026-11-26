import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sha256 } from '../src/quality/raster.ts';

export const e53Commit = '7fa1f23';
export function archiveE53() {
  const work = resolve('benchmarks/results/run/e54-checks');
  const source = join(work, 'e53-checkpoint');
  const archive = join(work, 'e53-checkpoint.tar');
  const ready = join(source, '.e53-commit');
  if (!existsSync(ready)) {
    mkdirSync(source, { recursive: true });
    execFileSync('git', ['archive', '--format=tar', '--output=' + archive, e53Commit]);
    execFileSync('tar', ['-xf', archive, '-C', source]);
    writeFileSync(ready, e53Commit);
  }
  const pin = JSON.parse(readFileSync(join(source, 'benchmarks/fixtures/e53/w2-hybrid.json'), 'utf8')) as { baseSha256: string };
  const evidence = JSON.parse(readFileSync(join(source, 'docs/e53-evidence.json'), 'utf8')) as { artifacts: Record<string, string> };
  for (const [file, digest] of [['benchmarks/fixtures/e52/w2.json', pin.baseSha256],
    ['benchmarks/fixtures/e53/w2-hybrid.json', evidence.artifacts['hybrid/package/animation-spec.json']]]) {
    const fixture = join(source, file);
    const original = readFileSync(fixture, 'utf8');
    // Archive checkout can change line endings. Recover only the exact pinned bytes in scratch.
    const lf = original.replaceAll('\r\n', '\n');
    const bytes = [original, lf, lf.replaceAll('\n', '\r\n')].find(value => sha256(value) === digest);
    assert.ok(bytes, 'Archived fixture differs at ' + file);
    if (bytes !== original) writeFileSync(fixture, bytes);
  }
  return source;
}
