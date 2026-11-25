import { parseArgs } from 'node:util';
import { serveEngine } from './http.ts';

try {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '4399' } } });
  const port = Number(values.port);
  if (!/^\d+$/.test(values.port) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('--port must be an integer from 1 to 65535.');
  }
  const server = await serveEngine(port);
  console.log('LumaSprite Engine listening at http://127.0.0.1:' + server.port);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void server.close());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
