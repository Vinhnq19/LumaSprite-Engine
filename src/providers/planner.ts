import type { AssetSpecV1 } from '../specs/asset.ts';

export interface PlanInput {
  brief: string;
  seed: number;
  palette?: readonly string[];
}

export interface AssetPlanner {
  plan(input: PlanInput): Promise<AssetSpecV1>;
}
