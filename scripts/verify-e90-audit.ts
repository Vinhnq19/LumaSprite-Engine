import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { decodePng } from '../src/core/renderer/png.ts';

interface RubricDimension { id: string; name: string; prompt: string }
interface RubricDoc {
  schemaVersion: string;
  policy: {
    allowAutoArtisticPass: boolean;
    technicalPassImpliesArtisticPass: boolean;
    criticalDefectBlocksPass: boolean;
    disallowAveragingAwayCriticalDefects: boolean;
    requireNative1xInspection: boolean;
    authoritativeDecision: string;
  };
  dimensions: RubricDimension[];
  assetFamilies: Record<string, { required: string[]; optional: string[]; notApplicable: string[] }>;
  criticalDefects: Array<{ code: string; description: string }>;
}

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

// 1. Verify E8.5 closeout invariants & manifest counts (55 embedded vs 56 SHA256SUMS lines)
const e85Ver = readJson<{ status: string; studioZipsImported: number; manualKeyboard: { status: string }; ownerStudioZip: { sha256: string; bytes: number; diffPixelsVsX113: number }; tests: Array<{ mode: string; passed: number; total: number }> }>('benchmarks/results/e85/verification.json');
const e85Review = readJson<{ approvalStatus: string; reviewer: string; reviewedAt: string; decision: string }>('benchmarks/results/e85/human-review.json');
const e85Portable = readJson<{ sha256: string; bytes: number; images: number; offline: boolean; consoleErrors: number }>('benchmarks/results/e85/portable-verification.json');
const e85Sums = readFileSync('benchmarks/results/e85/SHA256SUMS', 'utf8').trim().split(/\r?\n/);
const e85Html = readFileSync('docs/reports/E8.5-END-TO-END-PRODUCTION-ACCEPTANCE.html', 'utf8');

assert.equal(e85Ver.status, 'E8_5_READY_FOR_OWNER_END_TO_END_ACCEPTANCE');
assert.equal(e85Ver.manualKeyboard.status, 'NOT_RUN');
assert.equal(e85Ver.ownerStudioZip.sha256, 'b7606778e555e2f048356c1dbb6c89be7bbc9315683e7c0e88d99c6c4d779754');
assert.equal(e85Ver.ownerStudioZip.bytes, 163438);
assert.equal(e85Ver.ownerStudioZip.diffPixelsVsX113, 1189);
assert.equal(e85Ver.studioZipsImported, 9);
assert.equal(e85Review.approvalStatus, 'PENDING_OWNER_END_TO_END_ACCEPTANCE');
assert.equal(e85Review.reviewer, '');
assert.equal(e85Review.decision, '');
assert.equal(sha256(readFileSync('docs/reports/E8.5-END-TO-END-PRODUCTION-ACCEPTANCE.html')), e85Portable.sha256);
assert.ok(e85Html.includes('SHA-256 verification manifest (55 tệp)'));
assert.equal(e85Sums.length, 56);
assert.ok(e85Sums.some(line => line.endsWith('  portable-verification.json')));
for (const row of e85Sums) {
  const [hash, file] = row.split('  ');
  assert.equal(sha256(readFileSync('benchmarks/results/e85/' + file)), hash, 'e85/' + file);
}

// 2. Verify 805 historical catalog SHA-256 + e76r/e8/e83 untouched
const evidenceMeta = readJson<{ catalogs: Record<string, number> }>('docs/e53-evidence.json');
let catalogCount = 0;
for (const [catalog, expectedCount] of Object.entries(evidenceMeta.catalogs)) {
  const rows = readFileSync('docs/' + catalog, 'utf8').trim().split(/\r?\n/);
  assert.equal(rows.length, expectedCount);
  for (const row of rows) {
    const [hash, file] = row.split('  ');
    assert.equal(sha256(readFileSync(file)), hash, file);
    catalogCount++;
  }
}
assert.equal(catalogCount, 805);
for (const sumPath of ['benchmarks/results/e76r/SHA256SUMS', 'benchmarks/results/e8/SHA256SUMS', 'benchmarks/results/e83/SHA256SUMS']) {
  const baseDir = dirname(sumPath) + '/';
  for (const row of readFileSync(sumPath, 'utf8').trim().split(/\r?\n/)) {
    const [hash, file] = row.split('  ');
    assert.equal(sha256(readFileSync(baseDir + file)), hash, baseDir + file);
  }
}

// 3. Validate Art Quality Rubric v2
const rubric = readJson<RubricDoc>('docs/art-quality/art-quality-rubric-v2.json');
assert.equal(rubric.schemaVersion, 'lumasprite.art-quality-rubric.v2');
assert.equal(rubric.policy.allowAutoArtisticPass, false);
assert.equal(rubric.policy.technicalPassImpliesArtisticPass, false);
assert.equal(rubric.policy.criticalDefectBlocksPass, true);
assert.equal(rubric.policy.disallowAveragingAwayCriticalDefects, true);
assert.equal(rubric.policy.requireNative1xInspection, true);
assert.equal(rubric.dimensions.length, 12);
const dimIds = new Set(rubric.dimensions.map(d => d.id));
for (const family of ['character', 'animation', 'prop', 'terrain', 'environment', 'ui', 'vfx']) {
  const spec = rubric.assetFamilies[family];
  assert.ok(spec && spec.required.length >= 6, 'Missing rubric family ' + family);
  for (const id of [...spec.required, ...spec.optional, ...spec.notApplicable]) {
    assert.ok(dimIds.has(id), 'Unknown dimension ' + id);
  }
}
assert.ok(rubric.criticalDefects.length >= 8);

// 4. Verify real PNG evidence inventory for E9.0 (zero synthetic/mock evidence)
const evidencePngSpecs = [
  { id: 'char-surveyor-lineup-1x', family: 'character', scale: '1x', file: 'benchmarks/results/e44/lineup-1x.png', label: 'Character Lineup R1/R2/B1 (1x)' },
  { id: 'char-surveyor-b1-4x', family: 'character', scale: '4x', file: 'benchmarks/results/e44/b1-4x.png', label: 'Surveyor B1 (4x)' },
  { id: 'char-courier-rev-4x', family: 'character', scale: '4x', file: 'benchmarks/results/e44/courier-rev-4x.png', label: 'Courier Revised Hood/Satchel (4x)' },
  { id: 'char-ridge-a0-1x', family: 'character', scale: '1x', file: 'benchmarks/results/e75/ridge-mechanic/a0/day.png', label: 'Ridge Mechanic A0 Control (1x)' },
  { id: 'char-ridge-refined-1x', family: 'character', scale: '1x', file: 'benchmarks/results/e75r/ridge-mechanic/refined/day.png', label: 'Ridge Mechanic E7.5R Refined (1x)' },
  { id: 'char-ridge-refined-4x', family: 'character', scale: '4x', file: 'benchmarks/results/e75r/ridge-mechanic/refined/material-4x.png', label: 'Ridge Mechanic E7.5R Material (4x)' },
  { id: 'char-marsh-a0-1x', family: 'character', scale: '1x', file: 'benchmarks/results/e75/marsh-harvester/a0/day.png', label: 'Marsh Harvester A0 Control (1x)' },
  { id: 'char-marsh-refined-1x', family: 'character', scale: '1x', file: 'benchmarks/results/e75r/marsh-harvester/refined/day.png', label: 'Marsh Harvester E7.5R Refined (1x)' },
  { id: 'char-marsh-refined-4x', family: 'character', scale: '4x', file: 'benchmarks/results/e75r/marsh-harvester/refined/material-4x.png', label: 'Marsh Harvester E7.5R Material (4x)' },
  { id: 'char-porter-refined-1x', family: 'character', scale: '1x', file: 'benchmarks/results/e75r/canal-porter/refined/day.png', label: 'Canal Porter E7.5R Refined (1x)' },
  { id: 'char-porter-refined-4x', family: 'character', scale: '4x', file: 'benchmarks/results/e75r/canal-porter/refined/material-4x.png', label: 'Canal Porter E7.5R Material (4x)' },
  { id: 'anim-surveyor-walk-1x', family: 'animation', scale: '1x', file: 'benchmarks/results/e54/packages/surveyor/walk/spritesheet.png', label: 'Surveyor W2 Walk Strip 8 Frames (1x)' },
  { id: 'anim-courier-walk-1x', family: 'animation', scale: '1x', file: 'benchmarks/results/e54/packages/courier/walk/spritesheet.png', label: 'Courier Walk Strip 8 Frames (1x)' },
  { id: 'anim-unity-00-1x', family: 'animation', scale: '1x', file: 'benchmarks/results/e85/animation-00.png', label: 'Unity Player Animation Frame 00 (320x208)' },
  { id: 'anim-unity-04-1x', family: 'animation', scale: '1x', file: 'benchmarks/results/e85/animation-04.png', label: 'Unity Player Animation Frame 04 (320x208)' },
  { id: 'prop-barrel-1x', family: 'prop', scale: '1x', file: 'benchmarks/results/e24/barrel-tall-1x.png', label: 'Locked Baseline Barrel Tall (1x)' },
  { id: 'prop-barrel-4x', family: 'prop', scale: '4x', file: 'benchmarks/results/e24/barrel-tall-4x.png', label: 'Locked Baseline Barrel Tall (4x)' },
  { id: 'prop-rain-1x', family: 'prop', scale: '1x', file: 'benchmarks/results/e74r/field-rain-gauge/day.png', label: 'Field Rain Gauge E7.4R (1x)' },
  { id: 'prop-rain-4x', family: 'prop', scale: '4x', file: 'benchmarks/results/e74r/field-rain-gauge/material-4x.png', label: 'Field Rain Gauge E7.4R (4x)' },
  { id: 'prop-beacon-1x', family: 'prop', scale: '1x', file: 'benchmarks/results/e74r/harbor-signal-beacon/day.png', label: 'Harbor Signal Beacon E7.4R (1x)' },
  { id: 'prop-beacon-4x', family: 'prop', scale: '4x', file: 'benchmarks/results/e74r/harbor-signal-beacon/material-4x.png', label: 'Harbor Signal Beacon E7.4R Day (4x)' },
  { id: 'prop-beacon-night-4x', family: 'prop', scale: '4x', file: 'benchmarks/results/e74r/harbor-signal-beacon/night-4x.png', label: 'Harbor Signal Beacon E7.4R Night (4x)' },
  { id: 'prop-vane-1x', family: 'prop', scale: '1x', file: 'benchmarks/results/e74r/cliffside-wind-vane/day.png', label: 'Cliffside Wind Vane E7.4R (1x)' },
  { id: 'prop-vane-4x', family: 'prop', scale: '4x', file: 'benchmarks/results/e74r/cliffside-wind-vane/material-4x.png', label: 'Cliffside Wind Vane E7.4R (4x)' },
  { id: 'env-mistfen-unity-1x', family: 'environment', scale: '1x', file: 'benchmarks/results/e85/mistfen-ferry-landing-day-e84-spawn.png', label: 'Mistfen Day Owner E8.4 ZIP in Unity Player (320x208)' },
  { id: 'env-mistfen-b2-4x', family: 'environment', scale: '4x', file: 'benchmarks/results/e76r/mistfen-ferry-landing/b2/day-4x.png', label: 'Mistfen B2 Context (4x)' },
  { id: 'env-floodgate-unity-1x', family: 'environment', scale: '1x', file: 'benchmarks/results/e85/floodgate-maintenance-yard-day-spawn.png', label: 'Floodgate Day in Unity Player (320x208)' },
  { id: 'env-canal-unity-1x', family: 'environment', scale: '1x', file: 'benchmarks/results/e85/canal-intake-service-platform-day-spawn.png', label: 'Canal Intake Day Locked 19/35 in Unity Player (320x208)' },
  { id: 'env-canal-staging-1x', family: 'environment', scale: '1x', file: 'benchmarks/results/e85/canal-intake-service-platform-day-staging.png', label: 'Canal Intake Studio Staging 140/140 in Unity Player (320x208)' },
  { id: 'env-gameplay-e44-1x', family: 'character', scale: '1x', file: 'benchmarks/results/e44/gameplay-r2-1x.png', label: 'Surveyor R2 Gameplay Context E4.4 (1x)' },
];

const evidencePngs = evidencePngSpecs.map(spec => {
  assert.ok(existsSync(spec.file), 'Missing evidence PNG: ' + spec.file);
  const bytes = readFileSync(spec.file);
  const png = decodePng(bytes);
  return { ...spec, w: png.w, h: png.h, bytes: bytes.length, sha256: sha256(bytes) };
});

// 5. Emit benchmarks/results/e90/{audit-evidence.json, human-review.json, SHA256SUMS}
const outDir = 'benchmarks/results/e90/';
mkdirSync(outDir, { recursive: true });
const hashes: Record<string, string> = {};
const emit = (name: string, obj: unknown) => {
  const content = JSON.stringify(obj, null, 2) + '\n';
  writeFileSync(outDir + name, content);
  hashes[name] = sha256(Buffer.from(content));
};

const blankHumanReview = {
  schemaVersion: 'lumasprite.e90.human-review.v1',
  milestone: 'E9.0 Game-Ready Pixel Art Quality Audit & E9.1 Design Gate',
  e85OwnerReviewStatus: 'E8_5_OWNER_REVIEW_PENDING',
  e90Status: 'E9_0_READY_FOR_OWNER_ART_DIRECTION_REVIEW',
  reviewer: '',
  reviewedAt: '',
  e85ManualDecision: '',
  e90ArchitectureDecision: '',
  authorizeE91CharacterPilot: '',
  preferredE91Approach: '',
  checklist: {
    e85PhysicalKeyboardAndEndToEnd: '',
    e90RootCauseAuditAccepted: '',
    artQualityRubricV2Approved: '',
    referenceLibraryPolicyApproved: '',
    e91HarborLockkeeperBriefApproved: '',
    e91MarshApothecaryHoldoutApproved: '',
  },
  notes: '',
};

const auditEvidence = {
  schemaVersion: 'lumasprite.e90.audit-evidence.v1',
  milestone: 'E9.0',
  status: 'E9_0_READY_FOR_OWNER_ART_DIRECTION_REVIEW',
  e85Closeout: {
    gateStatus: 'E8_5_OWNER_REVIEW_PENDING',
    engineBranch: 'codex/e8-5-end-to-end-integration',
    engineSourceCommit: 'b2540a1e69238d1273033b28801ca97c6081f164',
    engineHeadCommit: '2933cf4675f69f8bac9d01b1be60cd07854f3896',
    studioBranch: 'antigravity/e8-4-native-scene-adapter',
    studioHeadCommit: '471ac90555d3545beff5182146e291ba97b9ae20',
    manualKeyboard: e85Ver.manualKeyboard.status,
    ownerZipSha256: e85Ver.ownerStudioZip.sha256,
    ownerZipBytes: e85Ver.ownerStudioZip.bytes,
    studioZipsImported: e85Ver.studioZipsImported,
    unityTests: e85Ver.tests,
    manifestCountExplanation: {
      htmlEmbeddedEntries: 55,
      diskSha256SumsEntries: e85Sums.length,
      extraEntry: 'portable-verification.json (records HTML SHA-256 post-generation; appended to SHA256SUMS after HTML emit)',
    },
  },
  historicalIntegrity: {
    catalogHashesVerified: catalogCount,
    e76rE8E83E85Verified: true,
    productionDefaultsChanged: false,
    studioModified: false,
  },
  rubricV2: {
    file: 'docs/art-quality/art-quality-rubric-v2.json',
    sha256: sha256(readFileSync('docs/art-quality/art-quality-rubric-v2.json')),
    dimensionCount: rubric.dimensions.length,
    criticalDefectCount: rubric.criticalDefects.length,
    allowAutoArtisticPass: rubric.policy.allowAutoArtisticPass,
  },
  auditDocSha256: sha256(readFileSync('docs/reports/e90-art-quality-audit.md')),
  evidencePngCount: evidencePngs.length,
  evidencePngs,
};

emit('human-review.json', blankHumanReview);
emit('audit-evidence.json', auditEvidence);
writeFileSync(
  outDir + 'SHA256SUMS',
  Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)).map(([n, h]) => `${h}  ${n}`).join('\n') + '\n',
);

console.log(`E9.0 audit PASS: ${catalogCount} historical SHAs + E8.5 (${e85Sums.length} files) + Rubric v2 (12 dims) + ${evidencePngs.length} real PNGs`);
