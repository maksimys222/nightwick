// Фигура человечка: картинка художника (если есть) или заглушка, нарисованная кодом.

import { Container, Graphics, Sprite } from 'pixi.js';
import { drawPerson } from './draw';
import { heroTex } from './sprites';

export class Figure extends Container {
  /** Заглушка и тень под ногами. */
  readonly g = new Graphics();
  private pic = new Sprite();

  constructor() {
    super();
    this.addChild(this.g, this.pic);
  }

  /** Фонарщик. Смотрит вправо, влево — отражённая картинка. */
  hero(face: number, anim: number, moving: boolean, lantern: boolean) {
    const t = heroTex(moving, anim);
    this.g.clear();
    this.pic.visible = !!t;
    if (!t) { drawPerson(this.g, face, anim, moving, 0x2b3a67, true, lantern); return; }
    this.pic.texture = t;
    // ноги — на второй строке снизу (как в шаблоне): низ этой строки ставим в точку 0,0
    this.pic.anchor.set(0.5, (t.height - 1) / t.height);
    this.pic.scale.x = face < 0 ? -1 : 1;
    this.g.ellipse(0, 0, 5, 2).fill({ color: 0x000000, alpha: 0.35 });
  }

  /** Нарисовать что-то своё кодом (жители, Гаситель…). */
  graphics() {
    this.pic.visible = false;
    return this.g.clear();
  }
}
