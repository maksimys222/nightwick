// Карта вылазки. Каждую ночь лес за домом другой — Гаситель путает тропы.
// Генератор по сиду: от привала (дом или костёр) извилистая тропа ведёт к потухшему маяку на краю леса;
// от неё ответвляются тропинки к полянам: дом жителя, тайники, грядки, маслобойня, пруды.

import type { ResidentId } from './story';

export const W = 60;
export const H = 60;

export const GRASS = 0;
export const PATH = 1;
export const WATER = 2;
export const STONE = 3;
export const SAND = 4;
/** Мост: вода, по которой можно ходить (на вылазках не встречается, остался для площади). */
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
/** Тайник в лесу: открыл — выбираешь один из трёх даров на эту ночь. */
export interface Chest { x: number; y: number; open: boolean }

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
  /** Привал (2×2): дом фонарщика или костёр с палаткой. Сюда возвращаются, чтобы закончить ночь. */
  home: { x: number; y: number } | null;
  /** Что стоит на привале. */
  camp: 'home' | 'fire';
  /** Где стоит игрок в начале ночи (у двери дома). */
  start: { x: number; y: number };
  /** Что за краем карты: лес вокруг или ещё и море на востоке. */
  edge: 'forest' | 'sea-east';
  /** Пруды с утками. */
  ponds: Pond[];
  /** Какой район в клетке (от него зависят цвета травы и деревьев). Можно и за краем карты. */
  biome: (x: number, y: number) => District;
  chests: Chest[];
  /** id маяка — цель вылазки. */
  goal: number;
  /** Клетки главной тропы — от привала к маяку (для «Звёздной карты»). */
  trail: { x: number; y: number }[];
}

/** Точка у двери дома (дверь — на передней левой стене). */
export const homeDoor = (h: { x: number; y: number }) => ({ x: h.x + 1, y: h.y + 2.2 });

export const DISTRICT_NAMES: Record<District, string> = {
  street: 'Опушка', village: 'Осенняя деревня', town: 'Старый город', coast: 'Побережье',
};
/** Порядок вылазок: маяк одной открывает дорогу в следующую. */
export const DISTRICTS: District[] = ['street', 'village', 'town', 'coast'];
export const DISTRICT_INFO: Record<District, string> = {
  street: 'Лес за домом. Обычные масляные фонари.',
  village: 'Золотая осень, пруды и болотные фонари.',
  town: 'Мостовые и прожорливые газовые фонари.',
  coast: 'Ветер с моря задувает упрямые фонари.',
};
/** Кто из жителей прячется в каком районе. */
export const RESIDENTS_IN: Record<District, ResidentId[]> = {
  street: ['timofey', 'nika'], village: ['agata', 'mila'], town: ['seva'], coast: ['filin'],
};
const BEACON_NAMES: Record<District, string> = {
  street: 'Маяк на опушке', village: 'Маяк деревни', town: 'Маяк на площади', coast: 'Старый маяк',
};

export function rng(seed: number) {
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
  if (w.edge === 'sea-east' && x >= w.w - 9) return SAND;
  return GRASS;
}

export interface RunOpts {
  /** Каких жителей ещё не нашли (их дом может оказаться в лесу). */
  unmet: ResidentId[];
}

export function makeRun(seed: number, biome: District, opts: RunOpts = { unmet: [] }): World {
  const rand = rng(seed * 7919 + DISTRICTS.indexOf(biome) * 104729);
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const ground = new Uint8Array(W * H);
  const block = new Uint8Array(W * H);
  /** 1 — тропа или поляна: деревья здесь не растут. */
  const clear = new Uint8Array(W * H);
  const idx = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;
  const coast = biome === 'coast', town = biome === 'town';
  const seaX = W - 7;

  // море и пляж на побережье
  if (coast) {
    for (let y = 0; y < H; y++) {
      const sea = seaX + 1.2 * Math.sin(y / 5), sand = seaX - 4 + Math.sin(y / 4);
      for (let x = 0; x < W; x++) {
        if (x >= sea) ground[idx(x, y)] = WATER;
        else if (x >= sand) ground[idx(x, y)] = SAND;
      }
    }
  }

  const clearDisc = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if (inside(x, y) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) clear[idx(x, y)] = 1;
  };
  const trailTile = town ? STONE : PATH;
  const lay = (x: number, y: number) => {
    if (!inside(x, y)) return;
    clear[idx(x, y)] = 1;
    const g = ground[idx(x, y)];
    if (g === GRASS) ground[idx(x, y)] = trailTile;
  };
  /** Тропа от a к b: короткие отрезки «лесенкой» с изгибами, а не прямая. */
  const trailBetween = (ax: number, ay: number, bx: number, by: number, out?: { x: number; y: number }[]) => {
    let x = ax, y = ay;
    let guard = 0;
    while ((x !== bx || y !== by) && guard++ < 400) {
      lay(x, y);
      out?.push({ x, y });
      const dx = bx - x, dy = by - y;
      // чаще шагаем по большей оси, иногда — по меньшей: получается живой изгиб
      const goX = dx !== 0 && (dy === 0 || rand() < Math.abs(dx) / (Math.abs(dx) + Math.abs(dy)) * 0.9 + 0.05);
      if (goX) x += Math.sign(dx); else y += Math.sign(dy);
    }
    lay(bx, by);
    out?.push({ x: bx, y: by });
    if (town) for (const p of out ?? []) for (const [i, j] of [[1, 0], [0, 1]]) lay(p.x + i, p.y + j); // в городе — широкие мостовые
  };

  // привал слева, маяк справа (на побережье — у моря)
  const home = { x: 3, y: ri(24, 34) };
  const start = { x: home.x + 1, y: home.y + 2.6 };
  const startTile = { x: home.x + 1, y: home.y + 3 };
  const goalPos = { x: coast ? seaX - 6 : W - 6, y: ri(14, H - 15) };
  clearDisc(home.x + 1, home.y + 1.5, 3.4);

  // главная тропа через 4 изгиба
  const trail: { x: number; y: number }[] = [];
  const pts = [startTile];
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    pts.push({ x: Math.round(startTile.x + (goalPos.x - startTile.x) * t), y: Math.max(6, Math.min(H - 7, Math.round(startTile.y + (goalPos.y - startTile.y) * t + (rand() - 0.5) * 22))) });
  }
  pts.push({ x: goalPos.x, y: goalPos.y + 2 });
  for (let i = 0; i < pts.length - 1; i++) trailBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, trail);
  // площадка у маяка
  clearDisc(goalPos.x + 0.5, goalPos.y + 0.5, 3.2);
  for (let y = goalPos.y - 2; y <= goalPos.y + 2; y++)
    for (let x = goalPos.x - 2; x <= goalPos.x + 2; x++)
      if (inside(x, y) && Math.hypot(x - goalPos.x, y - goalPos.y) <= 2.3 && ground[idx(x, y)] !== WATER) ground[idx(x, y)] = STONE;

  const used: { x: number; y: number; r: number }[] = [{ x: home.x + 1, y: home.y + 1, r: 5 }, { x: goalPos.x, y: goalPos.y, r: 5 }];
  const freeSpot = (x: number, y: number, r: number) =>
    x > 3 && y > 3 && x < (coast ? seaX - 5 : W - 4) && y < H - 4 && used.every((u) => Math.hypot(u.x - x, u.y - y) >= u.r + r);

  /** Поляна в стороне от тропы: ищем свободное место и ведём к нему тропинку. */
  const clearing = (r: number, minOff = 5, maxOff = 11) => {
    for (let tries = 0; tries < 60; tries++) {
      const from = trail[ri(4, trail.length - 6)];
      const a = rand() * Math.PI * 2, d = minOff + rand() * (maxOff - minOff);
      const x = Math.round(from.x + Math.cos(a) * d), y = Math.round(from.y + Math.sin(a) * d);
      if (!freeSpot(x, y, r)) continue;
      used.push({ x, y, r });
      clearDisc(x + 0.5, y + 0.5, r);
      trailBetween(from.x, from.y, x, y, []);
      return { x, y };
    }
    return null;
  };

  // фонари вдоль главной тропы — чуть в стороне, примерно через 6 клеток
  const lamps: Lamp[] = [];
  const kindFor = (): LampKind => {
    const r = rand();
    if (biome === 'village') return r < 0.25 ? 'marsh' : 'oil';
    if (town) return r < 0.6 ? 'gas' : 'oil';
    if (coast) return r < 0.6 ? 'stubborn' : 'oil';
    return 'oil';
  };
  const addLamp = (x: number, y: number, kind: LampKind, name?: string) => {
    if (!inside(x, y) || block[idx(x, y)] || ground[idx(x, y)] === WATER) return null;
    const l: Lamp = { id: lamps.length, x, y, kind, district: biome, name, oil: 0, lit: false, everLit: false, kindled: 0, gust: 0 };
    lamps.push(l);
    block[idx(x, y)] = 1;
    clearDisc(x + 0.5, y + 0.5, 1.6);
    return l;
  };
  const goal = addLamp(goalPos.x, goalPos.y, 'beacon', BEACON_NAMES[biome])!;
  const onTrail = new Set(trail.map((p) => p.x + ',' + p.y));
  for (let i = 7; i < trail.length - 6; i += ri(5, 8)) {
    const p = trail[i];
    // ставим рядом с тропой, не на неё
    for (const [dx, dy] of [[1, -1], [-1, 1], [1, 1], [-1, -1], [2, 0], [0, 2]]) {
      const x = p.x + dx, y = p.y + dy;
      if (onTrail.has(x + ',' + y)) continue;
      if (addLamp(x, y, kindFor())) break;
    }
  }

  const reserve = (x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { block[idx(i, j)] = 1; clear[idx(i, j)] = 1; }
  };
  reserve(home.x, home.y, 2, 2);

  const flowers: Flower[] = [];
  const patch = (fx: number, fy: number) => {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const x = fx + i, y = fy + j;
      if (!inside(x, y) || block[idx(x, y)] || ground[idx(x, y)] === WATER) return;
    }
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      flowers.push({ x: fx + i, y: fy + j, stage: 0, grow: 0 });
      clear[idx(fx + i, fy + j)] = 1;
      ground[idx(fx + i, fy + j)] = GRASS;
    }
  };
  // грядки у фонарей тропы (подсолнухи растут только в свете)
  for (const l of lamps) {
    if (l.kind === 'beacon' || rand() > 0.55) continue;
    const [dx, dy] = [[1, 1], [-2, 1], [1, -2], [-2, -2]][ri(0, 3)];
    patch(l.x + dx, l.y + dy);
  }

  // поляны: дом жителя, тайники, маслобойни, пруды, грядки с фонарём
  const houses: House[] = [];
  const rid = opts.unmet.find((r) => RESIDENTS_IN[biome].includes(r));
  if (rid) {
    const c = clearing(3.2, 6, 12);
    if (c) { reserve(c.x - 1, c.y - 1, 2, 2); houses.push({ x: c.x - 1, y: c.y - 1, rid }); addLamp(c.x + 2, c.y + 1, kindFor()); }
  }
  const chests: Chest[] = [];
  for (let i = 0; i < 3; i++) {
    const c = clearing(1.8, 6, 13);
    if (c) { reserve(c.x, c.y, 1, 1); chests.push({ x: c.x, y: c.y, open: false }); }
  }
  const presses: { x: number; y: number }[] = [];
  // маслобойня — недалеко от привала и ещё одна на середине пути
  for (const [lo, hi] of [[0.15, 0.3], [0.5, 0.65]]) {
    const p = trail[Math.floor(trail.length * (lo + rand() * (hi - lo)))];
    for (const [dx, dy] of [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 2]]) {
      const x = p.x + dx, y = p.y + dy;
      if (!inside(x, y) || block[idx(x, y)] || onTrail.has(x + ',' + y)) continue;
      reserve(x, y, 1, 1);
      presses.push({ x, y });
      clearDisc(x + 0.5, y + 0.5, 1.5);
      break;
    }
  }
  for (let i = 0; i < 2; i++) {
    const c = clearing(3, 5, 10);
    if (!c) continue;
    const l = addLamp(c.x, c.y, kindFor());
    if (l) { patch(c.x + 1, c.y + 1); patch(c.x - 2, c.y - 1); }
  }
  const ponds: Pond[] = [];
  for (let i = 0; i < (biome === 'village' ? 3 : biome === 'coast' ? 1 : 2); i++) {
    const c = clearing(4, 6, 12);
    if (!c) continue;
    const r = 2 + rand() * 0.8;
    ponds.push({ x: c.x + 0.5, y: c.y + 0.5, r });
    for (let j = -4; j <= 4; j++)
      for (let i2 = -4; i2 <= 4; i2++) {
        const x = c.x + i2, y = c.y + j;
        const wob = 0.35 * Math.sin((i2 + j) * 1.7 + c.x);
        if (inside(x, y) && !block[idx(x, y)] && Math.hypot(i2, j * 1.1) <= r + wob) ground[idx(x, y)] = WATER;
      }
    // в деревне у пруда — болотный фонарь
    if (biome === 'village') addLamp(c.x + Math.ceil(r) + 1, c.y, 'marsh');
  }

  // лес: всё, что не тропа и не поляна, — густой лес; у троп — редкие деревья, по краю карты — сплошняком
  const trees: Tree[] = [];
  const near = (x: number, y: number, r: number) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const xx = x + i, yy = y + j;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && clear[idx(xx, yy)]) return true;
    }
    return false;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (ground[i] !== GRASS || clear[i] || block[i]) continue;
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y) < 2;
      const chance = edge ? 1 : near(x, y, 1) ? (town ? 0.12 : 0.3) : town ? 0.45 : 0.82;
      if (rand() < chance) { trees.push({ x, y, v: rand() }); block[i] = 1; }
    }
  }
  for (let i = 0; i < W * H; i++) if (ground[i] === WATER) block[i] = 1;

  return {
    w: W, h: H, ground, block, trees, lamps, flowers, houses, presses, home, camp: biome === 'street' ? 'home' : 'fire',
    start, edge: coast ? 'sea-east' : 'forest', ponds, biome: () => biome, chests, goal: goal.id, trail,
  };
}
