import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { StudioInput, StudioResult } from '../adapters/studio/contract.ts';
import { renderAsset } from '../generators/props/supply-chest.ts';
import { makePropSpec } from '../generators/props/presets.ts';
import { sha256, validateRaster } from '../quality/raster.ts';

type State = 'queued' | 'running' | 'ready' | 'failed' | 'canceled';

interface Job {
  id: string;
  requestId: string;
  digest: string;
  state: State;
  completed: number;
  stop: AbortController;
  expires: number;
  result?: StudioResult;
}

function status(job: Job) {
  return {
    id: job.id,
    state: job.state,
    progress: { completed: job.completed, total: 2 },
    ...(job.state === 'ready' && { finalVersionId: job.result!.versionId }),
    ...(job.state === 'failed' && { message: 'The local generator could not produce a valid candidate.' }),
  };
}

export class JobError extends Error {
  status: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.status = statusCode;
  }
}

export class JobManager {
  private jobs = new Map<string, Job>();
  private receipts = new Map<string, Job>();

  submit(input: StudioInput) {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (job.expires > now) continue;
      this.jobs.delete(id);
      this.receipts.delete(job.requestId);
    }

    const { request } = input;
    // Hash parser-normalized input, so JSON key order does not affect replay.
    const digest = sha256(JSON.stringify(request));
    const previous = this.receipts.get(request.requestId);
    if (previous) {
      if (previous.digest !== digest) throw new JobError(409, 'Request ID already belongs to another request.');
      return status(previous);
    }
    if (this.jobs.size >= 256) throw new JobError(503, 'Job capacity reached. Try again when a receipt expires.');

    const job: Job = {
      id: randomUUID(), requestId: request.requestId, digest, state: 'queued',
      completed: 0, stop: new AbortController(), expires: now + 15 * 60_000,
    };
    this.jobs.set(job.id, job);
    this.receipts.set(job.requestId, job);
    void this.run(job, input);
    return status(job);
  }

  private async run(job: Job, { request, palette, protection }: StudioInput) {
    const signal = job.stop.signal;
    try {
      // Yield between real phases so loopback clients can cancel or poll.
      await delay(75, undefined, { signal });
      signal.throwIfAborted();
      job.state = 'running';
      const seed = Number.parseInt(sha256(request.brief).slice(0, 8), 16);
      const design = /\btravel\b/i.test(request.brief) ? 'travel' : /\bcompact\b/i.test(request.brief) ? 'compact' : 'domed';
      const spec = makePropSpec(design, seed, palette);
      job.completed = 1;
      await delay(75, undefined, { signal });
      signal.throwIfAborted();

      const asset = renderAsset(spec);
      const { final } = asset;
      if ('paletteDiagnostics' in asset && asset.paletteDiagnostics.codes.length) {
        console.warn('Palette for job %s: %s', job.id, asset.paletteDiagnostics.codes.join(', '));
      }
      if (protection) {
        for (let i = 0; i < protection.editable.length; i++) {
          const offset = i * 4;
          // An opaque chest pixel paints the selection. Transparent pixels leave the source intact.
          if (protection.editable[i] === 0 || final.rgba[offset + 3] === 0) {
            final.rgba.writeUInt32BE(protection.rgba.readUInt32BE(offset), offset);
          }
        }
      }
      const frame = { durationMs: request.frameDurationsMs[0], loop: request.loop };
      const errors = validateRaster(final, spec, frame, protection);
      if (errors.length) throw new Error(errors.join(', '));
      const digest = sha256(final.rgba);
      job.result = {
        version: 1, jobId: job.id, versionId: 'candidate-' + digest.slice(0, 16),
        name: spec.name, w: final.w, h: final.h, loop: frame.loop,
        frames: [{ durationMs: frame.durationMs, rgba: final.rgba.toString('base64'), sha256: digest }],
      };
      job.completed = 2;
      job.state = 'ready';
    } catch {
      if (!signal.aborted) job.state = 'failed';
    }
  }

  private get(id: string): Job {
    const job = this.jobs.get(id);
    if (!job || job.expires <= Date.now()) throw new JobError(404, 'Unknown job.');
    return job;
  }

  status(id: string) {
    return status(this.get(id));
  }

  cancel(id: string) {
    const job = this.get(id);
    if (job.state === 'queued' || job.state === 'running') {
      job.state = 'canceled';
      job.stop.abort();
    }
    return status(job);
  }

  result(id: string, version: string) {
    const job = this.get(id);
    if (job.state !== 'ready' || job.result?.versionId !== version) throw new JobError(404, 'Candidate unavailable.');
    return job.result;
  }

  close() {
    for (const job of this.jobs.values()) job.stop.abort();
  }
}
