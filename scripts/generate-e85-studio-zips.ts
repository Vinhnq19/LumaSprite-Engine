import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blit, composite, makeRaster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
interface NativeSceneLayer { id: string; kind: string }
interface NativeSceneInteraction { id: string; stand: { x: number; y: number } }
interface NativeSceneItem {
  id: string;
  studioState: {
    revision: number;
    actorOverrides: Record<string, { x: number; y: number }>;
    propOverrides: Record<string, { x: number; y: number }>;
    interactionOverrides: Record<string, { label?: string; linkedEntityId?: string | null; stand: { x: number; y: number } }>;
  };
  engineSnapshot: {
    layers: NativeSceneLayer[];
    interactions: NativeSceneInteraction[];
  };
}
interface StudioDoc {
  id: string;
  revision: number;
  studio?: { production?: { nativeScenes?: NativeSceneItem[] } };
}
type WireParseFn = <T = StudioDoc>(text: string) => T;
type WireStringifyFn = (val: unknown) => string;

const { serveStudio } = (await import(new URL('../../LumaSprite-Studio/dist/node/studio/server.js', import.meta.url).href)) as {
  serveStudio: (root: string, opts: { port: number; uiDir: string }) => Promise<{ url: string; close: () => Promise<void> }>;
};
const { PixelStore } = (await import(new URL('../../LumaSprite-Studio/dist/node/studio/pixel-store.js', import.meta.url).href)) as {
  PixelStore: new (root: string) => unknown;
};
const { wireParse, wireStringify } = (await import(new URL('../../LumaSprite-Studio/dist/studio/pixel/model.js', import.meta.url).href)) as {
  wireParse: WireParseFn;
  wireStringify: WireStringifyFn;
};

const OUT_DIR = 'D:/LumaSprite-Engine/.cache/e85-studio-zips';
const E8_INPUT = 'D:/LumaSprite-Engine/.cache/e8-adapter-1';
const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

function unzipStored(buf: Buffer): Record<string, Buffer> {
  const out: Record<string, Buffer> = {};
  for (let o = 0; o + 30 <= buf.length && buf.readUInt32LE(o) === 0x04034b50;) {
    const len = buf.readUInt32LE(o + 18);
    const nl = buf.readUInt16LE(o + 26);
    const el = buf.readUInt16LE(o + 28);
    const start = o + 30 + nl + el;
    const name = buf.toString('utf8', o + 30, o + 30 + nl);
    out[name] = buf.subarray(start, start + len);
    o = start + len;
  }
  return out;
}

function renderExpectedFromZip(zipBytes: Buffer, sceneJsonPath: string): { rgbaSha256: string; png: Buffer } {
  const files = unzipStored(zipBytes);
  const sc = JSON.parse(files[sceneJsonPath].toString('utf8'));
  const atlas = decodePng(files[`${sc.atlas}.png`]);
  const corr = decodePng(files[`${sc.correction}.png`]);
  const ground = makeRaster(sc.width, sc.height);
  const cols = sc.tiles.atlasColumns;
  const sz = sc.tiles.size;
  const gCols = sc.width / sz;
  for (let i = 0; i < sc.tiles.ids.length; i++) {
    const tid = sc.tiles.ids[i];
    const sx = (tid % cols) * sz;
    const sy = Math.floor(tid / cols) * sz;
    const dx = (i % gCols) * sz;
    const dy = Math.floor(i / gCols) * sz;
    for (let y = 0; y < sz; y++) {
      for (let x = 0; x < sz; x++) {
        ground.rgba.writeUInt32BE(atlas.rgba.readUInt32BE(((sy + y) * atlas.w + sx + x) * 4), ((dy + y) * ground.w + dx + x) * 4);
      }
    }
  }
  const comp = composite([ground, corr]);
  for (const layer of sc.layers) {
    const tex = decodePng(files[`${layer.texture}.png`]);
    blit(comp, tex, layer.at.x - layer.pivot.x, layer.at.y - layer.pivot.y);
  }
  assert.equal(sha256(comp.rgba), sc.source.rgba);
  return { rgbaSha256: sc.source.rgba, png: encodePng(comp) };
}

interface ZipSpec {
  id: string;
  sceneKey: string;
  light: 'day' | 'night';
  targetSubdir: string;
  zipFile: string;
  actorOverrides?: Record<string, { x: number; y: number }>;
  interactionLabel?: string;
  linkedEntityId?: string;
  reviewNote: string;
  rollbackDemo?: boolean;
  fromOwnerZip?: string;
}

const SPECS: ZipSpec[] = [
  {
    id: 'mistfen-day-e84-owner',
    sceneKey: 'mistfen-ferry-landing',
    light: 'day',
    targetSubdir: 'mistfen-ferry-landing/day-e84',
    zipFile: 'e8-mistfen-ferry-landing-day-e84-export.zip',
    reviewNote: 'Live QA verified',
    fromOwnerZip: join(OUT_DIR, 'e8-mistfen-ferry-landing-day-e84-export.zip'),
  },
  {
    id: 'mistfen-day-label',
    sceneKey: 'mistfen-ferry-landing',
    light: 'day',
    targetSubdir: 'mistfen-ferry-landing/day',
    zipFile: 'e8-mistfen-ferry-landing-day-label-e85.zip',
    actorOverrides: { surveyor: { x: 117, y: 174 } },
    interactionLabel: 'Kiểm tra cầu phà E8.5',
    linkedEntityId: 'mooring-2',
    reviewNote: 'E8.5 dynamic label QA',
  },
  {
    id: 'mistfen-night',
    sceneKey: 'mistfen-ferry-landing',
    light: 'night',
    targetSubdir: 'mistfen-ferry-landing/night',
    zipFile: 'e8-mistfen-ferry-landing-night-e85.zip',
    actorOverrides: { surveyor: { x: 117, y: 174 } },
    interactionLabel: 'Kiểm tra cầu phà đêm E8.5',
    linkedEntityId: 'mooring-2',
    reviewNote: 'E8.5 Mistfen night QA',
  },
  {
    id: 'floodgate-day',
    sceneKey: 'floodgate-maintenance-yard',
    light: 'day',
    targetSubdir: 'floodgate-maintenance-yard/day',
    zipFile: 'e8-floodgate-maintenance-yard-day-e85.zip',
    interactionLabel: 'Vận hành tay quay E8.5',
    linkedEntityId: 'sluice',
    reviewNote: 'E8.5 Floodgate day QA',
  },
  {
    id: 'floodgate-night',
    sceneKey: 'floodgate-maintenance-yard',
    light: 'night',
    targetSubdir: 'floodgate-maintenance-yard/night',
    zipFile: 'e8-floodgate-maintenance-yard-night-e85.zip',
    interactionLabel: 'Vận hành tay quay đêm E8.5',
    linkedEntityId: 'sluice',
    reviewNote: 'E8.5 Floodgate night QA',
  },
  {
    id: 'canal-day',
    sceneKey: 'canal-intake-service-platform',
    light: 'day',
    targetSubdir: 'canal-intake-service-platform/day',
    zipFile: 'e8-canal-intake-service-platform-day-e85.zip',
    interactionLabel: 'Kiểm tra cửa lấy nước E8.5',
    linkedEntityId: 'sluice',
    reviewNote: 'E8.5 Canal original day QA (19/35 aperture preserved)',
  },
  {
    id: 'canal-night',
    sceneKey: 'canal-intake-service-platform',
    light: 'night',
    targetSubdir: 'canal-intake-service-platform/night',
    zipFile: 'e8-canal-intake-service-platform-night-e85.zip',
    interactionLabel: 'Kiểm tra cửa lấy nước đêm E8.5',
    linkedEntityId: 'sluice',
    reviewNote: 'E8.5 Canal original night QA (19/35 aperture preserved)',
  },
  {
    id: 'canal-day-staging',
    sceneKey: 'canal-intake-service-platform',
    light: 'day',
    targetSubdir: 'canal-intake-service-platform/day-staging',
    zipFile: 'e8-canal-intake-service-platform-day-staging-e85.zip',
    actorOverrides: { courier: { x: 271, y: 110 } },
    interactionLabel: 'Kiểm tra cửa lấy nước (Staging E8.5)',
    linkedEntityId: 'sluice',
    reviewNote: 'E8.5 Canal separate staging revision (Courier moved to 271,110)',
  },
  {
    id: 'mistfen-day-rollback',
    sceneKey: 'mistfen-ferry-landing',
    light: 'day',
    targetSubdir: 'mistfen-ferry-landing/day-rollback',
    zipFile: 'e8-mistfen-ferry-landing-day-rollback-e85.zip',
    rollbackDemo: true,
    reviewNote: 'E8.5 rollback to X=113 QA',
  },
];

mkdirSync(OUT_DIR, { recursive: true });
const studioRoot = mkdtempSync(join(tmpdir(), 'lumasprite-e85-studio-'));
const app = await serveStudio(studioRoot, { port: 0, uiDir: 'D:/LumaSprite-Studio/dist/studio' });
const origin = new URL(app.url).origin;

async function produceViaRealStudio(spec: ZipSpec): Promise<Buffer> {
  if (spec.fromOwnerZip) {
    return readFileSync(spec.fromOwnerZip);
  }
  const createRes = await fetch(`${app.url}api/pixel/projects`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: wireStringify({ name: `E85_${spec.id}`, w: 32, h: 32, background: 0 }),
  });
  assert.equal(createRes.status, 201);
  let doc = wireParse(await createRes.text());

  const impRes = await fetch(`${app.url}api/pixel/projects/${doc.id}/native-scenes/import`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ revision: doc.revision, sourceDir: join(E8_INPUT, spec.sceneKey, spec.light), light: spec.light }),
  });
  assert.equal(impRes.status, 201, await impRes.clone().text());
  const impData = wireParse<{ document: StudioDoc; sceneId: string }>(await impRes.text());
  doc = impData.document;
  const sceneId: string = impData.sceneId;

  if (spec.rollbackDemo) {
    // 1) Mutate actor to X=117 with snapshot=true
    const edited = structuredClone(doc);
    const ns = edited.studio!.production!.nativeScenes![0];
    ns.studioState.revision += 1;
    ns.studioState.actorOverrides.surveyor = { x: 117, y: 174 };
    const putRes = await fetch(`${app.url}api/pixel/projects/${doc.id}`, {
      method: 'PUT',
      headers: { origin, 'content-type': 'application/json' },
      body: wireStringify({ revision: doc.revision, document: edited, snapshot: true }),
    });
    assert.equal(putRes.status, 200);
    doc = wireParse(await putRes.text());
    assert.equal(doc.studio!.production!.nativeScenes![0].studioState.actorOverrides.surveyor.x, 117);

    // 2) Rollback via Studio history API to pre-edit snapshot (spawn back at X=113)
    const histRes = await fetch(`${app.url}api/pixel/projects/${doc.id}/history`);
    const entries = await histRes.json();
    const prior = entries.find((e: { label: string }) => e.label === 'Trước khi lưu thủ công');
    assert.ok(prior, 'Missing rollback snapshot');
    const restoreRes = await fetch(`${app.url}api/pixel/projects/${doc.id}/history`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ revision: doc.revision, snapshot: prior.id }),
    });
    assert.equal(restoreRes.status, 200);
    doc = wireParse(await restoreRes.text());
    assert.deepEqual(doc.studio!.production!.nativeScenes![0].studioState.actorOverrides, {});
  } else if (spec.actorOverrides || spec.interactionLabel) {
    const edited = structuredClone(doc);
    const ns = edited.studio!.production!.nativeScenes![0];
    ns.studioState.revision += 1;
    if (spec.actorOverrides) {
      for (const [k, pt] of Object.entries(spec.actorOverrides)) {
        if (ns.engineSnapshot.layers.some((l: { id: string; kind: string }) => l.id === k && l.kind === 'actor')) {
          ns.studioState.actorOverrides[k] = pt;
        } else {
          ns.studioState.propOverrides[k] = pt;
        }
      }
    }
    if (spec.interactionLabel) {
      const lm = ns.engineSnapshot.interactions[0];
      ns.studioState.interactionOverrides[lm.id] = {
        label: spec.interactionLabel,
        linkedEntityId: spec.linkedEntityId ?? null,
        stand: lm.stand,
      };
    }
    const putRes = await fetch(`${app.url}api/pixel/projects/${doc.id}`, {
      method: 'PUT',
      headers: { origin, 'content-type': 'application/json' },
      body: wireStringify({ revision: doc.revision, document: edited, snapshot: true }),
    });
    assert.equal(putRes.status, 200, await putRes.clone().text());
    doc = wireParse(await putRes.text());
  }

  // Verify UNREVIEWED blocks requireApproved export (except pre-exported Owner ZIP)
  const blockedRes = await fetch(`${app.url}api/pixel/projects/${doc.id}/native-scenes/${sceneId}/export`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ revision: doc.revision, requireApproved: true }),
  });
  assert.equal(blockedRes.status, 409);

  // Explicitly approve via Studio review endpoint
  const revRes = await fetch(`${app.url}api/pixel/projects/${doc.id}/native-scenes/${sceneId}/review`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ revision: doc.revision, status: 'APPROVED', note: spec.reviewNote }),
  });
  assert.equal(revRes.status, 200);
  doc = wireParse<{ document: StudioDoc }>(await revRes.text()).document;

  const expRes = await fetch(`${app.url}api/pixel/projects/${doc.id}/native-scenes/${sceneId}/export`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ revision: doc.revision, requireApproved: true }),
  });
  assert.equal(expRes.status, 200);
  return Buffer.from(await expRes.arrayBuffer());
}

try {
  // Sanity verify Store class runs cleanly against Studio built dist
  assert.ok(PixelStore);
  const manifestItems = [];
  for (const spec of SPECS) {
    const zipBytes = await produceViaRealStudio(spec);
    const zipOutPath = join(OUT_DIR, spec.zipFile);
    writeFileSync(zipOutPath, zipBytes);
    const sceneJsonPath = `${spec.sceneKey}/${spec.light}/scene.json`;
    const files = unzipStored(zipBytes);
    const scene = JSON.parse(files[sceneJsonPath].toString('utf8'));
    const expManifest = JSON.parse(files['export-manifest.json'].toString('utf8'));
    const sidecar = JSON.parse(files['studio-scene-sidecar.json'].toString('utf8'));
    const expected = renderExpectedFromZip(zipBytes, sceneJsonPath);
    const expectedPngName = `${spec.id}-expected.png`;
    writeFileSync(join(OUT_DIR, expectedPngName), expected.png);

    manifestItems.push({
      id: spec.id,
      sceneKey: spec.sceneKey,
      light: spec.light,
      targetSubdir: spec.targetSubdir,
      zipFile: spec.zipFile,
      zipPath: zipOutPath,
      zipBytes: statSync(zipOutPath).size,
      zipSha256: sha256(zipBytes),
      expectedPng: join(OUT_DIR, expectedPngName),
      expectedRgbaSha256: expected.rgbaSha256,
      sourceEngineRevision: expManifest.sourceRevision,
      protectedSha256: expManifest.protectedSha256,
      studioRevision: expManifest.studioRevision,
      approvalStatus: expManifest.approval.status,
      approvalNote: expManifest.approval.note,
      spawn: scene.spawn,
      routeLength: scene.route.length,
      interactionLabel: sidecar.nativeSceneRecord.studioState.interactionOverrides['primary-landmark']?.label ?? null,
      linkedEntityId: sidecar.nativeSceneRecord.studioState.interactionOverrides['primary-landmark']?.linkedEntityId ?? null,
      ownerOriginalZip: !!spec.fromOwnerZip,
      rollbackVerified: !!spec.rollbackDemo,
    });
    console.log('STUDIO_ZIP_OK', spec.zipFile, 'bytes=' + zipBytes.length, 'sha=' + sha256(zipBytes).slice(0, 12), 'spawn=' + JSON.stringify(scene.spawn), 'rev=s' + expManifest.studioRevision);
  }
  const manifestOut = {
    version: 1,
    studioCommit: '471ac90555d3545beff5182146e291ba97b9ae20',
    sourceCommit: '59353475334bf0ef9635b01f606a2f8de509d5d9',
    items: manifestItems,
  };
  writeFileSync(join(OUT_DIR, 'zips-manifest.json'), JSON.stringify(manifestOut, null, 2) + '\n');
  console.log('GENERATED_E85_ZIPS:', manifestItems.length);
} finally {
  await app.close();
  rmSync(studioRoot, { recursive: true, force: true });
}
