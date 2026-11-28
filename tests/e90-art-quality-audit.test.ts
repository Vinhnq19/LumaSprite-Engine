import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

test('E9.0 Art Quality Rubric v2 & E8.5 Closeout Integrity: 12 dimensions, independent critical defects, blank Owner gates', () => {
  const rubric = JSON.parse(readFileSync('docs/art-quality/art-quality-rubric-v2.json', 'utf8')) as {
    schemaVersion: string;
    policy: {
      allowAutoArtisticPass: boolean;
      technicalPassImpliesArtisticPass: boolean;
      criticalDefectBlocksPass: boolean;
      disallowAveragingAwayCriticalDefects: boolean;
      authoritativeDecision: string;
    };
    dimensions: Array<{ id: string }>;
    assetFamilies: Record<string, { required: string[]; optional: string[]; notApplicable: string[] }>;
    criticalDefects: Array<{ code: string }>;
  };

  assert.equal(rubric.schemaVersion, 'lumasprite.art-quality-rubric.v2');
  assert.equal(rubric.policy.allowAutoArtisticPass, false);
  assert.equal(rubric.policy.technicalPassImpliesArtisticPass, false);
  assert.equal(rubric.policy.criticalDefectBlocksPass, true);
  assert.equal(rubric.policy.disallowAveragingAwayCriticalDefects, true);
  assert.equal(rubric.policy.authoritativeDecision, 'PROJECT_OWNER_HUMAN_REVIEW_ONLY');

  const expectedDims = [
    'silhouette', 'proportions', 'anatomy', 'functionalIdentity',
    'pixelClusters', 'materials', 'colorHarmony', 'pose',
    'animation', 'contextReadability', 'styleConsistency', 'assetProductionReadiness',
  ];
  assert.deepEqual(rubric.dimensions.map(d => d.id), expectedDims);
  for (const fam of ['character', 'animation', 'prop', 'terrain', 'environment', 'ui', 'vfx']) {
    const entry = rubric.assetFamilies[fam];
    assert.ok(entry);
    assert.equal(
      new Set([...entry.required, ...entry.optional, ...entry.notApplicable]).size,
      entry.required.length + entry.optional.length + entry.notApplicable.length,
    );
  }
  assert.ok(rubric.criticalDefects.some(d => d.code === 'TEMPLATE_CLONE_IDENTITY'));
  assert.ok(rubric.criticalDefects.some(d => d.code === 'DIRECTIONAL_FACING_LOCK'));

  // Verify E8.5 human review remains unsigned / E8_5_OWNER_REVIEW_PENDING
  const e85Review = JSON.parse(readFileSync('benchmarks/results/e85/human-review.json', 'utf8')) as {
    approvalStatus: string; reviewer: string; decision: string;
  };
  assert.equal(e85Review.approvalStatus, 'PENDING_OWNER_END_TO_END_ACCEPTANCE');
  assert.equal(e85Review.reviewer, '');
  assert.equal(e85Review.decision, '');

  // Verify 55 embedded vs 56 SHA256SUMS manifest integrity without modifying E8.5 files
  const sums = readFileSync('benchmarks/results/e85/SHA256SUMS', 'utf8').trim().split(/\r?\n/);
  assert.equal(sums.length, 56);
  const portableRow = sums.find(r => r.endsWith('  portable-verification.json'));
  assert.ok(portableRow);
  const [portableHash] = portableRow.split('  ');
  assert.equal(sha256(readFileSync('benchmarks/results/e85/portable-verification.json')), portableHash);
});
