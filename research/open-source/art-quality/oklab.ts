// Selected sRGB transfer functions and matrices from @texel/color (MIT).
// See licenses/texel-color.txt and the pinned files in the report.
import { pack, unpack } from '../../../src/core/palette/colors.ts';

type Vec = [number, number, number];
const rgbToLms = [
  [0.4122214694707629, 0.5363325372617349, 0.051445993267502196],
  [0.2119034958178251, 0.6806995506452345, 0.10739695353694051],
  [0.08830245919005637, 0.2817188391361215, 0.6299787016738223],
];
const lmsToLab = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.42859224204858, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const labToLms = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];
const lmsToRgb = [
  [4.076741636075959, -3.307711539258062, 0.2309699031821041],
  [-1.2684379732850313, 2.6097573492876878, -0.3413193760026569],
  [-0.004196076138675526, -0.703418617935936, 1.7076146940746113],
];
const transform = (m: number[][], [x, y, z]: Vec) => m.map(([a, b, c]) => a * x + b * y + c * z) as Vec;
const linear = (u: number) => Math.abs(u) <= 0.04045 ? u / 12.92 : Math.sign(u) * ((Math.abs(u) + 0.055) / 1.055) ** 2.4;
const gamma = (u: number) => Math.abs(u) <= 0.0031308 ? 12.92 * u : Math.sign(u) * (1.055 * Math.abs(u) ** (1 / 2.4) - 0.055);
const map = (v: Vec, f: (n: number) => number) => v.map(f) as Vec;

export function toLab(color: string): Vec {
  const ink = pack(color);
  const channels: Vec = [ink >>> 24, (ink >>> 16) & 255, (ink >>> 8) & 255];
  const rgb = map(channels, n => linear(n / 255));
  return transform(lmsToLab, map(transform(rgbToLms, rgb), Math.cbrt));
}

export function toLch([l, a, b]: Vec): Vec {
  if (Math.abs(a) < 0.000004 && Math.abs(b) < 0.000004) return [l, 0, 0];
  return [l, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
}

export function toSrgb(lab: Vec): string | undefined {
  const rgb = map(transform(lmsToRgb, map(transform(labToLms, lab), n => n ** 3)), gamma);
  if (rgb.some(n => n < -1e-7 || n > 1 + 1e-7)) return undefined;
  const [r, g, b] = map(rgb, n => Math.round(255 * n));
  return unpack(r * 0x1000000 + g * 0x10000 + b * 0x100 + 255);
}

export function lchInk(l: number, c: number, h: number) {
  const radians = h * Math.PI / 180;
  for (let i = 0; i <= 24; i++) {
    const chroma = c * (1 - i / 24);
    const color = toSrgb([l, chroma * Math.cos(radians), chroma * Math.sin(radians)]);
    if (color) return color;
  }
  throw new Error('Even a neutral exceeds the sRGB gamut');
}

export const delta = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
