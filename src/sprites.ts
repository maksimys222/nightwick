// Картинки художника из папки art/: всё, что там лежит, подгружается само.
// Если картинки ещё нет — игра рисует заглушку кодом (draw.ts).

import { Assets, Rectangle, Texture } from 'pixi.js';

// сначала образцы (art/examples/…), потом картинки художника — они заменяют образцы с тем же именем
const urls = {
  ...(import.meta.glob('../art/examples/lamps/*_{on,off}.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
  ...(import.meta.glob('../art/examples/hero/hero_{idle,walk,light}.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
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

const strips: Record<string, Texture[]> = {};

/** Лента кадров (кадры в ряд слева направо) → отдельные кадры шириной w. */
export function frames(name: string, w: number): Texture[] | undefined {
  if (strips[name]) return strips[name];
  const t = tex[name];
  if (!t) return undefined;
  const n = Math.max(1, Math.floor(t.width / w));
  strips[name] = Array.from({ length: n }, (_, i) => new Texture({ source: t.source, frame: new Rectangle(i * w, 0, w, t.height) }));
  return strips[name];
}

/** Кадр фонарщика: стоит, идёт (4 кадра шага) или зажигает фонарь шестом (2 кадра). */
export function heroTex(moving: boolean, anim: number, lighting = false, t = 0): Texture | undefined {
  const idle = tex.hero_idle;
  const w = idle?.width ?? 24;
  const light = lighting ? frames('hero_light', w) : undefined;
  if (light) return light[Math.floor(t * 8) % light.length];
  const walk = frames('hero_walk', w);
  if (moving && walk) return walk[Math.floor(anim * 8) % walk.length];
  return idle ?? walk?.[0];
}
