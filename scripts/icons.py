"""Ikony appky: tmavé pole a červené návěstí."""
import pathlib, sys
from PIL import Image, ImageDraw
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
def icon(size, pad, radius):
    s = size * 4
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius), fill="#131C2E")
    c, r = s / 2, s * (0.5 - pad) * 0.62
    d.ellipse([c - r * 1.42, c - r * 1.42, c + r * 1.42, c + r * 1.42], outline="#2E3C58", width=int(s * 0.035))
    d.ellipse([c - r, c - r, c + r, c + r], fill="#E5342B")
    d.ellipse([c - r * 0.55, c - r * 0.62, c - r * 0.1, c - r * 0.17], fill="#FF8B80")
    return im.resize((size, size), Image.LANCZOS)
icon(192, 0.08, 0.22).save(out / "icon-192.png")
icon(512, 0.08, 0.22).save(out / "icon-512.png")
icon(512, 0.2, 0.0).save(out / "icon-maskable-512.png")
icon(180, 0.1, 0.0).convert("RGB").save(out / "apple-touch-icon.png")
