# FlyYab Bale v1.0.5 RC3.3
Photo Live Gate is now deterministic:
- no external image URL
- Worker generates a small SVG itself
- uploads it directly to Bale using multipart/form-data
- errors return as JSON
Keep BALE_AUTOMATION_ENABLED=0.
