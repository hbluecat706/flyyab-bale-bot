export const RADAR_VERSION = 'flyyab-domestic-fare-intelligence-v3.2-nearby-ranking';

export const RADAR_RULES = Object.freeze({
  scanIntervalMinutes: 5,
  feedTimeoutMs: 10 * 1000,
  maxLeadDays: 45,
  minActiveDates: 3,
  strongSampleDates: 7,
  maxDatesPerRoute: 4,
  maxObservedRows: 700,
  calendarMinGapPct: 8,
  recentSignalPct: 10,
  historicalSignalPct: 10,
  boardPreScoreThreshold: 36,
  boardVerifiedScoreThreshold: 52,
  boardCandidateLimit: 30,
  boardVerificationAttempts: 24,
  boardVerificationConcurrency: 4,
  boardVerificationBudgetMs: 45 * 1000,
  boardTargetItems: 6,
  boardMaxItems: 6,
  flashPreScoreThreshold: 75,
  flashVerifiedScoreThreshold: 90,
  flashRecentDropPct: 18,
  flashCalendarGapPct: 25,
  flashHistoricalGapPct: 18,
  flashConfirmations: 3,
  confirmationTolerancePct: 6,
  recentWindowMs: 6 * 60 * 60 * 1000,
  historicalWindowMs: 72 * 60 * 60 * 1000,
  historicalSampleStepMs: 30 * 60 * 1000,
  maxRecentObservations: 80,
  maxHistoricalObservations: 160,
  minRecentObservations: 3,
  minRecentSpanMs: 10 * 60 * 1000,
  verificationMaxPriceRisePct: 8,
  verificationTimeoutMs: 12 * 1000,
  rejectionCooldownMs: 60 * 60 * 1000,
  reservationTtlMs: 20 * 60 * 1000,
  unknownDeliveryLockMs: 6 * 60 * 60 * 1000,
  flashGlobalCooldownMs: 90 * 60 * 1000,
  flashRouteCooldownMs: 12 * 60 * 60 * 1000,
  flashRollingQuotaMs: 24 * 60 * 60 * 1000,
  flashRollingQuotaCount: 2,
  testMinDurationMs: 24 * 60 * 60 * 1000,
  marketAnomalyMinComparable: 20,
  marketCountCollapseRatio: 0.45,
  scheduleConflictRadiusMinutes: 20,
  publishStartMinute: 8 * 60 + 30,
  publishEndMinute: 19 * 60 + 30
});

export const DOMESTIC_AIRPORTS = new Set([
  'ABD','ACP','ACZ','ADU','AEU','AFZ','AJK','AWZ','AZD','BJB','BND','BUZ','CKT','DEF',
  'GBT','GSM','HDM','IFN','IIL','IKA','JAR','JBK','KER','KHD','KIH','KSH','LFM','LRR',
  'MHD','MRX','NSH','OMH','PFQ','PGU','RAS','RZR','SDG','SRY','SYJ','SYZ','TBZ','THR',
  'XBJ','YES','ZAH','ZBR'
]);

export const RADAR_PUBLIC_POST_TIMES = Object.freeze([
  '08:00','09:30','10:15','11:00','11:30','13:30','16:00','18:00','19:15','20:30','21:00'
]);

const FA_MONTHS = Object.freeze([
  'فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const round1 = value => Math.round((Number(value) || 0) * 10) / 10;

export function radarValidIata(value) {
  return /^[A-Z]{3}$/.test(String(value || '').toUpperCase());
}

const RADAR_DIGITS = Object.freeze({
  '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'
});

function radarLatinDigits(value) {
  return String(value ?? '').replace(/[۰-۹٠-٩]/g, digit => RADAR_DIGITS[digit] || digit);
}

function radarDateParts(value) {
  const text = radarLatinDigits(value).trim().replaceAll('/', '-');
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (!match) return null;
  return { year:Number(match[1]), month:Number(match[2]), day:Number(match[3]), raw:text };
}

function validGregorianDate(year, month, day) {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function gregorianToRadarJalali(year, month, day) {
  if (!validGregorianDate(year, month, day)) return null;
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(Date.UTC(year, month - 1, day))).map(part => [part.type, part.value]));
  const jy = Number(parts.year), jm = Number(parts.month), jd = Number(parts.day);
  if (jy < 1300 || jy > 1600 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
}

export function radarDateInputCalendar(value) {
  const parts = radarDateParts(value);
  if (!parts) return 'invalid';
  if (parts.year >= 1300 && parts.year <= 1600) return 'jalali';
  if (validGregorianDate(parts.year, parts.month, parts.day)) return 'gregorian';
  return 'invalid';
}

export function normalizeRadarJalali(value) {
  const parts = radarDateParts(value);
  if (!parts) return null;
  const { year, month, day } = parts;
  if (year >= 1300 && year <= 1600) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return gregorianToRadarJalali(year, month, day);
}

function floorDiv(a, b) { return Math.floor(a / b); }
function positiveMod(a, b) { return a - floorDiv(a, b) * b; }

export function jalaliOrdinal(value) {
  const normalized = normalizeRadarJalali(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  const cycleBase = year - (year >= 0 ? 474 : 473);
  const cycleYear = 474 + positiveMod(cycleBase, 2820);
  const daysBeforeMonth = month <= 7 ? (month - 1) * 31 : (month - 1) * 30 + 6;
  return day + daysBeforeMonth + floorDiv(cycleYear * 682 - 110, 2816) +
    (cycleYear - 1) * 365 + floorDiv(cycleBase, 2820) * 1029983;
}

export function median(values) {
  const nums = values.map(Number).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}


function quantileSorted(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function robustCalendarRows(rows) {
  const valid = rows
    .filter(row => Number(row?.priceFeedToman) > 0)
    .sort((a, b) => Number(a.priceFeedToman) - Number(b.priceFeedToman));
  if (valid.length < 7) return valid;
  const prices = valid.map(row => Number(row.priceFeedToman));
  const q1 = quantileSorted(prices, 0.25);
  const q3 = quantileSorted(prices, 0.75);
  const iqr = Number(q3) - Number(q1);
  if (!(iqr > 0)) return valid;
  const low = Number(q1) - 1.5 * iqr;
  const high = Number(q3) + 1.5 * iqr;
  const filtered = valid.filter(row => Number(row.priceFeedToman) >= low && Number(row.priceFeedToman) <= high);
  return filtered.length >= 3 ? filtered : valid;
}

function calendarReferenceForRow(row, allRows) {
  const targetOrdinal = jalaliOrdinal(row.departureDate);
  const others = allRows.filter(item => item.departureDate !== row.departureDate && Number(item.priceFeedToman) > 0);
  const within = days => others.filter(item => {
    const ordinal = jalaliOrdinal(item.departureDate);
    return targetOrdinal !== null && ordinal !== null && Math.abs(ordinal - targetOrdinal) <= days;
  });
  let scope = 'route';
  let windowDays = RADAR_RULES.maxLeadDays;
  let sample = within(7);
  if (sample.length >= 3) {
    scope = 'nearby_7';
    windowDays = 7;
  } else {
    sample = within(14);
    if (sample.length >= 3) {
      scope = 'nearby_14';
      windowDays = 14;
    } else {
      sample = others;
    }
  }
  const robust = robustCalendarRows(sample);
  const referenceToman = median(robust.map(item => item.priceFeedToman));
  const ranked = [row, ...robust]
    .sort((a, b) => Number(a.priceFeedToman) - Number(b.priceFeedToman) || String(a.departureDate).localeCompare(String(b.departureDate)));
  const rank = Math.max(1, ranked.findIndex(item => item.departureDate === row.departureDate) + 1);
  const rankCount = ranked.length;
  return {
    calendarReferenceToman: referenceToman,
    calendarReferenceScope: scope,
    calendarWindowDays: windowDays,
    calendarSampleCount: robust.length,
    calendarRankCount: rankCount,
    priceRank: rank,
    priceRankRatio: rankCount > 0 ? rank / rankCount : 1,
    calendarGapPct: dropPercent(referenceToman, row.priceFeedToman),
    calendarSavingToman: Math.max(0, Number(referenceToman || 0) - Number(row.priceFeedToman || 0))
  };
}

export function dropPercent(referencePrice, currentPrice) {
  const reference = Number(referencePrice), current = Number(currentPrice);
  if (!(reference > 0) || !(current > 0) || current >= reference) return 0;
  return (reference - current) / reference * 100;
}

export function formatDropPercent(value) {
  const rounded = round1(value);
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

export function formatMoneyLatin(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

export function jalaliShortLabel(jalali) {
  const normalized = normalizeRadarJalali(jalali);
  if (!normalized) return String(jalali || '');
  const [, month, day] = normalized.split('-').map(Number);
  return `${day} ${FA_MONTHS[month - 1] || ''}`.trim();
}

export function routeKey(record) {
  return `domestic|${record.origin}|${record.destination}|${record.departureDate}`;
}

export function routeCooldownKey(record) {
  return `domestic|${record.origin}|${record.destination}`;
}

export function radarRouteStorageKey(key) {
  return `radar-route-v3:${key}`;
}

function radarRawPrice(priceInfo) {
  if (Array.isArray(priceInfo)) return Number(priceInfo[0]);
  if (priceInfo && typeof priceInfo === 'object') return Number(priceInfo.price ?? priceInfo.minPrice ?? priceInfo.value ?? priceInfo.amount ?? 0);
  return Number(priceInfo);
}

function radarRawDateLabel(priceInfo) {
  if (Array.isArray(priceInfo)) return String(priceInfo[1] || '');
  if (priceInfo && typeof priceInfo === 'object') return String(priceInfo.label ?? priceInfo.dateLabel ?? '');
  return '';
}

function noteRadarDateDiagnostic(diagnostics, value) {
  if (!diagnostics) return;
  diagnostics.dateInputs = Number(diagnostics.dateInputs || 0) + 1;
  const type = radarDateInputCalendar(value);
  if (type === 'jalali') diagnostics.jalaliDateInputs = Number(diagnostics.jalaliDateInputs || 0) + 1;
  else if (type === 'gregorian') diagnostics.gregorianDateInputs = Number(diagnostics.gregorianDateInputs || 0) + 1;
  else diagnostics.invalidDateInputs = Number(diagnostics.invalidDateInputs || 0) + 1;
}

function routeDateRows(value, currentJalali, diagnostics = null) {
  const currentOrdinal = jalaliOrdinal(currentJalali);
  const rows = new Map();
  for (const [dateRaw, priceInfo] of Object.entries(value?.minDate || {})) {
    noteRadarDateDiagnostic(diagnostics, dateRaw);
    const departureDate = normalizeRadarJalali(dateRaw);
    const rawPrice = radarRawPrice(priceInfo);
    if (!departureDate || !(rawPrice > 0) || !Number.isFinite(rawPrice)) continue;
    const departureOrdinal = jalaliOrdinal(departureDate);
    const leadDays = currentOrdinal !== null && departureOrdinal !== null ? departureOrdinal - currentOrdinal : null;
    if (leadDays !== null && (leadDays < 0 || leadDays > RADAR_RULES.maxLeadDays)) continue;
    rows.set(departureDate, {
      departureDate,
      rawPrice,
      priceFeedToman: rawPrice * 1000,
      dateLabelRaw: radarRawDateLabel(priceInfo),
      leadDays,
      sourceMinWeek: false
    });
  }
  const minWeek = value?.minWeek;
  if (Array.isArray(minWeek) && minWeek.length >= 3) {
    noteRadarDateDiagnostic(diagnostics, minWeek[2]);
    const departureDate = normalizeRadarJalali(minWeek[2]);
    const rawPrice = Number(minWeek[1]);
    const departureOrdinal = jalaliOrdinal(departureDate);
    const leadDays = currentOrdinal !== null && departureOrdinal !== null ? departureOrdinal - currentOrdinal : null;
    if (departureDate && rawPrice > 0 && Number.isFinite(rawPrice) && (leadDays === null || (leadDays >= 0 && leadDays <= RADAR_RULES.maxLeadDays))) {
      const previous = rows.get(departureDate);
      if (!previous || rawPrice <= previous.rawPrice) rows.set(departureDate, {
        departureDate,
        rawPrice,
        priceFeedToman: rawPrice * 1000,
        dateLabelRaw: previous?.dateLabelRaw || '',
        leadDays,
        sourceMinWeek: true
      });
      else previous.sourceMinWeek = true;
    }
  }
  return [...rows.values()].sort((a, b) => a.priceFeedToman - b.priceFeedToman || a.departureDate.localeCompare(b.departureDate));
}

function calendarPotential(row) {
  const gap = Number(row.calendarGapPct || 0);
  const rankRatio = Number(row.priceRankRatio || 1);
  const sample = Number(row.calendarSampleCount || 0);
  const scopeBonus = row.calendarReferenceScope === 'nearby_7' ? 3 : row.calendarReferenceScope === 'nearby_14' ? 1.5 : 0;
  return gap * 2.1 + (1 - rankRatio) * 18 + Math.min(10, sample) * 0.7 + scopeBonus + (row.sourceMinWeek ? 1 : 0);
}

export function buildDomesticRadarSnapshot(data, currentJalali) {
  const branch = data?.minPrice;
  if (!branch || typeof branch !== 'object') throw new Error('DOMESTIC_FEED_MISSING');
  const normalizedCurrent = normalizeRadarJalali(currentJalali);
  const counts = {
    feedOrigins: 0,
    feedRouteObjects: 0,
    domesticRouteObjects: 0,
    domesticRoutes: 0,
    ignoredNonDomesticRoutes: 0,
    activeDateRows: 0,
    observedRows: 0,
    calendarQualifiedRows: 0,
    dateInputs: 0,
    jalaliDateInputs: 0,
    gregorianDateInputs: 0,
    invalidDateInputs: 0
  };
  const routes = [];
  const observations = [];

  for (const [originRaw, destinations] of Object.entries(branch)) {
    const origin = String(originRaw || '').toUpperCase();
    if (!radarValidIata(origin) || !destinations || typeof destinations !== 'object') continue;
    counts.feedOrigins++;
    for (const [destinationRaw, value] of Object.entries(destinations)) {
      const destination = String(destinationRaw || '').toUpperCase();
      if (!radarValidIata(destination) || destination === origin) continue;
      counts.feedRouteObjects++;
      if (!(DOMESTIC_AIRPORTS.has(origin) && DOMESTIC_AIRPORTS.has(destination))) {
        counts.ignoredNonDomesticRoutes++;
        continue;
      }
      counts.domesticRouteObjects++;
      const dates = routeDateRows(value, normalizedCurrent, counts);
      if (!dates.length) continue;
      counts.domesticRoutes++;
      counts.activeDateRows += dates.length;
      const prices = dates.map(row => row.priceFeedToman);
      const routeMedianToman = median(prices);
      const routeMinToman = Math.min(...prices);
      const activeDates = dates.length;
      const baseRows = dates.map((row, index) => ({
        ...row,
        origin,
        destination,
        market: 'domestic',
        activeDates,
        routeMedianToman,
        routeMinToman,
        routePriceRank: index + 1,
        routePriceRankRatio: (index + 1) / activeDates
      }));
      const enriched = baseRows.map(row => ({
        ...row,
        ...calendarReferenceForRow(row, baseRows)
      }));
      const minWeekRow = enriched.find(row => row.sourceMinWeek) || null;
      const calendarRows = enriched
        .filter(row => activeDates >= RADAR_RULES.minActiveDates && row.calendarGapPct >= RADAR_RULES.calendarMinGapPct && row.priceRankRatio <= 0.5)
        .sort((a, b) => calendarPotential(b) - calendarPotential(a) || a.priceFeedToman - b.priceFeedToman)
        .slice(0, RADAR_RULES.maxDatesPerRoute);
      counts.calendarQualifiedRows += calendarRows.length;
      const selected = new Map();
      const cheapestRow = enriched[0] || null;
      if (cheapestRow) selected.set(cheapestRow.departureDate, cheapestRow);
      if (minWeekRow) selected.set(minWeekRow.departureDate, minWeekRow);
      for (const row of calendarRows) selected.set(row.departureDate, row);
      for (const row of selected.values()) observations.push({
        ...row,
        key: routeKey(row),
        routePair: `${origin}|${destination}`,
        selectionPotential: round1(calendarPotential(row))
      });
      routes.push({
        routePair: `${origin}|${destination}`,
        origin,
        destination,
        activeDates,
        routeMedianToman,
        routeMinToman,
        bestDate: enriched[0]?.departureDate || null,
        bestPriceToman: enriched[0]?.priceFeedToman || null,
        bestCalendarGapPct: enriched[0]?.calendarGapPct || 0,
        observedDates: selected.size
      });
    }
  }

  observations.sort((a, b) =>
    Number(b.selectionPotential) - Number(a.selectionPotential) ||
    Number(b.calendarGapPct) - Number(a.calendarGapPct) ||
    Number(a.priceFeedToman) - Number(b.priceFeedToman) ||
    String(a.key).localeCompare(String(b.key))
  );
  const limited = observations.slice(0, RADAR_RULES.maxObservedRows);
  counts.observedRows = limited.length;
  routes.sort((a, b) => Number(b.bestCalendarGapPct) - Number(a.bestCalendarGapPct) || Number(a.bestPriceToman) - Number(b.bestPriceToman));
  return { currentJalali: normalizedCurrent, counts, routes, observations: limited };
}

export function domesticFeedHealth(snapshotOrCounts) {
  const counts = snapshotOrCounts?.counts || snapshotOrCounts || {};
  const domesticRouteObjects = Number(counts.domesticRouteObjects ?? counts.domesticRoutes ?? 0);
  const feedOrigins = Number(counts.feedOrigins ?? (domesticRouteObjects > 0 ? 1 : 0));
  const domesticRoutes = Number(counts.domesticRoutes || 0);
  const activeDateRows = Number(counts.activeDateRows || 0);
  const observedRows = Number(counts.observedRows ?? snapshotOrCounts?.observations?.length ?? 0);
  const invalidDateInputs = Number(counts.invalidDateInputs || 0);
  if (feedOrigins <= 0) return { ok:false, code:'DOMESTIC_FEED_EMPTY', detail:'minPrice contains no route origins' };
  if (domesticRouteObjects <= 0) return { ok:false, code:'DOMESTIC_FEED_NO_DOMESTIC_ROUTES', detail:'minPrice contains no recognized Iran-to-Iran route objects' };
  if (domesticRoutes <= 0 || activeDateRows <= 0) return {
    ok:false,
    code:'DOMESTIC_FEED_DATES_UNUSABLE',
    detail:`domesticRouteObjects=${domesticRouteObjects}; activeDateRows=${activeDateRows}; invalidDateInputs=${invalidDateInputs}`
  };
  if (observedRows <= 0) return { ok:false, code:'DOMESTIC_FEED_NO_OBSERVATIONS', detail:`activeDateRows=${activeDateRows}; observedRows=${observedRows}` };
  return { ok:true, code:'HEALTHY', detail:`${domesticRoutes} routes / ${activeDateRows} active dates / ${observedRows} observations` };
}

function learningReady(observations) {
  if (!Array.isArray(observations) || observations.length < RADAR_RULES.minRecentObservations) return false;
  const first = Number(observations[0]?.at), last = Number(observations.at(-1)?.at);
  return Number.isFinite(first) && Number.isFinite(last) && last - first >= RADAR_RULES.minRecentSpanMs;
}

function pruneTimed(observations, nowMs, windowMs, maxItems) {
  const min = nowMs - windowMs;
  return (Array.isArray(observations) ? observations : [])
    .filter(item => Number(item?.at) >= min && Number(item?.price) > 0)
    .slice(-maxItems);
}

export function defaultRouteState(record, nowMs) {
  return {
    key: routeKey(record),
    origin: record.origin,
    destination: record.destination,
    departureDate: record.departureDate,
    recentObservations: [],
    historicalObservations: [],
    confirmations: 0,
    lastSignalPrice: null,
    lastObservedAt: null,
    rejectedUntil: 0,
    lastCandidate: null,
    createdAt: new Date(nowMs).toISOString(),
    updatedAt: new Date(nowMs).toISOString()
  };
}

export function scoreDomesticOpportunity(record, context = {}) {
  const calendarGapPct = Number(context.calendarGapPct ?? record.calendarGapPct ?? 0);
  const rankRatio = Number(context.priceRankRatio ?? record.priceRankRatio ?? 1);
  const recentDropPct = Number(context.recentDropPct || 0);
  const historicalGapPct = Number(context.historicalGapPct || 0);
  const referencePrice = Number(context.referencePrice || record.calendarReferenceToman || record.routeMedianToman || 0);
  const currentPrice = Number(context.currentPrice || record.exactPriceToman || record.priceFeedToman || 0);
  const savingToman = Math.max(0, referencePrice - currentPrice);
  const savingPct = dropPercent(referencePrice, currentPrice);
  const observations = Number(context.observationCount || 0);
  const confirmations = Number(context.confirmations || 0);
  const verified = Boolean(context.verified);
  const priceRisePct = Number(context.verificationPriceRisePct || 0);
  const leadDays = Number.isFinite(Number(record.leadDays)) ? Number(record.leadDays) : null;

  const calendarGapScore = clamp((calendarGapPct - 4) / 26 * 20, 0, 20);
  const calendarRankScore = clamp((1 - rankRatio) * 10, 0, 10);
  const movementScore = clamp(recentDropPct / 30 * 20, 0, 20);
  const historicalScore = clamp(historicalGapPct / 25 * 15, 0, 15);
  const verificationScore = verified ? clamp(15 - priceRisePct * 0.75, 9, 15) : 0;
  const savingsScore = Math.max(
    clamp(savingPct / 30 * 10, 0, 10),
    clamp(savingToman / 2_000_000 * 10, 0, 10)
  );
  const leadScore = leadDays === null ? 3 : leadDays >= 1 && leadDays <= 30 ? 5 : leadDays >= 0 && leadDays <= 45 ? 3 : 0;
  const confidenceScore = clamp(observations / 6 * 2.5, 0, 2.5) + clamp(confirmations / RADAR_RULES.flashConfirmations * 2.5, 0, 2.5);
  const breakdown = {
    calendarValue: calendarGapScore + calendarRankScore,
    recentMovement: movementScore,
    historicalValue: historicalScore,
    verification: verificationScore,
    saving: savingsScore,
    travelWindow: leadScore,
    confidence: confidenceScore
  };
  const score = Math.round(Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  return {
    score,
    breakdown: Object.fromEntries(Object.entries(breakdown).map(([key, value]) => [key, round1(value)])),
    savingToman,
    savingPct,
    referencePrice
  };
}

function signalTypeFor(candidate) {
  const recent = Number(candidate.recentDropPct || 0);
  const calendar = Number(candidate.calendarGapPct || 0);
  const historical = Number(candidate.historicalGapPct || 0);
  if (recent >= 15) return 'recent_drop';
  if (calendar >= 15) return 'calendar_low';
  if (historical >= 12) return 'historical_low';
  return 'route_value';
}

export function applyObservation(inputState, record, nowMs) {
  const state = inputState ? structuredClone(inputState) : defaultRouteState(record, nowMs);
  const recentBefore = pruneTimed(state.recentObservations, nowMs, RADAR_RULES.recentWindowMs, RADAR_RULES.maxRecentObservations);
  const historyBefore = pruneTimed(state.historicalObservations, nowMs, RADAR_RULES.historicalWindowMs, RADAR_RULES.maxHistoricalObservations);
  const recentMedianToman = learningReady(recentBefore) ? median(recentBefore.map(item => item.price)) : null;
  const historicalMedianToman = historyBefore.length >= 4 ? median(historyBefore.map(item => item.price)) : null;
  const currentPrice = Number(record.priceFeedToman || 0);
  const recentDropPct = recentMedianToman ? dropPercent(recentMedianToman, currentPrice) : 0;
  const historicalGapPct = historicalMedianToman ? dropPercent(historicalMedianToman, currentPrice) : 0;
  const referencePrice = Math.max(Number(record.calendarReferenceToman || record.routeMedianToman || 0), Number(recentMedianToman || 0), Number(historicalMedianToman || 0));
  const strongSignal = Number(record.calendarGapPct || 0) >= RADAR_RULES.calendarMinGapPct ||
    recentDropPct >= RADAR_RULES.recentSignalPct || historicalGapPct >= RADAR_RULES.historicalSignalPct;

  const lastAt = Number(state.lastObservedAt || 0);
  const lastSignalPrice = Number(state.lastSignalPrice || 0);
  const consecutiveScan = lastAt > 0 && nowMs - lastAt <= (RADAR_RULES.scanIntervalMinutes + 2) * 60 * 1000;
  const stablePrice = !(lastSignalPrice > 0) || currentPrice <= lastSignalPrice * (1 + RADAR_RULES.confirmationTolerancePct / 100);
  if (strongSignal) state.confirmations = consecutiveScan && stablePrice ? Number(state.confirmations || 0) + 1 : 1;
  else state.confirmations = 0;
  state.lastSignalPrice = strongSignal ? currentPrice : null;
  state.lastObservedAt = nowMs;

  recentBefore.push({ at: nowMs, price: currentPrice });
  state.recentObservations = pruneTimed(recentBefore, nowMs, RADAR_RULES.recentWindowMs, RADAR_RULES.maxRecentObservations);
  const lastHistory = historyBefore.at(-1);
  if (!lastHistory || nowMs - Number(lastHistory.at || 0) >= RADAR_RULES.historicalSampleStepMs) historyBefore.push({ at: nowMs, price: currentPrice });
  state.historicalObservations = pruneTimed(historyBefore, nowMs, RADAR_RULES.historicalWindowMs, RADAR_RULES.maxHistoricalObservations);

  const score = scoreDomesticOpportunity(record, {
    calendarGapPct: record.calendarGapPct,
    priceRankRatio: record.priceRankRatio,
    recentDropPct,
    historicalGapPct,
    referencePrice,
    currentPrice,
    observationCount: state.recentObservations.length,
    confirmations: state.confirmations,
    verified: false
  });
  const candidate = {
    ...record,
    key: routeKey(record),
    market: 'domestic',
    recentMedianToman,
    recentDropPct: round1(recentDropPct),
    historicalMedianToman,
    historicalGapPct: round1(historicalGapPct),
    referencePrice: score.referencePrice,
    savingToman: Math.max(0, score.referencePrice - currentPrice),
    confirmations: state.confirmations,
    observationCount: state.recentObservations.length,
    historicalObservationCount: state.historicalObservations.length,
    opportunityScore: score.score,
    scoreBreakdown: score.breakdown
  };
  candidate.signalType = signalTypeFor(candidate);
  state.lastCandidate = candidate;
  state.updatedAt = new Date(nowMs).toISOString();
  const status = candidate.opportunityScore >= RADAR_RULES.boardPreScoreThreshold && strongSignal ? 'CANDIDATE' : learningReady(state.recentObservations) ? 'NORMAL' : 'LEARNING';
  return { state, candidate: status === 'CANDIDATE' ? candidate : null, status };
}

export function isStrongFlashCandidate(candidate) {
  return Number(candidate?.opportunityScore || 0) >= RADAR_RULES.flashPreScoreThreshold &&
    Number(candidate?.confirmations || 0) >= RADAR_RULES.flashConfirmations &&
    (Number(candidate?.recentDropPct || 0) >= RADAR_RULES.flashRecentDropPct ||
      Number(candidate?.calendarGapPct || 0) >= RADAR_RULES.flashCalendarGapPct ||
      Number(candidate?.historicalGapPct || 0) >= RADAR_RULES.flashHistoricalGapPct);
}

export function validateVerifiedDomesticFare(candidate, verification) {
  const exactPriceToman = Number(verification?.exactPriceToman);
  if (!(exactPriceToman > 0) || !Number.isFinite(exactPriceToman)) return { ok:false, reason:'EXACT_PRICE_MISSING' };
  if (String(verification?.currencyCode || '').toUpperCase() !== 'IRR') return { ok:false, reason:'UNSUPPORTED_CURRENCY' };
  if (String(verification?.origin || '').toUpperCase() !== candidate.origin || String(verification?.destination || '').toUpperCase() !== candidate.destination) return { ok:false, reason:'ROUTE_MISMATCH' };
  if (normalizeRadarJalali(verification?.departureDate) !== candidate.departureDate) return { ok:false, reason:'DATE_MISMATCH' };
  if (!(Number(verification?.capacity) > 0)) return { ok:false, reason:'NO_CAPACITY' };
  const feedPrice = Number(candidate.priceFeedToman || 0);
  const priceRisePct = exactPriceToman > feedPrice ? (exactPriceToman - feedPrice) / feedPrice * 100 : 0;
  if (priceRisePct > RADAR_RULES.verificationMaxPriceRisePct) return { ok:false, reason:'PRICE_CHANGED_TOO_MUCH', priceRisePct };
  const verifiedCalendarGapPct = dropPercent(candidate.calendarReferenceToman || candidate.routeMedianToman, exactPriceToman);
  return { ok:true, exactPriceToman, priceRisePct, verifiedCalendarGapPct };
}

export function rescoreVerifiedCandidate(candidate, verification) {
  const validation = validateVerifiedDomesticFare(candidate, verification);
  if (!validation.ok) return { ok:false, reason:validation.reason, detail:validation };
  const exactPriceToman = validation.exactPriceToman;
  const recentDropPct = candidate.recentMedianToman ? dropPercent(candidate.recentMedianToman, exactPriceToman) : 0;
  const historicalGapPct = candidate.historicalMedianToman ? dropPercent(candidate.historicalMedianToman, exactPriceToman) : 0;
  const referencePrice = Math.max(Number(candidate.calendarReferenceToman || candidate.routeMedianToman || 0), Number(candidate.recentMedianToman || 0), Number(candidate.historicalMedianToman || 0));
  const scored = scoreDomesticOpportunity(candidate, {
    calendarGapPct: validation.verifiedCalendarGapPct,
    priceRankRatio: candidate.priceRankRatio,
    recentDropPct,
    historicalGapPct,
    referencePrice,
    currentPrice: exactPriceToman,
    observationCount: candidate.observationCount,
    confirmations: candidate.confirmations,
    verified: true,
    verificationPriceRisePct: validation.priceRisePct
  });
  const verified = {
    ...candidate,
    ...verification,
    exactPriceToman,
    calendarGapPct: round1(validation.verifiedCalendarGapPct),
    calendarSavingToman: Math.max(0, Number(candidate.calendarReferenceToman || candidate.routeMedianToman || 0) - exactPriceToman),
    recentDropPct: round1(recentDropPct),
    historicalGapPct: round1(historicalGapPct),
    referencePrice: scored.referencePrice,
    savingToman: Math.max(0, scored.referencePrice - exactPriceToman),
    verificationPriceRisePct: round1(validation.priceRisePct),
    opportunityScore: scored.score,
    scoreBreakdown: scored.breakdown,
    verified: true
  };
  verified.signalType = signalTypeFor(verified);
  return { ok:true, candidate:verified };
}

export function rankCandidates(candidates) {
  return [...candidates].sort((a, b) =>
    Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0) ||
    Number(b.recentDropPct || 0) - Number(a.recentDropPct || 0) ||
    Number(b.calendarGapPct || 0) - Number(a.calendarGapPct || 0) ||
    Number(b.historicalGapPct || 0) - Number(a.historicalGapPct || 0) ||
    Number(b.savingToman || 0) - Number(a.savingToman || 0) ||
    Number(a.exactPriceToman || a.priceFeedToman || Infinity) - Number(b.exactPriceToman || b.priceFeedToman || Infinity) ||
    String(a.key || '').localeCompare(String(b.key || ''))
  );
}

function minutesFromClock(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isPublishWindow(tehranClock) {
  const minute = minutesFromClock(tehranClock);
  return minute !== null && minute >= RADAR_RULES.publishStartMinute && minute <= RADAR_RULES.publishEndMinute;
}

export function isScheduleConflict(tehranClock, times = RADAR_PUBLIC_POST_TIMES, radiusMinutes = RADAR_RULES.scheduleConflictRadiusMinutes) {
  const now = minutesFromClock(tehranClock);
  if (now === null) return false;
  return times.some(time => {
    const scheduled = minutesFromClock(time);
    return scheduled !== null && Math.abs(now - scheduled) <= radiusMinutes;
  });
}

export function detectCountCollapse(previousCount, currentCount) {
  const previous = Number(previousCount), current = Number(currentCount);
  return previous >= RADAR_RULES.marketAnomalyMinComparable && current < previous * RADAR_RULES.marketCountCollapseRatio;
}

export function defaultRadarMeta(nowMs = Date.now()) {
  return {
    version: RADAR_VERSION,
    mode: 'test',
    testStartedAt: null,
    firstScanAt: null,
    lastScanAt: null,
    lastScanId: null,
    previousDomesticRoutes: 0,
    currentCandidates: [],
    published: [],
    unknownLocks: [],
    boardHistory: [],
    lastCandidate: null,
    lastVerifiedCandidate: null,
    lastScanReport: null,
    reservation: null,
    createdAt: new Date(nowMs).toISOString(),
    updatedAt: new Date(nowMs).toISOString()
  };
}

export function buildRadarCaption(candidate, labels = {}) {
  const originName = labels.origin || candidate.originCityFa || candidate.origin;
  const destinationName = labels.destination || candidate.destinationCityFa || candidate.destination;
  const dateLabel = labels.date || jalaliShortLabel(candidate.departureDate);
  const price = formatMoneyLatin(candidate.exactPriceToman || candidate.priceFeedToman);
  const checkedAt = String(candidate.checkedAtTehran || '—');
  let reason;
  if (candidate.signalType === 'recent_drop') reason = `📉 <b>${formatDropPercent(candidate.recentDropPct)}</b> پایین‌تر از میانه پایش چند ساعت اخیر`;
  else if (candidate.signalType === 'calendar_low') reason = `🗓 <b>${formatDropPercent(candidate.calendarGapPct)}</b> پایین‌تر از میانه تاریخ‌های نزدیک همین مسیر`;
  else if (candidate.signalType === 'historical_low') reason = `🔥 <b>${formatDropPercent(candidate.historicalGapPct)}</b> پایین‌تر از میانه چندروزه Radar`;
  else reason = `💎 یکی از نرخ‌های ارزشمند فعلی همین مسیر`;
  const ltr = value => `\u2066${value}\u2069`;
  return [
    '🚨 <b>Radar Flash | فرصت ویژه</b>',
    '<b>پروازهای داخلی ایران زمین ♥️</b>',
    '',
    `✈️ <b>${originName} به ${destinationName}</b>  |  📅 <b>${ltr(dateLabel)}</b>`,
    `🔥 <b>${ltr(price)} تومان</b>`,
    reason,
    '✅ قیمت و ظرفیت در جست‌وجوی نهایی فلای‌یاب تأیید شد',
    `⏱ آخرین بررسی: <b>${ltr(checkedAt)}</b>`,
    '',
    '@FlyYab'
  ].join('\n');
}

export function radarReservationToken(scanId, candidate) {
  const base = `${scanId}|${candidate.key}|${candidate.priceFeedToman}|${candidate.opportunityScore}`;
  let hash = 2166136261;
  for (let index = 0; index < base.length; index++) { hash ^= base.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `radar-v3-${(hash >>> 0).toString(16)}-${String(scanId).replace(/[^0-9A-Za-z]/g, '').slice(-10)}`;
}
