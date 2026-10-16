// Главная площадь — здесь идёт вступительный ролик (солнечный день до прихода Гасителя).
// Отдельная маленькая карта: игрок не видит заранее улицу, по которой будет бродить.

import { GRASS, PATH, STONE, type World, type House, type Flower, type Lamp, type Tree } from './map';
import type { ResidentId } from './story';

export interface Prop { kind: 'fountain' | 'stall' | 'anvil' | 'easel'; x: number; y: number; w: number; h: number }

export interface Plaza extends World { props: Prop[] }

export function makePlaza(): Plaza {
  const w = 18, h = 16;
  const ground = new Uint8Array(w * h);
  const block = new Uint8Array(w * h);
  const idx = (x: number, y: number) => y * w + x;
  const solid = (x: number, y: number, ww: number, hh: number) => {
    for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) block[idx(i, j)] = 1;
  };

  // мощёная площадь и дорожки от неё
  for (let y = 4; y < 12; y++) for (let x = 4; x < 14; x++) ground[idx(x, y)] = STONE;
  for (let y = 12; y < h; y++) ground[idx(8, y)] = ground[idx(9, y)] = PATH;
  for (let x = 14; x < w; x++) ground[idx(x, 7)] = PATH;

  const spots: [ResidentId, number, number][] = [
    ['agata', 1, 5], ['timofey', 1, 9], ['nika', 14, 4], ['seva', 14, 9], ['filin', 5, 1], ['mila', 10, 1],
  ];
  const houses: House[] = spots.map(([rid, x, y]) => { solid(x, y, 2, 2); return { rid, x, y }; });

  const lamps: Lamp[] = [[4, 4], [13, 4], [4, 11], [13, 11]].map(([x, y], id) => {
    solid(x, y, 1, 1);
    return { id, x, y, kind: 'oil', district: 'street', oil: 0, lit: false, everLit: false, kindled: 0, gust: 0 };
  });

  const flowers: Flower[] = [3, 4, 6, 7].map((y) => ({ x: 3, y, stage: 3, grow: 0 }));

  const props: Prop[] = [
    { kind: 'fountain', x: 8, y: 7, w: 2, h: 2 },
    { kind: 'stall', x: 12, y: 3, w: 1, h: 1 },
    { kind: 'anvil', x: 3, y: 11, w: 1, h: 1 },
    { kind: 'easel', x: 12, y: 8, w: 1, h: 1 },
  ];
  for (const p of props) solid(p.x, p.y, p.w, p.h);

  // деревья по краю
  const trees: Tree[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edge > 0 || block[idx(x, y)] || ground[idx(x, y)] !== GRASS) continue;
      if ((x * 7 + y * 13) % 3 === 0) continue;
      trees.push({ x, y, v: ((x * 31 + y * 17) % 10) / 10 });
      solid(x, y, 1, 1);
    }
  }

  return { w, h, ground, block, trees, lamps, flowers, houses, presses: [], home: null, start: { x: 8.5, y: 10 }, edge: 'forest', props };
}
