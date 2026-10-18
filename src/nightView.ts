// Карта с фонарями: ночная улица (игра) или площадь из ролика.
// Земля, деревья, фонари, подсолнухи, дома, игрок, подносчики, персонажи роликов.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TW, TH, toScreen } from './iso';
import { GRASS, PATH, WATER, STONE, SAND, BRIDGE, homeDoor, outsideGround, type World } from './map';
import type { Plaza } from './plaza';
import { st, lights, burning, lampCap, darkAlpha, has, KINDS, lampRadius } from './game';
import { residentById, type ResidentId } from './story';
import {
  hash, treeContext, drawLamp, drawDuck, glassHeight, lampArt, drawFlower, drawHouse, drawPress, drawPerson, drawVillain, drawSpark,
  drawHome, drawSleeper, drawFountain, drawStall, drawAnvil, drawEasel, drawSmoke,
} from './draw';
import type { View, Halo } from './render';
import { art, frames, heroTex } from './sprites';
import { Figure } from './figure';
import { BIOMES, GROUND } from './palette';
import { groundSprite, drawShade, shadeEyes, drawChest, drawCamp, CAMP_FIRE } from './runArt';

interface Dyn { key: string; keyOf: () => string; draw: () => void }

/** Что отбрасывает тень от света: точка на земле, высота и полуширина (в пикселях). */
interface Caster { x: number; y: number; h: number; w: number; crown?: boolean }

/** Светящаяся точка поверх тьмы (глаза тени, блеск тайника, искра в стекле маяка). */
export interface Glint { x: number; y: number; lift: number; dx: number; color: number; size: number; alpha: number }

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
  /** Тени от света: перерисовываются каждый кадр. */
  private shadowG = new Graphics();
  private casters: Caster[] = [];
  private grid = new Map<number, Caster[]>();
  private shadeGs: Graphics[] = [];

  /** main — настоящая улица (с туманом, игроком, домом); иначе — декорация для ролика. */
  constructor(private w: World, private main: boolean) {
    this.fog = main ? this.makeFog() : null;
    const [back, front] = buildHorizon(w);
    const ground = buildGround(w);
    ground.zIndex = -2;
    this.shadowG.zIndex = -1.5;
    this.root.sortableChildren = true;
    this.root.addChild(ground, this.shadowG, back, this.objects, front);
    this.build();
  }

  /** Когда фонарь зажёгся (секунды игры) — для вспышки при зажигании. */
  private litAt = new Map<number, number>();
  private wasLit = new Set<number>();

  darkAlpha = () => (!this.main && !st.cine ? 0 : darkAlpha());

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
    if (this.main && this.w.home && this.w.camp === 'fire') {
      const h = this.w.home;
      out.push({ x: h.x + CAMP_FIRE.x, y: h.y + CAMP_FIRE.y, lift: 6, tint: 0xff8a30, id: -6, flash: 0, low: 0, size: 0.9 });
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
  lights = () => (!this.main && !st.cine ? [] : lights());

  /** Глаза теней, блеск закрытых тайников, искорка в потухшем маяке — всё, что видно сквозь тьму. */
  glints(): Glint[] {
    if (!this.main || st.cine) return [];
    const out: Glint[] = [];
    const p = st.player, t = st.time;
    for (const s of st.shadows) {
      if (s.gone > 0 || Math.hypot(s.x - p.x, s.y - p.y) > 13) continue;
      const e = shadeEyes(s.anim);
      // моргает: на миг глаза пропадают
      if (Math.sin(s.anim * 1.3 + s.x) > 0.97) continue;
      const color = s.chase ? 0xff5a6a : 0xb8a0ff;
      for (const side of [-1, 1]) out.push({ x: s.x, y: s.y, lift: -e.y, dx: side * e.dx + s.face * 0.5, color, size: 1, alpha: 1 });
    }
    for (const c of this.w.chests) {
      if (c.open || Math.hypot(c.x - p.x, c.y - p.y) > 9) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + c.x);
      out.push({ x: c.x + 0.5, y: c.y + 0.5, lift: 6, dx: 0, color: 0xffd36b, size: 1, alpha: 0.35 + 0.5 * tw });
    }
    const g = this.w.lamps[this.w.goal];
    if (g && !burning(g)) out.push({ x: g.x + 0.5, y: g.y + 0.5, lift: glassHeight(g), dx: 0, color: 0xcfe0ff, size: 1, alpha: 0.35 + 0.25 * Math.sin(t * 1.7) });
    return out;
  }
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
      const g = new Graphics(treeContext(t.v, bio(w, t.x, t.y)));
      this.place(g, t.x + 0.5, t.y + 0.5);
      this.cast(t.x + 0.5, t.y + 0.5, 26, 8, true);
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
      this.cast(l.x + 0.5, l.y + 0.5, l.kind === 'beacon' ? 44 : 30, l.kind === 'beacon' ? 5 : 2);
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
      // грядка: картинка (4 стадии в ленте 32×40) или заглушка; центр клетки — в точке (16, 32) кадра
      const c = new Container(), g = new Graphics(), pic = new Sprite();
      c.addChild(g, pic);
      pic.position.set(-16, -32);
      this.place(c, f.x + 0.5, f.y + 0.5);
      dyn(() => String(f.stage), () => {
        const fr = frames('flower', 32) ?? frames('flower_example', 32);
        g.clear();
        pic.visible = !!fr;
        if (fr) pic.texture = fr[Math.min(fr.length - 1, f.stage)];
        else drawFlower(g, f);
      });
    }
    for (const h of w.houses) {
      const g = new Graphics();
      this.place(g, h.x, h.y, h.x + h.y + 2);
      const lit = () => this.main && st.met.includes(h.rid);
      dyn(() => String(lit()), () => drawHouse(g.clear(), lit(), h.rid));
      this.cast(h.x + 1, h.y + 1, 34, 13);
    }
    for (const pr of w.presses) {
      const g = new Graphics();
      drawPress(g);
      this.place(g, pr.x, pr.y, pr.x + pr.y + 1);
      this.cast(pr.x + 0.5, pr.y + 0.5, 14, 6);
    }
    const bridge = new Graphics();
    bridge.zIndex = -1e6;
    this.objects.addChild(bridge);
    drawBridge(bridge, w, true);
    if (w.home) {
      const g = new Graphics();
      this.place(g, w.home.x, w.home.y, w.home.x + w.home.y + 2);
      const home = w.home;
      this.anim.push(() => (w.camp === 'fire' ? drawCamp(g.clear(), st.time) : drawHome(g.clear(), st.time)));
      this.cast(home.x + 1, home.y + 1, w.camp === 'fire' ? 18 : 34, w.camp === 'fire' ? 9 : 13);
    }
    for (const c of w.chests) {
      const g = new Graphics();
      this.place(g, c.x + 0.5, c.y + 0.5);
      this.anim.push(() => { if (!c.open || g.label !== 'open') { drawChest(g.clear(), c.open, st.time); if (c.open) g.label = 'open'; } });
      this.cast(c.x + 0.5, c.y + 0.5, 7, 6);
    }
    for (const p of (w as Plaza).props ?? []) {
      const g = new Graphics();
      this.place(g, p.x, p.y, p.x + p.w / 2 + p.y + p.h / 2);
      if (p.kind === 'fountain') this.anim.push(() => drawFountain(g.clear(), st.time));
      if (p.kind === 'stall') drawStall(g);
      if (p.kind === 'anvil') drawAnvil(g);
      if (p.kind === 'easel') drawEasel(g);
    }
    // утки на прудах: мама впереди, утята следом, селезень плавает сам по себе
    for (const [pi, pond] of this.w.ponds.entries()) {
      const flock: { g: Graphics; kind: 'drake' | 'duck' | 'small'; lag: number; rr: number }[] = [
        { g: new Graphics(), kind: 'duck', lag: 0, rr: 0.55 },
        { g: new Graphics(), kind: 'small', lag: 0.35, rr: 0.55 },
        { g: new Graphics(), kind: 'small', lag: 0.62, rr: 0.55 },
        { g: new Graphics(), kind: 'drake', lag: 2.6, rr: 0.3 },
      ];
      for (const d of flock) this.objects.addChild(d.g);
      this.anim.push(() => {
        const t = st.time;
        for (const d of flock) {
          const dir = d.kind === 'drake' ? -1 : 1;
          const a = (t * 0.25 + pi * 2) * dir - d.lag;
          const x = pond.x + Math.cos(a) * pond.r * d.rr, y = pond.y + Math.sin(a) * pond.r * d.rr * 0.9;
          const s = toScreen(x, y);
          // смотрит туда, куда плывёт (по экрану)
          const vx = -Math.sin(a) * dir - Math.cos(a) * dir * 0.9;
          drawDuck(d.g.clear(), t + d.lag * 3, d.kind);
          d.g.scale.x = vx >= 0 ? 1 : -1;
          d.g.position.set(Math.round(s.x), Math.round(s.y));
          d.g.zIndex = (x + y) * 10;
        }
      });
    }
    this.objects.addChild(this.player, this.compass);
    this.compass.zIndex = 1e6;
  }

  /** Запомнить, что предмет отбрасывает тень. */
  private cast(x: number, y: number, h: number, w: number, crown = false) {
    const c = { x, y, h, w, crown };
    this.casters.push(c);
    const k = Math.floor(x) * 4096 + Math.floor(y);
    (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(c);
  }

  /**
   * Тени от света: каждый фонарь (и ручной фонарь фонарщика) кладёт от деревьев, домов и людей
   * длинную тень в сторону от себя. Чем дальше от огня — тем тень длиннее и бледнее.
   */
  private drawShadows() {
    const g = this.shadowG.clear();
    if (!this.main && !st.cine) return;
    const ls = this.lights().filter((l) => l.r >= 1.5 && l.id !== -2);
    const pl = st.player;
    const moving: Caster[] = [];
    if (this.main && !st.cine) {
      moving.push({ x: pl.x, y: pl.y, h: 22, w: 3 });
      for (const h of st.helpers) moving.push({ x: h.x, y: h.y, h: 20, w: 3 });
    }
    const one = (L: { x: number; y: number; r: number; id: number }, c: Caster) => {
      const dx = c.x - L.x, dy = c.y - L.y, d = Math.hypot(dx, dy);
      if (d < 0.35 || d > L.r) return;
      // фонарщик не отбрасывает тень от своего же фонаря
      if (L.id === -1 && c.h === 22 && Math.abs(c.x - pl.x) < 0.01) return;
      const k = 1 - d / L.r;
      const alpha = 0.6 * Math.pow(k, 0.5);
      if (alpha < 0.03) return;
      const len = (c.h / 16) * (0.7 + 1.6 * (d / L.r));
      const ux = dx / d, uy = dy / d;
      const at = (f: number) => toScreen(c.x + ux * len * f, c.y + uy * len * f);
      const B = toScreen(c.x, c.y), T = at(1);
      let px = -(T.y - B.y), py = T.x - B.x;
      const pl2 = Math.hypot(px, py) || 1;
      px /= pl2; py /= pl2;
      const band = (P: { x: number; y: number }, Q: { x: number; y: number }, w0: number, w1: number, a: number) =>
        g.poly([P.x + px * w0, P.y + py * w0, Q.x + px * w1, Q.y + py * w1, Q.x - px * w1, Q.y - py * w1, P.x - px * w0, P.y - py * w0])
          .fill({ color: 0x06041a, alpha: a });
      if (c.crown) {
        // ствол — узкая полоса, крона — овальное пятно на конце тени
        const M = at(0.55), C = at(0.78);
        band(B, M, 1.5, 2.2, alpha * 0.8);
        g.ellipse(C.x, C.y, c.w * 1.25, c.w * 0.7).fill({ color: 0x06041a, alpha: alpha * 0.55 });
        g.ellipse(C.x, C.y, c.w * 0.8, c.w * 0.45).fill({ color: 0x06041a, alpha: alpha * 0.35 });
      } else {
        band(B, T, c.w, c.w * 1.3, alpha * 0.45);
        band(B, at(0.6), c.w * 0.75, c.w * 0.9, alpha * 0.45);
      }
    };
    for (const L of ls) {
      const r = Math.ceil(L.r);
      for (let ty = Math.floor(L.y) - r; ty <= Math.floor(L.y) + r; ty++)
        for (let tx = Math.floor(L.x) - r; tx <= Math.floor(L.x) + r; tx++)
          for (const c of this.grid.get(tx * 4096 + ty) ?? []) one(L, c);
      for (const c of moving) one(L, c);
    }
  }

  /** Тени Гасителя. */
  private drawShades() {
    const list = this.main && !st.cine ? st.shadows : [];
    while (this.shadeGs.length < list.length) {
      const g = new Graphics();
      this.objects.addChild(g);
      this.shadeGs.push(g);
    }
    this.shadeGs.forEach((g, i) => {
      const s = list[i];
      g.visible = !!s && s.gone <= 0;
      if (!g.visible) return;
      drawShade(g.clear(), s.anim, s.chase);
      g.scale.x = s.face;
      const p = toScreen(s.x, s.y);
      g.position.set(Math.round(p.x), Math.round(p.y));
      g.zIndex = (s.x + s.y) * 10 + 2;
    });
  }

  update() {
    this.drawShadows();
    this.drawShades();
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
    // бледно-голубая — к маяку, цели вылазки
    const goal = this.w.lamps[this.w.goal];
    if (goal && !burning(goal)) arrow(goal.x + 0.5, goal.y + 0.5, 0xcfe0ff, 25);
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

  /** Жители гуляют по площади, пока на экране главное меню. */
  private strollers() {
    const t = performance.now() / 1000;
    const spots: [string, number, number][] = [['mila', 11.5, 5], ['agata', 5, 6.5], ['timofey', 5.2, 10], ['nika', 11.5, 9.5], ['filin', 6.5, 3.8], ['seva', 9, 11]];
    return spots.map(([id, bx, by], i) => {
      const a = t * 0.35 + i * 1.7;
      const x = bx + Math.sin(a) * 0.9, y = by + Math.sin(a * 0.7 + i) * 0.5;
      const vx = Math.cos(a) * 0.9, vy = Math.cos(a * 0.7 + i) * 0.35;
      // иногда стоят и болтают
      const moving = Math.sin(t * 0.25 + i * 2) > -0.3;
      return { id, kind: id === 'filin' ? 'person' : 'person', x: moving ? x : bx, y: moving ? y : by, face: Math.sign(vx - vy) || 1,
        anim: t, moving, alpha: 1, cast: false } as const;
    });
  }

  /** Персонажи ролика. */
  private drawActors() {
    const actors = st.cine?.actors ?? (!this.main && st.menuBackdrop ? this.strollers() : []);
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
      } else if (a.kind === 'villain') f.villain(a.face, st.time, !!a.cast);
      else if (a.kind === 'sleeper') f.sleeper();
      else drawSmoke(f.graphics(), a.anim);
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

  /** Неизведанное — чёрное. За краем карты — как у ближайшей клетки на краю, но не дальше двух клеток. */
  private drawFog() {
    const c = this.fogCanvas!, P = NightView.PAD;
    const g = c.getContext('2d')!;
    const img = g.createImageData(c.width, c.height);
    const { w: W, h: H } = this.w;
    for (let y = 0; y < c.height; y++) {
      const ty = Math.min(H - 1, Math.max(0, y - P));
      for (let x = 0; x < c.width; x++) {
        const tx = Math.min(W - 1, Math.max(0, x - P));
        // за краем карты туман открыт только на пару клеток от изведанного края — дальше лес тонет во тьме
        const out = Math.max(P - x, x - P - (W - 1), P - y, y - P - (H - 1), 0);
        img.data[(y * c.width + x) * 4 + 3] = st.known[ty * W + tx] && out <= 2 ? 0 : 255;
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
function buildHorizon(w: World): [Container, Container] {
  const back = new Container(), front = new Container();
  back.zIndex = -1; // над землёй (её zIndex −2), но под всем остальным
  front.zIndex = 1e6;
  const M = 14;
  // за краем карты — сплошной лес: по два дерева на клетку, рисуем от дальних к ближним
  const spots: { x: number; y: number; v: number; bx: number; by: number }[] = [];
  for (let y = -M; y < w.h + M; y++) {
    for (let x = -M; x < w.w + M; x++) {
      if (x >= 0 && y >= 0 && x < w.w && y < w.h) continue;
      if (outsideGround(w, x, y) !== GRASS) continue;
      for (const [ox, oy] of [[0.25, 0.3], [0.75, 0.7]]) {
        const jx = (hash(x * 3 + ox * 10, y) - 0.5) * 0.3, jy = (hash(y * 5, x + oy * 10) - 0.5) * 0.3;
        spots.push({ x: x + ox + jx, y: y + oy + jy, v: hash(x + ox * 7, y + 5 + oy), bx: x, by: y });
      }
    }
  }
  spots.sort((a, b) => a.x + a.y - (b.x + b.y));
  for (const p of spots) {
    const c = toScreen(p.x, p.y);
    const g = new Graphics(treeContext(p.v, bio(w, p.bx, p.by)));
    g.position.set(Math.round(c.x), Math.round(c.y));
    (p.bx < 0 || p.by < 0 ? back : front).addChild(g);
  }
  // тысячи деревьев за краем не меняются — рисуем их один раз в картинку
  back.cacheAsTexture(true);
  front.cacheAsTexture(true);
  return [back, front];
}

function buildGround(w: World) {
  const { w: W, h: H } = w;
  const root = new Container();
  const g = new Graphics();
  const M = 14;
  root.addChild(groundSprite(w, M), g);
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? w.ground[y * W + x] : outsideGround(w, x, y));
  // мелкие детали поверх фактуры: пучки травы, цветы, кусты, камни, блики на воде
  for (let y = -M; y < H + M; y++) {
    for (let x = -M; x < W + M; x++) {
      const t = at(x, y);
      const c = toScreen(x + 0.5, y + 0.5);
      const b = bio(w, x, y);
      for (let k = 0; k < 3; k++) {
        const n1 = hash(x * 3 + k, y * 7 - k), n2 = hash(y * 5 + k, x * 2 + k);
        const px = Math.round(c.x + (n1 - 0.5) * 16), py = Math.round(c.y + (n2 - 0.5) * 7);
        if (t === GRASS && n1 > 0.82 && x >= 0 && y >= 0 && x < W && y < H) {
          // пучок травы «галочкой»: светлый сверху, тёмный у корня
          const tc = b.tuft[n2 > 0.5 ? 0 : 1];
          g.rect(px, py, 1, 3).fill(tc);
          g.rect(px + 1, py - 1, 1, 3).fill(tc);
          g.rect(px - 1, py, 1, 2).fill(b.tuft[1]);
        }
        if (t === WATER && n1 > 0.8) g.rect(px, py, 3, 1).fill({ color: GROUND.waterHi, alpha: 0.7 });
        // кувшинки на прудах
        if (t === WATER && k === 0 && n2 > 0.78 && w.ponds.some((p) => Math.hypot(p.x - x - 0.5, p.y - y - 0.5) < p.r - 0.3)) {
          g.ellipse(px, py, 3, 1.5).fill(0x3a8a3a);
          g.rect(px, py - 1, 2, 1).fill(0x2aa6bc);
          if (n1 > 0.85) { g.rect(px - 1, py - 2, 2, 1).fill(0xffa8c8); g.rect(px - 1, py - 3, 1, 1).fill(0xffffff); }
        }
      }
      if (t !== GRASS || x < 0 || y < 0 || x >= W || y >= H || w.block[y * W + x]) continue;
      const r = hash(x, y + 99);
      const pondDist = w.ponds.reduce((m, p) => Math.min(m, Math.hypot(p.x - x - 0.5, p.y - y - 0.5) - p.r), 99);
      if (pondDist < 1.4 && hash(x + 9, y + 2) > 0.35) {
        // камыш у пруда: тонкие стебли и коричневые «сосиски»
        for (const [dx, h] of [[-3, 9], [0, 12], [3, 8]] as const) {
          g.rect(c.x + dx, c.y - h, 1, h).fill(0x3e7a34);
          g.rect(c.x + dx, c.y - h - 3, 1, 3).fill(0x7a4a26);
        }
        g.poly([c.x - 5, c.y, c.x - 2, c.y - 6, c.x - 1, c.y]).fill(0x5a9a3a);
        continue;
      }
      if (r > 0.9) {
        const kind = hash(x + 5, y);
        if (kind < 0.45) {
          // одуванчик: стебелёк, листики-зубчики, жёлтая головка
          g.rect(c.x, c.y - 4, 1, 4).fill(0x3e8a34);
          g.rect(c.x - 2, c.y - 1, 2, 1).fill(0x4caf40);
          g.rect(c.x + 1, c.y - 2, 2, 1).fill(0x4caf40);
          g.rect(c.x - 1, c.y - 6, 3, 2).fill(0xffd23a);
          g.rect(c.x, c.y - 7, 1, 1).fill(0xfff07a);
        } else if (kind < 0.7) {
          // отцветший одуванчик — белый пушистый шарик
          g.rect(c.x, c.y - 4, 1, 4).fill(0x3e8a34);
          g.circle(c.x + 0.5, c.y - 6, 2).fill({ color: 0xffffff, alpha: 0.85 });
          g.rect(c.x, c.y - 6, 1, 1).fill(0xd8d8c8);
        } else {
          // цветочек: лепестки крестиком и серединка
          const fc = b.flowers[Math.floor(hash(x + 7, y) * b.flowers.length)];
          g.rect(c.x - 1, c.y, 3, 1).fill(fc);
          g.rect(c.x, c.y - 1, 1, 3).fill(fc);
          g.rect(c.x, c.y, 1, 1).fill(0xffe070);
        }
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
  // края дорог: травка заходит на дорогу кустиками, по краю — камушки (чтобы тропа не была ровной полосой)
  for (let y = -M; y < H + M; y++) {
    for (let x = -M; x < W + M; x++) {
      if (at(x, y) !== PATH) continue;
      const b = bio(w, x, y);
      for (const [nx, ny, ax, ay, bx, by] of [[0, -1, 0, 0, 1, 0], [-1, 0, 0, 0, 0, 1], [0, 1, 0, 1, 1, 1], [1, 0, 1, 0, 1, 1]] as const) {
        if (at(x + nx, y + ny) !== GRASS) continue;
        for (let k = 0; k < 4; k++) {
          const u = (k + 0.5 + (hash(x * 3 + k, y + nx) - 0.5) * 0.6) / 4;
          const p0 = toScreen(x + ax + (bx - ax) * u, y + ay + (by - ay) * u);
          const inX = -nx * 0.12, inY = -ny * 0.12;
          const q = toScreen(x + ax + (bx - ax) * u + inX, y + ay + (by - ay) * u + inY);
          const r0 = hash(x + k * 7, y * 3 + ny);
          if (r0 > 0.45) g.poly([p0.x - 3, p0.y, p0.x + 3, p0.y, q.x, q.y - 1]).fill(b.grass[k % 3]);
          if (r0 > 0.8) g.rect(Math.round(q.x), Math.round(q.y), 1, 2).fill(b.tuft[0]);
          if (r0 < 0.15) { g.ellipse(q.x, q.y, 1.5, 1).fill(0x9a948a); g.rect(q.x - 1, q.y - 1, 1, 1).fill(0xc6c0b4); }
        }
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
  return root;
}
