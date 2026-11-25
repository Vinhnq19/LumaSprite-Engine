import { z } from 'zod';
import { parseAssetSpec } from '../../specs/asset.ts';
import type { AssetPlanner } from '../planner.ts';
import type { DeepSeekConfig } from './config.ts';

const counter = z.number().int().min(0).max(1_000_000);
const responseSchema = z.object({
  choices: z.tuple([z.object({ finish_reason: z.literal('stop'), message: z.object({ content: z.string().max(65536) }) })]),
  usage: z.object({
    prompt_tokens: counter,
    prompt_cache_hit_tokens: counter.optional(),
    prompt_cache_miss_tokens: counter.optional(),
    completion_tokens: counter,
  }).refine(usage => (usage.prompt_cache_hit_tokens ?? 0) <= usage.prompt_tokens &&
    (usage.prompt_cache_miss_tokens === undefined ||
      (usage.prompt_cache_hit_tokens ?? 0) + usage.prompt_cache_miss_tokens === usage.prompt_tokens),
  'Prompt token counts disagree.'),
});

interface Usage {
  model: DeepSeekConfig['model'];
  inputHit: number;
  inputMiss: number;
  output: number;
  estimatedUsd: number;
}

type MockReply = (input: { model: DeepSeekConfig['model']; response_format: { type: 'json_object' }; signal: AbortSignal }) => Promise<unknown>;

/** Exercises the response and accounting boundary using only an injected test fixture. */
export function createDeepSeekScaffold(config: DeepSeekConfig, fixture?: MockReply, log: (usage: Usage) => void = () => {}): AssetPlanner {
  let spent = 0;
  let pending = false;
  return {
    async plan(input) {
      if (!fixture) throw new Error('DeepSeek networking is disabled for bootstrap.');
      if (pending) throw new Error('A simulated DeepSeek request is already pending.');
      if (spent >= config.budgetUsd) throw new Error('Simulated DeepSeek budget exhausted.');
      const signal = AbortSignal.timeout(config.timeoutMs);
      const timeout = () => rejectTimeout(signal.reason);
      let rejectTimeout: (error: unknown) => void = () => {};
      const deadline = new Promise<never>((_, reject) => { rejectTimeout = reject; });
      pending = true;
      signal.addEventListener('abort', timeout, { once: true });

      try {
        const raw = await Promise.race([fixture({ model: config.model, response_format: { type: 'json_object' }, signal }), deadline]);
        // Account for any reply carrying usage, including malformed or truncated content.
        const usage = responseSchema.shape.usage.parse(typeof raw === 'object' && raw !== null && 'usage' in raw ? raw.usage : undefined);
        const inputHit = usage.prompt_cache_hit_tokens ?? 0;
        const inputMiss = usage.prompt_tokens - inputHit;
        const output = usage.completion_tokens;
        const estimatedUsd = (inputHit * config.inputHitUsdPerMillion + inputMiss * config.inputMissUsdPerMillion +
          output * config.outputUsdPerMillion) / 1_000_000;
        spent += estimatedUsd;
        log({ model: config.model, inputHit, inputMiss, output, estimatedUsd });
        if (spent > config.budgetUsd) throw new Error('Simulated DeepSeek budget exceeded.');

        const response = responseSchema.parse(raw);
        const spec = parseAssetSpec(JSON.parse(response.choices[0].message.content));
        if (spec.seed !== input.seed) throw new Error('DeepSeek changed the requested seed.');
        if (input.palette && (spec.palette.length !== input.palette.length ||
            spec.palette.some((color, i) => color !== input.palette?.[i].toLowerCase()))) {
          throw new Error('DeepSeek changed the locked palette.');
        }
        return spec;
      } finally {
        signal.removeEventListener('abort', timeout);
        pending = false;
      }
    },
  };
}
