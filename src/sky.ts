// Звёздное небо — древо улучшений. Гаситель погасил и звёзды; фонарщик зажигает их Светом.
// Здесь только данные: какие звёзды есть, что дают, где стоят и с кем связаны. Правила — в game.ts.
//
// Каждая звезда — своя: своё имя и свой эффект, повторов нет.
// В центре — Искра. Вокруг — кольцо «Фонарь» (снаряжение фонарщика, открыто сразу).
// Дальше шесть созвездий, по одному на жителя: ветка открывается, когда житель переехал в мастерскую.
// Зажечь можно только звезду рядом с уже горящей.

import type { ResidentId } from './story';

/** Цифры, которые улучшают звёзды («уровни», как были у старых улучшений). */
export type Stat =
  | 'tank' | 'lens' | 'can' | 'boots'
  | 'fert' | 'seeds' | 'press'
  | 'ladder' | 'lampTank' | 'wick'
  | 'rumor' | 'fame'
  | 'vision' | 'glass';

/** Эффект звезды. У каждой звезды — свой. */
export type Fx =
  // «Фонарь»
  | 'tank' | 'lens' | 'can' | 'boots' | 'spare' | 'coat' | 'tinder' | 'grip'
  // Сева — «Конверт»
  | 'rumor' | 'fame' | 'news' | 'reward' | 'chain' | 'mail' | 'loud' | 'gasplus' | 'gascheap'
  // Тимофей — «Наковальня»
  | 'wick' | 'lampTank' | 'ladder' | 'funnel' | 'freeoil' | 'flint' | 'brotherhood' | 'beaconcheap' | 'water'
  // Агата — «Подсолнух»
  | 'fert' | 'seeds' | 'press' | 'regrow' | 'sprouts' | 'honey' | 'sunbeds' | 'double' | 'pie'
  // Мила — «Каравай»
  | 'bread' | 'pin' | 'oven' | 'crumbs' | 'fullpour' | 'tea' | 'fed' | 'extrahelper' | 'snack'
  // Филин — «Сова»
  | 'vision' | 'glass' | 'reveal' | 'marshwide' | 'ear' | 'ripe' | 'calm' | 'beaconwide' | 'starmap'
  // Ника — «Бумажный змей»
  | 'sprint' | 'kite' | 'chalk' | 'moth' | 'rhyme' | 'homejump' | 'trails' | 'peek' | 'letters';

export interface FxInfo { name: string; text: string; stats?: Partial<Record<Stat, number>> }

export const FX: Record<Fx, FxInfo> = {
  tank: { name: 'Бак побольше', text: '+20 огня в ручном фонаре — хватит на путь длиннее', stats: { tank: 2 } },
  lens: { name: 'Линза', text: 'Ручной фонарь светит дальше на клетку', stats: { lens: 2 } },
  can: { name: 'Бидон', text: '+12 масла с собой в ночь', stats: { can: 1.5 } },
  boots: { name: 'Сапоги', text: 'Ходишь на 18% быстрее', stats: { boots: 1.5 } },
  spare: { name: 'Запасной фитиль', text: 'Когда огонь кончается, фонарь тлеет ещё 8 (раз за ночь)' },
  coat: { name: 'Тёплая куртка', text: 'Когда огня меньше 15, ходишь на 25% быстрее' },
  tinder: { name: 'Огниво', text: 'Первый фонарь за ночь зажигается без масла' },
  grip: { name: 'Крепкая хватка', text: 'Если фонарь погас в пути, теряешь треть Света, а не половину' },

  rumor: { name: 'Добрая весть', text: 'Фонари дают на 30% больше Света', stats: { rumor: 1.2 } },
  fame: { name: 'Слава фонарщика', text: 'Больше Света за первый огонь каждого фонаря', stats: { fame: 2 } },
  news: { name: 'Утренние новости', text: 'Ночь начинается с 5 Света в фонаре' },
  reward: { name: 'Тёплое слово', text: 'Награды за заказы на 25% больше' },
  chain: { name: 'Сарафанное радио', text: 'Каждый пятый фонарь за ночь — ещё +10 Света' },
  mail: { name: 'Письмо домой', text: 'Зажжённый маяк даёт на 20% больше Света' },
  loud: { name: 'Громкая молва', text: 'За первый огонь каждого фонаря — вдвое больше Света' },
  gasplus: { name: 'Звезда Севы', text: 'Газовые фонари дают в полтора раза больше Света' },
  gascheap: { name: 'Весточка кузнецу', text: 'Газовый фонарь зажигается за 15 масла вместо 20' },

  wick: { name: 'Тонкий фитиль', text: 'Фонари тратят на 25% меньше масла', stats: { wick: 1.3 } },
  lampTank: { name: 'Глубокий бак', text: 'В уличный фонарь влезает на 60% больше масла', stats: { lampTank: 1.2 } },
  ladder: { name: 'Ловкие руки', text: 'Зажигаешь и подливаешь на 35% быстрее', stats: { ladder: 1.5 } },
  funnel: { name: 'Широкая воронка', text: 'За раз подливаешь вдвое больше масла' },
  freeoil: { name: 'Запас в колпаке', text: 'Только что зажжённый фонарь получает +5 масла бесплатно' },
  flint: { name: 'Кремень', text: 'Упрямый фонарь зажигается за один шаг' },
  brotherhood: { name: 'Братство огней', text: 'Фонарь тратит на 40% меньше масла, если рядом горит другой' },
  beaconcheap: { name: 'Звезда Тимофея', text: 'Маяк зажигается за 8 масла вместо 15' },
  water: { name: 'Железная лейка', text: 'Когда зажигаешь фонарь, подсолнухи рядом сразу подрастают' },

  fert: { name: 'Тёплая земля', text: 'Подсолнухи растут на 50% быстрее', stats: { fert: 1.2 } },
  seeds: { name: 'Крупное зерно', text: '+1 семечко с каждого подсолнуха', stats: { seeds: 1 } },
  press: { name: 'Тугой ворот', text: 'Маслобойня даёт на 30% больше масла', stats: { press: 3 } },
  regrow: { name: 'Бабушкин секрет', text: 'Сорванный подсолнух отрастает вдвое быстрее' },
  sprouts: { name: 'Ранние всходы', text: 'В начале ночи подсолнухи уже проросли' },
  honey: { name: 'Подсолнечный мёд', text: 'Маслобойня даёт ещё 1 Свет за каждые 4 семечка' },
  sunbeds: { name: 'Солнечные грядки', text: 'Подсолнухи у горящих фонарей растут вдвое быстрее' },
  double: { name: 'Звезда Агаты', text: 'Каждый четвёртый подсолнух даёт вдвое больше семечек' },
  pie: { name: 'Пирожок с семечками', text: 'Маслобойня каждый раз даёт +2 масла сверху' },

  bread: { name: 'Утренняя выпечка', text: '+2 масла с собой за каждого жителя в мастерской' },
  pin: { name: 'Скалка', text: 'На маслобойне золотая зона шире на треть' },
  oven: { name: 'Тёплая печь', text: 'Привал светится шире — тени держатся дальше' },
  crumbs: { name: 'Хлебные крошки', text: 'Белая стрелка к привалу видна всю ночь' },
  fullpour: { name: 'Щедрые руки', text: 'Подносчики заливают фонари до полного' },
  tea: { name: 'Чай у ворота', text: 'Возле маслобойни ручной фонарь тратится вдвое медленнее' },
  fed: { name: 'Сытые помощники', text: 'Подносчики ходят на 50% быстрее' },
  extrahelper: { name: 'Звезда Милы', text: 'Ещё один подносчик каждую ночь — бесплатно' },
  snack: { name: 'Ночной перекус', text: 'Каждые 3 сорванных подсолнуха — +3 огня' },

  vision: { name: 'Совиный глаз', text: 'Тьма вокруг светлее на 16%', stats: { vision: 2 } },
  glass: { name: 'Чистое стекло', text: 'Уличные фонари светят шире почти на клетку', stats: { glass: 2 } },
  reveal: { name: 'Ночное зрение', text: 'Вокруг тебя туман рассеивается на клетку дальше' },
  marshwide: { name: 'Лунный блик', text: 'Болотные фонари светят вдвое шире' },
  ear: { name: 'Совиный слух', text: 'Если рядом (до 12 клеток) дом жителя — появится розовая стрелка' },
  ripe: { name: 'Зоркость', text: 'Зелёная стрелка показывает на ближайший спелый подсолнух' },
  calm: { name: 'Тихая ночь', text: 'Ветер больше не задувает упрямые фонари' },
  beaconwide: { name: 'Звезда Филина', text: 'Маяки светят в полтора раза шире' },
  starmap: { name: 'Звёздная карта', text: 'В начале ночи видна вся тропа до маяка' },

  sprint: { name: 'Рывок', text: 'Первые 10 огня бежишь вдвое быстрее' },
  kite: { name: 'Змей в небе', text: '+3 огня за каждого жителя в мастерской' },
  chalk: { name: 'Цветные мелки', text: 'Первый фонарь каждого вида за ночь — ещё +5 Света' },
  moth: { name: 'Мотылёк', text: 'Искра светит вдвое ярче' },
  rhyme: { name: 'Считалочка', text: 'Каждый четвёртый зажжённый фонарь — +5 огня' },
  homejump: { name: 'Бумажный самолётик', text: 'От любого горящего фонаря можно улететь домой — весь Свет цел' },
  trails: { name: 'Короткие тропы', text: 'По дорогам и мостовым ходишь на 25% быстрее' },
  peek: { name: 'Звезда Ники', text: 'В начале ночи видно три ближайших тёмных фонаря' },
  letters: { name: 'Детские письма', text: 'Каждый найденный житель — сразу +20 Света' },
};

export type Branch = 'core' | ResidentId;
export type Size = 'center' | 'small' | 'big' | 'key';

export interface Star {
  id: string;
  x: number; y: number;
  size: Size;
  branch: Branch;
  fx: Fx | null;
  links: string[];
  /** Расстояние от центра — от него зависит цена. */
  dist: number;
}

/** Созвездия: собери целиком — получишь +5% Света. */
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

export const starName = (s: Star) => (s.fx ? FX[s.fx].name : 'Искра');

// ---------- раскладка ----------

/** Места звёзд в созвездии: расстояние от центра вдоль луча и сдвиг вбок. */
const SLOTS = {
  G: { d: 165, o: 0, size: 'small' },
  A1: { d: 225, o: -46, size: 'small' }, B1: { d: 225, o: 46, size: 'small' },
  M: { d: 262, o: 0, size: 'small' },
  A2: { d: 300, o: -58, size: 'small' }, B2: { d: 300, o: 58, size: 'small' },
  K: { d: 360, o: 0, size: 'key' },
  F: { d: 432, o: 0, size: 'big' },
} as const;
type Slot = keyof typeof SLOTS;

const EDGES: [Slot, Slot][] = [
  ['G', 'A1'], ['G', 'B1'], ['A1', 'M'], ['B1', 'M'], ['A1', 'A2'], ['B1', 'B2'], ['A2', 'K'], ['B2', 'K'], ['K', 'F'],
];

interface BranchSpec { id: ResidentId; angle: number; slots: Record<Slot, Fx>; bridge: Fx }

/** Шесть созвездий по кругу (угол — куда смотрит луч, −90° — вверх). bridge — двойная звезда к следующему. */
const BRANCHES: BranchSpec[] = [
  { id: 'seva', angle: -90, bridge: 'gascheap',
    slots: { G: 'rumor', A1: 'fame', B1: 'news', M: 'reward', A2: 'chain', B2: 'mail', K: 'loud', F: 'gasplus' } },
  { id: 'timofey', angle: -30, bridge: 'water',
    slots: { G: 'wick', A1: 'lampTank', B1: 'ladder', M: 'funnel', A2: 'freeoil', B2: 'flint', K: 'brotherhood', F: 'beaconcheap' } },
  { id: 'agata', angle: 30, bridge: 'pie',
    slots: { G: 'fert', A1: 'seeds', B1: 'press', M: 'regrow', A2: 'sprouts', B2: 'honey', K: 'sunbeds', F: 'double' } },
  { id: 'mila', angle: 90, bridge: 'snack',
    slots: { G: 'bread', A1: 'pin', B1: 'oven', M: 'crumbs', A2: 'fullpour', B2: 'tea', K: 'fed', F: 'extrahelper' } },
  { id: 'filin', angle: 150, bridge: 'starmap',
    slots: { G: 'vision', A1: 'glass', B1: 'reveal', M: 'marshwide', A2: 'ear', B2: 'ripe', K: 'calm', F: 'beaconwide' } },
  { id: 'nika', angle: 210, bridge: 'letters',
    slots: { G: 'sprint', A1: 'kite', B1: 'chalk', M: 'moth', A2: 'rhyme', B2: 'homejump', K: 'trails', F: 'peek' } },
];

/** Кольцо «Фонарь» вокруг Искры — снаряжение фонарщика. */
const CORE: Fx[] = ['tank', 'lens', 'can', 'boots', 'spare', 'coat', 'tinder', 'grip'];
const CORE_R = 90;

function build(): Star[] {
  const stars: Star[] = [];
  const add = (s: Omit<Star, 'links' | 'dist'>) => { stars.push({ ...s, links: [], dist: Math.hypot(s.x, s.y) }); };
  const link = (a: string, b: string) => {
    stars.find((s) => s.id === a)!.links.push(b);
    stars.find((s) => s.id === b)!.links.push(a);
  };

  add({ id: 'center', x: 0, y: 0, size: 'center', branch: 'core', fx: null });
  CORE.forEach((fx, i) => {
    const a = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
    add({ id: `core${i}`, x: Math.cos(a) * CORE_R, y: Math.sin(a) * CORE_R, size: 'small', branch: 'core', fx });
    link('center', `core${i}`);
  });
  for (let i = 0; i < CORE.length; i++) link(`core${i}`, `core${(i + 1) % CORE.length}`);

  for (const b of BRANCHES) {
    const a = (b.angle * Math.PI) / 180;
    const ax = Math.cos(a), ay = Math.sin(a), px = -ay, py = ax;
    for (const [slot, pos] of Object.entries(SLOTS) as [Slot, (typeof SLOTS)[Slot]][]) {
      add({ id: `${b.id}-${slot}`, x: ax * pos.d + px * pos.o, y: ay * pos.d + py * pos.o, size: pos.size, branch: b.id, fx: b.slots[slot] });
    }
    for (const [p, q] of EDGES) link(`${b.id}-${p}`, `${b.id}-${q}`);
    // вход в созвездие — от двух ближайших звёзд кольца «Фонарь»
    const near = stars
      .filter((s) => s.id.startsWith('core'))
      .sort((s1, s2) => Math.hypot(s1.x - ax * CORE_R, s1.y - ay * CORE_R) - Math.hypot(s2.x - ax * CORE_R, s2.y - ay * CORE_R))
      .slice(0, 2);
    for (const s of near) link(s.id, `${b.id}-G`);
  }

  // двойные звёзды между соседними созвездиями (принадлежат левому — открываются вместе с ним)
  BRANCHES.forEach((b, i) => {
    const n = BRANCHES[(i + 1) % BRANCHES.length];
    const a = ((b.angle + 30) * Math.PI) / 180;
    const id = `bridge${i}`;
    add({ id, x: Math.cos(a) * 335, y: Math.sin(a) * 335, size: 'small', branch: b.id, fx: b.bridge });
    link(id, `${b.id}-B2`);
    link(id, `${n.id}-A2`);
  });
  return stars;
}

export const STARS = build();
export const starById = (id: string) => STARS.find((s) => s.id === id)!;
