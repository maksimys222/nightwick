# Сцена главного меню 320×180 (пиксель-арт): лесная поляна в рамке из лиан,
# слева — солнце с лучами, справа — тёмное дупло огромного дерева, посередине — каменная тропинка.
# Запуск: python -I tools/menu_scene.py art/examples/ui
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import png, rgb

OUT = sys.argv[1]
W, H = 320, 180
random.seed(11)
px = {}


def mix(a, b, k):
    k = max(0.0, min(1.0, k))
    return tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3))


def put(x, y, c, k=1.0):
    if 0 <= x < W and 0 <= y < H:
        px[(x, y)] = mix(px.get((x, y), c), c, k) if k < 1 else c


def dither(x, y, k):
    """Пиксельное смешивание: k — доля «да» (0..1) по шахматке 4×4."""
    m = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    return k * 16 > m[y % 4][x % 4]


SUN = (64, 64)

# ---------- фон: тёплый свет слева, лесная тьма справа ----------
for y in range(H):
    for x in range(W):
        d = math.hypot(x - SUN[0], (y - SUN[1]) * 1.2)
        warm = max(0, 1 - d / 170)
        base = mix(rgb(0x0e2420), rgb(0x2a4a30), 1 - y / H * 0.6)
        c = mix(base, rgb(0xf0c060), warm ** 1.6)
        # правый край темнее
        c = mix(c, rgb(0x060c0e), max(0, (x - 200) / 140) ** 1.3)
        px[(x, y)] = c

# дальние стволы деревьев — силуэты в дымке
for i in range(14):
    tx = 20 + i * 22 + random.randint(-6, 6)
    if 120 < tx < 200: continue  # середина свободна — там доска меню
    w = random.randint(4, 9)
    for y in range(0, 150):
        for x in range(tx, tx + w):
            far = mix(px[(x % W, y)], rgb(0x1a3226), 0.55)
            put(x, y, far)

# ---------- солнце с ореолом и лучами ----------
for y in range(H):
    for x in range(W):
        d = math.hypot(x - SUN[0], y - SUN[1])
        if d < 20:
            put(x, y, rgb(0xfff6c8) if d < 16 else rgb(0xffe48a))
        elif d < 44:
            k = (1 - (d - 20) / 24) ** 1.5
            if dither(x, y, k * 0.9): put(x, y, mix(px[(x, y)], rgb(0xffd870), 0.6))
# лучи: полосы света вниз-вправо
for r in range(6):
    ang = 0.35 + r * 0.16
    for t in range(30, 220):
        cx, cy = SUN[0] + math.cos(ang) * t, SUN[1] + math.sin(ang) * t
        for o in range(-3, 4):
            x, y = int(cx - math.sin(ang) * o), int(cy + math.cos(ang) * o)
            if 0 <= x < W and 0 <= y < H and dither(x, y, 0.32 * (1 - t / 220)):
                put(x, y, mix(px[(x, y)], rgb(0xffe8a0), 0.35))

# ---------- огромное тёмное дерево справа с дуплом ----------
BARK = set()
for y in range(H):
    left = 250 - 18 * math.sin(y / 40) - (y > 140) * (y - 140) * 0.8
    for x in range(int(left), W):
        bark = rgb(0x1a120c) if (x * 3 + y // 3) % 11 else rgb(0x2a1e14)
        if x < left + 3: bark = rgb(0x3a2a1a)  # свет на краю коры
        put(x, y, bark)
        BARK.add((x, y))
# дупло: тёмный проём с мягким краем
for y in range(60, 150):
    for x in range(262, 312):
        d = ((x - 287) / 22) ** 2 + ((y - 108) / 42) ** 2
        if d < 1: put(x, y, rgb(0x040406) if d < 0.75 else rgb(0x0e0a08))
# пара светящихся глаз в дупле (кто-то смотрит из тьмы)
for ex in (281, 291):
    put(ex, 104, rgb(0x8ad0ff)); put(ex + 1, 104, rgb(0x8ad0ff))
# корни
for i in range(5):
    x0 = 240 + i * 14
    for k in range(30):
        x, y = x0 - k * (0.6 + i * 0.1), 150 + k * 0.9
        for o in range(3 - k // 12):
            put(int(x) + o, int(y), rgb(0x2a1e14)); BARK.add((int(x) + o, int(y)))

# ---------- земля, мох, камни, тропинка ----------
for y in range(140, H):
    for x in range(W):
        if (x, y) in BARK: continue
        k = (y - 140) / 40
        g = mix(rgb(0x3a6a2a), rgb(0x1a3018), k)
        g = mix(g, rgb(0x8ab040), max(0, 1 - math.hypot(x - SUN[0], y - 150) / 120) * 0.5)
        g = mix(g, rgb(0x0a140e), max(0, (x - 200) / 160))
        if random.random() < 0.07: g = mix(g, rgb(0x7ac050), 0.5)  # травинки
        if random.random() < 0.04: g = mix(g, rgb(0x0e1a10), 0.4)
        put(x, y, g)
# тропинка из плоских камней: ближе к нам — крупнее
stones = [(160, 176, 16, 5), (148, 168, 13, 4), (170, 162, 11, 4), (156, 156, 9, 3), (168, 151, 8, 3), (160, 146, 6, 2)]
for sx, sy, rx, ry in stones:
    for y in range(sy - ry, sy + ry + 1):
        for x in range(sx - rx, sx + rx + 1):
            d = ((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2
            if d <= 1:
                put(x, y, rgb(0xb8b0a0) if y < sy - ry * 0.3 else (rgb(0x8e887e) if d < 0.8 else rgb(0x5a544c)))
# замшелые валуны слева внизу
for bx, by, br in ((22, 165, 16), (48, 172, 11)):
    for y in range(by - br, by + br):
        for x in range(bx - br - 4, bx + br + 4):
            d = ((x - bx) / (br + 4)) ** 2 + ((y - by) / br) ** 2
            if d <= 1:
                top = y < by - br * 0.35
                put(x, y, rgb(0x5aa040) if top else (rgb(0x6a645a) if d < 0.7 else rgb(0x3a362e)))

# ---------- рамка из лиан с листьями ----------
def leaf(cx, cy, s, ang, dark=False):
    for y in range(-s, s + 1):
        for x in range(-s, s + 1):
            u = x * math.cos(ang) + y * math.sin(ang)
            v = -x * math.sin(ang) + y * math.cos(ang)
            if (u / s) ** 2 + (v / (s * 0.6)) ** 2 <= 1:
                c = rgb(0x2a6a2a) if dark else (rgb(0x6ac04a) if v < 0 else rgb(0x3e8a34))
                if abs(v) < 0.6: c = rgb(0x8ad860) if not dark else rgb(0x3e7a34)  # прожилка
                put(cx + x, cy + y, c)


def vine(points, leaves_every=7, dark=False):
    for i in range(len(points) - 1):
        (x0, y0), (x1, y1) = points[i], points[i + 1]
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n):
            x, y = int(x0 + (x1 - x0) * k / n), int(y0 + (y1 - y0) * k / n)
            put(x, y, rgb(0x2a4a1a)); put(x, y + 1, rgb(0x1a3010))
            if k % leaves_every == 0:
                side = 1 if (k // leaves_every) % 2 else -1
                leaf(x + side * 4, y + 3, 3 + (k % 3 == 0), 0.8 * side, dark)


# верхняя ветвь через весь экран и свисающие лианы
top = [(x, 6 + 5 * math.sin(x / 30)) for x in range(-5, 330, 6)]
vine(top, 5)
for hx, ln in ((30, 60), (88, 36), (210, 48), (300, 90), (8, 120)):
    vine([(hx + 3 * math.sin(k / 6), 8 + k) for k in range(0, ln, 3)], 6, dark=hx > 200)
# левая лиана спиралью вниз
vine([(6 + 5 * math.sin(y / 9), y) for y in range(10, 150, 3)], 6)
# густая листва в верхних углах
for i in range(40):
    leaf(random.randint(0, 70), random.randint(0, 24), random.randint(3, 5), random.uniform(-1, 1))
    leaf(random.randint(250, 320), random.randint(0, 28), random.randint(3, 5), random.uniform(-1, 1), dark=True)
# папоротник в правом нижнем углу
for i in range(9):
    a = -2.6 + i * 0.25
    vine([(300 + math.cos(a) * k, 178 + math.sin(a) * k) for k in range(0, 40, 4)], 3, dark=True)

png(os.path.join(OUT, 'menu_scene.png'), W, H, lambda x, y: (*px.get((x, y), (0, 0, 0)), 255))
print('menu scene ok')
