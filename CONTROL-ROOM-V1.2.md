# FlyYab Bale Control Room v1.2

## Routing invariant
- Scheduled automation: production channel only.
- Admin panel Test / Test All / Preview: test channel only.
- If `BALE_TEST_CHANNEL_ID` is missing, manual tests are blocked instead of falling back to production.

## AI
- Primary: ArvanCloud AIaaS (`ARVAN_AI_API_KEY`, `ARVAN_AI_ENDPOINT`, model `GPT-4.1-Mini`).
- Fallback: Cloudflare Workers AI binding `AI`.
- Control Room includes a real connection test for both providers.

## Diagnostics
- Infrastructure readiness panel checks Bale, production/test channels, webhook, AI and Durable Object bindings.
- Each post has a configuration diagnostic button.
