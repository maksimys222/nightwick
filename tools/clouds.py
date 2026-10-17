# Пиксельные облака для дневного неба: пухлые, со светлым верхом и голубоватой тенью снизу.
# Запуск: python -I tools/clouds.py art/examples/ui
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import png, rgb

OUT = sys.argv[1]


def cloud(name, w, h, puffs, seed):
    random.seed(seed)
    inside = {}
    for (cx, cy, r) in puffs:
        for y in range(h):
            for x in range(w):
                if (x - cx) ** 2 + ((y - cy) * 1.15) ** 2 <= r * r:
                    inside[(x, y)] = max(inside.get((x, y), -99), cy - r)
    bottom = max(y for (_, y) in inside)

    def get(x, y):
        if (x, y) not in inside: return (0, 0, 0, 0)
        edge = any((x + dx, y + dy) not in inside for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if y >= bottom - 2: c = 0xc8dcf0          # тень снизу
        elif (x, y - 2) not in inside: c = 0xffffff  # блик сверху
        else: c = 0xeef4fc
        if edge and y > bottom - 4: c = 0xb4cce8
        return (*rgb(c), 255)
    png(os.path.join(OUT, name + '.png'), w, h, get)


cloud('cloud_1', 64, 24, [(14, 16, 9), (28, 11, 11), (42, 13, 10), (52, 17, 7), (32, 18, 9)], 1)
cloud('cloud_2', 44, 18, [(10, 12, 7), (21, 8, 9), (32, 11, 8), (22, 13, 7)], 2)
cloud('cloud_3', 88, 28, [(14, 20, 9), (28, 14, 12), (46, 10, 14), (64, 15, 11), (76, 20, 8), (46, 20, 10)], 3)
print('clouds ok')
