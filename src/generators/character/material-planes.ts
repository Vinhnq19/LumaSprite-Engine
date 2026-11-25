import type { Point } from '../../core/geometry/shapes.ts';
import type { SurfacePatch } from '../../core/materials/surface.ts';

export const characterRamps = {
  skin: { shadow: '#a86a55', base: '#dca57a', light: '#f5c393', accent: '#392c37' },
  hair: { shadow: '#392c37', base: '#513638', light: '#896049', accent: '#392c37' },
  cap: { shadow: '#2d4346', base: '#536964', light: '#798c7c', accent: '#394b4d' },
  brim: { shadow: '#2d4346', base: '#394b4d', light: '#536964', accent: '#2d4346' },
  coat: { shadow: '#2e4e52', base: '#46746e', light: '#75a08b', accent: '#375d5b' },
  'far-coat': { shadow: '#293943', base: '#37545a', light: '#46746e', accent: '#2e4e52' },
  trousers: { shadow: '#343344', base: '#525a6e', light: '#777d8b', accent: '#434a5c' },
  'far-trousers': { shadow: '#2c2c3b', base: '#434a5c', light: '#525a6e', accent: '#343344' },
  leather: { shadow: '#513638', base: '#896049', light: '#b18059', accent: '#674937' },
  metal: { shadow: '#343344', base: '#51546a', light: '#9ca8a8', accent: '#777d8b' },
  glass: { shadow: '#935630', base: '#e0a051', light: '#ffe3a0', accent: '#f6bd68' },
} as const;
export type Surface = keyof typeof characterRamps;
export const russetMossRamps = {
  coat: { shadow: '#6b4139', base: '#a36146', light: '#d79768', accent: '#86503d' },
  'far-coat': { shadow: '#512f32', base: '#71453d', light: '#a36146', accent: '#6b4139' },
  trousers: { shadow: '#303d41', base: '#535e51', light: '#88927a', accent: '#465046' },
  'far-trousers': { shadow: '#30383c', base: '#465046', light: '#535e51', accent: '#303d41' },
};
type Tone = keyof typeof characterRamps.skin;
const area = (tone: Tone, ...points: Point[]): SurfacePatch<Tone> => ({ tone, points });
const band = (tone: Tone, l: number, t: number, r: number, b: number) => area(tone, [l, t], [r, t], [r, b], [l, b]);

export function materialPlanes(part: string, surface: Surface, directed: boolean, polish = false): SurfacePatch<Tone>[] {
  if (polish) {
    if (surface === 'glass') return [
      band('shadow', .80, 0, 1, 1), band('accent', .13, .06, .8, .93),
      area('light', [.12, .2], [.63, .12], [.81, .36], [.7, .83], [.2, .86]),
    ];
    if (surface === 'metal') return [
      area('shadow', [.72, .1], [1, .14], [1, 1], [0, 1], [0, .86], [.69, .79]),
      area('accent', [0, .53], [.53, .49], [.65, .58], [.52, .82], [.08, .85]),
      area('light', [.08, .52], [.65, .48], [.81, .54], [.36, .61], [.22, .73], [.05, .74]),
      band('light', .12, .15, .32, .28),
    ];
    if (surface === 'coat' && part === 'jacket') return [
      area('shadow', [.51, .09], [.72, .3], [.63, .73], [.89, .87], [.76, 1], [.17, 1], [.3, .82]),
      area('light', [.12, .19], [.49, .06], [.64, .19], [.48, .42], [.48, .6], [.27, .73], [.15, .58]),
      area('accent', [.23, .58], [.46, .56], [.57, .69], [.33, .77], [.2, .71]),
    ];
    if (surface === 'coat' && part === 'near-forearm') return [
      area('shadow', [0, .58], [.43, .63], [.72, .64], [.8, .43], [1, .43], [1, 1], [0, 1]),
      area('light', [0, .43], [.51, .14], [.76, .21], [.68, .44], [.22, .55]),
      area('accent', [.81, .29], [.92, .22], [.85, .75], [.76, .72]),
    ];
  }
  switch (surface) {
    case 'skin':
      if (part === 'head') return directed ? [
        area('shadow', [0, 0], [1, 0], [1, .43], [.55, .37], [.34, .55], [.37, .76], [.66, .92], [.95, .84], [1, 1], [0, 1]),
        area('light', [.42, .48], [.53, .41], [.83, .46], [.98, .55], [.83, .72], [.59, .72]),
        band('accent', .72, .49, .86, .57),
      ] : [
        area('shadow', [0, 0], [1, 0], [1, .45], [.33, .42], [.34, .66], [.75, 1], [0, 1]),
        band('light', .55, .53, .93, .72), band('accent', .73, .49, .84, .57),
      ];
      if (part === 'neck') return [band('shadow', 0, 0, 1, .82)];
      return directed ? [area('shadow', [0, .54], [.42, .52], [.77, .69], [1, .6], [1, 1], [0, 1]),
        area('light', [.16, .18], [.56, .04], [.89, .15], [.69, .45], [.34, .47])]
        : [band('shadow', 0, .72, 1, 1), band('light', .33, .14, .72, .42)];
    case 'hair':
      return [area('shadow', [0, .3], [.4, .44], [.3, 1], [0, 1])];
    case 'cap':
      return directed ? [
        area('shadow', [.63, 0], [1, 0], [1, 1], [0, 1], [0, .72], [.6, .69], [.7, .46]),
        area('light', [.13, .24], [.38, .02], [.63, .11], [.59, .43], [.27, .59], [.09, .55]),
        area('accent', [.14, .73], [.66, .61], [.9, .66], [.79, .78], [.22, .83]),
      ] : [band('shadow', 0, .7, 1, 1), area('light', [.15, .25], [.45, .05], [.64, .17], [.52, .46], [.18, .55])];
    case 'brim':
      return [area('light', [0, .66], [.66, .55], [.89, .59], [.65, .72], [.02, .82])];
    case 'coat':
      if (part === 'jacket') return directed ? [
        area('shadow', [.43, .34], [.64, .35], [.64, .81], [.84, .88], [.77, 1], [.24, 1], [.29, .76]),
        area('light', [.22, .15], [.45, .06], [.49, .32], [.4, .63], [.24, .77], [.12, .63], [.18, .39]),
        area('accent', [.03, .86], [.19, .77], [.44, .79], [.38, .89], [.13, .94]),
      ] : [area('shadow', [.57, .11], [1, .2], [1, 1], [.1, 1], [.14, .79], [.51, .73]),
        area('light', [.19, .13], [.46, .07], [.46, .37], [.29, .43], [.13, .33])];
      if (part.endsWith('forearm')) return directed ? [
        area('shadow', [0, .62], [.47, .57], [.79, .73], [1, .51], [1, 1], [0, 1]),
        area('light', [.17, .27], [.54, .12], [.76, .21], [.58, .36], [.31, .44]),
        area('accent', [.81, .22], [.94, .12], [1, .23], [.95, .75], [.84, .68]),
      ] : [area('shadow', [0, .61], [.43, .67], [1, .49], [1, 1], [0, 1]),
        band('light', .32, .24, .68, .4)];
      return directed ? [
        area('shadow', [.39, .39], [.72, .29], [1, .46], [1, 1], [.58, 1], [.43, .77]),
        area('light', [.13, .15], [.47, .03], [.64, .13], [.57, .32], [.41, .42], [.38, .57], [.2, .48]),
      ] : [area('shadow', [.51, .45], [1, .17], [1, 1], [.62, 1]),
        area('light', [.15, .2], [.45, .06], [.59, .21], [.45, .36], [.2, .39])];
    case 'far-coat':
      return directed ? [area('shadow', [.72, 0], [1, 0], [1, 1], [.25, 1], [.67, .73]),
        area('light', [0, .15], [.5, .12], [.49, .37], [.2, .56], [0, .49])]
        : [band('shadow', .55, .55, 1, 1)];
    case 'trousers':
    case 'far-trousers':
      return directed ? [area('shadow', [.61, .1], [1, 0], [1, 1], [.15, 1], [.31, .77], [.67, .55]),
        area('light', [.12, .21], [.52, .05], [.53, .29], [.28, .45], [.17, .7], [0, .65]),
        area('accent', [.12, .58], [.46, .49], [.56, .55], [.37, .66], [.05, .72])]
        : [area('shadow', [.48, .45], [1, .22], [1, 1], [.31, 1]),
          band('light', .13, .22, .42, .44)];
    case 'leather':
      return directed ? [
        area('shadow', [0, .75], [.64, .69], [.83, .52], [1, .45], [1, 1], [0, 1]),
        area('light', [0, .11], [.47, .06], [.56, .21], [.39, .4], [.26, .64], [0, .7]),
        area('accent', [.31, .5], [.86, .37], [.96, .46], [.74, .56], [.38, .63]),
      ] : [band('shadow', 0, .73, 1, 1), band('light', .09, .18, .47, .47)];
    case 'metal':
      return directed ? [band('shadow', .61, .15, 1, 1), area('light', [.14, .04], [.7, 0], [.7, .12], [.32, .1], [.32, .49], [.13, .49]),
        band('accent', .05, .66, .26, .83)] : [band('shadow', .59, .11, 1, 1), band('light', .12, .09, .35, .5)];
    case 'glass':
      return directed ? [area('shadow', [.72, 0], [1, 0], [1, 1], [0, 1], [0, .82], [.68, .79]),
        area('accent', [.2, .6], [.6, .25], [.79, .36], [.84, .78], [.52, .99], [.18, .88]),
        area('light', [.18, .24], [.64, .22], [.7, .42], [.56, .75], [.27, .82])]
        : [band('shadow', .73, 0, 1, 1), band('light', .18, .25, .62, .76)];
  }
}
