// Заглушки вместо арта: всё рисуется фигурами (Graphics) вокруг точки 0,0 = центр тайла.
// Когда появятся настоящие спрайты, заменять нужно только этот файл.

import { Graphics, Texture } from 'pixi.js';
import { TW, TH, toScreen } from './iso';
import type { Lamp, Flower } from './map';
import { burning, lampCap } from './game';
import { BIOMES, shade, type Biome } from './palette';
import { drawHouse } from './houses';
export { drawHouse };

export const hash = (x: number, y: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

/** Ромб тайла (с запасом в полпикселя, чтобы между тайлами не было щелей). */
export function diamond(g: Graphics, x: number, y: number, color: number, alpha = 1) {
  const s = toScreen(x, y);
  g.poly([s.x, s.y - 0.5, s.x + TW / 2 + 0.5, s.y + TH / 2, s.x, s.y + TH + 0.5, s.x - TW / 2 - 0.5, s.y + TH / 2])
    .fill({ color, alpha });
}

/** Текстура мягкого пятна света со «ступеньками» — пиксельный стиль. */
export function makeLightTexture() {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      let a = d >= 1 ? 0 : d < 0.4 ? 1 : 1 - (d - 0.4) / 0.6;
      a = Math.ceil(a * a * 5) / 5; // 5 ступенек яркости
      img.data.set([255, 255, 255, a * 255], (y * n + x) * 4);
    }
  }
  g.putImageData(img, 0, 0);
  return Texture.from(c);
}

/** Ореол у стекла: яркий центр и быстрый спад, ступеньками — свечение в воздухе. */
export function makeHaloTexture() {
  const n = 64;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.min(1, Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2));
      const a = Math.floor(Math.pow(1 - d, 2.4) * 7) / 6; // 6 ступенек, край тает в ноль
      img.data.set([255, 255, 255, a * 255], (y * n + x) * 4);
    }
  }
  g.putImageData(img, 0, 0);
  return Texture.from(c);
}

// ---------- заглушки объектов (рисуются вокруг точки 0,0 = центр тайла) ----------

/** Дерево: круглое пушистое или ёлка — смотря какой район. v — случайное число дерева 0..1. */
export function drawTree(g: Graphics, v: number, b: Biome = BIOMES.street) {
  const round = hash(v * 91, 7) < b.round;
  g.ellipse(0, 1, 9, 3.5).fill({ color: 0x000000, alpha: 0.25 });
  g.rect(-1, -6, 3, 7).fill(0x7a4a26);
  g.rect(1, -6, 1, 7).fill(0x5a3418);
  if (round) {
    const [d, m, l] = b.leaves;
    const h = 15 + Math.round(v * 6);
    // тёмная «подложка» снизу и справа — объём; основной цвет; блики слева сверху
    g.circle(1, -h + 1, 9).fill(d);
    g.circle(-5, -h + 4, 6).fill(d);
    g.circle(6, -h + 4, 6).fill(d);
    g.circle(-1, -h - 1, 8).fill(m);
    g.circle(-5, -h + 2, 5).fill(m);
    g.circle(4, -h + 2, 5).fill(m);
    g.circle(-3, -h - 3, 4).fill(l);
    g.circle(-6, -h + 1, 2).fill(l);
    g.rect(-4, -h - 6, 2, 1).fill(shade(l, 1.15));
    // пара тёмных «просветов» в кроне
    g.rect(2, -h + 1, 2, 1).fill(d);
    g.rect(-2, -h + 4, 1, 1).fill(d);
    return;
  }
  const [d, m, l] = b.pine;
  const k = 1 + v * 0.35;
  for (let i = 0; i < 3; i++) {
    const by = -6 - Math.round(i * 6 * k), ty = by - Math.round(11 * k), w = 10 - i * 2;
    g.poly([0, ty, w, by, 0, by + 1]).fill(d);
    g.poly([0, ty, -w, by, 0, by + 1]).fill(m);
    g.poly([0, ty + 2, -w + 3, by - 1, -w + 5, by - 1]).fill(l);
  }
}

/** Стекло фонаря: [кайма, середина, раскалённое ядро] когда горит, и цвет тёмного стекла. */
const GLASS: Record<string, { on: [number, number, number]; off: number }> = {
  oil: { on: [0xff9a2a, 0xffd36b, 0xfff6d8], off: 0x2b2b3a },
  gas: { on: [0x5a9aff, 0xb8e0ff, 0xffffff], off: 0x2a3a5a },
  stubborn: { on: [0xff4a2a, 0xff8a6a, 0xffe2c8], off: 0x4a2020 },
  marsh: { on: [0x2ac868, 0x9affb0, 0xeafff0], off: 0x1e3a28 },
  beacon: { on: [0xffc040, 0xfff0b0, 0xffffff], off: 0x3a3a44 },
};

/** На какой высоте (пикселей от земли) центр стекла — там рисуется ореол. */
export function glassHeight(l: Lamp) {
  if (l.kind === 'beacon') return l.name === 'Старый маяк' ? 58 : 40;
  return l.kind === 'gas' ? 26 : l.kind === 'marsh' ? 21 : 24;
}

/** Имя картинки художника для фонаря: lamp_oil_on, beacon_off, lighthouse_on… */
export function lampArt(l: Lamp, on: boolean) {
  const base = l.kind === 'beacon' ? (l.name === 'Старый маяк' ? 'lighthouse' : 'beacon') : `lamp_${l.kind}`;
  return `${base}_${on ? 'on' : 'off'}`;
}

/** Стекло 3 тонами: кайма, середина, белое ядро и блик — так кажется, что внутри огонь. */
function glass(g: Graphics, x: number, y: number, w: number, h: number, kind: string, on: boolean) {
  const G = GLASS[kind];
  if (!on) {
    g.rect(x, y, w, h).fill(G.off);
    g.rect(x, y, 1, 1).fill(0x6a7aa0); // отблеск луны на холодном стекле
    return;
  }
  const [edge, mid, core] = G.on;
  g.rect(x, y, w, h).fill(edge);
  g.rect(x + 1, y + 1, w - 2, h - 1).fill(mid);
  g.rect(x + Math.floor(w / 2) - 1, y + Math.floor(h / 2), 2, 2).fill(core);
}

/** Фонарь. overlay — только то, что поверх картинки художника: полоска масла и тлеющая искра. */
export function drawLamp(g: Graphics, l: Lamp, overlay = false) {
  const on = burning(l);
  if (!overlay) drawLampBody(g, l, on);
  // тлеющая искра после первого захода (упрямый)
  if (l.kindled > 0) { g.rect(-1, -24, 1, 1).fill(0xffb040); g.rect(1, -26, 1, 1).fill(0xff8020); }
  // полоска масла
  if (l.everLit && l.kind !== 'marsh' && l.kind !== 'beacon') {
    const k = l.oil / lampCap(l);
    g.rect(-6, -40, 12, 3).fill(0x111118);
    if (k > 0) g.rect(-5, -39, Math.max(1, Math.round(10 * k)), 1).fill(k < 0.25 ? 0xe05040 : 0xf0b040);
  }
}

function drawLampBody(g: Graphics, l: Lamp, on: boolean) {
  g.ellipse(0, 1, 5, 2).fill({ color: 0x000000, alpha: 0.3 });
  // металл ловит отсвет огня: левый край столба и рамки тёплый, когда фонарь горит
  const rim = on ? 0x6a5a58 : 0x3a4060;

  if (l.kind === 'beacon') {
    // каменная башенка; «Старый маяк» — высокий, в красно-белую полоску
    const tall = l.name === 'Старый маяк';
    const h = tall ? 52 : 34;
    g.ellipse(0, 1, 9, 3.5).fill({ color: 0x000000, alpha: 0.35 });
    g.poly([-7, 0, 7, 0, 5, -h, -5, -h]).fill(tall ? 0xe8e0d8 : 0x8a8078);
    g.poly([1, 0, 7, 0, 5, -h, 1, -h]).fill(tall ? 0xc8beb4 : 0x6e665e);
    if (tall) for (let y = -10; y > -h; y -= 14) g.poly([-7 + (-y / h) * 2, y, 7 - (-y / h) * 2, y, 6.6 - (-y / h) * 2, y - 6, -6.6 + (-y / h) * 2, y - 6]).fill(0xc83a32);
    else for (let y = -6; y > -h; y -= 7) g.rect(-5, y, 10, 1).fill(0x5a524a);
    g.rect(-6, -h - 2, 12, 2).fill(0x2a2a38);
    g.rect(-4, -h - 9, 8, 7).fill(0x2a2a38);
    glass(g, -3, -h - 8, 6, 5, 'beacon', on);
    g.poly([-5, -h - 9, 0, -h - 14, 5, -h - 9]).fill(0x2a2a38);
    return;
  }

  if (l.kind === 'marsh') {
    // кривой деревянный шест с зелёным шаром
    g.poly([-1, 0, 1, 0, 2, -10, 0, -18, -2, -18, 0, -10]).fill(0x5a4a2a);
    g.circle(-1, -21, 3.5).fill(on ? GLASS.marsh.on[0] : GLASS.marsh.off);
    if (on) { g.circle(-1, -21, 2.5).fill(GLASS.marsh.on[1]); g.rect(-2, -22, 2, 2).fill(GLASS.marsh.on[2]); }
    else g.rect(-3, -23, 1, 1).fill(0x6a8aa0);
    g.rect(-5, -16, 3, 1).fill(0x3a7a3a);
  } else if (l.kind === 'gas') {
    // чугунный столб с узором и большим плафоном
    g.rect(-2, -2, 4, 3).fill(0x1d2030);
    g.rect(-1, -22, 2, 21).fill(0x2a3048);
    g.rect(-1, -22, 1, 21).fill(rim);
    g.rect(-3, -12, 6, 1).fill(0x3a4060);
    g.poly([-4, -22, 5, -22, 4, -30, -3, -30]).fill(0x1d2030);
    glass(g, -2, -29, 5, 6, 'gas', on);
    g.poly([-5, -30, 0.5, -34, 6, -30]).fill(0x1d2030);
  } else {
    // обычный и упрямый (у упрямого — ставни от ветра)
    g.rect(-2, -2, 4, 3).fill(0x1d1d28);
    g.rect(-1, -20, 2, 19).fill(l.kind === 'stubborn' ? 0x4a2a2a : 0x2a2a38);
    g.rect(-1, -20, 1, 19).fill(rim);
    g.rect(-3, -27, 7, 7).fill(0x1d1d28);
    glass(g, -2, -26, 5, 5, l.kind, on);
    if (l.kind === 'stubborn') { g.rect(-5, -27, 2, 7).fill(0x6a3020); g.rect(4, -27, 2, 7).fill(0x6a3020); }
    g.poly([-4, -27, 0.5, -31, 5, -27]).fill(0x1d1d28);
  }
}

export function drawFlower(g: Graphics, f: Flower) {
  const spots: [number, number][] = [[-6, 0], [0, -2], [6, 0], [0, 3]];
  g.ellipse(0, 1, 11, 4).fill({ color: 0x4a3a22, alpha: 0.6 });
  for (const [ox, oy] of spots) {
    if (f.stage === 0) {
      g.rect(ox, oy - 4, 1, 4).fill(0x6b5a3a);
      g.rect(ox + 1, oy - 4, 2, 1).fill(0x5a4a30);
    } else if (f.stage === 1) {
      g.rect(ox, oy - 2, 1, 2).fill(0x4caf50);
      g.rect(ox - 1, oy - 3, 1, 1).fill(0x66cc55);
      g.rect(ox + 1, oy - 3, 1, 1).fill(0x66cc55);
    } else if (f.stage === 2) {
      g.rect(ox, oy - 7, 1, 7).fill(0x3e9a40);
      g.rect(ox + 1, oy - 4, 2, 1).fill(0x5cbf4a);
      g.rect(ox - 1, oy - 9, 3, 2).fill(0x7acc50);
    } else {
      g.rect(ox, oy - 8, 1, 8).fill(0x3e9a40);
      g.rect(ox + 1, oy - 4, 2, 1).fill(0x5cbf4a);
      g.rect(ox - 2, oy - 12, 5, 5).fill(0xffd23a);
      g.rect(ox - 1, oy - 13, 3, 7).fill(0xffd23a);
      g.rect(ox - 3, oy - 11, 7, 3).fill(0xffd23a);
      g.rect(ox - 1, oy - 11, 3, 3).fill(0x6b3e1a);
    }
  }
}

/** Изометрическая коробка w×d тайлов высотой h (от точки 0,0 = верхний угол основания). */
export function isoBox(g: Graphics, w: number, d: number, h: number, left: number, right: number, top: number) {
  const r = toScreen(w, 0), b = toScreen(w, d), l = toScreen(0, d);
  g.poly([l.x, l.y, b.x, b.y, b.x, b.y - h, l.x, l.y - h]).fill(left);
  g.poly([b.x, b.y, r.x, r.y, r.x, r.y - h, b.x, b.y - h]).fill(right);
  g.poly([0, -h, r.x, r.y - h, b.x, b.y - h, l.x, l.y - h]).fill(top);
  return { r, b, l };
}

/** Маслобойня: винтовой пресс на деревянной раме, колесо-ворот, бочка с маслом и мешок семечек. */
export function drawPress(g: Graphics) {
  isoBox(g, 1, 1, 7, 0x7a5232, 0x5a3a20, 0x9a6e40);
  const c = toScreen(0.5, 0.5);
  // доски на крышке
  g.rect(c.x - 6, c.y - 8, 12, 1).fill(0x845c34);
  // две стойки и перекладина
  g.rect(c.x - 7, c.y - 26, 2, 18).fill(0x6b4423);
  g.rect(c.x - 7, c.y - 26, 1, 18).fill(0x8a5a32);
  g.rect(c.x + 5, c.y - 26, 2, 18).fill(0x4a2e18);
  g.rect(c.x - 8, c.y - 28, 16, 3).fill(0x7a5232);
  g.rect(c.x - 8, c.y - 28, 16, 1).fill(0xa87a48);
  // винт с резьбой
  for (let y = -25; y < -12; y += 2) {
    g.rect(c.x - 1, c.y + y, 3, 1).fill(0x9a9aa8);
    g.rect(c.x - 1, c.y + y + 1, 3, 1).fill(0x5a5a66);
  }
  // давильная плита и чан
  g.ellipse(c.x, c.y - 10, 6, 2.5).fill(0x4a3220);
  g.rect(c.x - 5, c.y - 13, 10, 3).fill(0x8a5a32);
  g.ellipse(c.x, c.y - 13, 5, 2).fill(0xa87a48);
  // колесо-ворот сбоку
  g.circle(c.x + 9, c.y - 20, 5).fill(0x5a3a20);
  g.circle(c.x + 9, c.y - 20, 4).fill(0x8a5a32);
  g.circle(c.x + 9, c.y - 20, 2.5).fill(0x5a3a20);
  g.rect(c.x + 5, c.y - 20, 9, 1).fill(0xa87a48);
  g.rect(c.x + 9, c.y - 24, 1, 9).fill(0xa87a48);
  g.circle(c.x + 9, c.y - 20, 1).fill(0x3a2410);
  // бочка, в которую капает масло
  g.ellipse(c.x - 11, c.y + 1, 4, 1.5).fill({ color: 0x000000, alpha: 0.25 });
  g.rect(c.x - 14, c.y - 7, 7, 8).fill(0x8a5a32);
  g.rect(c.x - 14, c.y - 7, 2, 8).fill(0xa87a48);
  g.rect(c.x - 14, c.y - 5, 7, 1).fill(0x5a5a66);
  g.rect(c.x - 14, c.y - 1, 7, 1).fill(0x5a5a66);
  g.ellipse(c.x - 10.5, c.y - 7, 3.5, 1.2).fill(0xe0b030);
  g.rect(c.x - 9, c.y - 11, 1, 3).fill(0xf0c040);
  // мешок семечек
  g.ellipse(c.x + 10, c.y + 3, 4, 3).fill(0xc8b080);
  g.ellipse(c.x + 9, c.y + 2, 2, 1.5).fill(0xe0cc9a);
  g.rect(c.x + 9, c.y - 1, 2, 1).fill(0x8a7a50);
  g.rect(c.x + 11, c.y + 2, 1, 1).fill(0x3a2a1a);
  g.rect(c.x + 8, c.y + 4, 1, 1).fill(0x3a2a1a);
}

export function drawPerson(g: Graphics, face: number, anim: number, moving: boolean, coat: number, hat: boolean, lantern: boolean) {
  const step = moving ? Math.floor(anim * 8) % 2 : 0;
  const bob = moving && step ? -1 : 0;
  g.ellipse(0, 0, 5, 2).fill({ color: 0x000000, alpha: 0.35 });
  g.rect(-2, -3, 2, 3 - step).fill(0x1a1a24);
  g.rect(1, -3, 2, 2 + step).fill(0x1a1a24);
  g.rect(-3, -11 + bob, 7, 8).fill(coat);
  g.rect(-2, -15 + bob, 5, 4).fill(0xf0c8a0);
  g.rect(face > 0 ? 1 : -1, -14 + bob, 1, 1).fill(0x1a1a24);
  if (hat) {
    g.rect(-3, -16 + bob, 7, 2).fill(0x1a1a22);
    g.rect(-2, -20 + bob, 5, 4).fill(0x1a1a22);
  } else {
    g.rect(-2, -16 + bob, 5, 2).fill(0x6b3e1a);
  }
  if (lantern) {
    const lx = face > 0 ? 4 : -6;
    g.rect(lx + 1, -10 + bob, 1, 2).fill(0x1a1a24);
    g.rect(lx, -8 + bob, 3, 4).fill(0xffd36b);
  }
}


/** Утка на воде (0,0 — уровень воды). drake — селезень с зелёной головой, small — утёнок. */
export function drawDuck(g: Graphics, t: number, kind: 'drake' | 'duck' | 'small') {
  const k = kind === 'small' ? 0.6 : 1;
  const body = kind === 'drake' ? 0xf0ece4 : kind === 'duck' ? 0x9a7a52 : 0xf0d060;
  const shadeC = kind === 'drake' ? 0xc8c0b4 : kind === 'duck' ? 0x6e5434 : 0xc8a838;
  const head = kind === 'drake' ? 0x2a7a4a : body;
  const bob = Math.sin(t * 2.2) > 0 ? 0 : 0.5;
  // круги на воде
  g.ellipse(0, 0.5, 7 * k, 1.6 * k).fill({ color: 0xbfe8ff, alpha: 0.35 });
  g.ellipse(0, -2 * k + bob, 4.5 * k, 2.3 * k).fill(body);
  g.ellipse(-0.5, -1.2 * k + bob, 4 * k, 1.1 * k).fill(shadeC);
  g.rect(-5 * k, -4 * k + bob, 2 * k, 1.2 * k).fill(shadeC);              // хвостик
  g.circle(3 * k, -5 * k + bob, 1.9 * k).fill(head);                       // голова
  if (kind === 'drake') g.rect(2 * k, -3.4 * k + bob, 2.5 * k, 0.8).fill(0xffffff); // белый ошейник
  g.rect(4.4 * k, -5.2 * k + bob, 2 * k, 1.1 * k).fill(0xf0a030);          // клюв
  g.rect(3.2 * k, -5.8 * k + bob, 0.8, 0.8).fill(0x1a1420);                 // глаз
}

// ---------- мебель мастерской (рисуется от верхнего угла основания) ----------

/** Точка на передней (левой) грани коробки w×d: u — доля вдоль грани, v — высота. */
function front(w: number, d: number, u: number, v: number) {
  const l = toScreen(0, d), b = toScreen(w, d);
  return [l.x + (b.x - l.x) * u, l.y + (b.y - l.y) * u - v];
}

/** Четырёхугольник на передней грани: от u0 до u1, от v0 до v1. */
function frontQuad(g: Graphics, w: number, d: number, u0: number, u1: number, v0: number, v1: number, color: number) {
  g.poly([...front(w, d, u0, v0), ...front(w, d, u1, v0), ...front(w, d, u1, v1), ...front(w, d, u0, v1)]).fill(color);
}

export function drawBench(g: Graphics) {
  isoBox(g, 2, 1, 10, 0x7a5232, 0x8f6238, 0xa87a48);
  const c = toScreen(1, 0.5);
  g.rect(c.x - 10, c.y - 13, 8, 2).fill(0x9a9aa8); // пила
  g.rect(c.x + 2, c.y - 14, 2, 5).fill(0x5a3a1e); // молоток
  g.rect(c.x + 1, c.y - 15, 5, 2).fill(0x6a6a78);
  g.rect(c.x + 8, c.y - 13, 3, 3).fill(0xffd36b); // фонарь на починке
}

/** Телескоп: латунная труба на треноге с подносом, искатель, колесо наводки; рядом столик с картой звёзд. */
export function drawTelescope(g: Graphics, t: number) {
  const c = toScreen(0.5, 0.5);
  const x = c.x, y = c.y;
  g.ellipse(x, y + 1, 9, 3).fill({ color: 0x000000, alpha: 0.25 });
  // тренога с подносом между ногами
  g.poly([x - 8, y + 1, x - 7, y + 1, x - 1, y - 12, x - 2, y - 12]).fill(0x6b4423);
  g.poly([x + 7, y + 1, x + 8, y + 1, x + 1, y - 12, x, y - 12]).fill(0x4a2e18);
  g.rect(x, y - 12, 1, 14).fill(0x5a3a20);
  g.poly([x - 5, y - 4, x, y - 6, x + 5, y - 4, x, y - 2]).fill(0x8a5a32);
  g.rect(x - 3, y - 14, 7, 2).fill(0x7a5232);
  g.rect(x - 1, y - 16, 3, 2).fill(0xc8963e);      // поворотный узел
  g.circle(x + 3, y - 15, 1.5).fill(0x8a6a2a);       // колесо наводки
  // труба: от окуляра вниз-слева к объективу вверх-справа, латунь с бликом и кольцами
  for (let i = 0; i < 10; i++) {
    const px = x - 8 + i * 2, py = y - 13 - i * 2;
    g.rect(px, py, 4, 4).fill(i < 4 ? 0xa8762a : 0xc8963e);
    g.rect(px, py, 4, 1).fill(i < 4 ? 0xc8963e : 0xf0c870);
    g.rect(px + 3, py + 3, 1, 1).fill(0x7a5420);
  }
  for (const i of [3, 7]) g.rect(x - 8 + i * 2, y - 14 - i * 2, 1, 6).fill(0x6a4a1a);
  g.rect(x - 11, y - 12, 4, 3).fill(0x2a2018);       // окуляр
  g.rect(x - 11, y - 12, 1, 3).fill(0x4a3a2a);
  g.rect(x + 11, y - 34, 6, 6).fill(0xe8c060);       // объектив
  g.rect(x + 12, y - 33, 4, 4).fill(0x2a4a7a);
  g.rect(x + 13, y - 32, 1, 1).fill(Math.sin(t * 2) > 0.6 ? 0xffffff : 0x9ad0ff); // блик
  // маленький искатель сверху
  g.rect(x + 1, y - 26, 6, 2).fill(0x5a5a66);
  g.rect(x + 7, y - 27, 2, 2).fill(0x9ad0ff);
  // столик с картой звёзд и циркулем
  g.rect(x - 15, y - 7, 1, 7).fill(0x4a2e18);
  g.rect(x - 9, y - 7, 1, 7).fill(0x4a2e18);
  g.poly([x - 17, y - 8, x - 12, y - 10, x - 7, y - 8, x - 12, y - 6]).fill(0x8a5a32);
  g.poly([x - 16, y - 8.5, x - 12, y - 10, x - 8, y - 8.5, x - 12, y - 7]).fill(0x1c2a4a);
  for (const [dx, dy] of [[-14, -9], [-12, -8], [-10, -9], [-12, -9.5]]) g.rect(x + dx, y + dy, 1, 1).fill(0xfff4c8);
  g.rect(x - 11, y - 11, 1, 3).fill(0x9a9aa8);
}

/** Огород Агаты на подоконнике: ящик с землёй, рассада, два подсолнуха и лейка. */
export function drawPlanter(g: Graphics) {
  isoBox(g, 1, 2, 7, 0x8f6238, 0x6e4a2a, 0x4a3220);
  // доски ящика
  for (let k = 1; k < 3; k++) {
    const l = toScreen(0, 2), b = toScreen(1, 2);
    g.rect(l.x, l.y - k * 2.5, b.x - l.x, 1).fill(0x7a5232);
  }
  for (const [x, y, flower] of [[0.5, 0.35, 0], [0.5, 0.75, 2], [0.5, 1.15, 1], [0.5, 1.6, 0]] as const) {
    const c = toScreen(x, y);
    if (flower === 2) { // маленький росток
      g.rect(c.x, c.y - 10, 1, 3).fill(0x4caf50);
      g.rect(c.x - 1, c.y - 11, 1, 1).fill(0x7acc50); g.rect(c.x + 1, c.y - 11, 1, 1).fill(0x7acc50);
      continue;
    }
    g.rect(c.x, c.y - 15, 1, 8).fill(0x3e9a40);
    g.rect(c.x + 1, c.y - 11, 2, 1).fill(0x5cbf4a);
    g.rect(c.x - 2, c.y - 13, 2, 1).fill(0x7acc50);
    if (flower) {
      g.rect(c.x - 2, c.y - 19, 5, 5).fill(0xffd23a);
      g.rect(c.x - 1, c.y - 20, 3, 7).fill(0xffd23a);
      g.rect(c.x - 3, c.y - 18, 7, 3).fill(0xffd23a);
      g.rect(c.x - 1, c.y - 18, 3, 3).fill(0x6b3e1a);
      g.rect(c.x - 2, c.y - 19, 1, 1).fill(0xfff07a);
    } else g.rect(c.x - 1, c.y - 17, 3, 2).fill(0x7acc50);
  }
  // лейка у ящика
  const w = toScreen(1.25, 1.9);
  g.ellipse(w.x, w.y, 4, 1.5).fill({ color: 0x000000, alpha: 0.25 });
  g.rect(w.x - 3, w.y - 6, 6, 6).fill(0x5a8ab0);
  g.rect(w.x - 3, w.y - 6, 2, 6).fill(0x7aaad0);
  g.poly([w.x + 3, w.y - 3, w.x + 8, w.y - 8, w.x + 8, w.y - 7, w.x + 3, w.y - 2]).fill(0x5a8ab0);
  g.rect(w.x - 2, w.y - 9, 4, 1).fill(0x3a6a90);
}

/** Наковальня на пне: правильный силуэт (рог, пятка, талия, лапы), раскалённая заготовка, молот, клещи и ведро воды. */
export function drawAnvil(g: Graphics) {
  const c = toScreen(0.5, 0.5);
  const x = c.x, y = c.y;
  g.ellipse(x, y + 1, 10, 3.5).fill({ color: 0x000000, alpha: 0.25 });
  // пень с корой и годовыми кольцами
  g.rect(x - 7, y - 7, 14, 8).fill(0x6b4423);
  g.rect(x - 7, y - 7, 3, 8).fill(0x8a5a32);
  g.rect(x + 4, y - 7, 3, 8).fill(0x4a2e18);
  for (const yy of [-5, -2]) g.rect(x - 6, y + yy, 1, 2).fill(0x4a2e18);
  g.ellipse(x, y - 7, 7, 3).fill(0xb08050);
  g.ellipse(x, y - 7, 4.5, 1.9).fill(0x9a6a3a);
  g.ellipse(x, y - 7, 2, 0.8).fill(0x8a5a2e);
  // лапы и талия
  g.poly([x - 5, y - 8, x + 4, y - 8, x + 2, y - 11, x - 3, y - 11]).fill(0x3a3a44);
  g.rect(x - 2, y - 14, 4, 3).fill(0x44444e);
  // тело: плоская рабочая грань сверху, пятка слева, рог справа
  g.poly([x - 7, y - 14, x + 5, y - 14, x + 5, y - 17, x - 7, y - 17]).fill(0x55555f);
  g.poly([x + 5, y - 17, x + 12, y - 15.5, x + 5, y - 14]).fill(0x4a4a54);   // рог
  g.poly([x - 7, y - 17, x - 9, y - 17, x - 7, y - 15]).fill(0x4a4a54);       // пятка
  g.rect(x - 7, y - 18, 12, 1).fill(0x9a9aa8);                                  // блик на грани
  g.poly([x + 5, y - 18, x + 12, y - 15.5, x + 11, y - 15.5, x + 5, y - 17]).fill(0x8a8a96);
  g.rect(x - 5, y - 16, 1, 1).fill(0x2a2a34);                                   // отверстие
  // раскалённая заготовка
  g.rect(x - 2, y - 19, 5, 1).fill(0xff8a2a);
  g.rect(x - 1, y - 19, 2, 1).fill(0xffd36b);
  // молот на пне и клещи
  g.rect(x + 6, y - 9, 1, 7).fill(0x8a5a32);
  g.rect(x + 4, y - 11, 5, 3).fill(0x5a5a66);
  g.rect(x + 4, y - 11, 5, 1).fill(0x9a9aa8);
  g.poly([x - 10, y - 2, x - 9, y - 2, x - 4, y - 12, x - 5, y - 12]).fill(0x3a3a44);
  g.poly([x - 8, y - 2, x - 7, y - 2, x - 4, y - 12, x - 5, y - 12]).fill(0x2a2a34);
  // ведро с водой
  g.rect(x + 9, y - 5, 6, 6).fill(0x8a5a32);
  g.rect(x + 9, y - 5, 2, 6).fill(0xa87a48);
  g.rect(x + 9, y - 3, 6, 1).fill(0x5a5a66);
  g.ellipse(x + 12, y - 5, 3, 1).fill(0x3a8ab0);
}

/** Стол Ники с картой: река, дороги, красный маршрут, чернильница с пером и свеча. */
export function drawMapTable(g: Graphics) {
  isoBox(g, 2, 1, 9, 0x7a5232, 0x5e3e22, 0xa87a48);
  const p = (x: number, y: number) => { const s = toScreen(x, y); return [s.x, s.y - 9]; };
  // ножки
  for (const [x, y] of [[0.1, 0.9], [1.9, 0.9]]) { const [sx, sy] = p(x, y); g.rect(sx - 1, sy, 2, 8).fill(0x4a2e18); }
  // бумага карты
  g.poly([...p(0.2, 0.15), ...p(1.8, 0.15), ...p(1.8, 0.85), ...p(0.2, 0.85)]).fill(0xece0bc);
  g.poly([...p(0.2, 0.8), ...p(1.8, 0.8), ...p(1.8, 0.85), ...p(0.2, 0.85)]).fill(0xc8b890);
  // река и лес
  for (let i = 0; i < 6; i++) { const [x, y] = p(0.55 + Math.sin(i) * 0.08, 0.2 + i * 0.11); g.rect(x, y, 2, 1).fill(0x4a8ad0); }
  for (const [u, v] of [[1.5, 0.3], [1.6, 0.45], [1.4, 0.5]]) { const [x, y] = p(u, v); g.rect(x, y - 1, 1, 2).fill(0x3a8a3a); }
  // красный маршрут пунктиром и крестик
  const [ax, ay] = p(0.4, 0.6), [bx, by] = p(1.3, 0.35);
  for (let k = 0; k <= 6; k++) if (k % 2 === 0) g.rect(ax + (bx - ax) * (k / 6), ay + (by - ay) * (k / 6), 1, 1).fill(0xd04030);
  g.rect(bx - 1, by - 1, 1, 1).fill(0xd04030); g.rect(bx + 1, by - 1, 1, 1).fill(0xd04030);
  g.rect(bx, by, 1, 1).fill(0xd04030); g.rect(bx - 1, by + 1, 1, 1).fill(0xd04030); g.rect(bx + 1, by + 1, 1, 1).fill(0xd04030);
  // чернильница с пером
  const [ix, iy] = p(1.65, 0.7);
  g.rect(ix - 1, iy - 3, 3, 3).fill(0x1a1a2a);
  g.rect(ix, iy - 9, 1, 6).fill(0xf0ece0);
  g.rect(ix + 1, iy - 9, 1, 3).fill(0xd8d0c0);
  // свеча
  const [cx, cy] = p(0.3, 0.3);
  g.rect(cx, cy - 5, 2, 5).fill(0xf4ecd8);
  g.rect(cx, cy - 7, 2, 2).fill(0xffd36b);
  g.rect(cx, cy - 8, 1, 1).fill(0xffffff);
}

/** Почтовая сумка Севы: кожаная, с клапаном и пряжкой, из неё торчат письма; рядом стопка, перевязанная бечёвкой. */
export function drawMailbag(g: Graphics) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y, 9, 3).fill({ color: 0x000000, alpha: 0.25 });
  // письма в сумке
  g.rect(c.x - 5, c.y - 14, 4, 6).fill(0xf4ecd8);
  g.rect(c.x - 1, c.y - 15, 4, 6).fill(0xe8dcc0);
  g.rect(c.x + 2, c.y - 13, 3, 5).fill(0xf0e4c8);
  g.rect(c.x, c.y - 13, 1, 1).fill(0xc83a32);
  // сумка
  g.ellipse(c.x, c.y - 5, 7, 6).fill(0x8a5a2a);
  g.ellipse(c.x - 2, c.y - 6, 4, 4).fill(0xa8703a);
  g.poly([c.x - 7, c.y - 9, c.x + 7, c.y - 9, c.x + 6, c.y - 4, c.x - 6, c.y - 4]).fill(0x6a4220); // клапан
  g.rect(c.x - 1, c.y - 6, 3, 2).fill(0xd8b050);
  g.rect(c.x - 7, c.y - 10, 14, 1).fill(0x5a361a);
  // стопка писем рядом
  g.rect(c.x + 6, c.y - 3, 6, 3).fill(0xf0e4c8);
  g.rect(c.x + 6, c.y - 5, 6, 2).fill(0xf8f0dc);
  g.rect(c.x + 8, c.y - 5, 1, 5).fill(0xa87a48);
}

/** Насест Филина: Т-образная жёрдочка на подставке, под ней пёрышки. owl — нарисовать сову кодом (если нет картинки). */
export function drawPerch(g: Graphics, t: number, owl = true) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y, 7, 2.5).fill({ color: 0x000000, alpha: 0.25 });
  g.ellipse(c.x, c.y - 1, 5, 2).fill(0x5a3a1e);
  g.rect(c.x - 1, c.y - 18, 2, 17).fill(0x6b4423);
  g.rect(c.x - 1, c.y - 18, 1, 17).fill(0x8a5a32);
  g.rect(c.x - 7, c.y - 19, 14, 2).fill(0x7a5232);
  g.rect(c.x - 7, c.y - 19, 14, 1).fill(0xa87a48);
  g.rect(c.x + 5, c.y - 17, 1, 3).fill(0x8a8a96); // колечко
  // пёрышки на полу
  g.rect(c.x + 4, c.y + 1, 3, 1).fill(0xb0a07c);
  g.rect(c.x - 6, c.y, 2, 1).fill(0x8a7a5a);
  if (!owl) return;
  const blink = Math.floor(t * 0.7) % 6 === 0 ? 1 : 2;
  g.ellipse(c.x, c.y - 25, 5, 6).fill(0x7a6a50);
  g.ellipse(c.x, c.y - 23, 3, 3).fill(0xa89878);
  g.rect(c.x - 3, c.y - 28, 2, blink).fill(0xffd23a);
  g.rect(c.x + 1, c.y - 28, 2, blink).fill(0xffd23a);
  g.poly([c.x - 5, c.y - 30, c.x - 3, c.y - 33, c.x - 2, c.y - 30]).fill(0x7a6a50);
  g.poly([c.x + 5, c.y - 30, c.x + 3, c.y - 33, c.x + 2, c.y - 30]).fill(0x7a6a50);
}

/** Печь Милы: кирпичная, арка с огнём, на полке хлеб, рядом лопата для хлеба. */
export function drawOven(g: Graphics, t: number) {
  isoBox(g, 2, 1, 20, 0xb0583a, 0x8a4430, 0x7a3a28);
  // кирпичная кладка на передней стенке
  for (let v = 2; v < 20; v += 4) {
    frontQuad(g, 2, 1, 0, 1, v, v + 0.6, 0x8a4430);
    for (let u = (v / 4) % 2 ? 0.08 : 0.16; u < 1; u += 0.16) frontQuad(g, 2, 1, u, u + 0.02, v, v + 4, 0x8a4430);
  }
  // арка и огонь
  frontQuad(g, 2, 1, 0.28, 0.72, 2, 13, 0x5a2a1e);
  frontQuad(g, 2, 1, 0.32, 0.68, 2, 12, 0x2a120a);
  const flick = Math.sin(t * 8) > 0 ? 1 : 0;
  frontQuad(g, 2, 1, 0.36, 0.64, 2, 6 + flick, 0xff8a2a);
  frontQuad(g, 2, 1, 0.42, 0.58, 2, 4 + flick, 0xffd36b);
  frontQuad(g, 2, 1, 0.34, 0.66, 2, 3, 0x6a3a1a); // поленья
  // полка с хлебом сверху
  const top = (x: number, y: number) => { const s = toScreen(x, y); return [s.x, s.y - 20]; };
  for (const [u, v] of [[0.5, 0.4], [1.0, 0.5], [1.5, 0.4]]) {
    const [bx, by] = top(u, v);
    g.ellipse(bx, by - 2, 4, 2.2).fill(0xc8803a);
    g.ellipse(bx - 1, by - 3, 2.5, 1.2).fill(0xe8a85a);
    g.rect(bx - 1, by - 2, 2, 1).fill(0xa8642a);
  }
  // труба
  const c = toScreen(1.6, 0.3);
  g.rect(c.x - 2, c.y - 36, 5, 16).fill(0x7a3a28);
  g.rect(c.x + 1, c.y - 36, 2, 16).fill(0x5a2a1e);
  // лопата для хлеба прислонена сбоку
  const l = toScreen(2, 1);
  g.poly([l.x + 1, l.y - 1, l.x + 2, l.y - 1, l.x + 6, l.y - 22, l.x + 5, l.y - 22]).fill(0x9a6e40);
  g.poly([l.x + 3, l.y - 22, l.x + 8, l.y - 22, l.x + 8, l.y - 29, l.x + 3, l.y - 29]).fill(0xb08050);
}

/** Камин: каменная кладка, каменный под перед топкой, поленья крест-накрест, живой огонь из нескольких языков,
 *  угли, чайник на крюке, кочерга и совок на подставке; на полке — свечи, часы и баночка. */
export function drawFireplace(g: Graphics, t: number) {
  isoBox(g, 2, 1, 30, 0x9a9088, 0x7e766c, 0x6a625a);
  // камни на передней стенке
  for (let v = 0; v < 30; v += 6) {
    frontQuad(g, 2, 1, 0, 1, v, v + 0.8, 0x6e665e);
    for (let u = (v / 6) % 2 ? 0.1 : 0.2; u < 1; u += 0.2) frontQuad(g, 2, 1, u, u + 0.025, v, v + 6, 0x6e665e);
    for (let u = (v / 6) % 2 ? 0.02 : 0.12; u < 1; u += 0.2) frontQuad(g, 2, 1, u, u + 0.06, v + 4, v + 5, 0xb4aaa0);
  }
  // топка с аркой и закопчённым верхом
  frontQuad(g, 2, 1, 0.2, 0.8, 0, 19, 0x4a443c);
  frontQuad(g, 2, 1, 0.24, 0.76, 0, 17, 0x1a1210);
  frontQuad(g, 2, 1, 0.24, 0.76, 13, 17, 0x2a1e18);
  // отсвет огня на стенках топки
  const glow = 0.5 + 0.5 * Math.sin(t * 6) * Math.sin(t * 2.3);
  frontQuad(g, 2, 1, 0.24, 0.3, 1, 12, glow > 0.5 ? 0x6a2a14 : 0x5a2210);
  frontQuad(g, 2, 1, 0.7, 0.76, 1, 12, glow > 0.5 ? 0x5a2210 : 0x4a1a0c);
  // угли и поленья крест-накрест
  frontQuad(g, 2, 1, 0.28, 0.72, 0, 2, 0x8a2a10);
  for (let k = 0; k < 6; k++) frontQuad(g, 2, 1, 0.3 + k * 0.07, 0.33 + k * 0.07, 0.5, 1.5, Math.sin(t * 5 + k * 2) > 0 ? 0xff8a2a : 0xd04a1a);
  frontQuad(g, 2, 1, 0.3, 0.62, 2, 4, 0x5a3418);
  frontQuad(g, 2, 1, 0.4, 0.72, 3, 5, 0x6b4423);
  frontQuad(g, 2, 1, 0.38, 0.42, 2, 4, 0xc89a62); // спил полена
  // огонь: несколько языков разной высоты, каждый дрожит по-своему
  const tongues = [[0.32, 0.42, 9, 0], [0.4, 0.52, 13, 1.7], [0.5, 0.6, 11, 3.1], [0.58, 0.68, 8, 4.4]];
  for (const [u0, u1, h, ph] of tongues) {
    const hh = h + Math.sin(t * 9 + ph) * 2 + Math.sin(t * 23 + ph * 2);
    frontQuad(g, 2, 1, u0, u1, 4, 4 + hh, 0xff5a1a);
    frontQuad(g, 2, 1, u0 + 0.015, u1 - 0.015, 4, 4 + hh * 0.75, 0xff9a2a);
    frontQuad(g, 2, 1, u0 + 0.03, u1 - 0.03, 4, 4 + hh * 0.45, 0xffd36b);
  }
  frontQuad(g, 2, 1, 0.44, 0.56, 4, 6, 0xfff4c8);
  // искры летят вверх
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.9 + k * 0.29) % 1;
    const u = 0.4 + k * 0.05 + Math.sin(t * 3 + k) * 0.02;
    frontQuad(g, 2, 1, u, u + 0.012, 10 + ph * 7, 11 + ph * 7, ph < 0.7 ? 0xffd36b : 0xff8a2a);
  }
  // чайник на крюке над огнём
  frontQuad(g, 2, 1, 0.49, 0.51, 12, 17, 0x2a2a34);
  frontQuad(g, 2, 1, 0.42, 0.58, 9, 12, 0x3a3a44);
  frontQuad(g, 2, 1, 0.43, 0.5, 11, 12, 0x5a5a66);
  frontQuad(g, 2, 1, 0.58, 0.62, 10, 11, 0x3a3a44); // носик
  // каменный под перед топкой
  const l = toScreen(0, 1), b = toScreen(2, 1);
  const P = (u: number, d: number) => [l.x + (b.x - l.x) * u - d * 8, l.y + (b.y - l.y) * u + d * 4];
  g.poly([...P(0.12, 0), ...P(0.88, 0), ...P(0.88, 0.5), ...P(0.12, 0.5)]).fill(0x8e887e);
  g.poly([...P(0.12, 0.5), ...P(0.88, 0.5), ...P(0.88, 0.6), ...P(0.12, 0.6)]).fill(0x5a524a);
  // кочерга и совок на подставке справа
  const [tx, ty] = P(0.94, 0.3);
  g.rect(tx, ty - 16, 1, 16).fill(0x2a2a34);
  g.rect(tx + 2, ty - 15, 1, 15).fill(0x3a3a44);
  g.rect(tx - 1, ty - 17, 3, 1).fill(0xc8963e);
  g.rect(tx + 1, ty - 2, 4, 2).fill(0x3a3a44);
  // полка
  frontQuad(g, 2, 1, 0.06, 0.94, 30, 33, 0x6b4423);
  frontQuad(g, 2, 1, 0.06, 0.94, 32, 33, 0x8a5a32);
  const top = (u: number, v: number) => [l.x + (b.x - l.x) * u, l.y + (b.y - l.y) * u - v];
  for (const u of [0.16, 0.84]) {
    const [x, y] = top(u, 33);
    g.rect(x, y - 5, 2, 5).fill(0xf4ecd8);
    g.rect(x - 1, y - 1, 4, 1).fill(0xc8963e);
    g.rect(x, y - 7, 2, 2).fill(Math.sin(t * 7 + u * 9) > 0 ? 0xffd36b : 0xffb040);
  }
  const [cx, cy] = top(0.5, 33);
  g.rect(cx - 3, cy - 8, 6, 8).fill(0x7a4a26);
  g.rect(cx - 2, cy - 9, 4, 1).fill(0x9a6a3a);
  g.circle(cx, cy - 4.5, 2.2).fill(0xf4ecd8);
  const ang = t * 0.5;
  g.rect(cx + Math.round(Math.cos(ang) * 1.5), cy - 4.5 + Math.round(Math.sin(ang) * 1.5), 1, 1).fill(0x1a1420);
  g.rect(cx, cy - 5, 1, 1).fill(0x1a1420);
  const [jx, jy] = top(0.66, 33);
  g.rect(jx, jy - 4, 3, 4).fill(0x6a9ac8);
  g.rect(jx, jy - 5, 3, 1).fill(0xa87a48);
  const [px, py] = top(0.3, 33);
  g.rect(px, py - 6, 4, 5).fill(0x8a5a32);   // рамка с рисунком Ники
  g.rect(px + 1, py - 5, 2, 3).fill(0xffd23a);
}

// ---------- персонажи сюжета ----------

/** Гаситель: высокая тёмная фигура в плаще, с гасильником на шесте. */
export function drawVillain(g: Graphics, face: number, t: number, cast = false) {
  g.ellipse(0, 0, 6, 2).fill({ color: 0x000000, alpha: 0.4 });
  g.poly([-6, 0, 6, 0, 3, -20, -3, -20]).fill(0x1a1028);
  g.poly([-2, 0, 2, 0, 1, -18, -1, -18]).fill(0x2a1a40);
  g.rect(-3, -25, 6, 5).fill(0xb8b8c8);
  g.rect(-4, -26, 8, 2).fill(0x1a1028);
  g.rect(-3, -31, 6, 5).fill(0x1a1028);
  const eye = Math.sin(t * 2) > 0.9 ? 0x3a6aaa : 0x8ad0ff;
  g.rect(face > 0 ? 0 : -2, -23, 1, 1).fill(eye);
  g.rect(face > 0 ? 2 : 0, -23, 1, 1).fill(eye);
  // шест с гасильником-колпачком
  const sx = face > 0 ? 7 : -8;
  if (cast) {
    // взмах посохом: шест поднят над головой, на колпачке тёмное сияние
    g.poly([sx - 4, -14, sx - 3, -14, sx + 8 * Math.sign(sx), -46, sx + 7 * Math.sign(sx), -46]).fill(0x3a2a1a);
    const tx = sx + 7.5 * Math.sign(sx);
    g.circle(tx, -48, 5 + Math.sin(t * 20) * 1.5).fill({ color: 0x6a3aa0, alpha: 0.6 });
    g.poly([tx - 3, -46, tx + 4, -46, tx + 0.5, -52]).fill(0x5a5a66);
    return;
  }
  g.rect(sx, -34, 1, 34).fill(0x3a2a1a);
  g.poly([sx - 3, -34, sx + 4, -34, sx + 0.5, -40]).fill(0x5a5a66);
}

/** Искра: живой огонёк с крылышками. */
export function drawSpark(g: Graphics, t: number) {
  const wing = Math.sin(t * 20) > 0 ? 2 : 1;
  g.rect(-3 - wing, -2, wing + 1, 2).fill({ color: 0xffffff, alpha: 0.7 });
  g.rect(2, -2, wing + 1, 2).fill({ color: 0xffffff, alpha: 0.7 });
  g.rect(-2, -2, 4, 4).fill(0xffe08a);
  g.rect(-1, -1, 2, 2).fill(0xffffff);
  g.rect(-1, -2, 1, 1).fill(0x2a1a10);
  g.rect(1, -2, 1, 1).fill(0x2a1a10);
}

// ---------- площадь из ролика и дом фонарщика ----------

/** Фонтан: восьмигранная каменная чаша, вода с бликами и монетками, три яруса, струи падают дугами, брызги. */
export function drawFountain(g: Graphics, t: number) {
  const c = toScreen(1, 1);
  const cx = c.x, cy = c.y;
  g.ellipse(cx, cy + 1, 17, 8).fill({ color: 0x000000, alpha: 0.2 });
  // наружная чаша: бортик из камней (светлый верх, тёмный бок)
  g.ellipse(cx, cy - 2, 16, 8).fill(0x8e887e);
  g.ellipse(cx, cy - 5, 16, 8).fill(0xc6c0b4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.rect(cx + Math.cos(a) * 15 - 0.5, cy - 5 + Math.sin(a) * 7.5 - 0.5, 1, 1).fill(0x9a948a);
  }
  // вода: тёмная в глубине, светлая к краю, блики бегут кругом
  g.ellipse(cx, cy - 5, 13, 6.2).fill(0x2a8ab0);
  g.ellipse(cx - 1, cy - 5.5, 10, 4.5).fill(0x3aaad0);
  for (let i = 0; i < 5; i++) {
    const a = t * 0.8 + i * 1.3;
    g.rect(cx + Math.cos(a) * 9, cy - 5 + Math.sin(a) * 4, 3, 1).fill(0xa8f0f8);
  }
  g.rect(cx + 6, cy - 3, 1, 1).fill(0xffd23a); // монетки на дне
  g.rect(cx - 7, cy - 4, 1, 1).fill(0xe0b040);
  // круги от падающих струй
  const ring = (t * 1.5) % 1;
  g.ellipse(cx, cy - 5, 4 + ring * 6, 2 + ring * 3).stroke({ color: 0xd8f8ff, width: 1, alpha: 0.6 * (1 - ring) });
  // колонна и средняя чаша
  g.rect(cx - 2, cy - 17, 4, 12).fill(0xb8b2a6);
  g.rect(cx - 2, cy - 17, 1, 12).fill(0xdcd6cc);
  g.rect(cx + 1, cy - 17, 1, 12).fill(0x8e887e);
  g.ellipse(cx, cy - 17, 7, 2.8).fill(0x9a948a);
  g.ellipse(cx, cy - 18, 7, 2.6).fill(0xc6c0b4);
  g.ellipse(cx, cy - 18.3, 5.2, 1.7).fill(0x3aaad0);
  // верхняя чашечка
  g.rect(cx - 1, cy - 24, 2, 6).fill(0xb8b2a6);
  g.ellipse(cx, cy - 24, 3.5, 1.4).fill(0xc6c0b4);
  g.ellipse(cx, cy - 24.3, 2.4, 0.9).fill(0x3aaad0);
  // струи: вверх из верхней чаши и дугами вниз с краёв (бегущие капли)
  const f = (t * 8) % 3;
  g.rect(cx, cy - 30 + (f > 1.5 ? 1 : 0), 1, 6).fill(0xe8faff);
  g.rect(cx - 1, cy - 31, 3, 1).fill({ color: 0xffffff, alpha: 0.8 });
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const p = ((t * 2 + k / 4) % 1);
      g.rect(cx + side * (3 + p * 4), cy - 24 + p * p * 7, 1, 1).fill(0xcff4ff); // с верхней чаши на среднюю
      g.rect(cx + side * (7 + p * 5), cy - 18 + p * p * 13, 1, 1.5).fill(0xbfeeff); // со средней в большую
    }
  }
  // брызги у воды
  for (let k = 0; k < 4; k++) {
    const p = (t * 3 + k * 0.25) % 1;
    g.rect(cx - 11 + k * 7, cy - 5 - Math.sin(p * Math.PI) * 2, 1, 1).fill({ color: 0xffffff, alpha: 0.7 });
  }
}

/** Лоток Милы: прилавок, полосатый навес, корзинки с пирожками и вывеска-крендель. */
export function drawStall(g: Graphics) {
  isoBox(g, 1, 1, 8, 0x9a6a3a, 0x7a5030, 0xc89a62);
  const c = toScreen(0.5, 0.5);
  // доски прилавка
  const l = toScreen(0, 1), b = toScreen(1, 1);
  g.poly([l.x, l.y - 4, b.x, b.y - 4, b.x, b.y - 3, l.x, l.y - 3]).fill(0x7a5030);
  // пирожки в корзинках
  for (const [dx, dy] of [[-5, -10], [0, -11], [5, -10]]) {
    g.ellipse(c.x + dx, c.y + dy + 1, 3.5, 1.8).fill(0x8a6030);
    g.ellipse(c.x + dx, c.y + dy, 3, 1.6).fill(0xd8a050);
    g.rect(c.x + dx - 1, c.y + dy - 1, 2, 1).fill(0xf0c070);
  }
  // стойки и полосатый навес
  g.rect(c.x - 9, c.y - 24, 1, 14).fill(0x6b4423);
  g.rect(c.x + 8, c.y - 24, 1, 14).fill(0x4a2e18);
  for (let i = 0; i < 5; i++) {
    const x0 = c.x - 11 + i * 4.4;
    g.poly([x0, c.y - 23, x0 + 4.4, c.y - 23, x0 + 3.8, c.y - 28, x0 + 0.6, c.y - 28]).fill(i % 2 ? 0xf4ecdc : 0xd04a3a);
  }
  for (let i = 0; i < 5; i++) g.circle(c.x - 8.8 + i * 4.4, c.y - 23, 2.2).fill(i % 2 ? 0xf4ecdc : 0xd04a3a); // фестоны
  // вывеска-крендель
  g.rect(c.x - 1, c.y - 33, 1, 5).fill(0x4a2e18);
  g.circle(c.x - 0.5, c.y - 35, 3).fill(0xc8803a);
  g.circle(c.x - 0.5, c.y - 35, 1.3).fill(0xd04a3a);
}

/** Мольберт Ники: тренога, холст с нарисованным улыбчивым солнцем, баночка с кистями. */
export function drawEasel(g: Graphics) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y + 1, 7, 2.5).fill({ color: 0x000000, alpha: 0.25 });
  g.poly([c.x - 6, c.y + 1, c.x - 5, c.y + 1, c.x - 1, c.y - 22, c.x - 2, c.y - 22]).fill(0x8a5a32);
  g.poly([c.x + 5, c.y + 1, c.x + 6, c.y + 1, c.x + 2, c.y - 22, c.x + 1, c.y - 22]).fill(0x6b4423);
  g.rect(c.x, c.y - 10, 1, 11).fill(0x5a3a1e);
  g.rect(c.x - 7, c.y - 10, 14, 1).fill(0x7a5232); // полочка
  // холст
  g.rect(c.x - 7, c.y - 22, 14, 12).fill(0x8a6a40);
  g.rect(c.x - 6, c.y - 21, 12, 10).fill(0xa8d8f0);
  g.rect(c.x - 6, c.y - 14, 12, 3).fill(0x6aca50); // травка
  g.circle(c.x, c.y - 17, 3).fill(0xffd23a);
  for (const [dx, dy] of [[-4, -17], [4, -17], [0, -21], [-3, -20], [3, -20]]) g.rect(c.x + dx, c.y + dy, 1, 1).fill(0xffb030);
  g.rect(c.x - 1, c.y - 18, 1, 1).fill(0x5a3a10);
  g.rect(c.x + 1, c.y - 18, 1, 1).fill(0x5a3a10);
  g.rect(c.x - 1, c.y - 16, 3, 1).fill(0x5a3a10);
  // баночка с кистями
  g.rect(c.x + 6, c.y - 3, 3, 4).fill(0x6a9ac8);
  g.rect(c.x + 6, c.y - 6, 1, 3).fill(0x8a5a32); g.rect(c.x + 6, c.y - 7, 1, 1).fill(0xff8a3a);
  g.rect(c.x + 8, c.y - 6, 1, 3).fill(0x8a5a32); g.rect(c.x + 8, c.y - 7, 1, 1).fill(0x3a9ad0);
}

/** Дом фонарщика: окна всегда горят, у двери фонарик — дар Искры. */
export function drawHome(g: Graphics, t: number) {
  drawHouse(g, true);
  const l = toScreen(0, 2), b = toScreen(2, 2);
  const dx = (l.x + b.x) / 2 + 6, dy = (l.y + b.y) / 2;
  const flick = Math.sin(t * 7) > 0 ? 0xfff0b0 : 0xffd36b;
  g.rect(dx, dy - 15, 1, 3).fill(0x2a1a10);
  g.rect(dx - 1, dy - 12, 3, 4).fill(flick);
  // дымок из трубы: два клубочка поднимаются и тают
  const c = toScreen(1.5, 0.5);
  for (const off of [0, 6]) {
    const s = (t * 6 + off) % 12;
    g.circle(c.x + 0.5 + Math.sin(t + off) * 1.5, c.y - 44 - s * 1.2, 1.5 + s / 6).fill({ color: 0xd8d8e4, alpha: 0.5 * (1 - s / 12) });
  }
}

/** Спящий фонарщик (лежит у порога). */
export function drawSleeper(g: Graphics) {
  g.ellipse(0, 0, 8, 3).fill({ color: 0x000000, alpha: 0.35 });
  g.rect(-7, -4, 10, 4).fill(0x2b3a67);
  g.rect(3, -5, 4, 4).fill(0xf0c8a0);
  g.rect(6, -7, 3, 6).fill(0x1a1a22);
  g.rect(-10, -3, 3, 3).fill(0x1a1a24);
}

/** Тёмный дым, который стягивается в фигуру Гасителя. t — секунды с начала. */
export function drawSmoke(g: Graphics, t: number) {
  const k = Math.min(1, t / 2.6); // 0 — дым раскидан, 1 — собрался
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + t * (1.5 + k * 3);
    const r = (1 - k) * 34 + 4 + Math.sin(t * 5 + i) * 2;
    const x = Math.cos(a) * r, y = -14 + Math.sin(a) * r * 0.5;
    const size = 3 + ((i * 7) % 4) + k * 2;
    g.circle(x, y, size).fill({ color: i % 3 ? 0x2a1040 : 0x4a2070, alpha: 0.5 + 0.4 * k });
  }
  // сердцевина растёт
  g.ellipse(0, -14, 3 + k * 7, 4 + k * 13).fill({ color: 0x14081e, alpha: 0.4 + 0.6 * k });
  if (k > 0.85) g.ellipse(0, -14, 14, 20).fill({ color: 0x8a5ad0, alpha: (k - 0.85) * 2 }); // вспышка
}
