import '@fontsource/pixelify-sans/cyrillic-400.css';
import '@fontsource/pixelify-sans/400.css';
import './style.css';
import { Application } from 'pixi.js';
import { st, update, world, boot, resetSave } from './game';
import { playIntro } from './cinema';
import { Renderer } from './render';
import { UI } from './ui';
import { unlock } from './audio';

const keys = new Set<string>();
// e.code — физическая клавиша, поэтому WASD работает и на русской раскладке
addEventListener('keydown', (e) => {
  keys.add(e.code);
  unlock();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('pointerdown', unlock);

const k = (...codes: string[]) => (codes.some((c) => keys.has(c)) ? 1 : 0);

const app = new Application();
await app.init({ resizeTo: window, antialias: false, background: '#000000', resolution: 1 });
document.getElementById('screen')!.appendChild(app.canvas);

const hasSave = boot();
const AUTOSTART = 'lamplighter-autostart';
const renderer = new Renderer(app);
const ui = new UI(renderer, {
  hasGame: () => st.seen.intro,
  start: () => { if (!st.seen.intro) playIntro(); },
  newGame: () => {
    if (!hasSave) { playIntro(); return; }
    // начать заново: стираем сохранение, перезагружаемся и сразу запускаем ролик
    try { sessionStorage.setItem(AUTOSTART, '1'); } catch { /* ничего */ }
    resetSave();
  },
});
let autostart = false;
try { autostart = sessionStorage.getItem(AUTOSTART) === '1'; sessionStorage.removeItem(AUTOSTART); } catch { /* ничего */ }
if (autostart) playIntro();
else ui.openMenu('main');
addEventListener('resize', () => renderer.resize());

app.ticker.add((t) => {
  const dt = Math.min(0.1, t.deltaMS / 1000);
  update(dt, {
    ix: k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'),
    iy: k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp'),
    hold: !!k('KeyE', 'Space'),
  });
  renderer.frame(dt);
  ui.frame(dt);
});

// для отладки из консоли браузера: sim(5, { iy: -1 }) — 5 секунд идти вверх
const sim = (sec: number, inp: Partial<{ ix: number; iy: number; hold: boolean }> = {}) => {
  for (let t = 0; t < sec; t += 1 / 60) update(1 / 60, { ix: 0, iy: 0, hold: false, ...inp });
  for (let i = 0; i < 6; i++) renderer.frame(1 / 60);
  renderer.frame(1);
  ui.frame(1);
  app.render();
};
// step(n) — прогнать n настоящих кадров по 1/60 с (для замеров плавности)
const step = (n = 1) => {
  for (let i = 0; i < n; i++) {
    update(1 / 60, { ix: 0, iy: 0, hold: false });
    renderer.frame(1 / 60);
    ui.frame(1 / 60);
  }
  app.render();
};
Object.assign(window, { st, world, sim, step, renderer, ui });
