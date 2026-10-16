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
import { makeLightTexture } from './draw';
import { NightView } from './nightView';
import { RoomView } from './roomView';

const NIGHT = 0x0a0818;

/** То, что умеет сцена: мир, источники света, насколько темно, куда смотрит камера. */
export interface View {
  root: Container;
  fog: Container | null;
  glowTint: number;
  darkAlpha(): number;
  lights(): Light[];
  focus(): { x: number; y: number };
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
  private camPos = { x: 0, y: 0 };
  /** Точный сдвиг мира на экране (в маленьких пикселях, может быть дробным). */
  private off = { x: 0, y: 0 };
  private views: Record<Scene, View> = { night: new NightView(world, true), room: new RoomView(), plaza: new NightView(makePlaza(), false) };
  private current: Scene | null = null;
  private lastAlpha = -1;

  constructor(private app: Application) {
    this.worldRoot.addChild(this.cam);
    this.darkRoot.addChild(this.darkFill, this.darkCam);
    app.stage.addChild(this.worldSprite, this.darkSprite);
    this.resize();
  }

  private get view() { return this.views[st.scene]; }

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
    this.current = st.scene;
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
  toCss(x: number, y: number) {
    const s = toScreen(x, y);
    return { x: (Math.round(s.x) + this.off.x) * this.scale, y: (Math.round(s.y) + this.off.y) * this.scale };
  }

  frame(dt: number) {
    if (this.current !== st.scene) this.switchView();
    const v = this.view;

    // камера: в игре — жёстко за игроком (иначе он «дрожит»), в ролике — плавно
    const f = v.focus();
    const p = toScreen(f.x, f.y);
    if (st.cine) {
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
        if (blend === 'add') s.alpha = L.tint && L.tint !== tint ? 0.38 : alpha;
        const flick = 1 + 0.03 * Math.sin(t * 9 + L.id * 1.7) + 0.02 * Math.sin(t * 23 + L.id);
        const e = isoEllipse(L.r * flick * mul);
        const pos = toScreen(L.x, L.y);
        s.position.set(Math.round(pos.x), Math.round(pos.y - 4));
        s.width = e.rx * 2;
        s.height = e.ry * 2;
      });
    };
    sync(this.holes, 'erase', 0xffffff, 1, 1);
    sync(this.glow, 'add', v.glowTint, 0.22, 0.8);

    const r = this.app.renderer;
    r.render({ container: this.worldRoot, target: this.worldRT, clear: true, clearColor: [0, 0, 0, 1] });
    r.render({ container: this.darkRoot, target: this.darkRT, clear: true, clearColor: [0, 0, 0, 0] });
  }
}
