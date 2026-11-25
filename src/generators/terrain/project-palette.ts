import { chestColors } from '../../core/palette/colors.ts';

export const projectTerrainRoles = {
  grass: '#63804c', grassShade: '#48643e', grassLight: '#799052',
  dirt: '#a17c5e', dirtShade: '#8e6c51', dirtLight: '#b0896d',
} as const;

// Retain the exact authored prop colors so picking this preset does not recolor E2 artwork.
export const projectPalette = [...Object.values(projectTerrainRoles), ...Object.values(chestColors)];

export const productionProjectTerrainRoles = { ...projectTerrainRoles, dirtPacked: '#9f795c' } as const;
export const productionProjectPalette = [...Object.values(productionProjectTerrainRoles), ...Object.values(chestColors)];
