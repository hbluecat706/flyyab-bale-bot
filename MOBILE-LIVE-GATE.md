# FlyYab Bale Bot v1.0.2 RC3 — Mobile Live Gate

Independent project based on FlyYab Telegram V6.9.1.

## Safety
- BALE_AUTOMATION_ENABLED=0 by default.
- Cron remains configured but is inert while automation is disabled.
- Do not enable automation until every live gate below passes.

## Cloudflare bindings
Secrets:
- BALE_BOT_TOKEN
- BALE_TEST_KEY
- WEBHOOK_SECRET

Plain text:
- BALE_CHANNEL_ID=5254814488
- BALE_PRODUCTION_CHANNEL_ID=5254814488
- BALE_AUTOMATION_ENABLED=0

Optional:
- BALE_TEST_CHANNEL_ID=<separate Bale test channel id>

Copy the content/API secrets required by the Telegram V6.9.1 logic into this independent Bale Worker where applicable. Do not share Durable Object state with Telegram.

## Live gate base
https://flyyab-bale-bot.hbluecat706.workers.dev

Run:
- /__bale-gate?key=<BALE_TEST_KEY>&action=preflight
- action=message
- action=photo
- action=album
- action=button
- press callback button in Bale
- action=edit

Then real post gates:
- action=post&type=morning
- action=post&type=weather
- action=post&type=rates
- action=post&type=flights
- action=post&type=deal
- action=post&type=international
- action=post&type=article
- action=post&type=album
- action=post&type=heritage
- action=post&type=occasion

Only after visual verification set BALE_AUTOMATION_ENABLED=1.
