# FlyYab Bale V1.1.0 — FINAL + Web Control Room

مبنای محتوا و زمان‌بندی: Telegram V6.9.1

## Live-verified transport
- Text ✅
- Photo multipart ✅
- Album / sendMediaGroup multipart ✅
- Inline Button ✅
- Webhook ✅
- CallbackQuery ✅
- EditMessageText ✅
- پست واقعی پرواز خارجی با لینک FlyYab ✅

## Web Control Room
- مسیر: `/admin`
- رمز fallback: `Hooman` (در کد به‌صورت SHA-256 verifier)
- پیشنهاد Production: تعریف Secret با نام `BALE_ADMIN_WEB_KEY`
- Login session: 12h / HttpOnly / Secure / SameSite=Strict
- Dashboard: Build, TEST/LIVE, Automation, Cron, Webhook, Channel permissions
- Delivery Health امروز
- تست تک‌تک Slotهای روزانه
- تست همه پست‌های قابل تست
- بازسازی Webhook
- مدیریت TEST/LIVE
- اگر BALE_TEST_CHANNEL_ID خالی باشد، پنل قبل از تست هشدار می‌دهد و مقصد تست کانال اصلی است.

## Safety
- `BALE_AUTOMATION_ENABLED` از داخل پنل تغییر نمی‌کند.
- فعال‌سازی انتشار زمان‌بندی‌شده همچنان Env-level است تا کلیک اشتباه پنل Cron عمومی را روشن نکند.
- تست‌های وب در Execution Scope مستقل اجرا می‌شوند.
