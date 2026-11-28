import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
interface NativeSceneItem {
  id: string;
  studioState: {
    revision: number;
    actorOverrides: Record<string, { x: number; y: number }>;
    interactionOverrides: Record<string, { stand: { x: number; y: number } }>;
    approval: { status: string };
  };
  engineSnapshot: { spawn: { x: number; y: number } };
}
interface StudioDoc {
  id: string;
  revision: number;
  studio?: { production?: { nativeScenes?: NativeSceneItem[] } };
}
interface PixelStoreLike {
  load: (id: string) => StudioDoc;
  history: (id: string) => Array<{ id: string; label: string }>;
  restore: (id: string, rev: number, snapshot: string) => StudioDoc;
}
type WireParseFn = <T = StudioDoc>(text: string) => T;
type WireStringifyFn = (val: unknown) => string;

const studioDist = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio', 'dist');
const fromStudio = (path: string) => pathToFileURL(join(studioDist, path)).href;
const { serveStudio } = (await import(fromStudio('node/studio/server.js'))) as {
  serveStudio: (root: string, opts: { port: number; uiDir: string }) => Promise<{ url: string; close: () => Promise<void> }>;
};
const { PixelStore } = (await import(fromStudio('node/studio/pixel-store.js'))) as {
  PixelStore: new (root: string) => PixelStoreLike;
};
const { wireParse, wireStringify } = (await import(fromStudio('studio/pixel/model.js'))) as {
  wireParse: WireParseFn;
  wireStringify: WireStringifyFn;
};

const E8_INPUT = resolve('.cache/e8-adapter-1');
const OWNER_ZIP = resolve('.cache/e85-studio-zips/e8-mistfen-ferry-landing-day-e84-export.zip');
const sha256 = (d: Uint8Array | string) => createHash('sha256').update(d).digest('hex');

function unzipStored(buf: Buffer): Record<string, Buffer> {
  const out: Record<string, Buffer> = {};
  for (let o = 0; o + 30 <= buf.length && buf.readUInt32LE(o) === 0x04034b50;) {
    const len = buf.readUInt32LE(o + 18), nl = buf.readUInt16LE(o + 26), el = buf.readUInt16LE(o + 28);
    const start = o + 30 + nl + el;
    out[buf.toString('utf8', o + 30, o + 30 + nl)] = buf.subarray(start, start + len);
    o = start + len;
  }
  return out;
}

test('E8.5 Phase A & D: Owner Studio ZIP integrity, protected source guard, STALE invalidation, rollback & negative security cases', async t => {
  assert.ok(existsSync(OWNER_ZIP), 'Owner ZIP staged in .cache/e85-studio-zips');
  const zipBytes = readFileSync(OWNER_ZIP);
  assert.equal(zipBytes.length, 163438);
  assert.equal(sha256(zipBytes), 'b7606778e555e2f048356c1dbb6c89be7bbc9315683e7c0e88d99c6c4d779754');
  const entries = unzipStored(zipBytes);
  const mf = JSON.parse(entries['export-manifest.json'].toString('utf8'));
  const sidecar = JSON.parse(entries['studio-scene-sidecar.json'].toString('utf8'));
  assert.equal(mf.approval.status, 'APPROVED');
  assert.equal(mf.studioRevision, 8);
  assert.equal(sidecar.nativeSceneRecord.studioState.actorOverrides.surveyor.x, 117);

  const root = mkdtempSync(join(tmpdir(), 'e85-pipeline-test-'));
  const app = await serveStudio(root, { port: 0, uiDir: join(studioDist, 'studio') });
  t.after(async () => { await app.close(); rmSync(root, { recursive: true, force: true }); });
  const origin = new URL(app.url).origin;
  const store = new PixelStore(root);

  // 1. Import Mistfen Day cleanly
  const cRes = await fetch(`${app.url}api/pixel/projects`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: wireStringify({ name: 'E85 Integrity', w: 32, h: 32, background: 0 }),
  });
  let doc = wireParse(await cRes.text());
  const iRes = await fetch(`${app.url}api/pixel/projects/${doc.id}/native-scenes/import`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ revision: doc.revision, sourceDir: join(E8_INPUT, 'mistfen-ferry-landing', 'day') }),
  });
  assert.equal(iRes.status, 201);
  doc = wireParse<{ document: StudioDoc }>(await iRes.text()).document;
  const sceneId = doc.studio!.production!.nativeScenes![0].id;

  // 2. Protected Engine snapshot cannot be edited directly
  const mutated = structuredClone(doc);
  mutated.studio!.production!.nativeScenes![0].engineSnapshot.spawn.x = 117;
  const pRes = await fetch(`${app.url}api/pixel/projects/${doc.id}`, {
    method: 'PUT', headers: { origin, 'content-type': 'application/json' },
    body: wireStringify({ revision: doc.revision, document: mutated }),
  });
  assert.equal(pRes.status, 409);

  // 3. Invalid actor placement & interaction anchor rejected
  const badActor = structuredClone(doc);
  badActor.studio!.production!.nativeScenes![0].studioState.actorOverrides.surveyor = { x: 315, y: 200 };
  const bActorRes = await fetch(`${app.url}api/pixel/projects/${doc.id}`, {
    method: 'PUT', headers: { origin, 'content-type': 'application/json' },
    body: wireStringify({ revision: doc.revision, document: badActor }),
  });
  assert.equal(bActorRes.status, 400);

  const badAnchor = structuredClone(doc);
  badAnchor.studio!.production!.nativeScenes![0].studioState.interactionOverrides['primary-landmark'] = { stand: { x: 315, y: 200 } };
  const bAnchorRes = await fetch(`${app.url}api/pixel/projects/${doc.id}`, {
    method: 'PUT', headers: { origin, 'content-type': 'application/json' },
    body: wireStringify({ revision: doc.revision, document: badAnchor }),
  });
  assert.equal(bAnchorRes.status, 400);

  // 4. Valid Studio override + Save/Reopen + Approve + Export
  const okEdit = structuredClone(doc);
  okEdit.studio!.production!.nativeScenes![0].studioState.revision += 1;
  okEdit.studio!.production!.nativeScenes![0].studioState.actorOverrides.surveyor = { x: 117, y: 174 };
  const sRes = await fetch(`${app.url}api/pixel/projects/${doc.id}`, {
    method: 'PUT', headers: { origin, 'content-type': 'application/json' },
    body: wireStringify({ revision: doc.revision, document: okEdit, snapshot: true }),
  });
  assert.equal(sRes.status, 200);
  doc = wireParse(await sRes.text());

  const reopened = new PixelStore(root).load(doc.id);
  assert.equal(reopened.studio!.production!.nativeScenes![0].studioState.actorOverrides.surveyor.x, 117);

  // UNREVIEWED requireApproved blocked
  const unrevExp = await fetch(`${app.url}api/pixel/projects/${doc.id}/native-scenes/${sceneId}/export`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ revision: doc.revision, requireApproved: true }),
  });
  assert.equal(unrevExp.status, 409);

  // Approve -> Re-import newer Engine revision -> becomes STALE & cannot silently reuse approval
  const rRes = await fetch(`${app.url}api/pixel/projects/${doc.id}/native-scenes/${sceneId}/review`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ revision: doc.revision, status: 'APPROVED', note: 'Approved before source update' }),
  });
  doc = wireParse<{ document: StudioDoc }>(await rRes.text()).document;

  const altSrc = join(root, 'alt-src');
  mkdirSync(altSrc, { recursive: true });
  for (const name of readFileSync(join(E8_INPUT, 'bundle.json'), 'utf8') ? [
    'scene.json', 'atlas.png', 'foreground.png', 'underlay-correction.png',
    'layer-station-shell.png', 'layer-mooring-1.png', 'layer-survey-bench.png', 'layer-courier.png',
    'layer-mooring-2.png', 'layer-surveyor.png', 'layer-supply-barrel.png',
  ] : []) {
    writeFileSync(join(altSrc, name), readFileSync(join(E8_INPUT, 'mistfen-ferry-landing', 'day', name)));
  }
  const sc2 = JSON.parse(readFileSync(join(altSrc, 'scene.json'), 'utf8'));
  sc2.revision = '2222222222222222222222222222222222222222';
  writeFileSync(join(altSrc, 'scene.json'), JSON.stringify(sc2));

  const upRes = await fetch(`${app.url}api/pixel/projects/${doc.id}/native-scenes/import`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ revision: doc.revision, sourceDir: altSrc }),
  });
  assert.equal(upRes.status, 201);
  doc = wireParse<{ document: StudioDoc }>(await upRes.text()).document;
  assert.equal(doc.studio!.production!.nativeScenes![0].studioState.approval.status, 'STALE');

  const staleExp = await fetch(`${app.url}api/pixel/projects/${doc.id}/native-scenes/${sceneId}/export`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ revision: doc.revision, requireApproved: true }),
  });
  assert.equal(staleExp.status, 409);

  // Rollback via store.restore returns clean X=113 state
  const prior = store.history(doc.id).find(h => h.label === 'Trước khi lưu thủ công');
  assert.ok(prior);
  const rolled = store.restore(doc.id, doc.revision, prior.id);
  assert.deepEqual(rolled.studio!.production!.nativeScenes![0].studioState.actorOverrides, {});
});
