import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { buildIdleAnimation, verifyAnimationPackage } from '../generators/character/animation.ts';
import { writeCharacterReview } from '../generators/character/export.ts';
import { verifyCharacterProductionPackage } from '../generators/character/production.ts';

try {
  const { values } = parseArgs({ options: {
    source: { type: 'string' }, spec: { type: 'string' }, out: { type: 'string' }, verify: { type: 'string' },
  } });
  if (!values.source) throw new Error('Provide --source <character-package>.');
  if (values.verify !== undefined) {
    if (!values.verify || values.spec !== undefined || values.out !== undefined) throw new Error('Use --verify <animation-package> with --source.');
    console.log(JSON.stringify((await verifyAnimationPackage(values.verify, values.source)).manifest));
  } else {
    if (!values.spec || !values.out) throw new Error('Provide --spec <file> and --out <animation-package>.');
    const [source, bytes] = await Promise.all([verifyCharacterProductionPackage(values.source), readFile(values.spec, 'utf8')]);
    const animation = buildIdleAnimation(source, JSON.parse(bytes));
    await writeCharacterReview(values.out, animation);
    console.log(JSON.stringify(animation.manifest));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
