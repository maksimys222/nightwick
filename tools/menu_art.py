# Фон главного меню 320×180: слева — солнечный день с солнышком, справа — ночь и дым Гасителя,
# посередине горит фонарь. Запуск: python -I tools/menu_art.py art/examples/ui
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import png, rgb

OUT = sys.argv[1]
W, H = 320, 180
random.seed(7)


def mix(a, b, k):
    k = max(0.0, min(1.0, k))
    return tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3))


DAY_TOP, DAY_LOW = rgb(0x6ec8f0), rgb(0xfbe2a8)
NIGHT_TOP, NIGHT_LOW = rgb(0x070820), rgb(0x2a1a4a)
px = {}

# небо: граница дня и ночи волнистая, с пиксельным «шахматным» переходом
for y in range(H):
    for x in range(W):
        edge = W * 0.5 + 18 * math.sin(y / 23) + 8 * math.sin(y / 7 + 1)
        t = (x - edge) / 34 + 0.5
        if 0.25 < t < 0.75:  # дизеринг в переходе
            t = 1.0 if ((x + y) % 2 == 0) == (t > 0.5) else 0.0 if t < 0.5 else 1.0
        k = y / H
        day, night = mix(DAY_TOP, DAY_LOW, k * 1.2), mix(NIGHT_TOP, NIGHT_LOW, k * 1.3)
        px[(x, y)] = mix(day, night, t)

# звёзды на ночной стороне
for _ in range(160):
    x, y = random.randrange(W // 2 + 10, W), random.randrange(0, 120)
    edge = W * 0.5 + 18 * math.sin(y / 23) + 8 * math.sin(y / 7 + 1)
    if x < edge + 20: continue
    c = rgb(0xfff4d8) if random.random() < 0.3 else rgb(0x9a9ad0)
    px[(x, y)] = c
    if random.random() < 0.08:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): px[(x + dx, y + dy)] = rgb(0x8a8ac8)

# дым Гасителя: тёмная спираль в правом верхнем углу
for i in range(900):
    a = i * 0.035
    r = 6 + a * 4.2
    x, y = int(268 + math.cos(a) * r), int(40 + math.sin(a) * r * 0.6)
    for dx in range(3):
        if 0 <= x + dx < W and 0 <= y < H:
            px[(x + dx, y)] = rgb(0x3a1e5a) if (i // 40) % 2 else rgb(0x24123c)

# солнышко с лучами и улыбкой
sx, sy, sr = 62, 48, 17
for y in range(sy - sr - 12, sy + sr + 12):
    for x in range(sx - sr - 12, sx + sr + 12):
        d = math.hypot(x - sx, y - sy)
        ang = math.atan2(y - sy, x - sx)
        if d <= sr:
            px[(x, y)] = rgb(0xfff2a0) if d < sr - 5 else (rgb(0xffd23a) if d < sr - 1 else rgb(0xe0a020))
        elif d < sr + 10 and abs(math.sin(ang * 6)) > 0.93:
            px[(x, y)] = rgb(0xffe070)
for dx in (-6, 5):
    for yy in (sy - 4, sy - 3): px[(sx + dx, yy)] = rgb(0x5a3a10); px[(sx + dx + 1, yy)] = rgb(0x5a3a10)
for i in range(-5, 6):
    px[(sx + i, sy + 5 + (abs(i) < 4))] = rgb(0x5a3a10)

# холмы: слева зелёные на солнце, справа ночные
for x in range(W):
    edge = W * 0.5
    h1 = 128 + 10 * math.sin(x / 31) + 5 * math.sin(x / 11)
    h2 = 146 + 6 * math.sin(x / 19 + 2)
    for y in range(int(h1), H):
        t = 1 if x > edge + 10 * math.sin(y / 9) else 0
        far = mix(rgb(0x6ab84a), rgb(0x1a2a3a), t)
        near = mix(rgb(0x4a9a3a), rgb(0x121c2a), t)
        px[(x, y)] = near if y >= h2 else far
        if y == int(h1) and not t: px[(x, y)] = rgb(0x8ad05a)

# домики на холмах: днём яркие, ночью тёмные с окошками
for hx, base, roof, night in ((22, 134, 0xd0463a, False), (104, 132, 0x3a7ad0, False), (208, 133, 0x2a2440, True), (282, 131, 0x2a2440, True)):
    wall = rgb(0xf2e2c2) if not night else rgb(0x1e1e30)
    for y in range(base - 10, base):
        for x in range(hx, hx + 14): px[(x, y)] = wall
    for i in range(8):
        for x in range(hx - 1 + i, hx + 15 - i): px[(x, base - 10 - i)] = rgb(roof)
    win = rgb(0xffd27a) if night else rgb(0x3a5a8a)
    for x in range(hx + 3, hx + 6):
        for y in range(base - 7, base - 4): px[(x, y)] = win
    px[(hx + 9, base - 1)] = rgb(0x5a3018); px[(hx + 10, base - 1)] = rgb(0x5a3018)

# фонарь посередине — его свет и есть граница между днём и ночью
lx, ly = 160, 150
for y in range(ly - 46, ly):
    px[(lx, y)] = rgb(0x2e3450); px[(lx + 1, y)] = rgb(0x1f2232)
for x in range(lx - 4, lx + 6): px[(x, ly)] = rgb(0x1f2232); px[(x, ly - 1)] = rgb(0x2e3450)
for y in range(ly - 56, ly - 46):
    for x in range(lx - 4, lx + 6):
        edge = x in (lx - 4, lx + 5) or y in (ly - 56, ly - 47)
        px[(x, y)] = rgb(0x1f2232) if edge else (rgb(0xfff6d8) if abs(x - lx - 0.5) < 2 and ly - 53 < y < ly - 49 else rgb(0xffd36b))
for i in range(6):
    for x in range(lx - 5 + i, lx + 7 - i): px[(x, ly - 57 - i)] = rgb(0x2e3450)
# ореол фонаря кольцами с дизерингом
for y in range(ly - 90, ly + 10):
    for x in range(lx - 50, lx + 52):
        d = math.hypot(x - lx - 0.5, (y - ly + 51) * 1.1)
        if 6 < d < 46 and (x, y) in px:
            k = (1 - d / 46) ** 1.6
            band = math.floor(k * 5) / 5
            if band > 0 and ((x + y) % 2 == 0 or band > 0.4):
                px[(x, y)] = mix(px[(x, y)], rgb(0xffe08a), band * 0.55)

png(os.path.join(OUT, 'menu_bg.png'), W, H, lambda x, y: (*px.get((x, y), (0, 0, 0)), 255))
print('menu bg ok')
