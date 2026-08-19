export const INTERNATIONAL_RADAR_VERSION = 'flyyab-international-radar-v1.1-citywide-24h';

export const INTERNATIONAL_RADAR_RULES = Object.freeze({
  scanIntervalMinutes: 15,
  minActiveDates: 3,
  strongSampleDates: 7,
  maxLeadDays: 45,
  maxPriceRankRatio: 0.20,
  minMedianGapPct: 15,
  sparseMinMedianGapPct: 20,
  verifiedMinMedianGapPct: 12,
  maxVerificationPriceRisePct: 8,
  opportunityScoreThreshold: 65,
  verificationAttemptsPerScan: 2,
  rejectionCooldownMs: 60 * 60 * 1000,
  routeDateCooldownMs: 24 * 60 * 60 * 1000,
  globalCooldownMs: 2 * 60 * 60 * 1000,
  testRollingQuotaCount: 3,
  liveRollingQuotaCount: 2,
  rollingQuotaMs: 24 * 60 * 60 * 1000,
  testMinDurationMs: 72 * 60 * 60 * 1000,
  reservationTtlMs: 20 * 60 * 1000,
  realertImprovementPct: 7
});

export const IRAN_INTERNATIONAL_AIRPORTS = new Set([
  'ABD','ACP','ACZ','ADU','AEU','AFZ','AJK','AWZ','AZD','BJB','BND','BUZ','CKT','DEF',
  'GBT','GSM','HDM','IFN','IIL','IKA','JAR','JBK','KER','KHD','KIH','KSH','LFM','LRR',
  'MHD','MRX','NSH','OMH','PFQ','PGU','RAS','RZR','SDG','SRY','SYJ','SYZ','TBZ','THR',
  'XBJ','YES','ZAH','ZBR'
]);

const FA_MONTHS = Object.freeze([
  'فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'
]);

const CATEGORY_WEIGHT = Object.freeze({
  iran_outbound: 30,
  iran_inbound: 24,
  istanbul_hub: 14
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function internationalRadarValidIata(value) {
  return /^[A-Z]{3}$/.test(String(value || '').toUpperCase());
}

export function internationalRadarNormalizeJalali(value) {
  const text = String(value || '').trim().replaceAll('/', '-');
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1300 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function floorDiv(a, b) {
  return Math.floor(a / b);
}

function positiveMod(a, b) {
  return a - floorDiv(a, b) * b;
}

function jalaliOrdinal(value) {
  const normalized = internationalRadarNormalizeJalali(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  // Exact 2820-year Persian-calendar arithmetic. Only day differences are
  // needed here, so the absolute epoch constant is intentionally omitted.
  const cycleBase = year - (year >= 0 ? 474 : 473);
  const cycleYear = 474 + positiveMod(cycleBase, 2820);
  const daysBeforeMonth = month <= 7 ? (month - 1) * 31 : (month - 1) * 30 + 6;
  return day + daysBeforeMonth + floorDiv(cycleYear * 682 - 110, 2816) +
    (cycleYear - 1) * 365 + floorDiv(cycleBase, 2820) * 1029983;
}

export function internationalRadarMedian(values) {
  const numbers = values.map(Number).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

export function internationalRadarGapPct(referencePrice, currentPrice) {
  const reference = Number(referencePrice), current = Number(currentPrice);
  if (!(reference > 0) || !(current > 0) || current >= reference) return 0;
  return (reference - current) / reference * 100;
}

export function internationalRadarCategory(origin, destination) {
  const originIran = IRAN_INTERNATIONAL_AIRPORTS.has(origin);
  const destinationIran = IRAN_INTERNATIONAL_AIRPORTS.has(destination);
  if (originIran && !destinationIran) return 'iran_outbound';
  if (!originIran && destinationIran) return 'iran_inbound';
  if (!originIran && !destinationIran && (origin === 'IST' || origin === 'SAW')) return 'istanbul_hub';
  return null;
}

function dateLabelFromFeed(value, departureDate) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ').replaceAll('-', '–');
  if (clean) return clean;
  const normalized = internationalRadarNormalizeJalali(departureDate);
  if (!normalized) return String(departureDate || '');
  const [year, month, day] = normalized.split('-').map(Number);
  return `${day} ${FA_MONTHS[month - 1] || ''} ${year}`.trim();
}

function routeDateRows(value, currentJalali) {
  const currentOrdinal = jalaliOrdinal(currentJalali);
  const rows = new Map();
  for (const [dateRaw, priceInfo] of Object.entries(value?.minDate || {})) {
    const departureDate = internationalRadarNormalizeJalali(dateRaw);
    const rawPrice = Array.isArray(priceInfo) ? Number(priceInfo[0]) : 0;
    if (!departureDate || !(rawPrice > 0) || !Number.isFinite(rawPrice)) continue;
    const departureOrdinal = jalaliOrdinal(departureDate);
    const leadDays = currentOrdinal !== null && departureOrdinal !== null ? departureOrdinal - currentOrdinal : null;
    if (leadDays !== null && (leadDays < 0 || leadDays > INTERNATIONAL_RADAR_RULES.maxLeadDays)) continue;
    rows.set(departureDate, {
      departureDate,
      rawPrice,
      priceFeedToman: rawPrice * 1000,
      dateLabelRaw: Array.isArray(priceInfo) ? String(priceInfo[1] || '') : '',
      leadDays
    });
  }
  const minWeek = value?.minWeek;
  if (Array.isArray(minWeek) && minWeek.length >= 3) {
    const departureDate = internationalRadarNormalizeJalali(minWeek[2]);
    const rawPrice = Number(minWeek[1]);
    const departureOrdinal = jalaliOrdinal(departureDate);
    const leadDays = currentOrdinal !== null && departureOrdinal !== null ? departureOrdinal - currentOrdinal : null;
    if (departureDate && rawPrice > 0 && Number.isFinite(rawPrice) && (leadDays === null || (leadDays >= 0 && leadDays <= INTERNATIONAL_RADAR_RULES.maxLeadDays))) {
      const previous = rows.get(departureDate);
      if (!previous || rawPrice < previous.rawPrice) rows.set(departureDate, {
        departureDate,
        rawPrice,
        priceFeedToman: rawPrice * 1000,
        dateLabelRaw: previous?.dateLabelRaw || '',
        leadDays
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.priceFeedToman - b.priceFeedToman || a.departureDate.localeCompare(b.departureDate));
}

function candidateScore(category, row, context) {
  const gapScore = clamp((context.medianGapPct - 10) / 30 * 30, 0, 30);
  const rankRatio = context.priceRank / Math.max(1, context.activeDates);
  const rankScore = clamp((1 - rankRatio) * 20, 0, 20);
  const sampleScore = clamp(context.activeDates / 14 * 10, 0, 10);
  const leadScore = row.leadDays === null ? 5 : row.leadDays >= 1 && row.leadDays <= 35 ? 10 : row.leadDays >= 0 && row.leadDays <= 45 ? 6 : 0;
  const breakdown = {
    marketPriority: CATEGORY_WEIGHT[category] || 0,
    medianGap: gapScore,
    priceRank: rankScore,
    sampleConfidence: sampleScore,
    travelWindow: leadScore
  };
  return {
    score: Math.round(Object.values(breakdown).reduce((sum, value) => sum + value, 0)),
    breakdown: Object.fromEntries(Object.entries(breakdown).map(([key, value]) => [key, Math.round(value * 10) / 10]))
  };
}

export function buildInternationalRadarSnapshot(data, currentJalali) {
  const branch = data?.gminPrice;
  if (!branch || typeof branch !== 'object') throw new Error('INTERNATIONAL_FEED_MISSING');
  const routes = [];
  const candidates = [];
  const counts = {
    feedOrigins: 0,
    feedRouteObjects: 0,
    iranOutboundRoutes: 0,
    iranInboundRoutes: 0,
    istanbulHubRoutes: 0,
    ignoredDomesticRoutes: 0,
    ignoredForeignRoutes: 0,
    activeDateRows: 0,
    candidateRoutes: 0
  };

  for (const [originRaw, destinations] of Object.entries(branch)) {
    const origin = String(originRaw || '').toUpperCase();
    if (!internationalRadarValidIata(origin) || !destinations || typeof destinations !== 'object') continue;
    counts.feedOrigins++;
    for (const [destinationRaw, value] of Object.entries(destinations)) {
      const destination = String(destinationRaw || '').toUpperCase();
      if (!internationalRadarValidIata(destination) || destination === origin) continue;
      counts.feedRouteObjects++;
      const originIran = IRAN_INTERNATIONAL_AIRPORTS.has(origin);
      const destinationIran = IRAN_INTERNATIONAL_AIRPORTS.has(destination);
      const category = internationalRadarCategory(origin, destination);
      if (!category) {
        if (originIran && destinationIran) counts.ignoredDomesticRoutes++;
        else counts.ignoredForeignRoutes++;
        continue;
      }
      const dates = routeDateRows(value, currentJalali);
      if (!dates.length) continue;
      counts.activeDateRows += dates.length;
      if (category === 'iran_outbound') counts.iranOutboundRoutes++;
      else if (category === 'iran_inbound') counts.iranInboundRoutes++;
      else counts.istanbulHubRoutes++;

      const prices = dates.map(item => item.priceFeedToman);
      const routeMedianToman = internationalRadarMedian(prices);
      const routeMinToman = Math.min(...prices);
      const best = dates[0];
      const priceRank = 1;
      const activeDates = dates.length;
      const medianGapPct = internationalRadarGapPct(routeMedianToman, best.priceFeedToman);
      const rankRatio = priceRank / activeDates;
      const enoughSamples = activeDates >= INTERNATIONAL_RADAR_RULES.minActiveDates;
      const strongSample = activeDates >= INTERNATIONAL_RADAR_RULES.strongSampleDates;
      const rankQualified = strongSample
        ? rankRatio <= INTERNATIONAL_RADAR_RULES.maxPriceRankRatio
        : priceRank === 1;
      const qualified = enoughSamples && rankQualified && medianGapPct >= (
        strongSample ? INTERNATIONAL_RADAR_RULES.minMedianGapPct : INTERNATIONAL_RADAR_RULES.sparseMinMedianGapPct
      );
      const route = {
        routeKey: `${origin}|${destination}`,
        origin,
        destination,
        category,
        activeDates,
        routeMedianToman,
        routeMinToman,
        bestDate: best.departureDate,
        bestPriceToman: best.priceFeedToman,
        medianGapPct,
        qualified
      };
      routes.push(route);
      if (!qualified) continue;
      const score = candidateScore(category, best, { activeDates, priceRank, medianGapPct });
      const candidate = {
        key: `international-v1|${origin}|${destination}|${best.departureDate}`,
        routeKey: route.routeKey,
        origin,
        destination,
        category,
        departureDate: best.departureDate,
        dateLabelRaw: dateLabelFromFeed(best.dateLabelRaw, best.departureDate),
        rawPrice: best.rawPrice,
        priceFeedToman: best.priceFeedToman,
        routeMedianToman,
        routeMinToman,
        activeDates,
        priceRank,
        priceRankRatio: rankRatio,
        medianGapPct,
        leadDays: best.leadDays,
        opportunityScore: score.score,
        scoreBreakdown: score.breakdown
      };
      if (candidate.opportunityScore >= INTERNATIONAL_RADAR_RULES.opportunityScoreThreshold) candidates.push(candidate);
    }
  }

  candidates.sort((a, b) =>
    Number(b.opportunityScore) - Number(a.opportunityScore) ||
    Number(b.medianGapPct) - Number(a.medianGapPct) ||
    Number(a.priceFeedToman) - Number(b.priceFeedToman) ||
    String(a.key).localeCompare(String(b.key))
  );
  counts.candidateRoutes = candidates.length;
  return { currentJalali, counts, routes, candidates };
}

export function validateVerifiedInternationalFare(candidate, verification) {
  const exactPriceToman = Number(verification?.exactPriceToman);
  if (!(exactPriceToman > 0) || !Number.isFinite(exactPriceToman)) return { ok: false, reason: 'EXACT_PRICE_MISSING' };
  if (verification?.currencyCode !== 'IRR') return { ok: false, reason: 'UNSUPPORTED_CURRENCY' };
  if (verification?.origin !== candidate.origin || verification?.destination !== candidate.destination) return { ok: false, reason: 'ROUTE_MISMATCH' };
  if (internationalRadarNormalizeJalali(verification?.departureDate) !== candidate.departureDate) return { ok: false, reason: 'DATE_MISMATCH' };
  if (!(Number(verification?.capacity) > 0)) return { ok: false, reason: 'NO_CAPACITY' };
  const priceRisePct = exactPriceToman > Number(candidate.priceFeedToman)
    ? (exactPriceToman - Number(candidate.priceFeedToman)) / Number(candidate.priceFeedToman) * 100
    : 0;
  if (priceRisePct > INTERNATIONAL_RADAR_RULES.maxVerificationPriceRisePct) return { ok: false, reason: 'PRICE_CHANGED_TOO_MUCH', priceRisePct };
  const verifiedMedianGapPct = internationalRadarGapPct(candidate.routeMedianToman, exactPriceToman);
  if (verifiedMedianGapPct < INTERNATIONAL_RADAR_RULES.verifiedMinMedianGapPct) return { ok: false, reason: 'NO_LONGER_COMPETITIVE', verifiedMedianGapPct };
  return { ok: true, exactPriceToman, priceRisePct, verifiedMedianGapPct };
}

function latinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632));
}

export function internationalRadarMoney(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

export function internationalRadarDateLabel(candidate) {
  const normalized = internationalRadarNormalizeJalali(candidate?.departureDate);
  if (!normalized) return latinDigits(candidate?.dateLabelRaw || candidate?.departureDate || '');
  const [year, month, day] = normalized.split('-').map(Number);
  const raw = String(candidate?.dateLabelRaw || '').replace(/[–-]/g, ' ').replace(/\s+/g, ' ').trim();
  const weekday = ['شنبه','یکشنبه','دوشنبه','سه شنبه','سه‌شنبه','چهارشنبه','پنج شنبه','پنجشنبه','جمعه']
    .find(value => raw.startsWith(value)) || '';
  const weekdayPrefix = weekday ? `${weekday.replace('سه شنبه', 'سه‌شنبه').replace('پنج شنبه', 'پنجشنبه')}، ` : '';
  return latinDigits(`${weekdayPrefix}${day} ${FA_MONTHS[month - 1] || ''} ${year}`.trim());
}

export function internationalRadarBookingCodes(candidate, airportToAll = {}) {
  const exactOrigin = String(candidate?.origin || '').toUpperCase();
  const exactDestination = String(candidate?.destination || '').toUpperCase();
  const resolveForeignCity = exactCode => {
    const aggregate = String(airportToAll?.[exactCode] || '').toUpperCase();
    return /^[A-Z]{3}ALL$/.test(aggregate) ? aggregate : exactCode;
  };
  return {
    origin: IRAN_INTERNATIONAL_AIRPORTS.has(exactOrigin) ? exactOrigin : resolveForeignCity(exactOrigin),
    destination: IRAN_INTERNATIONAL_AIRPORTS.has(exactDestination) ? exactDestination : resolveForeignCity(exactDestination)
  };
}

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
}

export function buildInternationalRadarCaption(candidate, labels, bookingUrl) {
  const origin = htmlEscape(labels?.origin || candidate.origin);
  const destination = htmlEscape(labels?.destination || candidate.destination);
  const date = htmlEscape(internationalRadarDateLabel(candidate));
  const price = htmlEscape(internationalRadarMoney(candidate.exactPriceToman || candidate.priceFeedToman));
  const checkedAt = htmlEscape(latinDigits(candidate.checkedAtTehran || '—'));
  return [
    '🚨 <b>فوری | فرصت پرواز خارجی فلای‌یاب</b>',
    `✈️ <b>${origin} (${candidate.origin}) به ${destination} (${candidate.destination})</b>`,
    `📅 ${date}  •  💰 <b>${price} تومان</b>`,
    `🕒 آخرین بررسی نرخ: <b>${checkedAt}</b> به وقت تهران`,
    '⚠️ نرخ و ظرفیت تا زمان تکمیل خرید ممکن است تغییر کند.',
    '💠 @FlyYab'
  ].join('\n');
}

export function internationalRadarReservationToken(scanId, candidate) {
  const base = `${scanId}|${candidate.key}|${candidate.priceFeedToman}`;
  let hash = 2166136261;
  for (let index = 0; index < base.length; index++) {
    hash ^= base.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `international-${(hash >>> 0).toString(16)}-${String(scanId).replace(/[^0-9A-Za-z]/g, '').slice(-10)}`;
}

export function internationalRadarCategoryFa(category) {
  return ({
    iran_outbound: 'ایران به خارج',
    iran_inbound: 'خارج به ایران',
    istanbul_hub: 'استانبول به جهان'
  })[category] || 'نامشخص';
}
