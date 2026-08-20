# FlyYab Bale Control Room V2

## Architecture invariant
The Bale bot preserves the scheduling/content/state architecture of the FlyYab reference bot.
Only the transport/admin surface is adapted to Bale and the web Control Room.

## Runtime Automation
- `BALE_AUTOMATION_ENABLED` is the boot default only.
- Start/Stop is persisted in `BOT_CONTROL` under `automation-control-v1`.
- Cron and autonomous coordinator both consult the same runtime state.
- Start performs a production preflight and bootstraps the coordinator.
- Stop disables the coordinator alarm immediately.
- Dispatcher Preview is a dry run and never publishes.

## Production vs Test
- Scheduled jobs always use the production execution scope/channel.
- Manual Test/Preview operations use sandbox state and the Bale test channel.

## Scheduler
The original 5-minute dispatcher architecture is preserved: Weather sliced scan/final lock,
Radar independent cadence, prepare/lock jobs, public SEND-only slots, watchdog/recovery and
duplicate guards.
