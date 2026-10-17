// Экран «Звёздное небо» (открывается у телескопа). Обычный SVG поверх игры:
// колёсико — приблизить, тянуть мышью — двигать, клик по звезде — зажечь.
// Звёзды — пиксельные (маски ниже), цвет — от созвездия.

import { st, lightStar, starBlock, starCost, starLit, branchOpen, doneConstellations } from './game';
import { STARS, FX, CONSTELLATIONS, CONSTELLATION_BONUS, starById, starName, type Star, type Branch } from './sky';
import { residentById, type ResidentId } from './story';

const NS = 'http://www.w3.org/2000/svg';

/**
 * Пиксельные звёзды: # — тело (цвет созвездия), + — светлая сердцевина, * — белое ядро.
 * Обычная — четырёхлучевая искра, яркая — восьмилучевая, особая — гранёный кристалл, центр — солнышко.
 */
const MASKS: Record<'center' | 'key' | 'big' | 'small', string[]> = {
  small: ['...#...', '...#...', '..#+#..', '##+*+##', '..#+#..', '...#...', '...#...'],
  big: ['....#....', '....#....', '.#.#+#.#.', '..#+++#..', '##++*++##', '..#+++#..', '.#.#+#.#.', '....#....', '....#....'],
  key: ['.....#.....', '....###....', '...##+##...', '..##+++##..', '.##++*++##.', '##++***++##',
    '.##++*++##.', '..##+++##..', '...##+##...', '....###....', '.....#.....'],
  center: ['......#......', '......#......', '..#..###..#..', '...#######...', '...##+++##...', '..##+++++##..',
    '####++*++####', '..##+++++##..', '...##+++##...', '...#######...', '..#..###..#..', '......#......', '......#......'],
};

/** Путь SVG из квадратиков маски: только клетки с нужными символами. */
function maskPath(mask: string[], chars: string, px: number) {
  const n = mask.length, o = (n * px) / 2;
  let d = '';
  mask.forEach((row, y) => [...row].forEach((ch, x) => {
    if (chars.includes(ch)) d += `M${(x * px - o).toFixed(2)} ${(y * px - o).toFixed(2)}h${px}v${px}h${-px}z`;
  }));
  return d;
}
const R = { center: 15, key: 12, big: 9, small: 5.5 } as const;
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const fmt = (n: number) => (n < 1000 ? Math.floor(n).toString() : (n / 1000).toFixed(1) + 'K');

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export class SkyView {
  private root = document.getElementById('starsky')!;
  private svg = el('svg');
  private world = el('g');
  private tip = document.createElement('div');
  private starEls = new Map<string, SVGGElement>();
  private lineEls: { a: string; b: string; e: SVGLineElement }[] = [];
  private labelEls = new Map<Branch, SVGTextElement>();
  private view = { x: 0, y: 0, k: 1 };
  private drag: { x: number; y: number; vx: number; vy: number; moved: boolean; star: SVGGElement | null } | null = null;
  private hover: string | null = null;
  private built = false;

  constructor(private onClose: () => void) {}

  private build() {
    this.built = true;
    this.root.innerHTML = `
      <div class="sky-top">
        <div><h2>Звёздное небо</h2><div class="sky-sub">Зажигай звёзды Светом — каждая что-то улучшает. Зажечь можно только рядом с горящей.</div></div>
        <div class="sky-stats"><div class="sky-lumens"></div><div class="sky-count"></div></div>
        <button class="sky-close" title="Закрыть (Esc)">×</button>
      </div>
      <div class="sky-help">Колёсико — приблизить · тяни мышью — двигать · клик по звезде — зажечь · Esc — закрыть</div>
      <div class="sky-sum"></div>`;
    this.root.querySelector('.sky-close')!.addEventListener('click', () => this.onClose());
    this.svg.classList.add('sky-svg');
    this.root.prepend(this.svg);
    this.tip.className = 'sky-tip';
    this.tip.hidden = true;
    this.root.appendChild(this.tip);

    // фон: россыпь мелких погасших звёздочек, просто для красоты
    const bg = el('g', { class: 'sky-dust' });
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const sz = rnd() < 0.85 ? 1.6 : 2.8;
      bg.appendChild(el('rect', { x: (rnd() - 0.5) * 1500, y: (rnd() - 0.5) * 1500, width: sz, height: sz }));
    }
    this.world.appendChild(bg);

    // линии между звёздами
    const lines = el('g');
    const seen = new Set<string>();
    for (const s of STARS) {
      for (const id of s.links) {
        const k = [s.id, id].sort().join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        const o = starById(id);
        const e = el('line', { x1: s.x, y1: s.y, x2: o.x, y2: o.y });
        lines.appendChild(e);
        this.lineEls.push({ a: s.id, b: id, e });
      }
    }
    this.world.appendChild(lines);

    // подписи созвездий — у дальней звезды ветки
    for (const b of Object.keys(CONSTELLATIONS) as Branch[]) {
      const far = b === 'core' ? { x: 0, y: 128 } : starById(`${b}-F`);
      const k = b === 'core' ? 1 : 1 + 42 / Math.hypot(far.x, far.y);
      const t = el('text', { x: far.x * k, y: far.y * k + 4, class: 'sky-label' });
      this.world.appendChild(t);
      this.labelEls.set(b, t);
    }

    // сами звёзды
    const stars = el('g');
    for (const s of STARS) {
      const g = el('g', { class: `star ${s.size}`, transform: `translate(${s.x} ${s.y})` });
      g.dataset.id = s.id;
      g.appendChild(el('circle', { class: 'halo', r: R[s.size] * 2.2 }));
      g.appendChild(el('circle', { class: 'hit', r: R[s.size] * 1.2 }));   // чтобы клик попадал между пикселями
      const mask = MASKS[s.size], px = (R[s.size] * 2.4) / mask.length;
      g.appendChild(el('path', { class: 'body px', d: maskPath(mask, '#+*', px) }));
      g.appendChild(el('path', { class: 'shine px', d: maskPath(mask, '+*', px) }));
      g.appendChild(el('path', { class: 'core px', d: maskPath(mask, '*', px) }));
      g.style.setProperty('--tw', `${(s.x * 7 + s.y * 13) % 30 / 10}s`);  // звёзды мерцают вразнобой
      g.style.setProperty('--c', hex(CONSTELLATIONS[s.branch].color));
      stars.appendChild(g);
      this.starEls.set(s.id, g);
    }
    this.world.appendChild(stars);
    this.svg.appendChild(this.world);

    // мышь: тянуть — двигать, колёсико — масштаб, клик — зажечь
    this.svg.addEventListener('pointerdown', (e) => {
      // звезду запоминаем сразу: после захвата мыши события приходят уже на весь SVG
      const star = (e.target as Element).closest<SVGGElement>('.star');
      this.drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, moved: false, star };
      this.svg.setPointerCapture(e.pointerId);
    });
    this.svg.addEventListener('pointermove', (e) => {
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        if (Math.hypot(dx, dy) > 4) this.drag.moved = true;
        if (this.drag.moved) {
          this.view.x = this.drag.vx + dx;
          this.view.y = this.drag.vy + dy;
          this.applyView();
          this.tip.hidden = true;
          return;
        }
      }
      const star = (e.target as Element).closest<SVGGElement>('.star');
      this.hover = star?.dataset.id ?? null;
      this.showTip(e.clientX, e.clientY);
    });
    this.svg.addEventListener('pointerup', (e) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      const star = d.star;
      if (star && lightStar(star.dataset.id!)) {
        star.classList.add('flash');
        setTimeout(() => star.classList.remove('flash'), 600);
        this.refresh();
        this.guide();
        this.showTip(e.clientX, e.clientY);
      }
    });
    this.svg.addEventListener('pointerleave', () => { this.hover = null; this.tip.hidden = true; });
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = Math.min(3, Math.max(0.35, this.view.k * Math.exp(-e.deltaY * 0.0015)));
      // приближаем к курсору
      const r = this.svg.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
      this.view.x = mx - ((mx - this.view.x) * k) / this.view.k;
      this.view.y = my - ((my - this.view.y) * k) / this.view.k;
      this.view.k = k;
      this.applyView();
    }, { passive: false });
  }

  open() {
    if (!this.built) this.build();
    this.root.hidden = false;
    // видимая часть неба (горящие звёзды и их соседи) — по размеру экрана
    const r = this.svg.getBoundingClientRect();
    const seen = STARS.filter((x) => starLit(x.id) || x.links.some(starLit));
    const reach = Math.max(140, ...seen.map((x) => Math.hypot(x.x, x.y))) + 70;
    this.view = { x: 0, y: 20, k: Math.min(2.6, Math.min(r.width, r.height - 120) / (reach * 2)) };
    this.applyView();
    this.refresh();
    this.guide();
  }

  /** Первый заход: Искра подсказывает, с чего начать. */
  private guide() {
    let box = this.root.querySelector<HTMLElement>('.sky-guide');
    if (!box) {
      box = document.createElement('div');
      box.className = 'sky-guide';
      this.root.appendChild(box);
    }
    const first = st.stars.length <= 1;
    box.hidden = !first && !!st.seen.skyGuide;
    box.innerHTML = first
      ? '<b>Искра:</b> Это я — в серединке! Вокруг меня мерцают звёзды. Кликни по любой — и она загорится. Начни с той, что ярче мерцает!'
      : '<b>Искра:</b> Получилось! Теперь видно соседние звёзды. Наведи на звезду — узнаешь, что она даёт. Дальше выбирай сам.';
    if (!first) st.seen.skyGuide = true;
  }

  close() {
    this.root.hidden = true;
    this.tip.hidden = true;
    this.hover = null;
  }

  private applyView() {
    const r = this.svg.getBoundingClientRect();
    this.world.setAttribute('transform', `translate(${r.width / 2 + this.view.x} ${r.height / 2 + this.view.y}) scale(${this.view.k})`);
  }

  /** Обновить, что горит, что можно зажечь, цены и цифры. */
  refresh() {
    if (this.root.hidden) return;
    for (const s of STARS) {
      const g = this.starEls.get(s.id)!;
      const lit = starLit(s.id);
      const block = lit ? null : starBlock(s);
      g.classList.toggle('lit', lit);
      g.classList.toggle('locked', !branchOpen(s.branch));
      g.classList.toggle('near', !lit && s.links.some(starLit) && branchOpen(s.branch));
      g.classList.toggle('can', !lit && block === null);
      // дальше соседей не видно: небо открывается по мере того, как зажигаешь звёзды
      g.classList.toggle('unknown', !lit && !s.links.some(starLit));
    }
    for (const { a, b, e } of this.lineEls) {
      const la = starLit(a), lb = starLit(b);
      e.setAttribute('class', la && lb ? 'on' : la || lb ? 'half' : 'unknown');
      const sa = starById(a), sb = starById(b);
      const br = sa.branch !== 'core' ? sa.branch : sb.branch;
      e.style.setProperty('--c', hex(CONSTELLATIONS[br].color));
    }
    const done = doneConstellations();
    for (const [b, t] of this.labelEls) {
      const c = CONSTELLATIONS[b];
      const open = branchOpen(b);
      const total = STARS.filter((s) => s.branch === b).length;
      const lit = STARS.filter((s) => s.branch === b && starLit(s.id)).length;
      t.textContent = open
        ? `«${c.name}» ${done.includes(b) ? '✓' : `${lit}/${total}`}`
        : `«${c.name}» — ${residentById(b as ResidentId).name}`;
      t.style.setProperty('--c', hex(c.color));
      t.classList.toggle('closed', !open);
      // подпись созвездия — только когда до него уже дотянулся свет
      t.classList.toggle('unknown', !STARS.some((s) => s.branch === b && (starLit(s.id) || s.links.some(starLit))));
      t.classList.toggle('done', done.includes(b));
    }
    this.root.querySelector('.sky-lumens')!.textContent = `Свет: ${fmt(st.lumens)}`;
    this.root.querySelector('.sky-count')!.textContent = `Звёзд: ${st.stars.length - 1} из ${STARS.length - 1}`;
    this.root.querySelector('.sky-sum')!.innerHTML = this.summary();
    if (this.hover && !this.tip.hidden) this.fillTip(starById(this.hover));
  }

  /** Что уже даёт небо — коротко, в углу. */
  private summary() {
    // последние зажжённые — сверху; всё сразу не влезет, поэтому показываем 7
    const lit = st.stars.filter((id) => id !== 'center').map(starById).reverse();
    if (!lit.length) return '<b>Небо пока тёмное.</b><div>Начни с кольца вокруг Искры.</div>';
    const rows = lit.slice(0, 7).map((s) => `<div${s.size === 'key' || s.size === 'big' ? ' class="k"' : ''}>${starName(s)}: ${FX[s.fx!].text.toLowerCase()}</div>`);
    if (lit.length > 7) rows.push(`<div class="more">…и ещё ${lit.length - 7}</div>`);
    const n = doneConstellations().length;
    if (n) rows.push(`<div class="k">Созвездий: ${n} — +${Math.round(n * CONSTELLATION_BONUS * 100)}% Света</div>`);
    return `<b>Горят ${lit.length}:</b>${rows.join('')}`;
  }

  private showTip(cx: number, cy: number) {
    if (!this.hover) { this.tip.hidden = true; return; }
    this.fillTip(starById(this.hover));
    this.tip.hidden = false;
    const w = this.tip.offsetWidth, h = this.tip.offsetHeight;
    const x = cx + 18 + w > innerWidth ? cx - 18 - w : cx + 18;
    const y = Math.min(innerHeight - h - 8, Math.max(8, cy - h / 2));
    this.tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  private fillTip(s: Star) {
    const c = CONSTELLATIONS[s.branch];
    const lines = s.fx ? `<div class="${s.size === 'key' || s.size === 'big' ? 't-key' : ''}">${FX[s.fx].text}</div>` : '';
    const kind = s.size === 'center' ? 'Сердце неба' : s.size === 'key' ? 'Особая звезда' : s.size === 'big' ? 'Яркая звезда' : 'Звезда';
    let foot: string;
    if (s.size === 'center') foot = '<div class="t-ok">Горит всегда. С неё всё начинается.</div>';
    else if (starLit(s.id)) foot = '<div class="t-ok">✓ Горит</div>';
    else {
      const block = starBlock(s);
      foot = block === null
        ? `<div class="t-cost">Зажечь: ${fmt(starCost(s))} Света — клик</div>`
        : block === 'Не хватает Света'
          ? `<div class="t-no">Нужно ${fmt(starCost(s))} Света</div>`
          : `<div class="t-no">${block}</div>`;
    }
    this.tip.innerHTML = `<div class="t-kind" style="color:${hex(c.color)}">${kind} · «${c.name}»</div><div class="t-name">${starName(s)}</div>${lines}${foot}`;
  }
}
