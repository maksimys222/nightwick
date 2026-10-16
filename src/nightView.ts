// Карта с фонарями: ночная улица (игра) или площадь из ролика.
// Земля, деревья, фонари, подсолнухи, дома, игрок, подносчики, персонажи роликов.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TW, TH, toScreen } from './iso';
import { GRASS, PATH, WATER, STONE, SAND, BRIDGE, homeDoor, outsideGround, type World } from './map';
import type { Plaza } from './plaza';
import { st, lights, burning, lampCap, darkAlpha } from './game';
import { residentById, type ResidentId } from './story';
import {
  hash, diamond, drawTree, drawLamp, drawFlower, drawHouse, drawPress, drawPerson, drawVillain, drawSpark,
  drawHome, drawSleeper, drawFountain, drawStall, drawAnvil, drawEasel, drawSmoke,
} from './draw';
import type { View } from './render';

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
  private player = new Graphics();
  private helperGs: Graphics[] = [];
  private compass = new Graphics();
  private spark = new Graphics();
  private actorGs: Graphics[] = [];
  private fogVer = -1;

  /** main — настоящая улица (с туманом, игроком, домом); иначе — декорация для ролика. */
  constructor(private w: World, private main: boolean) {
    this.fog = main ? this.makeFog() : null;
    const [back, front] = buildHorizon(w);
    this.root.addChild(buildGround(w), back, this.objects, front);
    this.build();
  }

  darkAlpha = darkAlpha;
  lights = lights;
  focus() { return st.cine ? st.cine.cam : { x: st.player.x, y: st.player.y }; }

  private place(g: Graphics, x: number, y: number, z = x + y) {
    const s = toScreen(x, y);
    g.position.set(Math.round(s.x), Math.round(s.y));
    g.zIndex = z * 10;
    this.objects.addChild(g);
  }

  private build() {
    const w = this.w;
    for (const t of w.trees) {
      const g = new Graphics();
      drawTree(g, t.v);
      this.place(g, t.x + 0.5, t.y + 0.5);
    }
    const dyn = (keyOf: () => string, draw: () => void) => this.dyn.push({ key: '', keyOf, draw });
    for (const l of w.lamps) {
      const g = new Graphics();
      this.place(g, l.x + 0.5, l.y + 0.5);
      dyn(() => `${burning(l)}|${l.everLit}|${l.kindled > 0}|${Math.round((l.oil / lampCap(l)) * 10)}`, () => drawLamp(g.clear(), l));
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
      dyn(() => String(lit()), () => drawHouse(g.clear(), lit()));
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
    this.objects.addChild(this.player, this.compass, this.spark);
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
    this.player.visible = this.spark.visible = playing;
    const pl = st.player;
    const p = toScreen(pl.x, pl.y);
    if (playing) {
      drawPerson(this.player.clear(), pl.face, pl.anim, pl.moving, 0x2b3a67, true, !st.nightOver);
      this.player.position.set(Math.round(p.x), Math.round(p.y));
      this.player.zIndex = (pl.x + pl.y) * 10 + 1;
      drawSpark(this.spark.clear(), st.time);
      const sp = toScreen(st.spark.x, st.spark.y);
      this.spark.position.set(Math.round(sp.x), Math.round(sp.y - 14));
      this.spark.zIndex = (st.spark.x + st.spark.y) * 10 + 2;
    }

    while (this.helperGs.length < st.helpers.length) {
      const g = new Graphics();
      this.objects.addChild(g);
      this.helperGs.push(g);
    }
    this.helperGs.forEach((g, i) => {
      const h = playing ? st.helpers[i] : undefined;
      g.visible = !!h;
      if (!h) return;
      drawPerson(g.clear(), h.face, h.anim, h.moving, 0x3f6b3a, false, false);
      if (h.tgt && 'oil' in h.tgt) g.rect(h.face > 0 ? 3 : -6, -8, 3, 4).fill(0x8a6a2a); // бидон
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
    if (this.w.home && st.lantern < 15) {
      const d = homeDoor(this.w.home);
      if (Math.floor(st.time * 3) % 2 === 0 || st.lantern > 8) arrow(d.x, d.y, 0xffffff, 28);
    }
  }

  /** Персонажи ролика. */
  private drawActors() {
    const actors = st.cine?.actors ?? [];
    while (this.actorGs.length < actors.length) {
      const g = new Graphics();
      this.objects.addChild(g);
      this.actorGs.push(g);
    }
    this.actorGs.forEach((g, i) => {
      const a = actors[i];
      g.visible = !!a && a.alpha > 0.01;
      if (!a) return;
      g.clear();
      if (a.kind === 'villain') drawVillain(g, a.face, st.time, a.cast);
      else if (a.kind === 'spark') drawSpark(g, st.time);
      else if (a.kind === 'sleeper') drawSleeper(g);
      else if (a.kind === 'smoke') drawSmoke(g, a.anim);
      else if (a.kind === 'hero') drawPerson(g, a.face, a.anim, a.moving, 0x2b3a67, true, true);
      else drawPerson(g, a.face, a.anim, a.moving, residentById(a.id as ResidentId).coat, false, false);
      g.alpha = a.alpha;
      const s = toScreen(a.x, a.y);
      g.position.set(Math.round(s.x), Math.round(s.y - (a.kind === 'spark' ? 14 : 0)));
      g.zIndex = (a.x + a.y) * 10 + 1;
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
      drawTree(g, hash(x, y + 5));
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
      const color = t === WATER ? (n > 0.5 ? 0x2c6aa0 : 0x2a6498)
        : t === PATH ? (n > 0.5 ? 0xc7a26a : 0xbf995f)
        : t === STONE ? ((x + y) % 2 ? 0xb8ac98 : 0xaca08c)
        : t === SAND ? (n > 0.5 ? 0xd8c088 : 0xd0b880)
        : [0x3d7a3a, 0x427f3c, 0x39733a][Math.floor(n * 3)];
      diamond(g, x, y, color);
    }
  }
  // мелкие детали: травинки, камушки, блики на воде, швы брусчатки
  for (let y = -M; y < H + M; y++) {
    for (let x = -M; x < W + M; x++) {
      const t = at(x, y);
      const c = toScreen(x + 0.5, y + 0.5);
      for (let k = 0; k < 3; k++) {
        const n1 = hash(x * 3 + k, y * 7 - k), n2 = hash(y * 5 + k, x * 2 + k);
        const px = Math.round(c.x + (n1 - 0.5) * 16), py = Math.round(c.y + (n2 - 0.5) * 7);
        if (t === GRASS && n1 > 0.3) g.rect(px, py, 1, 2).fill(n2 > 0.5 ? 0x5a9a4a : 0x2f6430);
        if (t === PATH && n1 > 0.6) g.rect(px, py, 2, 1).fill(0xa8865a);
        if (t === WATER && n1 > 0.7) g.rect(px, py, 3, 1).fill(0x5a9ad0);
        if (t === STONE && n1 > 0.5) g.rect(px, py, 3, 1).fill(0x8a806e);
        if (t === SAND && n1 > 0.7) g.rect(px, py, 1, 1).fill(0xb8a070);
      }
      if (t === GRASS && hash(x, y + 99) > 0.93) {
        g.rect(c.x - 1, c.y - 1, 3, 3).fill(hash(x + 5, y) > 0.5 ? 0xe8e8f0 : 0xf0c040);
      }
    }
  }
  // берег у воды: светлая кромка
  const wet = (x: number, y: number) => at(x, y) === WATER || at(x, y) === BRIDGE;
  for (let y = -M; y < H + M; y++) {
    for (let x = -M; x < W + M; x++) {
      if (!wet(x, y)) continue;
      const up = !wet(x, y - 1);
      const left = !wet(x - 1, y);
      const s = toScreen(x, y);
      if (up) g.poly([s.x, s.y, s.x + TW / 2, s.y + TH / 2, s.x + TW / 2 - 2, s.y + TH / 2 + 1, s.x - 2, s.y + 1]).fill(0x9ac8e8);
      if (left) g.poly([s.x, s.y, s.x - TW / 2, s.y + TH / 2, s.x - TW / 2 + 2, s.y + TH / 2 + 1, s.x + 2, s.y + 1]).fill(0x9ac8e8);
    }
  }
  return g;
}
