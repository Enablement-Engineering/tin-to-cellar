"""Prepare canonical label PNGs and render review-only guides. Requires Pillow."""
import argparse
import hashlib
import io
import json
import math
import os
import struct
import tempfile
import warnings
import zlib
from pathlib import Path
from PIL import Image, ImageChops, ImageCms, ImageDraw
from PIL.PngImagePlugin import PngInfo


MAX_BYTES = 50 * 1024**2
MAX_SIDE = 8192
GALLERY_INPUT_BYTES = 8 * 1024**2


def png_bytes(image, **kwargs):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", **kwargs)
    data = buffer.getvalue()
    with Image.open(io.BytesIO(data)) as checked:
        checked.load()
        if checked.format != "PNG" or checked.size != image.size:
            raise ValueError("PNG publication check failed")
    return data


def png_export_checks(data):
    """Validate the narrow PNG encoding accepted by the gallery decoder."""
    details = {"canonical_encoding": "FAIL", "gallery_input_limits": "FAIL"}
    try:
        if len(data) > MAX_BYTES or data[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError("Expected a bounded PNG")
        offset, types, width, height = 8, [], 0, 0
        seen_data = ended_data = ended = False
        allowed = {b"IHDR", b"sRGB", b"pHYs", b"IDAT", b"IEND"}
        while offset < len(data):
            if offset + 12 > len(data):
                raise ValueError("Truncated PNG chunk")
            length = struct.unpack_from(">I", data, offset)[0]
            end = offset + length + 12
            if end > len(data):
                raise ValueError("PNG chunk exceeds file")
            kind, body = data[offset + 4:offset + 8], data[offset + 8:end - 4]
            expected_crc = struct.unpack_from(">I", data, end - 4)[0]
            if zlib.crc32(data[offset + 4:end - 4]) & 0xffffffff != expected_crc:
                raise ValueError("PNG CRC mismatch")
            if kind not in allowed:
                raise ValueError("Noncanonical PNG chunk: " + kind.decode("ascii", errors="replace"))
            if not types and kind != b"IHDR":
                raise ValueError("IHDR must be first")
            if kind == b"IHDR":
                if types or length != 13:
                    raise ValueError("Invalid IHDR")
                width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", body)
                if not (1 <= width <= MAX_SIDE and 1 <= height <= MAX_SIDE and depth == 8
                        and color in (2, 6) and compression == filtering == interlace == 0):
                    raise ValueError("Expected non-interlaced 8-bit RGB/RGBA")
            elif kind == b"sRGB":
                if seen_data or kind in types or length != 1 or body[0] > 3:
                    raise ValueError("Invalid sRGB declaration")
            elif kind == b"pHYs":
                if seen_data or kind in types or length != 9 or body[-1] not in (0, 1):
                    raise ValueError("Invalid physical-resolution metadata")
            elif kind == b"IDAT":
                if ended_data:
                    raise ValueError("Noncontiguous IDAT")
                seen_data = True
            elif kind == b"IEND":
                if not seen_data or length or end != len(data):
                    raise ValueError("Invalid IEND or trailing bytes")
                ended = True
            if seen_data and kind != b"IDAT":
                ended_data = True
            types.append(kind)
            offset = end
        if not ended or types.count(b"sRGB") != 1:
            raise ValueError("Missing IEND or explicit sRGB declaration")
        gallery_size = 825 <= width <= 2048 and 825 <= height <= 2048 and len(data) <= GALLERY_INPUT_BYTES
        details.update(canonical_encoding="PASS", chunks=[kind.decode("ascii") for kind in types],
                       width=width, height=height, bytes=len(data),
                       gallery_input_limits="PASS" if gallery_size else "FAIL")
    except (ValueError, struct.error) as error:
        details["reason"] = str(error)
    details["scope"] = "Local encoding and size checks only; not website acceptance or gallery approval"
    return details


def snapshot(path):
    data = Path(path).read_bytes()
    if len(data) > MAX_BYTES:
        raise ValueError("Input exceeds 50 MiB")
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data)) as opened:
            if opened.format not in {"PNG", "JPEG", "WEBP"}:
                raise ValueError("Use a native PNG, JPEG, or WebP")
            if min(opened.size) < 1 or max(opened.size) > MAX_SIDE:
                raise ValueError("Image dimensions outside 1..8192")
            if getattr(opened, "n_frames", 1) != 1:
                raise ValueError("Animated images are not supported")
            opened.load()
            return data, opened.copy(), dict(opened.info), opened.format


def srgb_profile():
    return ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


def circle_mask(width, height):
    if width != height:
        raise ValueError("Circular artwork requires a square native image")
    mask = Image.new("L", (width, height), 0)
    pen = ImageDraw.Draw(mask)
    center, radius = width / 2, width / 2
    for y in range(height):
        delta = radius**2 - (y + .5 - center)**2
        if delta < 0:
            continue
        half = math.sqrt(delta)
        x0 = max(0, math.ceil(center - half - .5))
        x1 = min(width - 1, math.floor(center + half - .5))
        if x0 <= x1:
            pen.line((x0, y, x1, y), fill=255)
    return mask


def publish_bytes(data, output):
    output = Path(output)
    fd, temporary = tempfile.mkstemp(dir=output.parent, prefix=".proof-", suffix=".png")
    try:
        with os.fdopen(fd, "wb") as target:
            target.write(data)
            target.flush()
            os.fsync(target.fileno())
        os.link(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)


def prepare(source, output, shape="circle", width=2.5, height=2.5,
            bleed=0.125, assume_srgb=False):
    source, output = Path(source), Path(output)
    if source.resolve() == output.resolve() or output.exists():
        raise ValueError("Choose a new output path; never overwrite artwork")
    if shape not in ("circle", "rectangle") or width <= 0 or height <= 0 or bleed < 0:
        raise ValueError("Use valid circle or rectangle geometry")
    if shape == "circle" and width != height:
        raise ValueError("Circular artwork requires equal width and height")
    data, image, info, _ = snapshot(source)
    canvas_width, canvas_height = width + 2 * bleed, height + 2 * bleed
    if abs((image.width / image.height) / (canvas_width / canvas_height) - 1) > .005:
        raise ValueError("Artwork aspect ratio does not match trim plus bleed")
    alpha = image.convert("RGBA").getchannel("A")
    target = ImageCms.ImageCmsProfile(io.BytesIO(srgb_profile()))
    if info.get("icc_profile"):
        source_profile = ImageCms.ImageCmsProfile(io.BytesIO(info["icc_profile"]))
        work = image if image.mode in {"RGB", "CMYK", "LAB", "L"} else image.convert("RGB")
        rgb = ImageCms.profileToProfile(work, source_profile, target, outputMode="RGB")
        color_action = "Converted embedded ICC profile to sRGB with color management"
    elif "srgb" in info and image.mode in {"RGB", "RGBA", "P"}:
        rgb = image.convert("RGB")
        color_action = "Preserved declared PNG sRGB interpretation"
    elif assume_srgb and image.mode in {"RGB", "RGBA", "P"}:
        rgb = image.convert("RGB")
        color_action = "Assumed sRGB for untagged RGB output; source colorimetry was not independently verified"
    else:
        raise ValueError("Unknown color space; supply a valid profile or explicitly use --assume-srgb for untagged RGB")
    final = rgb.convert("RGBA")
    if shape == "circle":
        final.putalpha(ImageChops.multiply(alpha, circle_mask(image.width, image.height)))
    else:
        final.putalpha(alpha)
    final.info.clear()
    metadata = PngInfo()
    metadata.add(b"sRGB", b"\x00")
    result = png_bytes(final, pnginfo=metadata, icc_profile=None,
                       dpi=(image.width / canvas_width, image.height / canvas_height), optimize=True)
    export = png_export_checks(result)
    if export["canonical_encoding"] != "PASS":
        raise ValueError("Prepared PNG failed canonical export checks: " + str(export))
    with Image.open(io.BytesIO(result)) as decoded:
        decoded.load()
        if decoded.mode != "RGBA" or decoded.tobytes() != final.tobytes():
            raise ValueError("Lossless PNG serialization changed prepared pixels")
    publish_bytes(result, output)
    return {"source_sha256": hashlib.sha256(data).hexdigest(),
            "final_sha256": hashlib.sha256(result).hexdigest(),
            "pixels": list(final.size), "color_action": color_action,
            "alpha_action": "Cleared only outside the outer bleed circle" if shape == "circle" else "Preserved source alpha",
            "resized": False, "export_checks": export,
            "serialization_preserved_prepared_pixels": True}


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
    data, opened, _, image_format = snapshot(source)
    if image_format != "PNG":
        raise ValueError("Run prepare first and inspect its PNG output")
    export = png_export_checks(data)
    if export["canonical_encoding"] != "PASS":
        raise ValueError("Run prepare first; artwork PNG does not use the canonical export")
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
    alpha = im.getchannel("A")
    if shape == "circle":
        interior = circle_mask(w, h)
        opacity_deficit = ImageChops.multiply(ImageChops.invert(alpha), interior)
        opaque_inside_bleed = opacity_deficit.getbbox() is None
    else:
        opaque_inside_bleed = alpha.getextrema() == (255, 255)
    if not opaque_inside_bleed:
        raise ValueError("Artwork has transparency inside the bleed boundary")
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
            "export_checks": export, "opaque_inside_bleed": True,
            "regions": results, "declared_regions_inside_safe": all(r["inside_safe"] for r in results) if results else None,
            "region_review": review.name if results else None}


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    commands = p.add_subparsers(dest="command", required=True)
    prepare_parser = commands.add_parser("prepare")
    inspect_parser = commands.add_parser("inspect")
    for parser in (prepare_parser, inspect_parser):
        parser.add_argument("source")
        parser.add_argument("output")
        parser.add_argument("--shape", choices=("circle", "rectangle"), default="circle")
        for name, default in (("width", 2.5), ("height", 2.5), ("bleed", .125)):
            parser.add_argument("--" + name, type=float, default=default)
    prepare_parser.add_argument("--assume-srgb", action="store_true")
    inspect_parser.add_argument("--safe", type=float, default=.125)
    inspect_parser.add_argument("--regions", help="JSON inventory of all text boxes and one writing panel")
    args = vars(p.parse_args())
    command = args.pop("command")
    if command == "prepare":
        result = prepare(**args)
    else:
        if args["regions"]:
            args["regions"] = json.loads(Path(args["regions"]).read_text(encoding="utf-8"))
        result = render(**args)
    print(json.dumps(result))
    if command == "inspect" and result["declared_regions_inside_safe"] is False:
        raise SystemExit(1)
