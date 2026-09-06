# CellarPack specification

The canonical [CellarPack v1 specification](../public/spec/cellarpack-v1.md) and [JSON schema](../public/spec/cellarpack-v1.schema.json) define the import format.

Artwork owns the entire blank writing surface. Its geometry uses the finished trim bounding box, remains unrotated, and stays inside the safe area. The overlay object contains only `"mode": "blank"`; the website adds no words, lines, or dates.
