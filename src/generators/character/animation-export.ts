import { isDeepStrictEqual } from 'node:util';
import { blit, makeRaster, type Raster } from '../../core/pixels/raster.ts';
import { decodePng, encodePng } from '../../core/renderer/png.ts';
import { sha256 } from '../../quality/raster.ts';
import type { AnimationSpec } from '../../specs/animation.ts';
import type { verifyCharacterProductionPackage } from './production.ts';

export type CharacterPackage = Awaited<ReturnType<typeof verifyCharacterProductionPackage>>;
export type AnimationFrame = Pick<CharacterPackage, 'geometry' | 'material' | 'lock'>;

type SourceIdentity = Pick<AnimationSpec, 'source' | 'pivot' | 'layerOrder' | 'seed'>;
type ClipSpec = SourceIdentity & Pick<AnimationSpec, 'name' | 'loop' | 'output'> & {
  frameCount: number; keyPoses: readonly { phase: string; durationMs: number }[];
};
const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');

export function requireAnimationSource(source: CharacterPackage, spec: SourceIdentity) {
  if (source.geometry.spec.version !== spec.source.characterSpecVersion || source.lock.geometryRevision !== spec.source.geometryRevision ||
      sha256(source.files.get('manifest.json')!) !== spec.source.productionManifestSha256 ||
      sha256(source.files.get('character-spec.json')!) !== spec.source.characterSpecSha256 ||
      sha256(source.files.get('shape-lock.json')!) !== spec.source.shapeLockSha256) {
    throw new Error('Animation source revision does not match the pinned CharacterSpec, shape lock and production manifest.');
  }
  if (!isDeepStrictEqual(spec.pivot, source.lock.groundPivot) || !isDeepStrictEqual(spec.layerOrder, source.lock.layerOrder) ||
      spec.seed !== source.geometry.spec.seed) throw new Error('Animation pivot, layer order and seed must match the character source.');
}

export function packAnimation<S extends ClipSpec, Q, Extra extends object>(
  source: CharacterPackage, spec: S, frames: AnimationFrame[], qa: Q, extra: Extra,
) {
  const { frameWidth: w, frameHeight: h } = spec.output;
  const sheet = makeRaster(w * frames.length, h);
  const timing = Object.assign({
    version: 1, kind: 'lumasprite-animation-timing', name: spec.name, image: 'spritesheet.png',
    canvas: { w, h }, sampling: 'nearest', pivot: spec.pivot, loop: spec.loop,
    totalDurationMs: spec.keyPoses.reduce((sum, pose) => sum + pose.durationMs, 0),
    frames: spec.keyPoses.map(({ phase, durationMs }, i) => {
      const { final } = frames[i].material;
      blit(sheet, final, i * w, 0);
      return { phase: phase as S['keyPoses'][number]['phase'], durationMs, rect: { x: i * w, y: 0, w, h }, rgbaSha256: sha256(final.rgba) };
    }),
  } as const, extra);
  const png = encodePng(sheet);
  const decoded = decodePng(png);
  if (!isDeepStrictEqual(decoded, sheet)) throw new Error('Animation PNG round-trip failed.');
  const slices = unpackAnimationStrip(decoded, timing);
  if (slices.some((cell, i) => !cell.rgba.equals(frames[i].material.final.rgba))) throw new Error('Animation strip cells differ from their frames.');
  const files = new Map([['animation-spec.json', json(spec)], ['spritesheet.png', png], ['timing.json', json(timing)], ['qa.json', json(qa)]]);
  const manifest = {
    version: 1, kind: 'lumasprite-animation-production', source: spec.source, material: source.manifest.style,
    name: spec.name, frameCount: spec.frameCount, loop: spec.loop, pivot: spec.pivot,
    files: Object.fromEntries([...files].map(([name, bytes]) => [name, sha256(bytes)])),
  };
  files.set('manifest.json', json(manifest));
  return { spec, source, frames, sheet, timing, qa, manifest, files };
}

function readRect(raster: Raster, x: number, y: number, w: number, h: number) {
  if (![x, y, w, h].every(Number.isInteger) || x < 0 || y < 0 || w < 1 || h < 1 || x + w > raster.w || y + h > raster.h) {
    throw new Error('Animation rectangle is outside the raster.');
  }
  const cell = makeRaster(w, h);
  for (let row = 0; row < h; row++) {
    const start = ((row + y) * raster.w + x) * 4;
    raster.rgba.copy(cell.rgba, row * w * 4, start, start + w * 4);
  }
  return cell;
}

export function unpackAnimationStrip(sheet: Raster, timing: { canvas: { w: number; h: number }; frames: readonly {
  rect: { x: number; y: number; w: number; h: number }; rgbaSha256: string;
}[] }) {
  const { w, h } = timing.canvas;
  if (!timing.frames.length || sheet.w !== w * timing.frames.length || sheet.h !== h) throw new Error('Animation strip size does not match timing metadata.');
  return timing.frames.map(({ rect, rgbaSha256 }, i) => {
    if (rect.x !== i * w || rect.y !== 0 || rect.w !== w || rect.h !== h) throw new Error('Animation frame rectangle is out of order.');
    const cell = readRect(sheet, rect.x, rect.y, w, h);
    if (sha256(cell.rgba) !== rgbaSha256) throw new Error('Animation frame RGBA hash mismatch.');
    return cell;
  });
}

function partTile(frame: AnimationFrame, part: string, raster: Raster) {
  const { left, top, right, bottom } = frame.geometry.metadata.diagnostics.parts[part];
  return readRect(raster, left, top, right - left + 1, bottom - top + 1);
}

export function inspectMotionTransition(from: AnimationFrame, to: AnimationFrame) {
  const displacement = Object.fromEntries(Object.entries(from.lock.landmarks).map(([id, { point: [x, y] }]) => {
    const next = to.lock.landmarks[id].point;
    return [id, [next[0] - x, next[1] - y] as const];
  }));
  let comparedParts = 0;
  const flicker: { part: string; pixels: number }[] = [];
  for (const part of from.lock.layerOrder) {
    // Align the authored part to its own bounds so a pure translation cannot hide a paint change.
    const a = partTile(from, part, from.geometry.layers[part]);
    const b = partTile(to, part, to.geometry.layers[part]);
    if (!isDeepStrictEqual(a, b)) continue;
    comparedParts++;
    const oldPaint = partTile(from, part, from.material.layers[part]).rgba;
    const newPaint = partTile(to, part, to.material.layers[part]).rgba;
    let pixels = 0;
    for (let at = 0; at < oldPaint.length; at += 4) {
      if (oldPaint.readUInt32BE(at) !== newPaint.readUInt32BE(at)) pixels++;
    }
    if (pixels) flicker.push({ part, pixels });
  }
  return { displacement, comparedParts, flicker, maxJointStepPx: Math.max(...Object.values(displacement).flat().map(Math.abs)) };
}
