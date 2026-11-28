import { parseArgs } from 'node:util';
import { buildComponentPackage, reviseComponentPackage, verifyComponentPackage } from '../components/package.ts';

try {
  const { values: args } = parseArgs({ options: {
    manifest: { type: 'string' }, out: { type: 'string' }, revise: { type: 'string' },
    layer: { type: 'string' }, png: { type: 'string' }, 'edit-mask': { type: 'string' },
    verify: { type: 'string' }, parent: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  const usage = [
    'component --manifest <component.json> --out <new-directory>',
    'component --revise <package> --layer <id> --png <edited.png> --edit-mask <mask.png> --out <new-directory>',
    'component --verify <package> [--parent <previous-package>]',
  ].join('\n');
  const used = Object.keys(args).length;
  if (args.help && used === 1) console.log(usage);
  else if (args.manifest && args.out && used === 2) {
    console.log(JSON.stringify(await buildComponentPackage(args.manifest, args.out)));
  } else if (args.revise && args.layer && args.png && args['edit-mask'] && args.out && used === 5) {
    console.log(JSON.stringify(await reviseComponentPackage(args.revise, args.layer, args.png, args['edit-mask'], args.out)));
  } else if (args.verify && used === (args.parent ? 2 : 1)) {
    console.log(JSON.stringify(await verifyComponentPackage(args.verify, args.parent)));
  } else throw new Error(usage);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
