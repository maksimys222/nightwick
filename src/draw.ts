// Заглушки вместо арта: всё рисуется фигурами (Graphics) вокруг точки 0,0 = центр тайла.
// Когда появятся настоящие спрайты, заменять нужно только этот файл.

import { Graphics, Texture } from 'pixi.js';
import { TW, TH, toScreen } from './iso';
import type { Lamp, Flower } from './map';
import { burning, lampCap } from './game';
import { BIOMES, ROOFS, shade, type Biome } from './palette';

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

/** Цвет «головы» фонаря: [горит, погас]. */
const HEAD: Record<string, [number, number]> = {
  oil: [0xffe08a, 0x2b2b3a], gas: [0xb8e0ff, 0x2a3a5a], stubborn: [0xff8a6a, 0x4a2020],
  marsh: [0x9affb0, 0x1e3a28], beacon: [0xffffff, 0x3a3a44],
};

export function drawLamp(g: Graphics, l: Lamp) {
  const on = burning(l);
  const [hOn, hOff] = HEAD[l.kind];
  const head = on ? hOn : hOff;
  g.ellipse(0, 1, 5, 2).fill({ color: 0x000000, alpha: 0.3 });

  if (l.kind === 'beacon') {
    // каменная башенка; «Старый маяк» — высокий, в красно-белую полоску
    const tall = l.name === 'Старый маяк';
    const h = tall ? 52 : 34;
    g.ellipse(0, 1, 9, 3.5).fill({ color: 0x000000, alpha: 0.35 });
    g.poly([-7, 0, 7, 0, 5, -h, -5, -h]).fill(tall ? 0xe8e0d8 : 0x8a8078);
    if (tall) for (let y = -10; y > -h; y -= 14) g.poly([-7 + (-y / h) * 2, y, 7 - (-y / h) * 2, y, 6.6 - (-y / h) * 2, y - 6, -6.6 + (-y / h) * 2, y - 6]).fill(0xc83a32);
    else for (let y = -6; y > -h; y -= 7) g.rect(-5, y, 10, 1).fill(0x6a625a);
    g.rect(-6, -h - 2, 12, 2).fill(0x2a2a38);
    g.rect(-4, -h - 9, 8, 7).fill(0x2a2a38);
    g.rect(-3, -h - 8, 6, 5).fill(head);
    if (on) g.rect(-1, -h - 7, 2, 2).fill(0xffffff);
    g.poly([-5, -h - 9, 0, -h - 14, 5, -h - 9]).fill(0x2a2a38);
    return;
  }

  if (l.kind === 'marsh') {
    // кривой деревянный шест с зелёным шаром
    g.poly([-1, 0, 1, 0, 2, -10, 0, -18, -2, -18, 0, -10]).fill(0x5a4a2a);
    g.circle(-1, -21, 3.5).fill(head);
    if (on) g.circle(-1, -21, 1.5).fill(0xffffff);
    g.rect(-5, -16, 3, 1).fill(0x3a7a3a);
  } else if (l.kind === 'gas') {
    // чугунный столб с узором и большим плафоном
    g.rect(-2, -2, 4, 3).fill(0x1d2030);
    g.rect(-1, -22, 2, 21).fill(0x2a3048);
    g.rect(-3, -12, 6, 1).fill(0x3a4060);
    g.poly([-4, -22, 5, -22, 4, -30, -3, -30]).fill(0x1d2030);
    g.poly([-3, -23, 4, -23, 3, -29, -2, -29]).fill(head);
    if (on) g.rect(0, -27, 2, 2).fill(0xffffff);
    g.poly([-5, -30, 0.5, -34, 6, -30]).fill(0x1d2030);
  } else {
    // обычный и упрямый (у упрямого — ставни от ветра)
    g.rect(-2, -2, 4, 3).fill(0x1d1d28);
    g.rect(-1, -20, 2, 19).fill(l.kind === 'stubborn' ? 0x4a2a2a : 0x2a2a38);
    g.rect(-3, -27, 7, 7).fill(0x1d1d28);
    g.rect(-2, -26, 5, 5).fill(head);
    if (on) g.rect(-1, -25, 2, 2).fill(0xffffff);
    if (l.kind === 'stubborn') { g.rect(-5, -27, 2, 7).fill(0x6a3020); g.rect(4, -27, 2, 7).fill(0x6a3020); }
    g.poly([-4, -27, 0.5, -31, 5, -27]).fill(0x1d1d28);
  }
  // тлеющая искра после первого захода (упрямый)
  if (l.kindled > 0) { g.rect(-1, -24, 1, 1).fill(0xffb040); g.rect(1, -26, 1, 1).fill(0xff8020); }
  // полоска масла
  if (l.everLit && l.kind !== 'marsh') {
    const k = l.oil / lampCap(l);
    g.rect(-6, -40, 12, 3).fill(0x111118);
    if (k > 0) g.rect(-5, -39, Math.max(1, Math.round(10 * k)), 1).fill(k < 0.25 ? 0xe05040 : 0xf0b040);
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

export function drawHouse(g: Graphics, met: boolean, roof = ROOFS.home) {
  // рисуем от верхнего угла основания, а позицию ставим так, чтобы центр совпал с центром 2×2
  const H0 = 16;
  const { r, b, l } = isoBox(g, 2, 2, H0, 0xf2e2c2, 0xc8ae88, 0x6b4f36);
  // цоколь из камня и угловой брус
  g.poly([l.x, l.y, b.x, b.y, b.x, b.y - 3, l.x, l.y - 3]).fill(0xa49c90);
  g.poly([b.x, b.y, r.x, r.y, r.x, r.y - 3, b.x, b.y - 3]).fill(0x7e776c);
  g.rect(b.x - 1, b.y - H0, 2, H0 - 2).fill(0x6b4423);
  g.poly([l.x, l.y - H0, b.x, b.y - H0, b.x, b.y - H0 + 2, l.x, l.y - H0 + 2]).fill(0x8a5a32);
  g.poly([b.x, b.y - H0, r.x, r.y - H0, r.x, r.y - H0 + 2, b.x, b.y - H0 + 2]).fill(0x6b4423);
  const apex = { x: 0, y: b.y / 2 - H0 - 24 };
  g.poly([0, -H0, l.x, l.y - H0, apex.x, apex.y]).fill(shade(roof, 0.62));
  g.poly([r.x, r.y - H0, 0, -H0, apex.x, apex.y]).fill(shade(roof, 0.72));
  g.poly([l.x, l.y - H0 + 1, b.x, b.y - H0 + 1, apex.x, apex.y]).fill(roof);
  g.poly([b.x, b.y - H0 + 1, r.x, r.y - H0 + 1, apex.x, apex.y]).fill(shade(roof, 0.8));
  // светлый край крыши — со стороны света
  g.poly([l.x, l.y - H0 + 1, apex.x, apex.y, apex.x + 1, apex.y + 2, l.x + 2, l.y - H0 + 1]).fill(shade(roof, 1.25));
  // дверь на левой стене, окно на правой
  const dx = (l.x + b.x) / 2, dy = (l.y + b.y) / 2;
  g.poly([dx - 4, dy - 2, dx + 3, dy + 1.5, dx + 3, dy - 10, dx - 4, dy - 13]).fill(0x5a3018);
  g.poly([dx - 3, dy - 1.5, dx + 2, dy + 1, dx + 2, dy - 9, dx - 3, dy - 11.5]).fill(0x9a5a2c);
  g.rect(dx + 1, dy - 5, 1, 1).fill(0xffd23a);
  const wx = (b.x + r.x) / 2, wy = (b.y + r.y) / 2;
  const lit = met ? 0xffd27a : 0x2a3a5a;
  g.poly([wx - 3, wy - 5.5, wx + 3, wy - 8.5, wx + 3, wy - 13.5, wx - 3, wy - 10.5]).fill(0xf0e6d0);
  g.poly([wx - 2, wy - 6.5, wx + 2, wy - 8.5, wx + 2, wy - 12.5, wx - 2, wy - 10.5]).fill(lit);
  // ящик с цветами под окном
  g.poly([wx - 3, wy - 4.5, wx + 3, wy - 7.5, wx + 3, wy - 5.5, wx - 3, wy - 2.5]).fill(0x8a5a32);
  g.rect(wx - 2, wy - 6, 1, 1).fill(0xff7aa8);
  g.rect(wx + 1, wy - 8, 1, 1).fill(0xffd23a);
}

export function drawPress(g: Graphics) {
  isoBox(g, 1, 1, 9, 0x6b4a2a, 0x845c34, 0x9a6e40);
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y - 10, 5, 2.5).fill(0x5a3a1e);
  g.rect(c.x - 5, c.y - 16, 10, 6).fill(0x7a5030);
  g.ellipse(c.x, c.y - 16, 5, 2.5).fill(0xa07040);
  g.rect(c.x - 1, c.y - 24, 2, 8).fill(0x3a2a1a);
  g.rect(c.x - 6, c.y - 24, 12, 2).fill(0x3a2a1a);
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

/** Телескоп на треноге: через него видно звёздное небо. t — чтобы линза поблёскивала. */
export function drawTelescope(g: Graphics, t: number) {
  const c = toScreen(0.5, 0.5);
  const x = c.x, y = c.y;
  // тренога
  g.rect(x - 6, y - 8, 1, 8).fill(0x5a3a1e);
  g.rect(x + 5, y - 8, 1, 8).fill(0x5a3a1e);
  g.rect(x, y - 9, 1, 10).fill(0x6b4423);
  g.rect(x - 5, y - 10, 11, 2).fill(0x7a5232);
  // труба смотрит в небо (ступеньками — пиксельная наклонная линия)
  for (let i = 0; i < 8; i++) g.rect(x - 6 + i * 2, y - 12 - i * 2, 4, 3).fill(i < 3 ? 0xb8862e : 0xd8a84a);
  g.rect(x + 8, y - 28, 4, 4).fill(0xe8c060);
  // блик на линзе
  if (Math.sin(t * 2) > 0.6) g.rect(x + 10, y - 27, 1, 1).fill(0xffffff);
  else g.rect(x + 10, y - 27, 1, 1).fill(0x9ad0ff);
}

export function drawPlanter(g: Graphics) {
  isoBox(g, 1, 2, 7, 0x7a5232, 0x8f6238, 0x4a3220);
  for (const [x, y, flower] of [[0.5, 0.4, 0], [0.5, 1, 1], [0.5, 1.6, 0]] as const) {
    const c = toScreen(x, y);
    g.rect(c.x, c.y - 14, 1, 7).fill(0x3e9a40);
    g.rect(c.x + 1, c.y - 11, 2, 1).fill(0x5cbf4a);
    if (flower) {
      g.rect(c.x - 2, c.y - 18, 5, 5).fill(0xffd23a);
      g.rect(c.x - 1, c.y - 17, 3, 3).fill(0x6b3e1a);
    } else g.rect(c.x - 1, c.y - 16, 3, 2).fill(0x7acc50);
  }
}

export function drawAnvil(g: Graphics) {
  isoBox(g, 1, 1, 6, 0x6b4423, 0x7a5232, 0x9a6e40);
  const c = toScreen(0.5, 0.5);
  g.rect(c.x - 3, c.y - 10, 6, 4).fill(0x44444e);
  g.rect(c.x - 6, c.y - 13, 12, 3).fill(0x5a5a66);
  g.poly([c.x + 6, c.y - 13, c.x + 10, c.y - 12, c.x + 6, c.y - 10]).fill(0x5a5a66);
  g.rect(c.x - 5, c.y - 13, 9, 1).fill(0x8a8a96);
}

export function drawMapTable(g: Graphics) {
  isoBox(g, 2, 1, 9, 0x7a5232, 0x8f6238, 0xa87a48);
  const p = (x: number, y: number) => { const s = toScreen(x, y); return [s.x, s.y - 9]; };
  g.poly([...p(0.2, 0.15), ...p(1.8, 0.15), ...p(1.8, 0.85), ...p(0.2, 0.85)]).fill(0xe8d8b0);
  const [ax, ay] = p(0.5, 0.5), [bx, by] = p(1.4, 0.4);
  g.rect(ax, ay, bx - ax, 1).fill(0xb08a5a);
  g.rect(ax - 1, ay - 1, 2, 2).fill(0xd04030);
  g.rect(bx - 1, by - 1, 2, 2).fill(0xffb020);
}

export function drawMailbag(g: Graphics) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y, 8, 3).fill({ color: 0x000000, alpha: 0.25 });
  g.ellipse(c.x, c.y - 5, 7, 6).fill(0x8a6a3a);
  g.rect(c.x - 4, c.y - 13, 4, 5).fill(0xf0ead8);
  g.rect(c.x + 1, c.y - 14, 4, 5).fill(0xe0d8c0);
  g.rect(c.x - 7, c.y - 8, 14, 2).fill(0x6a4a24);
}

export function drawPerch(g: Graphics, t: number) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y, 6, 2).fill({ color: 0x000000, alpha: 0.25 });
  g.rect(c.x - 1, c.y - 18, 2, 18).fill(0x5a3a1e);
  g.rect(c.x - 6, c.y - 19, 12, 2).fill(0x6b4423);
  // сова
  const blink = Math.floor(t * 0.7) % 6 === 0 ? 1 : 2;
  g.ellipse(c.x, c.y - 25, 5, 6).fill(0x7a6a50);
  g.ellipse(c.x, c.y - 23, 3, 3).fill(0xa89878);
  g.rect(c.x - 3, c.y - 28, 2, blink).fill(0xffd23a);
  g.rect(c.x + 1, c.y - 28, 2, blink).fill(0xffd23a);
  g.poly([c.x - 5, c.y - 30, c.x - 3, c.y - 33, c.x - 2, c.y - 30]).fill(0x7a6a50);
  g.poly([c.x + 5, c.y - 30, c.x + 3, c.y - 33, c.x + 2, c.y - 30]).fill(0x7a6a50);
}

export function drawOven(g: Graphics, t: number) {
  isoBox(g, 2, 1, 20, 0x9a4a32, 0xb0583a, 0x7a3a28);
  frontQuad(g, 2, 1, 0.3, 0.7, 3, 12, 0x2a120a);
  const flick = Math.sin(t * 8) > 0 ? 1 : 0;
  frontQuad(g, 2, 1, 0.36, 0.64, 3, 7 + flick, 0xff8a2a);
  const c = toScreen(1.6, 0.3);
  g.rect(c.x - 2, c.y - 34, 5, 14).fill(0x7a3a28);
}

export function drawFireplace(g: Graphics, t: number) {
  isoBox(g, 2, 1, 30, 0x8a8078, 0x9a9088, 0x6a625a);
  frontQuad(g, 2, 1, 0.25, 0.75, 2, 16, 0x1a1210);
  const f1 = Math.sin(t * 9) > 0 ? 2 : 0, f2 = Math.sin(t * 13 + 1) > 0 ? 2 : 0;
  frontQuad(g, 2, 1, 0.32, 0.5, 2, 9 + f1, 0xff7a20);
  frontQuad(g, 2, 1, 0.48, 0.68, 2, 8 + f2, 0xffa030);
  frontQuad(g, 2, 1, 0.42, 0.56, 2, 5, 0xffe08a);
  frontQuad(g, 2, 1, 0.15, 0.85, 30, 33, 0x5a524a); // полка
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

export function drawFountain(g: Graphics, t: number) {
  isoBox(g, 2, 2, 6, 0x8a8a96, 0x9a9aa8, 0x6a6a78);
  const c = toScreen(1, 1);
  g.ellipse(c.x, c.y - 6, 12, 6).fill(0x3a7ac0);
  g.ellipse(c.x, c.y - 6, 9, 4).fill(0x4a8ad0);
  g.rect(c.x - 1, c.y - 18, 3, 12).fill(0x9a9aa8);
  const k = Math.floor(t * 6) % 2;
  g.rect(c.x - 3 - k, c.y - 20, 2, 2).fill(0xbfe0ff);
  g.rect(c.x + 2 + k, c.y - 19, 2, 2).fill(0xbfe0ff);
  g.rect(c.x, c.y - 22, 1, 3).fill(0xe0f0ff);
}

export function drawStall(g: Graphics) {
  isoBox(g, 1, 1, 8, 0x8a5a32, 0x9a6a3a, 0xc89a62);
  const c = toScreen(0.5, 0.5);
  for (const [dx, dy] of [[-4, -10], [0, -11], [4, -10]]) g.ellipse(c.x + dx, c.y + dy, 3, 2).fill(0xd8a050);
  g.rect(c.x - 8, c.y - 22, 1, 12).fill(0x6b4423);
  g.rect(c.x + 7, c.y - 22, 1, 12).fill(0x6b4423);
  g.poly([c.x - 10, c.y - 22, c.x + 10, c.y - 22, c.x + 8, c.y - 26, c.x - 8, c.y - 26]).fill(0xd04a3a);
  g.rect(c.x - 8, c.y - 24, 4, 2).fill(0xf0e8d8);
  g.rect(c.x, c.y - 24, 4, 2).fill(0xf0e8d8);
}

export function drawEasel(g: Graphics) {
  const c = toScreen(0.5, 0.5);
  g.rect(c.x - 5, c.y - 14, 1, 14).fill(0x6b4423);
  g.rect(c.x + 4, c.y - 14, 1, 14).fill(0x6b4423);
  g.rect(c.x - 6, c.y - 20, 12, 10).fill(0xf0e8d8);
  g.circle(c.x, c.y - 15, 3).fill(0xffd23a);
  g.rect(c.x - 1, c.y - 16, 1, 1).fill(0x5a3a10);
  g.rect(c.x + 1, c.y - 16, 1, 1).fill(0x5a3a10);
}

/** Дом фонарщика: окна всегда горят, у двери фонарик — дар Искры. */
export function drawHome(g: Graphics, t: number) {
  drawHouse(g, true);
  const l = toScreen(0, 2), b = toScreen(2, 2);
  const dx = (l.x + b.x) / 2 + 6, dy = (l.y + b.y) / 2;
  const flick = Math.sin(t * 7) > 0 ? 0xfff0b0 : 0xffd36b;
  g.rect(dx, dy - 15, 1, 3).fill(0x2a1a10);
  g.rect(dx - 1, dy - 12, 3, 4).fill(flick);
  // дымок из трубы
  const c = toScreen(1.5, 0.5);
  g.rect(c.x - 2, c.y - 40, 4, 10).fill(0x6a3a2a);
  const s = (t * 6) % 12;
  g.rect(c.x - 1, c.y - 44 - s, 3, 3).fill({ color: 0xc8c8d8, alpha: 0.5 * (1 - s / 12) });
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
