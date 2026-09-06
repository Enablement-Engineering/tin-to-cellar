# Local proof renderer

`local-proof.py` is the source embedded verbatim in protocol releases by
`npm run protocol:release`. Changing it requires a new protocol revision.
The renderer creates a separate review PNG; the artwork is never overwritten.

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
invalid dimensions and output overwrite rejection. They do not certify artwork
fidelity or a human-readable writing surface; the generating agent must inspect
the rendered proof against the original package.
