"""
TR-SAT Mission Control V4 — Installer bitmap asset generator.
Produces the themed BMP images used by Inno Setup:
  - wizard_side.bmp    164 × 314 px  (left panel banner)
  - wizard_header.bmp   55 ×  55 px  (top-right header icon)

Requires: Pillow  (pip install Pillow)
Run from the installer/ directory or from the build script.
"""

import math
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("[ERROR] Pillow is not installed. Run: pip install Pillow")

# ── Color palette (matches app CSS variables) ─────────────────────────────────
BG_DEEP     = (5,   11,  20)     # #050B14
BG_PANEL    = (8,   18,  34)     # #081222
ACCENT_BLUE = (37,  183, 255)    # #25B7FF
ACCENT_PURP = (124, 92,  255)    # #7C5CFF
MUTED       = (143, 166, 193)    # #8FA6C1
WHITE       = (232, 240, 255)    # #E8F0FF
GRID_LINE   = (20,  40,  65)     # subtle grid
STAR_COLOR  = (200, 220, 255, 150)

OUT_DIR = Path(__file__).parent / "assets"
OUT_DIR.mkdir(exist_ok=True)


def draw_stars(draw: ImageDraw.ImageDraw, w: int, h: int, count: int = 60) -> None:
    """Scatter random-looking star dots using a deterministic pattern."""
    import random
    rng = random.Random(42)
    for _ in range(count):
        x = rng.randint(0, w - 1)
        y = rng.randint(0, h - 1)
        size = rng.choice([1, 1, 1, 2])
        alpha = rng.randint(80, 220)
        color = (*WHITE, alpha) if size == 2 else (*MUTED, alpha)
        draw.ellipse([x, y, x + size, y + size], fill=color)


def draw_orbit_arc(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    angle_deg: float = 0,
    color: tuple = ACCENT_BLUE,
    alpha: int = 90,
    width: int = 1,
    arc_span: int = 280,
    start: int = -140,
) -> None:
    """Draw an elliptical orbit arc (approximated by polygon segments)."""
    rgba = (*color, alpha)
    points = []
    rad = math.radians(angle_deg)
    for deg in range(start, start + arc_span, 2):
        t = math.radians(deg)
        x = cx + rx * math.cos(t) * math.cos(rad) - ry * math.sin(t) * math.sin(rad)
        y = cy + rx * math.cos(t) * math.sin(rad) + ry * math.sin(t) * math.cos(rad)
        points.append((x, y))
    if len(points) > 1:
        for i in range(len(points) - 1):
            draw.line([points[i], points[i + 1]], fill=rgba, width=width)


def draw_satellite_dot(
    draw: ImageDraw.ImageDraw, cx: float, cy: float, color: tuple = ACCENT_BLUE, r: int = 3
) -> None:
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        fill=(*color, 230),
    )


def try_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Try to load a system font; fall back to PIL default."""
    candidates = [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibri.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def try_font_bold(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return try_font(size)


# ─────────────────────────────────────────────────────────────────────────────
# Wizard side banner  164 × 314
# ─────────────────────────────────────────────────────────────────────────────
def make_side_banner() -> None:
    W, H = 164, 314
    img = Image.new("RGBA", (W, H), BG_DEEP)
    draw = ImageDraw.Draw(img)

    # Gradient-like vertical fade from BG_PANEL at top
    for y in range(H // 2):
        t = y / (H // 2)
        r = int(BG_DEEP[0] + (BG_PANEL[0] - BG_DEEP[0]) * (1 - t))
        g = int(BG_DEEP[1] + (BG_PANEL[1] - BG_DEEP[1]) * (1 - t))
        b = int(BG_DEEP[2] + (BG_PANEL[2] - BG_DEEP[2]) * (1 - t))
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Subtle grid
    for x in range(0, W, 20):
        draw.line([(x, 0), (x, H)], fill=(*GRID_LINE, 80), width=1)
    for y in range(0, H, 20):
        draw.line([(0, y), (W, y)], fill=(*GRID_LINE, 80), width=1)

    # Stars
    draw_stars(draw, W, H, 50)

    # Orbital rings (centred at ~55, 145)
    cx, cy = 82, 150
    draw_orbit_arc(draw, cx, cy, 60, 28, angle_deg=20, color=ACCENT_BLUE, alpha=100, width=1, arc_span=300, start=-150)
    draw_orbit_arc(draw, cx, cy, 55, 20, angle_deg=-15, color=ACCENT_PURP, alpha=70, width=1, arc_span=260, start=-130)
    draw_orbit_arc(draw, cx, cy, 70, 14, angle_deg=50, color=MUTED, alpha=50, width=1, arc_span=240, start=-120)

    # Earth circle
    er = 22
    draw.ellipse([cx - er, cy - er, cx + er, cy + er], fill=(*BG_PANEL, 255), outline=(*ACCENT_BLUE, 160), width=2)
    # Inner glow
    draw.ellipse([cx - er + 4, cy - er + 4, cx + er - 4, cy + er - 4], fill=(*ACCENT_BLUE, 20))

    # Satellite dots on orbit
    draw_satellite_dot(draw, cx + 57, cy - 10, ACCENT_BLUE, 3)
    draw_satellite_dot(draw, cx - 52, cy + 12, ACCENT_PURP, 2)
    draw_satellite_dot(draw, cx + 18, cy - 26, WHITE, 2)

    # Separator line above logo area
    draw.line([(12, 238), (W - 12, 238)], fill=(*ACCENT_BLUE, 60), width=1)

    # Logo text: TR-SAT
    font_logo = try_font_bold(28)
    font_sub  = try_font(9)
    font_ver  = try_font(8)
    font_tag  = try_font(7)

    # "TR-SAT"
    draw.text((W // 2, 252), "TR-SAT", font=font_logo, fill=WHITE, anchor="mm")
    # Accent bar under logo
    draw.line([(W // 2 - 30, 268), (W // 2 + 30, 268)], fill=(*ACCENT_BLUE, 180), width=1)
    # Subtitle
    draw.text((W // 2, 276), "MISSION CONTROL", font=font_sub, fill=MUTED, anchor="mm")
    draw.text((W // 2, 288), "SGP4 · LOCAL-FIRST", font=font_tag, fill=(*MUTED, 160), anchor="mm")
    # Version
    draw.text((W // 2, 300), "v4.0.0", font=font_ver, fill=(*ACCENT_BLUE, 200), anchor="mm")

    # Top tag
    draw.text((W // 2, 18), "ORBITAL INTELLIGENCE", font=font_tag, fill=(*ACCENT_BLUE, 140), anchor="mm")

    # Convert RGBA → RGB for BMP
    out = img.convert("RGB")
    path = OUT_DIR / "wizard_side.bmp"
    out.save(path, format="BMP")
    print(f"  OK {path}  ({W}x{H})")


# ─────────────────────────────────────────────────────────────────────────────
# Wizard header icon  55 × 55
# ─────────────────────────────────────────────────────────────────────────────
def make_header_icon() -> None:
    W, H = 55, 55
    img = Image.new("RGBA", (W, H), BG_DEEP)
    draw = ImageDraw.Draw(img)

    cx, cy = W // 2, H // 2

    # Outer ring
    draw.ellipse([4, 4, W - 5, H - 5], outline=(*ACCENT_BLUE, 160), width=2)
    # Inner ring
    draw.ellipse([10, 10, W - 11, H - 11], outline=(*ACCENT_PURP, 100), width=1)
    # Earth
    draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8],
                 fill=BG_PANEL, outline=(*ACCENT_BLUE, 200), width=1)

    # Mini orbit arc
    draw_orbit_arc(draw, cx, cy, 20, 8, angle_deg=25,
                   color=ACCENT_BLUE, alpha=150, width=1, arc_span=250, start=-125)
    draw_satellite_dot(draw, cx + 19, cy - 4, ACCENT_BLUE, 2)

    out = img.convert("RGB")
    path = OUT_DIR / "wizard_header.bmp"
    out.save(path, format="BMP")
    print(f"  OK {path}  ({W}x{H})")


if __name__ == "__main__":
    print("Generating TR-SAT installer assets...")
    make_side_banner()
    make_header_icon()
    print("Done.")
