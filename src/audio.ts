// Звуки синтезируются кодом (Web Audio) — никаких файлов.
// Браузер разрешает звук только после первого нажатия, поэтому unlock() зовём из ввода.

let ctx: AudioContext | null = null;
let master: GainNode;
let noise: AudioBuffer;

const VOL_KEY = 'lamplighter-volume';
let volume = 0.5;
try { volume = Number(localStorage.getItem(VOL_KEY) ?? 0.5); } catch { /* по умолчанию */ }

export const getVolume = () => volume;
export function setVolume(v: number) {
  volume = v;
  if (ctx) master.gain.value = v;
  try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* ничего */ }
}

export function unlock() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo = freq, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(dur: number, vol: number, from: number, to: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur);
}

/** «Пуф» — фонарь загорелся. */
export function light() {
  hiss(0.5, 0.5, 300, 2500);
  tone(330, 0.6, 'triangle', 0.15, 660, 0.1);
  tone(495, 0.6, 'triangle', 0.1, 990, 0.18);
}
/** Масло долито. */
export function pour() { tone(220, 0.15, 'sine', 0.15, 330); }
/** Фонарь погас. */
export function out() { hiss(0.6, 0.15, 1500, 200); }
/** Сорвали подсолнух. */
export function pick() { tone(700, 0.08, 'square', 0.06, 900); }
/** Маслобойня. */
export function press() { tone(110, 0.3, 'sawtooth', 0.12, 70); hiss(0.3, 0.2, 400, 200); }
/** Покупка улучшения. */
export function buy() { [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, f, i * 0.06)); }
/** Цель выполнена. */
export function goal() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.4, 'sine', 0.12, f, i * 0.09)); }
/** Стук в дверь. */
export function knock() { [0, 0.15].forEach((d) => tone(160, 0.08, 'square', 0.15, 90, d)); }
/** Гул тьмы — появление Гасителя. */
export function rumble() {
  tone(55, 2.2, 'sawtooth', 0.12, 40);
  tone(82, 2.2, 'triangle', 0.08, 60, 0.2);
  hiss(2.4, 0.25, 600, 120);
}
