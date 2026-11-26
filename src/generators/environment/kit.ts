import { fillFacePatch, rect, type Face } from '../../core/geometry/faces.ts';
import { fillPolygon, type Point } from '../../core/geometry/shapes.ts';
import { projectBox, riseForDepth } from '../../core/geometry/projection.ts';
import { pack } from '../../core/palette/colors.ts';
import { makeRaster } from '../../core/pixels/raster.ts';
import { revisedArchitecture } from './architecture.ts';
import type { EnvironmentArchitecture, EnvironmentFinish, EnvironmentLight, StyleProfile } from '../../specs/environment.ts';
import { surfaceNames } from '../../specs/environment.ts';

export type Surface = (typeof surfaceNames)[number];
export const wallReturnPx = 16;
export const wallRisePx = riseForDepth(wallReturnPx);
type Region = Surface | 'contour' | 'moss';
export const mossInk = '#82a456';
type Tone = 0 | 1 | 2 | 3;
type Paint = (role: Region, tone: Tone, poly: readonly Point[]) => void;
type Patch = (role: Surface, tone: Tone, face: Face, u0: number, v0: number, u1: number, v1: number) => void;
export type PaintPiece = (w: number, h: number, origin: Point, draw: (paint: Paint, patch: Patch) => void) =>
  { raster: ReturnType<typeof makeRaster>; material: ReturnType<typeof makeRaster>; origin: Point };
export const materialLegend = {
  stone: '#8bb4ce', wood: '#bc8862', roof: '#789e94', paving: '#cfbb83', metal: '#98a0be', amber: '#f9bb51',
  contour: '#48425e', grass: '#68864c', dirt: '#9d795c', prop: '#c28291', actor: '#94e4bd', shadow: '#292d42',
} as const;

export function materialPiece(inks: StyleProfile['illumination']['day']): PaintPiece {
  return function piece(w: number, h: number, origin: Point, draw: (paint: Paint, patch: Patch) => void) {
    const raster = makeRaster(w, h), material = makeRaster(w, h);
    const color = (role: Region, tone: Tone) => pack(role === 'contour' ? inks.contour :
      role === 'moss' ? inks.grass[Math.min(tone,2)] : inks.surfaces[role][tone]);
    const paint: Paint = (role, tone, poly) => {
      fillPolygon(raster, poly, color(role, tone));
      fillPolygon(material, poly, pack(role === 'moss' ? mossInk : materialLegend[role]));
    };
    const patch: Patch = (role, tone, face, u0, v0, u1, v1) => {
      fillFacePatch(raster, face, color(role, tone), u0, v0, u1, v1);
      fillFacePatch(material, face, pack(materialLegend[role]), u0, v0, u1, v1);
    };
    draw(paint, patch);
    return { raster, material, origin };
  };
}

export function environmentKit(style: StyleProfile, finish: EnvironmentFinish, light: EnvironmentLight, seed: number, architecture?: EnvironmentArchitecture) {
  const rich = finish === 'B';
  const span = style.detailSpan;
  const piece = materialPiece(style.illumination[light]);

  function wall(kind: 'wall' | 'window' | 'door') {
    return piece(16, 32, [0,32], paper => {
      paper('stone', 1, rect(0,0,16,32));
      paper('stone', 2, rect(0,3,16,18));
      paper('stone', 0, rect(0,29,16,32));
      paper('wood', 0, rect(0,0,16,3));
      paper('wood', 2, rect(0,0,16,1));
      if (rich) {
        for (const [i, y] of [9, 16, 23].entries()) {
          paper('stone', 1, rect(0,y,16,y + 1));
          const x = 3 + ((seed + i * 7) % 7);
          paper('stone', 0, rect(x,y + 1,x + 1,y + 5));
          paper('stone', 2, rect(Math.max(1,x - 2),y + 2,Math.min(15,x + span - 2),y + 3));
        }
      }
      if (kind === 'window') {
        paper('wood', 0, rect(1,7,15,23));
        paper('wood', 2, rect(2,7,14,9));
        paper('metal', 0, rect(3,9,13,20));
        paper('metal', 1, [[4,10],[12,10],[12,18],[4,20]]);
        paper('metal', rich ? 3 : 2, [[4,10],[8,10],[4,14]]);
        paper('wood', 1, rect(7,9,9,20));
        paper('wood', 3, rect(1,21,14,22));
        paper('wood', 0, rect(0,23,16,25));
      }
      if (kind === 'door') {
        paper('wood', 0, rect(1,5,15,32));
        paper('wood', 2, rect(1,5,14,8));
        paper('wood', 1, rect(1,8,3,31));
        paper('wood', 1, rect(13,8,15,31));
        paper('contour', 0, rect(3,8,13,32));
        paper('wood', 0, [[11,9],[13,9],[13,31],[9,29]]);
        paper('wood', 1, rect(4,9,6,30));
        paper('metal', 1, rect(3,30,13,32));
        if (rich) paper('wood', 3, rect(2,6,9,7));
      }
    });
  }

  const corner = piece(wallReturnPx,32+wallRisePx,[0,32+wallRisePx], (paint, patch) => {
    const face: Face = [[0,wallRisePx],[wallReturnPx,0],[wallReturnPx,32],[0,32+wallRisePx]];
    paint('stone',0,face);
    patch('stone',1,face,0,.10,1,.55);
    patch('stone',0,face,0,.75,1,1);
    patch('wood',0,face,0,0,1,.09);
    patch('wood',1,face,0,.03,1,.07);
    if (rich) {
      patch('stone', 1, face, .20,.59,.72,.68);
      patch('stone', 0, face, .69,.18,.77,.37);
      patch('stone', 2, face, .27,.29,.50,.34);
    }
  });

  function roof(width: number) {
    return piece(width + 28,40,[5,40], (paint, patch) => {
      const front: Face = [[11,11],[width+12,11],[width+10,37],[0,37]];
      const back: Face = [[19,1],[width+22,1],[width+12,11],[11,11]];
      const right: Face = [[width+12,11],[width+22,1],[width+26,29],[width+10,37]];
      paint('roof',0,right);
      paint('roof',1,front);
      paint('roof',2,back);
      patch('roof',1,back,.16,.46,1,.78);
      patch('roof',2,front,0,0,1,.21);
      patch('roof',0,front,0,.92,1,1);
      patch('roof',1,right,.14,.11,.82,.26);
      if (rich) {
        for (const [i,v] of [.28,.50,.73].entries()) {
          patch('roof',0,front,0,v,1,v+.045);
          patch('roof',2,front,.03,v+.054,1,v+.094);
          for (let col = 9 + (i % 2) * 6 + (seed % 4); col < width - 2; col += 16) {
            patch('roof',0,front,col/width,v-.12,(col+1)/width,v);
            patch('roof',2,front,(col+2)/width,v-.05,Math.min(.99,(col+span)/width),v-.012);
          }
        }
        patch('roof',2,right,.14,.40,.56,.48);
        patch('roof',3,back,.02,.06,.44,.14);
      }
      paint('wood',0,[[2,36],[width+10,36],[width+25,28],[width+24,31],[width+10,39],[2,39]]);
      paint('wood',2,[[3,36],[width+10,36],[width+10,37],[3,37]]);
      paint('roof',3,[[12,10],[width+12,10],[width+12,11],[11,11]]);
    });
  }

  const post = piece(6,32,[3,32], paint => {
    paint('wood',0,rect(0,0,6,32));
    paint('wood',1,rect(1,0,4,29));
    paint('wood',2,rect(1,0,2,24));
    paint('metal',0,rect(0,27,6,32));
    paint('metal',1,rect(0,28,3,29));
    if (rich) paint('wood',3,rect(2,3,3,8));
  });
  const sign = piece(14,12,[7,0], paint => {
    paint('wood',0,[[0,1],[12,0],[14,2],[14,10],[2,12],[0,10]]);
    paint('wood',2,[[1,2],[12,1],[13,3],[12,9],[2,10],[1,9]]);
    paint('wood',1,rect(2,3,12,9));
    paint('amber',2,[[8,2],[10,8],[7,7],[4,9],[6,5]]);
    paint('amber',3,[[8,2],[7,6],[5,7]]);
    paint('metal',2,rect(1,3,2,4));
    paint('metal',1,rect(12,7,13,8));
  });
  const lamp = piece(9,14,[4,0], paint => {
    paint('metal',0,rect(3,0,9,2));
    paint('metal',1,rect(3,1,5,5));
    paint('metal',0,[[3,4],[7,4],[8,7],[7,13],[2,13],[1,7]]);
    paint('amber',1,rect(2,7,7,12));
    paint('amber',2,rect(3,7,6,11));
    paint('amber',3,rect(3,8,4,10));
    paint('metal',2,rect(2,5,5,6));
  });
  const workbench = piece(35,24,[16,23], (paint, patch) => {
    paint('wood',0,rect(2,14,6,23));
    paint('wood',1,rect(2,15,4,22));
    paint('wood',0,rect(21,13,25,23));
    paint('wood',1,rect(21,14,23,22));
    paint('wood',0,rect(7,15,22,18));
    const { front, side, top } = projectBox({left: 1, top: 12, width: 25, depth: 7, bottom: 16, taper: 0});
    paint('wood',1,front); paint('wood',0,side); paint('wood',2,top);
    patch('wood',3,top,0,.15,.83,.34);
    if (rich) patch('wood',1,top,.23,.59,.74,.75);
    paint('metal',0,[[13,7],[15,7],[11,13],[9,13]]);
    paint('metal',0,[[15,6],[17,6],[19,12],[17,13]]);
    paint('metal',1,rect(13,5,17,9));
    paint('amber',1,[[9,6],[20,1],[23,3],[12,8]]);
    paint('amber',3,[[9,5],[20,1],[21,2],[10,6]]);
    paint('metal',0,[[19,1],[21,0],[24,3],[22,4]]);
    paint('amber',2,rect(13,6,15,8));
  });
  const shell = architecture ? revisedArchitecture(piece, architecture, seed) :
    { wall: wall('wall'), window: wall('window'), door: wall('door'), corner, roof, post };
  return { ...shell, sign, lamp, workbench };
}
