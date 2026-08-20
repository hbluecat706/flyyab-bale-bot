# Bale formatting restore — V1.5.1

Root cause: V1.4/V1.5 accidentally changed 45 server-side content builders from real newline delimiters to literal backslash+n delimiters. Bale therefore displayed `\n` in captions/messages.

Fix: restore those 45 server-side joins only. Browser-side Control Room escaping is intentionally left unchanged.

Preserved:
- Control Room V3
- Runtime Automation
- Manual Test Center
- Sandbox test channel
- Weather 420 architecture
- Radar
- Navasan + Pexels + Bale multipart
- Watchdog / Recovery / Duplicate Guard
