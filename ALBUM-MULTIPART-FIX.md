# FlyYab Bale V1.5.2 — Night + Heritage Album Multipart Fix

## Root cause
Both Night Destination and Heritage365 built valid content packages, but their Bale transport still passed
remote Wikimedia/Pexels URLs directly to Bale `sendMediaGroup`. This is not the transport path proven by the
Bale Live Gate.

## Fix
- Night Destination: download each selected remote image in Worker, validate image type/size, send with
  multipart `sendMediaGroup` using `attach://photo_N`.
- Single-image Night Destination: multipart `sendPhoto`.
- Heritage365: reuse the existing robust `downloadHeritageImage()` and upload the 5–8 selected images
  as one multipart album.
- No changes to destination selection, AI, editorial copy, catalogs, image-source policy, captions,
  timing, State, history, or formatting.

## Control Room
Real diagnostics added for Night Destination and Heritage365:
STATE → PACKAGE → IMAGES → CAPTION → IMAGE_FETCH.
