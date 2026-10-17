// Палитра мира: сочные цвета, у каждого района — свои (как разные леса в ярких изометрических играх).
// Ночь игра накладывает сверху сама, поэтому здесь — «дневные» цвета.

import type { District } from './map';

export interface Biome {
  /** Три оттенка травы — клетки чередуются, чтобы земля не была однотонной. */
  grass: [number, number, number];
  /** Травинки: светлые и тёмные. */
  tuft: [number, number];
  /** Листва круглых деревьев: тень, основной, блик. */
  leaves: [number, number, number];
  /** Хвоя ёлок: тень, основной, блик. */
  pine: [number, number, number];
  /** Доля круглых деревьев (остальные — ёлки). */
  round: number;
  /** Цветочки в траве. */
  flowers: number[];
}

export const BIOMES: Record<District, Biome> = {
  // улица у дома — классическая сочная зелень
  street: {
    grass: [0x58a83a, 0x5fb041, 0x53a036], tuft: [0x86d056, 0x3d8a2c],
    leaves: [0x2f7f34, 0x4caf40, 0x8ad85a], pine: [0x23663a, 0x358a48, 0x62b864],
    round: 0.55, flowers: [0xffffff, 0xffd23a, 0xff7aa8],
  },
  // деревня за рекой — вечная золотая осень
  village: {
    grass: [0x8aac3a, 0x93b540, 0x83a334], tuft: [0xbad65a, 0x678a2a],
    leaves: [0xb0482a, 0xe07a34, 0xffc050], pine: [0x2f6a40, 0x3f8a4c, 0x72b45e],
    round: 0.75, flowers: [0xff8a3a, 0xffd23a, 0xc87adf],
  },
  // старый город — цветущие розовые деревья
  town: {
    grass: [0x4ea860, 0x55b066, 0x49a05a], tuft: [0x82d48c, 0x34804a],
    leaves: [0xb04f86, 0xe47eae, 0xffc4dc], pine: [0x23663a, 0x358a48, 0x62b864],
    round: 0.95, flowers: [0xff7aa8, 0xffffff, 0xb08aff],
  },
  // побережье — морская бирюзовая листва
  coast: {
    grass: [0x6cbc4a, 0x73c450, 0x66b444], tuft: [0x9edc68, 0x4a983a],
    leaves: [0x1f8a6a, 0x34b488, 0x86e8bc], pine: [0x1f6a54, 0x2f8a66, 0x5cbc8a],
    round: 0.35, flowers: [0xffffff, 0x8ad0ff, 0xffd23a],
  },
};

export const GROUND = {
  path: [0xdcb070, 0xd3a663], pathDot: 0xb4864e,
  stone: [0xc6c0b4, 0xb8b2a6], stoneSeam: 0x8e887e,
  sand: [0xf2d890, 0xead084], sandDot: 0xd4b46c,
  water: [0x2eb0c6, 0x2aa6bc], waterHi: 0x98eef2,
  foam: 0xe8fcff, bankLit: 0xa8703e, bankShade: 0x7a4c2a,
  rock: [0x8a8a96, 0xb4b4c0, 0xe0e0e8],
};

/** Крыши домов — у каждого жителя свой цвет. */
export const ROOFS: Record<string, number> = {
  home: 0xd0463a, agata: 0xe0703c, timofey: 0x56688c, nika: 0xf0a030,
  seva: 0x3a7ad0, filin: 0x5e8a3a, mila: 0xb0508a,
};

/** Затемнить (k < 1) или осветлить (k > 1) цвет. */
export function shade(c: number, k: number) {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f(c >> 16) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}
