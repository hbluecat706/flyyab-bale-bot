// FlyYab Bale V0.1 — Live Flights Test
// Purpose: minimal, isolated proof that a real FlyYab live-data post can publish to Bale.

const BALE_API = "https://tapi.bale.ai";
const DEFAULT_CHANNEL_ID = 5254814488;

const CITY = {
  MHD: "مشهد",
  KIH: "کیش",
  SYZ: "شیراز",
  TBZ: "تبریز",
  AWZ: "اهواز",
  ABD: "آبادان",
  KER: "کرمان",
  KSH: "کرمانشاه",
  IFN: "اصفهان",
  BND: "بندرعباس",
  RAS: "رشت",
  GSM: "قشم",
  SRY: "ساری",
  BUZ: "بوشهر",
  AZD: "یزد",
  ZAH: "زاهدان",
  ZBR: "چابهار",
  OMH: "ارومیه",
  ADU: "اردبیل"
};

const TEHRAN_PREFERRED = ["MHD", "KIH", "SYZ", "TBZ", "AWZ", "ABD", "KER", "KSH", "IFN", "BND"];

const money = (value) => Math.round(Number(value)).toLocaleString("en-US");

function clock(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function calendarParts(date, calendar) {
  const formatter = new Intl.DateTimeFormat(`fa-IR-u-ca-${calendar}-nu-latn`, {
    timeZone: "Asia/Tehran",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
}

function dateInfo(date = new Date()) {
  const solar = calendarParts(date, "persian");
  return {
    weekday: solar.weekday,
    solar: `${solar.day} ${solar.month} ${solar.year}`
  };
}

function jalaliIso(gregorian) {
  const [year, month, day] = gregorian.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC"
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(Date.UTC(year, month - 1, day))).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeJalaliDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) throw new Error(`تاریخ نامعتبر نرخ پرواز: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year >= 1300 && year <= 1600) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return jalaliIso(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

function jalaliLabel(jalali) {
  const [, month, day] = jalali.split("-").map(Number);
  const monthNames = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
  ];
  return `${day} ${monthNames[month - 1]}`;
}

async function fetchFlightPrices() {
  const response = await fetch(`https://flyyab.ir/_booking/CheapestPrice/getMinFile?_=${Date.now()}`, {
    headers: {
      "user-agent": "FlyYab-Bale-Test/0.1",
      "cache-control": "no-cache"
    }
  });
  if (!response.ok) throw new Error(`خطای دریافت نرخ پرواز: HTTP ${response.status}`);
  const data = await response.json();
  if (data.status !== "success" || !data.minPrice) {
    throw new Error("پاسخ نرخ پرواز معتبر نیست");
  }
  return data;
}

function flightOffer(data, origin, destination) {
  const minWeek = data.minPrice?.[origin]?.[destination]?.minWeek;
  if (!Array.isArray(minWeek) || minWeek.length < 3 || !Number(minWeek[1]) || !minWeek[2]) return null;
  const jalali = normalizeJalaliDate(minWeek[2]);
  return {
    destination,
    dateLabel: jalaliLabel(jalali),
    price: Number(minWeek[1]) * 1000,
    url: `https://flyyab.ir/flights/${origin}-${destination}?adult=1&child=0&infant=0&departing=${jalali}`
  };
}

async function buildTestPost() {
  const data = await fetchFlightPrices();
  const d = dateInfo();

  const offers = TEHRAN_PREFERRED
    .map((destination) => flightOffer(data, "THR", destination))
    .filter(Boolean)
    .slice(0, 3);

  if (!offers.length) throw new Error("هیچ نرخ معتبر داخلی از تهران دریافت نشد");

  const lines = [
    "✈️ کمترین نرخ پروازهای داخلی ایران",
    "",
    "📍 تست نسخه بله | از مبدأ تهران (THR)",
    `🗓 ${d.weekday}، ${d.solar}`,
    `⏱ به‌روزرسانی: ${clock()}`,
    "",
    ...offers.flatMap((offer) => [
      `• تهران → ${CITY[offer.destination] || offer.destination}`,
      `  ${offer.dateLabel} • ${money(offer.price)} تومان`,
      `  ${offer.url}`,
      ""
    ]),
    "⚡ نرخ‌ها همین حالا از فلای‌یاب دریافت شده‌اند و ممکن است تا زمان خرید تغییر کنند.",
    "",
    "🌐 FlyYab.ir",
    "@FlyYab"
  ];

  return lines.join("\n");
}

async function baleSendMessage(env, text) {
  const token = env.BALE_BOT_TOKEN;
  const channelId = Number(env.BALE_CHANNEL_ID || DEFAULT_CHANNEL_ID);

  if (!token) throw new Error("BALE_BOT_TOKEN تنظیم نشده است");
  if (!Number.isFinite(channelId)) throw new Error("BALE_CHANNEL_ID نامعتبر است");

  const response = await fetch(`${BALE_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: channelId,
      text
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `Bale API HTTP ${response.status}`);
  }
  return data;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        ok: true,
        service: "FlyYab Bale V0.1 Live Flights Test",
        routes: ["/preview", "/test"]
      });
    }

    if (url.pathname === "/preview") {
      try {
        const text = await buildTestPost();
        return new Response(text, {
          headers: { "content-type": "text/plain; charset=utf-8" }
        });
      } catch (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    if (url.pathname === "/test") {
      try {
        const text = await buildTestPost();
        const result = await baleSendMessage(env, text);
        return Response.json({
          ok: true,
          message: "پست آزمایشی واقعی فلای‌یاب با موفقیت به بله ارسال شد",
          bale: result
        });
      } catch (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
