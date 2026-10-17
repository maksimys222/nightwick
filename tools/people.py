# Жители и помощник: стоят (24×32) и идут (4 кадра), смотрят вправо, ноги — на строке 30.
# Тот же рост и пропорции, что у фонарщика (tools/hero.py). Филин — сова, рисуется отдельно.
# Запуск: python -I tools/people.py art/examples/people
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import Grid, save

OUT = sys.argv[1]

BASE = {
    'K': 0x1a1420, 's': 0xf0c8a0, 'S': 0xc8946a, 'n': 0xe8a888, 'e': 0x1a1420, 'l': 0xfde4c8,
    'p': 0x34303e, 'P': 0x22202a, 'o': 0x3a2416, 'O': 0x6a4a30,
    't': 0x6a4422, 'T': 0xd8b050, 'w': 0xf4f0e8, 'W': 0xc8c0b4,
    'y': 0xffd23a, 'Y': 0xe09a20, 'g': 0x3e9a40, 'G': 0x6aca50, 'm': 0x8a8a96, 'M': 0x5a5a66,
    'L': 0xf4ecd8, 'R': 0xc83a32, 'u': 0x9a6232, 'U': 0x5e3a1c, 'h': 0x7a4a26,
}

LEGS = {
    'stand': [(8, 'KppKppK'), (8, 'KppKppK'), (8, 'KooKooK'), (8, 'KOooKOooK')],
    'pass': [(8, 'KPPKppK'), (8, 'KPPKppK'), (8, 'KooKooK'), (8, 'KOooKOooK')],
    'step': [(8, 'KppKppK'), (7, 'KPPK KppK'), (6, 'KooK   KooK'), (5, 'KOooK  KOooK')],
}
FEET = {  # из-под длинного платья видны только башмаки (строки 29–30)
    'stand': [(9, 'KoKoK'), (8, 'KOoKOoK')],
    'pass': [(9, 'KoKoK'), (8, 'KOoKOoK')],
    'step': [(7, 'KoK  KoK'), (6, 'KOoK  KOoK')],
}


def person(cfg, frame=0, walk=False):
    G = Grid(24, 32)
    kind = 'stand' if not walk else ('pass', 'step', 'pass', 'step')[frame]
    bob = 1 if walk and frame % 2 == 1 else 0
    kid = cfg.get('kid', False)
    up = 3 if kid else 0                      # ребёнок ниже: голова и тело опущены на 3
    u = lambda y: y + bob + up
    dress = cfg.get('dress', False)

    # туловище
    torso = [(15, 'KCcccccdK'), (16, 'KCcccccdK'), (17, 'KCcccccdK'), (18, 'KCcccccdK'),
             (19, 'KCcccccdK'), (20, 'KtttTttdK' if cfg.get('belt') else 'KCcccccdK'), (21, 'KCcccccdK')]
    if kid: torso = torso[:5]
    for y, text in torso: G.row(u(y), 8, text)
    if cfg.get('buttons'):
        for y in (17, 19): G.set(13, u(y), 'T')
    # низ: платье до башмаков, пальто до колен, у ребёнка — короткое
    if dress:
        skirt = [(22, 7, 'KCCcccdcdK'), (23, 7, 'KCcccdcddK'), (24, 6, 'KCCcccdcddK'), (25, 6, 'KCcccccdcdK'),
                 (26, 6, 'KCCcccccddK'), (27, 5, 'KCcccccccddK'), (28, 5, 'KdddddddddddK')]
        if kid: skirt = [(23, 7, 'KCCccdcdK'), (24, 7, 'KCcccdcdK'), (25, 6, 'KCCcccdcdK'), (26, 6, 'KddddddddK')]
        for y, x, text in skirt: G.row(y + bob, x, text)
    else:
        coat = [(22, 7, 'KCCcccdcdK'), (23, 7, 'KCcccdcddK'), (24, 7, 'KCcccdccddK'), (25, 6, 'KCCcccdcdddK'),
                (26, 6, 'KddddddKdddK')]
        for y, x, text in coat: G.row(u(y), x, text)
    # фартук поверх
    if cfg.get('apron'):
        bottom = (28 if dress else 26) if not kid else 28
        G.row(u(15) if not kid else u(15), 11, 'vv')
        G.row(u(16), 11, 'vV')
        for y in range(u(17), bottom + bob + (0 if not kid else 0)):
            G.row(y, 10, 'vvvV')
        G.row(u(20), 9, 'VvvvV')

    # ноги
    if dress and not kid:
        for i, (x, text) in enumerate(FEET[kind]): G.row(29 + i, x, text)
    elif kid:  # тонкие детские ножки
        legs = {'stand': [(9, 'KpKpK')] * 2 + [(9, 'KoKoK'), (8, 'KOoKOoK')],
                'pass': [(9, 'KPKpK')] * 2 + [(9, 'KoKoK'), (8, 'KOoKOoK')],
                'step': [(9, 'KpKpK'), (8, 'KPK KpK'), (7, 'KoK  KoK'), (6, 'KOoK  KOoK')]}[kind]
        for i, (x, text) in enumerate(legs): G.row(27 + i, x, text)
    else:
        for i, (x, text) in enumerate(LEGS[kind]): G.row(27 + i, x, text)

    # рука и то, что в ней
    for y in range(15, 19 if kid else 21): G.row(u(y), 15, 'cdK')
    G.row(u(19 if kid else 21), 15, 'ssK')
    item = cfg.get('item')
    if item: item(G, u, frame if walk else 0)

    # шея/воротник и голова
    G.row(u(13), 9, cfg.get('collar', 'KcccccK'))
    G.row(u(14), 8, 'KCcccccdK')
    head = cfg.get('head', default_head)
    head(G, u)
    return G


def default_head(G, u):
    G.row(u(8), 10, 'KKKKK')
    G.row(u(9), 9, 'KaAssssK')
    G.row(u(10), 9, 'KaSssesK')
    G.row(u(11), 9, 'KaSsnsssK')
    G.row(u(12), 9, 'KaaSssSK')


# ---------- головные уборы и лица ----------

def kerchief(G, u):  # Агата: платок, узелок под подбородком, очки
    G.row(u(6), 10, 'KKKKK')
    G.row(u(7), 9, 'KkkkkkK')
    G.row(u(8), 8, 'KkkkkkkkK')
    G.row(u(9), 8, 'KkkkwssssK')
    G.row(u(10), 8, 'KkkSssesK')
    G.row(u(11), 8, 'KkkSssnsssK')
    G.row(u(12), 8, 'KkkkSsssSK')
    G.row(u(13), 10, 'KkkK')


def bald_beard(G, u):  # Тимофей: лысина с бликом, густая борода
    G.row(u(7), 10, 'KKKKK')
    G.row(u(8), 9, 'KssllsK')
    G.row(u(9), 9, 'KSsssssK')
    G.row(u(10), 9, 'KSsssesK')
    G.row(u(11), 9, 'KbSsnsssK')
    G.row(u(12), 9, 'KbbbbbbbK')
    G.row(u(13), 9, 'KbBbbbbK')
    G.row(u(14), 10, 'KbbbbK')


def pigtails(G, u):  # Ника: чёлка, хвостики с бантиками
    G.row(u(8), 10, 'KKKKK')
    G.row(u(9), 9, 'KaAaaasK')
    G.row(u(10), 9, 'KaSssesK')
    G.row(u(11), 9, 'KaSsnsssK')
    G.row(u(12), 9, 'KaaSssSK')
    G.row(u(9), 6, 'Kr')
    G.row(u(10), 6, 'raK')
    G.row(u(11), 6, 'aAK')
    G.row(u(12), 7, 'a')


def cap(G, u):  # Сева: фуражка почтальона с кокардой и козырьком
    default_head(G, u)
    G.row(u(5), 10, 'KKKKK')
    G.row(u(6), 9, 'KqqqQqK')
    G.row(u(7), 9, 'KqqTqqK')
    G.row(u(8), 9, 'KKKKKKKKK')
    G.row(u(9), 15, 'K')


def chef(G, u):  # Мила: пышный колпак пекаря
    default_head(G, u)
    G.row(u(1), 10, 'KKKK')
    G.row(u(2), 9, 'KwwwwK')
    G.row(u(3), 8, 'KwwwwwwK')
    G.row(u(4), 8, 'KwwwwwWK')
    G.row(u(5), 9, 'KwwwWK')
    G.row(u(6), 9, 'KwwwwWK')
    G.row(u(7), 9, 'KWWWWWK')


def flatcap(G, u):  # помощник: кепка
    default_head(G, u)
    G.row(u(6), 10, 'KKKK')
    G.row(u(7), 9, 'KhhhhK')
    G.row(u(8), 9, 'KhhhhhhKK')


# ---------- что в руках ----------

def sunflower(G, u, f):  # Агата держит подсолнух перед собой
    for y in range(17, 22): G.set(18, u(y), 'g')
    G.set(19, u(19), 'G'); G.set(17, u(20), 'G')
    G.row(u(13), 17, 'KyyK')
    G.row(u(14), 16, 'KyhhyK')
    G.row(u(15), 16, 'KyhhYK')
    G.row(u(16), 17, 'KYYK')


def hammer(G, u, f):  # Тимофей: молот опущен
    G.row(u(22), 16, 'h')
    G.row(u(23), 16, 'h')
    G.row(u(24), 15, 'KmmMK')
    G.row(u(25), 15, 'KMMMK')


def brush(G, u, f):  # Ника: кисточка с оранжевой краской
    G.set(16, u(20), 'h'); G.set(17, u(19), 'h'); G.set(17, u(18), 'h'); G.set(18, u(17), 'x'); G.set(18, u(16), 'x')


def letter(G, u, f):  # Сева: письмо в руке и сумка на боку
    G.row(u(21), 16, 'KLLK')
    G.row(u(22), 16, 'KLRK')
    G.row(u(23), 16, 'KKKK')
    G.row(u(19), 4, 'KKKKK')
    G.row(u(18), 5, 'LL')
    G.row(u(20), 4, 'KuuuUK')
    G.row(u(21), 4, 'KuTuUK')
    G.row(u(22), 4, 'KuuuUK')
    G.row(u(23), 4, 'KKKKKK')
    for x, y in ((14, 15), (13, 16), (12, 17), (11, 18), (10, 19), (9, 20)): G.set(x, u(y), 't')


def loaf(G, u, f):  # Мила: каравай
    G.row(u(20), 15, 'KKKK')
    G.row(u(21), 14, 'KjjJjK')
    G.row(u(22), 14, 'KjJjjK')
    G.row(u(23), 15, 'KKKK')


def oilcan(G, u, f):  # помощник: бидон с маслом
    sw = (0, 1, 0, -1)[f]
    G.set(16 + sw, u(22), 'M')
    G.row(u(23), 14 + sw, 'KYYYK')
    G.row(u(24), 14 + sw, 'KyyyKM')
    G.row(u(25), 14 + sw, 'KyyYK M')
    G.row(u(26), 14 + sw, 'KKKKK')


PEOPLE = {
    'agata': dict(head=kerchief, dress=True, apron=True, item=sunflower,
                  pal={'c': 0x8a4a7a, 'C': 0xb06a9e, 'd': 0x5e2e54, 'k': 0xd04a3a, 'v': 0xece4d4, 'V': 0xbab2a2,
                       'i': 0x8a8a9a, 'collar': 0}),
    'timofey': dict(head=bald_beard, apron=True, item=hammer, collar='KsssssK',
                    pal={'c': 0xb05a3a, 'C': 0xd07a52, 'd': 0x7a3a24, 'v': 0x6a4422, 'V': 0x452a14,
                         'b': 0x6a3a1a, 'B': 0x8a5228}),
    'nika': dict(head=pigtails, kid=True, dress=True, item=brush,
                 pal={'c': 0xd07a3a, 'C': 0xf0a060, 'd': 0x9a4a1e, 'a': 0x8a4a1a, 'A': 0xb06a2a, 'r': 0x3a9ad0,
                      'x': 0xff8a3a}),
    'seva': dict(head=cap, buttons=True, belt=True, item=letter,
                 pal={'c': 0x3a5a8a, 'C': 0x5a7ab0, 'd': 0x26406a, 'q': 0x2a4a7a, 'Q': 0x4a6aa0,
                      'a': 0x4a2a14, 'A': 0x6a3e1e}),
    'mila': dict(head=chef, dress=True, apron=True, item=loaf,
                 pal={'c': 0xd88a8a, 'C': 0xf0aaa8, 'd': 0xa85a5e, 'v': 0xf4f0e8, 'V': 0xd0c8bc,
                      'a': 0xa0602a, 'A': 0xc8803a, 'j': 0xd8964a, 'J': 0xa8682a}),
    'helper': dict(head=flatcap, belt=True, item=oilcan,
                   pal={'c': 0x3f6b3a, 'C': 0x5a8a50, 'd': 0x2a4a26, 'a': 0x5a341a, 'A': 0x7a4a26, 'h': 0x8a7a4a}),
}
for cfg in PEOPLE.values():
    cfg['pal'].setdefault('a', 0x5a341a); cfg['pal'].setdefault('A', 0x7a4a26)


# ---------- Филин — сова ----------

OWL = {'K': 0x1e1a14, 'c': 0x8a7a5a, 'C': 0xb0a07c, 'd': 0x5a4c36, 'D': 0x3e3424, 'v': 0xe0d4b4, 'V': 0xa8987a,
       'f': 0xece0c4, 'y': 0xffd23a, 'e': 0x1a1420, 'b': 0xe0a030, 'o': 0xe0a030, 'w': 0xfaf6ea, 'g': 0xb8bcc8}


def owl(frame=0, walk=False):
    G = Grid(24, 32)
    dx = (0, 1, 0, -1)[frame] if walk else 0
    lift = (0, 1, 0, 1)[frame] if walk else 0
    cx, cy = 12 + dx, 20 - lift
    for y in range(32):
        for x in range(24):
            if ((x - cx + 0.5) / 7.5) ** 2 + ((y - cy) / 10) ** 2 <= 1:
                G.set(x, y, 'C' if x < cx - 3 else ('d' if x > cx + 3 else 'c'))
    # ушки-пучки
    G.row(cy - 11, cx - 7, 'cc'); G.row(cy - 12, cx - 7, 'd')
    G.row(cy - 11, cx + 5, 'cc'); G.row(cy - 12, cx + 6, 'd')
    # лицевой диск, брови, глаза (смотрят вправо), клюв
    for ex in (cx - 3, cx + 2):
        for y in range(cy - 7, cy - 2):
            for x in range(ex - 2, ex + 3):
                if (x - ex) ** 2 + (y - (cy - 5)) ** 2 <= 5: G.set(x, y, 'f')
        G.row(cy - 6, ex - 1, 'yy'); G.row(cy - 5, ex - 1, 'ye'); G.row(cy - 4, ex - 1, 'yy')
    G.row(cy - 8, cx - 6, 'wwww'); G.row(cy - 8, cx + 2, 'wwww')
    G.set(cx - 5, cy - 9, 'w'); G.set(cx + 4, cy - 9, 'w')
    G.set(cx, cy - 3, 'b'); G.set(cx, cy - 2, 'b'); G.set(cx - 1, cy - 3, 'b')
    # круглые очки
    for ex in (cx - 3, cx + 2):
        for x, y in ((ex - 2, cy - 5), (ex + 2, cy - 5), (ex, cy - 7), (ex, cy - 3)): G.set(x, y, 'g')
    # грудка в шевронах и сложенные крылья
    for y in range(cy, cy + 8):
        for x in range(cx - 3, cx + 4):
            if ((x - cx) / 4) ** 2 + ((y - cy - 3.5) / 4.5) ** 2 <= 1:
                G.set(x, y, 'V' if (x + y) % 3 == 0 and y % 2 == 0 else 'v')
    for y in range(cy - 1, cy + 8):
        G.set(cx - 6, y, 'D' if y % 2 else 'd'); G.set(cx + 5, y, 'D' if y % 2 == 0 else 'd')
    # лапки
    feet_y = 30
    if walk and frame % 2 == 1:
        G.row(feet_y - 1, cx - 3, 'oo'); G.row(feet_y, cx + 1, 'ooo')
    else:
        G.row(feet_y, cx - 4, 'ooo'); G.row(feet_y, cx + 1, 'ooo')
    G.outline('K')
    return G


if __name__ == '__main__':
    for name, cfg in PEOPLE.items():
        pal = {**BASE, **{k: v for k, v in cfg['pal'].items() if len(k) == 1}}
        save(OUT, name + '_idle', [person(cfg)], pal)
        save(OUT, name + '_walk', [person(cfg, i, True) for i in range(4)], pal)
    save(OUT, 'filin_idle', [owl()], OWL)
    save(OUT, 'filin_walk', [owl(i, True) for i in range(4)], OWL)
    print('people ok')
