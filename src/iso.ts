// Изометрия: тайл — ромб 32×16 пикселей.
// Логика игры живёт в «тайловых» координатах (x, y), рисование — в экранных.

export const TW = 32;
export const TH = 16;

/** Тайловые координаты → экранные (верхний угол ромба для целых x, y). */
export function toScreen(x: number, y: number) {
  return { x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) };
}

/** Направление на экране (WASD) → направление в тайлах. */
export function screenDirToTile(ix: number, iy: number) {
  return { x: ix + iy, y: iy - ix };
}

/** Полуоси эллипса, в который превращается круг радиуса r (в тайлах). */
export function isoEllipse(r: number) {
  return { rx: r * (TW / 2) * Math.SQRT2, ry: r * (TH / 2) * Math.SQRT2 };
}
