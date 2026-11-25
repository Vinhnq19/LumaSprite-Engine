export const artCriteria = [
  'silhouette', 'shape', 'material readability', 'pixel clusters', 'outline quality',
  'color harmony', 'artistic appeal', 'game readiness',
] as const;

export type ArtisticReview = { status: 'PENDING_HUMAN_REVIEW' } | {
  status: 'ARTISTIC_PASS' | 'NEEDS_REFINEMENT';
  reviewer: string;
  notes: Record<(typeof artCriteria)[number], string>;
};
