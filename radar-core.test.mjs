import assert from 'node:assert/strict';
import {
  RADAR_VERSION, RADAR_RULES, DOMESTIC_AIRPORTS, median, dropPercent, formatDropPercent,
  formatMoneyLatin, jalaliShortLabel, normalizeRadarJalali, radarDateInputCalendar, routeKey, buildDomesticRadarSnapshot, domesticFeedHealth, defaultRouteState,
  applyObservation, validateVerifiedDomesticFare, rescoreVerifiedCandidate, rankCandidates,
  isStrongFlashCandidate, isPublishWindow, isScheduleConflict, detectCountCollapse, buildRadarCaption
} from './radar-core.mjs';

assert.equal(RADAR_VERSION, 'flyyab-domestic-fare-intelligence-v3.2-nearby-ranking');
assert.equal(RADAR_RULES.boardMaxItems, 6);
assert.equal(RADAR_RULES.feedTimeoutMs, 10_000);
assert.equal(RADAR_RULES.boardVerificationConcurrency, 4);
assert.equal(RADAR_RULES.boardVerificationBudgetMs, 45_000);
assert.equal(RADAR_RULES.flashRollingQuotaCount, 2);
assert.ok(DOMESTIC_AIRPORTS.has('THR'));
assert.ok(DOMESTIC_AIRPORTS.has('NSH'));
assert.equal(median([1,3,2]), 2);
assert.equal(median([1,2,3,4]), 2.5);
assert.equal(formatDropPercent(20.44), '20.4%');
assert.equal(formatMoneyLatin(1_900_000), '1,900,000');
assert.equal(jalaliShortLabel('1405-05-27'), '27 مرداد');

assert.equal(normalizeRadarJalali('2026-08-18'), '1405-05-27', 'Gregorian feed dates must convert to Jalali');
assert.equal(normalizeRadarJalali('2026/08/20T00:00:00'), '1405-05-29', 'ISO/slash Gregorian dates must convert');
assert.equal(normalizeRadarJalali('۱۴۰۵/۰۵/۲۹'), '1405-05-29', 'Persian digits must normalize');
assert.equal(radarDateInputCalendar('2026-08-20'), 'gregorian');
assert.equal(radarDateInputCalendar('1405-05-29'), 'jalali');
assert.equal(radarDateInputCalendar('not-a-date'), 'invalid');

const gregorianFeed = {
  status:'success',
  minPrice:{
    THR:{
      KIH:{
        minDate:{
          '2026-08-18':[3900,''],
          '2026-08-19':[3700,''],
          '2026-08-20':[2100,''],
          '2026-08-21':[3600,''],
          '2026-08-22':[4000,'']
        },
        minWeek:[null,2100,'2026-08-20']
      }
    }
  }
};
const gregorianSnapshot = buildDomesticRadarSnapshot(gregorianFeed, '1405-05-27');
assert.equal(gregorianSnapshot.counts.domesticRouteObjects, 1);
assert.equal(gregorianSnapshot.counts.domesticRoutes, 1);
assert.equal(gregorianSnapshot.counts.activeDateRows, 5);
assert.ok(gregorianSnapshot.counts.gregorianDateInputs >= 5);
assert.equal(gregorianSnapshot.counts.invalidDateInputs, 0);
assert.equal(gregorianSnapshot.observations.some(row => row.departureDate === '1405-05-29' && row.priceFeedToman === 2_100_000), true);
assert.equal(domesticFeedHealth(gregorianSnapshot).ok, true);

assert.equal(gregorianSnapshot.observations.find(row => row.departureDate === '1405-05-29')?.calendarReferenceScope, 'nearby_7');
assert.ok((gregorianSnapshot.observations.find(row => row.departureDate === '1405-05-29')?.calendarSampleCount || 0) >= 3);

// Calendar Value must prefer nearby dates and resist unrelated far-future price spikes.
const nearbyFeed = {
  status:'success',
  minPrice:{THR:{KIH:{
    minDate:{
      '1405-05-27':[3900,''], '1405-05-28':[3800,''], '1405-05-29':[2100,''],
      '1405-05-30':[3700,''], '1405-05-31':[4000,''], '1405-06-10':[12000,''],
      '1405-06-15':[13000,''], '1405-06-20':[14000,'']
    },
    minWeek:[null,2100,'1405-05-29']
  }}}
};
const nearbySnapshot = buildDomesticRadarSnapshot(nearbyFeed,'1405-05-27');
const nearbyLow = nearbySnapshot.observations.find(row => row.departureDate === '1405-05-29');
assert.ok(nearbyLow);
assert.equal(nearbyLow.calendarReferenceScope,'nearby_7');
assert.equal(nearbyLow.calendarReferenceToman,3_850_000);
assert.ok(nearbyLow.calendarGapPct > 40 && nearbyLow.calendarGapPct < 50);
assert.equal(nearbyLow.priceRank,1);
assert.equal(nearbyLow.calendarRankCount,5);

const unusableSnapshot = buildDomesticRadarSnapshot({status:'success',minPrice:{THR:{KIH:{minDate:{'broken':[2200,'']},minWeek:[null,2200,'broken']}}}}, '1405-05-27');
assert.equal(unusableSnapshot.counts.domesticRouteObjects, 1);
assert.equal(unusableSnapshot.counts.domesticRoutes, 0);
assert.equal(domesticFeedHealth(unusableSnapshot).code, 'DOMESTIC_FEED_DATES_UNUSABLE');
assert.equal(domesticFeedHealth({counts:{feedOrigins:0,domesticRoutes:0,activeDateRows:0,observedRows:0}}).code, 'DOMESTIC_FEED_EMPTY');

const feed = {
  status: 'success',
  minPrice: {
    THR: {
      KIH: {
        minDate: {
          '1405-05-27': [3900, ''],
          '1405-05-28': [3700, ''],
          '1405-05-29': [2100, ''],
          '1405-05-30': [3600, ''],
          '1405-05-31': [4000, '']
        },
        minWeek: [null, 2100, '1405-05-29']
      },
      DXB: { minDate: { '1405-05-29': [8000, ''] }, minWeek: [null, 8000, '1405-05-29'] }
    },
    MHD: {
      SYZ: {
        minDate: {
          '1405-05-28': [3300, ''], '1405-05-29': [2400, ''], '1405-05-30': [3500, ''], '1405-05-31': [3600, '']
        },
        minWeek: [null, 2400, '1405-05-29']
      }
    }
  },
  // Must never be read by the domestic Radar.
  gminPrice: { IKA: { IST: { minDate: { '1405-05-29': [9000, ''] }, minWeek: [null, 9000, '1405-05-29'] } } }
};
const snapshot = buildDomesticRadarSnapshot(feed, '1405-05-27');
assert.equal(snapshot.counts.domesticRoutes, 2);
assert.equal(snapshot.counts.ignoredNonDomesticRoutes, 1, 'foreign route hidden inside minPrice must be ignored');
assert.equal(snapshot.counts.activeDateRows, 9);
assert.ok(snapshot.observations.length >= 2);
assert.equal(snapshot.observations.some(row => row.origin === 'IKA' || row.destination === 'IST'), false, 'gminPrice must be completely ignored');
const calendarLow = snapshot.observations.find(row => row.origin === 'THR' && row.destination === 'KIH');
assert.ok(calendarLow);
assert.equal(calendarLow.priceFeedToman, 2_100_000);
assert.equal(calendarLow.priceRank, 1);
assert.ok(calendarLow.calendarGapPct > 40);
assert.equal(routeKey(calendarLow), 'domestic|THR|KIH|1405-05-29');

// A strong calendar opportunity can qualify for the Board even without a sudden drop.
let state = defaultRouteState(calendarLow, Date.now());
let result;
const t0 = Date.now();
for (let i = 0; i < 6; i++) {
  result = applyObservation(state, calendarLow, t0 + i * 5 * 60_000);
  state = result.state;
}
assert.equal(result.status, 'CANDIDATE');
assert.ok(result.candidate.opportunityScore >= RADAR_RULES.boardPreScoreThreshold);
assert.equal(result.candidate.recentDropPct, 0, 'stable low calendar price does not need a fake recent drop');
const verifiedCalendar = rescoreVerifiedCandidate(result.candidate, {
  exactPriceToman: 2_100_000, currencyCode: 'IRR', capacity: 3,
  origin: 'THR', destination: 'KIH', departureDate: '1405-05-29', checkedAtTehran: '13:25'
});
assert.equal(verifiedCalendar.ok, true);
assert.ok(verifiedCalendar.candidate.opportunityScore >= RADAR_RULES.boardVerifiedScoreThreshold, 'calendar-only opportunity must be able to enter Board after exact verification');
assert.equal(verifiedCalendar.candidate.verified, true);

// Build history at a normal price, then a deep drop must become a strong Flash after confirmations.
const normal = { ...calendarLow, priceFeedToman: 4_800_000, routeMedianToman: 4_900_000, routeMinToman: 4_500_000, calendarGapPct: 2, priceRankRatio: 0.8 };
const low = { ...normal, priceFeedToman: 2_800_000, routeMedianToman: 4_900_000, routeMinToman: 2_800_000, calendarGapPct: dropPercent(4_900_000, 2_800_000), priceRankRatio: 0.15 };
state = null;
// Historical memory is sampled every 30 minutes, so build a real multi-hour normal baseline first.
for (let i = 0; i < 4; i++) state = applyObservation(state, normal, t0 + i * 30 * 60_000).state;
const lowStart = t0 + 95 * 60_000;
for (let i = 0; i < 3; i++) {
  result = applyObservation(state, low, lowStart + i * 5 * 60_000);
  state = result.state;
}
assert.ok(result.candidate);
assert.ok(result.candidate.recentDropPct > 35);
assert.ok(result.candidate.historicalGapPct > 30);
assert.ok(result.candidate.confirmations >= 3);
assert.equal(isStrongFlashCandidate(result.candidate), true);
const verifiedFlash = rescoreVerifiedCandidate(result.candidate, {
  exactPriceToman: 2_800_000, currencyCode: 'IRR', capacity: 2,
  origin: 'THR', destination: 'KIH', departureDate: '1405-05-29', checkedAtTehran: '12:45'
});
assert.equal(verifiedFlash.ok, true);
assert.ok(verifiedFlash.candidate.opportunityScore >= RADAR_RULES.flashVerifiedScoreThreshold);

// Exact search is the final truth: stale feed or sold-out fare must be rejected.
assert.equal(validateVerifiedDomesticFare(calendarLow, {
  exactPriceToman: 2_500_000, currencyCode: 'IRR', capacity: 2,
  origin: 'THR', destination: 'KIH', departureDate: '1405-05-29'
}).ok, false, 'price rise beyond tolerance must reject the alert');
assert.equal(validateVerifiedDomesticFare(calendarLow, {
  exactPriceToman: 2_100_000, currencyCode: 'IRR', capacity: 0,
  origin: 'THR', destination: 'KIH', departureDate: '1405-05-29'
}).reason, 'NO_CAPACITY');

const ranked = rankCandidates([
  { key:'a', opportunityScore:70, recentDropPct:20, calendarGapPct:10, historicalGapPct:5, savingToman:1_000_000, exactPriceToman:2_000_000 },
  { key:'b', opportunityScore:82, recentDropPct:10, calendarGapPct:30, historicalGapPct:5, savingToman:800_000, exactPriceToman:2_100_000 }
]);
assert.equal(ranked[0].key, 'b');

assert.equal(isPublishWindow('08:25'), false);
assert.equal(isPublishWindow('08:30'), true);
assert.equal(isPublishWindow('19:30'), true);
assert.equal(isPublishWindow('19:35'), false);
assert.equal(isScheduleConflict('13:10'), true, '20-minute protection radius around 13:30 Board');
assert.equal(isScheduleConflict('13:05'), false);
assert.equal(detectCountCollapse(100, 40), true);
assert.equal(detectCountCollapse(10, 1), false);

const caption = buildRadarCaption({
  ...verifiedFlash.candidate,
  originCityFa: 'تهران', destinationCityFa: 'کیش', checkedAtTehran: '12:45'
}, { origin:'تهران', destination:'کیش', date:'29 مرداد' });
assert.match(caption, /Radar Flash \| فرصت ویژه/);
assert.match(caption, /پروازهای داخلی ایران زمین ♥️/);
assert.match(caption, /تهران به کیش/);
assert.match(caption.replace(/[\u2066-\u2069]/g, ''), /2,800,000 تومان/);
assert.match(caption, /تأیید شد/);
assert.doesNotMatch(caption, /<a href=/, 'booking action belongs to inline button');
assert.equal(/[۰-۹]/.test(caption), false, 'Radar public numeric values remain Latin digits');

console.log('radar v3 domestic fare-intelligence core tests: ok');
