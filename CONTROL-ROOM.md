# FlyYab Bale Control Room v1

مسیر پنل:
`https://<worker-domain>/admin`

## ورود
- Secret پیشنهادی Cloudflare: `BALE_ADMIN_WEB_KEY`
- مقدار مورد توافق: `Hooman`
- اگر Secret تعریف نشده باشد، همین نسخه رمز fallback `Hooman` را با مقایسه SHA-256 می‌پذیرد.
- Cookie ورود 12 ساعت، HttpOnly + Secure + SameSite=Strict است.
- امضای Session با `BALE_ADMIN_WEB_KEY` و در نبود آن `WEBHOOK_SECRET` انجام می‌شود.

## قابلیت‌ها
- نمایش Build ID، حالت TEST/LIVE، Automation، Cron، Webhook، بازو و permission کانال.
- تغییر TEST/LIVE از وب.
- بازسازی Webhook.
- Delivery Health امروز.
- جدول 11 Slot عمومی با دکمه تست.
- تست همه ماژول‌های قابل‌تست در Scope مستقل.
- اگر BALE_TEST_CHANNEL_ID تنظیم نشده باشد، پنل هشدار می‌دهد و تست‌ها به BALE_CHANNEL_ID می‌روند.

## نکته Automation
روشن/خاموش‌کردن Cron عمومی همچنان با `BALE_AUTOMATION_ENABLED` در Cloudflare انجام می‌شود. این تصمیم عمداً Env-level مانده تا یک کلیک اشتباه داخل پنل نتواند انتشار زمان‌بندی‌شده را ناخواسته فعال کند.
