import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Point } from '../../core/geometry/shapes.ts';
import { blit, makeRaster, type Raster } from '../../core/pixels/raster.ts';
import { decodePng, encodePng } from '../../core/renderer/png.ts';
import { sha256 } from '../../quality/raster.ts';
import { animationSpecSchema } from '../../specs/animation.ts';
import { characterReview } from './export.ts';
import { characterMaterialReview } from './material-export.ts';
import { verifyCharacterProductionPackage } from './production.ts';
import { makeShapeLock } from './shape-lock.ts';

type CharacterPackage = Awaited<ReturnType<typeof verifyCharacterProductionPackage>>;
type AnimationFrame = Pick<CharacterPackage, 'geometry' | 'material' | 'lock'>;

const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const add = (p: Point, offset: Point): Point => [p[0] + offset[0], p[1] + offset[1]];

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

function partTile(frame: AnimationFrame, part: string, raster: Raster) {
  const { left, top, right, bottom } = frame.geometry.metadata.diagnostics.parts[part];
  return readRect(raster, left, top, right - left + 1, bottom - top + 1);
}

export function inspectIdleTransition(from: AnimationFrame, to: AnimationFrame) {
  const displacement = Object.fromEntries(Object.entries(from.lock.landmarks).map(([id, { point: [x, y] }]) => {
    const next = to.lock.landmarks[id].point;
    return [id, [next[0] - x, next[1] - y] as Point];
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

export function buildIdleAnimation(source: CharacterPackage, input: unknown) {
  const spec = animationSpecSchema.parse(input);
  const base = source.geometry.spec;
  const original = source.lock;
  if (base.version === 1 || base.pose.kind === 'forward-step-hold') throw new Error('Idle requires a revised standing character source.');
  if (base.version !== spec.source.characterSpecVersion || original.geometryRevision !== spec.source.geometryRevision ||
      sha256(source.files.get('manifest.json')!) !== spec.source.productionManifestSha256 ||
      sha256(source.files.get('character-spec.json')!) !== spec.source.characterSpecSha256 ||
      sha256(source.files.get('shape-lock.json')!) !== spec.source.shapeLockSha256) {
    throw new Error('Animation source revision does not match the pinned CharacterSpec, shape lock and production manifest.');
  }
  if (!isDeepStrictEqual(spec.pivot, original.groundPivot) || !isDeepStrictEqual(spec.layerOrder, original.layerOrder) || spec.seed !== base.seed) {
    throw new Error('Idle pivot, layer order and seed must match the character source.');
  }

  const frames = spec.keyPoses.map(({ phase, body, joints }) => {
    const geometry = characterReview({
      ...base,
      proportions: { ...base.proportions, jacket: [
        base.proportions.jacket[0] + body.jacketWidth, base.proportions.jacket[1] + body.jacketHeight,
      ] },
      pose: { ...base.pose,
        near: { ...base.pose.near, elbow: add(base.pose.near.elbow, joints.nearElbow) },
        far: { ...base.pose.far, elbow: add(base.pose.far.elbow, joints.farElbow) },
      },
    });
    const lock = makeShapeLock(geometry, spec.source.checkpoint, 'idle-' + phase);
    const same = (part: string) => isDeepStrictEqual(lock.bodyParts[part], original.bodyParts[part]);
    const assert = (condition: boolean, requirement: string) => {
      if (!condition) throw new Error(phase + ': ' + requirement);
    };
    assert(isDeepStrictEqual(lock.groundPivot, original.groundPivot) && isDeepStrictEqual(lock.layerOrder, original.layerOrder), 'Pivot or layer order changed.');
    assert(isDeepStrictEqual(lock.projectedGround, original.projectedGround) && same('near-boot') && same('far-boot') &&
      isDeepStrictEqual(lock.lockedRegions.bootSoles, original.lockedRegions.bootSoles), 'Planted feet changed.');
    if (original.gripAnchor) {
      assert(isDeepStrictEqual(lock.gripAnchor, original.gripAnchor) && same('lantern') && same('near-hand') &&
        isDeepStrictEqual(lock.lockedRegions.gripContact, original.lockedRegions.gripContact) &&
        isDeepStrictEqual(lock.lockedRegions.handleOpening, original.lockedRegions.handleOpening), 'Held equipment or grip contact changed.');
    }
    const material = characterMaterialReview(geometry, lock, source.manifest.style);
    assert(isDeepStrictEqual(material.diagnostics.ramps, source.material.diagnostics.ramps), 'Material ramps changed.');
    if (phase === 'neutral' || phase === 'return') assert(material.final.rgba.equals(source.material.final.rgba), 'Neutral frame differs from the source.');
    return { geometry, lock, material };
  });

  if (new Set(frames.map(frame => frame.lock.silhouetteAlphaSha256)).size < 2) throw new Error('Idle has no structural motion.');
  const transitions = frames.map((from, i) => {
    const ending = (i + 1) % frames.length;
    const result = inspectIdleTransition(from, frames[ending]);
    if (result.maxJointStepPx > spec.contact.jointStepPx || result.flicker.length) {
      throw new Error('Animation continuity or stable-part material flicker at frame ' + (i + 1) + ' → ' + (ending + 1) + '.');
    }
    return { from: spec.keyPoses[i].phase, to: spec.keyPoses[ending].phase, wrap: ending === 0, ...result };
  });
  const { frameWidth: w, frameHeight: h } = spec.output;
  const sheet = makeRaster(w * frames.length, h);
  const timing = {
    version: 1, kind: 'lumasprite-animation-timing', name: spec.name, image: 'spritesheet.png',
    canvas: { w, h }, sampling: 'nearest', pivot: spec.pivot, loop: spec.loop,
    totalDurationMs: spec.keyPoses.reduce((sum, pose) => sum + pose.durationMs, 0),
    frames: spec.keyPoses.map(({ phase, durationMs }, i) => {
      const { final } = frames[i].material;
      blit(sheet, final, i * w, 0);
      return { phase, durationMs, rect: { x: i * w, y: 0, w, h }, rgbaSha256: sha256(final.rgba) };
    }),
  } as const;
  const png = encodePng(sheet);
  const decoded = decodePng(png);
  if (decoded.w !== sheet.w || decoded.h !== sheet.h || !decoded.rgba.equals(sheet.rgba)) throw new Error('Animation PNG round-trip failed.');
  const slices = unpackAnimationStrip(decoded, timing);
  if (slices.some((cell, i) => !cell.rgba.equals(frames[i].material.final.rgba))) throw new Error('Animation strip cells differ from their frames.');
  const qa = {
    version: 1, technical: 'PASS', artistic: 'VISUAL_REVIEW_PENDING', root: spec.pivot, layerOrder: original.layerOrder,
    frames: frames.map(({ geometry, lock, material }, i) => ({
      phase: spec.keyPoses[i].phase, alphaSha256: lock.silhouetteAlphaSha256, geometrySha256: lock.source.geometrySha256,
      rgbaSha256: material.metadata.images.finalRgbaSha256, alphaPixels: lock.lockedRegions.silhouette.pixels,
      partMasks: Object.fromEntries(lock.layerOrder.map(id => [id, lock.bodyParts[id].alphaSha256])),
      feet: geometry.metadata.diagnostics.pose!.feet, grip: lock.gripAnchor,
      gripPixels: geometry.metadata.diagnostics.gripPixels, lampGapRows: geometry.metadata.diagnostics.lampGapRows,
      openHandleRows: geometry.metadata.diagnostics.pose!.openHandleRows, armTorsoGapRows: geometry.metadata.diagnostics.pose!.armTorsoGapRows,
      headroom: geometry.metadata.diagnostics.pose!.headroom, joints: geometry.metadata.diagnostics.joints,
    })),
    transitions,
  };
  const files = new Map([['animation-spec.json', json(spec)], ['spritesheet.png', png], ['timing.json', json(timing)], ['qa.json', json(qa)]]);
  const manifest = {
    version: 1, kind: 'lumasprite-animation-production', source: spec.source, material: source.manifest.style,
    name: spec.name, frameCount: spec.frameCount, loop: spec.loop, pivot: spec.pivot,
    files: Object.fromEntries([...files].map(([name, bytes]) => [name, sha256(bytes)])),
  };
  files.set('manifest.json', json(manifest));
  return { spec, source, frames, sheet, timing, qa, manifest, files };
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

export async function verifyAnimationPackage(directory: string, characterDirectory: string) {
  const [source, bytes] = await Promise.all([
    verifyCharacterProductionPackage(characterDirectory), readFile(join(directory, 'animation-spec.json')),
  ]);
  const rebuilt = buildIdleAnimation(source, JSON.parse(bytes.toString('utf8')));
  if ((await readdir(directory)).length !== rebuilt.files.size) throw new Error('Unexpected animation package files.');
  for (const [file, expected] of rebuilt.files) {
    if (!expected.equals(await readFile(join(directory, file)))) throw new Error('Animation package differs at ' + file);
  }
  return rebuilt;
}
