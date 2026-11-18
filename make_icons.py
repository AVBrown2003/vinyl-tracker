"""Draw the app icons (PNG, no libraries): a vinyl record on a dark square.

    python make_icons.py
"""
import struct
import zlib
from pathlib import Path

INK, CREAM, RED, GROOVE, SHINE = (23, 22, 26), (245, 240, 230), (216, 65, 42), (44, 44, 52), (70, 70, 80)


def pixel(x, y, n):
    u, v = (x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5
    d = (u * u + v * v) ** 0.5
    if d < 0.025:
        return CREAM                      # spindle hole
    if d < 0.17:
        return RED                        # label
    if d < 0.185:
        return INK
    if d < 0.40:                          # grooves: thin rings of alternating shade, plus a soft highlight
        ring = int((d - 0.185) * 140) % 2
        if abs(u + v) < 0.04 and u < 0:
            return SHINE
        return GROOVE if ring else (30, 30, 36)
    return INK


def png(n):
    raw = b"".join(b"\x00" + b"".join(bytes(pixel(x, y, n)) for x in range(n)) for y in range(n))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


if __name__ == "__main__":
    out = Path(__file__).parent / "assets"
    out.mkdir(exist_ok=True)
    for size in (192, 512):
        (out / f"icon-{size}.png").write_bytes(png(size))
        print("wrote", out / f"icon-{size}.png")
