// Ролики. Сценарий пишется как обычная последовательность шагов:
// «подождать», «сказать реплики», «пойти туда», «потемнеть»…
// Тексты реплик — в story.ts.

import { st, wait, talk, startNight, save, giveJournal, type Actor, type Cine } from './game';
import { homeDoor } from './map';
import {
  residentById, INTRO_DAY, INTRO_VILLAIN, INTRO_END, SPARK_MEET_START, SPARK_MEET, SPARK_WAKE, type ResidentId,
} from './story';
import { makePlaza } from './plaza';
import * as sfx from './audio';

const plaza = makePlaza();

function actor(id: string, x: number, y: number, kind: Actor['kind'] = 'person'): Actor {
  const coat = kind === 'person' ? residentById(id as ResidentId).coat : 0;
  return { id, kind, coat, x, y, tx: x, ty: y, speed: 1.5, face: 1, anim: 0, moving: false, alpha: 1, alphaT: 1, vanish: false, cast: false };
}

function cine(c: Partial<Cine>): Cine {
  return { skip: false, cam: { x: 0, y: 0 }, dark: 0, darkT: 0, fade: 1, fadeT: 0, sky: null, fog: false, homeGlow: false, actors: [], ...c };
}

const get = (id: string) => st.cine!.actors.find((a) => a.id === id)!;

/** Отправить персонажа к точке (при пропуске ролика — сразу телепорт). */
function go(id: string, x: number, y: number, speed = 1.5) {
  const a = get(id);
  a.tx = x; a.ty = y; a.speed = speed;
  if (st.cine!.skip) { a.x = x; a.y = y; }
}

function faceTo(id: string, x: number, y: number) {
  const a = get(id);
  const s = (x - a.x) - (y - a.y);
  if (Math.abs(s) > 0.01) a.face = Math.sign(s);
}

/** Вступление на площади: солнечный день → Гаситель → тёмное солнце. Потом — встреча с Искрой. */
export async function playIntro() {
  st.scene = 'plaza';
  st.cine = cine({
    cam: { x: 8.5, y: 7.5 },
    sky: 'day',
    actors: [
      actor('mila', 12.6, 4.6),
      actor('agata', 4.4, 5.6),
      actor('timofey', 4.5, 11.5),
      actor('nika', 12.4, 9.4),
      actor('filin', 6.6, 3.8),
      actor('seva', 8.5, 15),
    ],
  });
  let c = st.cine;

  await wait(1.2);
  go('seva', 8.6, 10.8, 1.2); // почтальон идёт на площадь
  await wait(1.5);
  await talk(INTRO_DAY);

  // посреди площади собирается тёмный дым — и из него выходит Гаситель
  const smoke = actor('smoke', 8.6, 5.6, 'smoke');
  c.actors.push(smoke);
  sfx.rumble();
  for (const a of c.actors) if (a.kind === 'person') faceTo(a.id, 8.6, 5.6);
  c.darkT = 0.25; // на миг всё меркнет
  await wait(2.4);
  const v = actor('villain', 8.6, 5.6, 'villain');
  v.alpha = 0;
  c.actors.push(v);
  v.alphaT = 1;
  smoke.alphaT = 0;
  // жители в испуге отступают на шаг
  for (const a of c.actors) {
    if (a.kind !== 'person') continue;
    const dx = a.x - 8.6, dy = a.y - 5.6, d = Math.hypot(dx, dy) || 1;
    go(a.id, a.x + (dx / d) * 0.8, a.y + (dy / d) * 0.8, 2);
    faceTo(a.id, 8.6, 5.6);
  }
  await wait(1.6);
  for (const a of c.actors) if (a.kind === 'person') faceTo(a.id, 8.6, 5.6);
  c.darkT = 0;
  await talk(INTRO_VILLAIN);

  // взмах посохом — Солнце темнеет, жители разбегаются по домам
  v.cast = true;
  sfx.out();
  await wait(0.8);
  c.sky = 'dark';
  c.darkT = 0.92;
  await wait(1.6);
  v.cast = false;
  v.alphaT = 0;
  for (const a of c.actors) {
    if (a.kind !== 'person') continue;
    const h = plaza.houses.find((x) => x.rid === a.id);
    if (h) { const d = homeDoor(h); go(a.id, d.x, d.y, 2.6); a.vanish = true; }
  }
  await wait(3.2);
  await talk(INTRO_END);
  c.fadeT = 1;
  await wait(1.2);

  // ---------- прошло три года: Искра находит фонарщика ----------
  startNight();
  const p = st.player;
  st.cine = cine({
    cam: { x: p.x, y: p.y },
    dark: 0.92, darkT: 0.92,
    fog: true,
    actors: [actor('hero', p.x, p.y, 'sleeper'), actor('spark', p.x + 5, p.y - 6, 'spark')],
  });
  c = st.cine;
  await talk(SPARK_MEET_START);
  go('spark', p.x - 0.6, p.y - 0.8, 1.8);
  await wait(3.6);
  await talk(SPARK_MEET);
  get('hero').kind = 'hero';
  sfx.pick();
  await wait(0.6);
  await talk(SPARK_WAKE.slice(0, 4));
  c.homeGlow = true; // Искра согревает дом
  sfx.light();
  await wait(0.8);
  await talk(SPARK_WAKE.slice(4));

  st.spark = { x: p.x - 0.6, y: p.y - 0.8 };
  st.cine = null;
  giveJournal();
  st.seen.intro = true;
  save();
}


