import {
  INTERNATIONAL_RADAR_VERSION,
  INTERNATIONAL_RADAR_RULES,
  internationalRadarReservationToken
} from './international-radar-core.mjs';

const META_KEY = 'international-radar-meta-v1';

function defaultMeta(nowMs = Date.now()) {
  return {
    version: INTERNATIONAL_RADAR_VERSION,
    mode: 'test',
    testStartedAt: null,
    liveApprovedAt: null,
    lastScanAt: null,
    lastScanId: null,
    lastScanReport: null,
    lastCandidate: null,
    lastVerifiedCandidate: null,
    lastPublished: null,
    reservation: null,
    published: [],
    rejected: [],
    recentScans: [],
    lastFailure: null,
    lastFailureAt: null,
    lastFailureKey: null,
    createdAt: new Date(nowMs).toISOString(),
    updatedAt: new Date(nowMs).toISOString()
  };
}

async function getMeta(storage, nowMs = Date.now()) {
  const saved = await storage.get(META_KEY);
  if (!saved) return defaultMeta(nowMs);
  if (saved.version !== INTERNATIONAL_RADAR_VERSION) {
    const migrated = {
      ...defaultMeta(nowMs),
      ...saved,
      version: INTERNATIONAL_RADAR_VERSION,
      mode: saved.mode === 'live' ? 'live' : 'test',
      testStartedAt: saved.testStartedAt || null,
      liveApprovedAt: saved.liveApprovedAt || null,
      published: Array.isArray(saved.published) ? saved.published : [],
      rejected: Array.isArray(saved.rejected) ? saved.rejected : [],
      recentScans: Array.isArray(saved.recentScans) ? saved.recentScans : [],
      migratedFrom: saved.version || 'unknown',
      migratedAt: new Date(nowMs).toISOString(),
      updatedAt: new Date(nowMs).toISOString()
    };
    await storage.put(META_KEY, migrated);
    return migrated;
  }
  return saved;
}

function prune(meta, nowMs) {
  const publicationMin = nowMs - INTERNATIONAL_RADAR_RULES.rollingQuotaMs - INTERNATIONAL_RADAR_RULES.routeDateCooldownMs;
  meta.published = (Array.isArray(meta.published) ? meta.published : []).filter(item => Number(item.at) >= publicationMin).slice(-100);
  const rejectionMin = nowMs - INTERNATIONAL_RADAR_RULES.rejectionCooldownMs;
  meta.rejected = (Array.isArray(meta.rejected) ? meta.rejected : []).filter(item => Number(item.at) >= rejectionMin).slice(-100);
  meta.recentScans = (Array.isArray(meta.recentScans) ? meta.recentScans : []).slice(-287);
  if (meta.reservation && nowMs - Number(meta.reservation.createdAt || 0) > INTERNATIONAL_RADAR_RULES.reservationTtlMs) {
    meta.lastExpiredReservation = { ...meta.reservation, expiredAt: nowMs };
    meta.reservation = null;
  }
}

function publishedInWindow(meta, nowMs) {
  const activeMode = meta.mode === 'live' ? 'live' : 'test';
  return meta.published.filter(item =>
    item.radarMode === activeMode && nowMs - Number(item.at) <= INTERNATIONAL_RADAR_RULES.rollingQuotaMs
  );
}

function quota(meta) {
  return meta.mode === 'live' ? INTERNATIONAL_RADAR_RULES.liveRollingQuotaCount : INTERNATIONAL_RADAR_RULES.testRollingQuotaCount;
}

function duplicateReason(meta, candidate, nowMs) {
  const activeMode = meta.mode === 'live' ? 'live' : 'test';
  const previous = [...meta.published].reverse().find(item => item.key === candidate.key && item.radarMode === activeMode);
  if (!previous) return null;
  if (nowMs - Number(previous.at) >= INTERNATIONAL_RADAR_RULES.routeDateCooldownMs) return null;
  const previousPrice = Number(previous.exactPriceToman || previous.priceFeedToman);
  const currentPrice = Number(candidate.priceFeedToman);
  const improvement = previousPrice > 0 && currentPrice < previousPrice ? (previousPrice - currentPrice) / previousPrice * 100 : 0;
  return improvement >= INTERNATIONAL_RADAR_RULES.realertImprovementPct ? null : 'ROUTE_DATE_COOLDOWN';
}

function rejectedRecently(meta, candidate, nowMs) {
  return meta.rejected.some(item => item.key === candidate.key && nowMs - Number(item.at) < INTERNATIONAL_RADAR_RULES.rejectionCooldownMs);
}

function globalCooldown(meta, nowMs) {
  const activeMode = meta.mode === 'live' ? 'live' : 'test';
  const last = meta.published.filter(item => item.radarMode === activeMode).sort((a, b) => Number(b.at) - Number(a.at))[0];
  return last && nowMs - Number(last.at) < INTERNATIONAL_RADAR_RULES.globalCooldownMs;
}

function numericMedian(values) {
  const rows = values.map(Number).filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!rows.length) return null;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

const CATEGORY_COUNT_FIELD = Object.freeze({
  iran_outbound: 'iranOutboundRoutes',
  iran_inbound: 'iranInboundRoutes',
  istanbul_hub: 'istanbulHubRoutes'
});

function collapsedSourceCategories(meta, sourceCounts) {
  const collapsed = [];
  for (const [category, field] of Object.entries(CATEGORY_COUNT_FIELD)) {
    const history = (Array.isArray(meta.recentScans) ? meta.recentScans : [])
      .slice(-12)
      .map(item => item?.sourceCounts?.[field])
      .filter(value => Number.isFinite(Number(value)));
    const baseline = numericMedian(history);
    const current = Number(sourceCounts?.[field] || 0);
    if (baseline !== null && baseline >= 5 && current < baseline * 0.55) {
      collapsed.push({ category, field, current, baseline });
    }
  }
  return collapsed;
}

function modeInfo(meta, nowMs) {
  const started = meta.testStartedAt ? Date.parse(meta.testStartedAt) : null;
  const elapsed = started ? Math.max(0, nowMs - started) : 0;
  return {
    mode: meta.mode === 'live' ? 'live' : 'test',
    testStartedAt: meta.testStartedAt || null,
    testElapsedMs: elapsed,
    canGoLive: Boolean(started && elapsed >= INTERNATIONAL_RADAR_RULES.testMinDurationMs),
    remainingTestMs: started ? Math.max(0, INTERNATIONAL_RADAR_RULES.testMinDurationMs - elapsed) : INTERNATIONAL_RADAR_RULES.testMinDurationMs
  };
}

async function ingest(storage, body) {
  const nowMs = Number(body.observedAtMs || Date.now());
  const scanId = String(body.scanId || '');
  const tehranClock = String(body.tehranClock || '');
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  const sourceCounts = body.sourceCounts && typeof body.sourceCounts === 'object' ? body.sourceCounts : {};
  if (!scanId) return { ok: false, error: 'SCAN_ID_REQUIRED' };
  const meta = await getMeta(storage, nowMs);
  prune(meta, nowMs);
  if (meta.lastScanId === scanId) return { ok: true, duplicate: true, report: meta.lastScanReport, reservation: null, ...modeInfo(meta, nowMs) };
  if (!meta.testStartedAt) meta.testStartedAt = new Date(nowMs).toISOString();

  const collapsedCategories = collapsedSourceCategories(meta, sourceCounts);
  const collapsedCategoryNames = new Set(collapsedCategories.map(item => item.category));

  let blockedReason = null;
  if (meta.reservation) blockedReason = 'VERIFICATION_LOCK';
  else if (publishedInWindow(meta, nowMs).length >= quota(meta)) blockedReason = 'QUOTA_24H';
  else if (globalCooldown(meta, nowMs)) blockedReason = 'GLOBAL_COOLDOWN';

  const eligible = [];
  const rejectionCounts = { recentlyRejected: 0, duplicate: 0, lowScore: 0 };
  for (const candidate of candidates) {
    if (collapsedCategoryNames.has(candidate?.category)) {
      rejectionCounts.sourceCollapse = Number(rejectionCounts.sourceCollapse || 0) + 1;
      continue;
    }
    if (Number(candidate?.opportunityScore || 0) < INTERNATIONAL_RADAR_RULES.opportunityScoreThreshold) {
      rejectionCounts.lowScore++;
      continue;
    }
    if (rejectedRecently(meta, candidate, nowMs)) {
      rejectionCounts.recentlyRejected++;
      continue;
    }
    if (duplicateReason(meta, candidate, nowMs)) {
      rejectionCounts.duplicate++;
      continue;
    }
    eligible.push(candidate);
  }

  let reservation = null;
  if (!blockedReason && eligible.length) {
    const candidate = eligible[0];
    reservation = {
      token: internationalRadarReservationToken(scanId, candidate),
      scanId,
      createdAt: nowMs,
      radarMode: meta.mode === 'live' ? 'live' : 'test',
      candidate
    };
    meta.reservation = reservation;
    meta.lastCandidate = candidate;
  }

  const topReason = reservation ? 'RESERVED_FOR_VERIFICATION'
    : blockedReason || (collapsedCategories.length && !eligible.length ? 'SOURCE_COUNT_COLLAPSE'
      : candidates.length && !eligible.length ? 'NO_ELIGIBLE_AFTER_GUARDS' : 'NO_QUALIFIED_OPPORTUNITY');
  const report = {
    scanId,
    at: new Date(nowMs).toISOString(),
    tehranClock,
    sourceCounts,
    candidates: candidates.length,
    eligible: eligible.length,
    rejectionCounts,
    collapsedCategories,
    bestCandidate: candidates[0] ? {
      key: candidates[0].key,
      score: candidates[0].opportunityScore,
      priceFeedToman: candidates[0].priceFeedToman,
      medianGapPct: candidates[0].medianGapPct,
      category: candidates[0].category
    } : null,
    reserved: Boolean(reservation),
    topReason
  };
  meta.lastScanAt = report.at;
  meta.lastScanId = scanId;
  meta.lastScanReport = report;
  meta.recentScans.push({
    at: report.at,
    topReason,
    candidates: report.candidates,
    eligible: report.eligible,
    bestScore: report.bestCandidate?.score || null,
    sourceCounts
  });
  meta.recentScans = meta.recentScans.slice(-288);
  meta.updatedAt = report.at;
  let warning = null;
  if (collapsedCategories.length) {
    const warningKey = collapsedCategories
      .map(item => `${item.category}:${item.current}/${Math.round(item.baseline)}`)
      .sort()
      .join('|');
    if (meta.lastWarningKey !== warningKey || nowMs - Number(meta.lastWarningAt || 0) > 60 * 60 * 1000) {
      warning = warningKey;
      meta.lastWarningKey = warningKey;
      meta.lastWarningAt = nowMs;
    }
  }
  await storage.put(META_KEY, meta);
  return { ok: true, duplicate: false, report, reservation, warning, ...modeInfo(meta, nowMs) };
}

async function ack(storage, body) {
  const nowMs = Number(body.atMs || Date.now());
  const token = String(body.token || '');
  const meta = await getMeta(storage, nowMs);
  const reservation = meta.reservation;
  // Accept the exact in-flight token even if a slow network response arrives
  // after the nominal reservation TTL. The Telegram request may already have
  // succeeded and its acknowledgement must never be lost.
  if (!reservation || reservation.token !== token) {
    prune(meta, nowMs);
    return { ok: false, error: 'RESERVATION_NOT_FOUND' };
  }
  prune(meta, nowMs);
  const status = String(body.status || 'unknown');
  const candidate = body.candidate && typeof body.candidate === 'object' ? body.candidate : reservation.candidate;
  if (status === 'published') {
    const publication = {
      key: candidate.key,
      routeKey: candidate.routeKey,
      category: candidate.category,
      origin: candidate.origin,
      destination: candidate.destination,
      bookingOrigin: candidate.bookingOrigin || candidate.origin,
      bookingDestination: candidate.bookingDestination || candidate.destination,
      bookingRouteSource: candidate.bookingRouteSource || 'exact-fallback',
      departureDate: candidate.departureDate,
      priceFeedToman: candidate.priceFeedToman,
      exactPriceToman: candidate.exactPriceToman,
      checkedAtTehran: candidate.checkedAtTehran,
      verifiedAt: candidate.verifiedAt,
      at: nowMs,
      channel: String(body.channel || ''),
      telegramMessageId: body.telegramMessageId || null,
      radarMode: reservation.radarMode
    };
    meta.published.push(publication);
    meta.lastPublished = publication;
    meta.lastVerifiedCandidate = candidate;
  } else if (status === 'verification_rejected') {
    const rejection = { key: candidate.key, routeKey: candidate.routeKey, at: nowMs, reason: String(body.reason || 'VERIFICATION_REJECTED') };
    meta.rejected.push(rejection);
    meta.lastRejected = { ...rejection, candidate };
  } else if (status === 'send_unknown') {
    meta.lastVerifiedCandidate = candidate;
    meta.lastSendUnknown = { candidate, at: nowMs, error: String(body.error || '') };
    // Telegram may have accepted a request even when the Worker lost the
    // response. Quarantine it as a possible publication to guarantee that an
    // automatic retry cannot create a duplicate post.
    const uncertainPublication = {
      key: candidate.key,
      routeKey: candidate.routeKey,
      category: candidate.category,
      origin: candidate.origin,
      destination: candidate.destination,
      bookingOrigin: candidate.bookingOrigin || candidate.origin,
      bookingDestination: candidate.bookingDestination || candidate.destination,
      bookingRouteSource: candidate.bookingRouteSource || 'exact-fallback',
      departureDate: candidate.departureDate,
      priceFeedToman: candidate.priceFeedToman,
      exactPriceToman: candidate.exactPriceToman,
      checkedAtTehran: candidate.checkedAtTehran,
      verifiedAt: candidate.verifiedAt,
      at: nowMs,
      channel: String(body.channel || ''),
      telegramMessageId: null,
      radarMode: reservation.radarMode,
      deliveryStatus: 'unknown'
    };
    meta.published.push(uncertainPublication);
  } else {
    meta.lastVerifiedCandidate = candidate?.exactPriceToman ? candidate : meta.lastVerifiedCandidate;
    meta.lastSendFailed = { candidate, at: nowMs, error: String(body.error || '') };
  }
  meta.reservation = null;
  meta.updatedAt = new Date(nowMs).toISOString();
  prune(meta, nowMs);
  await storage.put(META_KEY, meta);
  return { ok: true, status };
}

async function setMode(storage, mode, nowMs) {
  const meta = await getMeta(storage, nowMs);
  if (mode === 'live') {
    const info = modeInfo(meta, nowMs);
    if (!info.canGoLive) return { ok: false, error: 'MIN_72H_TEST_REQUIRED', ...info };
    meta.mode = 'live';
    meta.liveApprovedAt = new Date(nowMs).toISOString();
  } else {
    meta.mode = 'test';
    if (!meta.testStartedAt) meta.testStartedAt = new Date(nowMs).toISOString();
  }
  meta.updatedAt = new Date(nowMs).toISOString();
  await storage.put(META_KEY, meta);
  return { ok: true, ...modeInfo(meta, nowMs) };
}

async function recordFailure(storage, body, nowMs) {
  const meta = await getMeta(storage, nowMs);
  const key = String(body.key || body.error || 'INTERNATIONAL_RADAR_FAILURE').slice(0, 300);
  const notify = meta.lastFailureKey !== key || nowMs - Number(meta.lastFailureAt || 0) > 60 * 60 * 1000;
  meta.lastFailureKey = key;
  meta.lastFailureAt = nowMs;
  meta.lastFailure = String(body.error || key).slice(0, 1200);
  meta.updatedAt = new Date(nowMs).toISOString();
  await storage.put(META_KEY, meta);
  return { ok: true, notify };
}

export async function internationalRadarDurableFetch(storage, request) {
  const url = new URL(request.url);
  const nowMs = Date.now();
  if (url.pathname === '/international-radar/ingest' && request.method === 'POST') return Response.json(await ingest(storage, await request.json()));
  if (url.pathname === '/international-radar/ack' && request.method === 'POST') return Response.json(await ack(storage, await request.json()));
  if (url.pathname === '/international-radar/mode/test' && request.method === 'POST') return Response.json(await setMode(storage, 'test', nowMs));
  if (url.pathname === '/international-radar/mode/live' && request.method === 'POST') {
    const result = await setMode(storage, 'live', nowMs);
    return Response.json(result, { status: result.ok ? 200 : 409 });
  }
  if (url.pathname === '/international-radar/failure' && request.method === 'POST') return Response.json(await recordFailure(storage, await request.json().catch(() => ({})), nowMs));
  if (url.pathname === '/international-radar/status') {
    const meta = await getMeta(storage, nowMs);
    prune(meta, nowMs);
    return Response.json({ ok: true, version: INTERNATIONAL_RADAR_VERSION, ...modeInfo(meta, nowMs), meta });
  }
  if (url.pathname === '/international-radar/preview') {
    const meta = await getMeta(storage, nowMs);
    return Response.json({ ok: true, candidate: meta.lastVerifiedCandidate || null, lastPublished: meta.lastPublished || null, lastRejected: meta.lastRejected || null });
  }
  return Response.json({ ok: false, error: 'INTERNATIONAL_RADAR_ROUTE_NOT_FOUND' }, { status: 404 });
}
