import { rect, type Face } from '../../core/geometry/faces.ts';
import type { EnvironmentArchitecture } from '../../specs/environment.ts';
import type { PaintPiece } from './kit.ts';

export function revisedArchitecture(piece: PaintPiece, architecture: EnvironmentArchitecture, seed: number) {
  const { wallHeight: h, doorHeight, jamb } = architecture;
  const lintel = h - doorHeight;
  const wall = (window: boolean) => piece(16, h, [0,h], paint => {
    paint('wood', 1, rect(0,0,16,h - 22));
    paint('wood', 2, rect(0,7,16,18));
    paint('wood', 0, rect(0,0,16,5));
    paint('wood', 0, rect(0,h - 24,16,h - 20));
    paint('wood', 2, rect(0,h - 24,16,h - 23));
    paint('stone', 1, rect(0,h - 20,16,h));
    paint('stone', 2, rect(0,h - 20,16,h - 16));
    paint('stone', 0, rect(0,h - 4,16,h));
    const offset = seed % 4;
    paint('stone', 0, rect(2 + offset,h - 12,10 + offset,h - 11));
    paint('stone', 2, rect(3 + offset,h - 11,7 + offset,h - 10));
    paint('wood', 0, rect(2,21,7,22));
    paint('wood', 2, rect(9,37,15,38));
    if (!window) return;
    paint('wood', 0, rect(1,13,15,42));
    paint('wood', 3, rect(1,13,15,14));
    paint('metal', 0, rect(3,16,13,36));
    paint('metal', 1, rect(4,17,12,35));
    paint('metal', 2, [[4,18],[9,18],[4,27]]);
    paint('wood', 0, rect(7,16,9,36));
    paint('wood', 0, rect(3,25,13,27));
    paint('wood', 2, rect(0,37,16,39));
    paint('wood', 3, rect(1,37,8,38));
  });
  const door = piece(32,h,[0,h], paint => {
    paint('wood', 0, rect(0,0,32,lintel));
    paint('wood', 2, rect(0,lintel-4,32,lintel-2));
    paint('wood', 3, rect(1,lintel-4,22,lintel-3));
    paint('metal', 2, rect(1,lintel-2,2,lintel-1));
    paint('metal', 1, rect(29,lintel-2,30,lintel-1));
    paint('wood', 0, rect(0,lintel,jamb,h));
    paint('wood', 0, rect(32-jamb,lintel,32,h));
    paint('wood', 2, rect(1,lintel,2,h-7));
    paint('wood', 1, rect(32-jamb,lintel,33-jamb,h-8));
    paint('stone', 1, rect(0,h-7,jamb,h));
    paint('stone', 0, rect(32-jamb,h-7,32,h));
    paint('stone', 3, rect(0,h-7,jamb,h-6));
  });
  const corner = piece(16,h+8,[0,h+8], (paint,patch) => {
    const side: Face = [[0,8],[16,0],[16,h],[0,h+8]];
    paint('wood',0,side);
    patch('wood',1,side,0,.10,.92,.55);
    patch('wood',0,side,.68,.10,.79,.62);
    patch('stone',0,side,0,(h-20)/h,1,1);
    patch('stone',1,side,0,(h-20)/h,1,(h-14)/h);
    patch('stone',1,side,.41,(h-10)/h,.89,(h-8)/h);
    patch('wood',1,side,0,.10,1,.125);
  });
  function roof(width: number) {
    return piece(width+28,36,[5,36], (paint,patch) => {
      const front: Face = [[11,8],[width+12,8],[width+10,33],[0,33]];
      const right: Face = [[width+12,8],[width+22,0],[width+26,25],[width+10,33]];
      paint('roof',0,right);
      paint('roof',1,front);
      paint('roof',2,[[11,8],[20,0],[width+22,0],[width+12,8]]);
      patch('roof',1,right,.11,.21,.70,.37);
      patch('roof',0,right,.14,.64,.81,.70);
      patch('roof',2,right,.28,.71,.53,.74);
      patch('roof',2,front,0,0,1,.16);
      patch('roof',0,front,0,.91,1,1);
      for (const [u,v,length] of [[.05,.35,.20],[.30,.35,.28],[.78,.35,.15],[.12,.59,.15],[.47,.59,.17],[.70,.59,.24],[.04,.79,.12],[.23,.79,.26],[.66,.79,.20]]) {
        patch('roof',0,front,u,v,u+length,v+.045);
        patch('roof',0,front,u+.04,v-.085,u+.051,v);
        patch('roof',2,front,u+.065,v+.045,u+.109,v+.083);
      }
      paint('wood',0,[[1,32],[width+10,32],[width+25,24],[width+24,28],[width+10,36],[1,36]]);
      paint('wood',2,rect(2,32,width+9,33));
      paint('roof',3,rect(12,7,Math.floor(width*.70),8));
      paint('roof',1,rect(width+3,7,width+11,8));
      paint('wood',1,[[width+10,33],[width+23,26],[width+23,27],[width+10,34]]);
    });
  }
  const post = piece(5,h,[2,h], paint => {
    paint('wood',0,rect(0,0,5,h));
    paint('wood',1,rect(1,5,3,h-6));
    paint('wood',2,rect(1,7,2,h-8));
    paint('stone',1,rect(0,h-6,4,h));
    paint('stone',2,rect(0,h-6,3,h-5));
  });
  return { wall: wall(false), window: wall(true), door, corner, roof, post };
}
