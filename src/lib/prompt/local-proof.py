"""Review-only guides. Requires Pillow. Never changes the source artwork."""
import argparse
import hashlib
import json
import math
import os
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw


def publish(im, output):
    output = Path(output)
    fd, temporary = tempfile.mkstemp(dir=output.parent, prefix=".proof-", suffix=".png")
    try:
        with os.fdopen(fd, "wb") as target:
            im.save(target, format="PNG")
        with Image.open(temporary) as checked:
            checked.load()
            if checked.format != "PNG" or checked.size != im.size:
                raise ValueError("Invalid proof output")
        os.link(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)


def check_regions(regions, pixels, safe_box, shape):
    if regions is None:
        return []
    if not isinstance(regions, list) or not 2 <= len(regions) <= 100:
        raise ValueError("Supply 2-100 regions covering text and one writing panel")
    results, names = [], set()
    left, top, right, bottom = safe_box
    if right <= left or bottom <= top:
        raise ValueError("Safe area is smaller than one pixel")
    cx, cy = (left + right) / 2, (top + bottom) / 2
    rx, ry = (right - left) / 2, (bottom - top) / 2
    for region in regions:
        if not isinstance(region, dict) or set(region) != {"name", "kind", "box"}:
            raise ValueError("Each region requires only name, kind and box")
        name, kind, bounds = region["name"], region["kind"], region["box"]
        if not isinstance(name, str) or not name.strip() or len(name) > 80 or name in names:
            raise ValueError("Region names must be nonempty, unique and at most 80 characters")
        if kind not in ("text", "panel"):
            raise ValueError("Region kind must be text or panel")
        if not isinstance(bounds, list) or len(bounds) != 4 or not all(
                type(v) in (int, float) and math.isfinite(v) for v in bounds):
            raise ValueError("box requires four finite pixel coordinates")
        x0, y0, x1, y1 = bounds
        if not (0 <= x0 < x1 <= pixels[0] - 1 and 0 <= y0 < y1 <= pixels[1] - 1):
            raise ValueError("Region box must have positive size inside the image")
        corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        outside = [i for i, (x, y) in enumerate(corners) if
                   (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1
                    if shape == "circle" else not (left <= x <= right and top <= y <= bottom))]
        results.append({**region, "inside_safe": not outside, "outside_corners": outside})
        names.add(name)
    if sum(r["kind"] == "panel" for r in results) != 1 or not any(r["kind"] == "text" for r in results):
        raise ValueError("Include text regions and exactly one writing panel")
    return results


def render(source, output, shape="circle", width=2.5, height=2.5,
           bleed=0.125, safe=0.125, regions=None):
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
    results = check_regions(regions, im.size, inner, shape)
    review = output.with_name(output.stem + "-regions.png")
    crops = [output.with_name(output.stem + f"-region-{i + 1:03}.png") for i in range(len(results))]
    if results and any(p.exists() or p.resolve() == source.resolve() for p in [review, *crops]):
        raise ValueError("Choose new review and crop output paths")
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
    publish(proof, output)
    if results:
        annotated = proof.copy()
        marks = ImageDraw.Draw(annotated)
        for i, (result, crop_path) in enumerate(zip(results, crops)):
            x0, y0, x1, y1 = result["box"]
            color = "lime" if result["inside_safe"] else "red"
            marks.rectangle((x0, y0, x1, y1), outline=color, width=stroke)
            marks.text((x0, y0), str(i + 1), fill=color, stroke_width=1, stroke_fill="black")
            # Review-only crop includes padding to reveal underestimated bounds.
            crop_box = (max(0, math.floor(x0) - 12), max(0, math.floor(y0) - 12),
                        min(w, math.ceil(x1) + 13), min(h, math.ceil(y1) + 13))
            crop = annotated.crop(crop_box)
            scale = min(2, 2048 / max(crop.size))
            crop = crop.resize(tuple(max(1, round(v * scale)) for v in crop.size))
            publish(crop, crop_path)
            result["crop"] = crop_path.name
        publish(annotated, review)
    return {"trim": trim, "safe": inner, "pixels": (w, h),
            "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "proof_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            "regions": results, "declared_regions_inside_safe": all(r["inside_safe"] for r in results) if results else None,
            "region_review": review.name if results else None}


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("source")
    p.add_argument("output")
    p.add_argument("--shape", choices=("circle", "rectangle"), default="circle")
    p.add_argument("--regions", help="JSON inventory of all text boxes and one writing panel")
    for name, default in (("width", 2.5), ("height", 2.5), ("bleed", .125), ("safe", .125)):
        p.add_argument("--" + name, type=float, default=default)
    args = vars(p.parse_args())
    if args["regions"]:
        args["regions"] = json.loads(Path(args["regions"]).read_text(encoding="utf-8"))
    result = render(**args)
    print(json.dumps(result))
    if result["declared_regions_inside_safe"] is False:
        raise SystemExit(1)
