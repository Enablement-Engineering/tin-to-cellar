"""Review-only guides. Requires Pillow. Never changes the source artwork."""
import argparse
import hashlib
import math
import os
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw


def render(source, output, shape="circle", width=2.5, height=2.5,
           bleed=0.125, safe=0.125):
    source, output = Path(source), Path(output)
    values = (width, height, bleed, safe)
    if not all(math.isfinite(v) for v in values):
        raise ValueError("Geometry must be finite")
    if width <= 0 or height <= 0 or bleed < 0 or safe < 0:
        raise ValueError("Invalid geometry")
    if 2 * safe >= min(width, height):
        raise ValueError("Safe inset leaves no usable area")
    if shape not in ("circle", "rectangle") or (shape == "circle" and width != height):
        raise ValueError("Use a circle with equal dimensions or a rectangle")
    if source.resolve() == output.resolve() or output.exists():
        raise ValueError("Choose a new output path; never overwrite artwork or proofs")
    with Image.open(source) as opened:
        if opened.format != "PNG" or min(opened.size) < 1 or max(opened.size) > 8192:
            raise ValueError("Expected a PNG no larger than 8192px per side")
        im = opened.convert("RGBA")
    w, h = im.size
    cw, ch = width + 2 * bleed, height + 2 * bleed
    if abs((w / h) / (cw / ch) - 1) > 0.005:
        raise ValueError("Artwork aspect ratio does not match trim plus bleed")
    sx, sy = w / cw, h / ch
    def box(inset):
        return (inset * sx, inset * sy,
                (cw - inset) * sx - 1, (ch - inset) * sy - 1)
    trim, inner = box(bleed), box(bleed + safe)
    # Shade only the bleed ring, including outside-trim rectangle margins.
    ring = Image.new("L", im.size, 0)
    mask = ImageDraw.Draw(ring)
    draw_shape = mask.ellipse if shape == "circle" else mask.rectangle
    draw_shape(box(0), fill=65)
    draw_shape(trim, fill=0)
    shade = Image.new("RGBA", im.size, (255, 165, 0, 0))
    shade.putalpha(ring)
    proof = Image.alpha_composite(im, shade)
    pen = ImageDraw.Draw(proof)
    stroke = max(1, round(min(w, h) / 500))
    cyan, magenta = (0, 200, 255, 255), (230, 0, 180, 255)
    if shape == "circle":
        pen.ellipse(trim, outline=cyan, width=stroke)
        for angle in range(0, 360, 12):
            pen.arc(inner, angle, angle + 7, fill=magenta, width=stroke)
    else:
        pen.rectangle(trim, outline=cyan, width=stroke)
        x0, y0, x1, y1 = inner
        dash = max(4, round(min(w, h) / 60))
        for x in range(round(x0), round(x1) + 1, dash * 2):
            for y in (y0, y1):
                pen.line((x, y, min(x + dash, x1), y), fill=magenta, width=stroke)
        for y in range(round(y0), round(y1) + 1, dash * 2):
            for x in (x0, x1):
                pen.line((x, y, x, min(y + dash, y1)), fill=magenta, width=stroke)
    # Publish only a completely encoded, decoded proof; never replace a file.
    fd, temporary = tempfile.mkstemp(dir=output.parent, prefix=".proof-", suffix=".png")
    try:
        with os.fdopen(fd, "wb") as target:
            proof.save(target, format="PNG")
        with Image.open(temporary) as checked:
            checked.load()
            if checked.format != "PNG" or checked.size != im.size:
                raise ValueError("Invalid proof output")
        os.link(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return {"trim": trim, "safe": inner, "pixels": (w, h),
            "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "proof_sha256": hashlib.sha256(output.read_bytes()).hexdigest()}


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("source")
    p.add_argument("output")
    p.add_argument("--shape", choices=("circle", "rectangle"), default="circle")
    for name, default in (("width", 2.5), ("height", 2.5), ("bleed", .125), ("safe", .125)):
        p.add_argument("--" + name, type=float, default=default)
    args = vars(p.parse_args())
    print(render(**args))
