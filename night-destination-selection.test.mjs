import assert from 'node:assert/strict';
import { rankNightDestinationCandidates, mergeRecentDestinationRecords } from './night-destination-core.mjs';

const catalog = [
  { id:'tehran', name:'تهران', country:'ایران', countryQuery:'Iran', scope:'IRAN', type:'CITY', cluster:'TEHRAN', tier:'A' },
  { id:'golestan', name:'کاخ گلستان', country:'ایران', countryQuery:'Iran', scope:'IRAN', type:'HERITAGE', cluster:'TEHRAN', tier:'A' },
  { id:'shiraz', name:'شیراز', country:'ایران', countryQuery:'Iran', scope:'IRAN', type:'CITY', cluster:'SHIRAZ', tier:'A' },
  { id:'rome', name:'رم', country:'ایتالیا', countryQuery:'Italy', scope:'WORLD', type:'CITY', cluster:'ROME', tier:'A' },
  { id:'como', name:'دریاچه کومو', country:'ایتالیا', countryQuery:'Italy', scope:'WORLD', type:'NATURE', cluster:'COMO', tier:'A' },
  { id:'banff', name:'پارک ملی بنف', country:'کانادا', countryQuery:'Canada', scope:'WORLD', type:'NATURE', cluster:'BANFF', tier:'A' }
];
const recent = [
  { catalogId:'tehran', cluster:'TEHRAN', country:'ایران', countryQuery:'Iran', scope:'IRAN', type:'CITY', date:'2026-08-15' },
  { catalogId:'rome', cluster:'ROME', country:'ایتالیا', countryQuery:'Italy', scope:'WORLD', type:'CITY', date:'2026-08-14' }
];
const ranked = rankNightDestinationCandidates(catalog, recent, { dateKey:'2026-08-16', limit:6 });
assert.ok(ranked.length > 0);
assert.ok(!ranked.slice(0, 2).some((x) => x.id === 'golestan'), 'same Tehran cluster must be cooled down in strict ranking');
assert.ok(!ranked.slice(0, 2).some((x) => x.id === 'como'), 'recent foreign country must be cooled down in strict ranking');
assert.ok(ranked.some((x) => x.id === 'banff'));
const merged = mergeRecentDestinationRecords([{ qid:'Q1', catalogId:'a' }], [{ qid:'Q2', catalogId:'b' }, { qid:'Q1', catalogId:'a' }], 365);
assert.deepEqual(merged.map((x) => x.qid), ['Q1','Q2']);
console.log('night destination editorial ranking tests: ok');
