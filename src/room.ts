// Мастерская фонарщика — комната-хаб между ночами.
// Задние стены идут вдоль верхних краёв (y = 0 и x = 0), передние края открыты, как в диораме.

import type { StationId } from './story';

export const RW = 12;
export const RH = 10;

export interface Station { id: StationId; x: number; y: number; w: number; h: number; npc: { x: number; y: number } }

/** Мебель жителей появляется, только когда житель переехал. */
export const STATIONS: Station[] = [
  { id: 'scope', x: 1, y: 0, w: 1, h: 1, npc: { x: 1.5, y: 1.6 } },
  { id: 'agata', x: 11, y: 3, w: 1, h: 2, npc: { x: 10.2, y: 4 } },
  { id: 'timofey', x: 11, y: 7, w: 1, h: 1, npc: { x: 10.2, y: 7.6 } },
  { id: 'nika', x: 5, y: 4, w: 2, h: 1, npc: { x: 6, y: 5.7 } },
  { id: 'seva', x: 0, y: 2, w: 1, h: 1, npc: { x: 1.4, y: 2.6 } },
  { id: 'filin', x: 3, y: 9, w: 1, h: 1, npc: { x: 3.5, y: 9.5 } },
  { id: 'mila', x: 7, y: 9, w: 2, h: 1, npc: { x: 8, y: 8.2 } },
];

/** Простая мебель — стоит всегда, через неё не пройти. */
export type DecorKind = 'bookshelf' | 'armchair' | 'woodpile' | 'workbench' | 'crates' | 'coatrack' | 'table' | 'plant';
export const DECOR: { kind: DecorKind; x: number; y: number; w: number; h: number }[] = [
  { kind: 'bookshelf', x: 3, y: 0, w: 2, h: 1 },
  { kind: 'woodpile', x: 11, y: 0, w: 1, h: 1 },
  { kind: 'armchair', x: 10, y: 2, w: 1, h: 1 },
  { kind: 'workbench', x: 0, y: 4, w: 1, h: 1 },
  { kind: 'coatrack', x: 0, y: 8, w: 1, h: 1 },
  { kind: 'table', x: 2, y: 6, w: 1, h: 1 },
  { kind: 'crates', x: 11, y: 9, w: 1, h: 1 },
  { kind: 'plant', x: 0, y: 0, w: 1, h: 1 },
  { kind: 'plant', x: 5, y: 0, w: 1, h: 1 },
  { kind: 'plant', x: 1, y: 9, w: 1, h: 1 },
];

/** Камин у задней стены, доска заказов на задней стене, дверь на левой. */
export const FIREPLACE = { x: 8, y: 0, w: 2, h: 1 };
export const BOARD = { x: 6.2, y: 0 };
export const DOOR = { y: 6.5 };
export const SPAWN = { x: 1.2, y: 6.5 };
/** Где спит кошка (просто картинка, не мешает ходить). */
export const CAT = { x: 8.6, y: 1.9 };

export const stationCenter = (s: Station) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
