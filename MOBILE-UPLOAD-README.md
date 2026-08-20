# FlyYab Bale Bot v1.0.4 RC3.2 — Media Upload Fix

Fix:
- sendPhoto live gate no longer asks Bale to download the Wikimedia URL directly.
- Cloudflare Worker downloads the image and uploads the binary to Bale as multipart/form-data.
- Photo gate errors are returned as JSON instead of Cloudflare 1101.

Safety:
- BALE_AUTOMATION_ENABLED must remain 0 during Live Gate.
