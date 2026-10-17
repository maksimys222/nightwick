// Живописный фон главного меню: лесная поляна, слева солнце с лучами, справа — дупло огромного дерева.
// Рисуется кодом на canvas (без картинок): неподвижное — один раз в запас, живое (лучи, листья, туман,
// светлячки) — каждый кадр поверх.

const VW = 1600, VH = 900;     // «холст» сцены; на экран — с масштабом «по ширине/высоте, с обрезкой»
const SUN = { x: 330, y: 300 };

/** Детерминированный генератор случайных чисел — сцена одна и та же при каждом запуске. */
function rng(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

interface Leaf { x: number; y: number; s: number; a: number; lit: number; ph: number; dark: boolean }
interface Mote { x: number; y: number; r: number; sp: number; ph: number; fly: boolean }

export class MenuScene {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private base: HTMLCanvasElement | null = null;
  private leaves: Leaf[] = [];
  private stems: [number, number][][] = [];
  private motes: Mote[] = [];
  private raf = 0;
  private scale = 1;
  private ox = 0;
  private oy = 0;

  constructor() {
    this.canvas.className = 'menu-scene';
    addEventListener('resize', () => this.fit());
  }

  start() {
    if (!this.base) this.build();
    this.fit();
    if (!this.raf) this.loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private fit() {
    // пиксельный вид: рисуем в 3 раза мельче и растягиваем без сглаживания (как сама игра)
    const w = innerWidth, h = innerHeight, dpr = 1 / 3;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = Math.max(w / VW, h / VH) * dpr;
    this.ox = (this.canvas.width - VW * this.scale) / 2;
    this.oy = (this.canvas.height - VH * this.scale) / 2;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.draw(performance.now() / 1000);
  };

  // ---------- неподвижная часть: рисуем один раз ----------
  private build() {
    const c = document.createElement('canvas');
    c.width = VW; c.height = VH;
    const g = c.getContext('2d')!;
    const R = rng(23);

    // небо-дымка: тёплое у солнца, к низу — зелень, справа — лесная темнота
    let lg = g.createLinearGradient(0, 0, 0, VH);
    lg.addColorStop(0, '#f2d48c'); lg.addColorStop(0.45, '#a8a85c'); lg.addColorStop(1, '#2c4428');
    g.fillStyle = lg; g.fillRect(0, 0, VW, VH);
    lg = g.createLinearGradient(0, 0, VW, 0);
    lg.addColorStop(0, 'rgba(6,12,10,0)'); lg.addColorStop(0.45, 'rgba(6,12,10,0.25)'); lg.addColorStop(0.75, 'rgba(6,12,10,0.8)'); lg.addColorStop(1, 'rgba(3,6,6,0.97)');
    g.fillStyle = lg; g.fillRect(0, 0, VW, VH);
    let rg = g.createRadialGradient(SUN.x, SUN.y, 0, SUN.x, SUN.y, 760);
    rg.addColorStop(0, 'rgba(255,240,180,0.95)'); rg.addColorStop(0.18, 'rgba(255,214,120,0.55)'); rg.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = rg; g.fillRect(0, 0, VW, VH);

    // три слоя деревьев: дальние — размытые и светлые (дымка), ближние — тёмные и чёткие
    const layers = [
      { n: 16, blur: 7, col: [120, 130, 80], alpha: 0.5, w: [18, 34] },
      { n: 12, blur: 3.5, col: [60, 76, 46], alpha: 0.75, w: [26, 50] },
      { n: 7, blur: 1, col: [26, 34, 22], alpha: 0.95, w: [40, 80] },
    ];
    for (const L of layers) {
      g.save();
      g.filter = `blur(${L.blur}px)`;
      for (let i = 0; i < L.n; i++) {
        const x = R() * 1250 - 40;
        if (x > 560 && x < 1040 && L.blur < 2) continue;      // середину оставляем для доски меню
        const w = L.w[0] + R() * (L.w[1] - L.w[0]);
        const near = Math.max(0, 1 - Math.hypot(x - SUN.x, 300) / 900);
        const [r, gg, b] = L.col;
        g.fillStyle = `rgba(${Math.round(r + 110 * near * (L.blur / 7))},${Math.round(gg + 90 * near * (L.blur / 7))},${b},${L.alpha})`;
        g.beginPath();
        g.moveTo(x, -20);
        g.bezierCurveTo(x + w * 0.1, 300, x - w * 0.1, 600, x - w * 0.25, 760);
        g.lineTo(x + w * 1.25, 760);
        g.bezierCurveTo(x + w * 1.1, 600, x + w * 0.9, 300, x + w, -20);
        g.fill();
      }
      // кроны — пятна листвы наверху
      for (let i = 0; i < L.n * 6; i++) {
        const x = R() * VW, y = R() * 120 - 40, r = 30 + R() * 70;
        if (L.blur < 2 && x > 450 && x < 1100) continue;   // над доской меню — просвет, не тёмная полоса
        g.fillStyle = `rgba(${L.col[0] - 10},${L.col[1] + 10},${L.col[2]},${L.alpha * (L.blur < 2 ? 0.55 : 0.7)})`;
        g.beginPath(); g.ellipse(x, y, r * 1.4, r * 0.7, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }

    // земля: травяной склон, освещённый у солнца
    g.save();
    lg = g.createLinearGradient(0, 700, 0, VH);
    lg.addColorStop(0, '#4f7a32'); lg.addColorStop(1, '#1d3016');
    g.fillStyle = lg;
    g.beginPath(); g.moveTo(0, 720);
    g.bezierCurveTo(400, 690, 900, 700, 1600, 730); g.lineTo(1600, 900); g.lineTo(0, 900); g.fill();
    rg = g.createRadialGradient(SUN.x + 100, 760, 0, SUN.x + 100, 760, 700);
    rg.addColorStop(0, 'rgba(210,220,110,0.55)'); rg.addColorStop(1, 'rgba(210,220,110,0)');
    g.fillStyle = rg; g.fillRect(0, 680, VW, 220);
    lg = g.createLinearGradient(900, 0, VW, 0);
    lg.addColorStop(0, 'rgba(4,8,6,0)'); lg.addColorStop(1, 'rgba(4,8,6,0.85)');
    g.fillStyle = lg; g.fillRect(900, 680, 700, 220);
    // травинки
    for (let i = 0; i < 4200; i++) {
      const x = R() * VW, y = 705 + R() * 200;
      const h = 6 + R() * 18 * (y - 690) / 200;
      const lit = Math.max(0, 1 - Math.hypot(x - SUN.x, (y - 700) * 2) / 900) * (x < 1000 ? 1 : 0.2);
      const dark = Math.min(1, Math.max(0, (x - 900) / 600));
      const r0 = 50 + 120 * lit - 30 * dark, g0 = 90 + 110 * lit - 50 * dark, b0 = 30 + 30 * lit - 15 * dark;
      g.strokeStyle = `rgba(${r0 | 0},${g0 | 0},${b0 | 0},0.85)`;
      g.lineWidth = 1 + R() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * 6, y - h * 0.6, x + (R() - 0.5) * 10, y - h); g.stroke();
    }
    g.restore();

    // тропинка из плоских камней (ближе — крупнее), с тенью и бликом
    const stones = [[800, 880, 95, 26], [740, 828, 70, 19], [850, 790, 56, 15], [780, 758, 44, 12], [835, 734, 34, 9], [800, 716, 25, 7]];
    for (const [x, y, rx, ry] of stones) {
      g.fillStyle = 'rgba(10,14,8,0.45)';
      g.beginPath(); g.ellipse(x + 4, y + 5, rx, ry, 0, 0, Math.PI * 2); g.fill();
      const sg = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
      sg.addColorStop(0, '#d8d0bc'); sg.addColorStop(0.5, '#a8a090'); sg.addColorStop(1, '#5e584c');
      g.fillStyle = sg;
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(90,140,60,0.55)';
      g.beginPath(); g.ellipse(x - rx * 0.5, y + ry * 0.4, rx * 0.3, ry * 0.35, 0.2, 0, Math.PI * 2); g.fill();
    }

    // замшелые валуны слева внизу
    for (const [x, y, r] of [[90, 840, 110], [250, 880, 70]]) {
      const bg = g.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r * 1.2);
      bg.addColorStop(0, '#8a8a7a'); bg.addColorStop(0.6, '#4e4c42'); bg.addColorStop(1, '#22221c');
      g.fillStyle = bg;
      g.beginPath(); g.ellipse(x, y, r * 1.25, r * 0.85, 0, 0, Math.PI * 2); g.fill();
      const mg = g.createLinearGradient(0, y - r, 0, y - r * 0.2);
      mg.addColorStop(0, '#9ac852'); mg.addColorStop(1, 'rgba(70,120,40,0)');
      g.fillStyle = mg;
      g.beginPath(); g.ellipse(x - r * 0.1, y - r * 0.45, r * 1.05, r * 0.45, -0.1, 0, Math.PI * 2); g.fill();
    }

    this.drawBigTree(g, R);

    // туман-дымка над землёй (неподвижная часть)
    g.save(); g.filter = 'blur(30px)';
    g.fillStyle = 'rgba(230,240,200,0.18)';
    g.beginPath(); g.ellipse(500, 720, 700, 50, 0, 0, Math.PI * 2); g.fill();
    g.restore();

    // лианы: стебли и листья (листья качаются — их рисуем каждый кадр)
    const top: [number, number][] = [];
    for (let x = -40; x <= VW + 40; x += 30) top.push([x, 40 + Math.sin(x / 160) * 26 + Math.sin(x / 47) * 6]);
    this.stems.push(top);
    for (const [hx, len] of [[120, 340], [260, 190], [470, 120], [1180, 260], [1420, 420], [40, 640]] as const) {
      const pts: [number, number][] = [];
      for (let k = 0; k <= len; k += 18) pts.push([hx + Math.sin(k / 60 + hx) * 16, 50 + k]);
      this.stems.push(pts);
    }
    g.save();
    for (const s of this.stems) {
      g.strokeStyle = '#2e4a1c'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); s.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      g.strokeStyle = 'rgba(140,170,80,0.35)'; g.lineWidth = 2;
      g.beginPath(); s.forEach(([x, y], i) => (i ? g.lineTo(x - 2, y - 2) : g.moveTo(x - 2, y - 2))); g.stroke();
    }
    g.restore();
    for (const s of this.stems) {
      for (let i = 0; i < s.length; i++) {
        const [x, y] = s[i];
        for (let k = 0; k < 2; k++) {
          const lit = Math.max(0, 1 - Math.hypot(x - SUN.x, y - SUN.y) / 700);
          this.leaves.push({ x: x + (R() - 0.5) * 30, y: y + R() * 22, s: 14 + R() * 16, a: R() * Math.PI * 2, lit, ph: R() * 6, dark: x > 1100 });
        }
      }
    }
    // густая листва в верхних углах
    for (let i = 0; i < 70; i++) {
      const left = i < 40;
      const x = left ? R() * 420 : 1150 + R() * 450, y = R() * 130;
      this.leaves.push({ x, y, s: 16 + R() * 20, a: R() * Math.PI * 2, lit: left ? Math.max(0, 1 - Math.hypot(x - SUN.x, y - SUN.y) / 600) : 0, ph: R() * 6, dark: !left });
    }
    // папоротник справа внизу
    g.save();
    for (let i = 0; i < 11; i++) {
      const a = -2.9 + i * 0.2, len = 220 + R() * 80;
      const bx = 1500, by = 920;
      g.strokeStyle = '#1e3a1a'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(bx, by);
      const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
      g.quadraticCurveTo(bx + Math.cos(a + 0.3) * len * 0.6, by + Math.sin(a + 0.3) * len * 0.6, ex, ey); g.stroke();
      for (let k = 0.15; k < 1; k += 0.07) {
        const px = bx + (ex - bx) * k, py = by + (ey - by) * k - Math.sin(k * Math.PI) * 30;
        g.fillStyle = k > 0.6 ? '#2e5a26' : '#24481e';
        g.beginPath(); g.ellipse(px, py, 24 * (1 - k * 0.6), 6, a + 1.3, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();

    // мотыльки света и светлячки
    for (let i = 0; i < 46; i++) this.motes.push({ x: R() * VW, y: 120 + R() * 700, r: 1.5 + R() * 3, sp: 0.2 + R() * 0.6, ph: R() * 10, fly: i % 3 === 0 });
    this.base = c;
  }

  private drawBigTree(g: CanvasRenderingContext2D, R: () => number) {
    g.save();
    // ствол: шире книзу, корни уходят в землю
    const path = new Path2D();
    path.moveTo(1230, -20);
    path.bezierCurveTo(1170, 250, 1200, 520, 1110, 720);
    path.bezierCurveTo(1060, 820, 980, 880, 940, 920);
    path.lineTo(1650, 920); path.lineTo(1650, -20); path.closePath();
    const tg = g.createLinearGradient(1080, 0, 1600, 0);
    tg.addColorStop(0, '#5c4430'); tg.addColorStop(0.08, '#2e2216'); tg.addColorStop(1, '#0a0705');
    g.fillStyle = tg; g.fill(path);
    g.clip(path);
    // кора: вертикальные волнистые борозды
    for (let i = 0; i < 260; i++) {
      const x = 1100 + R() * 520, y0 = R() * 900, len = 60 + R() * 220;
      g.strokeStyle = R() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(120,90,60,0.12)';
      g.lineWidth = 1 + R() * 3;
      g.beginPath(); g.moveTo(x, y0);
      g.bezierCurveTo(x + 8, y0 + len * 0.3, x - 8, y0 + len * 0.7, x + 3, y0 + len); g.stroke();
    }
    // мох на коре
    for (let i = 0; i < 40; i++) {
      const x = 1110 + R() * 140, y = 150 + R() * 650;
      const mg = g.createRadialGradient(x, y, 0, x, y, 30 + R() * 30);
      mg.addColorStop(0, 'rgba(110,150,60,0.55)'); mg.addColorStop(1, 'rgba(110,150,60,0)');
      g.fillStyle = mg; g.fillRect(x - 60, y - 60, 120, 120);
    }
    // дупло: тёмный проём с подсвеченным краем
    const hx = 1360, hy = 520;
    let hg = g.createRadialGradient(hx - 20, hy - 30, 10, hx, hy, 200);
    hg.addColorStop(0, '#000000'); hg.addColorStop(0.75, '#050302'); hg.addColorStop(1, 'rgba(40,28,18,0)');
    g.fillStyle = hg;
    g.beginPath(); g.ellipse(hx, hy, 120, 210, 0.05, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(140,100,60,0.35)'; g.lineWidth = 6;
    g.beginPath(); g.ellipse(hx, hy, 112, 204, 0.05, Math.PI * 0.6, Math.PI * 1.5); g.stroke();
    g.restore();
    // два глаза светятся из темноты
    g.save();
    for (const ex of [1335, 1385]) {
      hg = g.createRadialGradient(ex, 470, 0, ex, 470, 28);
      hg.addColorStop(0, 'rgba(140,210,255,0.9)'); hg.addColorStop(0.3, 'rgba(90,160,255,0.35)'); hg.addColorStop(1, 'rgba(60,120,255,0)');
      g.fillStyle = hg; g.fillRect(ex - 30, 440, 60, 60);
      g.fillStyle = '#e8f8ff';
      g.beginPath(); g.ellipse(ex, 470, 6, 3, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  // ---------- каждый кадр: фон + живое ----------
  private draw(t: number) {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    g.drawImage(this.base!, 0, 0);

    // лучи солнца: мягкие полосы, медленно переливаются
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const a = 0.28 + i * 0.13 + Math.sin(t * 0.15 + i) * 0.015;
      const w = 0.035 + (i % 3) * 0.015;
      const len = 1300;
      const al = 0.07 + 0.05 * Math.sin(t * 0.4 + i * 1.7);
      const x1 = SUN.x + Math.cos(a - w) * len, y1 = SUN.y + Math.sin(a - w) * len;
      const x2 = SUN.x + Math.cos(a + w) * len, y2 = SUN.y + Math.sin(a + w) * len;
      const lg = g.createLinearGradient(SUN.x, SUN.y, (x1 + x2) / 2, (y1 + y2) / 2);
      lg.addColorStop(0, `rgba(255,236,170,${al * 2})`); lg.addColorStop(0.5, `rgba(255,226,150,${al})`); lg.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(SUN.x, SUN.y); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill();
    }
    // само солнце
    const sg = g.createRadialGradient(SUN.x, SUN.y, 0, SUN.x, SUN.y, 150);
    sg.addColorStop(0, 'rgba(255,255,240,1)'); sg.addColorStop(0.35, 'rgba(255,246,200,0.95)'); sg.addColorStop(0.6, 'rgba(255,220,130,0.35)'); sg.addColorStop(1, 'rgba(255,210,120,0)');
    g.fillStyle = sg; g.fillRect(SUN.x - 160, SUN.y - 160, 320, 320);
    g.restore();

    // туман у земли — плывёт
    g.save();
    for (let i = 0; i < 3; i++) {
      const x = ((t * (12 + i * 6) + i * 600) % 2200) - 300;
      const mg = g.createRadialGradient(x, 740 + i * 30, 0, x, 740 + i * 30, 380);
      mg.addColorStop(0, 'rgba(235,240,215,0.16)'); mg.addColorStop(1, 'rgba(235,240,215,0)');
      g.fillStyle = mg;
      g.save(); g.translate(x, 740 + i * 30); g.scale(1, 0.18); g.translate(-x, -(740 + i * 30));
      g.fillRect(x - 380, 740 + i * 30 - 380, 760, 760);
      g.restore();
    }
    g.restore();

    // листья на лианах — чуть покачиваются
    for (const L of this.leaves) {
      const sway = Math.sin(t * 1.1 + L.ph) * 0.12;
      g.save();
      g.translate(L.x, L.y);
      g.rotate(L.a + sway);
      const s = L.s;
      const lg = g.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
      if (L.dark) { lg.addColorStop(0, '#2c5226'); lg.addColorStop(1, '#14260f'); }
      else {
        // у солнца листья просвечивают тёплым жёлто-зелёным
        const k = L.lit;
        lg.addColorStop(0, `rgb(${110 + 120 * k},${170 + 60 * k},${60 + 40 * k})`);
        lg.addColorStop(1, `rgb(${40 + 60 * k},${90 + 60 * k},${30 + 20 * k})`);
      }
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(-s, 0);
      g.bezierCurveTo(-s * 0.5, -s * 0.62, s * 0.55, -s * 0.5, s, 0);
      g.bezierCurveTo(s * 0.55, s * 0.5, -s * 0.5, s * 0.62, -s, 0);
      g.fill();
      g.strokeStyle = L.dark ? 'rgba(80,120,60,0.4)' : 'rgba(230,250,170,0.45)';
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-s * 0.9, 0); g.lineTo(s * 0.85, 0); g.stroke();
      g.restore();
    }

    // пылинки в лучах и светлячки
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const x = m.x + Math.sin(t * m.sp + m.ph) * 40, y = m.y + Math.cos(t * m.sp * 0.8 + m.ph) * 26 - (m.fly ? 0 : (t * 6) % 40);
      const blink = m.fly ? 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + m.ph * 3)) : 0.5;
      const r = m.fly ? m.r * 3 : m.r * 1.6;
      const mg = g.createRadialGradient(x, y, 0, x, y, r * 3);
      mg.addColorStop(0, m.fly ? `rgba(255,240,140,${blink})` : `rgba(255,250,220,${blink * 0.6})`);
      mg.addColorStop(1, 'rgba(255,230,120,0)');
      g.fillStyle = mg; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    g.restore();

    // виньетка
    const vg = g.createRadialGradient(VW * 0.45, VH * 0.45, VH * 0.35, VW * 0.5, VH * 0.5, VW * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
  }
}

/** Текстура доски меню: доски с прожилками и сучками, рама с фаской и гвоздями. Возвращает data:URL. */
export function woodBoard(w = 520, h = 640) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const R = rng(5);
  const plank = 112;
  for (let y0 = 0; y0 < h; y0 += plank) {
    const lg = g.createLinearGradient(0, y0, 0, y0 + plank);
    const tone = 0.85 + R() * 0.3;
    lg.addColorStop(0, `rgb(${70 * tone | 0},${44 * tone | 0},${26 * tone | 0})`);
    lg.addColorStop(1, `rgb(${46 * tone | 0},${28 * tone | 0},${16 * tone | 0})`);
    g.fillStyle = lg; g.fillRect(0, y0, w, plank);
    // прожилки — тонкие волнистые линии вдоль доски
    for (let i = 0; i < 46; i++) {
      const y = y0 + R() * plank;
      g.strokeStyle = R() < 0.6 ? `rgba(20,10,4,${0.15 + R() * 0.25})` : `rgba(140,96,56,${0.08 + R() * 0.12})`;
      g.lineWidth = 0.6 + R() * 1.4;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 40) g.lineTo(x, y + Math.sin(x / 70 + i) * 2.5 + (R() - 0.5));
      g.stroke();
    }
    // сучок
    if (R() < 0.7) {
      const kx = 60 + R() * (w - 120), ky = y0 + 25 + R() * (plank - 50);
      for (let r = 14; r > 2; r -= 3) {
        g.strokeStyle = `rgba(25,12,5,${0.5 - r / 40})`; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(kx, ky, r * 1.8, r * 0.7, 0, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = 'rgba(20,10,4,0.6)'; g.beginPath(); g.ellipse(kx, ky, 4, 2, 0, 0, Math.PI * 2); g.fill();
    }
    // щель между досками
    g.fillStyle = 'rgba(8,4,2,0.85)'; g.fillRect(0, y0 + plank - 3, w, 3);
    g.fillStyle = 'rgba(150,104,62,0.25)'; g.fillRect(0, y0, w, 1.5);
  }
  // рама: тёмное дерево с фаской
  const F = 22;
  g.save();
  g.lineWidth = F;
  g.strokeStyle = '#2a170a';
  g.strokeRect(F / 2, F / 2, w - F, h - F);
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(190,130,70,0.45)'; g.strokeRect(2, 2, w - 4, h - 4);
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeRect(F - 1, F - 1, w - 2 * F + 2, h - 2 * F + 2);
  g.restore();
  // тень внутрь от рамы
  const ig = g.createLinearGradient(0, F, 0, F + 30);
  ig.addColorStop(0, 'rgba(0,0,0,0.45)'); ig.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = ig; g.fillRect(F, F, w - 2 * F, 30);
  // гвозди в углах
  for (const [x, y] of [[F / 2, F / 2], [w - F / 2, F / 2], [F / 2, h - F / 2], [w - F / 2, h - F / 2]]) {
    const ng = g.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 6);
    ng.addColorStop(0, '#f0ece0'); ng.addColorStop(0.5, '#8a8a90'); ng.addColorStop(1, '#2a2a30');
    g.fillStyle = ng; g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.fill();
  }
  return c.toDataURL();
}
