# Local proof renderer

`local-proof.py` is the source embedded verbatim in protocol releases by
`npm run protocol:release`. Changing it requires a new protocol revision.
The renderer creates a separate review PNG; the artwork is never overwritten.
The published script hash covers UTF-8, LF line endings and exactly one final
newline. Execution returns source and proof hashes for matching the review to
the final artwork. Output is decoded before atomic, non-overwriting publication.

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

The tests cover circles and rectangles, measured trim/safe bounds, guide pixels,
bleed shading, unchanged interior pixels and source bytes, aspect-ratio rejection,
invalid dimensions and output overwrite rejection. An interrupted encode must
leave neither a final proof nor a temporary file. Tests do not certify artwork
fidelity or a human-readable writing surface; the generating agent must inspect
the rendered proof against the original package.

Region review uses `--regions regions.json`, a list of unique names, `kind`
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
