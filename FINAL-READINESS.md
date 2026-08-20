# FlyYab Bale V1.0.9 FINAL — Release Readiness

Reference core: FlyYab Telegram V6.9.1.

Verified live on Bale channel:
- Text + Persian/RTL + Markdown adapter
- Photo multipart upload
- Album / sendMediaGroup multipart attach://
- Inline buttons and FlyYab links
- Webhook
- CallbackQuery acknowledgement
- editMessageText
- Real international fares post with route links, dates, prices and IATA codes

Safety / deployment:
- BALE_AUTOMATION_ENABLED defaults to 0
- Cron trigger remains */5 * * * *
- Scheduled dispatcher is gated by BALE_AUTOMATION_ENABLED
- Telegram project is independent and is not modified by this package

Required runtime secrets/vars in Cloudflare:
- BALE_BOT_TOKEN (Secret)
- BALE_CHANNEL_ID = 5254814488
- BALE_TEST_KEY (Secret, optional after live-gate closure but recommended while testing)
- WEBHOOK_SECRET (Secret)
- AI/provider secrets already required by the migrated V6.9.1 modules

Activation procedure:
1. Deploy and verify root buildId.
2. Verify getWebhookInfo points to /bale/<WEBHOOK_SECRET>.
3. Keep BALE_AUTOMATION_ENABLED=0 during smoke check.
4. Only after approval, set BALE_AUTOMATION_ENABLED=1.
