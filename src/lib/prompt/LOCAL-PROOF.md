# Local artwork preparation and proof

`local-proof.py` is embedded verbatim in protocol releases by
`npm run protocol:release`. Changing it requires a new protocol revision. The
published script hash covers UTF-8, LF line endings and exactly one final
newline.

The `prepare` command converts a tagged source to sRGB, or records an explicit
sRGB assumption for untagged RGB input. It writes a static 8-bit RGB/RGBA PNG
with an `sRGB` chunk and no embedded ICC profile. It does not resize and clears
only outside the outer bleed circle for circular artwork.

The `inspect` command creates a separate review PNG. It returns source, proof,
encoding, opacity, and region evidence without overwriting the prepared artwork.

Preparation converts color values through an embedded ICC profile before removing
that profile. For untagged RGB input, use `--assume-srgb` only when that assumption
is explicitly recorded. Serialization is checked against the prepared pixels;
color conversion and clearing outside the bleed circle may change native pixels.

The receipt reports `canonical_encoding` and `gallery_input_limits` separately.
The current gallery envelope requires both dimensions between 825 and 2048 pixels
and a file no larger than 8 MiB. Exceeding that envelope is a sharing limitation,
not by itself a print failure. These checks do not establish live import acceptance,
source eligibility or gallery approval. Inspection rejects noncanonical PNGs and
transparency inside the bleed boundary.

Run the pixel, geometry, preservation and invalid-input tests:

```sh
uv run --with pillow src/lib/prompt/test_local_proof.py
```

For a sandbox without access to the default uv cache, prefix that command with
`UV_CACHE_DIR=/tmp/tin-proof-uv-cache`.

Test generated instructions and their HTML delivery:

```sh
npm test -- src/lib/prompt src/lib/protocol worker/protocol.test.ts
```

The tests cover canonical PNG chunks, lossless serialization, gallery input
limits, circles and rectangles, measured trim/safe bounds, guide pixels, bleed
shading, unchanged interior pixels and source bytes, aspect-ratio rejection,
invalid dimensions and output overwrite rejection. An interrupted encode must
leave neither a final proof nor a temporary file. Tests do not certify artwork
fidelity or a human-readable writing surface; the generating agent must inspect
the rendered proof against the original package.

Region review uses `inspect ... --regions regions.json`, a list of unique names, `kind`
(`text` or `panel`) and inclusive pixel `box` coordinates `[left, top, right,
bottom]`. Supply every visible text region and exactly one writing panel.
The script checks declared corners against safe geometry; any outside region
returns CLI status 1 while keeping the proof available for inspection. It also
creates a numbered region review and padded crops beside the original guide
proof. These are review artifacts, never printing artwork.

Measured regression boxes reproduce the Westminster maker and Orlik side-copy
overflows seen in the revision 11 run; the writing panel passes. Tests also check
invalid coordinates, decoded nonempty review/crops, source preservation and CLI
failure status. There is no OCR: missing or underestimated boxes remain a human/
agent measurement limitation. Bounding rectangles are deliberately conservative
for curved lettering. Inspect crop padding and the full artwork to check coverage.

Example:

```sh
uv run --with pillow local-proof.py prepare native.png final.png --assume-srgb
uv run --with pillow local-proof.py inspect final.png proof.png --regions regions.json
```
