#!/usr/bin/env python3
"""
gen_placeholders.py — fallback image generator for the BHARAT prototype.

If the AI image generator's quota is exhausted, this script paints
elegant, on-brand placeholder images (Indian gradient + mandala + diya
motifs, per-theme accent colours) for every missing file in assets/img.

It NEVER overwrites an existing file, so real AI-generated artwork
always wins. Re-run any time; it only fills in what is still missing.
"""

import math
import os

from PIL import Image, ImageDraw, ImageFilter

# The script lives in tools/, images live one level up in assets/img/
IMG_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "img")
)
SIZE = 1024  # square canvas (display containers crop/scale as needed)


def lerp(a, b, t):
    return a + (b - a) * t


def vgrad(top, bottom):
    """Vertical two-colour gradient."""
    img = Image.new("RGB", (SIZE, SIZE))
    d = ImageDraw.Draw(img)
    for y in range(SIZE):
        t = y / (SIZE - 1)
        d.line(
            [(0, y), (SIZE, y)],
            fill=tuple(int(lerp(top[i], bottom[i], t)) for i in range(3)),
        )
    return img


def lattice_tile(accent, alpha=26):
    """One tile of the subtle diamond-lattice background pattern."""
    tile = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    d.line([(64, 0), (128, 64)], fill=accent + (alpha,), width=2)
    d.line([(128, 64), (64, 128)], fill=accent + (alpha,), width=2)
    d.line([(64, 128), (0, 64)], fill=accent + (alpha,), width=2)
    d.line([(0, 64), (64, 0)], fill=accent + (alpha,), width=2)
    return tile


def mandala_layer(accent, opacity=120, petals=12, dots=16):
    """Centered mandala on a transparent layer: rings, petals, dots."""
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = cy = SIZE // 2
    R = int(SIZE * 0.44)

    # Outer double ring
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=accent + (min(opacity + 40, 210),), width=5)
    d.ellipse([cx - R + 14, cy - R + 14, cx + R - 14, cy + R - 14], outline=accent + (opacity,), width=2)
    # Inner rings
    for f in (0.62, 0.46, 0.24):
        r = int(R * f)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=accent + (opacity,), width=3)

    # Petals: rotated thin ellipse outlines radiating from the centre
    def petal_ring(count, dist, length, width, op):
        pw, ph = max(width, 8), length
        p = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        pd = ImageDraw.Draw(p)
        pd.ellipse([4, 4, pw - 4, ph - 4], outline=accent + (op,), width=4)
        for i in range(count):
            ang = 360.0 / count * i
            rot = p.rotate(ang, resample=Image.BICUBIC, expand=False)
            x = cx + int(dist * math.sin(math.radians(ang))) - pw // 2
            y = cy - int(dist * math.cos(math.radians(ang))) - ph // 2
            layer.alpha_composite(rot, (x, y))

    petal_ring(petals, int(R * 0.62), int(R * 0.52), int(R * 0.16), min(opacity + 20, 200))
    petal_ring(8, int(R * 0.34), int(R * 0.34), int(R * 0.12), opacity)

    # Dots on the rim
    for i in range(dots):
        ang = 360.0 / dots * i + 180.0 / dots
        x = cx + int((R - 7) * math.sin(math.radians(ang)))
        y = cy - int((R - 7) * math.cos(math.radians(ang)))
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=accent + (min(opacity + 30, 210),))

    # Centre bead
    r0 = int(R * 0.06)
    d.ellipse([cx - r0, cy - r0, cx + r0, cy + r0], fill=accent + (min(opacity + 50, 220),))
    return layer


def diya_layer(accent, scale=1.0):
    """A stylised diya (oil lamp) with a soft glow, on a transparent layer."""
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cx = SIZE // 2
    base_y = int(SIZE * 0.80)
    s = scale

    # Glow
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gr = int(150 * s)
    gd.ellipse([cx - gr, base_y - int(230 * s) - gr, cx + gr, base_y - int(230 * s) + gr],
               fill=(255, 190, 90, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    layer.alpha_composite(glow)

    d = ImageDraw.Draw(layer)
    # Flame (outer + inner)
    fy = base_y - int(235 * s)
    flame = [(cx, fy - int(95 * s)),
             (cx + int(34 * s), fy - int(10 * s)),
             (cx, fy + int(30 * s)),
             (cx - int(34 * s), fy - int(10 * s))]
    d.polygon(flame, fill=(242, 169, 59, 235))
    flame_in = [(cx, fy - int(55 * s)),
                (cx + int(18 * s), fy - int(6 * s)),
                (cx, fy + int(20 * s)),
                (cx - int(18 * s), fy - int(6 * s))]
    d.polygon(flame_in, fill=(251, 227, 162, 240))

    # Bowl
    bw = int(150 * s)
    bh = int(52 * s)
    d.pieslice([cx - bw, base_y - bh, cx + bw, base_y + bh], 0, 180, fill=(138, 75, 34, 240))
    d.ellipse([cx - bw, base_y - int(16 * s), cx + bw, base_y + int(16 * s)],
              outline=(201, 162, 39, 240), width=int(8 * s))
    return layer


def crescent_layer(accent):
    """A crescent moon with a few stars (for Eid).

    Built as a mask: a full circle minus an offset circle, so the crescent
    is genuinely transparent in the cut-out region.
    """
    mask = Image.new("L", (SIZE, SIZE), 0)
    md = ImageDraw.Draw(mask)
    cx, cy = SIZE // 2, int(SIZE * 0.40)
    R = int(SIZE * 0.30)
    md.ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    # Offset circle to carve the crescent
    ox = cx + int(R * 0.45)
    oy = cy - int(R * 0.18)
    md.ellipse([ox - int(R * 0.86), oy - int(R * 0.86), ox + int(R * 0.86), oy + int(R * 0.86)], fill=0)

    layer = Image.new("RGBA", (SIZE, SIZE), accent + (225,))
    layer.putalpha(mask)

    # A few small stars
    sd = ImageDraw.Draw(layer)
    for (sx, sy, sr) in [(cx - int(R * 1.15), cy - int(R * 0.7), 10),
                         (cx + int(R * 1.3), cy + int(R * 0.5), 8),
                         (cx - int(R * 0.7), cy + int(R * 1.25), 9)]:
        sd.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(251, 227, 162, 235))
    return layer


def star_layer(accent):
    """An eight-pointed star (for Christmas)."""
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = cy = int(SIZE * 0.40)
    R = int(SIZE * 0.26)
    r = R * 0.42
    pts = []
    for i in range(16):
        ang = math.pi / 8 * i - math.pi / 2
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    d.polygon(pts, fill=accent + (215,))
    return layer


def confetti_layer(colours):
    """Scattered colour dots (for Holi)."""
    import random
    random.seed(7)
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(220):
        x = random.randint(0, SIZE)
        y = random.randint(0, SIZE)
        r = random.randint(5, 16)
        c = random.choice(colours)
        d.ellipse([x - r, y - r, x + r, y + r], fill=c + (random.randint(120, 200),))
    return layer


def paint(name, top, bottom, accent, motif="diya"):
    """Compose one placeholder image and save it as a PNG."""
    img = vgrad(top, bottom)

    # Subtle lattice across the whole canvas
    tile = lattice_tile(accent, alpha=20)
    lattice = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    for ty in range(0, SIZE, 128):
        for tx in range(0, SIZE, 128):
            lattice.alpha_composite(tile, (tx, ty))
    img = Image.alpha_composite(img.convert("RGBA"), lattice)

    # Mandala, nudged slightly upward to leave room for the diya
    man = mandala_layer(accent, opacity=110)
    man = man.transform((SIZE, SIZE), Image.AFFINE, (1, 0, -64, 0, 1, -64))
    img = Image.alpha_composite(img, man)

    if motif == "diya":
        img = Image.alpha_composite(img, diya_layer(accent, scale=1.0))
    elif motif == "crescent":
        crescent_layer(accent)  # placeholder signature
        img = Image.alpha_composite(img, diya_layer(accent, scale=0.8))
    elif motif == "star":
        img = Image.alpha_composite(img, star_layer(accent))
        img = Image.alpha_composite(img, diya_layer(accent, scale=0.7))
    elif motif == "confetti":
        img = Image.alpha_composite(img, confetti_layer([
            (232, 122, 43), (201, 162, 39), (95, 122, 84), (180, 69, 47), (233, 199, 102)
        ]))
        img = Image.alpha_composite(img, diya_layer(accent, scale=0.8))

    # Very light vignette for depth (pure PIL, no numpy):
    # vig is bright in the centre, dark at the edges; invert it to use
    # as the alpha of a dark overlay so only the edges get shaded.
    vig = Image.new("L", (SIZE, SIZE), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse([-SIZE // 4, -SIZE // 4, SIZE * 5 // 4, SIZE * 5 // 4], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(180))
    edge_dark = Image.new("RGBA", (SIZE, SIZE), (13, 10, 6, 110))
    edge_dark.putalpha(vig.point(lambda v: 255 - v))
    img = Image.alpha_composite(img, edge_dark)

    path = os.path.join(IMG_DIR, name)
    if os.path.exists(path):
        return False  # never overwrite existing (real) artwork
    img.save(path, "PNG", optimize=True)
    return True


# ----------------------------------------------------------------------
# Per-theme palettes: (top, bottom, accent, motif)
# ----------------------------------------------------------------------
THEMES = {
    # Festivals
    "fest-diwali.png":      ((13, 27, 51), (30, 22, 58), (227, 199, 102), "diya"),
    "fest-holi.png":        ((250, 244, 230), (242, 214, 178), (232, 122, 43), "confetti"),
    "fest-durgapuja.png":   ((46, 20, 40), (13, 27, 51), (232, 122, 43), "diya"),
    "fest-pongal.png":      ((250, 240, 214), (233, 199, 102), (194, 94, 27), "diya"),
    "fest-onam.png":        ((24, 58, 46), (250, 244, 230), (201, 162, 39), "diya"),
    "fest-baisakhi.png":    ((250, 236, 200), (232, 160, 60), (194, 94, 27), "diya"),
    "fest-navratri.png":    ((58, 22, 66), (13, 27, 51), (233, 106, 140), "diya"),
    "fest-eid.png":         ((13, 27, 51), (22, 40, 74), (227, 199, 102), "crescent"),
    "fest-christmas.png":   ((22, 46, 34), (13, 27, 51), (227, 199, 102), "star"),
    "fest-bihu.png":        ((34, 66, 44), (250, 244, 230), (233, 199, 102), "diya"),
    # Craft gallery
    "craft-kalamkari.png":  ((250, 244, 230), (214, 178, 122), (38, 66, 128), "diya"),
    "craft-phulkari.png":   ((240, 214, 180), (232, 122, 43), (199, 32, 96), "diya"),
    "craft-chikankari.png": ((250, 247, 240), (233, 222, 200), (160, 140, 110), "diya"),
    "craft-dhokra.png":     ((42, 27, 16), (20, 12, 8), (201, 162, 39), "diya"),
    "craft-bluepottery.png":((250, 247, 240), (214, 226, 238), (47, 90, 160), "diya"),
    # Stories
    "story-hampi.png":      ((122, 62, 38), (42, 27, 16), (233, 199, 102), "diya"),
    # Timeline
    "timeline-ivc.png":     ((214, 190, 148), (150, 110, 70), (110, 75, 42), "diya"),
    "timeline-temple.png":  ((46, 28, 60), (232, 140, 60), (233, 199, 102), "diya"),
    "timeline-taj.png":     ((250, 240, 236), (240, 200, 190), (201, 162, 39), "diya"),
    # Regions
    "region-north.png":     ((20, 40, 75), (13, 27, 51), (227, 199, 102), "diya"),
    "region-south.png":     ((24, 58, 46), (13, 27, 51), (233, 199, 102), "diya"),
    "region-east.png":      ((122, 62, 38), (58, 30, 20), (233, 199, 102), "diya"),
    "region-west.png":      ((194, 94, 27), (122, 54, 24), (250, 244, 230), "diya"),
    "region-central.png":   ((58, 74, 44), (24, 40, 26), (233, 199, 102), "diya"),
    "region-northeast.png": ((34, 86, 60), (18, 40, 32), (233, 199, 102), "diya"),
}


def main():
    os.makedirs(IMG_DIR, exist_ok=True)
    created, skipped = 0, 0
    for name, (top, bottom, accent, motif) in THEMES.items():
        if paint(name, top, bottom, accent, motif):
            created += 1
            print("created :", name)
        else:
            skipped += 1
            print("skipped :", name, "(already exists)")
    print(f"\nDone — {created} placeholders created, {skipped} skipped.")


if __name__ == "__main__":
    main()
