// Картинки художника из папки art/: всё, что там лежит, подгружается само.
// Если картинки ещё нет — игра рисует заглушку кодом (draw.ts).

import { Assets, Texture } from 'pixi.js';

// сначала образцы (art/examples/…), потом картинки художника — они заменяют образцы с тем же именем
const urls = {
  ...(import.meta.glob('../art/examples/lamps/*_{on,off}.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
  ...(import.meta.glob('../art/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
};
const tex: Record<string, Texture> = {};

export async function loadArt() {
  const loaded = await Promise.all(Object.entries(urls).map(async ([path, url]) => {
    const name = path.slice(path.lastIndexOf('/') + 1, -4);
    try {
      const t = await Assets.load<Texture>(url);
      t.source.scaleMode = 'nearest';
      return [name, t] as const;
    } catch (e) {
      console.warn('Не загрузилась картинка', name, e);
      return null;
    }
  }));
  for (const x of loaded) if (x) tex[x[0]] = x[1];
}

/** Картинка по имени файла без .png (например, 'lamp_oil_on'), или undefined, если её ещё нет. */
export const art = (name: string): Texture | undefined => tex[name];
