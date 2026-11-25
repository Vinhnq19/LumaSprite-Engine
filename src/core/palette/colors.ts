export const chestColors = {
  contour: '#201a24',
  woodShadow: '#4a2927',
  woodDark: '#723e2c',
  wood: '#a15a36',
  woodLight: '#ca8248',
  woodGlint: '#eea761',
  ironShadow: '#343344',
  iron: '#51546a',
  ironLight: '#777d8b',
  brassShadow: '#935630',
  brass: '#e0a051',
  brassLight: '#ffe3a0',
} as const;

export const pack = (hex: string): number => (Number.parseInt(hex.slice(1), 16) * 256) + 255;
export const unpack = (ink: number): string => '#' + (ink >>> 8).toString(16).padStart(6, '0');

export function nearestInk(hex: string, palette: readonly number[]): number {
  const target = pack(hex);
  const distance = (ink: number) => {
    const r = (target >>> 24) - (ink >>> 24);
    const g = ((target >>> 16) & 255) - ((ink >>> 16) & 255);
    const b = ((target >>> 8) & 255) - ((ink >>> 8) & 255);
    return 2 * r * r + 4 * g * g + b * b;
  };
  return palette.reduce((best, ink) => distance(ink) < distance(best) ? ink : best);
}

export function mapPalette<Role extends string>(roles: Record<Role, string>, palette: readonly string[]) {
  const inks = palette.map(pack);
  return Object.fromEntries(Object.entries(roles).map(([role, color]) => [role, nearestInk(color as string, inks)])) as Record<Role, number>;
}

export function inkLuma(ink: number) {
  return Math.round(((ink >>> 24) * 2126 + ((ink >>> 16) & 255) * 7152 + ((ink >>> 8) & 255) * 722) / 10000);
}
