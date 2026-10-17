// Большая карта: улица у дома фонарщика, деревня за рекой, город на севере, побережье на востоке.
// Фонари, дороги, дома и грядки расставлены вручную; вода, лес и мелочи — генератором со сидом.

import type { ResidentId } from './story';

export const W = 96;
export const H = 80;

export const GRASS = 0;
export const PATH = 1;
export const WATER = 2;
export const STONE = 3;
export const SAND = 4;
/** Мост: вода, по которой можно ходить, когда мост починен. */
export const BRIDGE = 5;

export type LampKind = 'oil' | 'gas' | 'stubborn' | 'marsh' | 'beacon';
export type District = 'street' | 'village' | 'town' | 'coast';

export interface Lamp {
  id: number; x: number; y: number;
  kind: LampKind; district: District;
  /** Имя маяка. */
  name?: string;
  oil: number;
  /** Горит ли (упрямый фонарь может погаснуть от ветра, а масло в нём останется). */
  lit: boolean;
  everLit: boolean;
  /** Упрямый фонарь: сколько секунд ещё тлеет искра после первого захода. */
  kindled: number;
  /** Упрямый фонарь: секунды до следующего порыва ветра. */
  gust: number;
}
export interface Flower { x: number; y: number; stage: number; grow: number }
export interface House { x: number; y: number; rid: ResidentId }
export interface Tree { x: number; y: number; v: number }
/** Пруд: центр и радиус (в клетках) — на нём плавают утки. */
export interface Pond { x: number; y: number; r: number }

export interface World {
  w: number;
  h: number;
  ground: Uint8Array;
  block: Uint8Array;
  trees: Tree[];
  lamps: Lamp[];
  flowers: Flower[];
  houses: House[];
  /** Маслобойни. */
  presses: { x: number; y: number }[];
  /** Дом фонарщика (2×2) — в него заходят, чтобы закончить ночь. */
  home: { x: number; y: number } | null;
  /** Где стоит игрок в начале ночи (у двери дома). */
  start: { x: number; y: number };
  /** Что за краем карты: лес вокруг или ещё и море на востоке. */
  edge: 'forest' | 'sea-east';
  /** Пруды с утками. */
  ponds: Pond[];
  /** Какой район в клетке (от него зависят цвета травы и деревьев). Можно и за краем карты. */
  biome: (x: number, y: number) => District;
}

/** Точка у двери дома (дверь — на передней левой стене). */
export const homeDoor = (h: { x: number; y: number }) => ({ x: h.x + 1, y: h.y + 2.2 });

export const DISTRICT_NAMES: Record<District, string> = {
  street: 'Улица', village: 'Деревня за рекой', town: 'Старый город', coast: 'Побережье',
};

// ---------- фонари: [x, y, вид, район, имя маяка] ----------
const LAMPS: [number, number, LampKind, District, string?][] = [
  // 0–12: улица у дома
  [57, 52, 'oil', 'street'], [57, 58, 'oil', 'street'], [52, 60, 'oil', 'street'], [63, 60, 'oil', 'street'],
  [49, 56, 'oil', 'street'], [47, 49, 'oil', 'street'], [64, 47, 'oil', 'street'], [68, 54, 'oil', 'street'],
  [69, 62, 'oil', 'street'], [61, 68, 'oil', 'street'], [45, 66, 'oil', 'street'], [42, 55, 'oil', 'street'],
  [36, 48, 'beacon', 'street', 'Маяк у моста'],
  // 13–19: деревня за рекой
  [21, 47, 'oil', 'village'], [16, 43, 'marsh', 'village'], [11, 49, 'oil', 'village'], [16, 56, 'oil', 'village'],
  [21, 60, 'oil', 'village'], [8, 40, 'marsh', 'village'], [13, 52, 'beacon', 'village', 'Маяк деревни'],
  // 20–26: старый город
  [64, 38, 'gas', 'town'], [57, 31, 'gas', 'town'], [49, 24, 'gas', 'town'], [61, 22, 'gas', 'town'],
  [69, 28, 'gas', 'town'], [53, 15, 'gas', 'town'], [56, 25, 'beacon', 'town', 'Маяк на площади'],
  // 27–31: побережье
  [74, 52, 'stubborn', 'coast'], [78, 45, 'stubborn', 'coast'], [78, 59, 'stubborn', 'coast'], [81, 39, 'stubborn', 'coast'],
  [84, 33, 'beacon', 'coast', 'Старый маяк'],
];

/** Дороги между фонарями (индексы), буквой «Г». */
const ROADS: [number, number][] = [
  [0, 1], [1, 2], [1, 3], [0, 4], [4, 5], [0, 6], [3, 7], [7, 8], [1, 9], [2, 10], [4, 11], [5, 12],
  [12, 13], // через мост
  [13, 14], [13, 19], [19, 15], [19, 16], [16, 17], [14, 18],
  [6, 20], [20, 21], [21, 26], [26, 22], [26, 23], [23, 24], [22, 25],
  [7, 27], [27, 28], [27, 29], [28, 30], [30, 31],
];

/** Грядки подсолнухов 2×2 (левый верхний угол). */
const PATCHES: [number, number][] = [
  [55, 53], [50, 61], [66, 55], [56, 67], [44, 63],
  [19, 48], [9, 50], [14, 57], [17, 57], [19, 61], [14, 44], [6, 41],
];

const HOUSES: [ResidentId, number, number][] = [
  ['timofey', 71, 61], ['nika', 43, 59], ['seva', 59, 28],
  ['agata', 9, 53], ['mila', 22, 52], ['filin', 80, 35],
];

const HOME = { x: 59, y: 53 };
const PRESSES = [{ x: 55, y: 50 }, { x: 18, y: 51 }];

/** Ось реки: x в зависимости от y. */
export const riverX = (y: number) => 30 + 4 * Math.sin(y / 9);

/** Район по клетке: за рекой — деревня, на севере — город, на востоке — побережье. */
export function districtAt(x: number, y: number): District {
  if (x < riverX(y)) return 'village';
  if (x >= 72 + 2 * Math.sin(y / 6)) return 'coast';
  if (x >= 44 && y < 40 + 2 * Math.sin(x / 5)) return 'town';
  return 'street';
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Какая земля за краем карты (для рисования горизонта). */
export function outsideGround(w: World, x: number, _y: number) {
  if (w.edge === 'sea-east' && x >= w.w - 6) return WATER;
  if (w.edge === 'sea-east' && x >= w.w - 10) return SAND;
  return GRASS;
}

export function makeWorld(seed = 7): World {
  const rand = rng(seed);
  const ground = new Uint8Array(W * H);
  const block = new Uint8Array(W * H);
  const reserved = new Uint8Array(W * H);
  const idx = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  // море на востоке и пляж
  for (let y = 0; y < H; y++) {
    const sea = W - 9 + 1.5 * Math.sin(y / 5);
    const sand = W - 13 + Math.sin(y / 4);
    for (let x = 0; x < W; x++) {
      if (x >= sea) ground[idx(x, y)] = WATER;
      else if (x >= sand) ground[idx(x, y)] = SAND;
    }
  }
  // река с севера на юг и озеро у деревни
  for (let y = 0; y < H; y++) {
    const cx = riverX(y);
    for (let x = 0; x < W; x++) {
      if (Math.abs(x - cx) < 1.6 || Math.hypot(x - 12, y - 40) < 3.5) ground[idx(x, y)] = WATER;
    }
  }
  // площадь старого города
  for (let y = 18; y < 33; y++) for (let x = 50; x < 67; x++) ground[idx(x, y)] = STONE;

  // дороги (по воде — мост)
  for (const [a, b] of ROADS) {
    let [x, y] = LAMPS[a];
    const [bx, by] = LAMPS[b];
    const lay = () => {
      const i = idx(x, y);
      if (ground[i] === WATER) ground[i] = BRIDGE;
      else if (ground[i] !== STONE && ground[i] !== BRIDGE) ground[i] = PATH;
    };
    while (x !== bx) { lay(); x += Math.sign(bx - x); }
    while (y !== by) { lay(); y += Math.sign(by - y); }
    lay();
  }

  const reserve = (x: number, y: number, w: number, h: number, solid: boolean) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        reserved[idx(i, j)] = 1;
        if (solid) block[idx(i, j)] = 1;
      }
  };

  const lamps: Lamp[] = LAMPS.map(([x, y, kind, district, name], id) => {
    reserve(x, y, 1, 1, true);
    return { id, x, y, kind, district, name, oil: 0, lit: false, everLit: false, kindled: 0, gust: 0 };
  });

  for (const p of PRESSES) reserve(p.x, p.y, 1, 1, true);
  reserve(HOME.x, HOME.y, 2, 2, true);
  const start = { x: HOME.x + 1, y: HOME.y + 2.6 };

  const flowers: Flower[] = [];
  for (const [fx, fy] of PATCHES) {
    reserve(fx, fy, 2, 2, false);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) flowers.push({ x: fx + i, y: fy + j, stage: 0, grow: 0 });
  }

  const houses: House[] = HOUSES.map(([rid, x, y]) => { reserve(x, y, 2, 2, true); return { x, y, rid }; });

  // пруды: ищем пустые поляны подальше от дорог, домов и друг от друга
  const ponds: Pond[] = [];
  const clearAround = (cx: number, cy: number, r: number) => {
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const x = cx + i, y = cy + j;
        if (!inside(x, y) || ground[idx(x, y)] !== GRASS || reserved[idx(x, y)]) return false;
      }
    return true;
  };
  // кандидаты — пустые поляны; берём ближайшие к дому (их увидят), но не ближе 18 клеток друг к другу
  const spots: { x: number; y: number }[] = [];
  for (let y = 8; y < H - 8; y += 2)
    for (let x = 8; x < W - 18; x += 2)
      if (districtAt(x, y) !== 'town' && clearAround(x, y, 5) && Math.hypot(x - start.x, y - start.y) >= 8) spots.push({ x, y });
  spots.sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y));
  for (const { x, y } of spots) {
    if (ponds.length >= 3) break;
    if (ponds.some((p) => Math.hypot(p.x - x, p.y - y) < 18)) continue;
    const r = 2.2 + rand() * 0.8;
    ponds.push({ x: x + 0.5, y: y + 0.5, r });
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++) {
        const wob = 0.35 * Math.sin((i + j) * 1.7 + x);
        if (Math.hypot(i, j * 1.1) <= r + wob) ground[idx(x + i, y + j)] = WATER;
      }
  }

  // деревья: густой лес у краёв, внутри — рощи (кучками, с полянками), в городе почти нет
  const trees: Tree[] = [];
  const grove = (x: number, y: number) => {
    const v = Math.sin(x * 0.31 + y * 0.17) + Math.sin(x * 0.13 - y * 0.29 + 2) + Math.sin((x + y) * 0.07 + 5);
    return Math.max(0, Math.min(1, (v + 1.2) / 3));
  };
  const keepClear = (x: number, y: number) =>
    houses.some((h) => Math.hypot(h.x + 1 - x, h.y + 1 - y) < 3.2) ||
    PRESSES.some((p) => Math.hypot(p.x - x, p.y - y) < 2.5) ||
    ponds.some((p) => Math.hypot(p.x - x - 0.5, p.y - y - 0.5) < p.r + 1.6);
  const nearRoad = (x: number, y: number) => {
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        if (!inside(x + i, y + j)) continue;
        const g = ground[idx(x + i, y + j)];
        if (g === PATH || g === BRIDGE || g === STONE || reserved[idx(x + i, y + j)]) return true;
      }
    return false;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ground[idx(x, y)] !== GRASS || nearRoad(x, y)) continue;
      if (lamps.some((l) => Math.hypot(l.x - x, l.y - y) < 2.2)) continue;
      if (Math.hypot(x + 0.5 - start.x, y + 0.5 - start.y) < 3) continue;
      const edge = Math.min(x, y, H - 1 - y, x < W - 20 ? W - 1 - x : 99);
      const town = x >= 46 && x < 70 && y >= 12 && y < 36;
      if (keepClear(x, y)) continue;
      const chance = edge < 4 ? 0.8 : town ? 0.05 : 0.08 + 0.55 * grove(x, y);
      if (rand() < chance) {
        trees.push({ x, y, v: rand() });
        block[idx(x, y)] = 1;
      }
    }
  }

  for (let i = 0; i < W * H; i++) if (ground[i] === WATER) block[i] = 1;

  return { w: W, h: H, ground, block, trees, lamps, flowers, houses, presses: PRESSES, home: HOME, start, edge: 'sea-east', ponds, biome: districtAt };
}
