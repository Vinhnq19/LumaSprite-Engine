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

const surveyorV2 = {
  ...shared,
  version: 2,
  proportions: { ...surveyors.b.proportions, jacket: [16, 16], satchel: [7, 10] },
} satisfies Omit<Extract<CharacterSpec, { version: 2 }>, 'name' | 'pose'>;

export const surveyorRefinements = {
  b1: {
    ...surveyorV2,
    name: 'Grounded Surveyor',
    pose: {
      kind: 'standing-hold', hip: [31, 37], lean: 0, turn: 2, pivot: [30, 59], support: 'near', secondaryGroundOffset: -1,
      near: { elbow: [32, 34], wrist: [45, 32], palm: [48, 32], knee: [29, 45], ankle: [27, 54] },
      far: { elbow: [38, 26], wrist: [37, 34], palm: [36, 36], knee: [40, 45], ankle: [39, 53] },
    },
  },
  b2: {
    ...surveyorV2,
    name: 'Forward-Step Surveyor',
    pose: {
      kind: 'forward-step-hold', hip: [34, 37], lean: 2, turn: 2, pivot: [29, 59], support: 'near', secondaryGroundOffset: -1,
      near: { elbow: [35, 32], wrist: [47, 26], palm: [50, 25], knee: [28, 46], ankle: [26, 54] },
      far: { elbow: [42, 27], wrist: [40, 34], palm: [39, 36], knee: [44, 43], ankle: [44, 51] },
    },
  },
} satisfies Record<string, CharacterSpec>;

export const forestCourier = {
  ...shared,
  version: 3, kind: 'humanoid-traveler', name: 'Forest Courier', seed: 73,
  outfit: { headwear: 'hood', satchel: 'crossbody', cloth: 'russet-moss' },
  proportions: { head: [17, 15], jacket: [15, 13], hips: 14, arm: [6, 4], leg: [7, 5], boot: [9, 4], satchel: [10, 10] },
  pose: {
    kind: 'standing-free', hip: [34, 37], lean: -1, turn: 3, pivot: [32, 58], support: 'near', secondaryGroundOffset: -1,
    near: { elbow: [22, 34], wrist: [19, 40], palm: [20, 42], knee: [31, 45], ankle: [30, 53] },
    far: { elbow: [42, 31], wrist: [41, 36], palm: [39, 38], knee: [42, 44], ankle: [40, 52] },
  },
} satisfies CharacterSpec;
