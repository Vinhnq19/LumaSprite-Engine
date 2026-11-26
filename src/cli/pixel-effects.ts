import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { writeEnvironmentPackage } from '../generators/environment/export.ts';
import { pixelEffectPackage,verifyPixelEffectPackage } from '../generators/pixel-effects/export.ts';

try {
  const {values:{spec,out,verify}}=parseArgs({options:{spec:{type:'string'},out:{type:'string'},verify:{type:'string'}}});
  if(verify){
    if(spec || out)throw new Error('Use --verify by itself.');
    console.log(JSON.stringify(await verifyPixelEffectPackage(verify)));
  }else{
    if(!spec || !out)throw new Error('Use --spec <UISpec|VFXSpec> --out <directory>.');
    const bundle=await pixelEffectPackage(JSON.parse((await readFile(spec)).toString('utf8')));
    await writeEnvironmentPackage(out,bundle);
    console.log(JSON.stringify(bundle.manifest));
  }
}catch(error){
  console.error(error instanceof Error?error.message:error);
  process.exitCode=1;
}
