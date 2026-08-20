# FlyYab Bale Control Room V3

## Operating rule
- Scheduled Automation stays independent and publishes through the production scope/channel.
- Every manual Test action uses sandbox execution state and BALE_TEST_CHANNEL_ID.
- A manual test never disables or changes Automation.

## Manual Test Center
All 11 scheduled rows are visible in one mobile-first test center.
For normal posts, Test waits for the real Bale result and reports SENT/FAILED, elapsed time and message ID.
Weather preserves the reference sliced architecture: a test sends only when today's package is READY; otherwise it reports PREPARING and scan progress.

## Reference architecture retained
Morning, Weather 420, Occasion, Rates/Navasan/Pexels, domestic fares, Domestic Radar,
International fares, Blog, Night Destination, Heritage, scheduler heartbeat, watchdog,
recovery, duplicate guard and runtime Automation are retained.
