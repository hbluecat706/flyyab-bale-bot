import {
  RADAR_VERSION,
  RADAR_RULES,
  defaultRadarMeta,
  defaultRouteState,
  routeKey,
  routeCooldownKey,
  radarRouteStorageKey,
  applyObservation,
  rankCandidates,
  isStrongFlashCandidate,
  isPublishWindow,
  isScheduleConflict,
  detectCountCollapse,
  radarReservationToken,
  domesticFeedHealth
} from './radar-core.mjs';

const META_KEY = 'radar-meta-v3';
const LEGACY_META_KEY = 'radar-meta-v1';
const ROUTE_PREFIX = 'radar-route-v3:';
const MAX_BATCH = 128;
const MAX_CURRENT_CANDIDATES = 48;
const BOARD_FLASH_SUPPRESS_MS = 6 * 60 * 60 * 1000;
const BOARD_REPEAT_HARD_MS = 30 * 60 * 60 * 1000;
const BOARD_REPEAT_SOFT_MS = 72 * 60 * 60 * 1000;

async function getMany(storage, keys) {
  const out = new Map();
  const unique = [...new Set(keys)];
  for (let i = 0; i < unique.length; i += MAX_BATCH) {
    const batch = unique.slice(i, i + MAX_BATCH);
    if (!batch.length) continue;
    const result = await storage.get(batch);
    if (result instanceof Map) for (const [key, value] of result) out.set(key, value);
    else if (batch.length === 1 && result !== undefined) out.set(batch[0], result);
  }
  return out;
}

async function putMany(storage, entries) {
  const pairs = Object.entries(entries);
  for (let i = 0; i < pairs.length; i += MAX_BATCH) {
    const chunk = Object.fromEntries(pairs.slice(i, i + MAX_BATCH));
    if (Object.keys(chunk).length) await storage.put(chunk);
  }
}

async function deleteMany(storage, keys) {
  const unique = [...new Set(keys)];
  for (let i = 0; i < unique.length; i += MAX_BATCH) {
    const batch = unique.slice(i, i + MAX_BATCH);
    if (batch.length) await storage.delete(batch);
  }
}

function pruneMeta(meta, nowMs) {
  const flashMin = nowMs - RADAR_RULES.flashRollingQuotaMs - 60 * 60 * 1000;
  meta.published = (Array.isArray(meta.published) ? meta.published : [])
    .filter(item => Number(item?.at || 0) >= flashMin)
    .slice(-40);
  meta.unknownLocks = (Array.isArray(meta.unknownLocks) ? meta.unknownLocks : [])
    .filter(item => Number(item?.until || 0) > nowMs)
    .slice(-40);
  const boardMin = nowMs - 3 * 24 * 60 * 60 * 1000;
  meta.boardHistory = (Array.isArray(meta.boardHistory) ? meta.boardHistory : [])
    .filter(item => Number(item?.at || 0) >= boardMin)
    .slice(-12);
  if (meta.reservation && nowMs - Number(meta.reservation.createdAt || 0) >= RADAR_RULES.reservationTtlMs) {
    meta.lastExpiredReservation = { ...meta.reservation, expiredAt: nowMs };
    meta.reservation = null;
  }
}

async function getMeta(storage, nowMs = Date.now()) {
  let meta = await storage.get(META_KEY);
  if (!meta) {
    meta = defaultRadarMeta(nowMs);
    const legacy = await storage.get(LEGACY_META_KEY);
    if (legacy) {
      meta.mode = legacy.mode === 'live' ? 'live' : 'test';
      meta.testStartedAt = legacy.testStartedAt || legacy.firstScanAt || null;
      meta.liveApprovedAt = legacy.liveApprovedAt || null;
      meta.migratedFrom = legacy.version || 'radar-meta-v1';
    }
  }
  meta.version = RADAR_VERSION;
  pruneMeta(meta, nowMs);
  return meta;
}

function modeInfo(meta, nowMs) {
  const start = meta.testStartedAt ? Date.parse(meta.testStartedAt) : null;
  const elapsed = start ? Math.max(0, nowMs - start) : 0;
  return {
    mode: meta.mode === 'live' ? 'live' : 'test',
    testStartedAt: meta.testStartedAt || null,
    testElapsedMs: elapsed,
    canGoLive: Boolean(start && elapsed >= RADAR_RULES.testMinDurationMs),
    remainingTestMs: start ? Math.max(0, RADAR_RULES.testMinDurationMs - elapsed) : RADAR_RULES.testMinDurationMs
  };
}

async function setMode(storage, mode, nowMs) {
  const meta = await getMeta(storage, nowMs);
  if (mode === 'live') {
    const info = modeInfo(meta, nowMs);
    if (!info.canGoLive) return { ok: false, error: 'MIN_24H_TEST_REQUIRED', ...info };
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

function flashPublishedInWindow(meta, nowMs) {
  return (meta.published || []).filter(item => nowMs - Number(item.at || 0) <= RADAR_RULES.flashRollingQuotaMs);
}

function flashGlobalCooldown(meta, nowMs) {
  const latest = [...(meta.published || [])].sort((a, b) => Number(b.at || 0) - Number(a.at || 0))[0];
  return latest ? nowMs - Number(latest.at || 0) < RADAR_RULES.flashGlobalCooldownMs : false;
}

function routeIsSuppressed(meta, candidate, nowMs) {
  const pair = routeCooldownKey(candidate);
  if ((meta.published || []).some(item => item.routeCooldownKey === pair && nowMs - Number(item.at || 0) < RADAR_RULES.flashRouteCooldownMs)) return true;
  if ((meta.unknownLocks || []).some(item => (item.key === candidate.key || item.routeCooldownKey === pair) && Number(item.until || 0) > nowMs)) return true;
  if ((meta.boardHistory || []).some(board => board.status === 'published' && nowMs - Number(board.at || 0) < BOARD_FLASH_SUPPRESS_MS && (board.routeCooldownKeys || []).includes(pair))) return true;
  return false;
}

async function cleanupPastRoutes(storage, meta, currentJalali) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(currentJalali || ''))) return 0;
  if (meta.lastCleanupJalali === currentJalali) return 0;
  if (typeof storage.list !== 'function') {
    meta.lastCleanupJalali = currentJalali;
    return 0;
  }
  const listed = await storage.list({ prefix: ROUTE_PREFIX });
  const doomed = [];
  for (const [key, state] of listed instanceof Map ? listed : []) {
    if (String(state?.departureDate || '') < currentJalali) doomed.push(key);
  }
  if (doomed.length) await deleteMany(storage, doomed);
  meta.lastCleanupJalali = currentJalali;
  return doomed.length;
}

function candidateCompact(candidate) {
  if (!candidate) return null;
  return {
    key: candidate.key,
    market: 'domestic',
    origin: candidate.origin,
    destination: candidate.destination,
    departureDate: candidate.departureDate,
    leadDays: candidate.leadDays,
    priceFeedToman: candidate.priceFeedToman,
    routeMedianToman: candidate.routeMedianToman,
    routeMinToman: candidate.routeMinToman,
    activeDates: candidate.activeDates,
    routePriceRank: candidate.routePriceRank,
    routePriceRankRatio: candidate.routePriceRankRatio,
    priceRank: candidate.priceRank,
    priceRankRatio: candidate.priceRankRatio,
    calendarReferenceToman: candidate.calendarReferenceToman,
    calendarReferenceScope: candidate.calendarReferenceScope,
    calendarWindowDays: candidate.calendarWindowDays,
    calendarSampleCount: candidate.calendarSampleCount,
    calendarRankCount: candidate.calendarRankCount,
    calendarSavingToman: candidate.calendarSavingToman,
    calendarGapPct: candidate.calendarGapPct,
    recentMedianToman: candidate.recentMedianToman,
    recentDropPct: candidate.recentDropPct,
    historicalMedianToman: candidate.historicalMedianToman,
    historicalGapPct: candidate.historicalGapPct,
    referencePrice: candidate.referencePrice,
    savingToman: candidate.savingToman,
    confirmations: candidate.confirmations,
    observationCount: candidate.observationCount,
    historicalObservationCount: candidate.historicalObservationCount,
    opportunityScore: candidate.opportunityScore,
    scoreBreakdown: candidate.scoreBreakdown,
    signalType: candidate.signalType,
    sourceMinWeek: Boolean(candidate.sourceMinWeek),
    selectionPotential: candidate.selectionPotential
  };
}

async function ingest(storage, body) {
  const nowMs = Number(body.observedAtMs || Date.now());
  const scanId = String(body.scanId || '');
  const tehranClock = String(body.tehranClock || '');
  const currentJalali = String(body.currentJalali || '');
  const observations = Array.isArray(body.observations) ? body.observations : [];
  const sourceCounts = body.sourceCounts && typeof body.sourceCounts === 'object' ? body.sourceCounts : {};
  const suppressFlash = Boolean(body.suppressFlash);
  if (!scanId) return { ok: false, error: 'SCAN_ID_REQUIRED' };

  const meta = await getMeta(storage, nowMs);
  if (meta.lastScanId === scanId) return { ok: true, duplicate: true, action: 'DUPLICATE_SCAN', report: meta.lastScanReport || null, radarMode: meta.mode };
  if (!meta.firstScanAt) meta.firstScanAt = new Date(nowMs).toISOString();
  if (!meta.testStartedAt) meta.testStartedAt = new Date(nowMs).toISOString();

  const domesticRoutes = Number(sourceCounts.domesticRoutes || 0);
  const previousDomesticRoutes = Number(meta.previousDomesticRoutes || 0);
  const feedHealth = domesticFeedHealth({ counts: sourceCounts, observations });
  const anomaly = !feedHealth.ok
    ? feedHealth.code
    : detectCountCollapse(previousDomesticRoutes, domesticRoutes) ? 'DOMESTIC_COUNT_COLLAPSE' : null;
  if (!anomaly && domesticRoutes > 0) meta.previousDomesticRoutes = domesticRoutes;

  const keys = observations.map(record => routeKey(record));
  const stored = await getMany(storage, keys.map(radarRouteStorageKey));
  const writes = {};
  const candidates = [];
  let learning = 0, normal = 0, candidateCount = 0, rejectedCooldown = 0;

  if (!anomaly) {
    for (const record of observations) {
      const key = routeKey(record);
      const storageKey = radarRouteStorageKey(key);
      const previous = stored.get(storageKey) || defaultRouteState(record, nowMs);
      const result = applyObservation(previous, record, nowMs);
      writes[storageKey] = result.state;
      if (result.status === 'LEARNING') learning++;
      else if (result.status === 'CANDIDATE') candidateCount++;
      else normal++;
      if (result.candidate) {
        if (Number(result.state.rejectedUntil || 0) > nowMs) rejectedCooldown++;
        else candidates.push(result.candidate);
      }
    }
  }

  const ranked = rankCandidates(candidates).map(candidateCompact).filter(Boolean);
  meta.currentCandidates = ranked.slice(0, MAX_CURRENT_CANDIDATES);
  meta.lastCandidate = meta.currentCandidates[0] || meta.lastCandidate || null;

  let reservation = null;
  let topReason = anomaly ? 'MARKET_ANOMALY' : 'NO_QUALIFIED_OPPORTUNITY';
  const flashEligible = ranked.filter(isStrongFlashCandidate);
  if (!anomaly && !suppressFlash && flashEligible.length) {
    topReason = 'FLASH_CANDIDATE';
    const winner = flashEligible.find(candidate => !routeIsSuppressed(meta, candidate, nowMs));
    if (!isPublishWindow(tehranClock)) topReason = 'OUTSIDE_FLASH_WINDOW';
    else if (isScheduleConflict(tehranClock)) topReason = 'SCHEDULE_CONFLICT';
    else if (meta.reservation) topReason = 'SENDING_LOCK';
    else if (flashPublishedInWindow(meta, nowMs).length >= RADAR_RULES.flashRollingQuotaCount) topReason = 'FLASH_QUOTA_24H';
    else if (flashGlobalCooldown(meta, nowMs)) topReason = 'FLASH_GLOBAL_COOLDOWN';
    else if (!winner) topReason = 'FLASH_ROUTE_COOLDOWN';
    else {
      const token = radarReservationToken(scanId, winner);
      reservation = {
        token,
        candidate: winner,
        createdAt: nowMs,
        scanId,
        radarMode: meta.mode === 'live' ? 'live' : 'test'
      };
      meta.reservation = reservation;
      topReason = 'RESERVED_FOR_VERIFICATION';
    }
  } else if (!anomaly && candidates.length) {
    topReason = 'BOARD_CANDIDATES_READY';
  } else if (!anomaly && learning) {
    topReason = 'LEARNING';
  }

  const best = ranked[0] || null;
  meta.lastScanAt = new Date(nowMs).toISOString();
  meta.lastScanId = scanId;
  meta.updatedAt = new Date(nowMs).toISOString();
  meta.lastScanReport = {
    scanId,
    at: meta.lastScanAt,
    tehranClock,
    sourceCounts,
    observations: observations.length,
    learning,
    normal,
    candidates: candidateCount,
    rejectedCooldown,
    anomaly,
    feedHealth,
    flashEligible: flashEligible.length,
    reserved: Boolean(reservation),
    topReason,
    bestOpportunity: best ? {
      key: best.key,
      score: best.opportunityScore,
      priceToman: best.priceFeedToman,
      signalType: best.signalType,
      recentDropPct: best.recentDropPct,
      calendarGapPct: best.calendarGapPct,
      historicalGapPct: best.historicalGapPct
    } : null
  };

  const cleaned = await cleanupPastRoutes(storage, meta, currentJalali);
  if (cleaned) meta.lastScanReport.cleanedRoutes = cleaned;
  await putMany(storage, writes);
  await storage.put(META_KEY, meta);

  let warning = null;
  if (anomaly) {
    if (meta.lastWarningKey !== anomaly || nowMs - Number(meta.lastWarningAt || 0) > 60 * 60 * 1000) {
      warning = anomaly;
      meta.lastWarningKey = anomaly;
      meta.lastWarningAt = nowMs;
      await storage.put(META_KEY, meta);
    }
  }
  return { ok: true, duplicate: false, reservation, report: meta.lastScanReport, warning, radarMode: meta.mode };
}

async function ack(storage, body) {
  const nowMs = Number(body.atMs || Date.now());
  const meta = await getMeta(storage, nowMs);
  const token = String(body.token || '');
  if (!meta.reservation || meta.reservation.token !== token) return { ok: false, error: 'RESERVATION_NOT_FOUND' };
  const reservation = meta.reservation;
  const candidate = body.candidate || reservation.candidate;
  const status = String(body.status || 'send_unknown');
  const storageKey = radarRouteStorageKey(reservation.candidate.key);
  const routeState = await storage.get(storageKey);

  if (status === 'published') {
    const published = {
      key: candidate.key,
      routeCooldownKey: routeCooldownKey(candidate),
      priceToman: Number(candidate.exactPriceToman || candidate.priceFeedToman || 0),
      opportunityScore: Number(candidate.opportunityScore || 0),
      at: nowMs,
      channel: String(body.channel || ''),
      telegramMessageId: body.telegramMessageId || null,
      radarMode: reservation.radarMode,
      public: body.public === true
    };
    meta.published.push(published);
    meta.lastPublished = published;
    meta.lastVerifiedCandidate = candidate;
    if (routeState) {
      routeState.rejectedUntil = 0;
      routeState.updatedAt = new Date(nowMs).toISOString();
      await storage.put(storageKey, routeState);
    }
  } else if (status === 'verification_rejected') {
    meta.lastVerificationRejected = {
      key: reservation.candidate.key,
      at: nowMs,
      reason: String(body.reason || 'VERIFICATION_REJECTED'),
      detail: body.detail || null
    };
    if (routeState) {
      routeState.rejectedUntil = nowMs + RADAR_RULES.rejectionCooldownMs;
      routeState.updatedAt = new Date(nowMs).toISOString();
      await storage.put(storageKey, routeState);
    }
  } else if (status === 'send_unknown') {
    const lock = {
      key: reservation.candidate.key,
      routeCooldownKey: routeCooldownKey(reservation.candidate),
      at: nowMs,
      until: nowMs + RADAR_RULES.unknownDeliveryLockMs,
      channel: String(body.channel || ''),
      error: String(body.error || '')
    };
    meta.unknownLocks.push(lock);
    meta.lastSendUnknown = lock;
  } else {
    meta.lastSendFailed = {
      key: reservation.candidate.key,
      at: nowMs,
      channel: String(body.channel || ''),
      error: String(body.error || '')
    };
  }

  meta.reservation = null;
  meta.updatedAt = new Date(nowMs).toISOString();
  pruneMeta(meta, nowMs);
  await storage.put(META_KEY, meta);
  return { ok: true, status };
}

async function boardCandidates(storage, url, nowMs) {
  const meta = await getMeta(storage, nowMs);
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get('limit') || RADAR_RULES.boardCandidateLimit)));
  const recentPublicFlashRoutes = new Set((meta.published || [])
    .filter(item => item.public === true && nowMs - Number(item.at || 0) < BOARD_FLASH_SUPPRESS_MS)
    .map(item => item.routeCooldownKey)
    .filter(Boolean));
  const recentBoards = (meta.boardHistory || []).filter(board => board.status === 'published');
  const hardBoardRoutes = new Set(recentBoards
    .filter(board => nowMs - Number(board.at || 0) < BOARD_REPEAT_HARD_MS)
    .flatMap(board => board.routeCooldownKeys || [])
    .filter(Boolean));
  const softBoardRoutes = new Set(recentBoards
    .filter(board => nowMs - Number(board.at || 0) >= BOARD_REPEAT_HARD_MS && nowMs - Number(board.at || 0) < BOARD_REPEAT_SOFT_MS)
    .flatMap(board => board.routeCooldownKeys || [])
    .filter(Boolean));

  const candidates = rankCandidates(meta.currentCandidates || [])
    .filter(candidate => Number(candidate.opportunityScore || 0) >= RADAR_RULES.boardPreScoreThreshold)
    .filter(candidate => !recentPublicFlashRoutes.has(routeCooldownKey(candidate)))
    .filter(candidate => !hardBoardRoutes.has(routeCooldownKey(candidate)))
    .filter(candidate => !((meta.unknownLocks || []).some(lock => (lock.key === candidate.key || lock.routeCooldownKey === routeCooldownKey(candidate)) && Number(lock.until || 0) > nowMs)))
    .map(candidate => {
      const freshnessPenalty = softBoardRoutes.has(routeCooldownKey(candidate)) ? 7 : 0;
      return {
        ...candidate,
        boardFreshnessPenalty: freshnessPenalty,
        boardSelectionScore: Math.max(0, Number(candidate.opportunityScore || 0) - freshnessPenalty)
      };
    })
    .sort((a, b) =>
      Number(b.boardSelectionScore || 0) - Number(a.boardSelectionScore || 0) ||
      Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0) ||
      Number(b.calendarGapPct || 0) - Number(a.calendarGapPct || 0) ||
      Number(b.savingToman || 0) - Number(a.savingToman || 0)
    )
    .slice(0, limit);
  return {
    ok: true,
    version: RADAR_VERSION,
    candidates,
    sourceCounts: meta.lastScanReport?.sourceCounts || null,
    lastScanAt: meta.lastScanAt || null,
    boardTargetItems: RADAR_RULES.boardTargetItems,
    boardMaxItems: RADAR_RULES.boardMaxItems,
    hardSuppressedRoutes: hardBoardRoutes.size,
    softPenalizedRoutes: softBoardRoutes.size
  };
}

async function boardAck(storage, body) {
  const nowMs = Number(body.atMs || Date.now());
  const meta = await getMeta(storage, nowMs);
  const status = String(body.status || 'skipped');
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  const row = {
    at: nowMs,
    date: String(body.date || ''),
    status,
    channel: String(body.channel || ''),
    telegramMessageId: body.telegramMessageId || null,
    candidateKeys: candidates.map(candidate => candidate.key).filter(Boolean).slice(0, RADAR_RULES.boardMaxItems),
    routeCooldownKeys: [...new Set(candidates.map(routeCooldownKey))].slice(0, RADAR_RULES.boardMaxItems),
    verifiedCount: Number(body.verifiedCount || candidates.length || 0),
    reason: String(body.reason || '')
  };
  meta.boardHistory.push(row);
  meta.lastBoard = row;
  if (candidates.length) meta.lastVerifiedCandidate = candidates[0];
  meta.updatedAt = new Date(nowMs).toISOString();
  pruneMeta(meta, nowMs);
  await storage.put(META_KEY, meta);
  return { ok: true, status };
}

export async function radarDurableFetch(storage, request) {
  const url = new URL(request.url);
  const nowMs = Date.now();
  if (url.pathname === '/radar/ingest' && request.method === 'POST') return Response.json(await ingest(storage, await request.json()));
  if (url.pathname === '/radar/ack' && request.method === 'POST') return Response.json(await ack(storage, await request.json()));
  if (url.pathname === '/radar/board-candidates') return Response.json(await boardCandidates(storage, url, nowMs));
  if (url.pathname === '/radar/board-ack' && request.method === 'POST') return Response.json(await boardAck(storage, await request.json()));
  if (url.pathname === '/radar/mode/test' && request.method === 'POST') return Response.json(await setMode(storage, 'test', nowMs));
  if (url.pathname === '/radar/mode/live' && request.method === 'POST') {
    const result = await setMode(storage, 'live', nowMs);
    return Response.json(result, { status: result.ok ? 200 : 409 });
  }
  if (url.pathname === '/radar/failure' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const meta = await getMeta(storage, nowMs);
    const key = String(body.key || body.error || 'RADAR_FETCH_FAILURE').slice(0, 300);
    const notify = meta.lastFetchFailureKey !== key || nowMs - Number(meta.lastFetchFailureAt || 0) > 60 * 60 * 1000;
    meta.lastFetchFailureKey = key;
    meta.lastFetchFailureAt = nowMs;
    meta.lastFetchFailure = String(body.error || key).slice(0, 1000);
    meta.updatedAt = new Date(nowMs).toISOString();
    await storage.put(META_KEY, meta);
    return Response.json({ ok: true, notify });
  }
  if (url.pathname === '/radar/status') {
    const meta = await getMeta(storage, nowMs);
    return Response.json({ ok: true, version: RADAR_VERSION, ...modeInfo(meta, nowMs), meta });
  }
  if (url.pathname === '/radar/preview') {
    const meta = await getMeta(storage, nowMs);
    return Response.json({
      ok: true,
      candidate: meta.lastVerifiedCandidate || meta.lastCandidate || null,
      lastVerifiedCandidate: meta.lastVerifiedCandidate || null,
      lastPublished: meta.lastPublished || null,
      lastBoard: meta.lastBoard || null
    });
  }
  return Response.json({ ok: false, error: 'RADAR_ROUTE_NOT_FOUND' }, { status: 404 });
}
