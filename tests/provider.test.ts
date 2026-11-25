import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { readDeepSeekConfig } from '../src/providers/deepseek/config.ts';
import { createDeepSeekScaffold } from '../src/providers/deepseek/scaffold.ts';
import { mockPlanner, supplyChestBrief } from '../src/providers/mock/planner.ts';

const input = { brief: supplyChestBrief, seed: 42 };
const spec = await mockPlanner.plan(input);
const config = {
  ...readDeepSeekConfig({}),
  budgetUsd: 1, inputHitUsdPerMillion: 1, inputMissUsdPerMillion: 2, outputUsdPerMillion: 4,
};
const reply = {
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(spec) } }],
  usage: { prompt_tokens: 1000, prompt_cache_hit_tokens: 250, prompt_cache_miss_tokens: 750, completion_tokens: 100 },
};

test('default provider never dispatches inference and rejects legacy model names', async () => {
  assert.equal(config.enabled, false);
  assert.equal(config.maxRealCalls, 0);
  assert.equal(config.model, 'deepseek-flash');
  assert.throws(() => readDeepSeekConfig({ DEEPSEEK_MODEL: 'deepseek-chat' }));
  await assert.rejects(createDeepSeekScaffold(config).plan(input), /disabled/);
});

test('simulated JSON response records cached, uncached and output tokens without exposing key or content', async () => {
  const usage: unknown[] = [];
  const provider = createDeepSeekScaffold(config, async request => {
    assert.equal(request.model, config.model);
    assert.deepEqual(request.response_format, { type: 'json_object' });
    return reply;
  }, entry => usage.push(entry));
  assert.deepEqual(await provider.plan(input), spec);
  assert.deepEqual(usage, [{ model: config.model, inputHit: 250, inputMiss: 750, output: 100, estimatedUsd: 0.00215 }]);
  await assert.rejects(provider.plan({ ...input, seed: 43 }), /seed/);
  await assert.rejects(provider.plan({ ...input, palette: ['#ffffff'] }), /locked palette/);
});

test('simulated calls handle usage, malformed JSON, timeout, budget and failed transport without retry', async () => {
  let calls = 0;
  const overBudget = createDeepSeekScaffold({ ...config, budgetUsd: 0.001 }, async () => {
    calls++;
    return reply;
  });
  await assert.rejects(overBudget.plan(input), /budget exceeded/);
  await assert.rejects(overBudget.plan(input), /budget exhausted/);
  assert.equal(calls, 1);
  const malformed = createDeepSeekScaffold(config, async () => ({
    ...reply, choices: [{ finish_reason: 'stop', message: { content: '{' } }],
  }));
  await assert.rejects(malformed.plan(input), SyntaxError);
  const invalidSpec = createDeepSeekScaffold(config, async () => ({
    ...reply, choices: [{ finish_reason: 'stop', message: { content: '{}' } }],
  }));
  await assert.rejects(invalidSpec.plan(input), /version/);
  const invalidUsage = createDeepSeekScaffold(config, async () => ({
    ...reply, usage: { ...reply.usage, prompt_cache_miss_tokens: 0 },
  }));
  await assert.rejects(invalidUsage.plan(input), /token counts disagree/);
  const timeout = createDeepSeekScaffold({ ...config, timeoutMs: 5 }, async () => {
    await delay(30);
    return reply;
  });
  await assert.rejects(timeout.plan(input), { name: 'TimeoutError' });
  await assert.rejects(createDeepSeekScaffold(config, async () => { throw new Error('Fixture offline.'); }).plan(input), /offline/);
});
