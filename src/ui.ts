// Интерфейс поверх игры — обычный HTML (так текст чёткий и легко менять).

import {
  st, UPGRADES, cost, buyBlock, buy, currentAct, hint, lumenRate, nextLine, claim, skipCine, save, finishPress, startNight,
  questVisible, questState, readyQuests, clickWorld, chooseBoon, districtOpen, BOONS, type UpId, type BoonId,
} from './game';
import { QUESTS, JOURNAL, residentById, type ResidentId } from './story';
import { DISTRICT_NAMES, DISTRICTS, DISTRICT_INFO, type District } from './map';
import type { Renderer } from './render';
import { getVolume, setVolume, getMusicVolume, setMusicVolume, setMusic, pick, out } from './audio';
import { settings, saveSettings, QUALITY_NAMES, type Quality } from './settings';
import { SkyView } from './skyView';
import { MenuScene } from './menuScene';
import { CONSTELLATIONS } from './sky';

/** Мини-игра на маслобойне: стрелка бегает по шкале, нужно поймать золотую зону. */
interface PressGame { round: number; hits: number; pos: number; dir: number; zone: number; width: number; marks: string[]; endT: number }
const PRESS_ROUNDS = 3;

export interface MenuActions { hasGame: () => boolean; start: () => void; newGame: () => void }

const $ = (id: string) => document.getElementById(id)!;
const fmt = (n: number) => (n < 1000 ? Math.floor(n).toString() : n < 1e6 ? (n / 1000).toFixed(1) + 'K' : (n / 1e6).toFixed(2) + 'M');

export class UI {
  private acc = 1;
  private modalKey = '';
  private greeting = '';
  /** Новая ночь: экран на миг темнеет и плавно открывается (пока строится новый лес). */
  private nightFade = 0;
  private worldVer = st.worldVer;

  private menuMode: 'main' | 'pause' = 'main';
  private press: PressGame | null = null;
  private sky = new SkyView(() => this.closeModal());
  private scene = new MenuScene();

  constructor(private r: Renderer, private actions: MenuActions) {
    $('menu').prepend(this.scene.canvas);
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (st.menu) { if (e.code === 'Escape' && this.menuMode === 'pause') this.closeMenu(); return; }
      if (e.code === 'Escape' && !st.cine && !st.modal && !st.dialog.length) { this.openMenu('pause'); return; }
      if (st.cine && e.code === 'Escape') { skipCine(); return; }
      if (e.code === 'F1') { e.preventDefault(); this.toggleGuide(); return; }
      const go = e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter';
      if (st.dialog.length && go) { nextLine(); e.preventDefault(); return; }
      if (st.modal?.kind === 'press' && go) { this.pressHit(); e.preventDefault(); return; }
      if (st.modal?.kind === 'boon') return;
      if (st.modal && (e.code === 'Escape' || e.code === 'KeyE')) this.closeModal();
    });
    // ЛКМ по спелому подсолнуху рядом — сорвать
    addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || st.menu || st.dialog.length || st.modal) return;
      if ((e.target as HTMLElement).closest('button, #modal, #starsky, #hud')) return;
      const w = this.r.toWorld(e.clientX, e.clientY);
      clickWorld(w.x, w.y);
    });
    // текст листается кликом в любом месте экрана
    addEventListener('pointerdown', (e) => {
      if (!st.dialog.length || st.menu) return;
      if ((e.target as HTMLElement).closest('button, #modal, #starsky')) return;
      nextLine();
    });
    $('menu').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-m]');
      if (b) this.menuAction(b.dataset.m!);
    });
    const vol = $('vol') as HTMLInputElement;
    vol.value = String(Math.round(getVolume() * 100));
    vol.addEventListener('input', () => setVolume(Number(vol.value) / 100));
    const music = $('music') as HTMLInputElement;
    music.value = String(Math.round(getMusicVolume() * 100));
    music.addEventListener('input', () => setMusicVolume(Number(music.value) / 100));
    const mouse = $('mouse') as HTMLInputElement;
    mouse.addEventListener('input', () => { settings.mouse = Number(mouse.value) / 100; saveSettings(); this.showSettings(); });
    $('modal-close').addEventListener('click', () => this.closeModal());
    $('modal').addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      // дар из тайника надо выбрать — мимо окна не закрыть
      if (el.id === 'modal') return st.modal?.kind === 'boon' ? undefined : this.closeModal();
      const boon = el.closest<HTMLElement>('[data-boon]');
      if (boon) { chooseBoon(boon.dataset.boon as BoonId); return; }
      if (st.modal?.kind === 'press' && el.closest('.press')) return this.pressHit();
      const up = el.closest<HTMLElement>('[data-up]');
      if (up) { buy(up.dataset.up as UpId); this.renderModal(); }
      const go = el.closest<HTMLElement>('[data-start]');
      if (go) {
        const d = go.dataset.start as District;
        if (!districtOpen(d)) return;
        this.closeModal();
        startNight(d);
        return;
      }
      const q = el.closest<HTMLElement>('[data-claim]');
      if (q) { claim(q.dataset.claim!); this.renderModal(); }
    });
    $('skip').addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); skipCine(); });
    $('guide-btn').addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); this.toggleGuide(); });
  }

  openMenu(mode: 'main' | 'pause') {
    this.menuMode = mode;
    st.menu = true;
    // позади главного меню теперь картина-сцена (лес, солнце, дупло) — живой фон не нужен
    st.menuBackdrop = false;
    if (mode === 'main') this.scene.start(); else this.scene.stop();
    $('menu').hidden = false;
    $('menu').classList.toggle('pause', mode === 'pause');
    $('menu-title').textContent = mode === 'pause' ? 'Пауза' : 'Фонарщик';
    // в главном меню — пиксельный логотип, в паузе — просто надпись
    $('logo').hidden = mode === 'pause';
    $('menu-title').hidden = mode !== 'pause';
    $('menu-settings').hidden = true;
    const has = this.actions.hasGame();
    const items: [string, string][] = mode === 'pause'
      ? [['resume', 'Продолжить'], ...(st.hasJournal ? [['guide', 'Дневник']] as [string, string][] : []), ['settings', 'Настройки'], ['tomain', 'Главное меню'], ['quit', 'Выйти из игры']]
      : has
        ? [['resume', 'Продолжить'], ['new', 'Новая игра'], ['settings', 'Настройки'], ['credits', 'Титры'], ['quit', 'Выйти из игры']]
        : [['new', 'Начать игру'], ['settings', 'Настройки'], ['credits', 'Титры'], ['quit', 'Выйти из игры']];
    for (const id of ['menu-settings', 'menu-credits', 'menu-bye']) $(id).hidden = true;
    const list = $('menu-main');
    list.hidden = false;
    list.innerHTML = items.map(([m, t]) => `<button data-m="${m}">${t}</button>`).join('');
  }

  private showSettings() {
    $('quality').textContent = QUALITY_NAMES[settings.quality];
    ($('mouse') as HTMLInputElement).value = String(Math.round(settings.mouse * 100));
    $('mouse-val').textContent = `×${settings.mouse.toFixed(1)}`;
  }

  private closeMenu() {
    st.menu = false;
    st.menuBackdrop = false;
    this.scene.stop();
    $('menu').hidden = true;
    st.holdLock = true;
  }

  private menuAction(m: string) {
    if (m === 'resume') {
      const wasMain = this.menuMode === 'main';
      this.closeMenu();
      if (wasMain) this.actions.start();
    } else if (m === 'new') {
      // подтверждение прямо в меню: системное окно confirm() на сайтах с игрой (itch.io, VK Play) бывает заблокировано
      if (this.actions.hasGame()) {
        $('menu-main').innerHTML = '<div class="menu-ask">Начать заново? Весь прогресс пропадёт.</div>'
          + '<button data-m="new-yes">Да, начать заново</button><button data-m="new-no">Отмена</button>';
        return;
      }
      this.closeMenu();
      this.actions.newGame();
    } else if (m === 'new-yes') {
      this.closeMenu();
      this.actions.newGame();
    } else if (m === 'new-no') {
      this.openMenu(this.menuMode);
    } else if (m === 'guide') {
      this.closeMenu();
      st.modal = { kind: 'guide' };
    } else if (m === 'settings') {
      $('menu-main').hidden = true;
      $('menu-settings').hidden = false;
      this.showSettings();
    } else if (m === 'credits') {
      $('menu-main').hidden = true;
      $('menu-credits').hidden = false;
    } else if (m === 'quit') {
      // браузер не даёт игре закрыть вкладку сама (кроме открытой ею же) — тогда прощаемся экраном
      save();
      window.close();
      $('menu-main').hidden = true;
      $('menu-bye').hidden = false;
    } else if (m === 'quality') {
      const order: Quality[] = ['low', 'medium', 'high'];
      settings.quality = order[(order.indexOf(settings.quality) + 1) % order.length];
      saveSettings();
      this.showSettings();
    } else if (m === 'back') {
      $('menu-main').hidden = false;
      for (const id of ['menu-settings', 'menu-credits', 'menu-bye']) $(id).hidden = true;
    } else if (m === 'tomain') {
      save();
      this.openMenu('main');
    }
  }

  private toggleGuide() {
    if (st.dialog.length || st.cine || !st.hasJournal || st.modal?.kind === 'press') return;
    if (st.modal?.kind === 'guide') this.closeModal();
    else st.modal = { kind: 'guide' };
  }

  private closeModal() {
    if (st.modal?.kind === 'boon') return;
    this.press = null;
    st.modal = null;
    st.holdLock = true;
  }

  private toast(text: string) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.classList.add('fade'), 4500);
    setTimeout(() => el.remove(), 5200);
  }

  private renderModal() {
    const m = st.modal;
    if (!m || m.kind === 'sky') return;
    let title = '', sub = '', body = '';
    if (m.kind === 'shop') {
      const r = residentById(m.station as ResidentId);
      title = `${r.name} — ${r.station}`;
      sub = `«${this.greeting}»`;
      const items = UPGRADES.filter((u) => u.station === m.station);
      // всё, чему учит житель, — в его созвездии на небе; в лавке — только особые вещи
      const sky = `<div class="shop-sky">Мои уроки — на звёздном небе, в созвездии «${CONSTELLATIONS[r.id].name}». Посмотри в телескоп.</div>`;
      body = sky + items.map((u) => {
        const block = buyBlock(u);
        const maxed = st.up[u.id] >= u.max;
        const lvl = u.max > 1 ? `${st.up[u.id]}/${u.max}` : maxed ? '✓' : '';
        const price = maxed ? 'Куплено' : block && block !== 'Не хватает Света' ? block : `${fmt(cost(u))} Света`;
        return `<button class="upg${maxed ? ' maxed' : ''}" data-up="${u.id}" ${block ? 'disabled' : ''}>
          <div class="upg-top"><span>${u.name}</span><span class="upg-lvl">${lvl}</span></div>
          <div class="upg-desc">${u.desc}</div>
          <div class="upg-cost">${price}</div>
        </button>`;
      }).join('');
    } else if (m.kind === 'guide') {
      title = 'Дневник фонарщика';
      sub = 'Мои записи. Игра на паузе, закрыть — Esc или F1.';
      st.journalNew = false;
      const pages = JOURNAL.filter((p) => st.journal.includes(p.id));
      body = '<div class="journal">' + pages.map((g) => `<div class="guide"><h3 style="color:${g.color}">${g.title}</h3><p>${g.text}</p></div>`).join('');
      const left = JOURNAL.length - pages.length;
      if (left) body += `<div class="j-empty">Ещё ${left} ${left === 1 ? 'страница пуста' : left < 5 ? 'страницы пусты' : 'страниц пусты'}… Узнаю больше — допишу.</div>`;
      body += '</div>';
    } else if (m.kind === 'start') {
      title = 'Куда идти этой ночью?';
      sub = 'Маяк одного края открывает дорогу в следующий. Чем дальше — тем больше теней, но и Света.';
      body = DISTRICTS.map((d, i) => {
        const open = districtOpen(d), done = st.cleared.includes(d);
        const desc = open ? DISTRICT_INFO[d] : `Откроется, когда зажжёшь маяк: ${DISTRICT_NAMES[DISTRICTS[i - 1]]}`;
        return `<button class="upg" data-start="${d}" ${open ? '' : 'disabled'}>
          <div class="upg-top"><span>${DISTRICT_NAMES[d]}</span><span class="upg-lvl">${done ? '✓ маяк горит' : open ? '' : '🔒'}</span></div>
          <div class="upg-desc">${desc}</div></button>`;
      }).join('');
    } else if (m.kind === 'boon') {
      title = 'Тайник';
      sub = 'Внутри — три дара. Возьми один: он поможет до утра.';
      body = m.options.map((b) => `<button class="upg boon" data-boon="${b}" style="--c:${BOONS[b].color}">
          <div class="upg-top"><span>${BOONS[b].name}</span></div><div class="upg-desc">${BOONS[b].text}</div></button>`).join('');
    } else if (m.kind === 'press') {
      if (!this.press) this.press = this.newPress();
      title = 'Маслобойня';
      sub = 'Крути ворот! Жми E (или кликни), когда стрелка в золотой зоне. Чем точнее — тем больше масла.';
      body = `<div class="press">
        <div class="press-bar"><div class="press-zone"></div><div class="press-marker"></div></div>
        <div class="press-marks"></div>
        <div class="press-result"></div>
      </div>`;
    } else {
      title = 'Доска заказов';
      sub = 'Жители просят о помощи. Выполни за ночь — забери награду здесь.';
      const list = QUESTS.filter(questVisible);
      body = list.map((q) => {
        const s = questState(q);
        const action = s === 'done'
          ? `<button class="claim" data-claim="${q.id}">Забрать +${q.reward} Света</button>`
          : s === 'claimed' ? '<span class="q-done">✓ Выполнено</span>' : `<span class="q-open">Награда: ${q.reward} Света</span>`;
        return `<div class="quest ${s}"><div class="q-from">${q.from}</div><div class="q-text">${q.text}</div>${action}</div>`;
      }).join('');
      if (list.length < QUESTS.length) body += '<div class="q-more">Найди новых жителей — у них появятся свои просьбы.</div>';
    }
    $('modal-title').textContent = title;
    $('modal-sub').textContent = sub;
    $('modal-lumens').textContent = m.kind === 'guide' || m.kind === 'press' || m.kind === 'start' || m.kind === 'boon' ? '' : `Свет: ${fmt(st.lumens)}`;
    $('modal-close').hidden = m.kind === 'boon';
    $('modal-body').innerHTML = body;
    $('modal').classList.toggle('book', m.kind === 'guide');
    if (m.kind === 'press') this.drawPress();
  }

  // ---------- мини-игра на маслобойне ----------

  private newPress(): PressGame {
    return { round: 0, hits: 0, pos: 0, dir: 1, zone: 0.5, width: 0.2, marks: [], endT: 0 };
  }

  private nextZone(p: PressGame) {
    p.zone = 0.25 + Math.random() * 0.5;
    p.width = 0.2 - p.round * 0.035;
  }

  private pressHit() {
    const p = this.press;
    if (!p || p.round >= PRESS_ROUNDS) return;
    const hit = Math.abs(p.pos - p.zone) <= p.width / 2;
    if (hit) { p.hits++; pick(); } else out();
    p.marks.push(hit ? 'hit' : 'miss');
    p.round++;
    if (p.round >= PRESS_ROUNDS) p.endT = 1.1;
    else this.nextZone(p);
    this.drawPress();
  }

  private tickPress(dt: number) {
    const p = this.press;
    if (!p) return;
    if (p.round >= PRESS_ROUNDS) {
      p.endT -= dt;
      if (p.endT <= 0) { finishPress(0.6 + 0.25 * p.hits); this.closeModal(); }
      return;
    }
    const speed = 0.9 + 0.4 * p.round;
    p.pos += p.dir * speed * dt;
    if (p.pos > 1) { p.pos = 2 - p.pos; p.dir = -1; }
    if (p.pos < 0) { p.pos = -p.pos; p.dir = 1; }
    this.drawPress();
  }

  private drawPress() {
    const p = this.press;
    if (!p) return;
    const zone = document.querySelector<HTMLElement>('.press-zone');
    const marker = document.querySelector<HTMLElement>('.press-marker');
    if (!zone || !marker) return;
    zone.style.left = `${(p.zone - p.width / 2) * 100}%`;
    zone.style.width = `${p.width * 100}%`;
    marker.style.left = `${p.pos * 100}%`;
    document.querySelector('.press-marks')!.innerHTML = Array.from({ length: PRESS_ROUNDS }, (_, i) =>
      `<i class="${p.marks[i] ?? ''}"></i>`).join('');
    const res = document.querySelector('.press-result')!;
    res.textContent = p.round >= PRESS_ROUNDS
      ? `${['Ворот скрипит…', 'Неплохо!', 'Хорошо!', 'Отлично — масло так и льётся!'][p.hits]} Масла выйдет: ${Math.max(1, Math.round(st.seeds * (0.6 + 0.25 * p.hits)))}`
      : `Семечек: ${st.seeds}`;
  }

  frame(dt: number) {
    for (const e of st.events.splice(0)) this.toast(e);
    this.tickPress(dt);
    const night = st.scene === 'night';
    document.body.dataset.scene = st.scene;
    document.body.classList.toggle('cine', !!st.cine);
    document.body.classList.toggle('in-menu', st.menu);
    // музыка: в меню и мастерской — шкатулка, ночью — тихая ночная; в роликах — только звуки
    setMusic(st.menu || (st.scene === 'room' && !st.cine) ? 'menu' : st.scene === 'night' && !st.cine ? 'night' : null);

    // ролик: небо с солнцем, затемнение, кнопка «пропустить»
    const c = st.cine;
    // небо с солнцем: в ролике — как в сценарии, в главном меню — солнце слева
    $('sky').hidden = !c?.sky && !st.menuBackdrop;
    $('sky').dataset.state = c?.sky ?? (st.menuBackdrop ? 'menu' : '');
    $('skip').hidden = !c;
    if (st.worldVer !== this.worldVer) { this.worldVer = st.worldVer; this.nightFade = 1; }
    else this.nightFade = Math.max(0, this.nightFade - dt * 1.4);
    ($('fade') as HTMLElement).style.opacity = String(Math.max(c ? c.fade : 0, this.nightFade));

    // пузырь Искры
    const say = st.sparkSay;
    const bubble = $('bubble');
    bubble.hidden = !!c || say.t <= 0 || !!st.dialog.length || !!st.modal;
    if (!bubble.hidden) {
      bubble.textContent = say.text;
      const p = this.r.toCss(st.spark.x, st.spark.y, true);
      bubble.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - 40 * this.r.scale)}px) translate(-50%, -100%)`;
      bubble.style.opacity = String(Math.min(1, say.t * 2));
    }

    // диалог
    // реплика персонажа ролика — облачком над головой, остальное — в рамке снизу
    const line = st.dialog[0];
    const speaker = line?.actor && st.cine ? st.cine.actors.find((a) => a.id === line.actor) : undefined;
    $('talk').hidden = !speaker;
    if (speaker) {
      $('talk-who').textContent = line.who ?? '';
      $('talk-text').textContent = line.text;
      const p = this.r.toCss(speaker.x, speaker.y, speaker.kind === 'spark');
      const up = speaker.kind === 'villain' ? 54 : speaker.kind === 'spark' ? 26 : speaker.kind === 'sleeper' ? 16 : 36;
      // облачко не должно вылезать за край экрана
      const half = $('talk').offsetWidth / 2 + 8;
      const x = Math.min(innerWidth - half, Math.max(half, p.x));
      const y = Math.max($('talk').offsetHeight + 8, p.y - up * this.r.scale);
      $('talk').style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
      // хвостик смотрит на говорящего, даже если облачко прижато к краю
      const tail = Math.max(-half + 22, Math.min(half - 22, p.x - x));
      $('talk').style.setProperty('--tail', `${Math.round(tail)}px`);
    }
    document.body.classList.toggle('show-timer', line?.show === 'timer');
    // подсказка управления внизу — только в первую ночь
    $('keys').hidden = st.nights > 1;
    $('dialog').hidden = !line || !!speaker;
    if (line && !speaker) {
      $('dlg-who').textContent = line.who ?? '';
      $('dlg-who').hidden = !line.who;
      $('dlg-text').textContent = line.text;
    }

    // окно станции / доски
    const key = st.modal ? JSON.stringify(st.modal) : '';
    if (key !== this.modalKey) {
      this.modalKey = key;
      const isSky = st.modal?.kind === 'sky';
      $('modal').hidden = !st.modal || isSky;
      if (isSky) this.sky.open();
      else this.sky.close();
      if (st.modal?.kind === 'shop') {
        const chat = residentById(st.modal.station as ResidentId).chat;
        this.greeting = chat[Math.floor(Math.random() * chat.length)];
      }
      this.renderModal();
    }

    // таймер ночи
    $('timer').hidden = !night && !document.body.classList.contains('show-timer');
    if (night) {
      const k = st.lantern / st.lanternMax;
      ($('timer-fill') as HTMLElement).style.width = `${k * 100}%`;
      $('timer').classList.toggle('low', st.lantern < 10 && !st.inLampLight);
      $('timer').classList.toggle('rest', st.inLampLight);
      // стоишь в темноте — ночь замерла
      $('timer').classList.toggle('still', !st.inLampLight && st.flow === 0 && !st.nightOver && !st.cine);
      $('timer-text').textContent = String(Math.ceil(st.lantern));
    }
    $('goal').textContent = hint();
    ($('hit') as HTMLElement).style.opacity = String(st.hit);

    // подсказка над игроком и шкала удержания
    const a = currentAct();
    const pr = $('prompt');
    if (a) {
      const p = this.r.toCss(st.player.x, st.player.y);
      pr.hidden = false;
      pr.className = a.ok ? '' : 'no';
      pr.innerHTML = a.ok ? `<b>E</b> ${a.label}` : a.why ?? '';
      pr.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - 38 * this.r.scale)}px) translate(-50%, -100%)`;
    } else pr.hidden = true;
    const holding = st.hold.key !== '' && st.hold.time > 0.2;
    $('holdbar').classList.toggle('on', holding);
    ($('holdfill') as HTMLElement).style.width = `${holding ? Math.min(100, (st.hold.t / st.hold.time) * 100) : 0}%`;

    // цифры — 4 раза в секунду хватит
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;
    $('lumens').textContent = fmt(st.lumens);
    $('rate').textContent = night ? `+${fmt(lumenRate())}/с` : '';
    $('oil').textContent = fmt(st.oil);
    $('seeds').textContent = fmt(st.seeds);
    $('carry').textContent = fmt(st.carry);
    $('ready').hidden = night || readyQuests() === 0;
    $('guide-btn').hidden = !st.hasJournal;
    $('journal-new').hidden = !st.journalNew;
    if (st.modal?.kind === 'sky') this.sky.refresh();
    else if (st.modal && st.modal.kind !== 'press' && st.modal.kind !== 'boon') this.renderModal();
  }
}
