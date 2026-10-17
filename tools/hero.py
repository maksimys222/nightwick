# Фонарщик: стоит (16×24) и идёт (4 кадра по 16×24), смотрит вправо. Ноги — на строке 22.
# Запуск: python -I tools/hero.py art/examples/hero
import os, struct, sys, zlib

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
rgb = lambda c: ((c >> 16) & 255, (c >> 8) & 255, c & 255)


def png(path, w, h, get):
    raw = b''.join(b'\x00' + b''.join(bytes(get(x, y)) for x in range(w)) for y in range(h))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


PAL = {
    'K': 0x1a1420,  # контур
    'h': 0x24222e, 'H': 0x403e52,  # цилиндр
    'r': 0x9a2e2a,  # лента на цилиндре
    's': 0xf0c8a0, 'S': 0xc8946a,  # кожа
    'a': 0x6b3e1a,  # волосы
    'e': 0x1a1420,  # глаз
    'c': 0x2b3a67, 'C': 0x3e5290, 'd': 0x1e2848,  # пальто
    'b': 0xd8a84a,  # пуговицы
    'f': 0xd04a3a, 'F': 0x8a2a2a,  # шарф
    'p': 0x2e2838, 'P': 0x1e1a26,  # брюки
    'o': 0x4a2c1a,  # сапоги
    'm': 0x2a3048, 'y': 0xffd36b, 'Y': 0xfff4c8,  # ручной фонарь
}


class Grid:
    def __init__(s, w, h): s.w, s.h, s.g = w, h, [['.'] * w for _ in range(h)]
    def row(s, y, x0, text):
        for i, ch in enumerate(text):
            if ch != ' ' and 0 <= x0 + i < s.w: s.g[y][x0 + i] = ch


LEGS = [
    [(5, "KpKpK"), (5, "KpKpK"), (5, "KoKoK"), (5, "KooKooK")],                       # ноги вместе
    [(5, "KpKpK"), (4, "KpK KpK"), (3, "KoK   KoK"), (3, "Koo   KooK")],               # шаг
    [(5, "KPKpK"), (5, "KPKpK"), (5, "KoKoK"), (5, "KooKooK")],                       # вместе, другая нога
    [(5, "KPKpK"), (4, "KPK KpK"), (3, "KoK   KoK"), (3, "Koo   KooK")],               # шаг другой ногой
]


def hero(frame, walk):
    G = Grid(16, 24)
    bob = 1 if walk and frame % 2 == 1 else 0  # в широком шаге тело чуть ниже
    u = lambda y: y + bob
    # цилиндр
    G.row(u(0), 5, 'KKKKK')
    G.row(u(1), 5, 'KhhHK')
    G.row(u(2), 5, 'KhhHK')
    G.row(u(3), 5, 'KrrrK')
    G.row(u(4), 3, 'KKKKKKKKK')
    # голова (смотрит вправо): волосы сзади, глаз и нос справа
    G.row(u(5), 5, 'KaaasK')
    G.row(u(6), 5, 'KassesK')
    G.row(u(7), 5, 'KaSsssK')
    G.row(u(8), 6, 'KSssK')
    # шарф, хвост развевается назад
    G.row(u(9), 5, 'KffffK')
    G.row(u(10), 2, 'fFKffFK')
    G.row(u(11), 2, 'F')
    # пальто: тело — столбцы 5–9, рука — 10
    G.row(u(10), 4, 'KffffFK')
    G.row(u(11), 4, 'KCcccdcK')
    G.row(u(12), 4, 'KCcbcdcK')
    G.row(u(13), 4, 'KCcccdcK')
    G.row(u(14), 4, 'KCcbcdcK')
    G.row(u(15), 4, 'KCcccdSK')
    G.row(u(16), 4, 'KCcccdKm')
    G.row(u(17), 4, 'KdCcdK')
    G.row(u(18), 4, 'KddddK')
    # ручной фонарь висит в руке и качается при ходьбе
    lx = 10 + ((0, 1, 0, -1)[frame] if walk else 0)
    G.row(u(17), lx, 'KmK')
    G.row(u(18), lx, 'mYm')
    G.row(u(19), lx, 'mym')
    G.row(u(20), lx, 'KmK')
    # ноги
    for i, (x, text) in enumerate(LEGS[frame if walk else 0]):
        G.row(19 + i, x, text)
    return G


def save(name, grids):
    w = 16 * len(grids)
    def get(x, y):
        ch = grids[x // 16].g[y][x % 16]
        return (*rgb(PAL[ch]), 255) if ch != '.' else (0, 0, 0, 0)
    png(os.path.join(OUT, name + '.png'), w, 24, get)
    K = 8
    def big(X, Y):
        x, y = X // K, Y // K
        ch = grids[x // 16].g[y][x % 16]
        if ch != '.': return (*rgb(PAL[ch]), 255)
        return (205, 205, 210, 255) if (x // 2 + y // 2) % 2 else (230, 230, 235, 255)
    png(os.path.join(OUT, name + '_preview.png'), w * K, 24 * K, big)


save('hero_idle', [hero(0, False)])
save('hero_walk', [hero(i, True) for i in range(4)])
print('hero ok')
