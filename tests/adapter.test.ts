import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { serveEngine } from '../src/server/http.ts';
import { supplyChestBrief } from '../src/providers/mock/planner.ts';

const request = {
  version: 1, requestId: 'studio-fixture', assetType: 'prop', brief: supplyChestBrief,
  canvas: { w: 32, h: 32 }, frameDurationsMs: [117], loop: true, alpha: 'binary',
  palette: [0, 0x1c2434ff, 0x536da0ff, 0xf7ba5bff, 0xeaf1f7ff],
  requiredFeatures: ['previews', 'progress'],
};

async function connect(t: TestContext) {
  const engine = await serveEngine(0);
  t.after(engine.close);

  async function api(path: string, body?: unknown, code = 200) {
    const response = await fetch('http://127.0.0.1:' + engine.port + '/v1/' + path, body === undefined ? {} : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
    assert.equal(response.status, code);
    return response.json();
  }

  async function ready(id: string) {
    for (let tries = 0; tries < 60; tries++) {
      const job = await api('jobs/' + id);
      if (job.state === 'ready') return job;
      assert.match(job.state, /^(queued|running)$/);
      await delay(20);
    }
    assert.fail('Job did not finish.');
  }

  return { api, ready, port: engine.port };
}

test('discovers the implemented subset and serves a version-bound RGBA candidate', async t => {
  const { api, ready } = await connect(t);
  const caps = await api('capabilities');
  assert.deepEqual(caps.versions, [1]);
  assert.deepEqual(caps.assetTypes, ['prop']);
  assert.deepEqual(caps.features, ['previews', 'progress', 'masks']);
  const queued = await api('jobs', request, 201);
  assert.equal(queued.state, 'queued');
  const { brief, ...rest } = request;
  assert.equal((await api('jobs', { brief, ...rest }, 201)).id, queued.id);
  await api('jobs', { ...request, brief: 'A wooden supply chest' }, 409);
  const job = await ready(queued.id);
  assert.deepEqual(job.progress, { completed: 2, total: 2 });
  const route = 'jobs/' + job.id + '/results/';
  await api(route + 'other-version', undefined, 404);
  const result = await api(route + job.finalVersionId);
  assert.deepEqual(await api(route + job.finalVersionId), result);
  assert.equal(result.jobId, job.id);
  assert.equal(result.versionId, job.finalVersionId);
  assert.equal(result.version, 1);
  assert.equal(result.loop, true);
  assert.equal(result.w, 32);
  assert.equal(result.h, 32);
  assert.equal(result.frames.length, 1);
  const [frame] = result.frames;
  assert.equal(frame.durationMs, 117);
  const rgba = Buffer.from(frame.rgba, 'base64');
  assert.equal(rgba.toString('base64'), frame.rgba);
  assert.equal(rgba.length, 4096);
  assert.equal(frame.sha256, createHash('sha256').update(rgba).digest('hex'));
  for (let i = 0; i < rgba.length; i += 4) assert.ok(request.palette.includes(rgba.readUInt32BE(i)));
});

test('rejects unsupported inputs and cancellation prevents publication', async t => {
  const { api, port } = await connect(t);
  await api('jobs', { ...request, version: 2 }, 400);
  await api('jobs', { ...request, canvas: { w: 31, h: 32 } }, 400);
  await api('jobs', { ...request, alpha: 'rgba' }, 400);
  await api('jobs', { ...request, requestId: '__proto__' }, 400);
  await api('jobs', { ...request, palette: [0] }, 400);
  await api('jobs', { ...request, requiredFeatures: ['references'] }, 400);
  await api('jobs', { ...request, region: { rgba: 'bad', editable: 'bad' } }, 400);
  await api('jobs', { ...request, brief: 'a sword' }, 400);
  const submit = 'http://127.0.0.1:' + port + '/v1/jobs';
  const oversized = await fetch(submit, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(65537),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await fetch(submit, { method: 'POST', body: 'text' })).status, 415);
  assert.equal((await fetch(submit, { method: 'POST', headers: { origin: 'https://example.com' } })).status, 403);
  const job = await api('jobs', request, 201);
  assert.equal((await api('jobs/' + job.id + '/cancel', {})).state, 'canceled');
  await delay(200);
  assert.equal((await api('jobs/' + job.id)).state, 'canceled');
  await api('jobs/' + job.id + '/results/candidate', undefined, 404);
});

test('updates a selected pixel with locked ink, preserving every other RGBA byte', async t => {
  const { api, ready } = await connect(t);
  const original = Buffer.alloc(4096);
  const editable = Buffer.alloc(1024);
  original.writeUInt32BE(request.palette[4], 0);
  const selected = 16 * 32 + 16;
  editable[selected] = 1;
  const region = { rgba: original.toString('base64'), editable: editable.toString('base64') };
  await api('jobs', { ...request, region: { ...region, editable: Buffer.alloc(1024, 2).toString('base64') } }, 400);
  const job = await api('jobs', { ...request, region }, 201);
  const done = await ready(job.id);
  const result = await api('jobs/' + job.id + '/results/' + done.finalVersionId);
  const out = Buffer.from(result.frames[0].rgba, 'base64');
  const ink = out.readUInt32BE(selected * 4);
  assert.notEqual(ink, 0);
  assert.ok(request.palette.includes(ink));
  original.writeUInt32BE(ink, selected * 4);
  assert.deepEqual(out, original);
});
