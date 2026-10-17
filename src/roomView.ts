// Мастерская: пол, стены, камин, доска заказов, мебель и жители.

import { Container, Graphics } from 'pixi.js';
import { toScreen } from './iso';
import { RW, RH, STATIONS, FIREPLACE, BOARD, DOOR, DECOR, CAT, stationCenter, type Station } from './room';
import { drawBookshelf, drawArmchair, drawCat, drawWoodpile, drawWorkbench, drawCrates, drawCoatRack, drawDiningTable, drawPlant } from './roomDecor';
import { st, stationOpen, questVisible, questState, type Light } from './game';
import { QUESTS, residentById, type ResidentId } from './story';
import { hash, diamond, drawPerson, drawTelescope, drawPlanter, drawAnvil, drawMapTable, drawMailbag, drawPerch, drawOven, drawFireplace } from './draw';
import type { View } from './render';
import { Figure } from './figure';
import { charTex } from './sprites';

const WALL_H = 52;

/** Точка на задней стене (вдоль y = 0) и на левой (вдоль x = 0), v — высота. */
const backPt = (x: number, v: number) => { const s = toScreen(x, 0); return [s.x, s.y - v]; };
const leftPt = (y: number, v: number) => { const s = toScreen(0, y); return [s.x, s.y - v]; };

export class RoomView implements View {
  readonly root = new Container();
  readonly fog = null;
  readonly glowTint = 0xff9040;
  private objects = new Container({ sortableChildren: true });
  private board = new Graphics();
  private boardKey: string | null = null;
  private furniture: { s: Station; g: Graphics; npc: Figure | null }[] = [];
  private fire = new Graphics();
  private player = new Figure();
  private cat = new Graphics();
  private table: Graphics | null = null;

  constructor() {
    this.root.addChild(buildShell(), this.board, this.objects);
    this.build();
  }

  darkAlpha() { return 0.5; }
  halos() { return []; }
  sparks() { return [{ x: st.spark.x, y: st.spark.y, alpha: 1 }]; }

  lights(): Light[] {
    const ls: Light[] = [
      { x: FIREPLACE.x + 1, y: 1.5, r: 4, id: 100 },
      { x: 5.5, y: 4.5, r: 8, id: 101 },
      { x: 2.5, y: 6.5, r: 2.2, id: 103 },
      { x: st.player.x, y: st.player.y, r: 1.8, id: -1 },
      { x: st.spark.x, y: st.spark.y, r: 1.1, id: -2 },
    ];
    if (st.movedIn.includes('mila')) ls.push({ x: 8, y: 9.5, r: 2.5, id: 102 });
    return ls;
  }

  focus() { return { x: 4.6, y: 3.6 }; }

  private place(g: Container, x: number, y: number, z: number) {
    const s = toScreen(x, y);
    g.position.set(Math.round(s.x), Math.round(s.y));
    g.zIndex = z * 10;
    this.objects.addChild(g);
  }

  private build() {
    this.place(this.fire, FIREPLACE.x, FIREPLACE.y, FIREPLACE.x + 1 + FIREPLACE.y + 0.5);
    for (const s of STATIONS) {
      const g = new Graphics();
      const c = stationCenter(s);
      this.place(g, s.x, s.y, c.x + c.y);
      if (s.id === 'agata') drawPlanter(g);
      if (s.id === 'timofey') drawAnvil(g);
      if (s.id === 'nika') drawMapTable(g);
      if (s.id === 'seva') drawMailbag(g);
      let npc: Figure | null = null;
      if (s.id === 'filin') {
        // Филин сидит на насесте: ставим фигуру на жёрдочку
        npc = new Figure();
        const at = stationCenter(s);
        this.place(npc, at.x, at.y, at.x + at.y + 0.1);
        npc.y -= 17;
      } else if (s.id !== 'scope') {
        npc = new Figure();
        this.place(npc, s.npc.x, s.npc.y, s.npc.x + s.npc.y);
      }
      this.furniture.push({ s, g, npc });
    }
    // мебель, которая стоит всегда
    for (const d of DECOR) {
      const g = new Graphics();
      this.place(g, d.x, d.y, d.x + d.w / 2 + d.y + d.h / 2);
      if (d.kind === 'bookshelf') drawBookshelf(g);
      if (d.kind === 'armchair') drawArmchair(g);
      if (d.kind === 'woodpile') drawWoodpile(g);
      if (d.kind === 'workbench') drawWorkbench(g);
      if (d.kind === 'crates') drawCrates(g);
      if (d.kind === 'coatrack') drawCoatRack(g);
      if (d.kind === 'plant') drawPlant(g, hash(d.x, d.y));
      if (d.kind === 'table') this.table = g;
    }
    this.place(this.cat, CAT.x, CAT.y, CAT.x + CAT.y);
    this.objects.addChild(this.player);
  }

  update() {
    const t = st.time;
    drawFireplace(this.fire.clear(), t);
    drawCat(this.cat.clear(), t);
    if (this.table) drawDiningTable(this.table.clear(), t);

    for (const f of this.furniture) {
      const open = stationOpen(f.s);
      f.g.visible = open;
      if (f.npc) f.npc.visible = open;
      if (!open) continue;
      if (f.s.id === 'scope') drawTelescope(f.g.clear(), t);
      if (f.s.id === 'filin') drawPerch(f.g.clear(), t, !charTex('filin', false, 0));
      if (f.s.id === 'mila') drawOven(f.g.clear(), t);
      if (f.npc) {
        const r = residentById(f.s.id as ResidentId);
        // жители иногда поворачиваются
        const face = Math.sin(t * 0.4 + f.s.x * 3) > 0 ? 1 : -1;
        f.npc.person(r.id, face, 0, false, r.coat);
      }
    }

    // бумажки на доске: свет — заказ выполнен, бумага — ещё нет
    const papers = QUESTS.filter((q) => questVisible(q) && questState(q) !== 'claimed').map((q) => questState(q));
    const key = papers.join();
    if (key !== this.boardKey) { this.boardKey = key; drawBoard(this.board.clear(), papers); }

    const pl = st.player;
    const p = toScreen(pl.x, pl.y);
    this.player.hero(pl.face, pl.anim, pl.moving, false);
    this.player.position.set(Math.round(p.x), Math.round(p.y));
    this.player.zIndex = (pl.x + pl.y) * 10 + 1;
  }
}

function drawBoard(g: Graphics, papers: string[]) {
  const x0 = BOARD.x - 0.6, x1 = BOARD.x + 1.6;
  g.poly([...backPt(x0, 14), ...backPt(x1, 14), ...backPt(x1, 42), ...backPt(x0, 42)]).fill(0x4a2e1a);
  g.poly([...backPt(x0 + 0.08, 16), ...backPt(x1 - 0.08, 16), ...backPt(x1 - 0.08, 40), ...backPt(x0 + 0.08, 40)]).fill(0xa8784a);
  papers.forEach((state, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const u = x0 + 0.3 + col * 0.65, v = 34 - row * 11;
    const color = state === 'done' ? 0xffe08a : 0xf0ead8;
    g.poly([...backPt(u, v - 8), ...backPt(u + 0.4, v - 8), ...backPt(u + 0.4, v), ...backPt(u, v)]).fill(color);
    const [px, py] = backPt(u + 0.2, v);
    g.rect(px - 1, py - 1, 2, 2).fill(0xd04030);
  });
}

/** Пол, стены, окно и дверь — рисуются один раз. */
function buildShell() {
  const g = new Graphics();

  // пол «ёлочкой»
  for (let y = 0; y < RH; y++) {
    for (let x = 0; x < RW; x++) {
      const n = hash(x, y);
      diamond(g, x, y, (x + y) % 2 ? (n > 0.5 ? 0x9a6234 : 0x94602f) : (n > 0.5 ? 0xa86c3a : 0xb07440));
      const a = toScreen(x, y), b = toScreen(x + 1, y + 1);
      if ((x + y) % 2) g.poly([a.x + 4, a.y + 6, b.x + 4, b.y - 6, b.x + 3, b.y - 6, a.x + 3, a.y + 6]).fill(0x7a4a24);
      else g.poly([a.x - 4, a.y + 6, b.x - 4, b.y - 6, b.x - 3, b.y - 6, a.x - 3, a.y + 6]).fill(0x7a4a24);
    }
  }
  // ковёр под столом
  for (let y = 2; y < 8; y++) for (let x = 3; x < 9; x++) {
    const edge = x === 3 || x === 8 || y === 2 || y === 7, inner = x === 4 || x === 7 || y === 3 || y === 6;
    diamond(g, x, y, edge ? 0x7a2424 : inner ? 0xc8703a : 0xa83a32);
  }
  // коврик у камина
  for (let x = 8; x < 10; x++) diamond(g, x, 1, 0x5a6a3a);

  // стены: раствор, потом кирпичи
  g.poly([...backPt(0, 0), ...backPt(RW, 0), ...backPt(RW, WALL_H), ...backPt(0, WALL_H)]).fill(0x6a5038);
  g.poly([...leftPt(0, 0), ...leftPt(RH, 0), ...leftPt(RH, WALL_H), ...leftPt(0, WALL_H)]).fill(0x5a4430);
  const rows = Math.floor(WALL_H / 8);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 0.5 : 0;
    for (let i = -1; i < RW; i++) {
      const a = Math.max(0, i + off), b = Math.min(RW, i + off + 1);
      if (b <= a) continue;
      const c = hash(i, r) > 0.5 ? 0xc89a62 : 0xbf905a;
      g.poly([...backPt(a + 0.04, r * 8 + 1), ...backPt(b - 0.04, r * 8 + 1), ...backPt(b - 0.04, r * 8 + 7), ...backPt(a + 0.04, r * 8 + 7)]).fill(c);
    }
    for (let i = -1; i < RH; i++) {
      const a = Math.max(0, i + off), b = Math.min(RH, i + off + 1);
      if (b <= a) continue;
      const c = hash(r, i + 50) > 0.5 ? 0xa8804e : 0x9f784a;
      g.poly([...leftPt(a + 0.04, r * 8 + 1), ...leftPt(b - 0.04, r * 8 + 1), ...leftPt(b - 0.04, r * 8 + 7), ...leftPt(a + 0.04, r * 8 + 7)]).fill(c);
    }
  }
  // деревянная балка поверху
  g.poly([...backPt(0, WALL_H - 4), ...backPt(RW, WALL_H - 4), ...backPt(RW, WALL_H), ...backPt(0, WALL_H)]).fill(0x7a4a24);
  g.poly([...leftPt(0, WALL_H - 4), ...leftPt(RH, WALL_H - 4), ...leftPt(RH, WALL_H), ...leftPt(0, WALL_H)]).fill(0x6a3e1e);

  // окно на левой стене: за ним ночь и звёзды
  const w0 = 2.3, w1 = 3.4;
  g.poly([...leftPt(w0, 18), ...leftPt(w1, 18), ...leftPt(w1, 40), ...leftPt(w0, 40)]).fill(0x4a2e1a);
  g.poly([...leftPt(w0 + 0.08, 20), ...leftPt(w1 - 0.08, 20), ...leftPt(w1 - 0.08, 38), ...leftPt(w0 + 0.08, 38)]).fill(0x101830);
  for (const [u, v] of [[0.3, 33], [0.7, 27], [0.55, 35], [0.2, 24]]) {
    const [sx, sy] = leftPt(w0 + u * (w1 - w0), v);
    g.rect(sx, sy, 1, 1).fill(0xe8e8ff);
  }
  const [mx0, my0] = leftPt((w0 + w1) / 2, 20), [mx1, my1] = leftPt((w0 + w1) / 2, 38);
  g.poly([mx0, my0, mx1, my1, mx1 + 1, my1, mx0 + 1, my0]).fill(0x4a2e1a);

  // полка с банками на левой стене (над верстаком)
  g.poly([...leftPt(3.8, 30), ...leftPt(5.2, 30), ...leftPt(5.2, 28), ...leftPt(3.8, 28)]).fill(0x6b4423);
  for (const [u, c] of [[4.0, 0xc8603a], [4.35, 0x6a9ac8], [4.7, 0xe0b040], [5.0, 0x5aaa4a]] as const) {
    const [x, y] = leftPt(u, 30);
    g.rect(x - 1, y - 5, 3, 5).fill(c);
    g.rect(x - 1, y - 6, 3, 1).fill(0xa87a48);
  }
  // картина на задней стене: солнце над крышами (каким город был раньше)
  g.poly([...backPt(10.4, 24), ...backPt(11.8, 24), ...backPt(11.8, 40), ...backPt(10.4, 40)]).fill(0x8a5a32);
  g.poly([...backPt(10.5, 25.5), ...backPt(11.7, 25.5), ...backPt(11.7, 38.5), ...backPt(10.5, 38.5)]).fill(0x9ad0f0);
  g.poly([...backPt(10.5, 25.5), ...backPt(11.7, 25.5), ...backPt(11.7, 30), ...backPt(10.5, 30)]).fill(0x5aaa4a);
  { const [x, y] = backPt(11.1, 35); g.circle(x, y, 2.5).fill(0xffd23a); }
  // висячий фонарик над столом (на левой стене — кронштейн)
  { const [x, y] = leftPt(6, 46); g.rect(x, y, 6, 1).fill(0x2e3450); g.rect(x + 5, y, 1, 4).fill(0x2e3450); g.rect(x + 3, y + 4, 5, 5).fill(0x2e3450); g.rect(x + 4, y + 5, 3, 3).fill(0xffd36b); }
  // дверь на левой стене
  const d0 = DOOR.y - 0.5, d1 = DOOR.y + 0.9;
  g.poly([...leftPt(d0, 0), ...leftPt(d1, 0), ...leftPt(d1, 36), ...leftPt(d0, 36)]).fill(0x3a2412);
  g.poly([...leftPt(d0 + 0.1, 0), ...leftPt(d1 - 0.1, 0), ...leftPt(d1 - 0.1, 33), ...leftPt(d0 + 0.1, 33)]).fill(0x6b4423);
  for (const v of [8, 24]) g.poly([...leftPt(d0 + 0.1, v), ...leftPt(d1 - 0.1, v), ...leftPt(d1 - 0.1, v + 2), ...leftPt(d0 + 0.1, v + 2)]).fill(0x8a8a96);
  const [hx, hy] = leftPt(d1 - 0.3, 16);
  g.rect(hx - 1, hy - 1, 2, 2).fill(0xffd36b);
  return g;
}
