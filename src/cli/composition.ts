import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadComposition } from '../generators/environment/composition.ts';
import { compositionPackage,verifyCompositionPackage } from '../generators/environment/composition-export.ts';
import { writeEnvironmentPackage } from '../generators/environment/export.ts';

try {
  const {values:{spec,out,lighting,verify}}=parseArgs({options:{
    spec:{type:'string'},out:{type:'string'},lighting:{type:'string'},verify:{type:'string'},
  }});
  if(verify){
    if(spec || out || lighting !== undefined)throw new Error('Use --verify by itself.');
    console.log(JSON.stringify(await verifyCompositionPackage(verify)));
  }else{
    const light=lighting ?? 'day';
    if(!spec || !out || (light!=='day' && light!=='night'))throw new Error('Use --spec <SceneCompositionSpec> --out <directory> [--lighting day|night].');
    const input=await loadComposition(JSON.parse(await readFile(spec,'utf8')));
    const bundle=compositionPackage(input,light);
    await writeEnvironmentPackage(out,bundle);
    console.log(JSON.stringify(bundle.manifest));
  }
}catch(error){
  console.error(error instanceof Error?error.message:error);
  process.exitCode=1;
}
