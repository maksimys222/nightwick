// Звуки синтезируются кодом (Web Audio) — никаких файлов.
// Браузер разрешает звук только после первого нажатия, поэтому unlock() зовём из ввода.

let ctx: AudioContext | null = null;
let master: GainNode;
let noise: AudioBuffer;

const VOL_KEY = 'lamplighter-volume';
const MUSIC_KEY = 'lamplighter-music';
let volume = 0.5;
let musicVolume = 0.5;
try { volume = Number(localStorage.getItem(VOL_KEY) ?? 0.5); } catch { /* по умолчанию */ }
try { musicVolume = Number(localStorage.getItem(MUSIC_KEY) ?? 0.5); } catch { /* по умолчанию */ }
let musicGain: GainNode;

export const getVolume = () => volume;
export function setVolume(v: number) {
  volume = v;
  if (ctx) master.gain.value = v;
  try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* ничего */ }
}

export const getMusicVolume = () => musicVolume;
export function setMusicVolume(v: number) {
  musicVolume = v;
  if (ctx) musicGain.gain.value = v * 0.5;
  try { localStorage.setItem(MUSIC_KEY, String(v)); } catch { /* ничего */ }
}

export function unlock() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = musicVolume * 0.5;
  musicGain.connect(ctx.destination);
  setInterval(scheduleMusic, 60);
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

// ---------- музыка ----------
// Мелодия — восьмыми нотами (номера MIDI, null — пауза), под ней — аккорды по тактам.
// Меню и мастерская — тёплая «музыкальная шкатулка», ночь — тише и задумчивее.

type Track = { bpm: number; melody: (number | null)[]; chords: number[][] };
const TRACKS: Record<'menu' | 'night', Track> = {
  menu: {
    bpm: 84,
    melody: [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 81, 84, 81, 79, 76, null,
      74, 76, 79, 76, 74, 72, 69, 72, 74, null, 76, 74, 72, null, null, null],
    chords: [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]],
  },
  night: {
    bpm: 62,
    melody: [69, null, 72, null, 76, null, 74, 72, 69, null, null, 67, 69, null, null, null,
      72, null, 74, null, 76, null, 79, 76, 74, null, 72, null, 69, null, null, null],
    chords: [[45, 52, 60], [41, 48, 57], [48, 55, 64], [40, 47, 55]],
  },
};
let track: keyof typeof TRACKS | null = null;
let nextT = 0;
let stepN = 0;

/** Какую музыку играть: 'menu', 'night' или null — тишина. */
export function setMusic(t: keyof typeof TRACKS | null) {
  if (t === track) return;
  track = t;
  stepN = 0;
  if (ctx) nextT = ctx.currentTime + 0.1;
}

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function note(m: number, t: number, dur: number, vol: number, type: OscillatorType) {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.type = type;
  o.frequency.value = hz(m);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicGain);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function scheduleMusic() {
  if (!ctx || !track || musicVolume <= 0) return;
  const tr = TRACKS[track];
  const eighth = 60 / tr.bpm / 2;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.4) {
    const i = stepN % tr.melody.length;
    const m = tr.melody[i];
    // шкатулка: чистый тон и тихая октава сверху, быстро затухает
    if (m !== null) { note(m, nextT, 0.9, 0.12, 'triangle'); note(m + 12, nextT, 0.5, 0.03, 'sine'); }
    // в начале такта — мягкий аккорд
    if (i % 8 === 0) for (const c of tr.chords[(i / 8) % tr.chords.length]) note(c, nextT, eighth * 8, 0.035, 'sine');
    nextT += eighth;
    stepN++;
  }
}
