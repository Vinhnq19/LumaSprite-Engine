import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { makePropSpec, propNames } from '../src/generators/props/presets.ts';
import { renderAsset } from '../src/generators/props/supply-chest.ts';
import { artCriteria } from '../src/quality/artistic.ts';
import { inspectPng, sha256, validateRaster } from '../src/quality/raster.ts';
import { propDesigns } from '../src/specs/prop-shape.ts';
import { gamePreview, onBackground, swatches } from './game-preview.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e2' } } });
const out = resolve(values.out);
const baseline = resolve('benchmarks/results/sample');
if (out.toLowerCase() === baseline.toLowerCase()) throw new Error('Use a separate E2 benchmark directory.');

const seed = 42;
const locked = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
const crate = renderAsset(makePropSpec('crate', seed)).final;
const write = (name: string, value: unknown) => writeFile(join(out, name), JSON.stringify(value, null, 2) + '\n');
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
const gallery = ['# E2 prop quality benchmark', '', 'Review each 1× image first. Then inspect the shape and material transitions at 4×.',
  '', '| Design | Final 1× | Flat 1× | Silhouette 1× | Final 4× |', '| --- | --- | --- | --- | --- |'];
const contexts = ['', '## Game context at 1×', '', '| Design | Light ground | Dark ground | 96×64 tile scene | Locked palette 1× |',
  '| --- | --- | --- | --- | --- |'];
const evidence: string[] = [];
const review = ['# E2 artistic review', '', 'Status **PENDING_HUMAN_REVIEW**. Use 1–5 per criterion. Discuss any core score below 4 before approval.', ''];

await mkdir(out, { recursive: true });
const saved = await readFile(join(baseline, 'chest-42-final-1x.png'));
await writeFile(join(out, 'baseline-42-1x.png'), saved);
await writeFile(join(out, 'baseline-42-4x.png'), await readFile(join(baseline, 'chest-42-final-4x.png')));

for (const design of propDesigns) {
  const spec = makePropSpec(design, seed);
  const asset = renderAsset(spec);
  const lockedAsset = renderAsset(makePropSpec(design, seed, locked));
  const { final, flat, silhouette } = asset;
  const check = (result: typeof asset) => [
    ...validateRaster(result.final, result.spec, { durationMs: 100, loop: false }),
    ...inspectPng(result.final, encodePng(result.final), renderAsset(result.spec).final),
  ];
  const diagnostics = check(asset);
  const lockedDiagnostics = check(lockedAsset);
  if (diagnostics.length || lockedDiagnostics.length) throw new Error(design + ' failed technical QA: ' + [...diagnostics, ...lockedDiagnostics]);
  await Promise.all([
    write(design + '-spec.json', spec),
    write(design + '-qa.json', {
      technical: 'PASS', artistic: 'PENDING_HUMAN_REVIEW', rgbaSha256: sha256(final.rgba),
      authored: { diagnostics, palette: spec.palette, mapping: 'paletteDiagnostics' in asset ? asset.paletteDiagnostics : null },
      locked: { diagnostics: lockedDiagnostics, palette: locked, rgbaSha256: sha256(lockedAsset.final.rgba),
        mapping: 'paletteDiagnostics' in lockedAsset ? lockedAsset.paletteDiagnostics : null },
    }),
    save(design + '-1x', final), save(design + '-4x', nearestNeighbor(final, 4)),
    save(design + '-flat', flat), save(design + '-silhouette', silhouette),
    save(design + '-light', onBackground(final, '#d7ccb4')), save(design + '-dark', onBackground(final, '#263344')),
    save(design + '-scene', gamePreview(final, design === 'crate' ? renderAsset(makePropSpec('domed', seed)).final : crate)),
    save(design + '-locked', lockedAsset.final),
  ]);
  const image = (kind: string, alt: string) => '![' + propNames[design] + ' ' + alt + '](' + design + '-' + kind + '.png)';
  gallery.push('| ' + propNames[design] + ' | ' + image('1x', 'native size') + ' | ' + image('flat', 'flat colors') +
    ' | ' + image('silhouette', 'silhouette') + ' | ' + image('4x', 'nearest-neighbor enlargement') + ' |');
  contexts.push('| ' + propNames[design] + ' | ' + image('light', 'on a light background') + ' | ' + image('dark', 'on a dark background') +
    ' | ' + image('scene', 'beside another prop on tiles') + ' | ' + image('locked', 'with Studio locked colors') + ' |');
  evidence.push('- ' + propNames[design] + ' · [shape configuration](' + design + '-spec.json) · [technical diagnostics](' + design + '-qa.json)');
  review.push('## ' + propNames[design], '', '| Criterion | Score / 5 | Notes |', '| --- | --- | --- |',
    ...artCriteria.filter(criterion => criterion !== 'artistic appeal').map(criterion => '| ' + criterion + ' |  |  |'), '', 'Owner decision · __________', '');
}

const colors = makePropSpec('domed', seed).palette;
await save('authored-swatches', swatches(colors));
await save('locked-swatches', swatches(locked));
gallery.push('', '## Seed 42 before and after', '', '| Baseline 1× | Domed 1× | Baseline 4× | Domed 4× |',
  '| --- | --- | --- | --- |',
  '| ![Baseline 42 actual size](baseline-42-1x.png) | ![Domed 42 actual size](domed-1x.png) | ![Baseline 42 zoom](baseline-42-4x.png) | ![Domed 42 zoom](domed-4x.png) |',
  '', 'Baseline PNG SHA-256 · `' + sha256(saved) + '`', ...contexts,
  '', '## Palettes and evidence', '',
  'Authored · ![Authored palette swatches](authored-swatches.png) · ' + colors.join(' · '),
  '', 'Studio locked · ![Studio locked palette swatches](locked-swatches.png) · ' + locked.join(' · '),
  '', ...evidence, '', '[Owner review sheet](review.md)', '');
await writeFile(join(out, 'README.md'), gallery.join('\n'));
await writeFile(join(out, 'review.md'), review.join('\n'));
console.log('E2 benchmark written to ' + out);
