# Пример-образец: грядка подсолнухов (4 стадии) и цветочки в траве.
# Настоящий размер + увеличенное превью для просмотра.
import os, struct, sys, zlib

OUT = sys.argv[1]  # art/examples
os.makedirs(OUT, exist_ok=True)


def png(path, w, h, get):
    raw = b''.join(b'\x00' + b''.join(bytes(get(x, y)) for x in range(w)) for y in range(h))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


rgb = lambda c: ((c >> 16) & 255, (c >> 8) & 255, c & 255)

# цвета (из палитры игры)
SOIL_D, SOIL, SOIL_L = 0x5a3418, 0x7a4a26, 0xa8703e
STEM_D, STEM, LEAF_L = 0x2f7f34, 0x4caf40, 0x8ad85a
PET_D, PET, PET_L = 0xe08a20, 0xffc83a, 0xfff07a
SEED_D, SEED = 0x3a200c, 0x6b3e1a
OUTL = 0x1f4a24


class Canvas:
    def __init__(self, w, h):
        self.w, self.h, self.px = w, h, {}

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[(x, y)] = c

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.set(x + i, y + j, c)


def soil_patch(cv, ox):
    """Грядка на ромбе клетки 32×16 (низ холста 32×40): бортик из досок, рыхлая земля с бороздами и комочками."""
    WOOD_L, WOOD, WOOD_D = 0xb08050, 0x8a5a32, 0x5a3a1e
    for y in range(24, 40):
        dy = y - 24 if y < 32 else 39 - y
        half = 2 * dy + 2
        for x in range(16 - half, 16 + half):
            ring = min(x - (16 - half), (16 + half - 1) - x) // 2  # насколько далеко от края ромба (в «ступеньках»)
            top = y <= 25 or y >= 38
            if ring == 0 or top:
                # доски бортика: верхние/левые на свету, нижние/правые в тени
                c = WOOD_L if (x < 16 and y < 32) else (WOOD_D if (x >= 16 and y >= 32) else WOOD)
                if (x + y) % 7 == 0: c = WOOD_D  # стыки досок
            elif ring == 1:
                c = SOIL_D
            else:
                c = SOIL
                if ((x // 2) + y) % 4 == 0: c = SOIL_L      # борозды
                if (x * 7 + y * 3) % 23 == 0: c = SOIL_D    # комочки
            cv.set(ox + x, y, c)
    # колышек с табличкой на левом углу
    cv.set(ox + 2, 29, WOOD_D); cv.set(ox + 2, 28, WOOD_D); cv.set(ox + 2, 27, WOOD)
    cv.set(ox + 1, 26, 0xf0e4c8); cv.set(ox + 2, 26, 0xf0e4c8); cv.set(ox + 3, 26, 0xffd23a)


SPOTS = [(16, 29), (9, 32), (23, 32), (16, 35)]  # где растут 4 растения (сзади вперёд)
HEIGHT = [12, 9, 9, 6]  # задние выше — головки не налезают друг на друга


def stage0(cv, ox, x, y, h):  # семечко в лунке
    cv.set(ox + x - 1, y, SOIL_D); cv.set(ox + x + 1, y, SOIL_D)
    cv.set(ox + x, y - 1, SEED); cv.set(ox + x, y, SEED_D)


def stage1(cv, ox, x, y, h):  # росток: стебелёк и два листика
    cv.rect(ox + x, y - 2, 1, 3, STEM)
    cv.set(ox + x - 1, y - 3, LEAF_L); cv.set(ox + x - 2, y - 3, STEM)
    cv.set(ox + x + 1, y - 3, STEM); cv.set(ox + x + 2, y - 4, STEM_D)


def stem(cv, ox, x, y, h):
    cv.rect(ox + x, y - h, 1, h + 1, STEM)
    cv.rect(ox + x + 1, y - h + 2, 1, h - 2, STEM_D)  # тень справа
    # листья: слева светлый, справа тёмный
    cv.set(ox + x - 1, y - 4, STEM); cv.set(ox + x - 2, y - 5, LEAF_L); cv.set(ox + x - 1, y - 5, LEAF_L)
    cv.set(ox + x + 2, y - 6, STEM_D); cv.set(ox + x + 3, y - 7, STEM_D); cv.set(ox + x + 2, y - 7, STEM)


def stage2(cv, ox, x, y, h):  # бутон: высокий стебель, зелёный бутон с жёлтой щёлкой
    stem(cv, ox, x, y, h - 1)
    cv.rect(ox + x - 1, y - h - 2, 3, 3, STEM)
    cv.set(ox + x - 1, y - h - 2, LEAF_L); cv.set(ox + x + 1, y - h, STEM_D)
    cv.set(ox + x, y - h - 3, PET)


def stage3(cv, ox, x, y, h):  # цветёт: жёлтые лепестки, коричневая серединка
    stem(cv, ox, x, y, h)
    cx, cy = ox + x, y - h - 4
    # тёмная кайма вокруг головки — соседние цветы не сливаются
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            d = abs(dx) + abs(dy)
            if d == 5 or (d <= 5 and (abs(dx) == 4 or abs(dy) == 4)) or (abs(dx) == 3 and abs(dy) == 3):
                if d <= 6: cv.set(cx + dx, cy + dy, 0x9a5014)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            d = abs(dx) + abs(dy)
            if d > 4 or (abs(dx) == 3 and abs(dy) == 3):
                if d == 5 and (dx + dy) % 2 == 0 and abs(dx) <= 3 and abs(dy) <= 3: cv.set(cx + dx, cy + dy, PET)
                continue
            c = PET
            if dx + dy >= 2: c = PET_D      # тень справа снизу
            if dx + dy <= -3: c = PET_L     # блик слева сверху
            cv.set(cx + dx, cy + dy, c)
    cv.rect(cx - 1, cy - 1, 3, 3, SEED)
    cv.set(cx + 1, cy + 1, SEED_D); cv.set(cx, cy + 1, SEED_D); cv.set(cx + 1, cy, SEED_D)
    cv.set(cx - 1, cy - 1, 0x9a6a30)  # блик на семечках


def sunflowers():
    cv = Canvas(128, 40)
    for st, fn in enumerate([stage0, stage1, stage2, stage3]):
        ox = st * 32
        soil_patch(cv, ox)
        for (x, y), h in zip(SPOTS, HEIGHT):
            fn(cv, ox, x, y, h)
    return cv


def small_flowers():
    cv = Canvas(48, 16)
    for i, (pet, pet_d, mid) in enumerate([(0xffffff, 0xc8d0e0, 0xffd23a), (0xffd23a, 0xe08a20, 0xfff07a), (0xff7aa8, 0xc8487a, 0xffe070)]):
        ox, x, y = i * 16, 8, 14
        # травка у корня
        cv.set(ox + x - 2, y, STEM); cv.set(ox + x - 3, y - 1, STEM); cv.set(ox + x + 2, y, STEM_D); cv.set(ox + x + 3, y - 1, STEM_D)
        cv.rect(ox + x, y - 6, 1, 7, STEM)
        cv.set(ox + x - 1, y - 3, LEAF_L); cv.set(ox + x + 1, y - 4, STEM_D)
        cy = y - 9
        if i == 2:  # тюльпан: чашечка
            cv.rect(ox + x - 2, cy - 1, 5, 3, pet)
            cv.set(ox + x - 2, cy - 2, pet); cv.set(ox + x, cy - 2, pet); cv.set(ox + x + 2, cy - 2, pet)
            cv.rect(ox + x + 1, cy, 2, 2, pet_d); cv.set(ox + x - 1, cy, 0xffc4dc)
            continue
        for dx, dy in [(-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1)]:
            cv.set(ox + x + dx, cy + dy, pet_d if dx + dy > 0 else pet)
        cv.set(ox + x - 2, cy - 1, pet) if i == 0 else None
        cv.set(ox + x, cy, mid)
    return cv


def save(cv, name, k=8):
    png(os.path.join(OUT, name + '.png'), cv.w, cv.h, lambda x, y: (*rgb(cv.px[(x, y)]), 255) if (x, y) in cv.px else (0, 0, 0, 0))
    def big(X, Y):
        x, y = X // k, Y // k
        if (x, y) in cv.px:
            return (*rgb(cv.px[(x, y)]), 255)
        return (205, 205, 210, 255) if (x // 2 + y // 2) % 2 else (230, 230, 235, 255)
    png(os.path.join(OUT, name + '_preview.png'), cv.w * k, cv.h * k, big)


save(sunflowers(), 'flower_example')
save(small_flowers(), 'flowers_example', k=10)
print('ok')
