// Состояние и правила игры. Здесь нет рисования — только цифры и логика.
//
// Цикл: мастерская → ночная смена (пока горит ручной фонарь) → снова мастерская.
// Свет, улучшения, жители и заказы остаются навсегда; фонари, масло и урожай — только на одну ночь.

import { W, H, BRIDGE, PATH, STONE, makeWorld, homeDoor, riverX, type Lamp, type LampKind, type Flower, type House } from './map';
import { screenDirToTile } from './iso';
import { RW, RH, STATIONS, FIREPLACE, BOARD, DOOR, SPAWN, stationCenter, type Station } from './room';
import {
  RESIDENTS, QUESTS, SPARK, SPARK_HOME, SPARK_TIPS, NOTES, ENDING, JOURNAL, residentById, type PageId,
  type ResidentId, type StationId, type NightStats, type Line, type Quest,
} from './story';
import * as sfx from './audio';
import { STARS, CONSTELLATIONS, CONSTELLATION_BONUS, starById, type Stat, type Key, type Star, type Branch } from './sky';

export const world = makeWorld();

// ---------- улучшения ----------

export type UpId = 'bridge' | 'map' | 'compass' | 'helper' | 'autopress';

export interface Upgrade {
  id: UpId; station: StationId; name: string; desc: string;
  base: number; mult: number; max: number;
  lock?: () => string | null;
}

/** Особые вещи у жителей. Всё, что просто «прибавляет цифры», — на звёздном небе (sky.ts). */
export const UPGRADES: Upgrade[] = [
  { id: 'bridge', station: 'timofey', name: 'Починить мост', desc: 'Тимофей починит мост через реку — откроется дорога в деревню', base: 60, mult: 1.0, max: 1 },
  { id: 'map', station: 'nika', name: 'Карта улицы', desc: 'В начале ночи видно, где стоят все фонари', base: 90, mult: 1.0, max: 1 },
  { id: 'compass', station: 'nika', name: 'Компас', desc: 'Стрелка показывает на ближайший тёмный фонарь', base: 120, mult: 1.0, max: 1 },
  {
    id: 'helper', station: 'mila', name: 'Подносчик', desc: 'Житель носит масло к фонарям и собирает урожай', base: 60, mult: 2.6, max: 4,
    lock: () => (st.up.helper >= st.movedIn.length ? 'Подносчиков не больше, чем жителей' : null),
  },
  { id: 'autopress', station: 'mila', name: 'Ворот для маслобойни', desc: 'Маслобойня сама отжимает семечки', base: 150, mult: 1.0, max: 1 },
];

/** Старые улучшения-цифры (до звёздного неба): чтобы вернуть за них Свет из старых сохранений. */
const OLD_UPS: Record<string, [number, number]> = {
  tank: [15, 1.9], lens: [12, 2.0], can: [18, 2.0], boots: [30, 2.2], fert: [22, 2.1], seeds: [38, 2.4],
  ladder: [30, 2.2], lampTank: [38, 2.2], wick: [52, 2.3], rumor: [60, 2.4], vision: [75, 2.7], glass: [68, 2.4],
};

const emptyUps = () => Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) as Record<UpId, number>;
const emptyNight = (): NightStats => ({ lit: [], harvested: 0, maxBurning: 0, lumens: 0, found: [], districts: [] });

export interface Helper {
  x: number; y: number;
  tgt: Lamp | Flower | null;
  face: number; anim: number; moving: boolean;
}

export type Scene = 'room' | 'night' | 'plaza';

/** Персонаж ролика (житель или Гаситель). */
export interface Actor {
  id: string; kind: 'person' | 'villain' | 'spark' | 'sleeper' | 'hero' | 'smoke'; coat: number;
  x: number; y: number; tx: number; ty: number; speed: number;
  face: number; anim: number; moving: boolean;
  alpha: number; alphaT: number;
  /** Дойдя до цели — исчезнуть (убежал домой). */
  vanish: boolean;
  /** Гаситель взмахнул посохом. */
  cast: boolean;
}

/** Ролик: камера, затемнение, небо, персонажи. */
export interface Cine {
  skip: boolean;
  cam: { x: number; y: number };
  dark: number; darkT: number;
  fade: number; fadeT: number;
  sky: 'day' | 'dark' | null;
  /** Показывать ли туман неизведанного (на настоящей улице — да). */
  fog: boolean;
  /** Дом фонарщика уже светится (дар Искры). */
  homeGlow: boolean;
  actors: Actor[];
}
export type Modal = { kind: 'shop'; station: StationId } | { kind: 'sky' } | { kind: 'board' } | { kind: 'guide' } | { kind: 'press' } | { kind: 'start' } | null;

export const st = {
  // --- навсегда (сохраняется) ---
  lumens: 0,
  up: emptyUps(),
  /** Зажжённые звёзды на небе (центр — Искра — горит всегда). */
  stars: ['center'] as string[],
  /** Жители, к которым постучали (окно горит). */
  met: [] as ResidentId[],
  /** Жители, переехавшие в мастерскую. */
  movedIn: [] as ResidentId[],
  quests: {} as Partial<Record<string, 'done' | 'claimed'>>,
  nights: 0,
  notesRead: 0,
  seen: { intro: false, firstReturn: false, ending: false },
  /** Какие подсказки Искры уже были. */
  tips: {} as Record<string, boolean>,
  /** Сколько ночей подряд никого не нашли (для подсказки-стрелки). */
  dryNights: 0,
  /** Дневник фонарщика (вместо гайда): есть ли он и какие страницы открыты. */
  hasJournal: false,
  journal: [] as PageId[],
  journalNew: false,
  /** Зажжённые маяки (id фонарей): они горят каждую ночь, от них можно начинать. */
  beacons: [] as number[],
  /** Какие тайлы улицы уже видели (1) — остальные скрыты полной тьмой. */
  known: new Uint8Array(W * H),

  // --- текущая сцена ---
  scene: 'room' as Scene,
  /** Секунды до того, как погаснет ручной фонарь. */
  lantern: 0,
  lanternMax: 1,
  oil: 0,
  seeds: 0,
  /** Свет, собранный за ночь: он в фонаре, пока не донесёшь до дома. */
  carry: 0,
  night: emptyNight(),
  nightOver: false,
  player: { x: SPAWN.x, y: SPAWN.y, face: 1, anim: 0, moving: false },
  helpers: [] as Helper[],
  /** Удержание E: что делаем и сколько уже держим. */
  hold: { key: '', t: 0, time: 1 },
  /** После диалога E надо отпустить, иначе сразу сработает действие. */
  holdLock: false,
  /** Реплики, которые сейчас показываются (игра на паузе). */
  dialog: [] as (Line & { then?: () => void })[],
  modal: null as Modal,
  /** Открыто меню (главное или пауза) — игра стоит. */
  menu: false,
  cine: null as Cine | null,
  /** Искра — светлячок-спутник. */
  spark: { x: SPAWN.x, y: SPAWN.y },
  sparkSay: { text: '', t: 0 },
  /** К чьему дому этой ночью показывает стрелка. */
  pointTo: null as ResidentId | null,
  time: 0,
  knownVer: 0,
  /** Сообщения для интерфейса (UI их забирает). */
  events: [] as string[],
  pressAcc: 0,
  knownAcc: 0,
};

// ---------- виды фонарей ----------

export interface KindInfo {
  name: string;
  /** Сколько масла влезает (до улучшений). */
  cap: number;
  /** Множитель расхода масла (0 — не тратит). */
  drain: number;
  radius: number;
  /** Множитель Света. */
  lumen: number;
  /** Сколько масла нужно, чтобы зажечь. */
  cost: number;
  hold: number;
  /** Цвет света. */
  tint: number;
}

export const KINDS: Record<LampKind, KindInfo> = {
  oil: { name: 'фонарь', cap: 30, drain: 1, radius: 1, lumen: 1, cost: 1, hold: 1.2, tint: 0xff9a30 },
  gas: { name: 'газовый фонарь', cap: 40, drain: 1.5, radius: 1.3, lumen: 2, cost: 20, hold: 2, tint: 0x5aa0ff },
  stubborn: { name: 'упрямый фонарь', cap: 30, drain: 1, radius: 1, lumen: 3, cost: 1, hold: 1, tint: 0xff4a3a },
  marsh: { name: 'болотный фонарь', cap: 1, drain: 0, radius: 0.9, lumen: 0.5, cost: 3, hold: 1.2, tint: 0x4aff8a },
  beacon: { name: 'маяк', cap: 1, drain: 0, radius: 1.6, lumen: 1, cost: 15, hold: 2.5, tint: 0xfff0c8 },
};

/** Ось моста: самая восточная клетка (у неё стоит табличка «мост сломан»). */
const bridgeEnd = (() => {
  let best: { x: number; y: number } | null = null;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (world.ground[y * W + x] === BRIDGE && (!best || x > best.x)) best = { x, y };
  return best;
})();

// ---------- звёздное небо ----------

let skyVer = 0;
let skyCache = { ver: -1, lv: {} as Partial<Record<Stat, number>>, keys: new Set<Key>(), done: [] as Branch[] };
function sky() {
  if (skyCache.ver === skyVer) return skyCache;
  const lv: Partial<Record<Stat, number>> = {};
  const keys = new Set<Key>();
  for (const id of st.stars) {
    const s = starById(id);
    if (!s) continue;
    for (const [k, v] of Object.entries(s.stats) as [Stat, number][]) lv[k] = (lv[k] ?? 0) + v;
    if (s.key) keys.add(s.key);
  }
  const done = (Object.keys(CONSTELLATIONS) as Branch[]).filter((b) => STARS.every((s) => s.branch !== b || st.stars.includes(s.id)));
  skyCache = { ver: skyVer, lv, keys, done };
  return skyCache;
}
/** Уровень улучшения от зажжённых звёзд. */
export const lv = (k: Stat) => sky().lv[k] ?? 0;
export const hasKey = (k: Key) => sky().keys.has(k);
/** Собранные целиком созвездия. */
export const doneConstellations = () => sky().done;

export const starLit = (id: string) => st.stars.includes(id);
/** Рядом горит звезда — значит, эту можно зажечь. */
export const starReachable = (s: Star) => s.links.some(starLit);
export const branchOpen = (b: Branch) => b === 'core' || hasResident(b);
export const starCost = (s: Star) =>
  Math.ceil((6 + s.dist / 12) * (s.size === 'big' ? 1.8 : s.size === 'key' ? 3 : 1) * (1 + 0.05 * (st.stars.length - 1)));

/** null — можно зажечь, иначе причина. */
export function starBlock(s: Star): string | null {
  if (starLit(s.id)) return 'Уже горит';
  if (!branchOpen(s.branch)) return `Откроется, когда ${residentById(s.branch as ResidentId).name} переедет в мастерскую`;
  if (!starReachable(s)) return 'Сначала зажги соседнюю звезду';
  if (st.lumens < starCost(s)) return 'Не хватает Света';
  return null;
}

export function lightStar(id: string) {
  const s = starById(id);
  if (!s || starBlock(s)) return false;
  const before = doneConstellations();
  st.lumens -= starCost(s);
  st.stars.push(id);
  skyVer++;
  sfx.light();
  const fresh = doneConstellations().find((b) => !before.includes(b));
  if (fresh) {
    st.events.push(`Созвездие «${CONSTELLATIONS[fresh].name}» зажжено целиком! +5% Света навсегда`);
    sfx.goal();
  }
  save();
  return true;
}

// ---------- формулы ----------
export const nightLength = () => 40 + 10 * lv('tank');
const startOil = () => Math.floor(12 + 8 * lv('can'));
/** На дорогах с «Короткими тропами» — быстрее. */
const speed = () => {
  let k = 1 + 0.12 * lv('boots');
  if (st.scene === 'night' && hasKey('trails')) {
    const g = world.ground[Math.floor(st.player.y) * W + Math.floor(st.player.x)];
    if (g === PATH || g === STONE || g === BRIDGE) k *= 1.25;
  }
  return 3.2 * k;
};
const lanternR = () => 2.2 + 0.5 * lv('lens');
const growTime = () => 6 / Math.pow(1.4, lv('fert'));
const seedsPer = () => 3 + Math.floor(lv('seeds'));
const holdMul = () => Math.pow(0.75, lv('ladder'));
export const lampCap = (l: Lamp) => KINDS[l.kind].cap * (l.kind === 'oil' || l.kind === 'gas' || l.kind === 'stubborn' ? 1 + 0.5 * lv('lampTank') : 1);
const drain = () => 0.3 * Math.pow(0.8, lv('wick'));
const lampR = () => 3.2 + 0.4 * lv('glass');
const lumenPer = () => 0.5 * (1 + 0.25 * lv('rumor')) * (1 + CONSTELLATION_BONUS * doneConstellations().length);
const firstLightBonus = () => (2 + lv('fame')) * (hasKey('loud') ? 2 : 1);
/** Сколько Света теряется, если фонарь погас не дома. */
const LOST_SHARE = 0.5;
export const darkAlpha = () => (st.cine ? st.cine.dark : 0.8 - 0.08 * lv('vision'));

export const burning = (l: Lamp) => l.lit && l.oil > 0;
export const litCount = () => world.lamps.filter(burning).length;
export const lumenRate = () => (st.scene === 'night' && !st.nightOver
  ? world.lamps.reduce((sum, l) => sum + (burning(l) ? KINDS[l.kind].lumen : 0), 0) * lumenPer() : 0);
export const hasResident = (id: ResidentId) => st.movedIn.includes(id);
export const stationOpen = (s: Station) => s.id === 'scope' || hasResident(s.id as ResidentId);

/** Радиус света фонаря: когда масла мало, круг сжимается. */
export function lampRadius(l: Lamp) {
  if (!burning(l)) return 0;
  const big = l.name === 'Старый маяк' ? 1.5 : 1;
  const k = KINDS[l.kind].drain ? 0.55 + 0.45 * Math.min(1, l.oil / (lampCap(l) * 0.25)) : 1;
  return lampR() * KINDS[l.kind].radius * big * k;
}

export interface Light { x: number; y: number; r: number; id: number; tint?: number }

export function lights(): Light[] {
  if (st.cine) {
    const ls: Light[] = st.cine.actors.filter((a) => a.kind === 'spark' && a.alpha > 0).map((a) => ({ x: a.x, y: a.y, r: 1.6, id: -2 }));
    if (st.cine.homeGlow && world.home) { const d = homeDoor(world.home); ls.push({ x: d.x, y: d.y - 0.6, r: 3, id: -3 }); }
    return ls;
  }
  // ручной фонарь к концу смены тускнеет
  const k = st.nightOver ? 0.5 : 0.6 + 0.4 * Math.min(1, st.lantern / 10);
  const out: Light[] = [{ x: st.player.x, y: st.player.y, r: lanternR() * k, id: -1 }];
  out.push({ x: st.spark.x, y: st.spark.y, r: 1.1, id: -2 });
  if (world.home) { const d = homeDoor(world.home); out.push({ x: d.x, y: d.y - 0.6, r: 3, id: -3 }); }
  for (const l of world.lamps) if (burning(l)) out.push({ x: l.x + 0.5, y: l.y + 0.5, r: lampRadius(l), id: l.id, tint: KINDS[l.kind].tint });
  return out;
}

/** Насколько светло в точке: 0 — тьма, 1 — под самым фонарём. */
export function lightAt(x: number, y: number, ls = lights()) {
  let v = 0;
  for (const s of ls) v = Math.max(v, 1 - Math.hypot(x - s.x, y - s.y) / s.r);
  return v;
}

export const cost = (u: Upgrade) => Math.ceil(u.base * Math.pow(u.mult, st.up[u.id]));

/** null — можно купить, иначе причина, почему нельзя. */
export function buyBlock(u: Upgrade): string | null {
  if (st.up[u.id] >= u.max) return 'Максимум';
  const lock = u.lock?.();
  if (lock) return lock;
  if (st.lumens < cost(u)) return 'Не хватает Света';
  return null;
}

export function buy(id: UpId) {
  const u = UPGRADES.find((x) => x.id === id)!;
  if (buyBlock(u)) return;
  st.lumens -= cost(u);
  st.up[id]++;
  sfx.buy();
  save();
}

// ---------- заказы ----------

export const questVisible = (q: Quest) => q.need === null || hasResident(q.need);
export const questState = (q: Quest) => st.quests[q.id] ?? 'open';
export const readyQuests = () => QUESTS.filter((q) => questVisible(q) && questState(q) === 'done').length;

function checkQuests() {
  for (const q of QUESTS) {
    if (!questVisible(q) || questState(q) !== 'open') continue;
    if (q.check(st.night, st.met.length)) {
      st.quests[q.id] = 'done';
      st.events.push(`Заказ выполнен: ${q.text}. Награда — на доске в мастерской.`);
      sfx.goal();
    }
  }
}

export function claim(id: string) {
  const q = QUESTS.find((x) => x.id === id)!;
  if (questState(q) !== 'done') return;
  st.quests[id] = 'claimed';
  st.lumens += q.reward;
  sfx.buy();
  if (q.final && !st.seen.ending) {
    st.seen.ending = true;
    st.modal = null;
    say(ENDING);
  }
  save();
}

// ---------- диалоги ----------

export function say(lines: Line[], then?: () => void) {
  const list = lines.map((l) => ({ ...l }));
  if (then && list.length) (list[list.length - 1] as { then?: () => void }).then = then;
  st.dialog.push(...list);
}

export function nextLine() {
  const l = st.dialog.shift();
  st.holdLock = true;
  l?.then?.();
}

// ---------- ролики: ожидание, реплики, пропуск ----------

const waiters: { t: number; res: () => void }[] = [];
const talks: (() => void)[] = [];

/** Подождать sec секунд игрового времени (пока идёт диалог — время стоит). */
export const wait = (sec: number) =>
  st.cine?.skip ? Promise.resolve() : new Promise<void>((res) => waiters.push({ t: sec, res }));

/** Показать реплики и дождаться, пока игрок их прочитает. */
export const talk = (lines: Line[]) =>
  st.cine?.skip ? Promise.resolve() : new Promise<void>((res) => {
    talks.push(res);
    say(lines, () => { talks.splice(talks.indexOf(res), 1); res(); });
  });

export function skipCine() {
  if (!st.cine || st.cine.skip) return;
  st.cine.skip = true;
  st.dialog = [];
  for (const w of waiters.splice(0)) w.res();
  for (const r of talks.splice(0)) r();
}

function tickCine(dt: number) {
  const c = st.cine!;
  const toward = (v: number, t: number, rate: number) => (v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt));
  c.dark = toward(c.dark, c.darkT, 0.35);
  c.fade = toward(c.fade, c.fadeT, 1);
  for (const a of c.actors) {
    a.alpha = toward(a.alpha, a.alphaT, 0.8);
    if (a.kind === 'smoke') a.anim += dt;
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    a.moving = d > 0.05;
    if (a.moving) {
      const sp = Math.min(d, a.speed * dt);
      a.x += (dx / d) * sp;
      a.y += (dy / d) * sp;
      a.anim += dt;
      if (Math.abs(dx - dy) > 0.01) a.face = Math.sign(dx - dy);
    } else if (a.vanish) a.alphaT = 0;
  }
  if (st.dialog.length) return;
  for (const w of [...waiters]) {
    w.t -= dt;
    if (w.t <= 0) { waiters.splice(waiters.indexOf(w), 1); w.res(); }
  }
}

// ---------- дневник ----------

export function giveJournal() {
  if (st.hasJournal) return;
  st.hasJournal = true;
  for (const id of ['goal', 'home', 'controls'] as PageId[]) if (!st.journal.includes(id)) st.journal.push(id);
  st.journalNew = true;
  st.events.push('Получен предмет: Дневник фонарщика. Открыть — F1');
}

function unlockPage(id: PageId) {
  if (st.journal.includes(id)) return;
  st.journal.push(id);
  st.journalNew = true;
  const page = JOURNAL.find((p) => p.id === id)!;
  st.events.push(`В дневнике новая запись: «${page.title}» (F1)`);
}

// ---------- Искра ----------

/** Подсказка Искры пузырём — один раз за игру, если она сейчас молчит. */
function tip(key: keyof typeof SPARK_TIPS) {
  if (st.tips[key] || st.sparkSay.t > 0) return;
  st.tips[key] = true;
  sparkSay(SPARK_TIPS[key]);
}

export function sparkSay(text: string, t = 5) {
  st.sparkSay = { text, t };
}

function updateSpark(dt: number) {
  const p = st.player, s = st.spark;
  const k = 1 - Math.exp(-dt * 3);
  const tx = p.x - 0.7 + Math.sin(st.time * 1.3) * 0.25;
  const ty = p.y - 0.7 + Math.cos(st.time * 1.7) * 0.25;
  s.x += (tx - s.x) * k;
  s.y += (ty - s.y) * k;
  if (st.sparkSay.t > 0) st.sparkSay.t -= dt;
}

/** Направление по экрану словами: «на севере», «на юго-западе»… */
function direction(fx: number, fy: number, tx: number, ty: number) {
  const dx = tx - fx, dy = ty - fy;
  const a = Math.atan2(dx + dy, dx - dy); // экранные оси: вправо — восток, вниз — юг
  const names = ['на востоке', 'на юго-востоке', 'на юге', 'на юго-западе', 'на западе', 'на северо-западе', 'на севере', 'на северо-востоке'];
  return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** В начале ночи Искра намекает, где искать жителя; после 4 пустых ночей — ведёт стрелкой. */
function residentHint() {
  const left = world.houses.filter((h) => !st.met.includes(h.rid) && (st.up.bridge || h.x > riverX(h.y)));
  if (!left.length) return;
  const s = world.start;
  const h = left.sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
  if (st.dryNights >= 4) {
    st.pointTo = h.rid;
    sparkSay('Я видела свет в окне! Иди за розовой стрелкой — там кто-то ждёт.', 7);
  } else {
    sparkSay(`${residentById(h.rid).clue}… Кажется, это ${direction(s.x, s.y, h.x + 1, h.y + 1)}.`, 7);
  }
}

// ---------- смена сцен ----------

/** Свободная точка рядом с фонарём (маяком), чтобы встать возле него. */
function spotNear(l: Lamp) {
  for (const [dx, dy] of [[0.5, 1.6], [1.6, 0.5], [-0.6, 0.5], [0.5, -0.6], [1.6, 1.6]]) {
    const x = l.x + dx, y = l.y + dy;
    if (free(x, y)) return { x, y };
  }
  return { x: l.x + 0.5, y: l.y + 1.6 };
}

/** Начать ночь у дома или у зажжённого маяка (id фонаря). */
export function startNight(at: number | null = null) {
  st.scene = 'night';
  st.nights++;
  st.nightOver = false;
  st.lanternMax = st.lantern = nightLength();
  st.oil = startOil();
  st.seeds = 0;
  st.carry = 0;
  st.night = emptyNight();
  for (const l of world.lamps) {
    const beacon = st.beacons.includes(l.id);
    l.oil = beacon ? 1 : 0;
    l.lit = l.everLit = beacon;
    l.kindled = 0;
  }
  for (const f of world.flowers) { f.stage = 0; f.grow = 0; }
  const b = at !== null ? world.lamps[at] : null;
  const pos = b ? spotNear(b) : world.start;
  st.player = { x: pos.x, y: pos.y, face: 1, anim: 0, moving: false };
  const pr = nearestPress(pos.x, pos.y);
  st.helpers = Array.from({ length: st.up.helper }, (_, i) => ({
    x: pr.x + 0.5 + i * 0.6, y: pr.y + 1.5, tgt: null, face: 1, anim: 0, moving: false,
  }));
  if (st.up.map) {
    for (const l of world.lamps)
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) st.known[(l.y + j) * W + l.x + i] = 1;
    st.knownVer++;
  }
  st.spark = { x: st.player.x - 0.7, y: st.player.y - 0.7 };
  st.pointTo = null;
  st.sparkSay = { text: '', t: 0 };
  sfx.light();
  if (st.nights > 1) residentHint();
}

function endNight() {
  st.nightOver = true;
  st.hold.key = '';
  sfx.out();
  const lost = Math.floor(st.carry * LOST_SHARE);
  say([{ who: SPARK, text: lost > 0
    ? `Фонарь погас! Держись за меня — тащу домой!.. Ой. По дороге рассыпалось ${lost} Света.`
    : 'Фонарь погас! Держись за меня — тащу домой!' }], () => goHome(false));
}

function nearestPress(x: number, y: number) {
  return [...world.presses].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
}

/** Вернуться в мастерскую. safe — дошёл сам (весь Свет цел), иначе половина потеряна. */
function goHome(safe: boolean) {
  const brought = Math.floor(safe ? st.carry : st.carry * (1 - LOST_SHARE));
  st.lumens += brought;
  st.carry = 0;
  if (brought > 0) st.events.push(`Принесено домой: +${brought} Света`);
  st.dryNights = st.night.found.length ? 0 : st.dryNights + 1;
  st.pointTo = null;
  st.scene = 'room';
  st.nightOver = false;
  st.player = { x: SPAWN.x, y: SPAWN.y, face: 1, anim: 0, moving: false };
  st.helpers = [];
  st.spark = { x: st.player.x - 0.7, y: st.player.y - 0.7 };
  st.sparkSay = { text: '', t: 0 };
  if (!st.seen.firstReturn) { st.seen.firstReturn = true; say(SPARK_HOME); }
  unlockPage('sky');
  // найденные этой ночью переезжают в мастерскую
  for (const id of st.night.found) {
    if (hasResident(id)) continue;
    st.movedIn.push(id);
    unlockPage('orders');
    const r = residentById(id);
    say([{ who: r.name, text: r.moveIn }, { text: `В мастерской новый жилец: ${r.name}. Открыто: ${r.station}.` }]);
  }
  if (hasResident('seva') && st.notesRead < NOTES.length) {
    say([{ who: 'Почтальон Сева', text: 'Вот, нашёл в сумке. Тебе, наверное.' }, { text: NOTES[st.notesRead] }]);
    st.notesRead++;
  }
  if (readyQuests() > 0) st.events.push('На доске заказов ждёт награда!');
  save();
}

// ---------- действия игрока ----------

export interface Act { key: string; label: string; time: number; ok: boolean; why?: string; run: () => void }

/** Подлить масла (за раз — не больше 10, газовому при первом огне — 20). */
function fill(l: Lamp) {
  const k = KINDS[l.kind];
  if (!k.drain) {
    // маяк и болотный фонарь: платишь один раз — горят всю ночь
    st.oil -= k.cost;
    l.oil = lampCap(l);
  } else {
    const max = !l.everLit && l.kind === 'gas' ? 20 : 10;
    const amt = Math.min(lampCap(l) - l.oil, st.oil, max);
    l.oil += amt;
    st.oil -= amt;
  }
  if (l.kind !== 'stubborn' || l.kindled > 0) ignite(l);
}

/** Огонь загорелся. */
function ignite(l: Lamp) {
  l.lit = true;
  l.kindled = 0;
  if (l.kind === 'stubborn') l.gust = 10 + Math.random() * 8;
  if (l.everLit) return;
  l.everLit = true;
  tip('lit');
  unlockPage('light');
  if (l.kind !== 'oil') unlockPage('lamps');
  st.night.lit.push(l.id);
  if (!st.night.districts.includes(l.district)) st.night.districts.push(l.district);
  const bonus = firstLightBonus() * lumenPer() * 2 * KINDS[l.kind].lumen;
  st.carry += bonus;
  st.night.lumens += bonus;
  if (l.kind === 'beacon' && !st.beacons.includes(l.id)) {
    st.beacons.push(l.id);
    unlockPage('beacons');
    st.events.push(`${l.name} зажжён! Теперь ночь можно начинать отсюда.`);
    sfx.goal();
    save();
  }
}

/** Маяк отправляет собранный Свет домой (его уже не потеряешь). */
function bank() {
  const n = Math.floor(st.carry);
  st.lumens += n;
  st.carry -= n;
  st.events.push(`Маяк отправил домой ${n} Света`);
  sfx.buy();
  save();
}

function harvest(f: Flower) {
  f.stage = 1;
  f.grow = 0;
  st.seeds += seedsPer();
  st.night.harvested++;
  unlockPage('seeds');
}

function knock(h: House) {
  const r = residentById(h.rid);
  st.met.push(h.rid);
  st.night.found.push(h.rid);
  unlockPage('residents');
  sfx.knock();
  say([{ who: r.name, text: r.knock }, { text: `${r.name} переберётся к тебе в мастерскую, когда закончится ночь.` }]);
}

/** Что игрок может сделать прямо сейчас (ближайший объект). */
export function currentAct(): Act | null {
  if (st.dialog.length || st.modal || st.nightOver || st.cine) return null;
  const p = st.player;
  let best: Act | null = null;
  let bd = Infinity;
  const consider = (cx: number, cy: number, max: number, make: () => Act | null) => {
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d > max || d >= bd) return;
    const a = make();
    if (a) { best = a; bd = d; }
  };
  const hm = holdMul();

  if (st.scene === 'room') {
    consider(0.3, DOOR.y + 0.5, 1.4, () => ({
      key: 'door', label: 'Выйти в ночь', time: 0.5, ok: true,
      run: () => { if (st.beacons.length) st.modal = { kind: 'start' }; else startNight(); },
    }));
    consider(BOARD.x + 0.5, 0.3, 1.6, () => {
      const n = readyQuests();
      return { key: 'board', label: n ? `Доска заказов (наград: ${n})` : 'Доска заказов', time: 0.15, ok: true, run: () => { st.modal = { kind: 'board' }; } };
    });
    for (const s of STATIONS) {
      if (!stationOpen(s)) continue;
      const c = stationCenter(s);
      if (s.id === 'scope') {
        consider(c.x, c.y, 1.7, () => ({ key: 'scope', label: 'Телескоп: звёздное небо', time: 0.15, ok: true, run: () => { st.modal = { kind: 'sky' }; } }));
        continue;
      }
      const label = `${residentById(s.id as ResidentId).name}: ${residentById(s.id as ResidentId).station}`;
      consider(c.x, c.y, 1.7, () => ({ key: 'st' + s.id, label, time: 0.15, ok: true, run: () => { st.modal = { kind: 'shop', station: s.id }; } }));
    }
    return best;
  }

  for (const l of world.lamps) {
    consider(l.x + 0.5, l.y + 0.5, l.kind === 'beacon' ? 1.6 : 1.35, () => lampAct(l, hm));
  }
  if (bridgeEnd && !st.up.bridge) {
    consider(bridgeEnd.x + 1.5, bridgeEnd.y + 0.5, 1.6, () => {
      tip('bridge');
      return { key: 'bridge', label: 'Мост', time: 1, ok: false, why: 'Мост сломан — его починит кузнец', run: () => {} };
    });
  }
  for (const f of world.flowers) {
    if (f.stage !== 3) continue;
    consider(f.x + 0.5, f.y + 0.5, 1.1, () => ({
      key: `fl${f.x},${f.y}`, label: 'Сорвать подсолнух', time: 0.3, ok: true, run: () => { harvest(f); sfx.pick(); },
    }));
  }
  if (world.home) {
    const d = homeDoor(world.home);
    consider(d.x, d.y, 1.3, () => ({
      key: 'home', label: st.carry >= 1 ? `Зайти домой (+${Math.floor(st.carry)} Света)` : 'Зайти домой', time: 0.5, ok: true,
      run: () => { st.nightOver = true; sfx.pour(); goHome(true); },
    }));
  }
  for (const pr of world.presses) {
    consider(pr.x + 0.5, pr.y + 0.5, 1.4, () => (st.seeds > 0 ? {
      key: 'press', label: `Крутить ворот (${st.seeds} сем.)`, time: 0.2, ok: true,
      run: () => { st.modal = { kind: 'press' }; },
    } : null));
  }
  for (const h of world.houses) {
    if (st.met.includes(h.rid)) continue;
    consider(h.x + 1, h.y + 1, 2.0, () => ({
      key: `house${h.rid}`, label: 'Постучать в дверь', time: 0.5, ok: true, run: () => knock(h),
    }));
  }
  return best;
}

/** Что можно сделать с фонарём. */
function lampAct(l: Lamp, hm: number): Act | null {
  const k = KINDS[l.kind];
  const key = 'lamp' + l.id;
  if (!l.lit) {
    if (l.kind === 'stubborn') {
      if (l.kindled > 0) return { key, label: 'Раздуть пламя (2/2)', time: k.hold * hm, ok: true, run: () => { ignite(l); sfx.light(); } };
      const need = l.oil >= 1 ? 0 : 1;
      return {
        key, label: 'Высечь искру (1/2)', time: k.hold * hm, ok: st.oil >= need, why: 'Нет масла — собери подсолнухи',
        run: () => { if (need) fill(l); l.kindled = 6; sfx.pick(); },
      };
    }
    const label = l.kind === 'beacon' ? `Зажечь ${l.name} (${k.cost} масла)`
      : l.kind === 'oil' ? 'Зажечь фонарь' : `Зажечь ${k.name} (${k.cost} масла)`;
    const why = st.oil < 1 ? 'Нет масла — собери подсолнухи' : `Нужно ${k.cost} масла`;
    if (l.kind === 'gas' || l.kind === 'beacon' || l.kind === 'marsh') tip(l.kind);
    return { key, label, time: k.hold * hm, ok: st.oil >= k.cost, why, run: () => { fill(l); sfx.light(); } };
  }
  if (l.kind === 'beacon') {
    return st.carry >= 1
      ? { key, label: `Отправить Свет домой (+${Math.floor(st.carry)})`, time: 0.8, ok: true, run: bank }
      : null;
  }
  if (!k.drain || l.oil >= lampCap(l) - 1) return null;
  return { key, label: 'Подлить масла', time: 0.6 * hm, ok: st.oil >= 1, why: 'Нет масла — собери подсолнухи', run: () => { fill(l); sfx.pour(); } };
}

/** Итог мини-игры на маслобойне: mult — насколько удачно крутили ворот. */
export function finishPress(mult: number) {
  const oil = Math.max(1, Math.round(st.seeds * mult * (1 + 0.1 * lv('press'))));
  st.oil += oil;
  st.seeds = 0;
  unlockPage('oil');
  sfx.press();
  st.events.push(`Отжато ${oil} масла`);
}

/** Подсказка сверху экрана. */
export function hint(): string {
  if (st.scene === 'room') {
    if (readyQuests()) return 'На доске заказов ждёт награда';
    return 'Зажги звёзды у телескопа — и снова в ночь';
  }
  if (st.lantern < 15) return st.beacons.length
    ? 'Фонарь гаснет! Неси Свет домой или к зажжённому маяку'
    : 'Скорее домой! Дверь светится тёплым — иди за белой стрелкой';
  if (st.night.lit.length === 0) return st.oil >= 1 ? 'Подойди к фонарю и зажми E' : 'Масла нет — ищи подсолнухи';
  if (st.seeds > 0 && !st.up.autopress && st.oil < 1) return 'Отнеси семечки на маслобойню';
  if (st.oil < 1 && st.seeds === 0) return 'Масло кончилось — подсолнухи растут в свете фонарей';
  const q = QUESTS.find((x) => questVisible(x) && questState(x) === 'open');
  return q ? `Заказ: ${q.text}` : 'Иди в темноту — ищи фонари и дома';
}

// ---------- движение ----------

export interface Input { ix: number; iy: number; hold: boolean }

function roomBlocked(tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return true;
  const inside = (r: { x: number; y: number; w: number; h: number }) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  if (inside(FIREPLACE)) return true;
  return STATIONS.some((s) => stationOpen(s) && inside(s));
}

const blocked = (x: number, y: number) => {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (st.scene === 'room') return roomBlocked(tx, ty);
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
  if (world.ground[ty * W + tx] === BRIDGE) return !st.up.bridge;
  return world.block[ty * W + tx] === 1;
};
const R = 0.2;
const free = (x: number, y: number) =>
  !blocked(x - R, y - R) && !blocked(x + R, y - R) && !blocked(x - R, y + R) && !blocked(x + R, y + R);

function movePlayer(dt: number, inp: Input) {
  const p = st.player;
  const d = screenDirToTile(inp.ix, inp.iy);
  const len = Math.hypot(d.x, d.y);
  p.moving = len > 0;
  if (!p.moving) return;
  if (inp.ix) p.face = Math.sign(inp.ix);
  p.anim += dt;
  const sp = speed() * dt / len;
  const nx = p.x + d.x * sp, ny = p.y + d.y * sp;
  if (free(nx, p.y)) p.x = nx;
  if (free(p.x, ny)) p.y = ny;
}

function updateHelpers(dt: number) {
  for (const h of st.helpers) {
    const taken = new Set(st.helpers.filter((o) => o !== h).map((o) => o.tgt));
    // цель ещё актуальна?
    if (h.tgt && 'oil' in h.tgt && (h.tgt.oil >= lampCap(h.tgt) - 1 || st.oil < 1)) h.tgt = null;
    if (h.tgt && 'stage' in h.tgt && h.tgt.stage !== 3) h.tgt = null;
    if (!h.tgt) {
      const dist = (x: number, y: number) => Math.hypot(x + 0.5 - h.x, y + 0.5 - h.y);
      if (st.oil >= 1) {
        const needy = world.lamps
          .filter((l) => l.lit && KINDS[l.kind].drain > 0 && l.oil < lampCap(l) * 0.5 && !taken.has(l))
          .sort((a, b) => a.oil / lampCap(a) + dist(a.x, a.y) * 0.02 - (b.oil / lampCap(b) + dist(b.x, b.y) * 0.02));
        h.tgt = needy[0] ?? null;
      }
      if (!h.tgt) {
        const ripe = world.flowers.filter((f) => f.stage === 3 && !taken.has(f)).sort((a, b) => dist(a.x, a.y) - dist(b.x, b.y));
        h.tgt = ripe[0] ?? null;
      }
    }
    // идём к цели или домой, к маслобойне
    const pr = nearestPress(h.x, h.y);
    const tx = h.tgt ? h.tgt.x + 0.5 : pr.x + 0.5 + Math.sin(st.time * 0.3 + st.helpers.indexOf(h)) * 1.5;
    const ty = h.tgt ? h.tgt.y + 0.5 : pr.y + 1.8;
    const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
    h.moving = d > 0.5;
    if (h.moving) {
      const sp = Math.min(d, 2.4 * (hasKey('fed') ? 1.5 : 1) * dt);
      h.x += (dx / d) * sp;
      h.y += (dy / d) * sp;
      h.anim += dt;
      const sx = dx - dy;
      if (Math.abs(sx) > 0.05) h.face = Math.sign(sx);
    } else if (h.tgt) {
      if ('oil' in h.tgt) fill(h.tgt);
      else harvest(h.tgt);
      h.tgt = null;
    }
  }
}

function updateNight(dt: number) {
  // ручной фонарь — таймер смены
  st.lantern = Math.max(0, st.lantern - dt);
  if (st.lantern <= 0) { endNight(); return; }

  for (const l of world.lamps) {
    if (l.kindled > 0) l.kindled = Math.max(0, l.kindled - dt);
    if (!burning(l)) continue;
    // «Братство огней»: рядом горит другой фонарь — масло тратится медленнее
    const friends = hasKey('brotherhood') && world.lamps.some((o) => o !== l && burning(o) && Math.hypot(o.x - l.x, o.y - l.y) < 7);
    l.oil = Math.max(0, l.oil - drain() * KINDS[l.kind].drain * (friends ? 0.6 : 1) * dt);
    if (l.oil <= 0) { l.lit = false; sfx.out(); tip('out'); continue; }
    // упрямый фонарь на побережье: порыв ветра может его задуть (масло останется)
    if (l.kind === 'stubborn') {
      l.gust -= dt;
      if (l.gust <= 0) {
        l.gust = 14 + Math.random() * 10;
        if (!hasKey('calm') && Math.random() < 0.6) { l.lit = false; sfx.out(); tip('wind'); }
      }
    }
  }
  const gain = lumenRate() * dt;
  st.carry += gain;
  st.night.lumens += gain;
  st.night.maxBurning = Math.max(st.night.maxBurning, litCount());

  // подсолнухи растут только в свете
  const ls = lights();
  for (const f of world.flowers) {
    if (f.stage >= 3 || lightAt(f.x + 0.5, f.y + 0.5, ls) <= 0) continue;
    // болотный фонарь рядом — растут вдвое быстрее
    // «Солнечные грядки» — вдвое быстрее у любого горящего фонаря, иначе только у болотного
    const near = (l: Lamp) => burning(l) && Math.hypot(l.x - f.x, l.y - f.y) < lampRadius(l);
    const fast = world.lamps.some((l) => (l.kind === 'marsh' || hasKey('sunbeds')) && near(l));
    f.grow += (dt / growTime()) * (fast ? 2 : 1);
    if (f.grow >= 1) { f.stage++; f.grow = 0; }
  }

  updateHelpers(dt);

  if (st.up.autopress && st.seeds > 0) {
    st.pressAcc += dt;
    while (st.seeds > 0 && st.pressAcc >= 0.3) { st.pressAcc -= 0.3; st.seeds--; st.oil++; }
  }

  // свет открывает карту
  st.knownAcc += dt;
  if (st.knownAcc > 0.15) {
    st.knownAcc = 0;
    let changed = false;
    for (const s of ls) {
      const r = Math.ceil(s.r);
      for (let ty = Math.floor(s.y) - r; ty <= Math.floor(s.y) + r; ty++) {
        for (let tx = Math.floor(s.x) - r; tx <= Math.floor(s.x) + r; tx++) {
          if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
          const i = ty * W + tx;
          if (st.known[i] || Math.hypot(tx + 0.5 - s.x, ty + 0.5 - s.y) > s.r + 0.3) continue;
          st.known[i] = 1;
          changed = true;
        }
      }
    }
    if (changed) st.knownVer++;
  }

  // подсказки Искры по ситуации
  if (world.flowers.some((f) => f.stage === 3)) tip('ripe');
  if (st.seeds > 0) tip('seeds');
  if (st.oil < 1 && st.seeds === 0 && st.night.lit.length) tip('dry');
  if (st.lantern < 12) tip('low');
  const p = st.player;
  if (world.houses.some((h) => !st.met.includes(h.rid) && Math.hypot(h.x + 1 - p.x, h.y + 1 - p.y) < 4)) tip('house');

  checkQuests();
}

/** Пауза, пока открыт диалог или окно. */
export const paused = () => st.dialog.length > 0 || st.modal !== null || st.menu;

export function update(dt: number, inp: Input) {
  if (st.menu) return;
  if (st.cine) { st.time += dt; tickCine(dt); return; }
  if (paused()) return;
  st.time += dt;
  updateSpark(dt);
  if (st.scene === 'night' && st.nightOver) return;
  movePlayer(dt, inp);

  // удержание E
  if (!inp.hold) st.holdLock = false;
  const a = currentAct();
  if (a && a.ok && inp.hold && !st.holdLock) {
    if (st.hold.key !== a.key) { st.hold.key = a.key; st.hold.t = 0; }
    st.hold.time = a.time;
    st.hold.t += dt;
    if (st.hold.t >= a.time) {
      st.hold.key = '';
      st.hold.t = 0;
      st.holdLock = true;
      a.run();
    }
  } else {
    st.hold.key = '';
    st.hold.t = 0;
  }

  if (st.scene === 'night') updateNight(dt);
}

// ---------- сохранение ----------

const SAVE_KEY = 'lamplighter-save-v2';

export function save() {
  const data = {
    lumens: st.lumens, up: st.up, stars: st.stars, met: st.met, movedIn: st.movedIn, quests: st.quests,
    nights: st.nights, notesRead: st.notesRead, seen: st.seen, tips: st.tips, dryNights: st.dryNights,
    hasJournal: st.hasJournal, journal: st.journal, journalNew: st.journalNew, beacons: st.beacons,
    known: Array.from(st.known).join(''),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* без сохранения */ }
}

/** Загружает сохранение. false — сохранения нет (новая игра). */
export function load(): boolean {
  let data;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { data = null; }
  if (!data) return false;
  st.lumens = data.lumens ?? 0;
  st.up = emptyUps();
  // старые улучшения-цифры переехали на небо: возвращаем потраченный на них Свет
  let refund = 0;
  for (const [id, n] of Object.entries(data.up ?? {}) as [string, number][]) {
    if (id in st.up) st.up[id as UpId] = n;
    else if (OLD_UPS[id]) for (let i = 0; i < n; i++) refund += Math.ceil(OLD_UPS[id][0] * Math.pow(OLD_UPS[id][1], i));
  }
  if (refund > 0) {
    st.lumens += refund;
    st.events.push(`Улучшения переехали на звёздное небо. Возвращено ${refund} Света — зажги звёзды у телескопа`);
  }
  st.stars = Array.isArray(data.stars) && data.stars.includes('center') ? data.stars : ['center'];
  skyVer++;
  st.met = data.met ?? [];
  st.movedIn = data.movedIn ?? [];
  st.quests = data.quests ?? {};
  st.nights = data.nights ?? 0;
  st.notesRead = data.notesRead ?? 0;
  st.seen = { ...st.seen, ...data.seen };
  st.tips = data.tips ?? {};
  st.dryNights = data.dryNights ?? 0;
  st.hasJournal = data.hasJournal ?? false;
  st.journal = data.journal ?? [];
  if (st.seen.firstReturn && st.hasJournal && !st.journal.includes('sky')) { st.journal.push('sky'); st.journalNew = true; }
  st.journalNew = data.journalNew ?? false;
  st.beacons = data.beacons ?? [];
  const k: string = data.known ?? '';
  for (let i = 0; i < k.length && i < st.known.length; i++) st.known[i] = k[i] === '1' ? 1 : 0;
  st.knownVer++;
  return true;
}

export function resetSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ничего */ }
  location.reload();
}

/** Начало игры: загрузка или вступление. */
export function boot() {
  const loaded = load();
  // перезагрузили страницу посреди первой ночи — всё равно объясним мастерскую
  if (loaded && st.seen.intro && !st.seen.firstReturn) { st.seen.firstReturn = true; say(SPARK_HOME); }
  return loaded;
}

export { RESIDENTS };
