import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { sha256 } from '../../quality/raster.ts';
import { characterReview } from './export.ts';
import { characterMaterialReview } from './material-export.ts';
import { materialStyles, type MaterialStyle } from './materials.ts';
import { alphaPlane, type ShapeLock } from './shape-lock.ts';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const lineageSchema = z.strictObject({
  checkpoint: z.string().regex(/^[a-f0-9]{7,40}$/),
  reference: z.string().trim().min(1).max(150),
  referenceSha256: hash,
});
type Lineage = z.infer<typeof lineageSchema>;
const packageHeader = z.object({
  version: z.literal(1), kind: z.literal('lumasprite-character-production'),
  style: z.enum(materialStyles), lineage: lineageSchema,
});
const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');

function packMask(alpha: Buffer) {
  const bytes = Buffer.alloc(Math.ceil(alpha.length / 8));
  for (const [i, pixel] of alpha.entries()) if (pixel === 255) bytes[i >> 3] |= 1 << (i & 7);
  return bytes.toString('base64');
}

export function unpackPartMask(encoded: string, pixels: number) {
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== Math.ceil(pixels / 8)) throw new Error('Character part mask has the wrong size.');
  return Uint32Array.from({ length: pixels }, (_, i) => (bytes[i >> 3] >> (i & 7)) & 1);
}

export function characterProductionPackage(geometry: ReturnType<typeof characterReview>, lock: ShapeLock, style: MaterialStyle, provenance: Lineage) {
  const lineage = lineageSchema.parse(provenance);
  const material = characterMaterialReview(geometry, lock, style);
  const files = new Map(material.files);
  const { w, h } = lock.canvas;
  const masks = Object.fromEntries(lock.layerOrder.map(id => [id, packMask(alphaPlane(material.layers[id]))]));
  files.set('character-spec.json', json(geometry.spec));
  files.set('shape-lock.json', json(lock));
  files.set('part-masks.json', json({ version: 1, w, h, encoding: 'packed-lsb0-row-major-base64', masks }));
  const manifest = {
    version: 1, kind: 'lumasprite-character-production', style, review: 'VISUAL_REVIEW_PENDING',
    characterSpecVersion: geometry.spec.version, canvas: { w, h }, groundPivot: lock.groundPivot,
    lineage, silhouetteAlphaSha256: lock.silhouetteAlphaSha256, rgbaSha256: material.metadata.images.finalRgbaSha256,
    files: Object.fromEntries([...files].map(([file, bytes]) => [file, sha256(bytes)])),
  };
  files.set('manifest.json', json(manifest));
  return { files, manifest, geometry, material, lock, masks };
}

export async function verifyCharacterProductionPackage(directory: string) {
  const read = (file: string) => readFile(join(directory, file));
  const [manifestBytes, spec, shape] = await Promise.all([read('manifest.json'), read('character-spec.json'), read('shape-lock.json')]);
  const header = packageHeader.parse(JSON.parse(manifestBytes.toString('utf8')));
  const lock = JSON.parse(shape.toString('utf8')) as ShapeLock;
  const rebuilt = characterProductionPackage(characterReview(JSON.parse(spec.toString('utf8'))), lock, header.style, header.lineage);
  if ((await readdir(directory)).length !== rebuilt.files.size) throw new Error('Unexpected character package files.');
  for (const [file, bytes] of rebuilt.files) {
    if (!bytes.equals(await read(file))) throw new Error('Character production package differs at ' + file);
  }
  return rebuilt;
}
