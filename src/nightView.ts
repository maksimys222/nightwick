// Карта с фонарями: ночная улица (игра) или площадь из ролика.
// Земля, деревья, фонари, подсолнухи, дома, игрок, подносчики, персонажи роликов.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TW, TH, toScreen } from './iso';
import { GRASS, PATH, WATER, STONE, SAND, BRIDGE, homeDoor, outsideGround, type World } from './map';
import type { Plaza } from './plaza';
import { st, lights, burning, lampCap, darkAlpha, has, KINDS } from './game';
import { residentById, type ResidentId } from './story';
import {
  hash, diamond, drawTree, drawLamp, glassHeight, lampArt, drawFlower, drawHouse, drawPress, drawPerson, drawVillain, drawSpark,
  drawHome, drawSleeper, drawFountain, drawStall, drawAnvil, drawEasel, drawSmoke,
} from './draw';
import type { View, Halo } from './render';
import { art, heroTex } from './sprites';
import { Figure } from './figure';
import { BIOMES, GROUND, ROOFS } from './palette';

interface Dyn { key: string; keyOf: () => string; draw: () => void }

export class NightView implements View {
  readonly root = new Container();
  readonly fog: Container | null;
  /** Туман: картинка, где 1 пиксель = 1 тайл; растянута в изометрию и сглажена — края мягкие. */
  private fogCanvas: HTMLCanvasElement | null = null;
  private fogTex: Texture | null = null;
  readonly glowTint = 0xff9a30;
  private objects = new Container({ sortableChildren: true });
  private dyn: Dyn[] = [];
  private anim: (() => void)[] = [];
  private player = new Figure();
  private helperGs: Figure[] = [];
  private compass = new Graphics();
  private actorGs: Figure[] = [];
  private fogVer = -1;

  /** main — настоящая улица (с туманом, игроком, домом); иначе — декорация для ролика. */
  constructor(private w: World, private main: boolean) {
    this.fog = main ? this.makeFog() : null;
    const [back, front] = buildHorizon(w);
    this.root.addChild(buildGround(w), back, this.objects, front);
    this.build();
  }

  /** Когда фонарь зажёгся (секунды игры) — для вспышки при зажигании. */
  private litAt = new Map<number, number>();
  private wasLit = new Set<number>();

  darkAlpha = darkAlpha;

  /** Фонарь, который сейчас зажигают (держат E), — или null. */
  private lightingLamp() {
    if (!st.hold.key.startsWith('lamp') || st.hold.t <= 0) return null;
    return this.w.lamps.find((l) => 'lamp' + l.id === st.hold.key) ?? null;
  }

  /** Ореолы вокруг стёкол горящих фонарей и огонёк на шесте фонарщика. */
  halos(): Halo[] {
    const out: Halo[] = [];
    if (this.main && !st.cine && !st.nightOver && heroTex(false, 0)) {
      const pl = st.player, lamp = this.lightingLamp();
      const face = lamp ? Math.sign(toScreen(lamp.x + 0.5, lamp.y + 0.5).x - toScreen(pl.x, pl.y).x) || pl.face : pl.face;
      // где огонёк на картинке 24×32: за спиной (−9.5) или поднят к фонарю (+10.5), почти у самого верха
      out.push({ x: pl.x, y: pl.y, lift: 30, dx: (lamp ? 10.5 : -9.5) * face, tint: 0xffa040, id: -5,
        flash: 0, low: 0, size: lamp ? 0.5 : 0.32 });
    }
    for (const l of this.w.lamps) {
      const on = burning(l);
      if (on && !this.wasLit.has(l.id)) { this.wasLit.add(l.id); this.litAt.set(l.id, st.time); }
      if (!on) { this.wasLit.delete(l.id); continue; }
      const since = st.time - (this.litAt.get(l.id) ?? -9);
      // мало масла — огонь «чихает»: ореол дрожит сильнее
      const low = KINDS[l.kind].drain ? Math.max(0, 1 - l.oil / (lampCap(l) * 0.25)) : 0;
      out.push({
        x: l.x + 0.5, y: l.y + 0.5, lift: glassHeight(l) + (l.kind === 'marsh' ? 0 : 0.5),
        tint: KINDS[l.kind].tint, id: l.id, flash: Math.max(0, 1 - since / 0.7), low,
        size: l.kind === 'beacon' ? 1.5 : 1,
      });
    }
    return out;
  }
  lights = lights;
  focus() { return st.cine ? st.cine.cam : { x: st.player.x, y: st.player.y }; }
  /** Искру рисует Renderer поверх мира — так она летает плавно, без пиксельных скачков. */
  sparks() {
    if (st.cine) return st.cine.actors.filter((a) => a.kind === 'spark').map((a) => ({ x: a.x, y: a.y, alpha: a.alpha }));
    return this.main ? [{ x: st.spark.x, y: st.spark.y, alpha: 1 }] : [];
  }

  private place(g: Container, x: number, y: number, z = x + y) {
    const s = toScreen(x, y);
    g.position.set(Math.round(s.x), Math.round(s.y));
    g.zIndex = z * 10;
    this.objects.addChild(g);
  }

  private build() {
    const w = this.w;
    for (const t of w.trees) {
      const g = new Graphics();
      drawTree(g, t.v, bio(w, t.x, t.y));
      this.place(g, t.x + 0.5, t.y + 0.5);
    }
    const dyn = (keyOf: () => string, draw: () => void) => this.dyn.push({ key: '', keyOf, draw });
    for (const l of w.lamps) {
      // картинка художника (если уже есть) + поверх неё полоска масла; иначе — заглушка кодом
      const c = new Container();
      const pic = new Sprite();
      const g = new Graphics();
      const shadow = new Graphics();
      c.addChild(shadow, pic, g);
      this.place(c, l.x + 0.5, l.y + 0.5);
      dyn(() => `${burning(l)}|${l.everLit}|${l.kindled > 0}|${Math.round((l.oil / lampCap(l)) * 10)}`, () => {
        const t = art(lampArt(l, burning(l)));
        pic.visible = !!t;
        if (t) {
          pic.texture = t;
          // точка опоры шаблона — низ по центру, во второй строке снизу
          pic.position.set(-Math.floor(t.width / 2), -(t.height - 2));
        }
        shadow.clear();
        if (t) shadow.ellipse(0, 1, l.kind === 'beacon' ? 9 : 5, l.kind === 'beacon' ? 3.5 : 2).fill({ color: 0x000000, alpha: 0.3 });
        drawLamp(g.clear(), l, !!t);
      });
    }
    for (const f of w.flowers) {
      const g = new Graphics();
      this.place(g, f.x + 0.5, f.y + 0.5);
      dyn(() => String(f.stage), () => drawFlower(g.clear(), f));
    }
    for (const h of w.houses) {
      const g = new Graphics();
      this.place(g, h.x, h.y, h.x + h.y + 2);
      const lit = () => this.main && st.met.includes(h.rid);
      dyn(() => String(lit()), () => drawHouse(g.clear(), lit(), ROOFS[h.rid]));
    }
    for (const pr of w.presses) {
      const g = new Graphics();
      drawPress(g);
      this.place(g, pr.x, pr.y, pr.x + pr.y + 1);
    }
    // мост: целый или с дырами — зависит от того, починил ли его Тимофей
    const bridge = new Graphics();
    bridge.zIndex = -1e6;
    this.objects.addChild(bridge);
    dyn(() => String(this.main && st.up.bridge > 0), () => drawBridge(bridge.clear(), w, this.main && st.up.bridge > 0));
    if (w.home) {
      const g = new Graphics();
      this.place(g, w.home.x, w.home.y, w.home.x + w.home.y + 2);
      this.anim.push(() => drawHome(g.clear(), st.time));
    }
    for (const p of (w as Plaza).props ?? []) {
      const g = new Graphics();
      this.place(g, p.x, p.y, p.x + p.w / 2 + p.y + p.h / 2);
      if (p.kind === 'fountain') this.anim.push(() => drawFountain(g.clear(), st.time));
      if (p.kind === 'stall') drawStall(g);
      if (p.kind === 'anvil') drawAnvil(g);
      if (p.kind === 'easel') drawEasel(g);
    }
    this.objects.addChild(this.player, this.compass);
    this.compass.zIndex = 1e6;
  }

  update() {
    for (const d of this.dyn) {
      const k = d.keyOf();
      if (k !== d.key) { d.key = k; d.draw(); }
    }
    for (const a of this.anim) a();

    this.drawActors();
    const playing = this.main && !st.cine;
    this.player.visible = playing;
    const pl = st.player;
    const p = toScreen(pl.x, pl.y);
    if (playing) {
      // зажигает фонарь: поворачивается к нему и поднимает шест
      const lamp = this.lightingLamp();
      const face = lamp ? Math.sign(toScreen(lamp.x + 0.5, lamp.y + 0.5).x - p.x) || pl.face : pl.face;
      this.player.hero(face, pl.anim, pl.moving, !st.nightOver, !!lamp, st.time);
      this.player.position.set(Math.round(p.x), Math.round(p.y));
      this.player.zIndex = (pl.x + pl.y) * 10 + 1;
    }

    while (this.helperGs.length < st.helpers.length) {
      const g = new Figure();
      this.objects.addChild(g);
      this.helperGs.push(g);
    }
    this.helperGs.forEach((g, i) => {
      const h = playing ? st.helpers[i] : undefined;
      g.visible = !!h;
      if (!h) return;
      g.person('helper', h.face, h.anim, h.moving, 0x3f6b3a);
      const s = toScreen(h.x, h.y);
      g.position.set(Math.round(s.x), Math.round(s.y));
      g.zIndex = (h.x + h.y) * 10 + 1;
    });

    this.drawCompass(p, playing);

    if (this.fog) {
      this.fog.visible = !st.cine || st.cine.fog;
      if (this.fogVer !== st.knownVer) {
        this.fogVer = st.knownVer;
        this.drawFog();
      }
    }
  }

  /**
   * Стрелки вокруг игрока: жёлтая — к ближайшему тёмному фонарю (компас),
   * розовая — к дому жителя (подсказка Искры), белая — домой, когда фонарь гаснет.
   */
  private drawCompass(p: { x: number; y: number }, playing: boolean) {
    const g = this.compass.clear();
    if (!playing || st.nightOver) return;
    const pl = st.player;
    const arrow = (tx: number, ty: number, color: number, ring: number) => {
      if (Math.hypot(tx - pl.x, ty - pl.y) < 2.5) return;
      const t = toScreen(tx, ty);
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      const cx = Math.round(p.x + Math.cos(a) * ring), cy = Math.round(p.y - 8 + Math.sin(a) * ring * 0.62);
      const f = (r: number, da: number) => [cx + Math.cos(a + da) * r, cy + Math.sin(a + da) * r];
      g.poly([...f(7, 0), ...f(5, 2.5), ...f(2, Math.PI), ...f(5, -2.5)]).fill({ color, alpha: 0.95 });
    };
    if (st.up.compass) {
      let best = null, bd = Infinity;
      for (const l of this.w.lamps) {
        if (l.everLit) continue;
        const d = Math.hypot(l.x + 0.5 - pl.x, l.y + 0.5 - pl.y);
        if (d < bd) { bd = d; best = l; }
      }
      if (best) arrow(best.x + 0.5, best.y + 0.5, 0xffd36b, 16);
    }
    if (st.pointTo && !st.met.includes(st.pointTo)) {
      const h = this.w.houses.find((x) => x.rid === st.pointTo);
      if (h) arrow(h.x + 1, h.y + 1, 0xff7ab8, 22);
    }
    // «Зоркость»: зелёная стрелка — к ближайшему спелому подсолнуху
    if (has('ripe')) {
      let best = null, bd = Infinity;
      for (const f of this.w.flowers) {
        if (f.stage !== 3) continue;
        const d = Math.hypot(f.x + 0.5 - pl.x, f.y + 0.5 - pl.y);
        if (d < bd) { bd = d; best = f; }
      }
      if (best) arrow(best.x + 0.5, best.y + 0.5, 0x6bff7a, 19);
    }
    // белая — домой: когда фонарь гаснет, а с «Хлебными крошками» — всю ночь
    if (this.w.home && (st.lantern < 15 || has('crumbs'))) {
      const d = homeDoor(this.w.home);
      if (Math.floor(st.time * 3) % 2 === 0 || st.lantern > 8) arrow(d.x, d.y, 0xffffff, 28);
    }
  }

  /** Персонажи ролика. */
  private drawActors() {
    const actors = st.cine?.actors ?? [];
    while (this.actorGs.length < actors.length) {
      const f = new Figure();
      this.objects.addChild(f);
      this.actorGs.push(f);
    }
    this.actorGs.forEach((f, i) => {
      const a = actors[i];
      f.visible = !!a && a.alpha > 0.01 && a.kind !== 'spark';
      if (!f.visible) return;
      if (a.kind === 'hero') f.hero(a.face, a.anim, a.moving, true);
      else if (a.kind !== 'villain' && a.kind !== 'sleeper' && a.kind !== 'smoke') {
        f.person(a.id, a.face, a.anim, a.moving, residentById(a.id as ResidentId).coat);
      } else {
        const g = f.graphics();
        if (a.kind === 'villain') drawVillain(g, a.face, st.time, a.cast);
        else if (a.kind === 'sleeper') drawSleeper(g);
        else if (a.kind === 'smoke') drawSmoke(g, a.anim);
      }
      f.alpha = a.alpha;
      const s = toScreen(a.x, a.y);
      f.position.set(Math.round(s.x), Math.round(s.y));
      f.zIndex = (a.x + a.y) * 10 + 1;
    });
  }

  private static readonly PAD = 24;

  /** Холст тумана с запасом за краями карты; спрайт повёрнут на 45° и сплющен вдвое — получаются ромбы. */
  private makeFog() {
    const P = NightView.PAD;
    const c = document.createElement('canvas');
    c.width = this.w.w + P * 2;
    c.height = this.w.h + P * 2;
    this.fogCanvas = c;
    this.fogTex = Texture.from(c);
    this.fogTex.source.scaleMode = 'linear';
    const spr = new Sprite(this.fogTex);
    spr.rotation = Math.PI / 4;
    spr.scale.set((TW / 2) * Math.SQRT2);
    const o = toScreen(-P, -P);
    spr.position.set(o.x, o.y * 2 - 8); // чуть выше — прячет верхушки деревьев
    const root = new Container();
    root.scale.y = 0.5;
    root.addChild(spr);
    return root;
  }

  /** Неизведанное — чёрное. За краем карты туман такой же, как у ближайшей клетки на краю. */
  private drawFog() {
    const c = this.fogCanvas!, P = NightView.PAD;
    const g = c.getContext('2d')!;
    const img = g.createImageData(c.width, c.height);
    const { w: W, h: H } = this.w;
    for (let y = 0; y < c.height; y++) {
      const ty = Math.min(H - 1, Math.max(0, y - P));
      for (let x = 0; x < c.width; x++) {
        const tx = Math.min(W - 1, Math.max(0, x - P));
        img.data[(y * c.width + x) * 4 + 3] = st.known[ty * W + tx] ? 0 : 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.fogTex!.source.update();
  }
}

/** Район клетки с «рваной» границей: соседние районы немного заходят друг в друга. */
const bio = (w: World, x: number, y: number) =>
  BIOMES[w.biome(x + Math.round((hash(x, y + 7) - 0.5) * 4), y + Math.round((hash(x + 3, y) - 0.5) * 4))];

/** Доски моста поверх воды. Сломанный — с дырами. */
function drawBridge(g: Graphics, w: World, fixed: boolean) {
  for (let y = 0; y < w.h; y++) {
    for (let x = 0; x < w.w; x++) {
      if (w.ground[y * w.w + x] !== BRIDGE) continue;
      for (let k = 0; k < 4; k++) {
        if (!fixed && hash(x * 5 + k, y) > 0.45) continue;
        const a = toScreen(x + k / 4, y), b = toScreen(x + (k + 0.8) / 4, y + 1);
        const a2 = toScreen(x + k / 4, y + 1), b2 = toScreen(x + (k + 0.8) / 4, y);
        g.poly([a.x, a.y, b2.x, b2.y, b.x, b.y, a2.x, a2.y]).fill(k % 2 ? 0x8a5a32 : 0x9a6a3a);
      }
      // перила
      const r1 = toScreen(x, y), r2 = toScreen(x + 1, y);
      g.poly([r1.x, r1.y - 6, r2.x, r2.y - 6, r2.x, r2.y - 4, r1.x, r1.y - 4]).fill(0x6b4423);
    }
  }
}

/** Лес (и море) за краем карты, чтобы мир не обрывался: задний ряд — за всем, передний — перед всем. */
function buildHorizon(w: World): [Graphics, Graphics] {
  const back = new Graphics(), front = new Graphics();
  back.zIndex = -1e6;
  front.zIndex = 1e6;
  const M = 14;
  for (let y = -M; y < w.h + M; y++) {
    for (let x = -M; x < w.w + M; x++) {
      if (x >= 0 && y >= 0 && x < w.w && y < w.h) continue;
      if (outsideGround(w, x, y) !== GRASS || hash(x + 300, y - 70) > 0.8) continue;
      const g = x < 0 || y < 0 ? back : front;
      const c = toScreen(x + 0.5, y + 0.5);
      g.translateTransform(c.x, c.y);
      drawTree(g, hash(x, y + 5), bio(w, x, y));
      g.translateTransform(-c.x, -c.y);
    }
  }
  return [back, front];
}

function buildGround(w: World) {
  const { w: W, h: H } = w;
  const g = new Graphics();
  const M = 14;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? w.ground[y * W + x] : outsideGround(w, x, y));
  for (let y = -M; y < H + M; y++) {
    for (let x = -M; x < W + M; x++) {
      const t0 = at(x, y);
      const t = t0 === BRIDGE ? WATER : t0;
      const n = hash(x, y);
      const color = t === WATER ? GROUND.water[n > 0.5 ? 0 : 1]
        : t === PATH ? GROUND.path[n > 0.5 ? 0 : 1]
        : t === STONE ? GROUND.stone[(x + y) & 1]
        : t === SAND ? GROUND.sand[n > 0.5 ? 0 : 1]
        : bio(w, x, y).grass[Math.floor(n * 3)];
      diamond(g, x, y, color);
    }
  }
  // мелкие детали: травинки, цветы, кусты, камни, блики на воде, швы брусчатки
  for (let y = -M; y < H + M; y++) {
    for (let x = -M; x < W + M; x++) {
      const t = at(x, y);
      const c = toScreen(x + 0.5, y + 0.5);
      const b = bio(w, x, y);
      for (let k = 0; k < 3; k++) {
        const n1 = hash(x * 3 + k, y * 7 - k), n2 = hash(y * 5 + k, x * 2 + k);
        const px = Math.round(c.x + (n1 - 0.5) * 16), py = Math.round(c.y + (n2 - 0.5) * 7);
        if (t === GRASS && n1 > 0.3) {
          // травинка «галочкой»: светлая сверху, тёмная у корня
          const tc = b.tuft[n2 > 0.5 ? 0 : 1];
          g.rect(px, py, 1, 2).fill(tc);
          g.rect(px + 1, py - 1, 1, 2).fill(tc);
        }
        if (t === PATH && n1 > 0.6) g.rect(px, py, 2, 1).fill(GROUND.pathDot);
        if (t === WATER && n1 > 0.7) g.rect(px, py, 3, 1).fill(GROUND.waterHi);
        if (t === STONE && n1 > 0.4) g.rect(px, py, 3, 1).fill(GROUND.stoneSeam);
        if (t === SAND && n1 > 0.7) g.rect(px, py, 1, 1).fill(GROUND.sandDot);
      }
      if (t !== GRASS) continue;
      const r = hash(x, y + 99);
      if (r > 0.9) {
        // цветочек: лепестки крестиком и серединка
        const fc = b.flowers[Math.floor(hash(x + 5, y) * b.flowers.length)];
        g.rect(c.x - 1, c.y, 3, 1).fill(fc);
        g.rect(c.x, c.y - 1, 1, 3).fill(fc);
        g.rect(c.x, c.y, 1, 1).fill(0xffe070);
      } else if (r > 0.86) {
        // кустик
        g.ellipse(c.x + 1, c.y + 2, 6, 2).fill({ color: 0x000000, alpha: 0.18 });
        g.circle(c.x + 1, c.y - 1, 4).fill(b.leaves[0]);
        g.circle(c.x, c.y - 2, 3).fill(b.leaves[1]);
        g.rect(c.x - 2, c.y - 4, 2, 1).fill(b.leaves[2]);
      } else if (r > 0.84) {
        // камень
        const [d, m, l] = GROUND.rock;
        g.ellipse(c.x, c.y, 4, 2.5).fill(d);
        g.ellipse(c.x - 1, c.y - 1, 3, 2).fill(m);
        g.rect(c.x - 2, c.y - 2, 2, 1).fill(l);
      }
    }
  }
  // берег у воды: обрыв земли (на свету и в тени) и белая пена у кромки
  const wet = (x: number, y: number) => at(x, y) === WATER || at(x, y) === BRIDGE;
  for (let y = -M; y < H + M; y++) {
    for (let x = -M; x < W + M; x++) {
      if (!wet(x, y)) continue;
      const up = !wet(x, y - 1);
      const left = !wet(x - 1, y);
      const s = toScreen(x, y);
      const R = { x: s.x + TW / 2, y: s.y + TH / 2 }, L = { x: s.x - TW / 2, y: s.y + TH / 2 };
      if (up) {
        g.poly([s.x, s.y, R.x, R.y, R.x, R.y + 3, s.x, s.y + 3]).fill(GROUND.bankLit);
        g.poly([s.x, s.y + 3, R.x, R.y + 3, R.x - 2, R.y + 4, s.x - 2, s.y + 4]).fill(GROUND.foam);
      }
      if (left) {
        g.poly([s.x, s.y, L.x, L.y, L.x, L.y + 3, s.x, s.y + 3]).fill(GROUND.bankShade);
        g.poly([s.x, s.y + 3, L.x, L.y + 3, L.x + 2, L.y + 4, s.x + 2, s.y + 4]).fill(GROUND.foam);
      }
    }
  }
  return g;
}
