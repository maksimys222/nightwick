# Общие мелочи для рисования пиксель-арта скриптами: холст из символов, PNG, превью, ленты кадров.
import os, struct, zlib

rgb = lambda c: ((c >> 16) & 255, (c >> 8) & 255, c & 255)


def png(path, w, h, get):
    raw = b''.join(b'\x00' + b''.join(bytes(get(x, y)) for x in range(w)) for y in range(h))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


class Grid:
    """Холст из символов. '.' — прозрачно. В row() пробел — «не трогать клетку»."""
    def __init__(s, w, h): s.w, s.h, s.g = w, h, [['.'] * w for _ in range(h)]

    def set(s, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = ch

    def get(s, x, y):
        return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else '.'

    def row(s, y, x0, text):
        for i, ch in enumerate(text):
            if ch != ' ': s.set(x0 + i, y, ch)

    def rect(s, x, y, w, h, ch):
        for j in range(h):
            for i in range(w): s.set(x + i, y + j, ch)

    def outline(s, ch='K'):
        """Обвести всё нарисованное тёмным контуром снаружи."""
        add = []
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x] != '.': continue
                if any(s.get(x + dx, y + dy) not in ('.', ch) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    add.append((x, y))
        for x, y in add: s.g[y][x] = ch


def save(out, name, grids, pal, preview=8):
    """Кадры одного размера → лента PNG в ряд + увеличенное превью на шахматном фоне."""
    W, H = grids[0].w, grids[0].h
    def at(x, y):
        return grids[x // W].g[y][x % W]
    png(os.path.join(out, name + '.png'), W * len(grids), H,
        lambda x, y: (*rgb(pal[at(x, y)]), 255) if at(x, y) != '.' else (0, 0, 0, 0))
    if preview:
        K = preview
        def big(X, Y):
            x, y = X // K, Y // K
            ch = at(x, y)
            if ch != '.': return (*rgb(pal[ch]), 255)
            return (205, 205, 210, 255) if (x // 2 + y // 2) % 2 else (230, 230, 235, 255)
        png(os.path.join(out, 'preview', name + '.png'), W * len(grids) * K, H * K, big)
