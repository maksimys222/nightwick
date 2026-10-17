# Фонарщик 24×32: стоит и идёт (4 кадра), смотрит вправо. Ноги — на строке 30, центр — столбцы 11–12.
# На плече — шест с огоньком (им зажигают фонари), в руке — ручной фонарь, на боку — сумка с маслом.
# Запуск: python -I tools/hero.py art/examples/hero
import os, struct, sys, zlib

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
rgb = lambda c: ((c >> 16) & 255, (c >> 8) & 255, c & 255)
W, H = 24, 32


def png(path, w, h, get):
    raw = b''.join(b'\x00' + b''.join(bytes(get(x, y)) for x in range(w)) for y in range(h))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


PAL = {
    'K': 0x1a1420,                               # контур
    'h': 0x262433, 'H': 0x4a4860, 'r': 0x9a3a2a,  # цилиндр и лента
    's': 0xf0c8a0, 'S': 0xc8946a, 'n': 0xe8a888,  # кожа, тень, румянец
    'a': 0x5a341a, 'A': 0x7a4a26,                # волосы и бакенбарды
    'e': 0x1a1420,                               # глаз
    'c': 0x2f3e6e, 'C': 0x4a5c98, 'd': 0x1f2a4c,  # пальто
    'b': 0xd8a84a,                               # пуговица
    'f': 0xd04a3a, 'F': 0x8a2a2a, 'g': 0xf07a5a,  # шарф
    't': 0x6a4422, 'T': 0xd8b050,                # ремень, пряжка
    'u': 0x9a6232, 'U': 0x5e3a1c,                # сумка с маслом
    'p': 0x34303e, 'P': 0x22202a,                # брюки
    'o': 0x3a2416, 'O': 0x6a4a30,                # сапоги, блик
    'q': 0x4a3a30,                               # перчатка
    'w': 0x9a7444, 'W': 0x5a4428,                # шест
    'm': 0x3a4060, 'y': 0xffd36b, 'Y': 0xfff4c8, 'i': 0xffa040,  # металл, огонь
}


class Grid:
    def __init__(s): s.g = [['.'] * W for _ in range(H)]
    def set(s, x, y, ch):
        if 0 <= x < W and 0 <= y < H: s.g[y][x] = ch
    def row(s, y, x0, text):
        for i, ch in enumerate(text):
            if ch != ' ': s.set(x0 + i, y, ch)


# ноги по кадрам: (x, строка) для строк 27–30
LEGS = {
    'stand': [(8, 'KppKppK'), (8, 'KppKppK'), (8, 'KooKooK'), (8, 'KOooKOooK')],
    'pass': [(8, 'KPPKppK'), (8, 'KPPKppK'), (8, 'KooKooK'), (8, 'KOooKOooK')],
    'step': [(8, 'KppKppK'), (7, 'KPPK KppK'), (6, 'KooK   KooK'), (5, 'KOooK  KOooK')],
}


def hero(frame, walk):
    G = Grid()
    legs = 'stand' if not walk else ('pass', 'step', 'pass', 'step')[frame]
    bob = 1 if walk and frame % 2 == 1 else 0      # в широком шаге тело ниже
    sway = (0, 1, 0, -1)[frame] if walk else 0     # качание фонаря и пол пальто
    u = lambda y: y + bob

    # шест за спиной: от плеча вверх-назад, на конце — крючок с огоньком
    for k in range(12):
        x, y = 9 - k // 2, u(15) - k
        G.set(x, y, 'w'); G.set(x - 1, y, 'W')
    tx, ty = 9 - 11 // 2, u(15) - 11            # верхушка шеста
    G.set(tx - 1, ty - 1, 'm'); G.set(tx - 2, ty - 1, 'm'); G.set(tx - 2, ty, 'm')  # крючок
    G.set(tx - 2, ty - 2, 'i'); G.set(tx - 2, ty - 3, 'y')                         # огонёк
    G.set(tx - 2, ty - 4, 'Y' if frame % 2 == 0 else 'i')

    # сумка с маслом на заднем боку
    G.row(u(19), 5, 'KKKK')
    G.row(u(20), 5, 'KuuUK')
    G.row(u(21), 5, 'KuTUK')
    G.row(u(22), 5, 'KuuUK')
    G.row(u(23), 5, 'KKKKK')

    # пальто: плечи, тело, полы (книзу шире)
    body = [  # (строка, x, текст)
        (15, 8, 'KCcccccdK'),
        (16, 8, 'KCcccccdK'),
        (17, 8, 'KCcccbcdK'),
        (18, 8, 'KCcccccdK'),
        (19, 8, 'KCcccbcdK'),
        (20, 8, 'KtttTttdK'),   # пояс с пряжкой
        (21, 8, 'KCcccccdK'),
        (22, 7, 'KCCcccdcdK'),
        (23, 7, 'KCcccdcddK'),
        (24, 7 - (sway < 0), 'KCcccdccddK'),
        (25, 6 - (sway < 0), 'KCCcccdcdddK'),
        (26, 6 - (sway < 0), 'KddddddKdddK'),
    ]
    for y, x, text in body:
        G.row(u(y), x, text)
    # ремень сумки через грудь (от плеча к бедру)
    for x, y in ((14, 15), (13, 16), (12, 17), (11, 18), (10, 19), (9, 20)):
        G.set(x, u(y), 't')

    # ноги
    for i, (x, text) in enumerate(LEGS[legs]):
        G.row(27 + i, x, text)

    # рука в перчатке и ручной фонарь
    for y in range(15, 21): G.row(u(y), 15, 'cdK')
    G.row(u(21), 15, 'qqK')
    lx = 14 + sway
    G.set(lx + 2, u(22), 'm')
    G.row(u(23), lx, 'KmmmK')
    G.row(u(24), lx, 'mYyym')
    G.row(u(25), lx, 'myyym')
    G.row(u(26), lx, 'KmmmK')

    # шарф, хвост развевается назад
    G.row(u(13), 9, 'KffffgK')
    G.row(u(14), 8, 'KFffffgK')
    G.row(u(14), 6, 'gf')
    G.row(u(15), 5 - (sway > 0), 'fF')
    G.set(5 - (sway > 0) - (sway != 0), u(16), 'F')

    # голова: бакенбарды сзади, глаз и нос справа
    G.row(u(9), 9, 'KaAssssK')
    G.row(u(10), 9, 'KaSssesK')
    G.row(u(11), 9, 'KaSsnsssK')
    G.row(u(12), 9, 'KaaSssSK')
    # цилиндр
    G.row(u(3), 9, 'KKKKKK')
    G.row(u(4), 9, 'KhhhHK')
    G.row(u(5), 9, 'KhhhHK')
    G.row(u(6), 9, 'KhhhHK')
    G.row(u(7), 9, 'KrrrrK')
    G.row(u(8), 7, 'KKhhhhhhKK')
    return G


def save(name, grids):
    w = W * len(grids)
    def get(x, y):
        ch = grids[x // W].g[y][x % W]
        return (*rgb(PAL[ch]), 255) if ch != '.' else (0, 0, 0, 0)
    png(os.path.join(OUT, name + '.png'), w, H, get)
    K = 8
    def big(X, Y):
        x, y = X // K, Y // K
        ch = grids[x // W].g[y][x % W]
        if ch != '.': return (*rgb(PAL[ch]), 255)
        return (205, 205, 210, 255) if (x // 2 + y // 2) % 2 else (230, 230, 235, 255)
    png(os.path.join(OUT, name + '_preview.png'), w * K, H * K, big)


save('hero_idle', [hero(0, False)])
save('hero_walk', [hero(i, True) for i in range(4)])
print('hero ok')
