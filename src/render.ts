// Рисование: общий «движок» картинки. Сами сцены — в nightView.ts и roomView.ts.
//
// Как устроена картинка:
// 1. Сцена рисуется в маленькую текстуру (низкое разрешение), потом растягивается
//    в scale раз без сглаживания — так даже фигуры выглядят пиксельно.
// 2. Поверх — слой тьмы: тёмная заливка, полностью чёрные «неизведанные» тайлы,
//    а свет «стирает» тьму (blendMode 'erase').

import { Application, Container, Graphics, RenderTexture, Sprite } from 'pixi.js';
import { toScreen, isoEllipse } from './iso';
import { st, world, type Light, type Scene } from './game';
import { makePlaza } from './plaza';
import { makeLightTexture, makeHaloTexture, drawSpark } from './draw';
import { frames } from './sprites';
import { settings } from './settings';
import { NightView, type Glint } from './nightView';
import { RoomView } from './roomView';

/** Цвет ночи: глубокий синий, а не чёрный — в темноте всё равно угадываются цвета. */
const NIGHT = 0x0b0f30;

/** Ореол вокруг стекла горящего фонаря (рисуется поверх тьмы — как свечение в воздухе). */
export interface Halo {
  x: number; y: number;
  /** Высота стекла над землёй, в пикселях. */
  lift: number;
  tint: number; id: number;
  /** 1 → 0 за первые мгновения после зажигания: вспышка. */
  flash: number;
  /** 0..1 — масла почти нет, огонь «чихает». */
  low: number;
  size: number;
  /** Сдвиг по экрану вбок, в пикселях (огонёк на шесте — не над точкой стояния). */
  dx?: number;
}

/** То, что умеет сцена: мир, источники света, насколько темно, куда смотрит камера. */
export interface View {
  root: Container;
  fog: Container | null;
  glowTint: number;
  darkAlpha(): number;
  lights(): Light[];
  focus(): { x: number; y: number };
  /** Где летают искорки (их рисует Renderer поверх мира, с плавными координатами). */
  sparks(): { x: number; y: number; alpha: number }[];
  halos(): Halo[];
  /** Светящиеся точки поверх тьмы (необязательно). */
  glints?(): Glint[];
  update(): void;
}

export class Renderer {
  scale = 3;
  vw = 0;
  vh = 0;
  private worldRT!: RenderTexture;
  private darkRT!: RenderTexture;
  private worldSprite = new Sprite();
  private darkSprite = new Sprite();
  private worldRoot = new Container();
  /** Камера: сдвигаем этот контейнер. */
  readonly cam = new Container();
  private glow = new Container();
  private darkRoot = new Container();
  private darkFill = new Graphics();
  private darkCam = new Container();
  private holes = new Container();
  private lightTex = makeLightTexture();
  private haloTex = makeHaloTexture();
  private camPos = { x: 0, y: 0 };
  /** Точный сдвиг мира на экране (в маленьких пикселях, может быть дробным). */
  private off = { x: 0, y: 0 };
  private views: Record<Scene, View> = { night: new NightView(world, true), room: new RoomView(), plaza: new NightView(makePlaza(), false) };
  private current: Scene | null = null;
  private lastAlpha = -1;
  /** Слой поверх тьмы в экранных пикселях: то, что должно двигаться плавно (Искра). */
  private floatLayer = new Container();
  private sparkGs: { c: Container; g: Graphics; pic: Sprite; lx: number; face: number }[] = [];
  private haloLayer = new Container();
  private pointer = new Graphics();
  private moths = new Graphics();
  private glintLayer = new Container();
  private glintG = new Graphics();
  /** Карта вылазки, для которой построена ночная сцена. */
  private nightVer = st.worldVer;

  constructor(private app: Application) {
    this.worldRoot.addChild(this.cam);
    this.darkRoot.addChild(this.darkFill, this.darkCam);
    app.stage.addChild(this.worldSprite, this.darkSprite, this.floatLayer);
    this.floatLayer.addChild(this.haloLayer, this.glintLayer, this.glintG, this.moths, this.pointer);
    this.resize();
  }

  /** Какая сцена на экране: в главном меню — площадь, иначе — где игрок. */
  private get sceneNow(): Scene { return st.menuBackdrop ? 'plaza' : st.scene; }
  private get view() { return this.views[this.sceneNow]; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.scale = Math.max(2, Math.round(h / 280));
    this.vw = Math.ceil(w / this.scale);
    this.vh = Math.ceil(h / this.scale);
    this.worldRT?.destroy(true);
    this.darkRT?.destroy(true);
    // +2 пикселя запаса: картинку двигаем на доли пикселя, края не должны оголяться
    this.worldRT = RenderTexture.create({ width: this.vw + 2, height: this.vh + 2, scaleMode: 'nearest' });
    this.darkRT = RenderTexture.create({ width: this.vw + 2, height: this.vh + 2, scaleMode: 'nearest' });
    this.worldSprite.texture = this.worldRT;
    this.darkSprite.texture = this.darkRT;
    this.worldSprite.scale.set(this.scale);
    this.darkSprite.scale.set(this.scale);
    this.lastAlpha = -1;
  }

  /** Смена сцены: подменяем содержимое камеры и сразу ставим камеру на место. */
  private switchView() {
    this.current = this.sceneNow;
    const v = this.view;
    this.cam.removeChildren();
    this.cam.addChild(v.root, this.glow);
    this.darkCam.removeChildren();
    if (v.fog) this.darkCam.addChild(v.fog);
    this.darkCam.addChild(this.holes);
    const f = v.focus();
    const p = toScreen(f.x, f.y);
    this.camPos = { x: p.x, y: p.y };
    this.lastAlpha = -1;
  }

  /** Экранная позиция точки мира в CSS-пикселях (для подсказок интерфейса). */
  toCss(x: number, y: number, exact = false) {
    const s = toScreen(x, y);
    const r = exact ? (v: number) => v : Math.round; // exact — для того, что летает плавно (Искра)
    return { x: (r(s.x) + this.off.x) * this.scale, y: (r(s.y) + this.off.y) * this.scale };
  }

  /** Ближайший к фонарщику уличный фонарь, если Искра сейчас про него говорит. */
  private shownLamp() {
    if (st.dialog[0]?.show !== 'lamp' || st.scene !== 'night') return null;
    const p = st.player;
    return world.lamps.filter((l) => l.kind === 'oil').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] ?? null;
  }

  /** Клетка мира под точкой экрана (CSS-пиксели) — обратное к toCss. */
  toWorld(cx: number, cy: number) {
    const sx = cx / this.scale - this.off.x, sy = cy / this.scale - this.off.y;
    // toScreen: x = (tx - ty) * TW/2, y = (tx + ty) * TH/2
    const a = sx / 16, b = sy / 8;
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }

  frame(dt: number) {
    // новая ночь — новый лес: перестраиваем ночную сцену
    if (this.nightVer !== st.worldVer) {
      this.nightVer = st.worldVer;
      const old = this.views.night;
      this.views.night = new NightView(world, true);
      if (this.current === 'night') this.current = null;
      old.root.destroy({ children: true });
    }
    if (this.current !== this.sceneNow) this.switchView();
    const v = this.view;

    // камера: в игре — жёстко за игроком (иначе он «дрожит»), в ролике — плавно
    const f = v.focus();
    const p = toScreen(f.x, f.y);
    if (st.menuBackdrop) {
      // главное меню: камера медленно плывёт над площадью
      const tt = performance.now() / 1000;
      const q = toScreen(9 + Math.sin(tt * 0.06) * 3, 7.5 + Math.cos(tt * 0.045) * 2);
      const k = 1 - Math.exp(-dt * 1.5);
      this.camPos.x += (q.x - this.camPos.x) * k;
      this.camPos.y += (q.y - this.camPos.y) * k;
    } else if (st.cine) {
      // кто сейчас говорит — тот должен быть в кадре (на узком экране он может оказаться за краем)
      const id = st.dialog[0]?.actor;
      const a = id ? st.cine.actors.find((x) => x.id === id) : undefined;
      if (a) {
        const s = toScreen(a.x, a.y);
        // запас сбоку — половина облачка (~130 css-пикселей), чтобы оно встало прямо над говорящим
        const mx = Math.max(0, this.vw / 2 - 130 / this.scale - 8), top = Math.max(0, this.vh / 2 - 90), bottom = Math.max(0, this.vh / 2 - 30);
        p.x = Math.min(s.x + mx, Math.max(s.x - mx, p.x));
        p.y = Math.min(s.y + top, Math.max(s.y - bottom, p.y));
      }
      // Искра показывает на фонарь — камера чуть сдвигается к нему
      const shown = this.shownLamp();
      if (shown) { const q = toScreen(shown.x + 0.5, shown.y + 0.5); p.x = (p.x + q.x) / 2; p.y = (p.y + q.y) / 2; }
      const k = 1 - Math.exp(-dt * 3);
      this.camPos.x += (p.x - this.camPos.x) * k;
      this.camPos.y += (p.y - this.camPos.y) * k;
    } else this.camPos = { x: Math.round(p.x), y: Math.round(p.y) };
    // Мир рисуется в маленькую текстуру только по целым пикселям, а дробную часть сдвига
    // добираем, смещая саму растянутую картинку, — так камера едет плавно, без ступенек.
    this.off = { x: Math.round(this.vw / 2) - this.camPos.x, y: Math.round(this.vh / 2) - this.camPos.y };
    const ix = Math.floor(this.off.x), iy = Math.floor(this.off.y);
    this.cam.position.set(ix + 1, iy + 1);
    this.darkCam.position.copyFrom(this.cam.position);
    const sx = (this.off.x - ix - 1) * this.scale, sy = (this.off.y - iy - 1) * this.scale;
    this.worldSprite.position.set(sx, sy);
    this.darkSprite.position.set(sx, sy);

    v.update();

    const a = v.darkAlpha();
    if (a !== this.lastAlpha) {
      this.lastAlpha = a;
      this.darkFill.clear().rect(0, 0, this.vw + 2, this.vh + 2).fill({ color: NIGHT, alpha: a });
    }

    // свет: тёплое свечение в мире + «дыры» в слое тьмы
    const ls = v.lights();
    const t = st.time;
    const sync = (c: Container, blend: 'erase' | 'add', tint: number, alpha: number, mul: number) => {
      while (c.children.length < ls.length) {
        const s = new Sprite(this.lightTex);
        s.anchor.set(0.5);
        s.blendMode = blend;
        s.alpha = alpha;
        c.addChild(s);
      }
      c.children.forEach((s, i) => {
        const L = ls[i];
        s.visible = !!L;
        if (!L) return;
        (s as Sprite).tint = blend === 'add' ? L.tint ?? tint : tint;
        // цветные фонари светятся заметнее
        if (blend === 'add') s.alpha = L.tint && L.tint !== tint ? 0.28 : alpha;
        const flick = 1 + 0.03 * Math.sin(t * 9 + L.id * 1.7) + 0.02 * Math.sin(t * 23 + L.id);
        const e = isoEllipse(L.r * flick * mul);
        const pos = toScreen(L.x, L.y);
        // без округления: свет от летящей Искры не должен прыгать по пикселям
        s.position.set(pos.x, pos.y - 4);
        s.width = e.rx * 2;
        s.height = e.ry * 2;
      });
    };
    sync(this.holes, 'erase', 0xffffff, 1, 1);
    if (settings.quality !== 'low') sync(this.glow, 'add', v.glowTint, 0.16, 0.8);
    this.glow.visible = settings.quality !== 'low';

    // Искры: в экранных пикселях, координаты не округляем — летят плавно
    this.floatLayer.scale.set(this.scale);
    this.floatLayer.position.set(this.off.x * this.scale, this.off.y * this.scale);
    this.drawHalos(settings.quality === 'low' ? [] : v.halos(), t);
    this.drawGlints(v.glints?.() ?? []);
    // прыгающая стрелка над фонарём, о котором говорит Искра
    const g = this.pointer.clear();
    const shown = this.shownLamp();
    if (shown) {
      const q = toScreen(shown.x + 0.5, shown.y + 0.5);
      const y = Math.round(q.y) - 46 - Math.abs(Math.sin(t * 4)) * 5, x = Math.round(q.x);
      g.poly([x - 5, y - 6, x + 5, y - 6, x, y]).fill(0xffd36b);
      g.poly([x - 3, y - 5, x + 3, y - 5, x, y - 1.5]).fill(0xfff4c8);
      g.rect(x - 1.5, y - 12, 3, 6).fill(0xffd36b);
    }
    const sp = v.sparks();
    while (this.sparkGs.length < sp.length) {
      const c = new Container(), g = new Graphics(), pic = new Sprite();
      pic.anchor.set(0.5);
      c.addChild(g, pic);
      this.floatLayer.addChild(c);
      this.sparkGs.push({ c, g, pic, lx: 0, face: 1 });
    }
    const wings = frames('spark', 16);
    this.sparkGs.forEach((sg, i) => {
      const { c, g, pic } = sg;
      const s = sp[i];
      c.visible = !!s && s.alpha > 0.01;
      if (!c.visible) return;
      g.clear();
      pic.visible = !!wings;
      if (wings) pic.texture = wings[Math.floor(t * 16) % wings.length];
      else drawSpark(g, t);
      const p = toScreen(s.x, s.y);
      // летит влево — смотрит влево (с запасом, чтобы не дёргалась на месте)
      const dx = p.x - sg.lx;
      if (Math.abs(dx) > 0.15) sg.face = dx < 0 ? -1 : 1;
      sg.lx = p.x;
      pic.scale.x = sg.face;
      c.position.set(p.x, p.y - 14);
      c.alpha = s.alpha;
    });

    const r = this.app.renderer;
    r.render({ container: this.worldRoot, target: this.worldRT, clear: true, clearColor: [0, 0, 0, 1] });
    r.render({ container: this.darkRoot, target: this.darkRT, clear: true, clearColor: [0, 0, 0, 0] });
  }

  /** Глаза теней и блеск тайников: яркий пиксель и мягкое свечение вокруг. */
  private drawGlints(gs: Glint[]) {
    const g = this.glintG.clear();
    while (this.glintLayer.children.length < gs.length) {
      const s = new Sprite(this.haloTex);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.glintLayer.addChild(s);
    }
    const kids = this.glintLayer.children as Sprite[];
    kids.forEach((s, i) => { s.visible = i < gs.length && settings.quality !== 'low'; });
    gs.forEach((q, i) => {
      const p = toScreen(q.x, q.y);
      const x = Math.round(p.x + q.dx), y = Math.round(p.y - q.lift);
      g.rect(x, y, q.size, q.size).fill({ color: mix(q.color, 0xffffff, 0.45), alpha: q.alpha });
      const s = kids[i];
      s.position.set(x + q.size / 2, y + q.size / 2);
      s.width = s.height = 10 * q.size;
      s.tint = q.color;
      s.alpha = q.alpha * 0.7;
    });
  }

  /**
   * Свечение фонарей: мягкий ореол цвета огня, яркое ядро у стекла, вспышка при зажигании
   * и мотыльки, которые кружат у света. Всё поверх тьмы, с плавными координатами.
   */
  private drawHalos(hs: Halo[], t: number) {
    const per = 3;
    while (this.haloLayer.children.length < hs.length * per) {
      const s = new Sprite(this.haloTex);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.haloLayer.addChild(s);
    }
    const kids = this.haloLayer.children as Sprite[];
    kids.forEach((s, i) => { s.visible = i < hs.length * per; });
    const m = this.moths.clear();
    hs.forEach((h, i) => {
      const p = toScreen(h.x, h.y);
      const x = Math.round(p.x) + (h.dx ?? 0), y = Math.round(p.y) - h.lift;
      // живое пламя: лёгкое дыхание; когда масла мало — резкие провалы
      let f = 1 + 0.07 * Math.sin(t * 9 + h.id * 1.7) + 0.05 * Math.sin(t * 23 + h.id);
      if (h.low > 0 && Math.sin(t * 31 + h.id * 3) > 0.2) f *= 1 - 0.6 * h.low;
      const white = mix(h.tint, 0xffffff, 0.55);
      const [outer, core, burst] = [kids[i * per], kids[i * per + 1], kids[i * per + 2]];
      const R = 40 * h.size * f * (1 + h.flash * 0.6);
      outer.position.set(x, y);
      outer.width = outer.height = R;
      outer.tint = h.tint;
      outer.alpha = (h.size > 1 ? 0.38 : 0.55) * (1 + h.flash * 0.8); // маяк светит шире, но мягче
      core.position.set(x, y);
      core.width = core.height = 14 * h.size * f;
      core.tint = white;
      core.alpha = 0.7;
      // вспышка: круг света быстро разлетается и тает
      burst.visible = h.flash > 0;
      burst.position.set(x, y);
      burst.width = burst.height = 24 + (1 - h.flash) * 70;
      burst.tint = white;
      burst.alpha = h.flash * 0.7;
      // два мотылька у стекла (у огонька на шесте — нет)
      for (let k = 0; k < (h.size >= 1 && settings.quality === 'high' ? 2 : 0); k++) {
        const a = t * (2.1 + k * 0.9) + h.id * 2.3 + k * 3;
        const r = 6 + 3 * Math.sin(t * 1.3 + k + h.id);
        const mx = x + Math.cos(a) * r, my = y - 1 + Math.sin(a * 1.6) * r * 0.55;
        const wing = Math.sin(t * 38 + k * 2 + h.id) > 0 ? 2 : 1;
        m.rect(mx - wing / 2, my, wing, 1).fill({ color: 0xfff4dc, alpha: 0.9 });
      }
    });
  }
}

/** Смешать два цвета: k = 0 — первый, 1 — второй. */
function mix(a: number, b: number, k: number) {
  const c = (sh: number) => Math.round(((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k);
  return (c(16) << 16) | (c(8) << 8) | c(0);
}
