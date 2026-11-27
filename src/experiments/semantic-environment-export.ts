import assert from 'node:assert/strict';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { blit, composite, makeRaster, put, type Raster } from '../core/pixels/raster.ts';
import type { Composition } from '../generators/environment/composition.ts';
import { sha256 } from '../quality/raster.ts';
import type { EnvironmentLight } from '../specs/environment.ts';
import { type renderLanding, type SemanticScene } from './semantic-environment.ts';

type Frame = ReturnType<typeof renderLanding>;
type Runs = [number, number][][];
const TILE = 16, COLUMNS = 16;
const WHITE = pack('#ffffff');
const crop = (source: Raster, x: number, y: number, w: number, h: number) => {
  const result = makeRaster(w, h);
  for (let row = 0; row < h; row++) {
    const i = ((y + row) * source.w + x) * 4;
    source.rgba.copy(result.rgba, row * w * 4, i, i + w * 4);
  }
  return result;
};
const alpha = (map: Raster, i: number) => map.rgba[i * 4 + 3] === 255;

export function maskRows(mask: Raster): Runs {
  return Array.from({ length: mask.h }, (_, y) => {
    const spans: [number, number][] = [];
    for (let x = 0; x < mask.w; x++) if (alpha(mask, y * mask.w + x)) {
      const start = x;
      while (x + 1 < mask.w && alpha(mask, y * mask.w + x + 1)) x++;
      spans.push([start, x + 1]);
    }
    return spans;
  });
}

export function decodeMask([w, h]: readonly [number, number], rows: Runs) {
  const mask = makeRaster(w, h);
  assert.equal(rows.length, h, 'MASK_HEIGHT');
  for (const [y, spans] of rows.entries()) {
    let previous = -1;
    for (const [start, end] of spans) {
      assert.ok(Number.isInteger(start) && Number.isInteger(end) && start > previous &&
        start >= 0 && end > start && end <= w, 'MASK_SPAN');
      for (let x = start; x < end; x++) put(mask, x, y, WHITE);
      previous = end;
    }
  }
  return mask;
}

export function spatialExport(spec: SemanticScene, frame: Frame, halfFeet: number, sourceSha256: string) {
  const { w, h } = frame.scene, { layout, surfaces, legacy, items } = frame;
  const fresh = () => makeRaster(w, h);
  const water = fresh(), shore = fresh(), walkable = fresh(), collision = fresh(), path = fresh(), supports = fresh();
  const solid = legacy.collisionPlane;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, wet = x >= layout.shore[y], deck = alpha(surfaces.top, i);
    assert.equal(alpha(surfaces.layers.deck, i), deck, 'DECK_RENDER_MASK_MISMATCH');
    if (wet) put(water, x, y, WHITE);
    if (!wet && x >= layout.shore[y] - 10) put(shore, x, y, WHITE);
    if (!wet && alpha(surfaces.pathMask, i)) put(path, x, y, WHITE);
    if (alpha(surfaces.layers.support, i) && !deck) put(supports, x, y, WHITE);
    const blocked = (wet && !deck) || alpha(solid, i);
    put(blocked ? collision : walkable, x, y, WHITE);
  }
  return {
    version: 1, coordinateSystem: 'top-left scene pixels; projected contact anchors', size: spec.size, sourceSha256,
    seed: spec.seed, camera: legacy.metadata.camera, style: spec.style, profile: spec.profile,
    intent: { purpose: spec.purpose, brief: spec.brief, role: spec.role },
    geometry: { shoreline: layout.shore, access: layout.access, walkway: layout.deck, freeboardPixels: layout.freeboard,
      lip: layout.lip, heightMode: 'projected only', supports: layout.posts },
    materials: { water: 'water', shore: 'earth and reeds', walkway: 'wood', supports: 'wood',
      obstacles: 'E6 palette; sluice uses stone, wood and metal' },
    layers: ['terrain', 'water', 'shore', 'access', 'projected supports', 'walkway', 'E6 contact-sorted foreground'],
    anchors: { spawn: spec.actors, boarding: layout.berth, bankEntry: layout.entry,
      mooring: items.filter(item => item.ref === 'mooring').map(item => item.at), gate: spec.gate?.at ?? null },
    connection: { from: spec.actors.surveyor, to: layout.berth, projectedBodyHalfWidth: halfFeet, footprintHalfHeight: 2 },
    layerOrder: legacy.metadata.layerOrder, entities: legacy.metadata.occlusion, colliders: legacy.metadata.collisions,
    masks: { water: maskRows(water), shore: maskRows(shore), deck: maskRows(surfaces.top), access: maskRows(path),
      supports: maskRows(supports), solid: maskRows(solid), collision: maskRows(collision), walkable: maskRows(walkable) },
  };
}

export type Spatial = ReturnType<typeof spatialExport>;

export function validateSpatial(data: Spatial) {
  const [w, h] = data.size;
  const masks = {
    water: decodeMask(data.size, data.masks.water), shore: decodeMask(data.size, data.masks.shore),
    deck: decodeMask(data.size, data.masks.deck), solid: decodeMask(data.size, data.masks.solid),
    collision: decodeMask(data.size, data.masks.collision), walkable: decodeMask(data.size, data.masks.walkable),
    access: decodeMask(data.size, data.masks.access), supports: decodeMask(data.size, data.masks.supports),
  };
  assert.equal(data.geometry.shoreline.length, h);
  const exportDeck = makeRaster(w, h), exportSolids = makeRaster(w, h);
  fillPolygon(exportDeck, data.geometry.walkway, WHITE);
  for (const box of data.colliders) fillPolygon(exportSolids, box.points, WHITE);
  assert.deepEqual(exportSolids.rgba, masks.solid.rgba, 'SOLIDS_GEOMETRY_MISMATCH');
  let overlap = 0, coveredWater = 0, waterCollision = 0, walkable = 0;
  for (let i = 0; i < w * h; i++) {
    const wet = alpha(masks.water, i), deck = alpha(masks.deck, i);
    const wall = alpha(masks.solid, i), blocked = alpha(masks.collision, i);
    assert.equal(wet, (i % w) >= data.geometry.shoreline[Math.floor(i / w)], 'WATER_GEOMETRY_MISMATCH');
    assert.ok(!alpha(masks.access, i) || !wet, 'ACCESS_ON_WATER');
    assert.equal(blocked, wall || (wet && !deck), 'INCORRECT_COLLISION');
    assert.equal(alpha(masks.walkable, i), !blocked, 'INCORRECT_WALKABILITY');
    if (deck) { if (wet) coveredWater++; else overlap++; }
    if (wet && blocked) waterCollision++;
    if (!blocked) walkable++;
  }
  assert.ok(overlap >= 100 && coveredWater >= 100, 'BRIDGE_DETACHED');
  assert.deepEqual(exportDeck.rgba, masks.deck.rgba, 'DECK_GEOMETRY_MISMATCH');
  const inside = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < w && y >= 0 && y < h;
  const walk = (x: number, y: number) => inside(x, y) && alpha(masks.walkable, y * w + x);
  for (const p of Object.values(data.anchors.spawn)) assert.ok(walk(...p), 'SPAWN_NOT_WALKABLE');
  assert.ok(walk(...data.anchors.boarding) && alpha(masks.deck, data.anchors.boarding[1] * w + data.anchors.boarding[0]),
    'BERTH_NOT_WALKABLE');
  assert.ok(alpha(masks.access, data.anchors.bankEntry[1] * w + data.anchors.bankEntry[0]) ||
    alpha(masks.deck, data.anchors.bankEntry[1] * w + data.anchors.bankEntry[0]), 'ENTRY_OUTSIDE_ACCESS');
  for (const anchor of data.anchors.mooring) {
    assert.ok(inside(...anchor) && alpha(masks.solid, (anchor[1] - 1) * w + anchor[0]), 'MOORING_COLLIDER_MISSING');
  }
  for (const row of data.entities) {
    assert.ok(inside(...row.at) && row.left >= 0 && row.top >= 0 && row.left + row.w <= w && row.top + row.h <= h, 'PIVOT_BOUNDS');
    if (row.kind === 'actor') assert.ok(row.visible >= row.visibleBefore * .65, 'ACTOR_OCCLUDED');
  }
  assert.deepEqual(data.layerOrder, data.entities.map(item => item.id), 'DEPTH_ORDER');
  assert.deepEqual(data.connection.from, data.anchors.spawn.surveyor, 'CONNECTION_SPAWN');
  assert.deepEqual(data.connection.to, data.anchors.boarding, 'CONNECTION_BERTH');

  const routeFits = (x: number, y: number) => {
    const half = data.connection.projectedBodyHalfWidth;
    for (let dy = -data.connection.footprintHalfHeight; dy <= data.connection.footprintHalfHeight; dy++)
      for (let dx = -half; dx <= half; dx++) if (!walk(x + dx, y + dy)) return false;
    return true;
  };
  const from = data.connection.from[1] * w + data.connection.from[0], to = data.connection.to[1] * w + data.connection.to[0];
  assert.ok(routeFits(...data.connection.from) && routeFits(...data.connection.to), 'ROUTE_ENDPOINT_CLEARANCE');
  const previous = new Int32Array(w * h).fill(-1);
  const queue = [from];
  previous[from] = from;
  for (let j = 0; j < queue.length && previous[to] < 0; j++) {
    const i = queue[j], x = i % w, y = Math.floor(i / w);
    for (const [nx, ny] of [[x + 1, y], [x, y - 1], [x, y + 1], [x - 1, y]]) {
      const index = ny * w + nx;
      if (!inside(nx, ny) || previous[index] >= 0 || !routeFits(nx, ny)) continue;
      previous[index] = i;
      queue.push(index);
    }
  }
  assert.ok(previous[to] >= 0, 'ROUTE_BLOCKED');
  const route: Point[] = [];
  for (let i = to; ; i = previous[i]) {
    route.push([i % w, Math.floor(i / w)]);
    if (i === from) break;
  }
  return { masks, route: route.reverse(), counts: { overlap, coveredWater, waterCollision, walkable, routeLength: route.length - 1 } };
}

export function validateOcclusion(scene: Raster, frame: Frame) {
  const layers = frame.legacy.metadata.atlas.layerLegend;
  const protectedInks = new Set([layers.actor, layers.prop, layers.building].map(pack));
  let protectedPixels = 0, actorPixels = 0, waterfrontActorPixels = 0, crossLayerPixels = 0;
  for (let i = 0; i < scene.rgba.length; i += 4) {
    const owner = frame.legacy.layerOverlay.rgba.readUInt32BE(i);
    if (!protectedInks.has(owner)) continue;
    protectedPixels++;
    assert.equal(scene.rgba.readUInt32BE(i), frame.legacy.raster.rgba.readUInt32BE(i), 'INCORRECT_OCCLUSION');
    if (frame.surfaceImage.rgba[i + 3]) crossLayerPixels++;
    if (owner === pack(layers.actor)) {
      actorPixels++;
      if (frame.surfaceImage.rgba[i + 3]) waterfrontActorPixels++;
    }
  }
  assert.ok(actorPixels && waterfrontActorPixels > 0 && crossLayerPixels > 0, 'OCCLUSION_FIXTURE_NOT_EXERCISED');
  return { protectedPixels, actorPixels, waterfrontActorPixels, crossLayerPixels };
}

export function layerInspection(frame: Frame) {
  const result = composite([frame.legacy.layerOverlay]);
  const inks = frame.legacy.metadata.atlas.layerLegend;
  const visibleBase = new Set([inks.terrain, inks.path].map(pack));
  for (let i = 0; i < result.rgba.length; i += 4) {
    if (frame.surfaces.semantic.rgba[i + 3] && visibleBase.has(result.rgba.readUInt32BE(i))) {
      result.rgba.writeUInt32BE(frame.surfaces.semantic.rgba.readUInt32BE(i), i);
    }
  }
  return result;
}

export function buildTiles(base: Composition, frame: Frame, light: EnvironmentLight) {
  const { w, h } = frame.scene, theme = base.environment.style.illumination[light];
  const terrain = base.environment.terrain;
  const colors = new Map((['grass', 'dirt'] as const).flatMap(k => terrain[k].map((ink, i) => [pack(ink), pack(theme[k][i])] as const)));
  const bare = makeRaster(w, h), foreground = makeRaster(w, h);
  for (let i = 0; i < bare.rgba.length; i += 4) {
    bare.rgba.writeUInt32BE(colors.get(base.environment.ground.rgba.readUInt32BE(i))!, i);
  }
  const ground = composite([bare, frame.surfaceImage]);
  const groundOwners = frame.legacy.metadata.atlas.layerLegend;
  const baseInks = new Set([groundOwners.terrain, groundOwners.path].map(pack));
  for (let i = 0; i < ground.rgba.length; i += 4) {
    const final = frame.scene.rgba.readUInt32BE(i);
    if (baseInks.has(frame.legacy.layerOverlay.rgba.readUInt32BE(i))) ground.rgba.writeUInt32BE(final, i);
    else foreground.rgba.writeUInt32BE(final, i);
  }
  const tiles = new Map<string, number>(), rasters: Raster[] = [];
  const ids = Array.from({ length: h / TILE }, (_, iy) => Array.from({ length: w / TILE }, (_, ix) => {
    const tile = crop(ground, ix * TILE, iy * TILE, TILE, TILE);
    const digest = sha256(tile.rgba);
    if (!tiles.has(digest)) {
      tiles.set(digest, rasters.length);
      rasters.push(tile);
    }
    return tiles.get(digest)!;
  }));
  const atlas = makeRaster(COLUMNS * TILE, Math.ceil(rasters.length / COLUMNS) * TILE);
  const cells = rasters.map((tile, id) => {
    const x = (id % COLUMNS) * TILE, y = Math.floor(id / COLUMNS) * TILE;
    blit(atlas, tile, x, y);
    return { id, x, y, rgbaSha256: sha256(tile.rgba) };
  });
  const tilemap = { version: 1, size: [w, h], origin: [0, 0], tileSize: TILE, columns: COLUMNS,
    atlas: 'atlas-' + light + '.png', foreground: 'foreground-' + light + '.png',
    sampling: 'nearest', ids, cells, groundRgbaSha256: sha256(ground.rgba), sceneRgbaSha256: sha256(frame.scene.rgba) };
  return { atlas, tilemap, ground, foreground };
}

export function verifyTiles(atlas: Raster, map: ReturnType<typeof buildTiles>['tilemap'], foreground: Raster, expected: Raster) {
  const [w, h] = map.size;
  assert.deepEqual([map.version, map.tileSize, map.columns, map.sampling, ...map.origin], [1, TILE, COLUMNS, 'nearest', 0, 0]);
  assert.deepEqual([atlas.w, atlas.h], [COLUMNS * TILE, Math.ceil(map.cells.length / COLUMNS) * TILE], 'ATLAS_DIMENSIONS');
  const atlasTiles = map.cells.map((cell, id) => {
    assert.deepEqual([cell.id, cell.x, cell.y], [id, id % COLUMNS * TILE, Math.floor(id / COLUMNS) * TILE], 'ATLAS_CELL_ID');
    const tile = crop(atlas, cell.x, cell.y, TILE, TILE);
    assert.equal(cell.rgbaSha256, sha256(tile.rgba), 'ATLAS_CELL_HASH');
    return tile;
  });
  const preview = makeRaster(w, h);
  assert.equal(map.ids.length * TILE, h, 'TILE_GRID_HEIGHT');
  for (const [row, ids] of map.ids.entries()) {
    assert.equal(ids.length * TILE, w, 'TILE_GRID_WIDTH');
    for (const [col, id] of ids.entries()) {
      assert.ok(Number.isInteger(id) && Object.hasOwn(atlasTiles, id), 'TILE_MISSING');
      blit(preview, atlasTiles[id], col * TILE, row * TILE);
    }
  }
  let seams = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    assert.ok(alpha(preview, i), 'TILE_ALPHA_HOLE');
    if (x % TILE === 0 || x % TILE === TILE - 1 || y % TILE === 0 || y % TILE === TILE - 1) {
      assert.equal(preview.rgba.readUInt32BE(i * 4), expected.rgba.readUInt32BE(i * 4), 'TILE_SEAM');
      seams++;
    }
  }
  assert.equal(sha256(preview.rgba), map.groundRgbaSha256, 'TILE_REPLAY_HASH');
  assert.equal(sha256(composite([preview, foreground]).rgba), map.sceneRgbaSha256, 'SCENE_REPLAY_HASH');
  return { preview, seams };
}

export function diagnosticOverlay(scene: Raster, mask: Raster, color: string) {
  const image = composite([scene]);
  const ink = pack(color);
  for (let i = 0; i < scene.w * scene.h; i++) {
    if (alpha(mask, i) && (i % scene.w + Math.floor(i / scene.w)) % 6 === 0) image.rgba.writeUInt32BE(ink, i * 4);
  }
  return image;
}

export function verifyNegativeCases(spatial: Spatial, frame: Frame, tiles: ReturnType<typeof buildTiles>) {
  const result: string[] = [];
  const failure = (code: string, run: () => void) => {
    assert.throws(run, new RegExp(code));
    result.push(code);
  };
  const setCollision = (data: Spatial, x: number, y: number, blocked: boolean) => {
    for (const [key, value] of [['solid', blocked], ['collision', blocked], ['walkable', !blocked]] as const) {
      const mask = decodeMask(data.size, data.masks[key]);
      put(mask, x, y, value ? WHITE : 0);
      data.masks[key] = maskRows(mask);
    }
  };
  const blocked = structuredClone(spatial), x = Math.floor((spatial.connection.from[0] + spatial.connection.to[0]) / 2);
  blocked.colliders.push({ id: 'negative-wall', kind: 'prop', points: [[x, 0], [x + 1, 0], [x + 1, blocked.size[1]], [x, blocked.size[1]]] });
  for (let y = 0; y < blocked.size[1]; y++) setCollision(blocked, x, y, true);
  failure('ROUTE_BLOCKED', () => validateSpatial(blocked));

  const detached = structuredClone(spatial);
  const deck = decodeMask(detached.size, detached.masks.deck);
  for (let y = 0; y < deck.h; y++) for (let px = 0; px < detached.geometry.shoreline[y]; px++) put(deck, px, y, 0);
  detached.masks.deck = maskRows(deck);
  failure('BRIDGE_DETACHED', () => validateSpatial(detached));

  const wrong = structuredClone(spatial);
  const collision = decodeMask(wrong.size, wrong.masks.collision);
  put(collision, wrong.size[0] - 1, 0, 0);
  wrong.masks.collision = maskRows(collision);
  failure('INCORRECT_COLLISION', () => validateSpatial(wrong));

  const missing = structuredClone(tiles.tilemap);
  missing.ids[0][1] = missing.cells.length;
  failure('TILE_MISSING', () => verifyTiles(tiles.atlas, missing, tiles.foreground, tiles.ground));

  const occluded = composite([frame.scene]), layers = frame.legacy.layerOverlay;
  const actor = pack(frame.legacy.metadata.atlas.layerLegend.actor);
  for (let i = 0; i < layers.rgba.length; i += 4) if (layers.rgba.readUInt32BE(i) === actor && frame.surfaceImage.rgba[i + 3]) {
    occluded.rgba.writeUInt32BE(frame.surfaceImage.rgba.readUInt32BE(i), i);
    break;
  }
  failure('INCORRECT_OCCLUSION', () => validateOcclusion(occluded, frame));
  return result;
}
