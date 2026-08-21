import assert from 'node:assert/strict';
import { internationalRadarDurableFetch } from './international-radar-runtime.mjs';

class MemoryStorage {
  constructor(){ this.map = new Map(); }
  async get(key){ return this.map.has(key) ? structuredClone(this.map.get(key)) : undefined; }
  async put(key, value){ this.map.set(key, structuredClone(value)); }
  async delete(key){ return this.map.delete(key); }
}

function client(storage) {
  return async (path, { method = 'GET', body } = {}) => {
    const response = await internationalRadarDurableFetch(storage, new Request(`https://bot-control${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }));
    return { status: response.status, data: await response.json() };
  };
}

const candidate = (overrides = {}) => ({
  key: 'international-v1|IKA|IST|1405-05-28',
  routeKey: 'IKA|IST', category: 'iran_outbound', origin: 'IKA', destination: 'IST',
  departureDate: '1405-05-28', priceFeedToman: 12_000_000, routeMedianToman: 20_000_000,
  medianGapPct: 40, opportunityScore: 94, activeDates: 8, ...overrides
});

const base = Date.now() - 73 * 60 * 60 * 1000;
const storage = new MemoryStorage();
const call = client(storage);
const ingest = (scanId, atMs, candidates, extra = {}) => call('/international-radar/ingest', {
  method: 'POST',
  body: {
    scanId, observedAtMs: atMs, tehranClock: extra.tehranClock || '12:15', candidates,
    sourceCounts: extra.sourceCounts || { iranOutboundRoutes: 20, iranInboundRoutes: 15, istanbulHubRoutes: 12 }
  }
});

let result = await call('/international-radar/status');
assert.equal(result.data.mode, 'test');
assert.equal(result.data.canGoLive, false);
result = await ingest('test-1', base, [candidate()]);
assert.ok(result.data.reservation);
assert.equal(result.data.reservation.radarMode, 'test');
const testToken = result.data.reservation.token;
result = await call('/international-radar/ack', { method: 'POST', body: {
  token: testToken, status: 'published', atMs: base + 1000, channel: '@FlyYabBotTest', telegramMessageId: 10,
  candidate: candidate({ exactPriceToman: 12_100_000, checkedAtTehran: '12:15', verifiedAt: new Date(base).toISOString() })
} });
assert.equal(result.data.ok, true);

// TEST publications must not consume LIVE quota or cooldown after promotion.
result = await call('/international-radar/mode/live', { method: 'POST' });
assert.equal(result.status, 200);
assert.equal(result.data.mode, 'live');
const liveCandidate = candidate({ key: 'international-v1|BGW|MHD|1405-05-29', routeKey: 'BGW|MHD', category: 'iran_inbound', origin: 'BGW', destination: 'MHD', departureDate: '1405-05-29' });
result = await ingest('live-1', Date.now(), [liveCandidate]);
assert.ok(result.data.reservation, 'a prior TEST post must not block first LIVE reservation');

// An uncertain Telegram delivery is quarantined and cannot be retried.
const liveToken = result.data.reservation.token;
await call('/international-radar/ack', { method: 'POST', body: {
  token: liveToken, status: 'send_unknown', atMs: Date.now(), channel: '@FlyYab', error: 'network reset',
  candidate: { ...liveCandidate, exactPriceToman: 12_100_000, checkedAtTehran: '12:30', verifiedAt: new Date().toISOString() }
} });
result = await ingest('live-2', Date.now() + 15 * 60 * 1000, [liveCandidate]);
assert.equal(result.data.reservation, null);
assert.equal(result.data.report.rejectionCounts.duplicate, 1);

// Duplicate scan IDs are idempotent.
result = await ingest('live-2', Date.now() + 15 * 60 * 1000, [liveCandidate]);
assert.equal(result.data.duplicate, true);

// Eligible opportunities are reservable at night and near other scheduled posts.
for (const tehranClock of ['02:00', '16:00']) {
  const allDayStorage = new MemoryStorage();
  const allDayCall = client(allDayStorage);
  result = await allDayCall('/international-radar/ingest', { method: 'POST', body: {
    scanId: `all-day-${tehranClock}`, observedAtMs: Date.now(), tehranClock, candidates: [candidate()],
    sourceCounts: { iranOutboundRoutes: 20, iranInboundRoutes: 15, istanbulHubRoutes: 12 }
  } });
  assert.ok(result.data.reservation, `eligible opportunity must be publishable at ${tehranClock}`);
  assert.equal(result.data.report.topReason, 'RESERVED_FOR_VERIFICATION');
}

// A module upgrade preserves the active 72-hour test timer and operational history.
const migrationStorage = new MemoryStorage();
const startedAt = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
await migrationStorage.put('international-radar-meta-v1', {
  version: 'flyyab-international-radar-v1.0-live-test', mode: 'test', testStartedAt: startedAt,
  published: [{ key: 'old', at: Date.now() - 1000, radarMode: 'test' }], rejected: [], recentScans: []
});
result = await client(migrationStorage)('/international-radar/status');
assert.equal(result.data.testStartedAt, startedAt);
assert.equal(result.data.meta.migratedFrom, 'flyyab-international-radar-v1.0-live-test');
assert.equal(result.data.meta.published.length, 1);

// A >45% source-count collapse suppresses only candidates from that market.
const collapseStorage = new MemoryStorage();
const collapseCall = client(collapseStorage);
for (let index = 0; index < 5; index++) {
  await collapseCall('/international-radar/ingest', { method: 'POST', body: {
    scanId: `baseline-${index}`, observedAtMs: Date.now() + index, tehranClock: '12:15', candidates: [],
    sourceCounts: { iranOutboundRoutes: 20, iranInboundRoutes: 15, istanbulHubRoutes: 12 }
  } });
}
result = await collapseCall('/international-radar/ingest', { method: 'POST', body: {
  scanId: 'collapse', observedAtMs: Date.now() + 10, tehranClock: '12:15', candidates: [candidate()],
  sourceCounts: { iranOutboundRoutes: 4, iranInboundRoutes: 15, istanbulHubRoutes: 12 }
} });
assert.equal(result.data.reservation, null);
assert.equal(result.data.report.topReason, 'SOURCE_COUNT_COLLAPSE');
assert.ok(result.data.warning);

console.log('international radar durable mode/idempotency/anomaly tests: ok');
