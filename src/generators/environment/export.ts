import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { nearestNeighbor } from '../../core/pixels/raster.ts';
import { encodePng } from '../../core/renderer/png.ts';
import { inspectPng, sha256 } from '../../quality/raster.ts';
import type { EnvironmentFinish, EnvironmentLight } from '../../specs/environment.ts';
import { loadEnvironment, renderEnvironment } from './render.ts';

const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const header = z.object({ version: z.literal(1), kind: z.literal('lumasprite-environment-pilot'),
  finish: z.enum(['A','B']), lighting: z.enum(['day','night']) });

export function environmentPackage(input: Awaited<ReturnType<typeof loadEnvironment>>, finish: EnvironmentFinish, lighting: EnvironmentLight) {
  const scene = renderEnvironment(input, finish, lighting);
  const repeat = renderEnvironment(input, finish, lighting);
  const entries = [
    ['scene.png','raster'], ['material-mask.png','materialMask'], ['layer-overlay.png','layerOverlay'],
    ['collision-overlay.png','collisionOverlay'], ['collision-mask.png','collisionPlane'],
    ['kit.png','atlas'], ['kit-material-mask.png','atlasMaterials'],
  ] as const;
  const files = new Map<string, Buffer>();
  for (const [file, key] of entries) {
    const png = encodePng(scene[key]);
    const errors = inspectPng(scene[key], png, repeat[key]);
    if (errors.length) throw new Error(file + ': ' + errors.join(','));
    files.set(file, png);
  }
  const four = nearestNeighbor(scene.raster, 4);
  const fourPng = encodePng(four);
  if (inspectPng(four, fourPng, nearestNeighbor(repeat.raster, 4)).length) throw new Error('4× preview cannot round-trip.');
  files.set('scene-4x.png', fourPng);
  files.set('environment-spec.json', json(input.spec));
  files.set('art-style-profile.json', json(input.style));
  files.set('kit.json', json(scene.metadata.atlas));
  files.set('qa.json', json(scene.metadata));
  const manifest = {
    version: 1, kind: 'lumasprite-environment-pilot', finish, lighting, review: 'HUMAN_ART_REVIEW_PENDING',
    name: input.spec.name, scene: 'scene.png', atlas: 'kit.png', camera: scene.metadata.camera,
    files: Object.fromEntries([...files].map(([name, data]) => [name, sha256(data)])),
  };
  files.set('manifest.json', json(manifest));
  return { manifest, scene, files };
}

export async function writeEnvironmentPackage(directory: string, bundle: ReturnType<typeof environmentPackage>) {
  await mkdir(directory, { recursive: true });
  const actual = new Set(await readdir(directory));
  for (const file of actual) {
    const expected = bundle.files.get(file);
    if (!expected || !expected.equals(await readFile(join(directory,file)))) {
      throw new Error('Existing environment output differs at ' + file + '. Choose a different directory.');
    }
  }
  for (const [file,data] of bundle.files) {
    if (!actual.has(file)) await writeFile(join(directory,file), data, { flag: 'wx' });
  }
}

export async function verifyEnvironmentPackage(directory: string) {
  const manifest = header.parse(JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')));
  const input = await loadEnvironment(JSON.parse(await readFile(join(directory,'environment-spec.json'),'utf8')));
  const expected = environmentPackage(input, manifest.finish, manifest.lighting);
  if ((await readdir(directory)).length !== expected.files.size) throw new Error('Unexpected environment package files.');
  for (const [file,data] of expected.files) {
    if (!data.equals(await readFile(join(directory,file)))) throw new Error('Environment package differs at ' + file);
  }
  return expected.manifest;
}
