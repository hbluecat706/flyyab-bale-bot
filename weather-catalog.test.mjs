import assert from 'node:assert/strict';
import { IRAN_WEATHER_DESTINATIONS, WEATHER_CATALOG_VERSION, weatherCatalogStats } from './weather-catalog.mjs';
const stats=weatherCatalogStats();
assert.match(WEATHER_CATALOG_VERSION,/iran-weather-destinations-v1/);
assert.equal(stats.total,420,`unexpected catalog size: ${stats.total}`);
assert.ok(stats.seeded>=20);
assert.equal(new Set(IRAN_WEATHER_DESTINATIONS.map(x=>x.id)).size,IRAN_WEATHER_DESTINATIONS.length);
for(const name of ['ماسوله','فیلبند','رامسر','کوهرنگ','سی‌سخت','جزیره هرمز','اورامانات','کلاردشت','جواهرده','چالوس','دیزین','سوباتان','ساحل درک','چلگرد','فشم','میگون','اشترانکوه','کوه دنا','دریاچه نئور','دریاچه تار','دریاچه هویر','افجه','شهرستانک','وردیج','واریش'])assert.ok(IRAN_WEATHER_DESTINATIONS.some(x=>x.name===name),`missing ${name}`);
console.log('weather catalog tests: ok',stats);

for(const name of ['چلگرد','فشم','میگون','اشترانکوه','کوه دنا','سرعین','سی‌سخت']) assert.equal(IRAN_WEATHER_DESTINATIONS.find(x=>x.name===name)?.profile,'MOUNTAIN',`profile must be MOUNTAIN for ${name}`);
