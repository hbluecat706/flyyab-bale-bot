import assert from 'node:assert/strict';
import { NIGHT_DESTINATIONS, nightDestinationCatalogStats } from './night-destination-catalog.mjs';

const stats = nightDestinationCatalogStats();
assert.equal(NIGHT_DESTINATIONS.length, 365);
assert.equal(stats.total, 365);
assert.equal(stats.byScope.IRAN, 176);
assert.equal(stats.byScope.WORLD, 189);
assert.equal(new Set(NIGHT_DESTINATIONS.map((x) => x.id)).size, 365);
assert.equal(new Set(NIGHT_DESTINATIONS.map((x) => x.configuredKey)).size, 365);
assert.ok(NIGHT_DESTINATIONS.every((x) => x.name && x.query && x.country && x.countryQuery && x.type && x.cluster && x.tier));

const names = new Set(NIGHT_DESTINATIONS.map((x) => x.name));
for (const required of ['دهلی نو','بندر انزلی','اسکودار','کویر مرنجاب','ساحل درک','دریاچه کومو','کانکون','ماچو پیچو','گرند کنیون','پارک ملی یلواستون','پارک ملی بنف','آنگکور وات','کویینزتاون','دیواره بزرگ مرجانی','جزیره شیدور (مارو)','بیستون','شهر سوخته']) assert.ok(names.has(required), `missing ${required}`);
for (const bad of ['استانبول آسیایی','مقصد کویری مرنجاب','مکزیکو کانکون','اوکلند جزیره جنوبی']) assert.ok(!names.has(bad), `obsolete name remains: ${bad}`);
assert.ok(stats.byType.CITY < 300, 'catalog must include substantial non-city variety');
assert.ok((stats.byTier.A || 0) > 180, 'catalog must keep a strong A-tier editorial core');
console.log('night destination editorial catalog tests: ok');
