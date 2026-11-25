import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { characterReview, writeCharacterReview } from '../generators/character/export.ts';
import { characterMaterialReview } from '../generators/character/material-export.ts';
import { verifyCharacterProductionPackage } from '../generators/character/production.ts';
import type { ShapeLock } from '../generators/character/shape-lock.ts';
import { forestCourier, forestCourierRevision, surveyorGeometryRevisions, surveyorRefinements, surveyors } from '../generators/character/presets.ts';

try {
  const { values } = parseArgs({ options: {
    candidate: { type: 'string' }, spec: { type: 'string' }, out: { type: 'string' },
    material: { type: 'string' }, 'shape-lock': { type: 'string' }, 'material-palette': { type: 'string' },
    'verify-package': { type: 'string' },
  } });
  if (values['verify-package'] !== undefined) {
    if (!values['verify-package'] || Object.keys(values).length !== 1) throw new Error('Use --verify-package <directory> on its own.');
    const verified = await verifyCharacterProductionPackage(values['verify-package']);
    console.log(JSON.stringify(verified.manifest));
  } else {
    await generate(values);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function generate(values: { candidate?: string; spec?: string; out?: string; material?: string; 'shape-lock'?: string; 'material-palette'?: string }) {
  if (values.spec && values.candidate) throw new Error('Use --spec or --candidate.');
  const style = values.material;
  if (style !== undefined && style !== 'm1' && style !== 'm2' && style !== 'm2p') throw new Error('Material style must be m1, m2 or m2p.');
  const lockFile = values['shape-lock'], paletteFile = values['material-palette'];
  if (style && !lockFile) throw new Error('A material render requires --shape-lock.');
  if (!style && (lockFile || paletteFile)) throw new Error('Use --material with --shape-lock or --material-palette.');
  const candidate = values.candidate ?? (style ? 'b1' : 'a');
  const presets = { ...surveyors, ...surveyorRefinements, ...surveyorGeometryRevisions, courier: forestCourier, 'courier-rev': forestCourierRevision };
  if (!Object.hasOwn(presets, candidate)) throw new Error('Candidate must be ' + Object.keys(presets).join(', ') + '.');
  const input: unknown = values.spec ? JSON.parse(await readFile(values.spec, 'utf8')) : presets[candidate as keyof typeof presets];
  const geometry = characterReview(input);
  const review = style && lockFile ? characterMaterialReview(geometry, JSON.parse(await readFile(lockFile, 'utf8')) as ShapeLock, style,
    paletteFile ? JSON.parse(await readFile(paletteFile, 'utf8')) : undefined) : geometry;
  const out = values.out ?? 'benchmarks/results/run/character-' + (values.spec ? 'spec' : candidate) + (style ? '-' + style : '');
  await writeCharacterReview(out, review);
  console.log(JSON.stringify({ out, technical: review.metadata.technical, artistic: review.metadata.artistic, ...review.metadata.images }));
}
