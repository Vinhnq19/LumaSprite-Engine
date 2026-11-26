import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sha256 } from '../src/quality/raster.ts';
import { output, readJson } from './e53-common.ts';

const run = (name: string, ...args: string[]) => execFileSync(process.execPath, ['scripts/' + name + '.ts', ...args], { stdio: 'inherit' });
const files = (directory: string) => readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile()).map(entry => relative(directory, join(entry.parentPath, entry.name)).replaceAll('\\', '/')).sort();

const hashes = Object.fromEntries(readdirSync('docs').filter(file => file.endsWith('-sha256.txt')).sort().map(file => {
  const rows = readFileSync(join('docs', file), 'utf8').trim().split(/\r?\n/);
  for (const row of rows) {
    const match = /^([0-9a-f]{64})\s+(.+)$/.exec(row);
    assert.ok(match, 'Invalid checksum row in ' + file);
    assert.equal(sha256(readFileSync(match[2])), match[1], match[2]);
  }
  return [file, rows.length];
}));
const historical = Object.values(hashes).reduce((a, b) => a + b, 0);
assert.equal(historical, 805);
run('e53-checkpoint');

const regen = 'benchmarks/results/run/e53-checks/regen';
const matched: Record<string, number> = {};
mkdirSync(regen, { recursive: true });
for (const [id, count] of [['e24', 65], ['e34', 124], ['e44', 63], ['e51', 31], ['e52', 78]] as const) {
  const dir = join(regen, id);
  run('benchmark-' + id, '--out', dir);
  const names = files(dir);
  assert.equal(names.length, count, id + ' generated file count');
  for (const file of names) {
    assert.ok(readFileSync(join(dir, file)).equals(readFileSync(join('benchmarks/results', id, file))), id + '/' + file);
  }
  matched[id] = names.length;
}
const regenerate = () => {
  run('benchmark-e53');
  run('e53-color');
  return Object.fromEntries(files(output).filter(file => /\.(png|json)$/.test(file) && file !== 'rnd-checkpoint.json')
    .map(file => [file, sha256(readFileSync(join(output, file)))]));
};
const generated = regenerate();
assert.deepEqual(regenerate(), generated);
const old = readJson<{ checkpoint: string; deterministicFiles: number }>(join(output, 'rnd-checkpoint.json'));
const proof = readJson<{ playerSha256: string; mediaSha256: string; status: string; unity: string }>('docs/e53-runtime-proof.json');
assert.equal(sha256(readFileSync('scripts/e53-player.js', 'utf8').replaceAll('\r\n', '\n')), proof.playerSha256);
run('report-e53');
const runtime = readFileSync('docs/LumaSprite-Engine-E5.3-Runtime.html', 'utf8');
const media = /<script type="application\/json" id="playback-data">(.*)<\/script>/.exec(runtime)?.[1];
assert.ok(media);
assert.equal(sha256(media), proof.mediaSha256);
writeFileSync('docs/e53-evidence.json', JSON.stringify({
  checkpoint: old.checkpoint, historical, catalogs: hashes, historicalRebuilt: matched, rndFiles: old.deterministicFiles,
  e53Files: Object.keys(generated).length, artifacts: generated,
  browser: { status: proof.status, unity: proof.unity, traces: 'docs/e53-runtime-proof.json' },
}, null, 2) + '\n');
console.log(JSON.stringify({ historical, historicalRebuilt: matched, rnd: old.deterministicFiles, e53: Object.keys(generated).length }));
