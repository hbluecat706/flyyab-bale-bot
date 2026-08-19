export const NIGHT_DESTINATION_VERSION = "night-destination-v5.0-verified-commons-arvan";

export const NIGHT_DESTINATION_RULES = Object.freeze({
  minEntityScore: 80,
  minImages: 1,
  targetImages: 6,
  maxImages: 8,
  strictMinWidth: 1000,
  strictMinHeight: 600,
  relaxedMinWidth: 800,
  relaxedMinHeight: 500,
  maxCandidateSearch: 7,
  maxCategoryFiles: 120,
  maxSubcategories: 8,
  maxSubcategoryFiles: 35,
  rankedCandidateLimit: 12,
  clusterCooldownNights: 24,
  foreignCountryCooldownNights: 8,
  diversityWindowNights: 14,
  editorialArticleChars: 16000
});

export function normalizeCatalogIndex(value, size, fallback = 0) {
  if (!Number.isInteger(size) || size <= 0) return 0;
  const parsed = Number(value);
  const safe = Number.isInteger(parsed) ? parsed : fallback;
  return ((safe % size) + size) % size;
}

export function rotateDestinationCatalog(catalog = [], startIndex = 0, limit = 24) {
  if (!Array.isArray(catalog) || !catalog.length) return [];
  const baseIndex = normalizeCatalogIndex(startIndex, catalog.length);
  const safeLimit = Math.min(Math.max(0, Number(limit) || 0), catalog.length);
  return Array.from({ length: safeLimit }, (_, offset) => {
    const catalogIndex = (baseIndex + offset) % catalog.length;
    return { ...catalog[catalogIndex], catalogIndex };
  });
}

function stableNightHash(value = "") {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function rankDestinationPass(catalog, recent, options, relaxLevel = 0) {
  const usedIds = new Set((options.usedCatalogIds || []).map(String));
  const usedQidSet = new Set((options.usedQids || []).map(String));
  const latest = recent.at(-1) || null;
  const last14 = recent.slice(-NIGHT_DESTINATION_RULES.diversityWindowNights);
  const iranCount = last14.filter((item) => item.scope === "IRAN" || item.countryQuery === "Iran" || item.country === "ایران").length;
  const clusterWindow = relaxLevel === 0 ? NIGHT_DESTINATION_RULES.clusterCooldownNights : relaxLevel === 1 ? 12 : 0;
  const countryWindow = relaxLevel === 0 ? NIGHT_DESTINATION_RULES.foreignCountryCooldownNights : relaxLevel === 1 ? 4 : 0;
  const recentClusters = new Set(clusterWindow ? recent.slice(-clusterWindow).map((item) => item.cluster || item.catalogCluster).filter(Boolean) : []);
  const recentForeignCountries = new Set(countryWindow ? recent.slice(-countryWindow).filter((item) => item.scope === "WORLD" || (item.countryQuery && item.countryQuery !== "Iran")).map((item) => item.countryQuery).filter(Boolean) : []);
  const recentTypes = recent.slice(-4).map((item) => item.type || item.catalogType).filter(Boolean);
  return catalog.map((item, catalogIndex) => {
    const catalogId = String(item.id || item.catalogId || `catalog-${catalogIndex}`);
    const hardReasons = [];
    if (usedIds.has(catalogId)) hardReasons.push("USED_IN_ROLLING_CYCLE");
    if (item.qid && usedQidSet.has(String(item.qid))) hardReasons.push("QID_ALREADY_USED");
    if (clusterWindow && item.cluster && recentClusters.has(item.cluster)) hardReasons.push("CLUSTER_COOLDOWN");
    if (countryWindow && item.scope === "WORLD" && item.countryQuery && recentForeignCountries.has(item.countryQuery)) hardReasons.push("COUNTRY_COOLDOWN");
    if (relaxLevel === 0 && latest?.type && item.type === latest.type && ["CITY","HERITAGE","NATURE","ISLAND","VILLAGE"].includes(item.type)) hardReasons.push("SAME_TYPE_AS_LAST_NIGHT");
    let score = item.tier === "A" ? 42 : item.tier === "B" ? 28 : 10;
    if (!recentTypes.includes(item.type)) score += 18; else if (recentTypes[0] !== item.type) score += 7;
    if (item.scope === "IRAN") score += iranCount < 6 ? 24 : iranCount <= 8 ? 8 : -18; else score += iranCount > 8 ? 24 : iranCount >= 6 ? 8 : -12;
    if (item.type !== "CITY") score += 8;
    if (item.cluster && !recent.slice(-45).some((record) => (record.cluster || record.catalogCluster) === item.cluster)) score += 10;
    if (item.scope === "WORLD" && item.countryQuery && !recent.slice(-24).some((record) => record.countryQuery === item.countryQuery)) score += 8;
    score += stableNightHash(`${options.dateKey || ""}|${catalogId}`) % 13;
    return { ...item, catalogIndex, selectionScore: score, hardReasons, selectionRelaxLevel: relaxLevel };
  }).filter((item) => !item.hardReasons.length).sort((a,b) => b.selectionScore - a.selectionScore || a.catalogIndex - b.catalogIndex);
}
export function rankNightDestinationCandidates(catalog = [], recentRecords = [], options = {}) {
  const active = (Array.isArray(catalog) ? catalog : []).filter((item) => item?.status !== "DISABLED");
  const recent = (Array.isArray(recentRecords) ? recentRecords : []).filter(Boolean);
  const limit = Math.max(1, Math.min(Number(options.limit) || NIGHT_DESTINATION_RULES.rankedCandidateLimit, active.length || 1));
  for (const relaxLevel of [0,1,2]) {
    const ranked = rankDestinationPass(active, recent, options, relaxLevel);
    if (ranked.length) return ranked.slice(0, limit);
  }
  return [];
}
export function mergeRecentDestinationRecords(history = [], records = [], limit = 365) {
  const unique = new Map();
  for (const item of [...(Array.isArray(history) ? history : []), ...(Array.isArray(records) ? records : [])]) {
    const key = item?.qid || item?.catalogId || item?.destinationKey || item?.configuredKey;
    if (key) unique.set(String(key), item);
  }
  return [...unique.values()].slice(-Math.max(1, Number(limit) || 365));
}

const ZWNJ = "\u200c";
const FA_DIACRITICS = /[\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const IMAGE_EXT = /\.(?:jpe?g|png|webp)$/i;
const NON_TRAVEL_VISUAL = /(?:\bmap\b|locator|location map|\bflag\b|coat of arms|\blogo\b|\bicon\b|diagram|schematic|satellite|airport|airfield|runway|signboard|\bsign\b|\bprotest\b|demonstration|\briot\b|\bwar\b|\battack\b|funeral|cemetery|hospital|\btraffic\b|\bqueue\b|police|military|accident|\bfire\b|damage|portrait|selfie|engraving|illustration|drawing|painting|postcard|archive photo|historical photo|\bchart\b|\bgraph\b|\bplot\b|infographic|data visuali[sz]ation|climate chart|temperature change|timeline|spreadsheet|\btable\b|نقشه|پرچم|نشان(?:\s|$)|لوگو|نمودار|ماهواره|فرودگاه|باند فرود|تابلو|اعتراض|تظاهرات|جنگ|حمله|تشییع|قبرستان|بیمارستان|ترافیک|صف|پلیس|نظامی|حادثه|آتش(?:\s|$)|پرتره|سلفی|نقاشی|طراحی|کارت پستال|تصویر تاریخی|اینفوگرافیک|جدول|نمودار دما|تغییرات دما|داده نما)/i;
const REPRESENTATIONAL_VISUAL = /(?:\bview(?:s)?\b|panorama|panoramic|cityscape|skyline|streets?|squares?|bridges?|monuments?|landmarks?|architecture|buildings?|historic(?:al)? (?:center|centre)|old town|downtown|waterfront|harbor|harbour|coast(?:al)?|beaches?|bay|gul[fv]|lakes?|rivers?|waterfalls?|mountains?|forest|desert|islands?|park|garden|museum|palace|castle|fort(?:ress)?|citadel|cathedral|church|mosque|temple|tower|bazaar|market|avenue|boulevard|aerial|night view|sunset view|sunrise view|پل|میدان|خیابان|معماری|ساختمان|بنا|منظره|چشم[‌ ]?انداز|نمای شهر|بافت تاریخی|ساحل|خلیج|رود|آبشار|کوه|جنگل|دریاچه|بازار|موزه|پارک|باغ|قلعه|کاخ|برج|کلیسا|مسجد|معبد)/i;
const INCIDENTAL_BROAD_VISUAL = /(?:clouds?|sky|sun(?:set|rise|light)?|halo|weather|temperature|climate|flower|flowers|flora|plant|plants|tree|trees|leaf|leaves|agave|cactus|botanical|macro|close[ -]?up|texture|pattern|abstract|poster|banner|brochure|temperature change|heat map|graph|chart|plot|infographic|\bstat(?:istic)?s?\b|word cloud|ابر|آسمان|خورشید|آب[ -]?و[ -]?هوا|دما|اقلیم|گل|گیاه|درخت|برگ|بافت|نمای نزدیک|پوستر|بنر|بروشور|آمار|چارت|نمودار)/i;
const SAFE_LICENSE = /(?:CC0|CC BY(?:-SA)?|CC-BY(?:-SA)?|PUBLIC DOMAIN|PD-|GFDL)/i;
const NON_FREE_LICENSE = /(?:\bCC[ -]BY[ -](?:NC|ND)\b|\bNC\b|\bND\b|NONCOMMERCIAL|NO DERIVATIVES)/i;

export function normalizeDestinationText(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(FA_DIACRITICS, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(new RegExp(ZWNJ, "g"), "")
    .replace(/[ـ_–—-]/g, " ")
    .replace(/[()（）\[\]{}،,:؛;.!?؟'\"«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokens(value) {
  return normalizeDestinationText(value).split(/\s+/).filter(Boolean);
}

export function textSimilarity(a, b) {
  const left = normalizeDestinationText(a);
  const right = normalizeDestinationText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }
  const aa = new Set(tokens(left));
  const bb = new Set(tokens(right));
  const intersection = [...aa].filter((item) => bb.has(item)).length;
  const union = new Set([...aa, ...bb]).size || 1;
  return intersection / union;
}

export function titleVariants(destination) {
  const name = String(destination?.name || "").trim();
  const variants = new Set([name]);
  if (name.includes(ZWNJ)) variants.add(name.replaceAll(ZWNJ, ""));
  if (!name.includes(ZWNJ)) {
    variants.add(name.replace(/نایبند/g, `نای${ZWNJ}بند`));
    variants.add(name.replace(/میانکاله/g, `میان${ZWNJ}کاله`));
  }
  return [...variants].filter(Boolean);
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function claimEntityIds(entity, property) {
  return (entity?.claims?.[property] || [])
    .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

function currentClaimEntityIds(entity, property) {
  const claims = (entity?.claims?.[property] || []).filter((claim) => {
    if (!claim || claim.rank === "deprecated") return false;
    // Historical administrative/country relationships commonly carry an end
    // time. They must not be rendered as the destination's current location.
    if (claim?.qualifiers?.P582?.length) return false;
    return Boolean(claim?.mainsnak?.datavalue?.value?.id);
  });
  const preferred = claims.filter((claim) => claim.rank === "preferred");
  const chosen = preferred.length ? preferred : claims;
  return [...new Set(chosen.map((claim) => claim?.mainsnak?.datavalue?.value?.id).filter(Boolean))];
}

function claimStrings(entity, property) {
  return (entity?.claims?.[property] || [])
    .map((claim) => claim?.mainsnak?.datavalue?.value)
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());
}

function entityCoordinates(entity) {
  const value = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (!value || !Number.isFinite(Number(value.latitude)) || !Number.isFinite(Number(value.longitude))) return null;
  return { lat: Number(value.latitude), lon: Number(value.longitude) };
}

function preferredLabel(entity, lang) {
  return String(entity?.labels?.[lang]?.value || "").trim();
}

function preferredDescription(entity, lang) {
  return String(entity?.descriptions?.[lang]?.value || "").trim();
}

function aliases(entity, lang) {
  return (entity?.aliases?.[lang] || []).map((item) => String(item?.value || "").trim()).filter(Boolean);
}

async function jsonFetch(url, { fetchImpl = fetch, userAgent = "FlyYab-Night-Destination/2.0 https://flyyab.ir/", cacheTtl = 86400 } = {}) {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": userAgent, "Api-User-Agent": userAgent, Accept: "application/json" },
    cf: { cacheTtl, cacheEverything: true }
  });
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 0} for ${url}`);
  return response.json();
}

function wikiApiUrl(lang, params) {
  const search = new URLSearchParams({ ...params, format: "json", origin: "*" });
  return `https://${lang}.wikipedia.org/w/api.php?${search}`;
}

function commonsApiUrl(params) {
  const search = new URLSearchParams({ ...params, format: "json", origin: "*" });
  return `https://commons.wikimedia.org/w/api.php?${search}`;
}

function wikidataApiUrl(params) {
  const search = new URLSearchParams({ ...params, format: "json", origin: "*" });
  return `https://www.wikidata.org/w/api.php?${search}`;
}

async function fetchWikidataEntity(qid, options) {
  const data = await jsonFetch(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`, options);
  return data?.entities?.[qid] || null;
}

async function fetchEntityLabels(ids, options) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const data = await jsonFetch(wikidataApiUrl({
    action: "wbgetentities",
    ids: unique.join("|"),
    props: "labels|descriptions",
    languages: "fa|en",
    languagefallback: "1"
  }), options);
  return data?.entities || {};
}

function pageCandidatesFromQuery(data) {
  return Object.values(data?.query?.pages || {}).filter((page) => page && !Object.hasOwn(page, "missing"));
}

function configuredWikipediaTitles(destination, lang) {
  if (lang === "fa") return titleVariants(destination);
  const query = String(destination?.query || "").trim();
  const country = String(destination?.countryQuery || "").trim();
  const withoutCountry = country ? query.replace(new RegExp(`\\s+${country.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*$`, "i"), "").trim() : query;
  return [...new Set([withoutCountry, query].filter(Boolean))];
}

async function exactWikipediaPage(lang, title, options) {
  if (!title) return null;
  const data = await jsonFetch(wikiApiUrl(lang, {
    action: "query",
    titles: title,
    redirects: "1",
    prop: "info|pageprops|extracts",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    exsectionformat: "plain"
  }), options).catch(() => null);
  return pageCandidatesFromQuery(data).find((page) => page?.pageprops?.disambiguation === undefined) || null;
}

async function wikipediaCandidates(destination, lang, options) {
  const variants = configuredWikipediaTitles(destination, lang);
  const exact = await jsonFetch(wikiApiUrl(lang, {
    action: "query",
    titles: variants.join("|"),
    redirects: "1",
    prop: "info|pageprops|extracts",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    exsectionformat: "plain"
  }), options).catch(() => null);
  const exactPages = pageCandidatesFromQuery(exact).map((page) => ({ ...page, _wikiLang: lang }));
  if (exactPages.some((page) => !page?.pageprops?.disambiguation)) return exactPages;

  const searchText = lang === "fa" ? String(destination?.name || "") : String(destination?.query || destination?.name || "");
  const search = await jsonFetch(wikiApiUrl(lang, {
    action: "query",
    generator: "search",
    gsrsearch: searchText,
    gsrlimit: String(NIGHT_DESTINATION_RULES.maxCandidateSearch),
    prop: "info|pageprops|extracts",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    exsectionformat: "plain"
  }), options).catch(() => null);
  return pageCandidatesFromQuery(search).map((page) => ({ ...page, _wikiLang: lang }));
}

function countryMatches(destination, countryEntities, pageExtract, entity) {
  const expected = [destination?.country, destination?.countryQuery].map(normalizeDestinationText).filter(Boolean);
  const candidates = [];
  for (const item of Object.values(countryEntities || {})) {
    candidates.push(preferredLabel(item, "fa"), preferredLabel(item, "en"), preferredDescription(item, "fa"), preferredDescription(item, "en"));
  }
  const normalizedCandidates = candidates.map(normalizeDestinationText).filter(Boolean);
  const claimMatch = expected.some((wanted) => normalizedCandidates.some((found) => wanted === found || wanted.includes(found) || found.includes(wanted)));
  if (claimMatch) return true;
  const haystack = normalizeDestinationText(`${pageExtract || ""} ${preferredDescription(entity, "fa")} ${preferredDescription(entity, "en")}`);
  return expected.some((wanted) => wanted.length > 2 && haystack.includes(wanted));
}

function entityNameMatch(destination, page, entity) {
  const configured = [destination?.name, destination?.query].filter(Boolean);
  const entityNames = [
    page?.title,
    preferredLabel(entity, "fa"),
    preferredLabel(entity, "en"),
    ...aliases(entity, "fa"),
    ...aliases(entity, "en")
  ].filter(Boolean);
  let best = 0;
  for (const left of configured) for (const right of entityNames) best = Math.max(best, textSimilarity(left, right));
  return best;
}

function canonicalCommonsCategory(entity) {
  const p373 = claimStrings(entity, "P373")[0];
  if (p373) return p373.replace(/^Category:/i, "").trim();
  const sitelink = String(entity?.sitelinks?.commonswiki?.title || "").trim();
  if (/^Category:/i.test(sitelink)) return sitelink.replace(/^Category:/i, "").trim();
  return "";
}

function canonicalWikipediaUrl(page, entity) {
  const faTitle = String(entity?.sitelinks?.fawiki?.title || "").trim();
  if (faTitle) return `https://fa.wikipedia.org/wiki/${encodeURIComponent(faTitle.replace(/ /g, "_"))}`;
  return page?.fullurl || "";
}

async function buildDestinationEntityRecord(destination, qid, entity, sourcePage, resolvedVia, options = {}) {
  const countryIds = currentClaimEntityIds(entity, "P17");
  const regionIds = currentClaimEntityIds(entity, "P131");
  const typeIds = claimEntityIds(entity, "P31");
  const relatedIds = [...countryIds, ...regionIds, ...typeIds];
  const labels = await fetchEntityLabels(relatedIds, options).catch(() => ({}));
  const countryEntities = Object.fromEntries(countryIds.map((id) => [id, labels[id]]).filter(([, value]) => value));
  const countryOk = countryMatches(destination, countryEntities, sourcePage.extract, entity);
  const nameMatch = entityNameMatch(destination, sourcePage, entity);
  const englishTitle = String(entity?.sitelinks?.enwiki?.title || preferredLabel(entity, "en") || "").trim();
  const titleMatch = Math.max(
    ...configuredWikipediaTitles(destination, "fa").map((variant) => textSimilarity(variant, sourcePage.title)),
    ...configuredWikipediaTitles(destination, "en").map((variant) => textSimilarity(variant, englishTitle)),
    0
  );
  const commonsCategory = canonicalCommonsCategory(entity);
  let score = 0;
  score += Math.round(titleMatch * 45);
  score += Math.round(nameMatch * 20);
  if (countryOk) score += 25;
  if (commonsCategory) score += 5;
  if (String(sourcePage.extract || "").trim().length >= 80) score += 5;
  const regionEntities = regionIds.map((id) => labels[id]).filter(Boolean);
  const typeEntities = typeIds.map((id) => labels[id]).filter(Boolean);
  const countryLabels = Object.values(countryEntities).flatMap((item) => [preferredLabel(item, "fa"), preferredLabel(item, "en")]).filter(Boolean);
  const regionLabels = regionEntities.flatMap((item) => [preferredLabel(item, "fa"), preferredLabel(item, "en")]).filter(Boolean);
  const typeLabels = typeEntities.flatMap((item) => [preferredLabel(item, "fa"), preferredLabel(item, "en")]).filter(Boolean);
  return {
    score, countryOk, nameMatch, titleMatch, qid,
    title: sourcePage.title,
    enWikipediaTitle: englishTitle,
    wikiLang: "fa", resolvedVia, configured: { ...destination },
    wikipediaUrl: canonicalWikipediaUrl(sourcePage, entity),
    extract: String(sourcePage.extract || "").replace(/\s+/g, " ").trim(),
    labelFa: preferredLabel(entity, "fa") || sourcePage.title || destination.name,
    labelEn: preferredLabel(entity, "en") || destination.query,
    descriptionFa: preferredDescription(entity, "fa"),
    descriptionEn: preferredDescription(entity, "en"),
    aliasesFa: aliases(entity, "fa"), aliasesEn: aliases(entity, "en"),
    countryLabels, regionLabels, typeLabels, commonsCategory,
    p18: claimStrings(entity, "P18")[0] || "", coordinates: entityCoordinates(entity),
    status: score >= NIGHT_DESTINATION_RULES.minEntityScore && countryOk && commonsCategory ? "VERIFIED" : "REJECTED_LOW_CONFIDENCE"
  };
}
async function resolveLockedQid(destination, qid, options = {}) {
  if (!/^Q\d+$/i.test(String(qid || ""))) return null;
  const entity = await fetchWikidataEntity(String(qid), options);
  if (!entity || entity?.missing !== undefined) return null;
  const faTitle = String(entity?.sitelinks?.fawiki?.title || "").trim();
  if (!faTitle) return null;
  const canonicalFaPage = await exactWikipediaPage("fa", faTitle, options);
  if (!canonicalFaPage || !String(canonicalFaPage.extract || "").trim()) return null;
  const record = await buildDestinationEntityRecord(destination, String(qid), entity, { ...canonicalFaPage, _wikiLang: "fa" }, "catalog-lock", options);
  return record.status === "VERIFIED" ? record : null;
}
export async function resolveDestinationEntity(destination, options = {}) {
  const reviewed = [];
  const lockedQid = String(options?.lockedQid || "").trim();
  if (lockedQid) {
    try {
      const locked = await resolveLockedQid(destination, lockedQid, options);
      if (locked) return { ...locked, reviewed: [{ ...locked, status: "VERIFIED_CATALOG_LOCK" }] };
      reviewed.push({ qid: lockedQid, status: "REJECTED_STALE_CATALOG_LOCK", score: 0 });
    } catch (error) {
      reviewed.push({ qid: lockedQid, status: "REJECTED_CATALOG_LOCK_FETCH", error: error.message, score: 0 });
    }
  }
  const seenQids = new Set();
  for (const lang of ["fa", "en"]) {
    const pages = await wikipediaCandidates(destination, lang, options);
    for (const page of pages) {
      if (page?.pageprops?.disambiguation !== undefined) { reviewed.push({ title: page.title, wikiLang: lang, status: "REJECTED_DISAMBIGUATION", score: 0 }); continue; }
      const qid = page?.pageprops?.wikibase_item;
      if (!qid) { reviewed.push({ title: page.title, wikiLang: lang, status: "REJECTED_NO_WIKIDATA", score: 0 }); continue; }
      if (seenQids.has(qid)) continue; seenQids.add(qid);
      let entity;
      try { entity = await fetchWikidataEntity(qid, options); }
      catch (error) { reviewed.push({ title: page.title, qid, wikiLang: lang, status: "REJECTED_WIKIDATA_FETCH", error: error.message, score: 0 }); continue; }
      if (!entity || entity?.missing !== undefined) continue;
      const faTitle = String(entity?.sitelinks?.fawiki?.title || "").trim();
      if (!faTitle) { reviewed.push({ title: page.title, qid, wikiLang: lang, status: "REJECTED_NO_FA_WIKIPEDIA", score: 0 }); continue; }
      const canonicalFaPage = lang === "fa" && normalizeDestinationText(page.title) === normalizeDestinationText(faTitle) ? page : await exactWikipediaPage("fa", faTitle, options);
      if (!canonicalFaPage || !String(canonicalFaPage.extract || "").trim()) { reviewed.push({ title: page.title, qid, wikiLang: lang, status: "REJECTED_FA_WIKIPEDIA_FETCH", score: 0 }); continue; }
      const record = await buildDestinationEntityRecord(destination, qid, entity, { ...canonicalFaPage, _wikiLang: "fa" }, lang, options);
      reviewed.push(record);
    }
    const verifiedThisStage = reviewed.filter((item) => item.status === "VERIFIED").sort((a,b) => b.score - a.score)[0];
    if (verifiedThisStage) return { ...verifiedThisStage, reviewed };
  }
  const error = new Error(`هویت مقصد «${destination?.name || "—"}» با اطمینان کافی تأیید نشد`);
  error.code = "DESTINATION_ENTITY_UNVERIFIED"; error.reviewed = reviewed; throw error;
}
async function fetchWikipediaArticleText(lang, title, options = {}) {
  if (!title) return "";
  const data = await jsonFetch(wikiApiUrl(lang, { action: "parse", page: title, prop: "text", redirects: "1", disabletoc: "1" }), options).catch(() => null);
  const html = data?.parse?.text?.["*"] || "";
  return stripHtml(html)
    .replace(/\[[۰-۹0-9]+\]/g, " ")
    .replace(/\b(?:ویرایش|Edit)\b/gi, " ")
    .replace(/\s+/g, " ").trim().slice(0, NIGHT_DESTINATION_RULES.editorialArticleChars);
}
export async function hydrateDestinationEditorialEvidence(entity, options = {}) {
  const faTitle = String(entity?.title || "").trim();
  const enTitle = String(entity?.enWikipediaTitle || entity?.labelEn || "").trim();
  const editorialExtractFa = await fetchWikipediaArticleText("fa", faTitle, options);
  let editorialExtractEn = "";
  if (editorialExtractFa.length < 2800 && enTitle) editorialExtractEn = await fetchWikipediaArticleText("en", enTitle, options);
  return {
    ...entity,
    editorialExtractFa: editorialExtractFa || String(entity?.extract || ""),
    editorialExtractEn
  };
}

async function categoryMembers(category, { subcategories = false, limit = 100, ...options } = {}) {
  const data = await jsonFetch(commonsApiUrl({
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:${category}`,
    cmnamespace: subcategories ? "14" : "6",
    cmtype: subcategories ? "subcat" : "file",
    cmlimit: String(limit)
  }), options);
  return (data?.query?.categorymembers || []).map((item) => String(item?.title || "")).filter(Boolean);
}

const PREFERRED_SUBCATEGORY = /(?:views?|panorama|photographs?|cityscape|landscape|nature|geography|buildings?|architecture|landmarks?|tourism|parks?|gardens?|streets?|squares?|bridges?|monuments?|waterfront|beaches?|coasts?|mountains?|lakes?|rivers?|waterfalls?|interior|exterior|night|aerial|چشم[‌ ]?انداز|عکس|تصاویر|طبیعت|جغرافیا|ساختمان|معماری|دیدنی|گردشگری|پارک|باغ|خیابان|میدان|پل|بنا|ساحل|کوه|دریاچه|رود|آبشار)/i;
const REJECT_SUBCATEGORY = /(?:people|persons?|politics|government|economy|education|health|cemeter|funeral|protest|demonstration|events?|statistics|audio|videos?|art(?:ists?)?|military|police|افراد|مردم|سیاست|دولت|اقتصاد|آموزش|سلامت|قبرستان|تشییع|اعتراض|رویداد|آمار|صوت|ویدئو|نظامی|پلیس)/i;
const BROAD_PLACE_TYPE = /(?:\bcity\b|metropolis|megacity|capital|municipality|administrative territorial|province|state|region|county|district|prefecture|governorate|شهر(?:\s|$)|کلان ?شهر|پایتخت|استان|ایالت|منطقه اداری|شهرستان|ناحیه)/i;

function isBroadPlaceEntity(entity) {
  return BROAD_PLACE_TYPE.test((entity?.typeLabels || []).join(" | "));
}

function rankedEntitySubcategories(titles = []) {
  return titles
    .map((title) => ({ title, name: String(title).replace(/^Category:/i, "") }))
    .filter(({ name }) => !REJECT_SUBCATEGORY.test(name) && PREFERRED_SUBCATEGORY.test(name))
    .map((item) => ({ ...item, score: (/(?:views?|panorama|cityscape|landscape|چشم[‌ ]?انداز)/i.test(item.name) ? 30 : 0) + (/(?:nature|geography|coasts?|waterfront|mountains?|lakes?|rivers?|waterfalls?|طبیعت|جغرافیا|ساحل|کوه|دریاچه|رود|آبشار)/i.test(item.name) ? 20 : 0) + (/(?:buildings?|architecture|landmarks?|parks?|gardens?|streets?|squares?|bridges?|monuments?|ساختمان|معماری|دیدنی|پارک|باغ|خیابان|میدان|پل|بنا)/i.test(item.name) ? 10 : 0) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((item) => item.title);
}

function imageMetadataText(image) {
  return `${image?.fileName || ""} ${image?.description || ""} ${image?.categories || ""}`;
}

function imageSubjectTags(text = "") {
  const tags = new Set();
  if (/(?:panorama|panoramic|skyline|cityscape|view|چشم[‌ ]?انداز|نمای شهر)/i.test(text)) tags.add("view");
  if (/(?:architecture|building|buildings|historic|old town|downtown|bridge|monument|landmark|palace|castle|fort(?:ress)?|citadel|tower|museum|cathedral|church|mosque|temple|معماری|ساختمان|بافت تاریخی|پل|بنا|کاخ|قلعه|برج|موزه|کلیسا|مسجد|معبد)/i.test(text)) tags.add("architecture");
  if (/(?:streets?|squares?|avenue|boulevard|market|bazaar|plaza|خیابان|میدان|بازار)/i.test(text)) tags.add("street");
  if (/(?:waterfront|harbor|harbour|coast(?:al)?|beaches?|bay|gul[fv]|lakes?|rivers?|waterfalls?|ساحل|خلیج|رود|دریاچه|آبشار)/i.test(text)) tags.add("water");
  if (/(?:park|garden|mountains?|forest|desert|islands?|nature|landscape|جنگل|پارک|باغ|کوه|جزیره|طبیعت|منظره)/i.test(text)) tags.add("nature");
  if (/(?:aerial|night view|nightscape|هوایی|شب)/i.test(text)) tags.add("special");
  return [...tags];
}

function editorialImageScore(image, entity) {
  const text = imageMetadataText(image);
  const broadPlace = isBroadPlaceEntity(entity);
  const tags = imageSubjectTags(text);
  let bonus = 0;
  if (image.relation === "wikidata-p18") bonus += 12;
  else if (image.relation === "entity-subcategory") bonus += 10;
  else if (broadPlace && image.relation === "exact-category") bonus -= 12;
  if (tags.includes("view")) bonus += 18;
  if (tags.includes("architecture")) bonus += 14;
  if (tags.includes("street")) bonus += 10;
  if (tags.includes("water")) bonus += 10;
  if (tags.includes("nature")) bonus += 8;
  if (tags.includes("special")) bonus += 4;
  if (image.semanticMatch) bonus += 6;
  if (broadPlace && INCIDENTAL_BROAD_VISUAL.test(text) && !tags.length && !image.semanticMatch) bonus -= 35;
  return { tags, bonus };
}

function commonsPageUrl(title) {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, "_"))}`;
}

async function fileInfo(titles, options) {
  if (!titles.length) return [];
  const out = [];
  for (let i = 0; i < titles.length; i += 35) {
    const batch = titles.slice(i, i + 35);
    const data = await jsonFetch(commonsApiUrl({
      action: "query",
      titles: batch.join("|"),
      prop: "imageinfo|categories",
      iiprop: "url|size|mime|mediatype|extmetadata",
      iiurlwidth: "1600",
      cllimit: "50"
    }), options);
    for (const page of Object.values(data?.query?.pages || {})) {
      const info = page?.imageinfo?.[0];
      if (!info) continue;
      out.push({ title: page.title, pageid: page.pageid, categories: (page.categories || []).map((item) => String(item?.title || "")).filter(Boolean), ...info });
    }
  }
  return out;
}

function metaValue(info, key) {
  return stripHtml(info?.extmetadata?.[key]?.value || "");
}

function imageGps(info) {
  const latRaw = metaValue(info, "GPSLatitude");
  const lonRaw = metaValue(info, "GPSLongitude");
  if (!latRaw || !lonRaw) return null;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const rad = (deg) => deg * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalizeCommonsImage(info, relation, entity) {
  const title = String(info?.title || "");
  const mime = String(info?.mime || "");
  const mediaType = String(info?.mediatype || "");
  const license = metaValue(info, "LicenseShortName") || metaValue(info, "UsageTerms");
  const licenseUrl = metaValue(info, "LicenseUrl");
  const author = metaValue(info, "Artist") || metaValue(info, "Credit");
  const description = metaValue(info, "ImageDescription") || metaValue(info, "ObjectName");
  const categories = [metaValue(info, "Categories"), ...(info?.categories || [])].filter(Boolean).join(" | ");
  const width = Number(info?.width || 0);
  const height = Number(info?.height || 0);
  const gps = imageGps(info);
  const distanceKm = gps && entity?.coordinates ? haversineKm(entity.coordinates, gps) : null;
  const relationScore = relation === "wikidata-p18" ? 100 : relation === "entity-subcategory" ? 96 : 90;
  let score = relationScore;
  if (width >= 1600 && height >= 900) score += 8;
  else if (width >= 1000 && height >= 650) score += 4;
  const ratio = height ? width / height : 0;
  if (ratio >= 1.15 && ratio <= 2.2) score += 4;
  const semantic = `${title} ${description}`;
  const semanticMatch = [entity?.labelFa, entity?.labelEn, ...(entity?.aliasesFa || []), ...(entity?.aliasesEn || [])]
    .filter(Boolean)
    .some((name) => textSimilarity(name, semantic) >= 0.5 || normalizeDestinationText(semantic).includes(normalizeDestinationText(name)));
  if (semanticMatch) score += 5;
  if (distanceKm !== null) {
    if (distanceKm <= 25) score += 8;
    else if (distanceKm <= 75) score += 3;
    else if (distanceKm > 200) score -= 25;
  }
  const fileName = title.replace(/^File:/i, "");
  const metaText = `${fileName} ${description} ${categories}`;
  const editorial = editorialImageScore({ relation, fileName, description, categories, semanticMatch }, entity);
  score += editorial.bonus;
  return {
    id: title,
    fileName,
    title,
    url: info?.thumburl || info?.url,
    originalUrl: info?.url,
    commonsPageUrl: commonsPageUrl(title),
    width,
    height,
    mime,
    mediaType,
    author,
    license,
    licenseUrl,
    description,
    categories,
    relation,
    score,
    semanticMatch,
    gps,
    distanceKm,
    metadataText: metaText,
    subjectTags: editorial.tags,
    representationalCue: REPRESENTATIONAL_VISUAL.test(metaText),
    incidentalBroadCue: INCIDENTAL_BROAD_VISUAL.test(metaText)
  };
}

function imagePassesBase(image, entity) {
  if (!image?.url || !IMAGE_EXT.test(image.fileName || "")) return false;
  if (image.mediaType && !/BITMAP/i.test(image.mediaType)) return false;
  if (image.mime && !/^image\/(?:jpeg|png|webp)$/i.test(image.mime)) return false;
  if (!image.author || !image.license || !SAFE_LICENSE.test(image.license) || NON_FREE_LICENSE.test(image.license)) return false;
  if (NON_TRAVEL_VISUAL.test(image.metadataText || `${image.fileName} ${image.description} ${image.categories || ""}`)) return false;
  if (image.distanceKm !== null && image.distanceKm > 200) return false;
  const broadPlace = isBroadPlaceEntity(entity);
  // Large cities/regions need representative travel imagery, not just any file
  // that happens to be geotagged inside the entity boundary.
  if (broadPlace) {
    const gpsClose = image.distanceKm !== null && image.distanceKm <= 25;
    const representative = image.representationalCue || (image.subjectTags || []).length > 0;
    if (image.incidentalBroadCue && !representative && !image.semanticMatch) return false;
    if (image.relation === "exact-category" && !image.semanticMatch && !gpsClose && !representative) return false;
  }
  return true;
}

function imageQualityPass(image, relaxed = false) {
  const minW = relaxed ? NIGHT_DESTINATION_RULES.relaxedMinWidth : NIGHT_DESTINATION_RULES.strictMinWidth;
  const minH = relaxed ? NIGHT_DESTINATION_RULES.relaxedMinHeight : NIGHT_DESTINATION_RULES.strictMinHeight;
  return image.width >= minW && image.height >= minH;
}

function imageSeriesKey(image) {
  return normalizeDestinationText(String(image?.fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[()\[\]_-]*\d+[a-z]?[()\[\]_-]*/gi, " ")
    .replace(/\b(?:img|dsc|photo|image)\s*\d*\b/gi, " "))
    .split(" ").slice(0, 7).join(" ");
}

function diversifyImages(images, maxImages, minImages = NIGHT_DESTINATION_RULES.minImages) {
  const selected = [];
  const seriesCount = new Map();
  const authorCount = new Map();
  for (const image of images) {
    if (selected.length >= maxImages) break;
    const series = imageSeriesKey(image) || image.id;
    const author = normalizeDestinationText(image.author || "unknown");
    // Strong first pass: no duplicate visual series and no more than two images
    // from the same credited creator. This avoids albums made of near-identical
    // numbered sequences while keeping enough room for small exact categories.
    if ((seriesCount.get(series) || 0) >= 1) continue;
    if ((authorCount.get(author) || 0) >= 2) continue;
    selected.push(image);
    seriesCount.set(series, (seriesCount.get(series) || 0) + 1);
    authorCount.set(author, (authorCount.get(author) || 0) + 1);
  }
  // Second pass is fail-soft only for otherwise verified media: it may add a
  // second file from a series, but never more than two, to reach the minimum.
  for (const image of images) {
    if (selected.length >= maxImages) break;
    if (selected.some((item) => item.id === image.id)) continue;
    const series = imageSeriesKey(image) || image.id;
    const author = normalizeDestinationText(image.author || "unknown");
    if ((seriesCount.get(series) || 0) >= 2) continue;
    if ((authorCount.get(author) || 0) >= 3) continue;
    selected.push(image);
    seriesCount.set(series, (seriesCount.get(series) || 0) + 1);
    authorCount.set(author, (authorCount.get(author) || 0) + 1);
  }
  // Final fail-soft pass only to satisfy the publish minimum. Every asset has
  // already passed entity/category, license, quality and visual-safety gates.
  // This prevents a small but valid Commons category from being rejected only
  // because its filenames belong to one numbered series.
  if (selected.length < minImages) {
    for (const image of images) {
      if (selected.length >= minImages || selected.length >= maxImages) break;
      if (selected.some((item) => item.id === image.id)) continue;
      const author = normalizeDestinationText(image.author || "unknown");
      if ((authorCount.get(author) || 0) >= 3) continue;
      selected.push(image);
      authorCount.set(author, (authorCount.get(author) || 0) + 1);
    }
  }
  return selected;
}

export async function fetchVerifiedCommonsImages(entity, { usedImageIds = [], ...options } = {}) {
  if (!entity?.commonsCategory && !entity?.p18) {
    const error = new Error("برای مقصد نه رده دقیق Wikimedia Commons و نه تصویر شاخص Wikidata وجود دارد");
    error.code = "NO_COMMONS_IDENTITY_SOURCE";
    throw error;
  }
  const used = new Set((usedImageIds || []).map(String));
  const relation = new Map();
  if (entity.p18) relation.set(`File:${entity.p18}`.replace(/^File:File:/i, "File:"), "wikidata-p18");

  const direct = entity.commonsCategory ? await categoryMembers(entity.commonsCategory, { limit: NIGHT_DESTINATION_RULES.maxCategoryFiles, ...options }) : [];
  direct.forEach((title) => relation.set(title, relation.get(title) || "exact-category"));

  // Stage 1: inspect the exact entity category. Specific landmarks/natural
  // features can publish from this alone when it already yields a strong set.
  const firstTitles = [...relation.keys()].slice(0, NIGHT_DESTINATION_RULES.maxCategoryFiles);
  const firstInfos = await fileInfo(firstTitles, options);
  const firstAccepted = firstInfos
    .map((info) => normalizeCommonsImage(info, relation.get(info.title) || "exact-category", entity))
    .filter((image) => imagePassesBase(image, entity))
    .filter((image) => !used.has(image.id));

  // Broad city/region categories are always expanded into curated visual
  // subcategories (Views/Panoramas/Architecture/Nature/Photographs...). For
  // specific places, expansion is only needed when the exact category cannot
  // supply the target number of usable images.
  const broadPlace = isBroadPlaceEntity(entity);
  const firstQualityCount = firstAccepted.filter((image) => imageQualityPass(image, true)).length;
  let subcategories = [];
  let subInfos = [];
  if (entity.commonsCategory && (broadPlace || firstQualityCount < NIGHT_DESTINATION_RULES.targetImages)) {
    const rawSubs = await categoryMembers(entity.commonsCategory, { subcategories: true, limit: 200, ...options }).catch(() => []);
    subcategories = rankedEntitySubcategories(rawSubs).slice(0, NIGHT_DESTINATION_RULES.maxSubcategories);
    const subTitles = [];
    for (const title of subcategories) {
      const category = title.replace(/^Category:/i, "");
      const files = await categoryMembers(category, { limit: NIGHT_DESTINATION_RULES.maxSubcategoryFiles, ...options }).catch(() => []);
      for (const file of files) {
        if (!relation.has(file)) {
          relation.set(file, "entity-subcategory");
          subTitles.push(file);
        }
      }
      if (relation.size >= NIGHT_DESTINATION_RULES.maxCategoryFiles) break;
    }
    const remaining = Math.max(0, NIGHT_DESTINATION_RULES.maxCategoryFiles - firstTitles.length);
    subInfos = await fileInfo(subTitles.slice(0, remaining), options);
  }

  const infoByTitle = new Map();
  [...firstInfos, ...subInfos].forEach((info) => infoByTitle.set(info.title, info));
  const infos = [...infoByTitle.values()];
  const all = infos
    .map((info) => normalizeCommonsImage(info, relation.get(info.title) || "exact-category", entity))
    .filter((image) => imagePassesBase(image, entity))
    .filter((image) => !used.has(image.id));

  const strict = all.filter((image) => imageQualityPass(image, false)).sort((a, b) => b.score - a.score || b.width * b.height - a.width * a.height);
  const relaxed = all.filter((image) => !strict.includes(image) && imageQualityPass(image, true)).sort((a, b) => b.score - a.score || b.width * b.height - a.width * a.height);
  const broadPreferred = isBroadPlaceEntity(entity);
  const orderedPool = broadPreferred
    ? [
        ...strict.filter((image) => image.relation !== "exact-category" || image.representationalCue || image.semanticMatch),
        ...strict.filter((image) => image.relation === "exact-category" && !image.representationalCue && !image.semanticMatch),
        ...relaxed.filter((image) => image.relation !== "exact-category" || image.representationalCue || image.semanticMatch),
        ...relaxed.filter((image) => image.relation === "exact-category" && !image.representationalCue && !image.semanticMatch)
      ]
    : [...strict, ...relaxed];
  const selected = diversifyImages(orderedPool, NIGHT_DESTINATION_RULES.maxImages, NIGHT_DESTINATION_RULES.minImages);
  if (selected.length < NIGHT_DESTINATION_RULES.minImages) {
    const error = new Error(`برای «${entity.labelFa || entity.title}» فقط ${selected.length} تصویر معتبر و قابل انتشار پیدا شد`);
    error.code = "INSUFFICIENT_VERIFIED_IMAGES";
    error.details = {
      category: entity.commonsCategory,
      directFiles: direct.length,
      preferredSubcategories: subcategories.map((title) => title.replace(/^Category:/i, "")),
      accepted: selected.length,
      inspected: infos.length,
      broadPlace
    };
    throw error;
  }
  return {
    images: selected.slice(0, NIGHT_DESTINATION_RULES.targetImages),
    diagnostics: {
      category: entity.commonsCategory,
      directFiles: direct.length,
      preferredSubcategories: subcategories.map((title) => title.replace(/^Category:/i, "")),
      inspected: infos.length,
      accepted: selected.length,
      strictAccepted: strict.length,
      relaxedAccepted: relaxed.length,
      broadPlace,
      sourceUrl: entity.commonsCategory ? `https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(entity.commonsCategory.replace(/ /g, "_"))}` : (entity.p18 ? commonsPageUrl(`File:${entity.p18}`) : "")
    }
  };
}

function sentences(text = "") {
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.match(/[^.!؟]+[.!؟]/g)?.map((item) => item.trim()).filter(Boolean) || (clean ? [clean] : []);
}

function truncate(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max + 1).replace(/\s+\S*$/, "").trim() || text.slice(0, max).trim()}…`;
}

function fallbackEditorialSentenceScore(sentence = "", index = 0) {
  const text = String(sentence || "");
  let score = Math.max(0, 12 - index);
  if (/(?:کاخ|موزه|بازار|باغ|پارک|برج|قلعه|ارگ|مسجد|کلیسا|معبد|پل|میدان|خیابان|معماری|بافت تاریخی|میراث|تاریخ|فرهنگ|هنر|کوه|رشته[‌ ]?کوه|دریا|ساحل|خلیج|رود|آبشار|دریاچه|جنگل|بیابان|جزیره|چشم[‌ ]?انداز|طبیعت|دره|غار|آتشکده|محوطه باستانی)/i.test(text)) score += 18;
  if (/\d|[۰-۹]|[٠-٩]/.test(text)) score += 4;
  if (/(?:جمعیت|سرشماری|تقسیمات کشوری|بخش مرکزی|دهستان|کد پستی|پیش[‌ ]?شماره|شهرداری|شورای شهر)/i.test(text)) score -= 12;
  if (text.length < 35) score -= 8;
  if (text.length > 260) score -= 4;
  return score;
}

export function fallbackDestinationEditorial(entity) {
  const sourceSentences = sentences(entity?.extract || "");
  const name = entity.labelFa || entity.title;
  const country = entity.countryLabels?.find((item) => /[\u0600-\u06ff]/.test(item)) || entity.configured?.country || "";
  const region = entity.regionLabels?.find((item) => /[\u0600-\u06ff]/.test(item)) || "";
  const type = entity.typeLabels?.find((item) => /[\u0600-\u06ff]/.test(item)) || "";
  const defaultSentence = `${name}${country ? ` در ${country}` : ""} قرار دارد.`;

  const summarySentences = sourceSentences.slice(0, 2);
  const summary = truncate(summarySentences.join(" ") || defaultSentence, 270);
  const used = new Set(summarySentences);

  const ranked = sourceSentences
    .map((sentence, index) => ({ sentence, index, score: fallbackEditorialSentenceScore(sentence, index) }))
    .filter((item) => !used.has(item.sentence) && item.sentence.length >= 30)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const deterministicWhy = `${name}${region ? ` در ${region}` : country ? ` در ${country}` : ""}${type ? `، ${type} است` : " قرار دارد"}.`;
  const whySource = ranked[0]?.sentence || sourceSentences[2] || sourceSentences[1] || deterministicWhy;
  const why = truncate(whySource, 175);
  used.add(whySource);

  const factRanked = sourceSentences
    .map((sentence, index) => ({ sentence, index, score: fallbackEditorialSentenceScore(sentence, index) + (/(?:نام|ساخته|بنا|تأسیس|ثبت|نخست|اولین|کهن|قدیمی|نماد|مشهور|شناخته)/i.test(sentence) ? 7 : 0) }))
    .filter((item) => !used.has(item.sentence) && item.sentence.length >= 35)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const factCandidate = factRanked[0]?.sentence || sourceSentences.find((sentence) => !used.has(sentence) && sentence.length >= 35) || whySource || defaultSentence;
  const fact = truncate(factCandidate, 120);
  return { summary, why, fact, source: "deterministic-wikipedia-ranked-v2" };
}

export function destinationPackageKey(entity) {
  return String(entity?.qid || `${entity?.configured?.name || entity?.title}|${entity?.configured?.country || ""}`);
}

export function packageLocationLabel(entity) {
  const faCountry = entity?.countryLabels?.find((item) => /[\u0600-\u06ff]/.test(item)) || entity?.configured?.country;
  // For cities/metropolises the city name is already the headline. Showing an
  // administrative chain can be noisy or historically ambiguous, so the public
  // location line intentionally uses only the current country.
  if (isBroadPlaceEntity(entity)) return faCountry || entity?.configured?.country || "";
  const faRegion = entity?.regionLabels?.find((item) => /[\u0600-\u06ff]/.test(item));
  if (faRegion && faCountry && normalizeDestinationText(faRegion) !== normalizeDestinationText(faCountry)) return `${faRegion}، ${faCountry}`;
  return faCountry || entity?.configured?.country || "";
}
