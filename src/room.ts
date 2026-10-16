// Мастерская фонарщика — комната-хаб между ночами.
// Задние стены идут вдоль верхних краёв (y = 0 и x = 0), передние края открыты, как в диораме.

import type { StationId } from './story';

export const RW = 10;
export const RH = 8;

export interface Station { id: StationId; x: number; y: number; w: number; h: number; npc: { x: number; y: number } }

/** Мебель жителей появляется, только когда житель переехал. */
export const STATIONS: Station[] = [
  { id: 'scope', x: 1, y: 0, w: 1, h: 1, npc: { x: 1.5, y: 1.6 } },
  { id: 'agata', x: 9, y: 2, w: 1, h: 2, npc: { x: 8.2, y: 3 } },
  { id: 'timofey', x: 9, y: 6, w: 1, h: 1, npc: { x: 8.2, y: 6.6 } },
  { id: 'nika', x: 4, y: 3, w: 2, h: 1, npc: { x: 5, y: 4.7 } },
  { id: 'seva', x: 0, y: 2, w: 1, h: 1, npc: { x: 1.4, y: 2.6 } },
  { id: 'filin', x: 3, y: 7, w: 1, h: 1, npc: { x: 3.5, y: 7.5 } },
  { id: 'mila', x: 6, y: 7, w: 2, h: 1, npc: { x: 7, y: 6.2 } },
];

/** Камин в углу, доска заказов на задней стене, дверь на левой. */
export const FIREPLACE = { x: 7, y: 0, w: 2, h: 1 };
export const BOARD = { x: 4.5, y: 0 };
export const DOOR = { y: 5.5 };
export const SPAWN = { x: 1.2, y: 5.5 };

export const stationCenter = (s: Station) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
