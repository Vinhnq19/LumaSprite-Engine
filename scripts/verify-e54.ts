import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { blit } from '../src/core/pixels/raster.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { unpackAnimationStrip } from '../src/generators/character/animation-export.ts';
import { sha256 } from '../src/quality/raster.ts';
import { archiveE53 } from './e53-archive.ts';
import { readJson } from './e53-common.ts';
import type { WalkTiming } from './benchmark-e53.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' }, history: { type: 'boolean' } } });
const scratch = 'benchmarks/results/run/e54';
const published = 'benchmarks/results/e54';
const proof = join(scratch, 'unity');
const stage = '.cache/e54-unity/Assets/E54Input';
const ids = ['surveyor', 'courier'] as const;
type Actor = (typeof ids)[number];
type Mode = 'A' | 'B';
type Scene = 'outdoor' | 'dungeon' | 'neutral';
type Case = { scene: Scene; mode: Mode; actor: Actor; speed: number; maxSlipPx: number; maxFootTickPx: number;
  maxRootTickPx: number; finalRootPx: number; footSamples: number; interiorSamples: number; probes: number;
  wraps: number; durations: number[]; pivot: number[] };
type Capture = { file: string; scene: Scene; mode: Mode; atMs: number; roots: number[]; frames: number[]; anchorX: number[]; anchorY: number[] };
type Live = { scene: Scene; mode: Mode; elapsedSeconds: number; observedFps: number; p95FrameMs: number; renderedTicks: number;
  uniqueWalkFrames: number[]; finalRoots: number[]; maxContactSlipPx: number[]; sawIdleReturn: boolean[] };
type Evidence = { unity: string; platform: string; graphics: string; renderPipeline: string; ppu: number; width: number; height: number;
  targetFps: number; cases: Case[]; captures: Capture[]; live: Live[] };
type Trace = { ms: number; inFrameMs: number; stage: string; frame: number; cycle: number; root: number;
  nearX: number; farX: number; nearPlanted: boolean; farPlanted: boolean; nearSlip: number; farSlip: number };

function put(path: string, bytes: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) assert.ok(readFileSync(path).equals(bytes), path + ' changed');
  else writeFileSync(path, bytes);
}
const save = (name: string, bytes: Buffer) => put(join(values.publish ? published : scratch, 'unity', name), bytes);
const pack = (data: unknown) => Buffer.from(JSON.stringify(data, null, 2) + '\n');
const allFiles = (dir: string) => readdirSync(dir, { withFileTypes: true, recursive: true }).filter(e => e.isFile())
  .map(e => relative(dir, join(e.parentPath, e.name)).replaceAll('\\', '/')).sort();
const verifyPack = (id: Actor) => {
  const directory = join(published, 'packages', id);
  assert.deepEqual(readFileSync(join(directory, 'manifest.json')), readFileSync(join(scratch, 'packages', id, 'manifest.json')));
  const bundle = readJson<{ files: Record<string, string>; clips: { walk: { bridgeMs: number } } }>(join(directory, 'manifest.json'));
  assert.deepEqual(allFiles(directory), [...Object.keys(bundle.files), 'manifest.json'].sort());
  for (const [path, expected] of Object.entries(bundle.files)) {
    const p = join(directory, path);
    assert.equal(sha256(readFileSync(p)), expected, p);
    assert.deepEqual(readFileSync(p), readFileSync(join(scratch, 'packages', id, path)), 'Determinism ' + p);
  }
  for (const clip of ['walk','idle']) {
    const dir = join(directory, clip);
    const timing = readJson<WalkTiming>(join(dir, 'timing.json'));
    assert.equal(timing.frames.reduce((sum, f) => sum + f.durationMs, 0), timing.totalDurationMs);
    assert.equal(timing.pivot.length, 2);
    unpackAnimationStrip(decodePng(readFileSync(join(dir, 'spritesheet.png'))), timing);
  }
  return { bundle, walk: readJson<WalkTiming>(join(directory, 'walk/timing.json')),
    idle: readJson<WalkTiming>(join(directory, 'idle/timing.json')) };
};
const actors = Object.fromEntries(ids.map(id => [id, verifyPack(id)]));
assert.deepEqual(readFileSync(join(published, 'baseline-lock.json')), readFileSync(join(scratch, 'baseline-lock.json')));

const unity = readJson<Evidence>(join(proof, 'runtime.json'));
assert.deepEqual([unity.unity, unity.platform, unity.graphics, unity.ppu, unity.width, unity.height, unity.targetFps],
  ['6000.3.21f1', 'WindowsPlayer', 'Direct3D11', 32, 320, 176, 60]);
assert.equal(new Set(unity.cases.map(c => [c.scene, c.mode, c.actor, c.speed].join('/'))).size, 36);
assert.equal(unity.cases.length, 36);
assert.equal(unity.live.length, 4);
for (const c of unity.cases) {
  const timing = actors[c.actor].walk;
  assert.deepEqual(c.durations, timing.frames.map(f => f.durationMs));
  assert.deepEqual(c.pivot, timing.pivot);
  assert.equal(c.finalRootPx, 3 * timing.rootMotion.cyclePx);
  assert.equal(c.wraps, 3);
  assert.equal(c.probes, timing.frames.length * 6);
  assert.ok(c.interiorSamples > 100 && c.footSamples >= c.interiorSamples);
  const step = timing.rootMotion.frames[0].advancePx;
  assert.deepEqual([c.maxSlipPx, c.maxRootTickPx, c.maxFootTickPx], c.mode === 'A' ? [0, step, 0] : [step, 1, step]);
}
for (const l of unity.live) {
  assert.ok(l.observedFps > 55 && l.observedFps < 65 && l.p95FrameMs < 22);
  assert.deepEqual(l.uniqueWalkFrames, [24,24]);
  assert.deepEqual(l.finalRoots, [96,72]);
  assert.deepEqual(l.maxContactSlipPx, l.mode === 'A' ? [0,0] : [4,3]);
  assert.deepEqual(l.sawIdleReturn, [true,true]);
}

const imported = readJson<{ target: string; editor: string; textures: { filter: string; compression: string; format: string;
  mipCount: number; readable: boolean; transparent: boolean }[] }>(join(proof, 'unity-import.json'));
assert.equal(imported.target, 'StandaloneWindows64');
assert.equal(imported.editor, unity.unity);
assert.equal(imported.textures.length, 9);
for (const texture of imported.textures) {
  assert.deepEqual([texture.filter, texture.compression, texture.mipCount, texture.readable], ['Point','Uncompressed',1,true]);
  assert.equal(texture.format, texture.transparent ? 'RGBA32' : 'RGB24');
}

assert.equal(unity.captures.length, 6);
const camera = unity.captures.map(({ scene, file, frames, roots, anchorX, anchorY }) => {
  const data = readFileSync(join(proof, file));
  const expected = decodePng(readFileSync(join(stage, scene + '.png')));
  ids.forEach((id, i) => {
    const timing = actors[id].walk;
    const sheet = decodePng(readFileSync(join(published, 'packages', id, 'walk/spritesheet.png')));
    const cells = unpackAnimationStrip(sheet, timing);
    blit(expected, cells[frames[i]], anchorX[i] - timing.pivot[0] + roots[i], anchorY[i] - timing.pivot[1]);
  });
  assert.deepEqual(decodePng(data), expected, file + ' disagrees with independent 1× pixel composition');
  save(file, data);
  return { file, pngSha256: sha256(data), rgbaSha256: sha256(expected.rgba), mismatchedPixels: 0 };
});
const traces = [];
for (const [i, id] of ids.entries()) for (const mode of ['A','B'] as const) {
  const name = id + '-' + mode + '-trace.json';
  const csvName = id + '-' + mode + '-trace.csv';
  const file = join(proof, name);
  const { samples } = readJson<{ samples: Trace[] }>(file);
  const { walk, idle, bundle } = actors[id];
  const enter = idle.totalDurationMs + bundle.clips.walk.bridgeMs;
  const stop = enter + 3 * walk.totalDurationMs;
  const capture = unity.captures.find(x => x.scene === 'outdoor' && x.mode === mode)!;
  const inside: Trace[] = [];
  for (const sample of samples) {
    if (sample.stage !== 'walk' && sample.stage !== 'stop-contact') continue;
    const lap = sample.ms >= stop ? 3 : Math.floor((sample.ms - enter) / walk.totalDurationMs);
    let remaining = lap === 3 ? 0 : sample.ms - enter - lap * walk.totalDurationMs;
    let index = 0;
    while (remaining >= walk.frames[index].durationMs) remaining -= walk.frames[index++].durationMs;
    assert.equal(sample.frame, index);
    assert.equal(sample.cycle, lap);
    const k = walk.rootMotion.frames[index];
    const offset = mode === 'B' && lap < 3 ? Math.floor(remaining * k.advancePx / walk.frames[index].durationMs + .5) : 0;
    const root = lap * walk.rootMotion.cyclePx + k.rootX + offset;
    assert.equal(sample.root, root);
    const x = capture.anchorX[i] - walk.pivot[0];
    for (const side of ['near','far'] as const) {
      const foot = k.feet[side];
      assert.equal(sample[`${side}X`], x + root + foot.canvas[0]);
      assert.equal(sample[`${side}Planted`], foot.state === 'planted');
      assert.equal(sample[`${side}Slip`], foot.state === 'planted' ? offset : 0);
    }
    if (remaining > 0 && (sample.nearPlanted || sample.farPlanted)) inside.push(sample);
  }
  assert.ok(inside.length > 100);
  const header = ['ms','stage','cycle','frame','inFrameMs','root','nearX','farX','nearPlanted','farPlanted','nearSlip','farSlip'] as const;
  const csv = Buffer.from(header.join(',') + '\n' + samples.map(sample =>
    header.map(key => typeof sample[key] === 'number' ? Number(sample[key]).toFixed(3) : String(sample[key])).join(',')).join('\n') + '\n');
  save(csvName, csv);
  traces.push({ file: csvName, csvSha256: sha256(csv), originalJsonSha256: sha256(readFileSync(file)), ticks: samples.length,
    interiorTicks: inside.length, midFrameExample: inside.find(s => s.farPlanted && s.inFrameMs >= 55)! });
}
for (const file of ['runtime.json','unity-import.json']) save(file, readFileSync(join(proof, file)));
const studios = Object.fromEntries(ids.flatMap(id => ['idle','walk'].map(clip => {
  const file = join('benchmarks/results/run/e54-studio', id, clip, 'parity.json');
  const info = readJson<{ studioRevision: string; exactRgba: boolean; saveReopen: string; backupRestore: string; stripPngJson: string }>(file);
  assert.equal(info.exactRgba, true);
  assert.deepEqual([info.saveReopen, info.backupRestore, info.stripPngJson], ['PASS','PASS','PASS']);
  return [id + '/' + clip, info];
})));
const summary = { unityStatus: 'UNITY_RUNTIME_PASS', selectedPlayback: 'A', camera, traces, studios };
save('evidence.json', pack(summary));

const expected = readJson<{ catalogs: Record<string, number>; historicalRebuilt: Record<string, number>; artifacts: Record<string, string> }>('docs/e53-evidence.json');
let checked = 0;
for (const [catalog, count] of Object.entries(expected.catalogs)) {
  const rows = readFileSync(join('docs', catalog), 'utf8').trim().split(/\r?\n/);
  assert.equal(rows.length, count);
  for (const row of rows) {
    const [hash, file] = row.split('  ');
    assert.equal(sha256(readFileSync(file)), hash, file);
    checked++;
  }
}
assert.equal(checked, 805);
if (values.history) {
  const base = 'benchmarks/results/run/e54-checks';
  const rebuilds: Record<string, number> = {};
  for (const [id, count] of Object.entries(expected.historicalRebuilt)) {
    const dir = join(base, 'regen', id);
    execFileSync(process.execPath, ['scripts/benchmark-' + id + '.ts', '--out', dir], { stdio: 'inherit' });
    const actual = allFiles(dir);
    assert.equal(actual.length, count);
    for (const f of actual) assert.ok(readFileSync(join(dir, f)).equals(readFileSync(join('benchmarks/results', id, f))), id + '/' + f);
    rebuilds[id] = actual.length;
  }
  const e53 = archiveE53();
  const archive = resolve(base, 'rnd-checkpoint.tar');
  const rnd = join(e53, 'benchmarks/results/run/e53-checks/rnd-checkpoint');
  mkdirSync(rnd, { recursive: true });
  execFileSync('git', ['archive','--format=tar','--output=' + archive,'f9c6f77']);
  execFileSync('tar', ['-xf',archive,'-C',rnd]);
  execFileSync(process.execPath, ['research/open-source/art-quality/verify.ts'], { cwd: rnd, stdio: 'inherit' });
  const regenerated = join(rnd, 'benchmarks/results/run/art-quality-rnd');
  const r = readJson<{ hashes: Record<string, string>; deterministicFiles: number }>(join(regenerated, 'verification.json'));
  assert.equal(r.deterministicFiles, 54);
  for (const [name, digest] of Object.entries(r.hashes)) {
    const original = join('benchmarks/results/run/art-quality-rnd', name);
    if (existsSync(original)) assert.equal(sha256(readFileSync(original)), digest, original);
  }
  for (const script of ['benchmark-e53','e53-color']) execFileSync(process.execPath, ['scripts/' + script + '.ts'], { cwd: e53, stdio: 'inherit' });
  for (const [name, digest] of Object.entries(expected.artifacts)) {
    assert.equal(sha256(readFileSync(join(e53, 'benchmarks/results/run/e53', name))), digest, name);
  }
  put(join(values.publish ? published : scratch, 'historical-verification.json'), pack({
    historical: checked, rebuilds, e53Files: Object.keys(expected.artifacts).length, rndFiles: r.deterministicFiles,
  }));
}
console.log('E54 PASS · ' + checked + ' historical checksums · ' + camera.length + ' pixel-exact Unity captures · ' + traces.length + ' traces');
