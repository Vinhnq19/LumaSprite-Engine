import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { blit } from '../../core/pixels/raster.ts';
import { decodePng, encodePng } from '../../core/renderer/png.ts';
import { sha256 } from '../../quality/raster.ts';
import { terrainMapSpec, terrainSpecSchema } from '../../specs/terrain.ts';
import { terrainExport } from './export.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap, type TerrainAtlas } from './render.ts';

const overlayPlacement = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  left: z.number().int().min(0).max(2047),
  top: z.number().int().min(0).max(2047),
  provenance: z.string().trim().min(1).max(200),
});
type Overlay = z.infer<typeof overlayPlacement> & { png: Buffer };

const bakeInputs = z.object({
  version: z.literal(1),
  kind: z.literal('lumasprite-baked-terrain'),
  spec: terrainSpecSchema,
  map: terrainMapSpec,
  overlays: z.array(overlayPlacement.extend({
    file: z.string(),
    pngSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })).max(16),
});

const text = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const layerName = (index: number) => 'overlay-' + (index + 1) + '.png';

export function bakeTerrain(terrain: TerrainAtlas, input: unknown, overlays: readonly Overlay[] = []) {
  const map = terrainMapSpec.parse(input);
  if (terrain.spec.version === 1 || terrain.spec.variation !== 'world') {
    throw new Error('Baking world detail requires a world-variation TerrainSpec.');
  }
  if (overlays.length > 16 || new Set(overlays.map(layer => layer.id)).size !== overlays.length) {
    throw new Error('Expected at most 16 uniquely identified overlays.');
  }
  const cells = tileIdsForMap(map.rows);
  const raster = renderTileGrid(terrain, cells, map.origin);
  const entries: [string, Buffer][] = [];
  const bakedOverlays = overlays.map(({ png, ...placement }, i) => {
    const layer = overlayPlacement.parse(placement);
    if (png.length < 33 || png.length > 512 * 1024 || png.readUInt32BE(16) > 256 || png.readUInt32BE(20) > 256) {
      throw new Error('Overlay must be a native PNG up to 256×256 and 512 KiB.');
    }
    const source = decodePng(png);
    for (let at = 0; at < source.rgba.length; at += 4) {
      const ink = source.rgba.readUInt32BE(at), alpha = ink & 255;
      if (ink !== 0 && alpha !== 255) throw new Error('Overlay needs opaque pixels and zero-RGBA transparency.');
    }
    blit(raster, source, layer.left, layer.top);
    const file = layerName(i);
    entries.push([file, png]);
    return { ...layer, file, pngSha256: sha256(png) };
  });
  const atlas = terrainExport(terrain);
  const atlasJson = text(atlas.mapping);
  const png = encodePng(raster);
  const manifest = {
    version: 1,
    kind: 'lumasprite-baked-terrain',
    coordinateUnit: 'tile',
    renderMode: 'world-baked-raster',
    editableAtlas: { manifest: 'atlas.json', png: 'atlas.png', pngSha256: atlas.mapping.pngSha256, manifestSha256: sha256(atlasJson) },
    image: { file: 'map.png', width: raster.w, height: raster.h, pngSha256: sha256(png), rgbaSha256: sha256(raster.rgba) },
    spec: terrain.spec,
    map,
    cells,
    overlays: bakedOverlays,
    paletteDiagnostics: terrain.material.diagnostics,
  };
  entries.unshift(['atlas.png', atlas.png], ['atlas.json', atlasJson], ['map.png', png]);
  // Publish the integrity record after its payload files.
  entries.push(['map.json', text(manifest)]);
  return { manifest, raster, files: new Map(entries) };
}

export async function writeBakedTerrain(directory: string, bundle: ReturnType<typeof bakeTerrain>) {
  await mkdir(directory, { recursive: true });
  const existing = await readdir(directory);
  if (existing.length) {
    if (existing.length !== bundle.files.size || existing.some(name => !bundle.files.has(name))) {
      throw new Error('Choose an empty directory for a different baked terrain package.');
    }
    for (const [name, bytes] of bundle.files) {
      if (!(await readFile(join(directory, name))).equals(bytes)) {
        throw new Error('Existing package differs at ' + name + '. Choose an empty directory.');
      }
    }
    return;
  }
  for (const [name, bytes] of bundle.files) await writeFile(join(directory, name), bytes, { flag: 'wx' });
}

export async function verifyBakedTerrain(directory: string) {
  const manifest = bakeInputs.parse(JSON.parse(await readFile(join(directory, 'map.json'), 'utf8')));
  const overlays = await Promise.all(manifest.overlays.map(async (layer, i) => {
    if (layer.file !== layerName(i)) throw new Error('Invalid overlay file name.');
    const png = await readFile(join(directory, layerName(i)));
    if (sha256(png) !== layer.pngSha256) throw new Error('Overlay SHA-256 mismatch: ' + layer.id);
    return { id: layer.id, left: layer.left, top: layer.top, provenance: layer.provenance, png };
  }));
  const expected = bakeTerrain(renderTerrain(manifest.spec), manifest.map, overlays);
  for (const [name, bytes] of expected.files) {
    if (!(await readFile(join(directory, name))).equals(bytes)) {
      throw new Error('Baked terrain bytes do not match at ' + name);
    }
  }
  return expected.manifest;
}
