import { rect } from '../../core/geometry/faces.ts';
import { ellipseSpans } from '../../core/geometry/projection.ts';
import { cluster,fillPolygon,type Point } from '../../core/geometry/shapes.ts';
import { chestColors,pack } from '../../core/palette/colors.ts';
import { makeRaster } from '../../core/pixels/raster.ts';
import type { StyleProfile } from '../../specs/environment.ts';
import type { UISpec } from '../../specs/pixel-effects.ts';

export function renderUi(spec:UISpec,style:StyleProfile){
  const [w,h]=spec.size;
  const surfaces=style.illumination.day.surfaces, contour=style.illumination.day.contour;
  if(spec.kind==='interaction-icon'){
    const ramp={outline:contour,slate:surfaces.metal[0],silver:surfaces.metal[2],
      rim:surfaces.metal[3],bronze:surfaces.amber[1],gold:surfaces.amber[2],glyph:surfaces.amber[3],white:'#fff4d7'};
    const frames=['normal','active'].map((state)=>{
      const raster=makeRaster(w,h), active=state==='active';
      const paint=(ink:keyof typeof ramp,p:readonly Point[])=>fillPolygon(raster,p,pack(ramp[ink]));
      paint('outline',[[4,1],[12,1],[15,4],[15,11],[12,14],[9,14],[8,16],[6,14],[4,14],[1,11],[1,4]]);
      paint(active?'gold':'rim',[[4,2],[12,2],[14,4],[14,11],[12,13],[9,13],[8,15],[7,13],[4,13],[2,11],[2,4]]);
      paint(active?'bronze':'silver',[[3,9],[13,9],[13,12],[9,12],[8,14],[7,12],[4,12],[3,11]]);
      paint('slate',[[5,4],[11,4],[13,5],[13,10],[11,12],[5,12],[3,10],[3,5]]);
      paint(active?'white':'glyph',[[6,5],[8,5],[8,8],[9,8],[9,7],[11,7],[11,10],[10,11],[6,11],[4,9],[4,8],[6,8]]);
      paint('gold',rect(6,10,10,11));
      return {id:state,raster};
    });
    return {frames,ramp,pivot:[8,15] as const};
  }
  const ramp={outline:contour,woodShade:chestColors.woodShadow,woodDark:chestColors.woodDark,
    wood:chestColors.wood,woodLight:chestColors.woodLight,woodRim:chestColors.woodGlint,
    ironDark:surfaces.metal[0],iron:surfaces.metal[1],ironLight:surfaces.metal[3],
    brass:surfaces.amber[2]};
  const raster=makeRaster(w,h);
  const paint=(ink:keyof typeof ramp,p:readonly Point[])=>fillPolygon(raster,p,pack(ramp[ink]));
  paint('outline',[[9,4],[22,4],[26,6],[28,11],[29,16],[28,22],[25,27],[21,29],[10,29],[6,27],[3,22],[3,13],[4,9],[6,6]]);
  paint('woodShade',[[8,6],[23,6],[26,9],[28,16],[27,22],[24,26],[20,28],[10,28],[7,26],[4,22],[4,13],[5,9]]);
  paint('wood',[[8,7],[19,7],[22,10],[24,16],[23,22],[21,25],[10,26],[7,24],[5,20],[5,14],[6,10]]);
  paint('woodLight',[[8,9],[13,10],[12,23],[13,25],[9,24],[7,20],[7,14]]);
  paint('woodDark',[[17,10],[19,10],[20,15],[19,23],[18,25],[17,24],[18,20],[18,14]]);
  paint('woodDark',[[11,10],[12,10],[11,15],[11,22],[12,25],[11,25],[10,22],[10,15]]);
  paint('woodDark',[[22,10],[24,11],[26,16],[25,22],[22,25],[23,21],[23,16]]);
  cluster(raster,pack(ramp.woodDark),ellipseSpans([15.5,7.6],21,8));
  cluster(raster,pack(ramp.woodRim),ellipseSpans([15,7],17,5));
  paint('woodLight',[[9,8],[21,8],[23,9],[18,10],[10,9]]);
  paint('woodDark',rect(11,7,20,8));
  // The broad hoops wrap the barrel's sides and turn the front down one pixel.
  for(const y of [12,21]){
    paint('ironDark',[[4,y],[9,y+2],[22,y+2],[27,y],[28,y+2],[25,y+4],[8,y+4],[3,y+2]]);
    paint('iron',[[5,y+1],[10,y+2],[21,y+2],[25,y+1],[25,y+2],[21,y+3],[9,y+3]]);
    paint('ironLight',rect(9,y+2,13,y+3));
  }
  paint('brass',rect(14,15,16,16));
  paint('woodRim',rect(13,5,18,6));
  return {frames:[{id:'inventory',raster}],ramp,pivot:[16,28] as const};
}
