import { z } from 'zod';

const configSchema = z.strictObject({
  model: z.enum(['deepseek-flash', 'deepseek-v4-pro']),
  timeoutMs: z.coerce.number().int().min(1).max(120000),
  budgetUsd: z.coerce.number().finite().min(0),
  inputHitUsdPerMillion: z.coerce.number().finite().min(0),
  inputMissUsdPerMillion: z.coerce.number().finite().min(0),
  outputUsdPerMillion: z.coerce.number().finite().min(0),
});

export function readDeepSeekConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    ...configSchema.parse({
      model: env.DEEPSEEK_MODEL ?? 'deepseek-flash',
      timeoutMs: env.DEEPSEEK_TIMEOUT_MS ?? '10000',
      budgetUsd: env.DEEPSEEK_BUDGET_USD ?? '0',
      inputHitUsdPerMillion: env.DEEPSEEK_INPUT_HIT_USD_PER_MILLION ?? '0',
      inputMissUsdPerMillion: env.DEEPSEEK_INPUT_MISS_USD_PER_MILLION ?? '0',
      outputUsdPerMillion: env.DEEPSEEK_OUTPUT_USD_PER_MILLION ?? '0',
    }),
    baseUrl: 'https://api.deepseek.com',
    apiKeyConfigured: Boolean(env.DEEPSEEK_API_KEY?.trim()),
    enabled: false,
    maxRealCalls: 0,
  } as const;
}

export type DeepSeekConfig = ReturnType<typeof readDeepSeekConfig>;
