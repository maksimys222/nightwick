# Фонари: образцы (горит / не горит), превью и схемы по клеткам.
# Запуск: python -I tools/lamps.py art/examples/lamps
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


class C:
    def __init__(s, w, h): s.w, s.h, s.px = w, h, {}
    def set(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[(x, y)] = c
    def rect(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.set(x + i, y + j, c)
    def row(s, y, x0, x1, c):
        for x in range(x0, x1 + 1): s.set(x, y, c)


MD, MM, ML = 0x161622, 0x2a3048, 0x46507a       # металл: тень, основной, блик
WARM = 0x7a5640                                  # металл в отсвете огня
MOON = 0x8aa4d0                                  # отблеск луны на холодном стекле
GLASS = {  # кайма, середина, ядро, тёмное стекло, тёмное стекло снизу
    'oil': (0xff9a2a, 0xffd36b, 0xfff6d8, 0x2b2b3a, 0x22222e),
    'gas': (0x5a9aff, 0xb8e0ff, 0xffffff, 0x2a3a5a, 0x1e2c48),
    'stubborn': (0xff4a2a, 0xff8a6a, 0xffe2c8, 0x4a2020, 0x3a1818),
    'marsh': (0x2ac868, 0x9affb0, 0xeafff0, 0x1e3a28, 0x16301f),
    'beacon': (0xffc040, 0xfff0b0, 0xffffff, 0x3a3a44, 0x2e2e38),
}


def glass(c, cells, kind, on):
    """cells — множество пикселей стекла. Кайма — пиксели у края, ядро — 2×3 в центре, чуть ниже середины."""
    edge, mid, core, off, off2 = GLASS[kind]
    xs = [x for x, _ in cells]; ys = [y for _, y in cells]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    for (x, y) in cells:
        border = any((x + dx, y + dy) not in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if on:
            col = edge if border else mid
            if abs(x - cx) <= 0.6 and 0 <= y - cy + 0.5 <= 2.5: col = core
        else:
            col = off2 if y > cy else off
        c.set(x, y, col)
    if on:
        c.set(round(cx - 0.5), round(cy - 1), 0xffffff)  # язычок пламени
    else:  # косой блик луны
        c.set(min(xs) + 1, min(ys) + 2, MOON); c.set(min(xs) + 2, min(ys) + 1, MOON)


def lit_frame(c, cells, on):
    """Металл, который касается стекла, в отсвете огня — тёплый."""
    if not on: return
    for (x, y) in cells:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q in c.px and q not in cells and c.px[q] in (MD, MM, ML):
                c.px[q] = WARM


def box(x0, y0, x1, y1):
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}


def post(c, x, y0, y1, color=MM, light=ML, dark=MD):
    for y in range(y0, y1 + 1):
        c.set(x, y, light); c.set(x + 1, y, dark)


def oil(on, kind='oil'):
    c = C(16, 40)
    # основание
    c.row(38, 5, 10, MD); c.row(37, 5, 10, MM); c.set(5, 37, ML); c.row(36, 6, 9, MM); c.set(6, 36, ML)
    post(c, 7, 20, 35)
    c.row(27, 6, 9, MM); c.set(6, 27, ML); c.set(9, 27, MD)  # колечко
    c.row(19, 6, 9, MM); c.row(18, 5, 10, MD)
    # корпус фонаря и стекло 6×7 (центр — строка 14)
    for y in range(10, 18): c.set(4, y, ML); c.set(11, y, MD)
    c.row(10, 4, 11, MM)
    g = box(5, 11, 10, 17)
    c.rect(5, 11, 6, 7, MM)
    if kind == 'stubborn':  # ставни от ветра
        for y in range(10, 19): c.set(2, y, 0x8a4a2a); c.set(3, y, 0x6a3020); c.set(12, y, 0x6a3020); c.set(13, y, 0x4a2418)
        c.set(2, 14, 0xb0683a)
    # крыша
    for i, (a, b) in enumerate([(3, 12), (4, 11), (5, 10), (6, 9), (7, 8)]):
        c.row(9 - i, a, b, MM); c.set(a, 9 - i, ML); c.set(b, 9 - i, MD)
    c.set(7, 3, MM); c.set(8, 3, MD)
    if on: c.row(9, 4, 11, WARM)  # низ крыши подсвечен снизу
    glass(c, g, kind, on)
    lit_frame(c, g, on)
    return c


def gas(on):
    c = C(16, 40)
    c.row(38, 4, 11, MD); c.row(37, 4, 11, MM); c.set(4, 37, ML); c.row(36, 5, 10, MM); c.set(5, 36, ML); c.row(35, 6, 9, MM)
    post(c, 7, 18, 34)
    for y in (24, 30): c.row(y, 6, 9, MM); c.set(6, y, ML); c.set(9, y, MD)
    c.set(5, 23, ML); c.set(10, 23, MD); c.set(5, 29, ML); c.set(10, 29, MD)  # завитки
    c.row(17, 5, 10, MD); c.row(16, 4, 11, MM)
    # плафон-трапеция: шире сверху (центр — строка 12)
    g = set()
    for y in range(8, 16):
        w = 4 if y < 12 else (3 if y < 15 else 2)
        for x in range(8 - w, 8 + w): g.add((x, y))
    for (x, y) in g: c.set(x, y, MM)
    for y in range(8, 16):
        xs = [x for x, yy in g if yy == y]
        c.set(min(xs) - 1, y, ML); c.set(max(xs) + 1, y, MD)
    c.row(7, 2, 13, MM); c.set(2, 7, ML); c.set(13, 7, MD)
    for i, (a, b) in enumerate([(3, 12), (5, 10), (6, 9)]):
        c.row(6 - i, a, b, MM); c.set(a, 6 - i, ML)
    c.set(7, 3, ML); c.set(8, 3, MM); c.set(7, 2, MM)
    if on: c.row(7, 3, 12, WARM)
    glass(c, g, 'gas', on)
    lit_frame(c, g, on)
    return c


def marsh(on):
    c = C(16, 40)
    W1, W2, W3 = 0x7a6238, 0x5a4a2a, 0x3e3220
    # кривой шест
    pts = [(8, 38), (8, 37), (8, 36), (9, 35), (9, 34), (9, 33), (9, 32), (8, 31), (8, 30), (7, 29), (7, 28),
           (7, 27), (7, 26), (8, 25), (8, 24), (8, 23), (7, 22)]
    for x, y in pts: c.set(x - 1, y, W1); c.set(x, y, W2)
    c.set(6, 38, W3); c.set(9, 38, W3)
    c.set(10, 32, W2); c.set(11, 31, W2); c.set(12, 31, 0x3a7a3a); c.set(12, 30, 0x5aaa4a)  # сучок с листиком
    c.set(5, 27, 0x3a7a3a); c.set(4, 26, 0x5aaa4a)
    # шар (центр — строка 17)
    g = {(x, y) for x in range(3, 13) for y in range(12, 22) if (x - 7.5) ** 2 + (y - 17) ** 2 <= 12.5}
    glass(c, g, 'marsh', on)
    # оплётка из прутьев поверх шара
    for y in range(13, 22, 3):
        for x in range(4, 12):
            if (x, y) in g and (x + y) % 3 == 0: c.set(x, y, W3 if not on else 0x6a5a30)
    c.set(7, 12, W2); c.set(8, 12, W2); c.set(7, 11, W3)
    return c


def tower(w, h, ground, top, width_bottom, width_top, stripes):
    c = C(w, h)
    cx = w / 2
    for y in range(top, ground + 1):
        k = (y - top) / (ground - top)
        half = (width_top + (width_bottom - width_top) * k) / 2
        x0, x1 = round(cx - half), round(cx + half) - 1
        for x in range(x0, x1 + 1):
            if stripes:
                base = (0xc83a32, 0xa02c26) if ((ground - y) // 9) % 2 else (0xf0e8e0, 0xc8beb4)
            else:
                base = (0x9a9088, 0x6e665e) if (y % 6) else (0x5a524a, 0x4a443c)
            col = base[0] if x < cx else base[1]
            if x == x0: col = 0xffffff if stripes and base[0] == 0xf0e8e0 else (0xb4aaa0 if not stripes else col)
            c.set(x, y, col)
    return c


def beacon(on, tall=False):
    if tall:
        w, h, ground, gy = 24, 72, 70, 12
        c = tower(w, h, ground, 19, 16, 10, True)
    else:
        w, h, ground, gy = 20, 56, 54, 14
        c = tower(w, h, ground, 21, 14, 10, False)
    cx = w // 2
    # балкончик с перилами
    c.row(gy + 6, cx - 7, cx + 6, MM); c.set(cx - 7, gy + 6, ML); c.set(cx + 6, gy + 6, MD)
    c.row(gy + 7, cx - 6, cx + 5, MD)
    for x in range(cx - 7, cx + 7, 2): c.set(x, gy + 5, MM)
    # фонарная комната: рамка и стекло
    g = box(cx - 3, gy - 3, cx + 2, gy + 3)
    c.rect(cx - 4, gy - 4, 8, 9, MM)
    for y in range(gy - 4, gy + 5): c.set(cx - 4, y, ML); c.set(cx + 3, y, MD)
    glass(c, g, 'beacon', on)
    for y in range(gy - 3, gy + 4): c.set(cx, y, MM if not on else WARM)  # переплёт
    lit_frame(c, g, on)
    # купол
    for i, (a, b) in enumerate([(cx - 5, cx + 4), (cx - 4, cx + 3), (cx - 3, cx + 2), (cx - 1, cx)]):
        c.row(gy - 5 - i, a, b, MM); c.set(a, gy - 5 - i, ML); c.set(b, gy - 5 - i, MD)
    c.set(cx - 1, gy - 9, MM); c.set(cx - 1, gy - 10, ML)
    if on: c.row(gy - 5, cx - 4, cx + 3, WARM)
    # дверь
    c.rect(cx - 2, ground - 5, 3, 5, 0x5a3018); c.set(cx - 2, ground - 5, 0x8a5a32)
    return c


# ---------- реалистичные фонари: нарисованы по пикселям ----------
# Каждый символ — один пиксель. Фонарь изометрический: видны две грани стекла (левая и правая),
# между ними угловая стойка; внутри пламя и горелка. Под фонарём — перекладина для лестницы фонарщика.

NAMES = {  # символ: (цвет, название для схемы)
    '.': (None, ''),
    'K': (0x12121c, 'металл: самый тёмный, контур'),
    'D': (0x1f2232, 'металл в тени'),
    'M': (0x2e3450, 'металл'),
    'L': (0x4a5680, 'металл на свету'),
    'H': (0x7a8ab8, 'блик на металле'),
    'a': (0x5a4038, 'металл у огня, тень'),
    'b': (0x8a6040, 'металл у огня'),
    'c': (0xc89050, 'металл у огня, ярко'),
    'E': (0xff8a20, 'стекло: край'),
    'Y': (0xffc850, 'стекло: середина'),
    'P': (0xffe9a0, 'стекло у пламени'),
    'W': (0xffffff, 'пламя'),
    'B': (0x8a5a2a, 'горелка, тень'),
    'C': (0xc08a3a, 'горелка'),
    'u': (0x4a3a2a, 'горелка без огня'),
    'g': (0x2a3250, 'тёмное стекло'),
    'f': (0x1c2236, 'тёмное стекло, низ'),
    'r': (0x9ab4e0, 'отблеск луны'),
    's': (0x4a5a88, 'отблеск луны, слабый'),
    'o': (0x9a5a32, 'ставня на свету'),
    'n': (0x5a2a18, 'ставня в тени'),
}

# свой цвет огня у газового и упрямого
GAS = {'E': 0x3a7aff, 'Y': 0x8ac0ff, 'P': 0xd0ecff, 'a': 0x34405a, 'b': 0x4a6090, 'c': 0x8ab0e8, 'B': 0x8a96a8, 'C': 0xe8eef8}
RED = {'E': 0xff3a1a, 'Y': 0xff7a50, 'P': 0xffc4a0, 'a': 0x5a3030, 'b': 0x8a4a3a, 'c': 0xc87050}

GLASS_ON = [
    "..bEEEEcbEEEEa..",
    "..bEYYPcbPYYEa..",
    "..bEYPPcbPPYEa..",
    "..bEYPWcbWPYEa..",
    "..bEPWWcbWWPEa..",
    "..bEPWWcbWWPEa..",
    "..bEYPWcbWPYEa..",
    "..bEYYPcbPYYEa..",
    "..bECCBcbBCCEa..",
]
GLASS_OFF = [
    "..LggggMDggggD..",
    "..LgrsgMDgsggD..",
    "..LrsggMDsgggD..",
    "..LsgggMDgggfD..",
    "..LgggfMDggffD..",
    "..LggffMDgfffD..",
    "..LgfffMDffffD..",
    "..LffffMDffffD..",
    "..LfuufMDfuufD..",
]
FRAME_ON, FRAME_OFF = "..KbbbbbaaaaaK..", "..KMMMMMDDDDDK.."
EAVE_ON, EAVE_OFF = ".KbbbbbbaaaaaaK.", ".KMMMMMMDDDDDDK."

POST = [  # столб от перекладины до земли (строки 21–38)
    "...HLLMMMDDDK...",  # перекладина для лестницы
    "......LMDD......",
    ".......LD.......",
    ".......LD.......",
    ".......LD.......",
    "......HLMD......",  # колечко
    ".......LD.......",
    ".......LD.......",
    ".......LD.......",
    ".......LD.......",
    ".......LD.......",
    "......LMDD......",
    ".....LLMDDD.....",
    ".....LMMDDK.....",
    "....LLMMDDDK....",
    "...HLLLMMDDDK...",
    "...LMMMMDDDDK...",
    "...KMMMMDDDDK...",
    "................",
]


def oil_rows(on):
    return ([
        "................",
        ".......HM.......",
        "......LMMD......",
        ".......MD.......",
        "......LMMD......",
        ".....LMMMDD.....",
        "....LLMMMDDD....",
        "...LLMMMMDDDK...",
        EAVE_ON if on else EAVE_OFF,
        FRAME_ON if on else FRAME_OFF,
    ] + (GLASS_ON if on else GLASS_OFF) + [
        FRAME_ON if on else FRAME_OFF,
        ".....LMMMDD.....",
    ] + POST)


def gas_rows(on):
    rows = [
        ".......HM.......",
        ".......MD.......",
        "......LMMD......",
        "....LLMMMDDD....",
        "...LLMMMMDDDK...",
        "..LLLMMMMDDDDK..",
        EAVE_ON if on else EAVE_OFF,
        FRAME_ON if on else FRAME_OFF,
    ] + (GLASS_ON if on else GLASS_OFF) + [
        FRAME_ON if on else FRAME_OFF,
        "...KLMMMMDDDK...",
        ".....LMMMDD.....",
        "......LMDD......",
    ] + POST
    # завитки-украшения на столбе газового фонаря
    rows[24] = "....H.HLMD.D...."
    rows[25] = ".....H.LD.D....."
    return rows[:40]


def stubborn_rows(on):
    rows = oil_rows(on)
    for y in range(9, 20):  # ставни от ветра по бокам
        r = list(rows[y])
        r[0], r[1], r[14], r[15] = 'o', 'n', 'n', 'n'
        rows[y] = ''.join(r)
    return rows


def from_rows(rows, over=None):
    assert len(rows) == 40, len(rows)
    c = C(16, 40)
    for y, r in enumerate(rows):
        assert len(r) == 16, (y, r)
        for x, ch in enumerate(r):
            col = (over or {}).get(ch, NAMES[ch][0])
            if col is not None:
                c.set(x, y, col)
    return c


COLOR_NAMES = {v[0]: v[1] for v in NAMES.values() if v[0] is not None}
for over in (GAS, RED):
    for ch, col in over.items():
        COLOR_NAMES.setdefault(col, NAMES[ch][1])
COLOR_NAMES.update({MD: 'металл в тени', MM: 'металл', ML: 'металл на свету', WARM: 'металл у огня', MOON: 'отблеск луны'})

oil = lambda on: from_rows(oil_rows(on))
gas = lambda on: from_rows(gas_rows(on), GAS if on else None)
ITEMS = [
    ('lamp_oil', oil), ('lamp_gas', gas), ('lamp_stubborn', lambda on: from_rows(stubborn_rows(on), RED if on else None)),
    ('lamp_marsh', marsh), ('beacon', beacon), ('lighthouse', lambda on: beacon(on, True)),
]

sheets = []
for name, fn in ITEMS:
    for on in (True, False):
        cv = fn(on)
        png(os.path.join(OUT, f'{name}_{"on" if on else "off"}.png'), cv.w, cv.h,
            lambda x, y, cv=cv: (*rgb(cv.px[(x, y)]), 255) if (x, y) in cv.px else (0, 0, 0, 0))
        sheets.append(cv)

# превью: все фонари в ряд на ночном фоне, ×6
K, GAP = 6, 4
H = max(s.h for s in sheets)
Wt = sum(s.w for s in sheets) + GAP * (len(sheets) + 1)
cols = []
x = GAP
for s in sheets:
    cols.append((x, s)); x += s.w + GAP


def get(X, Y):
    x, y = X // K, Y // K
    for x0, s in cols:
        if x0 <= x < x0 + s.w:
            yy = y - (H - s.h)
            if (x - x0, yy) in s.px: return (*rgb(s.px[(x - x0, yy)]), 255)
    return (24, 28, 52, 255) if (x // 2 + y // 2) % 2 else (30, 34, 62, 255)


png(os.path.join(OUT, 'lamps_example_preview.png'), Wt * K, H * K, get)
print('ok')


# ---------- схемы по клеткам (SVG): как раскраска по номерам ----------
GLASS_ROW = {'lamp_oil': 14, 'lamp_gas': 12, 'lamp_stubborn': 14, 'lamp_marsh': 17, 'beacon': 14, 'lighthouse': 12}
TITLES = {'lamp_oil': 'Обычный фонарь', 'lamp_gas': 'Газовый фонарь', 'lamp_stubborn': 'Упрямый фонарь',
          'lamp_marsh': 'Болотный фонарь', 'beacon': 'Маяк', 'lighthouse': 'Старый маяк'}


def hexs(c):
    return '#%06x' % c


def chart(name, on, off):
    S = 18          # размер клетки
    PADL, PADT = 34, 84
    gap = 100
    W, H = on.w, on.h
    colors = []
    for cv in (on, off):
        for y in range(H):
            for x in range(W):
                c = cv.px.get((x, y))
                if c is not None and c not in colors:
                    colors.append(c)
    num = {c: i + 1 for i, c in enumerate(colors)}
    legend_x = PADL + 2 * W * S + gap + 30
    total_w = legend_x + 300
    total_h = max(PADT + H * S + 40, PADT + 26 * len(colors) + 60)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="{total_h}" '
         f'font-family="Arial, sans-serif" font-size="10">',
         f'<rect width="100%" height="100%" fill="#ffffff"/>',
         f'<text x="{PADL}" y="22" font-size="18" font-weight="bold">{TITLES[name]} — схема по клеткам</text>',
         f'<text x="{PADL}" y="40" font-size="12" fill="#555">1 клетка = 1 пиксель. Цифра в клетке — номер цвета (список справа). '
         f'Холст {W}×{H}.</text>']
    gr, an = GLASS_ROW[name], H - 2
    for k, (label, cv) in enumerate([('ГОРИТ  (' + name + '_on.png)', on), ('НЕ ГОРИТ  (' + name + '_off.png)', off)]):
        ox = PADL + k * (W * S + gap)
        o.append(f'<text x="{ox}" y="{PADT - 24}" font-size="12" font-weight="bold">{label}</text>')
        # подсветка строки центра стекла
        o.append(f'<rect x="{ox}" y="{PADT + gr * S}" width="{W * S}" height="{S}" fill="#fff3a0"/>')
        for y in range(H):
            for x in range(W):
                c = cv.px.get((x, y))
                X, Y = ox + x * S, PADT + y * S
                if c is None:
                    if y != gr:
                        o.append(f'<rect x="{X}" y="{Y}" width="{S}" height="{S}" fill="{"#f2f2f4" if (x + y) % 2 else "#fafafa"}"/>')
                    continue
                o.append(f'<rect x="{X}" y="{Y}" width="{S}" height="{S}" fill="{hexs(c)}"/>')
                r, g, b = rgb(c)
                tc = '#000' if (r * 299 + g * 587 + b * 114) / 1000 > 140 else '#fff'
                o.append(f'<text x="{X + S / 2}" y="{Y + S / 2 + 3.5}" text-anchor="middle" fill="{tc}">{num[c]}</text>')
        # сетка: тонкие линии, каждая 4-я — темнее
        for x in range(W + 1):
            o.append(f'<line x1="{ox + x * S}" y1="{PADT}" x2="{ox + x * S}" y2="{PADT + H * S}" '
                     f'stroke="{"#888" if x % 4 == 0 else "#ccc"}" stroke-width="{1 if x % 4 == 0 else 0.5}"/>')
        for y in range(H + 1):
            o.append(f'<line x1="{ox}" y1="{PADT + y * S}" x2="{ox + W * S}" y2="{PADT + y * S}" '
                     f'stroke="{"#888" if y % 4 == 0 else "#ccc"}" stroke-width="{1 if y % 4 == 0 else 0.5}"/>')
        # номера столбцов и строк
        for x in range(W):
            o.append(f'<text x="{ox + x * S + S / 2}" y="{PADT - 4}" text-anchor="middle" fill="#666">{x}</text>')
        for y in range(H):
            o.append(f'<text x="{ox - 4}" y="{PADT + y * S + S / 2 + 3.5}" text-anchor="end" fill="#666">{y}</text>')
        # точка опоры и центр стекла
        cx = ox + (W // 2) * S
        o.append(f'<rect x="{cx - S}" y="{PADT + an * S}" width="{2 * S}" height="{S}" fill="none" stroke="#e00" stroke-width="2.5"/>')
        o.append(f'<text x="{ox + W * S + 4}" y="{PADT + an * S + 13}" fill="#e00" font-size="10">опора</text>')
        o.append(f'<text x="{ox + W * S + 4}" y="{PADT + gr * S + 13}" fill="#b08000" font-size="10">← центр</text>')
        o.append(f'<text x="{ox + W * S + 4}" y="{PADT + gr * S + 25}" fill="#b08000" font-size="10">стекла</text>')
    # список цветов
    o.append(f'<text x="{legend_x}" y="{PADT - 18}" font-size="12" font-weight="bold">Цвета</text>')
    for i, c in enumerate(colors):
        y = PADT + i * 26
        o.append(f'<rect x="{legend_x}" y="{y}" width="22" height="22" fill="{hexs(c)}" stroke="#999"/>')
        o.append(f'<text x="{legend_x + 30}" y="{y + 15}" font-size="12" font-weight="bold">{i + 1}</text>')
        o.append(f'<text x="{legend_x + 52}" y="{y + 15}" font-size="12" font-family="Consolas, monospace">{hexs(c)}</text>')
        o.append(f'<text x="{legend_x + 120}" y="{y + 15}" font-size="11" fill="#444">{COLOR_NAMES.get(c, "")}</text>')
    o.append('</svg>')
    os.makedirs(os.path.join(OUT, 'charts'), exist_ok=True)
    with open(os.path.join(OUT, 'charts', name + '.svg'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(o))


for i, (name, _) in enumerate(ITEMS):
    chart(name, sheets[2 * i], sheets[2 * i + 1])
print('charts ok')
