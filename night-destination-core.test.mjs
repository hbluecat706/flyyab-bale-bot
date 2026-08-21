import assert from 'node:assert/strict';
import {
  NIGHT_DESTINATION_VERSION,
  normalizeDestinationText,
  resolveDestinationEntity,
  fetchVerifiedCommonsImages,
  fallbackDestinationEditorial,
  packageLocationLabel
} from './night-destination-core.mjs';

function response(json, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return structuredClone(json); } };
}

const page = {
  pageid: 1,
  ns: 0,
  title: 'خلیج نای‌بند',
  fullurl: 'https://fa.wikipedia.org/wiki/خلیج_نای‌بند',
  pageprops: { wikibase_item: 'Q96764426' },
  extract: 'خلیج نای‌بند خلیجی کوچک در حاشیه شمالی خلیج فارس و در نزدیکی عسلویه در استان بوشهر ایران است. پارک ملی نای‌بند در کرانه شمالی این خلیج قرار دارد. این منطقه دارای چشم‌انداز ساحلی است.'
};
const entity = {
  id: 'Q96764426',
  labels: { fa: { value: 'خلیج نای‌بند' }, en: { value: 'Nayband Bay' } },
  descriptions: { fa: { value: 'خلیجی در شهرستان عسلویه ایران' }, en: { value: 'bay in Asaluyeh County, Iran' } },
  aliases: { en: [{ value: 'Nay Band Bay' }, { value: 'Khalij-e Nayband' }] },
  claims: {
    P17: [{ mainsnak: { datavalue: { value: { id: 'Q794' } } } }],
    P131: [
      { rank: 'normal', mainsnak: { datavalue: { value: { id: 'Q132142' } } } },
      { rank: 'normal', mainsnak: { datavalue: { value: { id: 'Q999HIST' } } }, qualifiers: { P582: [{ datavalue: { value: { time: '+1900-01-01T00:00:00Z' } } }] } }
    ],
    P31: [{ mainsnak: { datavalue: { value: { id: 'Q39594' } } } }],
    P373: [{ mainsnak: { datavalue: { value: 'Nayband Bay' } } }],
    P18: [{ mainsnak: { datavalue: { value: 'ساحل هاله 02.jpg' } } }],
    P625: [{ mainsnak: { datavalue: { value: { latitude: 27.4319, longitude: 52.6225 } } } }]
  },
  sitelinks: { fawiki: { title: 'خلیج نای‌بند' }, commonswiki: { title: 'Category:Nayband Bay' } }
};
const labels = {
  Q794: { id: 'Q794', labels: { fa: { value: 'ایران' }, en: { value: 'Iran' } }, descriptions: {} },
  Q132142: { id: 'Q132142', labels: { fa: { value: 'شهرستان عسلویه' }, en: { value: 'Asaluyeh County' } }, descriptions: {} },
  Q39594: { id: 'Q39594', labels: { fa: { value: 'خلیج' }, en: { value: 'bay' } }, descriptions: {} },
  Q999HIST: { id: 'Q999HIST', labels: { fa: { value: 'قلمرو تاریخی آزمایشی' }, en: { value: 'Historical test realm' } }, descriptions: {} }
};

const files = [
  ['File:ساحل هاله 02.jpg', 2592, 1944, 'Ali A', 'CC BY-SA 4.0'],
  ['File:Nayband Gulf.jpg', 1080, 1080, 'Sara B', 'CC BY 4.0'],
  ['File:Persian Gulf coast.jpg', 4320, 3240, 'Reza C', 'CC BY-SA 3.0'],
  ['File:Nayband coast 1.jpg', 2200, 1400, 'Darya D', 'CC BY-SA 4.0'],
  ['File:Nayband coast 2.jpg', 1800, 1200, 'Omid E', 'CC BY 4.0'],
  ['File:Persian Gulf Airport in Asalouyeh.jpg', 1200, 808, 'Airport F', 'CC BY-SA 4.0'],
  ['File:Nayband locator map.png', 1400, 900, 'Map G', 'CC BY-SA 4.0']
];

function imageInfo(title, width, height, author, license) {
  return {
    pageid: Math.floor(Math.random() * 100000),
    title,
    imageinfo: [{
      url: `https://upload.wikimedia.org/${encodeURIComponent(title)}`,
      thumburl: `https://upload.wikimedia.org/thumb/${encodeURIComponent(title)}`,
      width, height, mime: title.endsWith('.png') ? 'image/png' : 'image/jpeg', mediatype: 'BITMAP',
      extmetadata: {
        Artist: { value: author },
        LicenseShortName: { value: license },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
        ImageDescription: { value: title.replace(/^File:/, '') }
      }
    }]
  };
}

function goodFetch(url) {
  const u = new URL(url);
  if (u.hostname === 'fa.wikipedia.org') {
    if (u.searchParams.get('action') === 'query') return Promise.resolve(response({ query: { pages: { 1: page } } }));
  }
  if (u.hostname === 'www.wikidata.org' && u.pathname.includes('Special:EntityData')) {
    return Promise.resolve(response({ entities: { Q96764426: entity } }));
  }
  if (u.hostname === 'www.wikidata.org' && u.searchParams.get('action') === 'wbgetentities') {
    return Promise.resolve(response({ entities: labels }));
  }
  if (u.hostname === 'commons.wikimedia.org' && u.searchParams.get('list') === 'categorymembers') {
    const ns = u.searchParams.get('cmnamespace');
    if (ns === '14') return Promise.resolve(response({ query: { categorymembers: [] } }));
    return Promise.resolve(response({ query: { categorymembers: files.map(([title], i) => ({ pageid: i + 1, ns: 6, title })) } }));
  }
  if (u.hostname === 'commons.wikimedia.org' && String(u.searchParams.get('prop') || '').includes('imageinfo')) {
    const requested = String(u.searchParams.get('titles') || '').split('|');
    const pages = {};
    requested.forEach((title, i) => {
      const f = files.find(([name]) => name === title);
      if (f) pages[i + 1] = imageInfo(...f);
    });
    return Promise.resolve(response({ query: { pages } }));
  }
  throw new Error(`unexpected URL ${url}`);
}

assert.equal(NIGHT_DESTINATION_VERSION, 'night-destination-v5.0-verified-commons-arvan');
assert.equal(normalizeDestinationText('خلیج نایبند'), normalizeDestinationText('خلیج نای‌بند'));

const destination = { name: 'خلیج نایبند', query: 'Nayband Bay Iran', country: 'ایران', countryQuery: 'Iran' };
const resolved = await resolveDestinationEntity(destination, { fetchImpl: goodFetch });
assert.equal(resolved.qid, 'Q96764426');
assert.equal(resolved.commonsCategory, 'Nayband Bay');
assert.equal(resolved.countryOk, true);
assert.ok(resolved.score >= 80);
assert.equal(resolved.status, 'VERIFIED');
assert.ok(!resolved.regionLabels.includes('قلمرو تاریخی آزمایشی'), 'ended P131 relationship must not appear as current location');

const result = await fetchVerifiedCommonsImages(resolved, { fetchImpl: goodFetch });
assert.equal(result.images.length, 5, 'must keep five verified travel photos');
assert.ok(result.images.every((img) => !/airport|map/i.test(img.fileName)), 'must reject contextual airport/map assets');
assert.ok(result.images.every((img) => img.author && img.license && img.commonsPageUrl));

const fallback = fallbackDestinationEditorial(resolved);
assert.ok(fallback.summary.includes('خلیج نای‌بند'));
assert.ok(fallback.why.length >= 20);
assert.ok(fallback.fact.length >= 20);
assert.match(packageLocationLabel(resolved), /شهرستان عسلویه.*ایران/);

const wrongCountry = { ...destination, country: 'ترکیه', countryQuery: 'Turkey' };
await assert.rejects(() => resolveDestinationEntity(wrongCountry, { fetchImpl: goodFetch }), /اطمینان کافی/);

const shortFiles = files.slice(0, 3);
function insufficientFetch(url) {
  const u = new URL(url);
  if (u.hostname === 'commons.wikimedia.org' && u.searchParams.get('list') === 'categorymembers' && u.searchParams.get('cmnamespace') === '6') {
    return Promise.resolve(response({ query: { categorymembers: shortFiles.map(([title], i) => ({ pageid: i + 1, ns: 6, title })) } }));
  }
  if (u.hostname === 'commons.wikimedia.org' && u.searchParams.get('list') === 'categorymembers' && u.searchParams.get('cmnamespace') === '14') {
    return Promise.resolve(response({ query: { categorymembers: [] } }));
  }
  if (u.hostname === 'commons.wikimedia.org' && String(u.searchParams.get('prop') || '').includes('imageinfo')) {
    const pages = Object.fromEntries(shortFiles.map((f, i) => [i + 1, imageInfo(...f)]));
    return Promise.resolve(response({ query: { pages } }));
  }
  return goodFetch(url);
}
const shortResult = await fetchVerifiedCommonsImages(resolved, { fetchImpl: insufficientFetch });
assert.equal(shortResult.images.length, 3, 'album-lite may publish with 2+ verified images');


// Non-commercial / no-derivatives licenses must never pass even if their names begin with CC BY.
const nonFreeFiles = [
  ['File:Nayband free 1.jpg', 1800, 1200, 'A', 'CC BY-SA 4.0'],
  ['File:Nayband free 2.jpg', 1800, 1200, 'B', 'CC BY 4.0'],
  ['File:Nayband free 3.jpg', 1800, 1200, 'C', 'CC0'],
  ['File:Nayband free 4.jpg', 1800, 1200, 'D', 'Public domain'],
  ['File:Nayband free 5.jpg', 1800, 1200, 'E', 'GFDL'],
  ['File:Nayband nonfree.jpg', 1800, 1200, 'F', 'CC BY-NC 4.0']
];
function nonFreeFetch(url) {
  const u = new URL(url);
  if (u.hostname === 'commons.wikimedia.org' && u.searchParams.get('list') === 'categorymembers' && u.searchParams.get('cmnamespace') === '6') {
    return Promise.resolve(response({ query: { categorymembers: nonFreeFiles.map(([title], i) => ({ pageid: i + 1, ns: 6, title })) } }));
  }
  if (u.hostname === 'commons.wikimedia.org' && u.searchParams.get('list') === 'categorymembers' && u.searchParams.get('cmnamespace') === '14') {
    return Promise.resolve(response({ query: { categorymembers: [] } }));
  }
  if (u.hostname === 'commons.wikimedia.org' && String(u.searchParams.get('prop') || '').includes('imageinfo')) {
    const requested = String(u.searchParams.get('titles') || '').split('|');
    const pages = {};
    requested.forEach((title, i) => {
      const f = nonFreeFiles.find(([name]) => name === title);
      if (f) pages[i + 1] = imageInfo(...f);
    });
    return Promise.resolve(response({ query: { pages } }));
  }
  return goodFetch(url);
}
const freeOnly = await fetchVerifiedCommonsImages({ ...resolved, p18: '' }, { fetchImpl: nonFreeFetch });
assert.ok(freeOnly.images.length >= 2);
assert.ok(freeOnly.images.every((img) => !/nonfree/i.test(img.fileName)));


// Snapshot of the live Nayband Commons category observed during QA: five files
// total, one of which is explicitly an airport image. The verifier must fail
// closed instead of padding the album with unrelated imagery.
const liveNaybandSnapshot = [
  ['File:Nayband Gulf.jpg', 1080, 1080, 'Rezakar85', 'CC BY-SA 4.0'],
  ['File:Persian Gulf Airport in Asalouyeh.jpg', 1200, 808, 'Mohammadreza Farhadi Aref', 'CC BY-SA 4.0'],
  ['File:Persian Gulf coast - panoramio.jpg', 4320, 3240, 'Photographer C', 'CC BY-SA 4.0'],
  ['File:ساحل عسلویه.jpg', 620, 413, 'Photographer D', 'CC BY-SA 4.0'],
  ['File:ساحل هاله 02.jpg', 2592, 1944, 'Photographer E', 'CC BY-SA 4.0']
];
function liveNaybandSnapshotFetch(url) {
  const u = new URL(url);
  if (u.hostname === 'commons.wikimedia.org' && u.searchParams.get('list') === 'categorymembers' && u.searchParams.get('cmnamespace') === '6') {
    return Promise.resolve(response({ query: { categorymembers: liveNaybandSnapshot.map(([title], i) => ({ pageid: i + 1, ns: 6, title })) } }));
  }
  if (u.hostname === 'commons.wikimedia.org' && u.searchParams.get('list') === 'categorymembers' && u.searchParams.get('cmnamespace') === '14') {
    return Promise.resolve(response({ query: { categorymembers: [] } }));
  }
  if (u.hostname === 'commons.wikimedia.org' && String(u.searchParams.get('prop') || '').includes('imageinfo')) {
    const requested = String(u.searchParams.get('titles') || '').split('|');
    const pages = {};
    requested.forEach((title, i) => {
      const f = liveNaybandSnapshot.find(([name]) => name === title);
      if (f) pages[i + 1] = imageInfo(...f);
    });
    return Promise.resolve(response({ query: { pages } }));
  }
  return goodFetch(url);
}
const liveSnapshotResult = await fetchVerifiedCommonsImages(resolved, { fetchImpl: liveNaybandSnapshotFetch });
assert.ok(liveSnapshotResult.images.length >= 2, 'album-lite keeps a trustworthy small album instead of failing at five');
assert.ok(liveSnapshotResult.images.every((img) => !/airport|map/i.test(img.fileName)));

// If Persian search cannot identify the item but English does, the resolver may
// use English only to discover the QID. It must then fetch and publish the
// Persian sitelink from that same entity.
function englishDiscoveryFetch(url) {
  const u = new URL(url);
  if (u.hostname === 'fa.wikipedia.org') {
    const titles = u.searchParams.get('titles');
    if (titles === 'خلیج نای‌بند') return Promise.resolve(response({ query: { pages: { 1: page } } }));
    return Promise.resolve(response({ query: { pages: { '-1': { ns: 0, title: 'missing', missing: '' } } } }));
  }
  if (u.hostname === 'en.wikipedia.org') {
    return Promise.resolve(response({ query: { pages: { 2: { ...page, title: 'Nayband Bay', fullurl: 'https://en.wikipedia.org/wiki/Nayband_Bay', _wikiLang: 'en' } } } }));
  }
  return goodFetch(url);
}
const resolvedViaEnglish = await resolveDestinationEntity(destination, { fetchImpl: englishDiscoveryFetch });
assert.equal(resolvedViaEnglish.qid, 'Q96764426');
assert.equal(resolvedViaEnglish.wikiLang, 'fa');
assert.match(resolvedViaEnglish.wikipediaUrl, /fa\.wikipedia\.org/);
assert.equal(resolvedViaEnglish.title, 'خلیج نای‌بند');


// Broad-city root categories often contain incidental media. The verifier must
// reject generic root files without place metadata and prefer curated visual
// subcategories that are explicitly children of the verified entity category.
const cityEntity = {
  ...resolved,
  qid: 'Q1489',
  title: 'مکزیکوسیتی',
  labelFa: 'مکزیکوسیتی',
  labelEn: 'Mexico City',
  aliasesFa: [],
  aliasesEn: ['Mexico City'],
  countryLabels: ['مکزیک', 'Mexico'],
  configured: { name: 'مکزیکوسیتی', query: 'Mexico City Mexico', country: 'مکزیک', countryQuery: 'Mexico' },
  typeLabels: ['شهر', 'city', 'metropolis'],
  commonsCategory: 'Mexico City',
  p18: '',
  coordinates: { lat: 19.4326, lon: -99.1332 }
};
const cityRootFiles = Array.from({ length: 8 }, (_, i) => [`File:Generic root ${i + 1}.jpg`, 1800, 1200, `Root ${i + 1}`, 'CC BY-SA 4.0']);
const cityViewFiles = Array.from({ length: 6 }, (_, i) => [`File:Mexico City panorama ${i + 1}.jpg`, 2400, 1400, `View ${i + 1}`, 'CC BY-SA 4.0']);
function broadCityFetch(url) {
  const u = new URL(url);
  if (u.hostname === 'commons.wikimedia.org' && u.searchParams.get('list') === 'categorymembers') {
    const ns = u.searchParams.get('cmnamespace');
    const category = String(u.searchParams.get('cmtitle') || '');
    if (ns === '14' && category === 'Category:Mexico City') {
      return Promise.resolve(response({ query: { categorymembers: [{ pageid: 91, ns: 14, title: 'Category:Views of Mexico City' }, { pageid: 92, ns: 14, title: 'Category:People in Mexico City' }] } }));
    }
    if (ns === '6' && category === 'Category:Mexico City') {
      return Promise.resolve(response({ query: { categorymembers: cityRootFiles.map(([title], i) => ({ pageid: i + 1, ns: 6, title })) } }));
    }
    if (ns === '6' && category === 'Category:Views of Mexico City') {
      return Promise.resolve(response({ query: { categorymembers: cityViewFiles.map(([title], i) => ({ pageid: 100 + i, ns: 6, title })) } }));
    }
    return Promise.resolve(response({ query: { categorymembers: [] } }));
  }
  if (u.hostname === 'commons.wikimedia.org' && String(u.searchParams.get('prop') || '').includes('imageinfo')) {
    const requested = String(u.searchParams.get('titles') || '').split('|');
    const allFiles = [...cityRootFiles, ...cityViewFiles];
    const pages = {};
    requested.forEach((title, i) => {
      const f = allFiles.find(([name]) => name === title);
      if (f) pages[i + 1] = imageInfo(...f);
    });
    return Promise.resolve(response({ query: { pages } }));
  }
  throw new Error(`unexpected broad-city URL ${url}`);
}
const broadCityImages = await fetchVerifiedCommonsImages(cityEntity, { fetchImpl: broadCityFetch });
assert.ok(broadCityImages.images.length >= 2);
assert.ok(broadCityImages.diagnostics.broadPlace);
assert.ok(broadCityImages.diagnostics.preferredSubcategories.includes('Views of Mexico City'));
assert.ok(broadCityImages.images.every((img) => /Mexico City panorama/i.test(img.fileName)), 'broad city must prefer verified visual subcategory over generic root files');
assert.equal(packageLocationLabel(cityEntity), 'مکزیک', 'broad city headline must show only current country, not administrative/history chain');

console.log('night destination core verified-entity/image tests: ok');
