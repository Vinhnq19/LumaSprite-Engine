import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inkLuma, pack, unpack } from '../src/core/palette/colors.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { materialLegend } from '../src/generators/environment/kit.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';

const root = 'benchmarks/results/e74r';
type Case = { id: string; qa: string };
type Pair = { native: string };
type Pixels = { material: Pair; ownership: string; day: Pair; night: Pair };
type Proof = { anchor: [number, number]; pivot: [number, number]; coverage: number; visible: number };
type Source = { id: string; files: Pixels; context: Record<'day' | 'night', Proof> };
const bench: { files: Record<string, string>; reused: Record<string, string>; cases: Case[] } =
  JSON.parse(await readFile(root + '/benchmark.json', 'utf8'));
const pins = { ...bench.files, ...bench.reused };
const png = async (file: string) => decodePng(await pinnedFile({ file, sha256: pins[file] }));
const darkRoles = new Set([materialLegend.metal, materialLegend.wood, materialLegend.roof].map(pack));
const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function quantiles(gaps: number[]) {
  gaps.sort((a, b) => a - b);
  return { samples: gaps.length, p10: gaps[Math.floor(gaps.length / 10)] ?? null,
    median: gaps[Math.floor(gaps.length / 2)] ?? null, weak: gaps.filter(gap => gap < 18).length };
}

async function sample(files: Pixels, proof: Proof, light: 'day' | 'night') {
  const [sprite, mask, scene] = await Promise.all([png(files.material.native), png(files.ownership), png(files[light].native)]);
  assert.equal(proof.coverage, proof.visible);
  const [dx, dy] = [proof.anchor[0] - proof.pivot[0], proof.anchor[1] - proof.pivot[1]];
  const sceneAt = (x: number, y: number) => scene.rgba.readUInt32BE(((dy + y) * scene.w + dx + x) * 4);
  const countByRole: Record<string, number> = {};
  const boundaries: number[] = [], opposingRole: number[] = [];
  for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) {
    const at = (y * sprite.w + x) * 4, role = mask.rgba.readUInt32BE(at);
    if (!darkRoles.has(role)) continue;
    const ink = sceneAt(x, y);
    assert.equal(ink, sprite.rgba.readUInt32BE(at));
    const luma = inkLuma(ink);
    if (luma >= 90) continue;
    const name = unpack(role);
    countByRole[name] = (countByRole[name] ?? 0) + 1;
    for (const [ox, oy] of moves) {
      const u = x + ox, v = y + oy;
      if (u < 0 || v < 0 || u >= mask.w || v >= mask.h) continue;
      const neighborRole = mask.rgba.readUInt32BE((v * mask.w + u) * 4);
      if (!neighborRole) continue;
      const neighborLuma = inkLuma(sceneAt(u, v));
      if (neighborLuma < 90 && neighborRole === role) continue;
      const gap = Math.abs(luma - neighborLuma);
      boundaries.push(gap);
      if (neighborRole !== role && neighborRole !== pack(materialLegend.contour)) opposingRole.push(gap);
    }
  }
  return { pixelsByRole: countByRole, materialAndContour: quantiles(boundaries),
    materialToMaterial: quantiles(opposingRole), cutoff: 90 };
}

const cases = [];
for (const ref of bench.cases) {
  const file = root + '/' + ref.qa;
  const qa: { previous: Source[] | null; geometry: Pixels; context: Source['context'] } =
    JSON.parse((await pinnedFile({ file, sha256: pins[file] })).toString('utf8'));
  const sources = [...(qa.previous ?? []), { id: 'e74r', files: qa.geometry, context: qa.context }];
  const variants = [];
  for (const item of sources) variants.push({ id: item.id, day: await sample(item.files, item.context.day, 'day'),
    night: await sample(item.files, item.context.night, 'night') });
  cases.push({ id: ref.id, variants });
}
const dest = process.argv.includes('--publish') ? root : 'benchmarks/results/run/e74r';
await mkdir(dest, { recursive: true });
const file = dest + '/dark-material.json', bytes = Buffer.from(JSON.stringify({ version: 1, cases }, null, 2) + '\n');
const previous = await readFile(file).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ENOENT') return undefined;
  throw error;
});
if (previous && process.argv.includes('--publish')) assert.ok(previous.equals(bytes));
else await writeFile(file, bytes);
console.log(cases.length + ' cases · interior dark material measured in actual Day/Night pixels.');
