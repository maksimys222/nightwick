// Мебель и мелочи мастерской, чтобы комната была уютной и не пустой.
// Рисуется от верхнего угла клетки предмета (как isoBox).

import { Graphics } from 'pixi.js';
import { toScreen } from './iso';
import { isoBox } from './draw';

/** Книжный шкаф у задней стены: полки с разноцветными корешками, сверху — глобус. */
export function drawBookshelf(g: Graphics) {
  isoBox(g, 2, 1, 34, 0x7a5232, 0x5a3a20, 0x9a6e40);
  const l = toScreen(0, 1), b = toScreen(2, 1);
  const P = (u: number, v: number) => [l.x + (b.x - l.x) * u, l.y + (b.y - l.y) * u - v];
  const colors = [0xc83a32, 0x3a7ad0, 0xe0a030, 0x3e9a40, 0x8a4a7a, 0xf0e4c8, 0x5a6a8a];
  for (const v of [4, 14, 24]) {
    // полка и книги на ней
    g.poly([...P(0.04, v), ...P(0.96, v), ...P(0.96, v - 1.5), ...P(0.04, v - 1.5)]).fill(0x4a2e18);
    let u = 0.07, i = Math.floor(v / 3);
    while (u < 0.9) {
      const w = 0.035 + ((i * 7) % 3) * 0.012, h = 6 + ((i * 5) % 3);
      g.poly([...P(u, v), ...P(u + w, v), ...P(u + w, v + h), ...P(u, v + h)]).fill(colors[i % colors.length]);
      g.poly([...P(u, v + h - 1.5), ...P(u + w, v + h - 1.5), ...P(u + w, v + h - 1), ...P(u, v + h - 1)]).fill(0xf0d080);
      u += w + 0.008;
      i++;
    }
  }
  // глобус наверху
  const t = toScreen(1.4, 0.5);
  g.rect(t.x, t.y - 36, 1, 3).fill(0x8a6a3a);
  g.circle(t.x, t.y - 40, 3.5).fill(0x3a8ab0);
  g.rect(t.x - 2, t.y - 42, 2, 2).fill(0x5aaa4a);
  g.rect(t.x + 1, t.y - 39, 2, 1).fill(0x5aaa4a);
}

/** Кресло у камина: мягкое, с клетчатым пледом. */
export function drawArmchair(g: Graphics) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y + 1, 9, 3.5).fill({ color: 0x000000, alpha: 0.25 });
  isoBox(g, 1, 1, 8, 0x8a3a3a, 0x6a2a2a, 0xa84a44);
  // спинка (у задней стороны) и подлокотники
  const bk = toScreen(0, 0), br = toScreen(1, 0);
  g.poly([bk.x, bk.y - 8, br.x, br.y - 8, br.x, br.y - 20, bk.x, bk.y - 20]).fill(0x9a4440);
  g.poly([bk.x, bk.y - 20, br.x, br.y - 20, br.x - 2, br.y - 21, bk.x + 2, bk.y - 21]).fill(0xc85a52);
  g.ellipse(c.x - 7, c.y - 9, 2.5, 4).fill(0xa84a44);
  g.ellipse(c.x + 7, c.y - 9, 2.5, 4).fill(0x7a3030);
  // плед в клетку
  for (let i = 0; i < 4; i++) g.rect(c.x - 4 + i * 2, c.y - 10, 2, 2).fill(i % 2 ? 0xe0b040 : 0x3a6a3a);
  g.rect(c.x - 4, c.y - 8, 8, 1).fill(0xe0b040);
}

/** Кошка спит клубочком на коврике у огня; иногда шевелит ухом и хвостом. */
export function drawCat(g: Graphics, t: number) {
  g.ellipse(0, 1, 7, 2.5).fill({ color: 0x000000, alpha: 0.2 });
  g.ellipse(0, -2, 6, 3.2).fill(0xe08a3a);
  g.ellipse(-1, -3, 4, 2).fill(0xf0a858);
  for (const dx of [-2, 1]) g.rect(dx, -5, 2, 1).fill(0xb8642a); // полоски
  g.circle(4, -3, 2.6).fill(0xe08a3a);                              // голова
  const ear = Math.floor(t * 0.5) % 7 === 0 ? -1 : 0;
  g.poly([3, -5, 4, -7 + ear, 5, -5]).fill(0xe08a3a);
  g.poly([5, -5, 6.5, -6.5, 6.5, -4]).fill(0xc8702a);
  g.rect(4, -3, 2, 1).fill(0x5a3010);                               // закрытые глазки
  const tail = Math.sin(t * 1.2) * 1.5;
  g.poly([-6, -2, -9, -1 + tail, -8, 0 + tail, -5, -1]).fill(0xc8702a);
  // Zz над кошкой
  const z = (t * 0.6) % 1;
  g.rect(6 + z * 3, -10 - z * 6, 2, 1).fill({ color: 0xe8f0ff, alpha: 1 - z });
}

/** Поленница у камина. */
export function drawWoodpile(g: Graphics) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y + 1, 8, 3).fill({ color: 0x000000, alpha: 0.25 });
  const logs = [[-5, -3], [0, -3], [5, -3], [-2.5, -7], [2.5, -7], [0, -11]];
  for (const [dx, dy] of logs) {
    g.circle(c.x + dx, c.y + dy, 2.6).fill(0x6b4423);
    g.circle(c.x + dx, c.y + dy, 1.8).fill(0xc89a62);
    g.circle(c.x + dx, c.y + dy, 0.7).fill(0x9a6a3a);
  }
  g.rect(c.x - 7, c.y - 2, 14, 2).fill(0x4a2e18);
}

/** Верстак фонарщика: тиски, стекло для фонаря, бидон, гаечный ключ. */
export function drawWorkbench(g: Graphics) {
  isoBox(g, 1, 1, 11, 0x8a5a32, 0x6a4422, 0xa87a48);
  const c = toScreen(0.5, 0.5);
  g.rect(c.x - 6, c.y - 15, 4, 4).fill(0x5a5a66);           // тиски
  g.rect(c.x - 7, c.y - 13, 6, 1).fill(0x8a8a96);
  g.rect(c.x, c.y - 17, 4, 5).fill(0xbfe0ff);               // стекло для фонаря
  g.rect(c.x, c.y - 17, 1, 5).fill(0xffffff);
  g.rect(c.x + 4, c.y - 14, 3, 3).fill(0xd8a84a);           // бидон
  g.rect(c.x + 5, c.y - 15, 1, 1).fill(0x8a8a96);
  g.rect(c.x - 2, c.y - 10, 5, 1).fill(0x9a9aa8);           // ключ
}

/** Ящики и бочка в углу. */
export function drawCrates(g: Graphics) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y + 1, 9, 3.5).fill({ color: 0x000000, alpha: 0.25 });
  isoBox(g, 0.7, 0.7, 8, 0xb08050, 0x8a5a32, 0xc89a62);
  const t = toScreen(0.35, 0.35);
  g.rect(t.x - 1, t.y - 8, 2, 1).fill(0x6b4423);
  // бочка
  g.rect(c.x + 3, c.y - 10, 7, 10).fill(0x8a5a32);
  g.rect(c.x + 3, c.y - 10, 2, 10).fill(0xa87a48);
  for (const v of [-8, -2]) g.rect(c.x + 3, c.y + v, 7, 1).fill(0x5a5a66);
  g.ellipse(c.x + 6.5, c.y - 10, 3.5, 1.3).fill(0x6b4423);
}

/** Вешалка у двери: пальто, шарф и запасной цилиндр. */
export function drawCoatRack(g: Graphics) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y + 1, 5, 2).fill({ color: 0x000000, alpha: 0.25 });
  g.rect(c.x - 3, c.y - 1, 6, 2).fill(0x5a3a20);
  g.rect(c.x, c.y - 30, 1, 30).fill(0x6b4423);
  g.rect(c.x - 3, c.y - 29, 7, 1).fill(0x8a5a32);
  g.rect(c.x - 4, c.y - 27, 4, 12).fill(0x2f3e6e);          // пальто
  g.rect(c.x - 4, c.y - 27, 1, 12).fill(0x4a5c98);
  g.rect(c.x + 1, c.y - 26, 2, 9).fill(0xd04a3a);           // шарф
  g.rect(c.x - 2, c.y - 35, 5, 5).fill(0x262433);           // цилиндр
  g.rect(c.x - 3, c.y - 31, 7, 1).fill(0x262433);
  g.rect(c.x - 2, c.y - 32, 5, 1).fill(0x9a3a2a);
}

/** Обеденный стол со скатертью, свечой, чашками и пирогом; два табурета. */
export function drawDiningTable(g: Graphics, t: number) {
  const c = toScreen(0.5, 0.5);
  for (const [dx, dy] of [[-10, 3], [10, 3]]) {
    g.ellipse(c.x + dx, c.y + dy, 3.5, 1.6).fill(0x8a5a32);
    g.rect(c.x + dx - 1, c.y + dy, 2, 4).fill(0x5a3a20);
  }
  isoBox(g, 1, 1, 10, 0x8a5a32, 0x6a4422, 0xf0e8d8);
  const top = toScreen(0.5, 0.5);
  g.poly([top.x - 14, top.y - 10, top.x, top.y - 17, top.x + 14, top.y - 10, top.x, top.y - 3]).fill(0xf4ecdc);
  for (let i = -2; i <= 2; i++) g.rect(top.x + i * 5 - 1, top.y - 11 + Math.abs(i), 2, 1).fill(0xd04a3a); // узор скатерти
  g.rect(top.x - 1, top.y - 17, 2, 5).fill(0xf4ecd8);       // свеча
  g.rect(top.x - 1, top.y - 19, 2, 2).fill(Math.sin(t * 7) > 0 ? 0xffd36b : 0xffb040);
  g.rect(top.x - 6, top.y - 12, 3, 2).fill(0x3a7ad0);       // чашки
  g.rect(top.x + 4, top.y - 11, 3, 2).fill(0xe8e0d0);
  g.ellipse(top.x + 1, top.y - 9, 3, 1.4).fill(0xc8803a);   // пирог
}

/** Цветок в горшке. */
export function drawPlant(g: Graphics, v: number) {
  const c = toScreen(0.5, 0.5);
  g.ellipse(c.x, c.y + 1, 5, 2).fill({ color: 0x000000, alpha: 0.25 });
  g.poly([c.x - 4, c.y - 6, c.x + 4, c.y - 6, c.x + 3, c.y, c.x - 3, c.y]).fill(0xc8603a);
  g.rect(c.x - 4, c.y - 7, 8, 1).fill(0xe07a4a);
  const leaf = v > 0.5 ? 0x3e9a40 : 0x2f7f34;
  for (const [dx, dy, w] of [[-5, -12, 4], [1, -14, 4], [-2, -18, 4], [2, -10, 3]]) g.ellipse(c.x + dx, c.y + dy, w, 2).fill(leaf);
  if (v > 0.5) { g.circle(c.x - 1, c.y - 19, 1.5).fill(0xff7aa8); g.circle(c.x + 3, c.y - 15, 1.5).fill(0xffd23a); }
}
