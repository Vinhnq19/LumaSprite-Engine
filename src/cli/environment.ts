import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { environmentPackage, verifyEnvironmentPackage, writeEnvironmentPackage } from '../generators/environment/export.ts';
import { loadEnvironment } from '../generators/environment/render.ts';

try {
  const { values } = parseArgs({ options: {
    spec: { type: 'string' }, out: { type: 'string' }, finish: { type: 'string' },
    lighting: { type: 'string' }, verify: { type: 'string' },
  } });
  if (values.verify) {
    if (values.spec || values.out || values.finish || values.lighting) throw new Error('Use --verify on its own.');
    console.log(JSON.stringify(await verifyEnvironmentPackage(values.verify)));
  } else {
    const { spec, out, finish = 'A', lighting = 'day' } = values;
    if (!spec || !out || (finish !== 'A' && finish !== 'B') || (lighting !== 'day' && lighting !== 'night')) {
      throw new Error('Provide --spec <EnvironmentSpec> --out <directory> [--finish A|B] [--lighting day|night].');
    }
    const input = await loadEnvironment(JSON.parse(await readFile(spec, 'utf8')));
    const bundle = environmentPackage(input, finish, lighting);
    await writeEnvironmentPackage(out, bundle);
    console.log(JSON.stringify(bundle.manifest));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
