import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { sha256 } from '../src/quality/raster.ts';

test('published E0–E3 assets and review reports match the E3 closeout SHA-256 catalog', () => {
  const catalog = readFileSync('docs/e3-final-sha256.txt', 'utf8').trim().split(/\r?\n/);
  assert.ok(catalog.length > 400);
  for (const line of catalog) {
    const entry = /^([a-f0-9]{64})  ((?:benchmarks\/|docs\/)[^\s]+)$/.exec(line);
    assert.ok(entry, 'Malformed catalog entry ' + line);
    const [, expected, path] = entry;
    assert.equal(sha256(readFileSync(path)), expected, path);
  }
});
