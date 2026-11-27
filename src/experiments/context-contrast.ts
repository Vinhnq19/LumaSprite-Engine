import assert from 'node:assert/strict';
import { inkLuma } from '../core/palette/colors.ts';
import type { Raster } from '../core/pixels/raster.ts';
import { covered } from '../generators/environment/refinement.ts';

const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
export type Instance = {
  left: number;
  top: number;
  at: readonly [number, number];
  raster: Raster;
  mask: Raster;
  visible: Set<number>;
  contour: number;
  signal: number;
};

export const gap = (a: number, b: number) => Math.abs(inkLuma(a) - inkLuma(b));

export function edgeSamples(scene: Raster, object: Instance) {
  const { raster, visible } = object;
  const samples: { offset: number; role: number; ink: number; neighbor: number; contact: boolean }[] = [];
  for (const offset of visible) {
    const x = offset % raster.w, y = Math.floor(offset / raster.w);
    const wx = x + object.left, wy = y + object.top;
    const ink = scene.rgba.readUInt32BE((wy * scene.w + wx) * 4);
    assert.equal(ink, raster.rgba.readUInt32BE(offset * 4), 'Visible scene pixel differs from its sprite.');
    for (const [dx, dy] of sides) {
      if (covered(raster, x + dx, y + dy) || !covered(scene, wx + dx, wy + dy)) continue;
      samples.push({ offset, role: object.mask.rgba.readUInt32BE(offset * 4), ink,
        neighbor: scene.rgba.readUInt32BE(((wy + dy) * scene.w + wx + dx) * 4),
        contact: dy === 1 && wy >= object.at[1] - 3,
      });
    }
  }
  return samples;
}

export function clusters(pixels: Iterable<number>, width: number) {
  const open = new Set(pixels);
  const groups: number[][] = [];
  for (const first of open) {
    const group = [first];
    open.delete(first);
    for (const offset of group) {
      const x = offset % width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const next = offset + dy * width + dx;
        if (x + dx >= 0 && x + dx < width && open.delete(next)) group.push(next);
      }
    }
    groups.push(group);
  }
  return groups.sort((a, b) => b.length - a.length);
}

function distribution(values: number[], weak: number) {
  values.sort((a, b) => a - b);
  return { n: values.length, p10: values[Math.floor(values.length / 10)] ?? null,
    median: values[Math.floor(values.length / 2)] ?? null, weak: values.filter(value => value < weak).length };
}

export function contextContrast(scene: Raster, object: Instance, weak: number) {
  const edges = edgeSamples(scene, object);
  const { raster, mask, visible, signal } = object;
  const signalGaps: number[] = [];
  const signalPixels: number[] = [];
  for (const offset of visible) {
    if (mask.rgba.readUInt32BE(offset * 4) !== signal) continue;
    signalPixels.push(offset);
    const x = offset % raster.w, y = Math.floor(offset / raster.w);
    const world = (object.top + y) * scene.w + object.left + x;
    const ink = scene.rgba.readUInt32BE(world * 4);
    for (const [dx, dy] of sides) {
      if (!covered(mask, x + dx, y + dy)) continue;
      const next = offset + dy * mask.w + dx;
      if (!visible.has(next) || mask.rgba.readUInt32BE(next * 4) === signal) continue;
      signalGaps.push(gap(ink, scene.rgba.readUInt32BE((world + dy * scene.w + dx) * 4)));
    }
  }
  const outline = edges.filter(edge => edge.role === object.contour);
  const outlineClusters = (samples: typeof edges) => clusters(samples.map(edge => edge.offset), raster.w).map(cluster => cluster.length);
  const signalExterior = edges.filter(edge => edge.role === signal);
  const values = (samples: typeof edges) => distribution(samples.map(edge => gap(edge.ink, edge.neighbor)), weak);
  return {
    silhouette: values(edges), outline: values(outline), contact: values(edges.filter(edge => edge.contact)),
    outlineRuns: outlineClusters(outline), weakOutlineRuns: outlineClusters(outline.filter(edge => gap(edge.ink, edge.neighbor) < weak)),
    signal: { pixels: signalPixels.length, clusters: clusters(signalPixels, raster.w).map(group => group.length),
      housing: distribution(signalGaps, weak), exterior: values(signalExterior) },
  };
}
