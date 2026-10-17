// Дома: у каждого жителя свой — по материалу стен, форме крыши и мелочам у двери.
// Рисуется от верхнего угла основания 2×2 (как isoBox). Свет в окнах — когда житель знаком.

import { Graphics } from 'pixi.js';
import { toScreen } from './iso';
import { shade } from './palette';

type Wall = 'plaster' | 'stone' | 'brick' | 'timber' | 'planks';
type Roof = 'hip' | 'gable' | 'thatch' | 'tower';

interface Style {
  wall: Wall;
  /** Цвет стен: светлая (левая) сторона; правая — в тени. */
  wallC: number;
  roof: Roof;
  roofC: number;
  /** Высота стен. */
  h: number;
  extra?: (g: Graphics, f: Faces, met: boolean) => void;
}

const STYLES: Record<string, Style> = {
  home: { wall: 'plaster', wallC: 0xf2e2c2, roof: 'hip', roofC: 0xd0463a, h: 16 },
  agata: { wall: 'plaster', wallC: 0xf6ead0, roof: 'thatch', roofC: 0xd8b058, h: 15, extra: fenceAndFlowers },
  timofey: { wall: 'stone', wallC: 0xa8a098, roof: 'gable', roofC: 0x56688c, h: 17, extra: forge },
  nika: { wall: 'planks', wallC: 0xf0b050, roof: 'hip', roofC: 0x3a9ad0, h: 15, extra: paintedSun },
  seva: { wall: 'brick', wallC: 0xc8644a, roof: 'gable', roofC: 0x3a5a9a, h: 17, extra: mailbox },
  filin: { wall: 'stone', wallC: 0x9a9488, roof: 'tower', roofC: 0x5e8a3a, h: 26, extra: owlWindow },
  mila: { wall: 'timber', wallC: 0xf4ecdc, roof: 'gable', roofC: 0xb0508a, h: 16, extra: bakery },
};

/** Точки граней: левая стена — от l до b, правая — от b до r; v — высота над землёй. */
interface Faces {
  l: { x: number; y: number }; b: { x: number; y: number }; r: { x: number; y: number };
  L: (u: number, v: number) => [number, number];
  R: (u: number, v: number) => [number, number];
  h: number;
}

function faces(h: number): Faces {
  const l = toScreen(0, 2), b = toScreen(2, 2), r = toScreen(2, 0);
  return {
    l, b, r, h,
    L: (u, v) => [l.x + (b.x - l.x) * u, l.y + (b.y - l.y) * u - v],
    R: (u, v) => [b.x + (r.x - b.x) * u, b.y + (r.y - b.y) * u - v],
  };
}

/** Четырёхугольник на грани: u0..u1 вдоль, v0..v1 по высоте. */
function quad(g: Graphics, P: (u: number, v: number) => [number, number], u0: number, u1: number, v0: number, v1: number, c: number) {
  g.poly([...P(u0, v0), ...P(u1, v0), ...P(u1, v1), ...P(u0, v1)]).fill(c);
}

function walls(g: Graphics, f: Faces, s: Style) {
  const lc = s.wallC, rc = shade(s.wallC, 0.78);
  quad(g, f.L, 0, 1, 0, f.h, lc);
  quad(g, f.R, 0, 1, 0, f.h, rc);
  const seam = (c: number) => shade(c, 0.82);
  for (const [P, c] of [[f.L, lc], [f.R, rc]] as const) {
    if (s.wall === 'stone') {
      // кладка: ряды по 4 пикселя, стыки вразбежку, светлые края камней
      for (let v = 0; v < f.h; v += 4) {
        quad(g, P, 0, 1, v, v + 0.8, seam(c));
        for (let u = (v / 4) % 2 ? 0.1 : 0.2; u < 1; u += 0.2) quad(g, P, u, u + 0.02, v, v + 4, seam(c));
        for (let u = (v / 4) % 2 ? 0.02 : 0.12; u < 1; u += 0.2) quad(g, P, u, u + 0.06, v + 3, v + 3.6, shade(c, 1.12));
      }
    } else if (s.wall === 'brick') {
      for (let v = 0; v < f.h; v += 3) {
        quad(g, P, 0, 1, v, v + 0.6, shade(c, 0.7));
        for (let u = (v / 3) % 2 ? 0.06 : 0.12; u < 1; u += 0.12) quad(g, P, u, u + 0.015, v, v + 3, shade(c, 0.7));
      }
    } else if (s.wall === 'planks') {
      for (let u = 0.08; u < 1; u += 0.08) quad(g, P, u, u + 0.012, 3, f.h, shade(c, 0.8));
    } else if (s.wall === 'timber') {
      // фахверк: тёмные брусья — стойки, перекладина и косые раскосы
      const beam = 0x5a3820;
      for (const u of [0, 0.33, 0.66, 1]) quad(g, P, Math.max(0, u - 0.02), Math.min(1, u + 0.02), 3, f.h, beam);
      quad(g, P, 0, 1, f.h * 0.5, f.h * 0.5 + 1.2, beam);
      for (const u0 of [0, 0.33, 0.66]) {
        const [x0, y0] = P(u0, 3), [x1, y1] = P(u0 + 0.33, f.h * 0.5);
        g.poly([x0, y0, x0 + 1.2, y0, x1 + 1.2, y1, x1, y1]).fill(beam);
      }
    }
  }
  // цоколь и угловой брус
  quad(g, f.L, 0, 1, 0, 3, 0xa49c90);
  quad(g, f.R, 0, 1, 0, 3, 0x7e776c);
  g.rect(f.b.x - 1, f.b.y - f.h, 2, f.h - 2).fill(s.wall === 'stone' ? shade(s.wallC, 0.7) : 0x6b4423);
}

/** Кирпичная труба: две грани с кладкой, бетонная шапка и глиняный горшок сверху. */
function chimney(g: Graphics, x: number, y: number, h: number) {
  const w = 3;
  g.poly([x - w, y, x, y + 1.5, x, y - h + 1.5, x - w, y - h]).fill(0xa0503a);      // левая грань
  g.poly([x, y + 1.5, x + w, y, x + w, y - h, x, y - h + 1.5]).fill(0x7a3a2a);      // правая грань
  for (let v = 2; v < h; v += 2.5) {
    g.poly([x - w, y - v, x, y - v + 1.5, x, y - v + 2, x - w, y - v + 0.5]).fill(0x6a2a1e);
    g.poly([x, y - v + 1.5, x + w, y - v, x + w, y - v + 0.5, x, y - v + 2]).fill(0x5a2418);
  }
  // шапка-плита и горшок с сажей
  g.poly([x - w - 1, y - h, x, y - h - 2, x + w + 1, y - h, x, y - h + 2]).fill(0xb8b0a4);
  g.poly([x - w - 1, y - h, x, y - h + 2, x + w + 1, y - h, x + w + 1, y - h + 1, x, y - h + 3, x - w - 1, y - h + 1]).fill(0x8e887e);
  g.rect(x - 1.5, y - h - 5, 3, 4).fill(0xc8703a);
  g.rect(x + 0.5, y - h - 5, 1, 4).fill(0x9a4a24);
  g.ellipse(x, y - h - 5, 1.7, 0.7).fill(0x1a1210);
}

function roof(g: Graphics, f: Faces, s: Style) {
  const H = f.h, c = s.roofC;
  const E = (x: number, y: number, up = 0) => { const p = toScreen(x, y); return [p.x, p.y - H - up] as [number, number]; };
  const chim = () => { const p = toScreen(1.55, 0.55); chimney(g, p.x, p.y - H - 6, 16); };
  if (s.roof === 'gable') {
    // конёк вдоль x: задний скат, торец справа, передний скат
    const RH = 20;
    const R0 = E(-0.1, 1, RH), R2 = E(2.1, 1, RH);
    g.poly([...E(-0.1, -0.1), ...E(2.1, -0.1), ...R2, ...R0]).fill(shade(c, 0.6));
    chim();
    g.poly([...E(2, 0), ...E(2, 2), ...R2]).fill(shade(s.wallC, 0.72)); // торец
    g.poly([...E(-0.1, 2.15), ...E(2.1, 2.15), ...R2, ...R0]).fill(c);
    // черепица рядами и светлый конёк
    for (const k of [0.25, 0.5, 0.75]) {
      const a = E(-0.1, 2.15 - k * 1.15, RH * k), b2 = E(2.1, 2.15 - k * 1.15, RH * k);
      g.poly([...a, ...b2, b2[0], b2[1] + 1, a[0], a[1] + 1]).fill(shade(c, 0.82));
    }
    g.poly([...R0, ...R2, R2[0], R2[1] + 1.5, R0[0], R0[1] + 1.5]).fill(shade(c, 1.3));
    g.poly([...E(-0.1, 2.15), ...E(2.1, 2.15), ...E(2.1, 2.15, -1.5), ...E(-0.1, 2.15, -1.5)]).fill(shade(c, 0.45)); // карниз
    return;
  }
  // вальмовая (4 ската), соломенная — та же форма, но с соломой; башня — высокий шпиль
  const apexUp = s.roof === 'tower' ? 34 : 24;
  const o = s.roof === 'thatch' ? 0.18 : 0.1;
  const A = E(1, 1, apexUp);
  const e00 = E(-o, -o), e20 = E(2 + o, -o), e22 = E(2 + o, 2 + o), e02 = E(-o, 2 + o);
  g.poly([...e00, ...e02, ...A]).fill(shade(c, 0.62));
  g.poly([...e20, ...e00, ...A]).fill(shade(c, 0.72));
  if (s.roof !== 'tower') chim();
  g.poly([...e02, ...e22, ...A]).fill(c);
  g.poly([...e22, ...e20, ...A]).fill(shade(c, 0.8));
  const lerp = (p: [number, number], k: number): [number, number] => [p[0] + (A[0] - p[0]) * k, p[1] + (A[1] - p[1]) * k];
  if (s.roof === 'thatch') {
    // солома: много коротких тёмных штрихов вниз, пушистый край
    for (let k = 0.08; k < 0.9; k += 0.12)
      for (let u = 0; u <= 1; u += 0.08) {
        for (const [p0, p1, cc] of [[e02, e22, shade(c, 0.78)], [e22, e20, shade(c, 0.62)]] as const) {
          const a = lerp([p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u], k);
          g.rect(a[0], a[1], 1, 2).fill(cc);
        }
      }
    for (let u = 0; u <= 1; u += 0.06) {
      const p = [e02[0] + (e22[0] - e02[0]) * u, e02[1] + (e22[1] - e02[1]) * u];
      g.rect(p[0], p[1], 1, 2 + ((u * 50) % 2)).fill(shade(c, 0.7));
    }
  } else {
    for (const k of [0.22, 0.44, 0.66]) {
      for (const [p0, p1, cc] of [[e02, e22, shade(c, 0.82)], [e22, e20, shade(c, 0.66)]] as const) {
        const a0 = lerp(p0, k), a1 = lerp(p1, k);
        g.poly([...a0, ...a1, a1[0], a1[1] + 1, a0[0], a0[1] + 1]).fill(cc);
      }
    }
    g.poly([...e02, ...A, A[0] + 1, A[1] + 2, e02[0] + 2, e02[1]]).fill(shade(c, 1.25));
  }
  if (s.roof === 'tower') {
    // флюгер на шпиле и пятна мха
    g.rect(A[0], A[1] - 6, 1, 6).fill(0x3a3a44);
    g.poly([A[0] + 1, A[1] - 6, A[0] + 5, A[1] - 5, A[0] + 1, A[1] - 4]).fill(0xd8b050);
    for (const [k, u] of [[0.3, 0.3], [0.5, 0.6], [0.2, 0.8]]) {
      const p = lerp([e02[0] + (e22[0] - e02[0]) * u, e02[1] + (e22[1] - e02[1]) * u], k);
      g.ellipse(p[0], p[1], 2.5, 1.2).fill(0x4a8a3a);
    }
  }
}

function doorAndWindows(g: Graphics, f: Faces, s: Style, met: boolean) {
  const lit = met ? 0xffd27a : 0x2a3a5a;
  // дверь с наличником и ступенькой
  const [dx, dy] = f.L(0.5, 0);
  g.poly([dx - 5, dy + 1, dx + 4, dy + 5.5, dx + 7, dy + 4, dx - 2, dy - 0.5]).fill(0x9a948a);
  quad(g, f.L, 0.38, 0.62, 0, 13, 0x5a3018);
  quad(g, f.L, 0.41, 0.59, 0, 11.5, s.wall === 'planks' ? 0x3a7ad0 : 0x9a5a2c);
  quad(g, f.L, 0.41, 0.59, 5, 6, 0x7a4422);
  const [hx, hy] = f.L(0.56, 5);
  g.rect(hx, hy, 1, 1).fill(0xffd23a);
  // окна: на правой стене, у высоких домов — ещё одно выше
  const win = (P: (u: number, v: number) => [number, number], u: number, v: number, shutter: number) => {
    quad(g, P, u - 0.13, u + 0.13, v, v + 8, 0xf0e6d0);
    quad(g, P, u - 0.1, u + 0.1, v + 1, v + 7, lit);
    quad(g, P, u - 0.01, u + 0.01, v + 1, v + 7, 0xf0e6d0);
    quad(g, P, u - 0.1, u + 0.1, v + 3.6, v + 4.4, 0xf0e6d0);
    if (met) quad(g, P, u - 0.08, u - 0.03, v + 5, v + 6.5, 0xfff4c8);
    quad(g, P, u - 0.2, u - 0.13, v, v + 8, shutter);
    quad(g, P, u + 0.13, u + 0.2, v, v + 8, shade(shutter, 0.8));
  };
  win(f.R, 0.5, 4, shade(s.roofC, 0.9));
  if (f.h > 20) win(f.R, 0.5, 15, shade(s.roofC, 0.9));
  win(f.L, 0.16, 5, shade(s.roofC, 0.95));
  // ящик с цветами под правым окном
  quad(g, f.R, 0.36, 0.64, 2.5, 4, 0x8a5a32);
  const [fx, fy] = f.R(0.42, 4.5);
  g.rect(fx, fy, 1, 1).fill(0xff7aa8);
  g.rect(fx + 3, fy - 1.5, 1, 1).fill(0xffffff);
  g.rect(fx + 5, fy - 2.5, 1, 1).fill(0xffd23a);
}

// ---------- особые мелочи у домов ----------

function fenceAndFlowers(g: Graphics, f: Faces) {
  // плетень перед домом Агаты и клумба
  for (let u = 0.02; u < 0.36; u += 0.06) {
    const [x, y] = f.L(u, 0);
    g.rect(x - 1, y - 6 + 3, 1, 6).fill(0x8a5a32);
  }
  const [a0, b0] = f.L(0.02, 3.5), [a1, b1] = f.L(0.34, 3.5);
  g.poly([a0, b0 + 3, a1, b1 + 3, a1, b1 + 4, a0, b0 + 4]).fill(0x6b4423);
  for (const [u, c] of [[0.08, 0xff7aa8], [0.16, 0xffd23a], [0.24, 0xffffff], [0.3, 0xc87adf]] as const) {
    const [x, y] = f.L(u, 0);
    g.rect(x - 1, y + 2, 1, 2).fill(0x3e8a34);
    g.rect(x - 2, y + 1, 3, 1).fill(c);
  }
}

function forge(g: Graphics, f: Faces, met: boolean) {
  // кузница: подкова над дверью, горн светится в окне, наковальня у стены
  const [hx, hy] = f.L(0.5, 15);
  g.circle(hx, hy, 2.5).fill(0x8a8a96);
  g.circle(hx, hy + 0.8, 1.4).fill(0xa8a098);
  const [ox, oy] = f.R(0.5, 4);
  g.rect(ox - 2, oy - 7, 4, 2).fill(met ? 0xff8a2a : 0x5a2a1e);
  const [ax, ay] = f.L(0.15, 0);
  g.rect(ax - 3, ay + 2, 6, 3).fill(0x4a2e18);
  g.rect(ax - 4, ay - 1, 8, 3).fill(0x55555f);
  g.rect(ax - 4, ay - 1, 8, 1).fill(0x8a8a96);
}

function paintedSun(g: Graphics, f: Faces) {
  // на стене у Ники нарисовано солнышко и цветочек
  const [sx, sy] = f.L(0.16, 12);
  g.circle(sx, sy - 3, 2.5).fill(0xffd23a);
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) g.rect(sx + dx, sy - 3 + dy, 1, 1).fill(0xff8a3a);
  const [fx, fy] = f.R(0.82, 6);
  g.rect(fx, fy, 1, 4).fill(0x3e8a34);
  g.rect(fx - 1, fy - 2, 3, 2).fill(0xff7aa8);
}

function mailbox(g: Graphics, f: Faces) {
  // почта: синий почтовый ящик на столбике и вывеска с конвертом
  const [mx, my] = f.L(0.12, 0);
  g.rect(mx - 1, my - 2, 1, 7).fill(0x4a2e18);
  g.rect(mx - 4, my - 7, 6, 5).fill(0x3a6ad0);
  g.rect(mx - 4, my - 7, 6, 1).fill(0x6a9af0);
  g.rect(mx - 3, my - 5, 4, 1).fill(0x1a2a5a);
  const [sx, sy] = f.L(0.5, 15);
  g.rect(sx - 4, sy - 4, 8, 5).fill(0xf4ecd8);
  g.poly([sx - 4, sy - 4, sx, sy - 1, sx + 4, sy - 4]).fill(0xc8bca0);
  g.rect(sx - 0.5, sy - 2, 1, 1).fill(0xc83a32);
}

function owlWindow(g: Graphics, f: Faces, met: boolean) {
  // башня Филина: круглое окошко-«глаз» под крышей
  const [x, y] = f.R(0.5, 23);
  g.circle(x, y, 2.6).fill(0xf0e6d0);
  g.circle(x, y, 1.7).fill(met ? 0xffd27a : 0x2a3a5a);
}

function bakery(g: Graphics, f: Faces) {
  // пекарня: полосатый навес над окном и вывеска-крендель
  for (let i = 0; i < 4; i++) {
    const u0 = 0.32 + i * 0.09;
    quad(g, f.R, u0, u0 + 0.09, 12, 14, i % 2 ? 0xf4ecdc : 0xd04a3a);
  }
  const [sx, sy] = f.L(0.5, 16);
  g.rect(sx - 0.5, sy - 2, 1, 3).fill(0x4a2e18);
  g.circle(sx, sy - 4.5, 2.6).fill(0xc8803a);
  g.circle(sx, sy - 4.5, 1.1).fill(0xf4ecdc);
}

/** Дом жителя (или фонарщика — 'home'). */
export function drawHouse(g: Graphics, met: boolean, rid = 'home') {
  const s = STYLES[rid] ?? STYLES.home;
  const f = faces(s.h);
  walls(g, f, s);
  doorAndWindows(g, f, s, met);
  s.extra?.(g, f, met);
  roof(g, f, s);
}
