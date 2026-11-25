import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { nearestNeighbor } from '../core/pixels/raster.ts';
import { encodePng } from '../core/renderer/png.ts';
import { renderAsset } from '../generators/props/render.ts';
import { mockPlanner, supplyChestBrief } from '../providers/mock/planner.ts';
import type { ArtisticReview } from '../quality/artistic.ts';
import { inspectPng, sha256, validateRaster } from '../quality/raster.ts';

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

try {
  const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run' } } });
  const out = values.out;
  const variants = await Promise.all([42, 43].map(async seed => {
    const spec = await mockPlanner.plan({ brief: supplyChestBrief, seed });
    const { flat, silhouette, final } = renderAsset(spec);
    const png = encodePng(final);
    const diagnostics = [
      ...validateRaster(final, spec, { durationMs: 100, loop: false }),
      ...inspectPng(final, png, renderAsset(spec).final),
    ];
    if (diagnostics.length) throw new Error(diagnostics.join(', '));
    return { spec, diagnostics, hash: sha256(final.rgba), images: {
      'flat-1x': encodePng(flat), 'silhouette-1x': encodePng(silhouette), 'final-1x': png,
      'final-4x': encodePng(nearestNeighbor(final, 4)),
    } };
  }));
  if (variants[0].hash === variants[1].hash) throw new Error('The seeds produced identical RGBA.');

  await mkdir(out, { recursive: true });
  const review: ArtisticReview = { status: 'PENDING_HUMAN_REVIEW' };
  const table = [
    '# Fantasy Adventurer Supply Chest',
    '',
    supplyChestBrief,
    '',
    'Inspect the final at 1× first. Use 4× to inspect the outlines, wood clusters, and iron bands over light and dark backgrounds.',
    '',
    '| Seed | Flat 1× | Silhouette 1× | Final 1× | Final 4× |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const { spec, diagnostics, hash, images } of variants) {
    const seed = spec.seed;
    await writeFile(join(out, 'chest-' + seed + '.json'), json(spec));
    await writeFile(join(out, 'qa-' + seed + '.json'), json({ rgbaSha256: hash, technical: 'PASS', diagnostics, artistic: review }));
    const alt = {
      'flat-1x': 'Flat wooden lid, body, iron bands and lock',
      'silhouette-1x': 'Silhouette of the domed chest',
      'final-1x': 'Shaded wooden chest at native size',
      'final-4x': 'Shaded chest enlarged with nearest-neighbor',
    };
    const cells = [];
    for (const [kind, bytes] of Object.entries(images) as [keyof typeof images, Buffer][]) {
      const file = 'chest-' + seed + '-' + kind + '.png';
      await writeFile(join(out, file), bytes);
      cells.push('![' + alt[kind] + '](' + file + ')');
    }
    table.push('| [' + seed + '](chest-' + seed + '.json) | ' + cells.join(' | ') + ' |');
  }
  table.push('', '## Palette and diagnostics', '',
    'Engine palette · ' + variants[0].spec.palette.map(color => '`' + color + '`').join(' · '), '',
    'Seed 42 has wider-set iron bands. Seed 43 moves both bands inward and shifts the latch one pixel right.',
    '',
    'Technical QA checked RGBA size, binary alpha, zero transparent RGB, palette, frame metadata, PNG round-trip and determinism.',
    '',
    ...variants.map(({ spec }) => '- [Seed ' + spec.seed + ' technical diagnostics](qa-' + spec.seed + '.json)'),
    '', 'Artistic review · **PENDING_HUMAN_REVIEW**', '');
  await writeFile(join(out, 'README.md'), table.join('\n'));
  console.log('Wrote benchmark to ' + out);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
