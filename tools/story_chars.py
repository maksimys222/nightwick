# Искра (12×12, 4 кадра взмаха крыльев), Гаситель (32×48: стоит — 2 кадра, колдует — 2 кадра),
# спящий фонарщик (32×16). Запуск: python -I tools/story_chars.py art/examples/story
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import Grid, save

OUT = sys.argv[1]

# ---------- Искра: живой огонёк с крылышками ----------
SPARK = {'K': 0x6a3a10, 'E': 0xffa030, 'Y': 0xffe08a, 'W': 0xfff8e0, 'e': 0x3a2010, 'w': 0xd8ecff, 'v': 0xa8c8f0,
         'n': 0xff8a7a}


def spark(frame):
    G = Grid(12, 12)
    # крылышки: вверх — середина — вниз — середина
    wings = [
        [(2, 2, 'vw'), (1, 3, 'vww'), (2, 4, 'ww'), (8, 2, 'wv'), (8, 3, 'wwv'), (8, 4, 'ww')],
        [(1, 4, 'vww'), (1, 5, 'vww'), (8, 4, 'wwv'), (8, 5, 'wwv')],
        [(1, 6, 'vww'), (2, 7, 'vw'), (8, 6, 'wwv'), (8, 7, 'wv')],
        [(1, 4, 'vww'), (1, 5, 'vww'), (8, 4, 'wwv'), (8, 5, 'wwv')],
    ][frame]
    for x, y, t in wings: G.row(y, x, t)
    # тельце: оранжевая кайма, жёлтая середина, белое ядро
    G.row(3, 5, 'EE')
    G.row(4, 4, 'EYYE')
    G.row(5, 3, 'EYWWYE')
    G.row(6, 3, 'EYeWeE')   # глазки
    G.row(7, 3, 'EnWWnE')   # щёчки
    G.row(8, 4, 'EYYE')
    G.row(9, 5, 'EE')
    # усики
    G.set(4, 2, 'E'); G.set(3, 1, 'Y'); G.set(7, 2, 'E'); G.set(8, 1, 'Y')
    return G


# ---------- Гаситель: высокий, в плаще с капюшоном, с гасильником на шесте ----------
VIL = {'K': 0x0a0612, 'd': 0x140c22, 'c': 0x22163a, 'C': 0x34224e, 'L': 0x4a3270, 'i': 0x07040c,
       'e': 0x8ad0ff, 'E': 0xe8f8ff, 'h': 0xa8a8bc, 'm': 0x6a6a7a, 'M': 0x9a9aaa, 'w': 0x4a3a2a,
       'a': 0x6a3aa0, 'A': 0x9a6ad0, 's': 0x2a1e3e}


def villain(frame, cast=False):
    G = Grid(32, 48)
    cx = 15
    # плащ: от плеч книзу шире, низ рваный
    for y in range(13, 45):
        k = (y - 13) / 31
        half = 5 + k * (7 + (2 if cast else 0))
        x0, x1 = round(cx - half), round(cx + half)
        for x in range(x0, x1 + 1):
            ch = 'L' if x == x0 + 1 else ('C' if x < cx - 1 else ('c' if x < cx + 3 else 'd'))
            G.set(x, y, ch)
        G.set(cx + 1, y, 'i' if y > 20 else G.get(cx + 1, y))  # тёмный разрез плаща
    # рваный низ, колышется
    for x in range(cx - 13, cx + 14):
        cut = (x * 7 + frame * 3) % 4
        for y in range(44 - cut, 47):
            if G.get(x, y) != '.' or y >= 44: G.set(x, y, 'd' if y < 45 else '.')
        if (x + frame) % 3 == 0: G.set(x, 45, 's')
    # капюшон и пустота внутри, где горят глаза
    G.row(3, cx - 2, 'KKKKK')
    G.row(4, cx - 3, 'KCCccdK')
    G.row(5, cx - 4, 'KLCCccddK')
    G.row(6, cx - 4, 'KLCiiicdK')
    G.row(7, cx - 5, 'KLCiiiiicdK')
    G.row(8, cx - 5, 'KLCiiiiicdK')
    G.row(9, cx - 5, 'KLCiiiiicdK')
    G.row(10, cx - 5, 'KLCCiiiccdK')
    G.row(11, cx - 5, 'KLCCCcccddK')
    G.row(12, cx - 5, 'KCCCccccddK')
    blink = frame == 1 and not cast
    eye = 'i' if blink else 'e'
    G.set(cx, 8, eye); G.set(cx + 2, 8, eye)
    if not blink: G.set(cx, 7, 'E'); G.set(cx + 2, 7, 'E')
    if cast:
        # шест поднят над головой, на колпачке — тёмное сияние
        for k in range(26):
            x, y = cx + 4 + k // 3, 26 - k
            if 0 <= y: G.set(x, y, 'w')
        G.row(19, cx + 3, 'hh'); G.row(20, cx + 4, 'h')   # рука
        tx, ty = cx + 4 + 25 // 3, 1
        ring = (('a', 'A') if frame == 0 else ('A', 'a'))
        for x in range(tx - 4, tx + 5):
            for y in range(max(0, ty - 1), ty + 7):
                d = ((x - tx) ** 2 + (y - ty - 2) ** 2) ** 0.5
                if 3 < d <= 4.2 and G.get(x, y) == '.': G.set(x, y, ring[0])
                elif 4.2 < d <= 5 and (x + y + frame) % 2 == 0 and G.get(x, y) == '.': G.set(x, y, ring[1])
        G.row(ty, tx - 1, 'mMm'); G.row(ty + 1, tx - 2, 'mMMmm'); G.row(ty + 2, tx - 2, 'KKKKK')
    else:
        # шест в руке, на конце — колпачок-гасильник
        for y in range(4, 47): G.set(cx + 9, y, 'w')
        G.row(2, cx + 8, 'mMm'); G.row(3, cx + 7, 'mMMMm'); G.row(4, cx + 7, 'KKKKK')
        G.row(24, cx + 7, 'hhh'); G.row(25, cx + 7, 'hh')  # бледная рука на шесте
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
