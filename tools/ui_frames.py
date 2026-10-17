# Пиксельные рамки интерфейса для CSS border-image (9 частей: углы, края, середина).
# panel — латунная рамка с заклёпками на тёмно-синем; paper — бумага в деревянной рамке; button / button_hover — кнопки с фаской.
# Запуск: python -I tools/ui_frames.py art/examples/ui
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import png, rgb

OUT = sys.argv[1]


def frame(name, n, layers, fill, rivet=None, light=None, shadow=None):
    """layers — цвета колец от края внутрь; light/shadow — верх-лево светлее, низ-право темнее (фаска)."""
    def get(x, y):
        d = min(x, y, n - 1 - x, n - 1 - y)
        if d < len(layers):
            c = layers[d]
            if light and d == 1 and (x == 1 or y == 1) and not (x == n - 2 or y == n - 2): c = light
            if shadow and d == 1 and (x == n - 2 or y == n - 2): c = shadow
            if rivet and d in (2, 3) and min(x, n - 1 - x) in (2, 3) and min(y, n - 1 - y) in (2, 3): c = rivet
            return (*rgb(c), 255)
        return fill
    png(os.path.join(OUT, name + '.png'), n, n, get)


# панель: тёмный контур, латунь (светлая сверху-слева, тёмная снизу-справа), тёмная кромка, полупрозрачная тёмно-синяя середина
frame('frame_panel', 24, [0x0a0814, 0xc8963e, 0x2a1e10], (16, 12, 32, 225), rivet=0xffe08a, light=0xf0c870, shadow=0x7a5420)
# бумага для диалогов: дерево по краю и тёплая бумага
frame('frame_paper', 24, [0x2a1608, 0x9a6230, 0x6a4020], (246, 234, 206, 255), light=0xc8884a, shadow=0x4a2a12)
# кнопки: фаска
frame('frame_button', 18, [0x0a0814, 0x4a3e6a, 0x2c2448], (34, 26, 56, 240), light=0x6a5a90, shadow=0x161026)
frame('frame_button_hover', 18, [0x0a0814, 0xc8963e, 0x5a4020], (58, 40, 24, 245), light=0xf0c870, shadow=0x7a5420)
print('frames ok')
