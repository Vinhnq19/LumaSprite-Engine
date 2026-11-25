import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ZodError } from 'zod';
import { capabilities, parseStudioRequest } from '../adapters/studio/contract.ts';
import { JobError, JobManager } from '../jobs/manager.ts';

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new JobError(415, 'Expected application/json.');
  }
  const max = 64 * 1024;
  if (Number(req.headers['content-length']) > max) throw new JobError(413, 'Payload too large.');
  const chunks: Buffer[] = [];
  let size = 0;
  // Let the response complete before closing an oversized upload.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > max) throw new JobError(413, 'Payload too large.');
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
}

function json(res: ServerResponse, value: unknown, code = 200) {
  const body = JSON.stringify(value);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export async function serveEngine(port: number) {
  const jobs = new JobManager();
  const server = createServer({ requestTimeout: 5000, headersTimeout: 5000 }, async (req, res) => {
    try {
      // Loopback services should reject foreign hosts and browser-initiated calls.
      const address = server.address() as AddressInfo;
      if (req.headers.host !== '127.0.0.1:' + address.port || req.headers.origin) {
        throw new JobError(403, 'Only same-machine API clients are supported.');
      }
      if (req.method === 'GET' && req.url === '/v1/capabilities') return json(res, capabilities);
      if (req.method === 'POST' && req.url === '/v1/jobs') {
        return json(res, jobs.submit(parseStudioRequest(await readJson(req))), 201);
      }

      const route = /^\/v1\/jobs\/([A-Za-z0-9_-]{1,80})(?:\/(cancel|results\/([A-Za-z0-9_-]{1,80})))?$/.exec(req.url ?? '');
      if (route) {
        const [, id, action, version] = route;
        if (req.method === 'GET' && !action) return json(res, jobs.status(id));
        if (req.method === 'POST' && action === 'cancel') {
          req.resume();
          return json(res, jobs.cancel(id));
        }
        if (req.method === 'GET' && version) return json(res, jobs.result(id, version));
      }
      throw new JobError(404, 'Unknown API route.');
    } catch (error) {
      if (req.aborted || res.destroyed) return;
      if (error instanceof JobError) {
        if (!req.complete) res.setHeader('Connection', 'close');
        return json(res, { message: error.message }, error.status);
      }
      if (error instanceof ZodError) {
        return json(res, { message: error.issues.map(issue => issue.path.join('.') + ': ' + issue.message).join('; ') }, 400);
      }
      if (error instanceof SyntaxError || error instanceof TypeError) {
        return json(res, { message: 'Malformed JSON request.' }, 400);
      }
      json(res, { message: error instanceof Error ? error.message : 'Invalid request.' }, 400);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise<void>((resolve, reject) => {
      jobs.close();
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}
