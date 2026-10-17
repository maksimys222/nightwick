// Фигура человечка: картинка художника (если есть) или заглушка, нарисованная кодом.

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { drawPerson, drawVillain, drawSleeper } from './draw';
import { art, charTex, frames, heroTex } from './sprites';

export class Figure extends Container {
  /** Заглушка и тень под ногами. */
  readonly g = new Graphics();
  private pic = new Sprite();

  constructor() {
    super();
    this.addChild(this.g, this.pic);
  }

  /** Фонарщик. Смотрит вправо, влево — отражённая картинка. */
  hero(face: number, anim: number, moving: boolean, lantern: boolean, lighting = false, time = 0) {
    const t = heroTex(moving, anim, lighting, time);
    if (!this.show(t, face)) drawPerson(this.g, face, anim, moving, 0x2b3a67, true, lantern);
  }

  /** Житель или помощник по имени картинки (agata, timofey…, helper). coat — цвет заглушки. */
  person(name: string, face: number, anim: number, moving: boolean, coat: number) {
    if (!this.show(charTex(name, moving, anim), face)) drawPerson(this.g, face, anim, moving, coat, false, false);
  }

  /** Гаситель: стоит (2 кадра) или колдует, подняв шест (2 кадра). */
  villain(face: number, t: number, cast: boolean) {
    const fr = frames(cast ? 'villain_cast' : 'villain_idle', 32);
    const tx = fr?.[Math.floor(t * (cast ? 8 : 1.5)) % fr.length];
    if (!this.show(tx, face, 8)) drawVillain(this.g, face, t, cast);
  }

  /** Спящий фонарщик из начального ролика. */
  sleeper() {
    if (!this.show(art('sleeper'), 1, 10)) drawSleeper(this.g);
  }

  /** Поставить картинку (если есть) с тенью под ногами. false — картинки нет, рисуй заглушку в g. */
  private show(t: Texture | undefined, face: number, shadow = 5) {
    this.g.clear();
    this.pic.visible = !!t;
    if (!t) return false;
    this.pic.texture = t;
    // ноги — на второй строке снизу (как в шаблоне): низ этой строки ставим в точку 0,0
    this.pic.anchor.set(0.5, (t.height - 1) / t.height);
    this.pic.scale.x = face < 0 ? -1 : 1;
    this.g.ellipse(0, 0, shadow, 2).fill({ color: 0x000000, alpha: 0.35 });
    return true;
  }

  /** Нарисовать что-то своё кодом (жители, Гаситель…). */
  graphics() {
    this.pic.visible = false;
    return this.g.clear();
  }
}
