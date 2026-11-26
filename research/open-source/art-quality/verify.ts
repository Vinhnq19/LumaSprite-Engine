import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '../../../src/quality/raster.ts';
import { json, output } from './common.ts';

let historicalEntries = 0;
for (const name of readdirSync('docs').filter(name => name.endsWith('-sha256.txt')).sort()) {
  for (const line of readFileSync(join('docs', name), 'utf8').trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
    assert.ok(match, name + ' malformed line');
    const [, hash, path] = match;
    assert.equal(sha256(readFileSync(path)), hash, path);
    historicalEntries++;
  }
}
assert.equal(historicalEntries, 805);
const run = () => {
  for (const file of ['ik', 'three-quarter', 'color']) {
    execFileSync(process.execPath, [join(import.meta.dirname, file + '.ts')], { stdio: 'inherit' });
  }
  return Object.fromEntries(readdirSync(output).filter(file => /\.(png|json)$/.test(file) &&
    !file.endsWith('-perf.json') && file !== 'verification.json').sort().map(file => [file, sha256(readFileSync(join(output, file)))]));
};
const hashes = run();
assert.deepEqual(run(), hashes);
assert.ok(Object.keys(hashes).length >= 54);
json('verification.json', { historicalEntries, repeatRuns: 2, deterministicFiles: Object.keys(hashes).length, hashes });
console.log(historicalEntries + ' historical hashes and ' + Object.keys(hashes).length + ' reproducible research files PASS');
