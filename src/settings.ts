// Настройки игрока: графика, чувствительность мыши. Хранятся в браузере.

export type Quality = 'low' | 'medium' | 'high';

const KEY = 'lamplighter-settings';

export const settings = {
  /** Низкая — без ореолов и мотыльков (для слабых компьютеров), средняя — без мотыльков, высокая — всё. */
  quality: 'high' as Quality,
  /** Чувствительность мыши на звёздном небе (перетаскивание и колёсико), 0.5–2. */
  mouse: 1,
};

try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { /* по умолчанию */ }

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ничего */ }
}

export const QUALITY_NAMES: Record<Quality, string> = { low: 'Низкая', medium: 'Средняя', high: 'Высокая' };
