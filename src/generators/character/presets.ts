import type { CharacterSpec } from '../../specs/character.ts';

const shared = {
  version: 1, kind: 'humanoid-surveyor',
  canvas: { w: 64, h: 64, background: 'transparent' },
  view: 'three-quarter-right', seed: 42, palette: { mode: 'authored' },
} as const;

export const surveyors = {
  a: {
    ...shared,
    name: 'Compact Explorer',
    proportions: { head: [17, 15], jacket: [17, 13], hips: 15, arm: [7, 5], leg: [8, 6], boot: [11, 4], satchel: [11, 13], lantern: [7, 8] },
    pose: {
      kind: 'standing-hold', hip: [29, 37], lean: 0, pivot: [28, 56], support: 'near',
      near: { elbow: [24, 33], wrist: [41, 32], palm: [44, 31], knee: [23, 45], ankle: [23, 51] },
      far: { elbow: [37, 30], wrist: [36, 34], palm: [35, 36], knee: [36, 43], ankle: [37, 49] },
    },
  },
  b: {
    ...shared,
    name: 'Taller Surveyor',
    proportions: { head: [14, 14], jacket: [15, 18], hips: 13, arm: [6, 4], leg: [7, 5], boot: [10, 4], satchel: [9, 14], lantern: [7, 10] },
    pose: {
      kind: 'standing-hold', hip: [31, 37], lean: -1, pivot: [30, 60], support: 'near',
      near: { elbow: [29, 28], wrist: [45, 25], palm: [48, 24], knee: [26, 46], ankle: [26, 55] },
      far: { elbow: [39, 25], wrist: [38, 33], palm: [37, 35], knee: [39, 43], ankle: [41, 50] },
    },
  },
} satisfies Record<string, CharacterSpec>;
