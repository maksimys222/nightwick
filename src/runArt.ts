// Картинки вылазки: текстура земли (по пикселю), тени-враги, тайники, костёр-привал.
//
// Земля рисуется не ромбами, а целой картинкой: для каждого пикселя считаем, какая под ним клетка,
// и красим «шумом» — пятна травы, лесная подстилка под деревьями, камушки на тропе, брусчатка, рябь на песке.
// Границы между землёй «рваные», а оттенки ложатся пиксельным дизерингом — получается живая фактура.

import { Graphics, Sprite, Texture } from 'pixi.js';
import { toScreen } from './iso';
import { GRASS, PATH, WATER, STONE, SAND, BRIDGE, outsideGround, type World } from './map';
import { BIOMES, GROUND, shade } from './palette';

// ---------- шум ----------

function h2(x: number, y: number) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Гладкий шум 0..1. */
function vn(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

type RGB = [number, number, number];
const rgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
/** Четыре ступени цвета от тёмного к светлому. */
const ramp = (dark: number, mid: number, light: number): RGB[] => [rgb(shade(dark, 0.86)), rgb(dark), rgb(mid), rgb(light)];

/** Картинка земли всей карты с запасом M клеток за краем. */
export function groundSprite(w: World, M: number) {
  const { w: W, h: H } = w;
  const x0 = Math.floor(toScreen(-M, H + M).x) - 16, x1 = Math.ceil(toScreen(W + M, -M).x) + 16;
  const y0 = Math.floor(toScreen(-M, -M).y) - 2, y1 = Math.ceil(toScreen(W + M, H + M).y) + 2;
  const cw = x1 - x0, ch = y1 - y0;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(cw, ch);
  const px = img.data;

  // карта типов и «лесистости» (за краем — сплошной лес)
  const GW = W + 2 * M, GH = H + 2 * M;
  const type = new Uint8Array(GW * GH), wood = new Float32Array(GW * GH);
  const trees = new Uint8Array(W * H);
  for (const t of w.trees) trees[t.y * W + t.x] = 1;
  for (let y = -M; y < H + M; y++)
    for (let x = -M; x < W + M; x++) {
      const inside = x >= 0 && y >= 0 && x < W && y < H;
      const g = inside ? w.ground[y * W + x] : outsideGround(w, x, y);
      type[(y + M) * GW + x + M] = g === BRIDGE ? WATER : g;
    }
  for (let y = -M; y < H + M; y++)
    for (let x = -M; x < W + M; x++) {
      let n = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const xx = x + i, yy = y + j;
          const inside = xx >= 0 && yy >= 0 && xx < W && yy < H;
          n += inside ? trees[yy * W + xx] : outsideGround(w, xx, yy) === GRASS ? 1 : 0;
        }
      wood[(y + M) * GW + x + M] = n / 9;
    }
  const typeAt = (tx: number, ty: number) => {
    const x = Math.floor(tx) + M, y = Math.floor(ty) + M;
    if (x < 0 || y < 0 || x >= GW || y >= GH) return GRASS;
    return type[y * GW + x];
  };
  const woodAt = (tx: number, ty: number) => {
    // билинейно — подстилка темнеет к лесу плавно
    const fx = tx - 0.5 + M, fy = ty - 0.5 + M;
    const xi = Math.max(0, Math.min(GW - 2, Math.floor(fx))), yi = Math.max(0, Math.min(GH - 2, Math.floor(fy)));
    const u = Math.max(0, Math.min(1, fx - xi)), v = Math.max(0, Math.min(1, fy - yi));
    const a = wood[yi * GW + xi], b = wood[yi * GW + xi + 1], c = wood[(yi + 1) * GW + xi], d = wood[(yi + 1) * GW + xi + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  const b = BIOMES[w.biome(0, 0)];
  const grass = ramp(shade(b.grass[2], 0.84), b.grass[0], shade(b.grass[1], 1.1));
  const floor = ramp(shade(b.grass[2], 0.42), shade(b.grass[2], 0.55), shade(b.grass[0], 0.7));
  const blade = rgb(shade(b.tuft[0], 1.05)), bladeDark = rgb(shade(b.tuft[1], 0.9));
  const leaf = rgb(b.leaves[1]), leafDark = rgb(b.leaves[0]), needle = rgb(0x6a4a2a);
  const dirt = ramp(shade(GROUND.path[1], 0.72), GROUND.path[1], GROUND.path[0]);
  const pebble = rgb(0xb8b0a2), pebbleDark = rgb(0x7e766a);
  const stone = ramp(shade(GROUND.stone[1], 0.8), GROUND.stone[1], GROUND.stone[0]);
  const seam = rgb(shade(GROUND.stoneSeam, 0.8));
  const sand = ramp(shade(GROUND.sand[1], 0.86), GROUND.sand[1], GROUND.sand[0]);
  const water = ramp(shade(GROUND.water[1], 0.45), shade(GROUND.water[1], 0.62), GROUND.water[1]);

  // плавный шум меняется медленно — считаем его на сетке 2×2 пикселя (вчетверо быстрее)
  const bw = (cw >> 1) + 1, bh = (ch >> 1) + 1;
  const JX = new Float32Array(bw * bh), JY = new Float32Array(bw * bh), N1 = new Float32Array(bw * bh), WD = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      const sx = bx * 2 + 1 + x0, sy = by * 2 + 1 + y0;
      const a = sx / 16, bb = sy / 8, tx = (a + bb) / 2, ty = (bb - a) / 2;
      const i = by * bw + bx;
      JX[i] = (vn(tx * 2.2, ty * 2.2) - 0.5) * 0.55;
      JY[i] = (vn(tx * 2.2 + 40, ty * 2.2 + 17) - 0.5) * 0.55;
      N1[i] = vn(tx * 0.45, ty * 0.45) * 0.55 + vn(tx * 1.6, ty * 1.6) * 0.3;
      WD[i] = woodAt(tx, ty) + (vn(tx * 3, ty * 3) - 0.5) * 0.3;
    }
  for (let py = 0; py < ch; py++) {
    for (let pxl = 0; pxl < cw; pxl++) {
      const sx = pxl + x0, sy = py + y0;
      const a = sx / 16, bb = sy / 8;
      const tx = (a + bb) / 2, ty = (bb - a) / 2;
      const o = (py * cw + pxl) * 4;
      if (tx < -M || ty < -M || tx >= W + M || ty >= H + M) continue;
      const bi = (py >> 1) * bw + (pxl >> 1);
      // рваная граница между видами земли
      const t = typeAt(tx + JX[bi], ty + JY[bi]);
      const d = BAYER[(py & 3) * 4 + (pxl & 3)];
      const ph = h2(pxl + 7777, py * 3 + 11);
      let c: RGB;
      if (t === GRASS) {
        const n = N1[bi] + h2(pxl >> 2, py >> 1) * 0.15;
        const f = Math.max(0, WD[bi]);
        if (WD[bi] > 0.45) {
          // лесная подстилка: тёмный мох, хвоя, опавшие листья
          c = floor[Math.max(0, Math.min(3, Math.floor(n * 3.4 + d - 0.6)))];
          if (ph > 0.985) c = h2(pxl, py) > 0.5 ? leaf : leafDark;
          else if (ph > 0.975) c = needle;
        } else {
          let lvl = Math.floor(n * 3.6 + d - 0.4 - f * 1.6);
          lvl = Math.max(0, Math.min(3, lvl));
          c = grass[lvl];
          // травинки в 2 пикселя: светлый кончик, тёмный корешок
          if (ph > 0.972 || h2(pxl + 7777, py * 3 + 14) > 0.972) c = blade;
          else if (h2(pxl + 7777, py * 3 + 17) > 0.972) c = bladeDark;
        }
      } else if (t === PATH) {
        const n = vn(tx * 1.3, ty * 1.3) * 0.7 + vn(sx * 0.4, sy * 0.8) * 0.3;
        // у края тропы темнее — утоптанная колея и тень травы
        const rim = typeAt(tx + 0.42, ty) !== PATH || typeAt(tx - 0.42, ty) !== PATH || typeAt(tx, ty + 0.42) !== PATH || typeAt(tx, ty - 0.42) !== PATH;
        c = dirt[Math.max(0, Math.min(3, Math.floor(n * 3.3 + d - (rim ? 1.2 : 0.2))))];
        const cell = h2(Math.floor(pxl / 3) + 300, Math.floor(py / 2));
        if (cell > 0.94) c = (pxl % 3 === 0 || py % 2 === 1) ? pebbleDark : pebble;
      } else if (t === STONE) {
        // брусчатка: ряды камней со смещением, швы, блик сверху и тень снизу у каждого камня
        const v = ty * 2.6, row = Math.floor(v);
        const u = tx * 2.6 + (row & 1) * 0.5, col = Math.floor(u);
        const fu = u - col, fv = v - row;
        if (fu < 0.1 || fv < 0.12) c = seam;
        else {
          const k = h2(col + 50, row + 90);
          let lvl = 1 + Math.floor(k * 2.2 + d * 0.6);
          if (fv < 0.3) lvl += 1;
          if (fv > 0.85 || fu > 0.9) lvl -= 1;
          c = stone[Math.max(0, Math.min(3, lvl))];
          if (ph > 0.992) c = rgb(0x6a8a4a); // мох в трещинке
        }
      } else if (t === SAND) {
        const n = vn(tx * 0.9, ty * 0.9);
        const r = Math.sin((tx * 1.2 + ty * 0.8) * 5 + vn(tx, ty) * 4);
        let lvl = 2 + (r > 0.75 ? 1 : r < -0.8 ? -1 : 0) + Math.floor(n * 1.2 + d - 0.6);
        c = sand[Math.max(0, Math.min(3, lvl))];
        if (ph > 0.99) c = rgb(GROUND.sandDot);
      } else {
        // вода: у берега светлее (мель), к середине темнее (глубина)
        let land = 0;
        for (const [ox, oy] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]])
          if (typeAt(tx + ox, ty + oy) !== WATER) land++;
        const n = vn(tx * 0.8, ty * 0.8);
        const wave = Math.sin(sx * 0.18 + sy * 0.9 + vn(tx * 2, ty * 2) * 5);
        let lvl = Math.floor(land * 0.45 + n * 1.2 + d * 0.8 + (wave > 0.92 ? 1 : 0));
        c = water[Math.max(0, Math.min(3, lvl))];
      }
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  const s = new Sprite(tex);
  s.position.set(x0, y0);
  return s;
}

// ---------- тень Гасителя ----------

/** Тень: клубок тьмы, парит над землёй, снизу — рваные «языки». Глаза рисует Renderer поверх тьмы. */
export function drawShade(g: Graphics, t: number, chase: boolean) {
  const bob = Math.sin(t * 3) * 1.5;
  const y = -9 + bob;
  g.ellipse(0, 1, 6, 2).fill({ color: 0x000000, alpha: 0.35 });
  // языки снизу колышутся
  for (let i = -2; i <= 2; i++) {
    const sway = Math.sin(t * 5 + i * 1.3) * 1.5;
    g.poly([i * 2.4 - 2, y + 2, i * 2.4 + 2, y + 2, i * 2.4 + sway, y + 9 - Math.abs(i)]).fill({ color: 0x120820, alpha: 0.85 });
  }
  const k = chase ? 1.12 : 1;
  g.ellipse(0, y, 7 * k, 7 * k).fill({ color: 0x1a0e2e, alpha: 0.9 });
  g.ellipse(-1, y - 1, 6 * k, 5.5 * k).fill({ color: 0x0e0618, alpha: 0.95 });
  // холодный отсвет по краю
  g.ellipse(-3, y - 4, 2.5, 1.5).fill({ color: 0x4a3a7a, alpha: 0.6 });
  // «рожки» дыма сверху
  g.poly([-4, y - 5, -2, y - 10 - Math.sin(t * 4) * 1.5, 0, y - 5]).fill({ color: 0x120820, alpha: 0.85 });
  g.poly([1, y - 5, 4, y - 9 - Math.cos(t * 4.4) * 1.5, 5, y - 4]).fill({ color: 0x120820, alpha: 0.85 });
}
/** Где на тени глаза (относительно точки на земле). */
export const shadeEyes = (t: number) => ({ y: -10 + Math.sin(t * 3) * 1.5, dx: 2.5 });

// ---------- тайник ----------

/** Сундучок в траве: дубовые доски, железные полосы, из щели — золотой свет. */
export function drawChest(g: Graphics, open: boolean, t: number) {
  g.ellipse(0, 1, 8, 3).fill({ color: 0x000000, alpha: 0.3 });
  const L = [-7, -3], R = [7, -3], F = [0, 1], B = [0, -7];
  const h = 6;
  // бока
  g.poly([L[0], L[1], F[0], F[1], F[0], F[1] - h, L[0], L[1] - h]).fill(0x7a4a26);
  g.poly([F[0], F[1], R[0], R[1], R[0], R[1] - h, F[0], F[1] - h]).fill(0x5a3418);
  // доски
  for (const k of [0.33, 0.66]) {
    g.rect(Math.round(L[0] + (F[0] - L[0]) * k), Math.round(L[1] + (F[1] - L[1]) * k) - h, 1, h).fill(0x5a3418);
    g.rect(Math.round(F[0] + (R[0] - F[0]) * k), Math.round(F[1] + (R[1] - F[1]) * k) - h, 1, h).fill(0x3e2410);
  }
  // железная полоса
  g.poly([L[0], L[1] - 3, F[0], F[1] - 3, F[0], F[1] - 4, L[0], L[1] - 4]).fill(0x5a5a64);
  g.poly([F[0], F[1] - 3, R[0], R[1] - 3, R[0], R[1] - 4, F[0], F[1] - 4]).fill(0x3e3e48);
  if (open) {
    // крышка откинута назад, внутри пусто и темно
    g.poly([L[0], L[1] - h, F[0], F[1] - h, R[0], R[1] - h, B[0], B[1] - h]).fill(0x24140a);
    g.poly([L[0], L[1] - h, B[0], B[1] - h, B[0], B[1] - h - 7, L[0], L[1] - h - 7]).fill(0x8a5a32);
    g.poly([B[0], B[1] - h, R[0], R[1] - h, R[0], R[1] - h - 7, B[0], B[1] - h - 7]).fill(0x6b4423);
    return;
  }
  // крышка
  g.poly([L[0], L[1] - h, F[0], F[1] - h, R[0], R[1] - h, B[0], B[1] - h]).fill(0x9a6a3a);
  g.poly([L[0] + 2, L[1] - h, B[0], B[1] - h + 1, B[0], B[1] - h + 2, L[0] + 2, L[1] - h + 1]).fill(0xb8844a);
  // замок и свет из щели
  const glow = 0.6 + 0.4 * Math.sin(t * 3);
  g.poly([L[0], L[1] - h + 0.5, F[0], F[1] - h + 0.5, R[0], R[1] - h + 0.5]).stroke({ color: 0xffd36b, width: 1, alpha: glow });
  g.rect(-1, F[1] - h + 1, 2, 3).fill(0xd8b040);
  g.rect(-1, F[1] - h + 2, 1, 1).fill(0x3a2a10);
}

// ---------- привал: костёр и палатка ----------

/** Привал в лесу (2×2 клетки от точки 0,0): палатка, костёр в кольце камней, бревно-скамейка. */
export function drawCamp(g: Graphics, t: number) {
  // палатка сзади
  const a = toScreen(0.2, 0.3), b = toScreen(1.3, 0.2), c = toScreen(0.4, 1.2);
  const top = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 - 20 };
  g.ellipse(top.x, (a.y + c.y) / 2 + 2, 16, 5).fill({ color: 0x000000, alpha: 0.25 });
  g.poly([a.x, a.y, c.x, c.y, top.x, top.y]).fill(0xc8b080);
  g.poly([c.x, c.y, b.x + 4, b.y + 8, top.x, top.y]).fill(0x9a8456);
  g.poly([top.x - 1, top.y + 6, top.x + 4, (c.y + b.y) / 2 + 2, top.x - 4, (c.y + b.y) / 2 + 3]).fill(0x3a2a18); // вход
  g.rect(top.x - 0.5, top.y - 3, 1, 4).fill(0x5a3a1a);
  // бревно
  const lg = toScreen(1.6, 0.9);
  g.roundRect(lg.x - 8, lg.y - 4, 16, 5, 2).fill(0x6b4423);
  g.ellipse(lg.x + 8, lg.y - 1.5, 2, 2.5).fill(0xb8844a);
  g.rect(lg.x - 6, lg.y - 3, 10, 1).fill(0x8a5a32);
  // костёр
  const f = toScreen(1.2, 1.5);
  for (let i = 0; i < 7; i++) {
    const an = (i / 7) * Math.PI * 2;
    g.ellipse(f.x + Math.cos(an) * 6, f.y + Math.sin(an) * 3, 2, 1.5).fill(i % 2 ? 0x7a7a84 : 0x9a9aa4);
  }
  g.rect(f.x - 5, f.y - 2, 10, 2).fill(0x4a2a12);
  g.rect(f.x - 3, f.y - 3, 7, 2).fill(0x5a3418);
  g.ellipse(f.x, f.y - 1, 4, 1.5).fill(0xff6a1a);
  for (let i = 0; i < 4; i++) {
    const s = Math.sin(t * (8 + i * 2.3) + i * 1.7);
    const hgt = 7 + i % 2 * 3 + s * 2.5;
    const x = f.x - 3 + i * 2;
    g.poly([x - 2, f.y - 1, x + 2, f.y - 1, x + s * 0.8, f.y - 1 - hgt]).fill(i % 2 ? 0xffa030 : 0xff6a1a);
  }
  g.poly([f.x - 1.5, f.y - 1, f.x + 1.5, f.y - 1, f.x + Math.sin(t * 11) * 0.6, f.y - 6]).fill(0xfff0a0);
  // искры летят вверх
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.8 + i / 3) % 1;
    g.rect(Math.round(f.x + Math.sin(t * 2 + i * 2) * 3), Math.round(f.y - 10 - p * 16), 1, 1).fill({ color: 0xffd36b, alpha: 1 - p });
  }
}
/** Где пламя костра (тайлы, относительно угла привала). */
export const CAMP_FIRE = { x: 1.2, y: 1.5 };
