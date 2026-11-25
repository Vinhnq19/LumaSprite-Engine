import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { chestColors, pack } from '../src/core/palette/colors.ts';
import { nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { makeCurrentPropSpec } from '../src/generators/props/presets.ts';
import { renderAsset } from '../src/generators/props/render.ts';
import { assessPropPalette } from '../src/quality/prop-palette.ts';
import { inspectPng, sha256, validateRaster } from '../src/quality/raster.ts';
import { onBackground, swatches } from './game-preview.ts';
import { opaqueBounds, readSceneFixtures, renderReviewScenes, reviewDesigns, type ReviewDesign } from './prop-review-scenes.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e24' } } });
const out = resolve(values.out);
for (const old of ['sample', 'e2', 'e23']) {
  const path = resolve('benchmarks/results', old).toLowerCase();
  if (out.toLowerCase() === path || out.toLowerCase().startsWith(path + sep)) throw new Error('Choose a separate E2.4 directory.');
}
await mkdir(out, { recursive: true });
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
const json = (name: string, data: unknown) => writeFile(join(out, name + '.json'), JSON.stringify(data, null, 2) + '\n');
const image = (file: string, alt: string) => '![' + alt + '](' + file + '.png)';
const seed = 42;
const lockedColors = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
const authoredColors = Object.values(chestColors);
const authored = new Map<ReviewDesign, Raster>();
const locked = new Map<ReviewDesign, Raster>();

const background = { light: '#d7ccb4', dark: '#263344' };
const labels: Record<ReviewDesign, string> = {
  compact: 'Compact Chest', domed: 'Domed Chest', travel: 'Travel Chest', crate: 'Crate',
  'barrel-wide': 'Barrel Wide', 'barrel-tall': 'Barrel Tall',
};

function validation(asset: ReturnType<typeof renderAsset>) {
  const { final, spec, paletteDiagnostics } = asset;
  if (!paletteDiagnostics) throw new Error('Missing palette diagnostics.');
  const png = encodePng(final);
  const errors = [
    ...validateRaster(final, spec, { durationMs: 100, loop: false }),
    ...inspectPng(final, png, renderAsset(spec).final),
  ];
  if (errors.length) throw new Error(spec.name + ': ' + errors.join(', '));
  return {
    technical: 'TECHNICALLY_VALID',
    artistic: 'PENDING_HUMAN_REVIEW',
    rgbaSha256: sha256(final.rgba),
    pngSha256: sha256(png),
    bounds: opaqueBounds(final),
    palette: assessPropPalette(paletteDiagnostics),
  };
}

const gallery = ['# E2.4 prop review', '',
  'Start at 1×. Inspect 4× only for clusters and outlines. The native scene pixels and sprite pixels have the same scale.',
  '', '| Prop | Authored 1× | Locked 1× | Authored 4× | Locked 4× | Evidence |', '| --- | --- | --- | --- | --- | --- |'];
const review = ['# E2.4 owner review sheet', '',
  'Status **PENDING_HUMAN_REVIEW**. Score each criterion 1–5. Suggested threshold is 4/5 on silhouette, material readability and game readiness with no serious scene issue. The owner records the final decision.',
  '', 'Inspect all three scenes in both palettes before filling the sheet.', ''];
const metrics = ['', '## Palette validation', '',
  '| Prop | Authored | Studio locked | Wood tones | Iron tones | Midtone gap |', '| --- | --- | --- | --- | --- | --- |'];

for (const design of reviewDesigns) {
  const label = labels[design];
  const authoredAsset = renderAsset(makeCurrentPropSpec(design, seed));
  const lockedAsset = renderAsset(makeCurrentPropSpec(design, seed, lockedColors));
  const authoredQa = validation(authoredAsset);
  const lockedQa = validation(lockedAsset);
  authored.set(design, authoredAsset.final);
  locked.set(design, lockedAsset.final);
  await Promise.all([
    json(design + '-spec', { authored: authoredAsset.spec, locked: lockedAsset.spec }),
    json(design + '-qa', { seed, authored: authoredQa, locked: lockedQa }),
    save(design + '-1x', authoredAsset.final),
    save(design + '-4x', nearestNeighbor(authoredAsset.final, 4)),
    save(design + '-locked-1x', lockedAsset.final),
    save(design + '-locked-4x', nearestNeighbor(lockedAsset.final, 4)),
  ]);
  gallery.push('| ' + label + ' | ' + image(design + '-1x', label + ' native size') + ' | ' +
    image(design + '-locked-1x', label + ' Studio locked palette native size') + ' | ' +
    image(design + '-4x', label + ' enlarged nearest-neighbor') + ' | ' +
    image(design + '-locked-4x', label + ' Studio locked palette enlarged') +
    ' | [Spec](' + design + '-spec.json) · [QA](' + design + '-qa.json) |');
  const m = lockedQa.palette.metrics;
  metrics.push('| ' + label + ' | ' + authoredQa.palette.status + ' | ' + lockedQa.palette.status + ' | ' +
    m.woodDistinct + '/5 | ' + m.ironDistinct + '/3 | ' + m.woodIronMidtoneGap + ' vs ' + m.authoredWoodIronMidtoneGap + ' |');
  review.push('## ' + label, '', '| Criterion | 1–5 | Notes |', '| --- | --- | --- |',
    ...['Silhouette', 'Shape & proportion', 'Material readability', 'Pixel clusters', 'Outline quality',
      'Color harmony', 'Game readiness'].map(criterion => '| ' + criterion + ' |  |  |'),
    '', 'Scene issues · __________', '', 'Owner decision · __________', '');
}

gallery.push('', '## Refinements against E2.3', '',
  'The before/after images use identical backgrounds and the same 32×32 canvas.',
  '', '| Prop | Before 1× light | After 1× light | Before 1× dark | After 1× dark |', '| --- | --- | --- | --- | --- |');
for (const design of ['travel', 'barrel-wide', 'barrel-tall'] as const) {
  const before = decodePng(await readFile(join('benchmarks/results/e23', design + '-1x.png')));
  const after = authored.get(design)!;
  const cells = [];
  for (const mode of ['light', 'dark'] as const) {
    const oldFile = design + '-before-' + mode;
    const newFile = design + '-after-' + mode;
    await save(oldFile, onBackground(before, background[mode]));
    await save(newFile, onBackground(after, background[mode]));
    cells.push(image(oldFile, labels[design] + ' before on ' + mode), image(newFile, labels[design] + ' after on ' + mode));
  }
  gallery.push('| ' + labels[design] + ' | ' + cells.join(' | ') + ' |');
  await writeFile(join(out, design + '-before-4x.png'), await readFile(join('benchmarks/results/e23', design + '-4x.png')));
  gallery.push('| 4× nearest-neighbor | [Before ' + labels[design] + '](' + design + '-before-4x.png) | [After ' +
    labels[design] + '](' + design + '-4x.png) |  |  |');
}

gallery.push('', '## Three game scenes at 1×', '',
  'The bottom-center pivot uses one row below the last opaque pixel. Each scene aligns every pivot to its ground row. Outdoor includes the 32×32 traveler for scale.',
  '', '| Scene | Authored | Studio locked | Layout |', '| --- | --- | --- | --- |');
const fixtures = await readSceneFixtures();
const authoredScenes = renderReviewScenes(authored, fixtures);
const lockedScenes = renderReviewScenes(locked, fixtures);
const sceneTitles = { outdoor: 'Outdoor RPG', dungeon: 'Dark dungeon storage', neutral: 'Neutral comparison' };
for (const [i, scene] of authoredScenes.entries()) {
  const authoredName = scene.id + '-authored-1x';
  const lockedName = scene.id + '-locked-1x';
  await Promise.all([
    save(authoredName, scene.raster),
    save(lockedName, lockedScenes[i].raster),
    json(scene.id + '-layout', scene.metadata),
  ]);
  const title = sceneTitles[scene.id as keyof typeof sceneTitles];
  gallery.push('| ' + title + ' | ' + image(authoredName, title + ' authored at 1×') + ' | ' +
    image(lockedName, title + ' locked at 1×') + ' | [Layout](' + scene.id + '-layout.json) |');
}

await Promise.all([
  save('wood-iron-swatches', swatches(authoredColors)),
  save('studio-locked-swatches', swatches(lockedColors)),
  json('wood-iron-preset', { id: 'wood-iron', colors: authoredColors, studioRgba8: [0, ...authoredColors.map(pack)] }),
]);
gallery.push(...metrics, '', 'Technical validity and palette warnings are recorded independently. Artistic status stays **PENDING_HUMAN_REVIEW**.',
  '', image('wood-iron-swatches', 'Proposed wood and iron preset swatches') + ' · [Proposed preset](wood-iron-preset.json)',
  '', image('studio-locked-swatches', 'Current Studio locked palette swatches') + ' · ' + lockedColors.join(' · '),
  '', '[Owner review sheet](review.md)', '');
await Promise.all([
  writeFile(join(out, 'README.md'), gallery.join('\n')),
  writeFile(join(out, 'review.md'), review.join('\n')),
]);
console.log('E2.4 benchmark written to ' + out);
