// Картинки художника из папки art/: всё, что там лежит, подгружается само.
// Если картинки ещё нет — игра рисует заглушку кодом (draw.ts).

import { Assets, Texture } from 'pixi.js';

const urls = import.meta.glob('../art/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const tex: Record<string, Texture> = {};

export async function loadArt() {
  await Promise.all(Object.entries(urls).map(async ([path, url]) => {
    const name = path.slice(path.lastIndexOf('/') + 1, -4);
    try {
      const t = await Assets.load<Texture>(url);
      t.source.scaleMode = 'nearest';
      tex[name] = t;
    } catch (e) {
      console.warn('Не загрузилась картинка', name, e);
    }
  }));
}

/** Картинка по имени файла без .png (например, 'lamp_oil_on'), или undefined, если её ещё нет. */
export const art = (name: string): Texture | undefined => tex[name];
