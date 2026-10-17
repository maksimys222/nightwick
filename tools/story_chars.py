# Искра (12×12, 4 кадра взмаха крыльев), Гаситель (32×48: стоит — 2 кадра, колдует — 2 кадра),
# спящий фонарщик (32×16). Запуск: python -I tools/story_chars.py art/examples/story
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import Grid, save

OUT = sys.argv[1]

# ---------- Искра: светлячок 16×16 — светящееся брюшко, крылья с прожилками, усики, большие глаза ----------
SPARK = {'K': 0x2a1810, 'k': 0x5a3a28, 'h': 0x8a6a48, 'r': 0xe0603a, 'E': 0xff9a2a, 'Y': 0xffd860, 'W': 0xfffbe8,
         'e': 0x120a06, 'x': 0xffffff, 'w': 0xe4f2ff, 'v': 0x9ac0e8, 'g': 0xfff0b0}


def spark(frame):
    G = Grid(16, 16)
    # крылья: вверх — середина — вниз — середина (полупрозрачные, с прожилками)
    wing = [
        [(6, 1, 'wv'), (5, 2, 'wwwv'), (5, 3, 'wvwww'), (6, 4, 'wwvww'), (7, 5, 'wwww'), (8, 6, 'ww')],
        [(3, 4, 'vwww'), (2, 5, 'wwvwwww'), (4, 6, 'wwwvww')],
        [(4, 6, 'wwww'), (3, 7, 'wvwwww'), (4, 8, 'wwv')],
        [(3, 4, 'vwww'), (2, 5, 'wwvwwww'), (4, 6, 'wwwvww')],
    ][frame]
    # брюшко светится: кайма, середина, белое ядро (пульсирует)
    for y in range(16):
        for x in range(16):
            d = ((x - 4.5) / 3.6) ** 2 + ((y - 9.5) / 3.0) ** 2
            if d <= 1: G.set(x, y, 'E' if d > 0.62 else ('Y' if d > (0.22 if frame % 2 else 0.3) else 'W'))
    for x, y in ((2, 9), (3, 11)): G.set(x, y, 'g')   # блики
    # грудка с оранжевым щитком
    G.row(7, 7, 'rr'); G.row(8, 7, 'kkk'); G.row(9, 7, 'khk'); G.row(10, 8, 'k')
    # голова и большой глаз с бликом
    G.row(6, 10, 'kkk'); G.row(7, 10, 'kxek'); G.row(8, 10, 'keek'); G.row(9, 10, 'kkr')
    G.set(13, 8, 'k')
    # усики с огоньками на кончиках
    G.set(12, 5, 'k'); G.set(13, 4, 'k'); G.set(14, 3, 'k'); G.set(15, 2, 'Y')
    G.set(11, 5, 'k'); G.set(11, 4, 'k'); G.set(12, 3, 'k'); G.set(12, 2, 'Y')
    # лапки
    G.set(8, 11, 'k'); G.set(10, 11, 'k'); G.set(9, 11, 'K')
    for x, y, t in wing: G.row(y, x, t)
    return G


# ---------- Гаситель: высокий, в плаще с капюшоном, с гасильником на шесте ----------
VIL = {'K': 0x08050e, 'd': 0x150c24, 'c': 0x22163a, 'C': 0x33224e, 'L': 0x4a3270, 'i': 0x050308,
       'e': 0x8ad0ff, 'E': 0xf0fbff, 'g': 0x2e5a7e, 'h': 0xb8b4c8, 'H': 0x7a7690,
       'm': 0x6a6a7a, 'M': 0xa8a8b8, 'w': 0x4a3a2a, 'W': 0x6a5640,
       'q': 0x1a2030, 'Q': 0x3a4660, 'a': 0x6a3aa0, 'A': 0xa070e0, 's': 0x2a1e3e, 'S': 0x3e2e58}


def villain(frame, cast=False):
    G = Grid(32, 48)
    cx = 15
    flare = 2 if cast else 0
    # плащ со складками: светлый край слева, складки — пары светлое/тёмное
    for y in range(13, 45):
        k = (y - 13) / 31
        half = 5 + k * (7 + flare)
        x0, x1 = round(cx - half), round(cx + half)
        for x in range(x0, x1 + 1):
            rel = x - cx
            ch = 'c' if rel < 2 else 'd'
            if x == x0 + 1: ch = 'L'
            for fold in (-5, -1, 4, 8):
                f = round(fold * (0.6 + k * 0.6))
                if rel == f: ch = 'C' if rel < 2 else 'c'
                if rel == f + 1: ch = 'd' if rel < 2 else 'K'
            G.set(x, y, ch)
    # рваный подол: полосы разной длины, колышутся
    for x in range(cx - 14, cx + 15):
        if G.get(x, 44) == '.': continue
        cut = (x * 5 + frame * 2) % 5
        for y in range(44 - cut, 45): G.set(x, y, 'd' if cut < 3 else '.')
        if cut < 2: G.set(x, 45, 'd')
    # дым у подола — клочья уплывают
    for i in range(5):
        x = cx - 10 + i * 5 + (frame * 2 + i) % 3
        y = 46 - (i + frame) % 2
        G.set(x, y, 's'); G.set(x + 1, y, 'S' if i % 2 else 's')
    # накидка на плечах и застёжка
    G.row(13, cx - 6, 'KLCCccccddddK')
    G.row(14, cx - 7, 'KLCCcccccddddK')
    G.row(15, cx - 7, 'KLCcccccccdddK')
    G.row(16, cx - 6, 'KdddddddddddK')
    G.row(13, cx, 'mM')
    # цепь на поясе и погашенные фонари-трофеи
    for x in range(cx - 7, cx + 8): G.set(x, 25, 'm' if x % 2 else 'M')
    for lx in (cx - 7, cx - 3):
        G.set(lx + 1, 26, 'm')
        G.row(27, lx, 'KmK'); G.row(28, lx, 'qQq'); G.row(29, lx, 'Qqq'); G.row(30, lx, 'KmK')
    # капюшон: остроконечный, внутри — тьма, из неё смотрят глаза
    G.row(2, cx - 1, 'KK')
    G.row(3, cx - 2, 'KCcK')
    G.row(4, cx - 3, 'KLCccK')
    G.row(5, cx - 4, 'KLCCcddK')
    G.row(6, cx - 4, 'KLCKiiKdK')
    G.row(7, cx - 5, 'KLCKiiiiKdK')
    G.row(8, cx - 5, 'KLCiiiiiidK')
    G.row(9, cx - 5, 'KLCiiiiiidK')
    G.row(10, cx - 5, 'KLCKiiiiKdK')
    G.row(11, cx - 5, 'KLCCKiiKcdK')
    G.row(12, cx - 5, 'KLCCcccccdK')
    blink = frame == 1 and not cast
    if not blink:
        for ex in (cx - 1, cx + 2):
            G.set(ex, 8, 'E'); G.set(ex, 9, 'e')
            for gx, gy in ((ex - 1, 8), (ex + 1, 8), (ex, 7)):
                if G.get(gx, gy) == 'i': G.set(gx, gy, 'g')
        if cast:
            for ex in (cx - 1, cx + 2): G.set(ex, 7, 'e'); G.set(ex, 10, 'g')
    else:
        G.row(9, cx - 1, 'g'); G.set(cx + 2, 9, 'g')
    if cast:
        # шест поднят над головой, на гасильнике — тёмное сияние
        for k in range(24):
            x, y = cx + 5 + k // 3, 24 - k
            G.set(x, y, 'w'); G.set(x + 1, y, 'W') if k % 3 == 0 else None
        G.row(20, cx + 4, 'hH'); G.row(21, cx + 4, 'Hh')   # костлявая рука
        tx, ty = cx + 5 + 23 // 3, 1
        for x in range(tx - 6, tx + 7):
            for y in range(0, ty + 9):
                d = ((x - tx) ** 2 + (y - ty - 2) ** 2) ** 0.5
                if G.get(x, y) != '.': continue
                if 3.2 < d <= 4.3: G.set(x, y, 'a' if (x + y + frame) % 3 else 'A')
                elif 4.8 < d <= 5.6 and (x * 3 + y + frame * 2) % 4 == 0: G.set(x, y, 'A')
        G.row(ty, tx - 1, 'mMm'); G.row(ty + 1, tx - 2, 'mMMmm'); G.row(ty + 2, tx - 2, 'KKKKK')
    else:
        # шест в руке, на конце — колпачок-гасильник с заклёпкой и цепочкой
        for y in range(5, 47):
            G.set(cx + 9, y, 'w')
            if y % 6 == 0: G.set(cx + 9, y, 'W')
        G.row(1, cx + 8, 'mMm'); G.row(2, cx + 7, 'mMMMm'); G.row(3, cx + 6, 'mmMMmmm'); G.row(4, cx + 6, 'KKKKKKK')
        G.set(cx + 9, 2, 'E')
        G.set(cx + 6, 5, 'm'); G.set(cx + 6, 6, 'M'); G.set(cx + 6, 7, 'm')
        G.row(23, cx + 7, 'hHh'); G.row(24, cx + 7, 'HhH'); G.row(25, cx + 8, 'h')   # костлявые пальцы
    G.outline('K')
    return G


# ---------- спящий фонарщик (его находит Искра) ----------
SLEEP = {'K': 0x1a1420, 'h': 0x262433, 'H': 0x4a4860, 'r': 0x9a3a2a, 's': 0xf0c8a0, 'S': 0xc8946a,
         'c': 0x2f3e6e, 'C': 0x4a5c98, 'd': 0x1f2a4c, 'f': 0xd04a3a, 'p': 0x34303e, 'o': 0x3a2416,
         'w': 0x9a7444, 'z': 0xe8f0ff}


def sleeper():
    G = Grid(32, 16)
    # лежит на спине, цилиндр съехал на лицо, шест рядом
    G.row(14, 2, 'w' * 26)
    G.row(9, 4, 'ooppppp')
    G.row(10, 3, 'oopppppp')
    G.row(9, 11, 'cCCcccccd')
    G.row(10, 11, 'cCcccccdd')
    G.row(11, 9, 'ddcccccccdd')
    G.row(8, 13, 'CCccc')
    G.row(9, 20, 'ff')
    G.row(10, 20, 'ff')
    G.row(9, 22, 'ssS')
    G.row(10, 22, 'sss')
    G.row(11, 22, 'SS')
    G.row(7, 23, 'hhhh')
    G.row(8, 22, 'hhhHh')
    G.row(9, 25, 'hhr')
    G.row(10, 25, 'hhr')
    G.row(11, 24, 'hhh')
    G.outline('K')
    G.row(3, 26, 'z'); G.row(1, 28, 'zz'); G.row(0, 30, 'z')  # Zz…
    return G


if __name__ == '__main__':
    save(OUT, 'spark', [spark(i) for i in range(4)], SPARK, preview=12)
    save(OUT, 'villain_idle', [villain(i) for i in range(2)], VIL)
    save(OUT, 'villain_cast', [villain(i, True) for i in range(2)], VIL)
    save(OUT, 'sleeper', [sleeper()], SLEEP)
    print('story ok')
