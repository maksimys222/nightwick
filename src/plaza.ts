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
  // тропа почтальона: от угла площади изгибом уходит влево, в лес
  for (const [x, y] of [[5, 12], [4, 12], [4, 13], [3, 13], [2, 13], [2, 14], [1, 14], [0, 14], [3, 12], [1, 13], [0, 13]]) ground[idx(x, y)] = PATH;
  for (let x = 14; x < w; x++) ground[idx(x, 7)] = PATH;

  const spots: [ResidentId, number, number][] = [
    ['agata', 1, 5], ['timofey', 1, 9], ['nika', 14, 4], ['seva', 14, 9], ['filin', 5, 1], ['mila', 10, 1],
  ];
  const houses: House[] = spots.map(([rid, x, y]) => { solid(x, y, 2, 2); return { rid, x, y }; });

  // фонарей на площади нет — днём они не нужны, а ночью их сюда так и не поставили
  const lamps: Lamp[] = [];

  const flowers: Flower[] = [3, 4, 6, 7].map((y) => ({ x: 3, y, stage: 3, grow: 0 }));

  const props: Prop[] = [
    { kind: 'fountain', x: 8, y: 7, w: 2, h: 2 },
    { kind: 'stall', x: 12, y: 3, w: 1, h: 1 },
    { kind: 'anvil', x: 3, y: 11, w: 1, h: 1 },
    { kind: 'easel', x: 12, y: 8, w: 1, h: 1 },
  ];
  for (const p of props) solid(p.x, p.y, p.w, p.h);

  // деревья: сплошь по краю и на пустой траве внутри; проходы жителей к дверям оставляем свободными
  const runs: [number, number, number, number][] = [
    [12.6, 4.6, 11, 3.2], [4.4, 5.6, 2, 7.2], [4.5, 11.5, 2, 11.2], [12.4, 9.4, 15, 6.2], [6.6, 3.8, 6, 3.2], [8.6, 10.8, 15, 11.2],
  ];
  const nearRun = (x: number, y: number) => runs.some(([ax, ay, bx, by]) => {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
    return Math.hypot(ax + dx * t - x, ay + dy * t - y) < 1.3;
  });
  const besideStone = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => ground[idx(Math.min(w - 1, Math.max(0, x + i)), Math.min(h - 1, Math.max(0, y + j)))] !== GRASS);
  const trees: Tree[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (block[idx(x, y)] || ground[idx(x, y)] !== GRASS) continue;
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edge > 0 && (nearRun(x + 0.5, y + 0.5) || besideStone(x, y) || (x * 7 + y * 13) % 5 === 0)) continue;
      trees.push({ x, y, v: ((x * 31 + y * 17) % 10) / 10 });
      solid(x, y, 1, 1);
    }
  }

  return { w, h, ground, block, trees, lamps, flowers, houses, presses: [], home: null, camp: 'home', start: { x: 8.5, y: 10 }, edge: 'forest', ponds: [], biome: () => 'street', props,
    chests: [], goal: -1, trail: [] };
}
