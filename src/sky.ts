// Звёздное небо — древо улучшений. Гаситель погасил и звёзды; фонарщик зажигает их Светом.
// Здесь только данные: какие звёзды есть, где стоят и с кем связаны. Правила — в game.ts.
//
// В центре — Искра. Вокруг — кольцо «Фонарь» (свои улучшения фонарщика, открыто сразу).
// Дальше шесть созвездий, по одному на жителя: ветка открывается, когда житель переехал в мастерскую.
// Зажечь можно только звезду рядом с уже горящей.

import type { ResidentId } from './story';

/** Что улучшает звезда. Числа — «уровни», как у старых улучшений (0.5 — полуровня). */
export type Stat =
  | 'tank' | 'lens' | 'can' | 'boots'
  | 'fert' | 'seeds' | 'press'
  | 'ladder' | 'lampTank' | 'wick'
  | 'rumor' | 'fame'
  | 'vision' | 'glass';

/** Особые звёзды: меняют правила, а не цифры. */
export type Key = 'loud' | 'brotherhood' | 'sunbeds' | 'fed' | 'calm' | 'trails';

export type Branch = 'core' | ResidentId;
export type Size = 'center' | 'small' | 'big' | 'key';

export interface Star {
  id: string;
  x: number; y: number;
  size: Size;
  branch: Branch;
  name: string;
  stats: Partial<Record<Stat, number>>;
  key?: Key;
  links: string[];
  /** Расстояние от центра — от него зависит цена. */
  dist: number;
}

export const STAT_NAMES: Record<Stat, string> = {
  tank: 'Долгая ночь', lens: 'Ясный взгляд', can: 'Полный бидон', boots: 'Лёгкий шаг',
  fert: 'Тёплая земля', seeds: 'Крупное зерно', press: 'Тугой ворот',
  ladder: 'Ловкие руки', lampTank: 'Глубокий бак', wick: 'Тонкий фитиль',
  rumor: 'Добрая весть', fame: 'Слава фонарщика',
  vision: 'Совиный глаз', glass: 'Чистое стекло',
};

const pct = (v: number) => Math.round(v * 100);
const num = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

/** Что даёт a уровней улучшения — словами (формулы те же, что в game.ts). */
export const STAT_TEXT: Record<Stat, (a: number) => string> = {
  tank: (a) => `Ночь длиннее на ${num(10 * a)} с`,
  lens: (a) => `Ручной фонарь светит дальше (+${num(0.5 * a)} клетки)`,
  can: (a) => `+${num(8 * a)} масла с собой в ночь`,
  boots: (a) => `Ходишь на ${pct(0.12 * a)}% быстрее`,
  fert: (a) => `Подсолнухи растут на ${pct(Math.pow(1.4, a) - 1)}% быстрее`,
  seeds: (a) => `+${num(a)} семечко с каждого подсолнуха`,
  press: (a) => `Маслобойня даёт на ${pct(0.1 * a)}% больше масла`,
  ladder: (a) => `Зажигаешь и подливаешь на ${pct(1 - Math.pow(0.75, a))}% быстрее`,
  lampTank: (a) => `В уличный фонарь влезает на ${pct(0.5 * a)}% больше масла`,
  wick: (a) => `Фонари тратят на ${pct(1 - Math.pow(0.8, a))}% меньше масла`,
  rumor: (a) => `Фонари дают на ${pct(0.25 * a)}% больше Света`,
  fame: (a) => `Больше Света за первый огонь фонаря (+${num(a)})`,
  vision: (a) => `Тьма вокруг светлее на ${pct(0.08 * a)}%`,
  glass: (a) => `Уличные фонари светят шире (+${num(0.4 * a)} клетки)`,
};

export const KEYS: Record<Key, { name: string; text: string }> = {
  loud: { name: 'Громкая молва', text: 'За первый огонь каждого фонаря — вдвое больше Света' },
  brotherhood: { name: 'Братство огней', text: 'Фонарь тратит на 40% меньше масла, если рядом горит другой' },
  sunbeds: { name: 'Солнечные грядки', text: 'Подсолнухи у горящих фонарей растут вдвое быстрее' },
  fed: { name: 'Сытые помощники', text: 'Подносчики ходят на 50% быстрее' },
  calm: { name: 'Тихая ночь', text: 'Ветер больше не задувает упрямые фонари' },
  trails: { name: 'Короткие тропы', text: 'По дорогам и мостовым ходишь на 25% быстрее' },
};

/** Созвездия: собери целиком — получишь +5% Света и картинку на небе. */
export const CONSTELLATIONS: Record<Branch, { name: string; color: number }> = {
  core: { name: 'Фонарь', color: 0xffd27a },
  seva: { name: 'Конверт', color: 0x9ad0ff },
  timofey: { name: 'Наковальня', color: 0xff9a5a },
  agata: { name: 'Подсолнух', color: 0xffe14a },
  mila: { name: 'Каравай', color: 0xffb0c8 },
  filin: { name: 'Сова', color: 0xb8a0ff },
  nika: { name: 'Бумажный змей', color: 0x8affc8 },
};
export const CONSTELLATION_BONUS = 0.05;

// ---------- раскладка ----------

type S = Partial<Record<Stat, number>>;
/** Места звёзд в ветке: расстояние от центра вдоль луча и сдвиг вбок. */
const SLOTS = {
  G: { d: 165, o: 0, size: 'small' },
  A1: { d: 220, o: -42, size: 'small' }, A2: { d: 275, o: -56, size: 'small' }, A3: { d: 330, o: -50, size: 'big' },
  B1: { d: 220, o: 42, size: 'small' }, B2: { d: 275, o: 56, size: 'small' }, B3: { d: 330, o: 50, size: 'big' },
  M: { d: 255, o: 0, size: 'small' },
  C1: { d: 385, o: -30, size: 'small' }, C2: { d: 385, o: 30, size: 'small' },
  K: { d: 440, o: 0, size: 'key' },
  T1: { d: 500, o: -42, size: 'small' }, T2: { d: 500, o: 42, size: 'small' },
  F: { d: 560, o: 0, size: 'big' },
} as const;
type Slot = keyof typeof SLOTS;

const EDGES: [Slot, Slot][] = [
  ['G', 'A1'], ['G', 'B1'], ['A1', 'A2'], ['A2', 'A3'], ['B1', 'B2'], ['B2', 'B3'],
  ['A1', 'M'], ['B1', 'M'], ['A3', 'C1'], ['B3', 'C2'], ['C1', 'C2'],
  ['C1', 'K'], ['C2', 'K'], ['K', 'T1'], ['K', 'T2'], ['T1', 'F'], ['T2', 'F'],
];

interface BranchSpec { id: ResidentId; angle: number; slots: Record<Exclude<Slot, 'K'>, S>; key: Key; owner: string }

/** Шесть созвездий по кругу (угол — куда смотрит луч, 0° — вправо, −90° — вверх). */
const BRANCHES: BranchSpec[] = [
  {
    id: 'seva', angle: -90, key: 'loud', owner: 'Севы',
    slots: {
      G: { rumor: 0.5 }, A1: { rumor: 0.5 }, A2: { rumor: 0.5 }, A3: { rumor: 1 }, B1: { fame: 0.5 }, B2: { fame: 0.5 }, B3: { fame: 1 },
      M: { can: 0.5 }, C1: { rumor: 0.5 }, C2: { fame: 0.5 }, T1: { rumor: 0.5 }, T2: { can: 0.5 }, F: { rumor: 1 },
    },
  },
  {
    id: 'timofey', angle: -30, key: 'brotherhood', owner: 'Тимофея',
    slots: {
      G: { lampTank: 0.5 }, A1: { lampTank: 0.5 }, A2: { lampTank: 0.5 }, A3: { lampTank: 1 }, B1: { wick: 0.5 }, B2: { wick: 0.5 }, B3: { wick: 1 },
      M: { ladder: 0.5 }, C1: { ladder: 0.5 }, C2: { wick: 0.5 }, T1: { lampTank: 0.5 }, T2: { ladder: 0.5 }, F: { wick: 1 },
    },
  },
  {
    id: 'agata', angle: 30, key: 'sunbeds', owner: 'Агаты',
    slots: {
      G: { fert: 0.5 }, A1: { fert: 0.5 }, A2: { fert: 0.5 }, A3: { fert: 1 }, B1: { press: 0.5 }, B2: { press: 0.5 }, B3: { seeds: 1 },
      M: { can: 0.5 }, C1: { fert: 0.5 }, C2: { press: 0.5 }, T1: { press: 0.5 }, T2: { fert: 0.5 }, F: { seeds: 1 },
    },
  },
  {
    id: 'mila', angle: 90, key: 'fed', owner: 'Милы',
    slots: {
      G: { press: 0.5 }, A1: { press: 0.5 }, A2: { can: 0.5 }, A3: { press: 1 }, B1: { ladder: 0.5 }, B2: { ladder: 0.5 }, B3: { can: 1 },
      M: { boots: 0.5 }, C1: { press: 0.5 }, C2: { ladder: 0.5 }, T1: { can: 0.5 }, T2: { press: 0.5 }, F: { seeds: 1 },
    },
  },
  {
    id: 'filin', angle: 150, key: 'calm', owner: 'Филина',
    slots: {
      G: { vision: 0.5 }, A1: { vision: 0.5 }, A2: { vision: 0.5 }, A3: { vision: 1 }, B1: { glass: 0.5 }, B2: { glass: 0.5 }, B3: { glass: 1 },
      M: { lens: 0.5 }, C1: { lens: 0.5 }, C2: { glass: 0.5 }, T1: { vision: 0.5 }, T2: { lens: 0.5 }, F: { glass: 1 },
    },
  },
  {
    id: 'nika', angle: 210, key: 'trails', owner: 'Ники',
    slots: {
      G: { boots: 0.5 }, A1: { boots: 0.5 }, A2: { tank: 0.5 }, A3: { tank: 1 }, B1: { boots: 0.5 }, B2: { tank: 0.5 }, B3: { boots: 0.5, tank: 0.5 },
      M: { lens: 0.5 }, C1: { tank: 0.5 }, C2: { boots: 0.5 }, T1: { tank: 0.5 }, T2: { can: 0.5 }, F: { tank: 1 },
    },
  },
];

/** Кольцо «Фонарь» вокруг Искры — своё снаряжение фонарщика. */
const CORE: S[] = [
  { tank: 0.5 }, { lens: 0.5 }, { can: 0.5 }, { boots: 0.5 },
  { tank: 0.5 }, { lens: 0.5 }, { can: 0.5 }, { boots: 0.5 },
];
const CORE_R = 90;

/** Название звезды по тому, что она даёт. */
function nameOf(stats: S, size: Size) {
  const first = Object.keys(stats)[0] as Stat;
  const n = STAT_NAMES[first];
  return size === 'big' ? `${n} — яркая` : n;
}

function build(): Star[] {
  const stars: Star[] = [];
  const add = (s: Omit<Star, 'links' | 'dist'>) => {
    const star = { ...s, links: [], dist: Math.hypot(s.x, s.y) };
    stars.push(star);
    return star;
  };
  const link = (a: string, b: string) => {
    const A = stars.find((s) => s.id === a)!, B = stars.find((s) => s.id === b)!;
    A.links.push(b);
    B.links.push(a);
  };

  add({ id: 'center', x: 0, y: 0, size: 'center', branch: 'core', name: 'Искра', stats: {} });
  CORE.forEach((stats, i) => {
    const a = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
    add({ id: `core${i}`, x: Math.cos(a) * CORE_R, y: Math.sin(a) * CORE_R, size: 'small', branch: 'core', name: nameOf(stats, 'small'), stats });
    link('center', `core${i}`);
  });
  for (let i = 0; i < CORE.length; i++) link(`core${i}`, `core${(i + 1) % CORE.length}`);

  for (const b of BRANCHES) {
    const a = (b.angle * Math.PI) / 180;
    const ax = Math.cos(a), ay = Math.sin(a), px = -ay, py = ax;
    for (const [slot, pos] of Object.entries(SLOTS) as [Slot, (typeof SLOTS)[Slot]][]) {
      const id = `${b.id}-${slot}`;
      const x = ax * pos.d + px * pos.o, y = ay * pos.d + py * pos.o;
      if (slot === 'K') add({ id, x, y, size: 'key', branch: b.id, name: KEYS[b.key].name, stats: {}, key: b.key });
      else {
        const stats = b.slots[slot];
        const name = slot === 'F' ? `Звезда ${b.owner}` : nameOf(stats, pos.size);
        add({ id, x, y, size: pos.size, branch: b.id, name, stats });
      }
    }
    for (const [p, q] of EDGES) link(`${b.id}-${p}`, `${b.id}-${q}`);
    // вход в созвездие — от двух ближайших звёзд кольца «Фонарь»
    const near = stars
      .filter((s) => s.id.startsWith('core'))
      .sort((s1, s2) => Math.hypot(s1.x - ax * CORE_R, s1.y - ay * CORE_R) - Math.hypot(s2.x - ax * CORE_R, s2.y - ay * CORE_R))
      .slice(0, 2);
    for (const s of near) link(s.id, `${b.id}-G`);
  }

  // мостики между соседними созвездиями: двойные звёзды (по полуровня от каждого соседа).
  // Мостик принадлежит созвездию слева — откроется вместе с ним.
  BRANCHES.forEach((b, i) => {
    const n = BRANCHES[(i + 1) % BRANCHES.length];
    const a = (((b.angle + 30) * Math.PI) / 180);
    const sa = b.slots.A1, sb = n.slots.A1;
    const stats: S = { ...sa };
    for (const [k, v] of Object.entries(sb) as [Stat, number][]) stats[k] = (stats[k] ?? 0) + v;
    const id = `bridge${i}`;
    add({ id, x: Math.cos(a) * 300, y: Math.sin(a) * 300, size: 'small', branch: b.id, name: 'Двойная звезда', stats });
    link(id, `${b.id}-B2`);
    link(id, `${n.id}-A2`);
  });
  return stars;
}

export const STARS = build();
export const starById = (id: string) => STARS.find((s) => s.id === id)!;
