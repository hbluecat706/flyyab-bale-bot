import assert from 'node:assert/strict';
import { WEATHER_VERSION, WEATHER_RULES, assessWeather, selectWeatherPicks, weatherReason } from './weather-core.mjs';
assert.equal(WEATHER_VERSION,'weather-v2.5-full-420-independent');
assert.equal(WEATHER_RULES.minHourlyPoints,4);
assert.equal(WEATHER_RULES.fullScanBatchSize,6);
assert.equal(WEATHER_RULES.dailySampleSize,420);
assert.equal(WEATHER_RULES.targetForecasts,420);
assert.equal(WEATHER_RULES.minCoveragePct,78);
assert.equal(WEATHER_RULES.eligiblePoolLimit,96);
assert.equal(WEATHER_RULES.finalistPoolSize,18);
assert.equal(WEATHER_RULES.minFinalRevalidateOk,6);
assert.equal(WEATHER_RULES.maxResolveAttempts,2);
assert.equal(WEATHER_RULES.maxMetAttempts,2);
function point(hour,{temp=22,humidity=45,wind=2,rain=0,rain6=null,symbol='clearsky_day',withOneHour=true}={}){
  const data={instant:{details:{air_temperature:temp,relative_humidity:humidity,wind_speed:wind}}};
  if(withOneHour)data.next_1_hours={details:{precipitation_amount:rain},summary:{symbol_code:symbol}};
  if(rain6!==null)data.next_6_hours={details:{precipitation_amount:rain6},summary:{symbol_code:symbol}};
  return {time:`2026-08-18T${String(hour-4).padStart(2,'0')}:30:00Z`,data};
}
const now=new Date('2026-08-18T03:15:00Z'); // 06:45 Tehran.
const good={id:'a',name:'اردبیل',profile:'CITY',lat:38.2,lon:48.3,province:'اردبیل',zone:'NORTHWEST'};
const series=[9,10,11,12,13,14,15,16,17,18].map(h=>point(h,{temp:h===9?40:22}));
const assessment=assessWeather(good,series,now);
assert.equal(assessment.eligible,true);assert.ok(assessment.bestWindow);assert.ok(assessment.score>=80);assert.match(weatherReason(assessment),/بهترین بازه/);
assert.equal(assessment.hours.some(h=>h.hour===9),false,'all pre-publication batches must use the same 10:00+ horizon');

// All 3–5 hour windows must be evaluated. A materially better 3-hour window
// should beat a longer window containing uncomfortable edge hours.
const shortBest=assessWeather({...good,id:'short'},[
  point(10,{temp:34}),point(11,{temp:21}),point(12,{temp:21}),point(13,{temp:21}),point(14,{temp:34}),point(15,{temp:34})
],now);
assert.equal(shortBest.bestWindow.start,11);assert.equal(shortBest.bestWindow.end,14);

const storm=assessWeather({...good,id:'storm'},[10,11,12,13,14].map((h,i)=>point(h,{symbol:i===2?'heavyrain_day':'clearsky_day',rain:i===2?5:0})),now);
assert.equal(storm.eligible,false);assert.equal(storm.rejectReason,'SEVERE_WEATHER');

// next_6_hours values overlap at adjacent timestamps; the engine must not sum
// them as if each were an independent 1-hour amount.
const sixHourFallback=assessWeather({...good,id:'rain6'},[10,11,12,13,14].map(h=>point(h,{withOneHour:false,rain6:1.2,symbol:'cloudy'})),now);
assert.equal(sixHourFallback.precipitation,1.2);

const items=[
 {...assessment,id:'a',name:'اردبیل',lat:38.2,lon:48.3,province:'اردبیل',zone:'NORTHWEST',profile:'CITY',score:94},
 {...assessment,id:'b',name:'ماسال',lat:37.3,lon:49.1,province:'گیلان',zone:'NORTHWEST',profile:'NATURE',score:90},
 {...assessment,id:'c',name:'همدان',lat:34.8,lon:48.5,province:'همدان',zone:'WEST',profile:'HERITAGE',score:88},
 {...assessment,id:'d',name:'سنندج',lat:35.3,lon:47.0,province:'کردستان',zone:'WEST',profile:'CITY',score:87},
 {...assessment,id:'e',name:'کوهرنگ',lat:32.4,lon:50.1,province:'چهارمحال و بختیاری',zone:'CENTRAL',profile:'MOUNTAIN',score:86}
];
const history=[{date:'2026-08-17',id:'a',lat:38.2,lon:48.3},{date:'2026-08-15',id:'d',lat:35.3,lon:47.0}];
const picks=selectWeatherPicks(items,history,'2026-08-18');
assert.equal(picks.length,3);assert.ok(picks.some(x=>x.role==='TOP'));assert.ok(picks.some(x=>x.role==='FRESH'));assert.ok(picks.some(x=>x.role==='DIFFERENT'));
assert.notEqual(picks[0].id,'a','yesterday destination should yield to a comparably strong fresh alternative');
assert.ok(new Set(picks.map(x=>x.id)).size===3);
console.log('weather core verified/resumable/final-lock tests: ok');
