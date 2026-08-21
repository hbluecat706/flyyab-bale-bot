import assert from 'node:assert/strict';
import { radarDurableFetch } from './radar-runtime.mjs';
import { RADAR_VERSION, RADAR_RULES, dropPercent, routeKey, routeCooldownKey } from './radar-core.mjs';

class MemoryStorage {
  constructor(){ this.map = new Map(); }
  async get(k){
    if (Array.isArray(k)) { const m = new Map(); for (const x of k) if (this.map.has(x)) m.set(x, structuredClone(this.map.get(x))); return m; }
    return this.map.has(k) ? structuredClone(this.map.get(k)) : undefined;
  }
  async put(k,v){
    if (k && typeof k === 'object' && !Array.isArray(k)) { for (const [x,y] of Object.entries(k)) this.map.set(x, structuredClone(y)); return; }
    this.map.set(k, structuredClone(v));
  }
  async delete(k){ if (Array.isArray(k)) { let n=0; for (const x of k) if (this.map.delete(x)) n++; return n; } return this.map.delete(k); }
  async list({prefix=''}={}){ const m=new Map(); for (const [k,v] of [...this.map].sort()) if (k.startsWith(prefix)) m.set(k,structuredClone(v)); return m; }
}

function api(storage){
  return async (path,{method='GET',body}={}) => {
    const r = await radarDurableFetch(storage,new Request('https://bot-control'+path,{method,headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}));
    return { status:r.status, data:await r.json() };
  };
}

const base = Date.now() - 3 * 60 * 60_000;
const normal = (price=4_800_000, date='1405-05-29', origin='THR', destination='KIH') => ({
  market:'domestic', origin, destination, departureDate:date, leadDays:3,
  priceFeedToman:price, routeMedianToman:4_900_000, routeMinToman:4_500_000,
  activeDates:7, priceRank:5, priceRankRatio:0.8, calendarGapPct:2,
  sourceMinWeek:true, selectionPotential:5
});
const low = (price=2_800_000, date='1405-05-29', origin='THR', destination='KIH') => ({
  ...normal(price,date,origin,destination), routeMinToman:price, priceRank:1, priceRankRatio:0.1,
  calendarGapPct:dropPercent(4_900_000,price), selectionPotential:50
});
const body = (scanId, at, observations, opts={}) => ({
  scanId, observedAtMs:at, tehranClock:opts.clock || '12:45', currentJalali:'1405-05-27',
  sourceCounts:{domesticRoutes:opts.domesticRoutes ?? 50, activeDateRows:opts.activeDateRows ?? 220, observedRows:observations.length},
  observations, suppressFlash:Boolean(opts.suppressFlash)
});

async function buildStrongFlash(call, prefix='a', route={origin:'THR',destination:'KIH',date:'1405-05-29'}) {
  let x;
  for (let i=0;i<4;i++) {
    x = await call('/radar/ingest',{method:'POST',body:body(`${prefix}-n${i}`,base+i*30*60_000,[normal(4_800_000,route.date,route.origin,route.destination)])});
    assert.equal(x.data.reservation,null);
  }
  const lowStart=base+95*60_000;
  for (let i=0;i<3;i++) x = await call('/radar/ingest',{method:'POST',body:body(`${prefix}-l${i}`,lowStart+i*5*60_000,[low(2_800_000,route.date,route.origin,route.destination)])});
  return x;
}

// Default V3 state is independently TEST-gated.
const s1 = new MemoryStorage();
const call1 = api(s1);
let x = await call1('/radar/status');
assert.equal(x.data.version,RADAR_VERSION);
assert.equal(x.data.mode,'test');
assert.equal(x.data.canGoLive,false);

// Deep domestic opportunity becomes reservable only after learning + confirmations.
x = await buildStrongFlash(call1,'flash');
assert.ok(x.data.reservation,'strong domestic opportunity should reserve for exact verification');
assert.equal(x.data.reservation.radarMode,'test');
assert.ok(x.data.report.flashEligible >= 1);
const firstReservation = x.data.reservation;

// Board candidates are available independently of Flash publication.
x = await call1('/radar/board-candidates?limit=6');
assert.equal(x.data.ok,true);
assert.ok(Array.isArray(x.data.candidates));
assert.ok(x.data.candidates.length >= 1);
assert.ok(x.data.candidates.length <= 6);
assert.equal(x.data.candidates.every(c => c.market === 'domestic'),true);
const boardCandidate = x.data.candidates[0];

// Verification rejection cools the same route/date without burning global publication quota.
x = await call1('/radar/ack',{method:'POST',body:{token:firstReservation.token,status:'verification_rejected',atMs:base+110*60_000,candidate:firstReservation.candidate,reason:'PRICE_CHANGED_TOO_MUCH'}});
assert.equal(x.data.ok,true);
x = await call1('/radar/ingest',{method:'POST',body:body('after-reject',base+115*60_000,[low()])});
assert.equal(x.data.reservation,null);
assert.ok(x.data.report.rejectedCooldown >= 1);

// A TEST board must not suppress future Flash; a published board is recorded separately.
x = await call1('/radar/board-ack',{method:'POST',body:{status:'tested',atMs:Date.now(),date:'1405-05-27',channel:'@FlyYabBotTest',candidates:[boardCandidate],verifiedCount:1}});
assert.equal(x.data.status,'tested');
let status=(await call1('/radar/status')).data;
assert.equal(status.meta.lastBoard.status,'tested');

// Duplicate scan IDs are idempotent.
const dupeBody = body('dupe-scan',base+120*60_000,[low()],{suppressFlash:true});
x = await call1('/radar/ingest',{method:'POST',body:dupeBody});
x = await call1('/radar/ingest',{method:'POST',body:dupeBody});
assert.equal(x.data.duplicate,true);
assert.equal(x.data.action,'DUPLICATE_SCAN');

// UNKNOWN Telegram outcome creates a hard safety lock and blocks the same route.
const s2 = new MemoryStorage();
const call2 = api(s2);
x = await buildStrongFlash(call2,'unknown');
assert.ok(x.data.reservation);
const unknownReservation=x.data.reservation;
await call2('/radar/ack',{method:'POST',body:{token:unknownReservation.token,status:'send_unknown',atMs:base+106*60_000,channel:'@FlyYabBotTest',error:'timeout-after-send'}});
status=(await call2('/radar/status')).data;
assert.ok(status.meta.unknownLocks.some(lock => lock.key === unknownReservation.candidate.key));
x = await call2('/radar/ingest',{method:'POST',body:body('unknown-next',base+110*60_000,[low()])});
assert.equal(x.data.reservation,null);
assert.equal(x.data.report.topReason,'FLASH_ROUTE_COOLDOWN');

// A published Board route also suppresses an immediate duplicate Flash, while a tested Board does not.
const s3=new MemoryStorage(); const call3=api(s3);
x=await buildStrongFlash(call3,'boardpub'); assert.ok(x.data.reservation);
await call3('/radar/ack',{method:'POST',body:{token:x.data.reservation.token,status:'verification_rejected',atMs:base+106*60_000,candidate:x.data.reservation.candidate,reason:'TEST_CLEAR_RESERVATION'}});
const boardNow=(await call3('/radar/board-candidates?limit=1')).data.candidates[0];
await call3('/radar/board-ack',{method:'POST',body:{status:'published',atMs:base+107*60_000,date:'1405-05-27',channel:'@FlyYab',candidates:[boardNow],verifiedCount:1}});
// The next daily Board must not immediately recycle the same OD route.
const boardAfterPublish=(await call3('/radar/board-candidates?limit=6')).data;
assert.equal(boardAfterPublish.candidates.some(candidate => routeCooldownKey(candidate) === routeCooldownKey(boardNow)),false,'published Board route must be hard-suppressed for freshness');
// Clear rejection cooldown only to isolate Board suppression semantics.
const storageKey='radar-route-v3:'+routeKey(boardNow);
const routeState=await s3.get(storageKey); routeState.rejectedUntil=0; await s3.put(storageKey,routeState);
x=await call3('/radar/ingest',{method:'POST',body:body('boardpub-next',base+110*60_000,[low()])});
assert.equal(x.data.reservation,null);
assert.equal(x.data.report.topReason,'FLASH_ROUTE_COOLDOWN');

// Domestic market collapse is a safety anomaly and creates no reservation.
const s4=new MemoryStorage(); const call4=api(s4);
await call4('/radar/ingest',{method:'POST',body:body('market-ok',base,[normal()],{domesticRoutes:100})});
x=await call4('/radar/ingest',{method:'POST',body:body('market-collapse',base+5*60_000,[low()],{domesticRoutes:30})});
assert.equal(x.data.report.anomaly,'DOMESTIC_COUNT_COLLAPSE');
assert.equal(x.data.reservation,null);
assert.equal(x.data.warning,'DOMESTIC_COUNT_COLLAPSE');

// A zero/unparseable domestic feed is never reported as healthy and never creates a reservation.
const sEmpty=new MemoryStorage(); const callEmpty=api(sEmpty);
x=await callEmpty('/radar/ingest',{method:'POST',body:{scanId:'empty-feed',observedAtMs:base,tehranClock:'12:45',currentJalali:'1405-05-27',sourceCounts:{feedOrigins:1,domesticRouteObjects:12,domesticRoutes:0,activeDateRows:0,observedRows:0,invalidDateInputs:24},observations:[],suppressFlash:true}});
assert.equal(x.data.report.feedHealth.ok,false);
assert.equal(x.data.report.anomaly,'DOMESTIC_FEED_DATES_UNUSABLE');
assert.equal(x.data.report.topReason,'MARKET_ANOMALY');
assert.equal(x.data.reservation,null);
assert.equal(x.data.warning,'DOMESTIC_FEED_DATES_UNUSABLE');

// Legacy migration carries only TEST/LIVE timing, never legacy international route/event state.
const s5=new MemoryStorage(); const call5=api(s5);
await s5.put('radar-meta-v1',{version:'flyyab-radar-v2',mode:'test',testStartedAt:new Date(Date.now()-25*60*60_000).toISOString(),firstScanAt:new Date(Date.now()-26*60*60_000).toISOString(),liveApprovedAt:null,pendingKeys:['international|IKA|IST|1405-05-29']});
x=await call5('/radar/status');
assert.equal(x.data.meta.migratedFrom,'flyyab-radar-v2');
x=await call5('/radar/mode/live',{method:'POST'});
assert.equal(x.status,200);
assert.equal(x.data.mode,'live');
assert.equal([...s5.map.keys()].some(k => k.includes('international|')),false);

// Fresh installs cannot go LIVE before the 24h TEST gate.
const s6=new MemoryStorage(); const call6=api(s6);
await call6('/radar/mode/test',{method:'POST'});
x=await call6('/radar/mode/live',{method:'POST'});
assert.equal(x.status,409);
assert.equal(x.data.error,'MIN_24H_TEST_REQUIRED');

console.log('radar v3 durable-state, locks, board-history and test-gate tests: ok');
