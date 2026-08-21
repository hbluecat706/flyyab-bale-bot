import assert from 'node:assert/strict';
import {
  INTERNATIONAL_RADAR_RULES,
  INTERNATIONAL_RADAR_VERSION,
  buildInternationalRadarCaption,
  buildInternationalRadarSnapshot,
  internationalRadarCategory,
  internationalRadarBookingCodes,
  internationalRadarDateLabel,
  validateVerifiedInternationalFare
} from './international-radar-core.mjs';

const route = (prices, startDay = 28, weekday = 'چهارشنبه') => ({
  minWeek: ['W5', Math.min(...prices) / 1000, `1405-05-${String(startDay).padStart(2, '0')}`],
  minDate: Object.fromEntries(prices.map((price, index) => [
    `1405-05-${String(startDay + index).padStart(2, '0')}`,
    [price / 1000, `${index ? 'پنج شنبه' : weekday}-${startDay + index}-مرداد`]
  ]))
});

assert.equal(INTERNATIONAL_RADAR_VERSION, 'flyyab-international-radar-v1.1-citywide-24h');
assert.equal(INTERNATIONAL_RADAR_RULES.scanIntervalMinutes, 15);
assert.equal(internationalRadarCategory('IKA', 'IST'), 'iran_outbound');
assert.equal(internationalRadarCategory('BGW', 'MHD'), 'iran_inbound');
assert.equal(internationalRadarCategory('IST', 'FRA'), 'istanbul_hub');
assert.equal(internationalRadarCategory('FRA', 'LHR'), null);
assert.equal(internationalRadarCategory('THR', 'MHD'), null);

const feed = {
  gminPrice: {
    IKA: {
      IST: route([12_000_000, 19_000_000, 20_000_000, 21_000_000, 22_000_000, 20_500_000, 21_500_000]),
      MHD: route([2_000_000, 3_000_000, 3_100_000, 3_200_000, 3_300_000])
    },
    BGW: { MHD: route([4_000_000, 7_000_000, 7_200_000, 7_300_000, 7_500_000]) },
    IST: { FRA: route([8_000_000, 13_000_000, 13_500_000, 14_000_000, 15_000_000]) },
    FRA: { LHR: route([4_000_000, 6_000_000, 6_100_000, 6_200_000, 6_300_000]) }
  }
};
const snapshot = buildInternationalRadarSnapshot(feed, '1405-05-23');
assert.equal(snapshot.counts.iranOutboundRoutes, 1);
assert.equal(snapshot.counts.iranInboundRoutes, 1);
assert.equal(snapshot.counts.istanbulHubRoutes, 1);
assert.equal(snapshot.counts.ignoredDomesticRoutes, 1);
assert.equal(snapshot.counts.ignoredForeignRoutes, 1);
assert.ok(snapshot.candidates.length >= 3);
assert.equal(snapshot.candidates[0].category, 'iran_outbound', 'Iran outbound must receive the highest market priority');
assert.equal(snapshot.candidates[0].origin, 'IKA');
assert.equal(snapshot.candidates[0].destination, 'IST');
assert.equal(snapshot.candidates[0].departureDate, '1405-05-28');
assert.ok(snapshot.candidates[0].opportunityScore >= INTERNATIONAL_RADAR_RULES.opportunityScoreThreshold);

const candidate = {
  ...snapshot.candidates[0],
  exactPriceToman: 12_200_000,
  checkedAtTehran: '01:35'
};
const verified = validateVerifiedInternationalFare(candidate, {
  exactPriceToman: 12_200_000,
  currencyCode: 'IRR',
  origin: 'IKA',
  destination: 'IST',
  departureDate: '1405-05-28',
  capacity: 3
});
assert.equal(verified.ok, true);
assert.equal(validateVerifiedInternationalFare(candidate, {
  exactPriceToman: 13_100_000,
  currencyCode: 'IRR', origin: 'IKA', destination: 'IST', departureDate: '1405-05-28', capacity: 3
}).reason, 'PRICE_CHANGED_TOO_MUCH');
assert.equal(validateVerifiedInternationalFare(candidate, {
  exactPriceToman: 12_200_000,
  currencyCode: 'IRR', origin: 'IKA', destination: 'IST', departureDate: '1405-05-28', capacity: 0
}).reason, 'NO_CAPACITY');

assert.deepEqual(internationalRadarBookingCodes(candidate, { IKA: 'THRALL', IST: 'ISTALL' }), {
  origin: 'IKA', destination: 'ISTALL'
}, 'Iranian airport must remain exact while a foreign multi-airport city is widened');
assert.deepEqual(internationalRadarBookingCodes({ origin: 'SAW', destination: 'LHR' }, { SAW: 'ISTALL', LHR: 'LONALL' }), {
  origin: 'ISTALL', destination: 'LONALL'
});
assert.equal(internationalRadarDateLabel(candidate), 'چهارشنبه، 28 مرداد 1405');
const caption = buildInternationalRadarCaption(candidate, { origin: 'تهران', destination: 'استانبول' }, 'https://flyyab.ir/international-flights/IKA-ISTALL?departing=1405-05-28');
assert.match(caption, /🚨 <b>فوری \| فرصت پرواز خارجی فلای‌یاب<\/b>/);
assert.match(caption, /تهران \(IKA\) به استانبول \(IST\)/);
assert.match(caption, /چهارشنبه، 28 مرداد 1405/);
assert.match(caption, /12,200,000 تومان/);
assert.match(caption, /01:35/);
assert.doesNotMatch(caption, /international-flights\/IKA-ISTALL|مشاهده و رزرو این مسیر|<a href=/, 'booking action belongs to the green inline button');
assert.doesNotMatch(caption, /→|⇄|ایرلاین|شماره پرواز/);
assert.doesNotMatch(caption, /[۰-۹٠-٩]/, 'public alert must use Latin digits only');
assert.ok(caption.split('\n').length <= 7, 'public alert must remain compact');

// Exact Jalali arithmetic must keep Nowruz lead-day filtering correct.
const newYearFeed = { gminPrice: { IKA: { IST: {
  minDate: {
    '1404-12-29': [12000, 'جمعه-29-اسفند'],
    '1405-01-01': [20000, 'شنبه-1-فروردین'],
    '1405-01-02': [21000, 'یکشنبه-2-فروردین']
  }
} } } };
const newYearSnapshot = buildInternationalRadarSnapshot(newYearFeed, '1404-12-28');
assert.equal(newYearSnapshot.routes[0].activeDates, 3);

console.log('international radar core/classification/visual contract tests: ok');
