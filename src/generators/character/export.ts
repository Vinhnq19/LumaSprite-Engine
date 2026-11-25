import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { encodePng } from '../../core/renderer/png.ts';
import { checkCharacter } from '../../quality/character.ts';
import { inspectPng, sha256 } from '../../quality/raster.ts';
import type { GaitPose } from './geometry.ts';
import { renderCharacter } from './render.ts';

export function characterReview(input: unknown, gait?: GaitPose) {
  const render = renderCharacter(input, gait);
  const rerender = renderCharacter(render.spec, gait);
  const geometry = checkCharacter(render);
  const flat = encodePng(render.flat), silhouette = encodePng(render.silhouette);
  const errors = [...geometry.errors, ...inspectPng(render.flat, flat, rerender.flat),
    ...inspectPng(render.silhouette, silhouette, rerender.silhouette)];
  if (errors.length) throw new Error('Character geometry failed: ' + [...new Set(errors)].join(', '));
  const metadata = {
    version: 1, kind: 'lumasprite-character-geometry', technical: 'PASS',
    artistic: render.spec.version === 1 ? 'PENDING_SHAPE_REVIEW' : 'VISUAL_REVIEW_PENDING',
    spec: render.spec, bodyPlan: render.plan, palette: render.palette, diagnostics: geometry,
    images: { flatPngSha256: sha256(flat), silhouettePngSha256: sha256(silhouette) },
  };
  const files = new Map([
    ['flat.png', flat], ['silhouette.png', silhouette],
    ['geometry.json', Buffer.from(JSON.stringify(metadata, null, 2) + '\n')],
  ]);
  return { ...render, metadata, files };
}

export async function writeCharacterReview(directory: string, review: Pick<ReturnType<typeof characterReview>, 'files'>) {
  await mkdir(directory, { recursive: true });
  const present = await readdir(directory);
  if (present.length) {
    if (present.length !== review.files.size || present.some(name => !review.files.has(name))) {
      throw new Error('Choose an empty directory for the character review.');
    }
    for (const [name, data] of review.files) if (!(await readFile(join(directory, name))).equals(data)) {
      throw new Error('Existing character review differs at ' + name + '. Choose an empty directory.');
    }
    return;
  }
  for (const [name, data] of review.files) await writeFile(join(directory, name), data, { flag: 'wx' });
}
