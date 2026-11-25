import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { characterReview, writeCharacterReview } from '../generators/character/export.ts';
import { surveyorRefinements, surveyors } from '../generators/character/presets.ts';

try {
  const { values } = parseArgs({ options: {
    candidate: { type: 'string' }, spec: { type: 'string' }, out: { type: 'string' },
  } });
  if (values.spec && values.candidate) throw new Error('Use --spec or --candidate.');
  const candidate = values.candidate ?? 'a';
  const presets = { ...surveyors, ...surveyorRefinements };
  if (!Object.hasOwn(presets, candidate)) throw new Error('Candidate must be a, b, b1 or b2.');
  const input: unknown = values.spec ? JSON.parse(await readFile(values.spec, 'utf8')) : presets[candidate as keyof typeof presets];
  const review = characterReview(input);
  const out = values.out ?? 'benchmarks/results/run/character-' + (values.spec ? 'spec' : candidate);
  await writeCharacterReview(out, review);
  console.log(JSON.stringify({ out, technical: review.metadata.technical, artistic: review.metadata.artistic, ...review.metadata.images }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
