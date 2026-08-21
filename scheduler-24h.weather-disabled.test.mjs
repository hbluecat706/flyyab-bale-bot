import assert from "node:assert/strict";
import fs from "node:fs";
import {independentJobsForTick,DAILY_DELIVERY_SLOTS} from "./worker.source.mjs";
const baseline=JSON.parse(fs.readFileSync(new URL("./V1.7-SCHEDULER-24H-SNAPSHOT.json",import.meta.url),"utf8"));
const clean=(jobs,time)=>jobs.filter(j=>!(j.action==="weather_scan"||j.action==="weather_final"||j.name==="weather-scan"||j.name==="weather-final"||j.name==="slot:weather_0930"||((time==="09:35"||time==="09:40")&&j.action==="delivery_recovery")));
let weatherJobs=0; const current=[];
for(let m=0;m<1440;m+=5){
 const h=Math.floor(m/60),mi=m%60,hh=String(h).padStart(2,"0"),mm=String(mi).padStart(2,"0");
 const d=new Date(`2026-08-22T${hh}:${mm}:00+03:30`);
 const jobs=independentJobsForTick(d).map(j=>({name:j.name,action:j.action,instance:j.instance,args:j.args}));
 weatherJobs+=jobs.filter(j=>/weather/i.test(j.name)||/weather/i.test(j.action)||/weather/i.test(j.instance)).length;
 current.push({time:`${hh}:${mm}`,jobs});
}
assert.equal(weatherJobs,0,"Weather must have exactly zero jobs over 24h");
assert.equal(DAILY_DELIVERY_SLOTS.some(s=>s.time==="09:30"),false,"09:30 slot removed");
assert.equal(DAILY_DELIVERY_SLOTS.length,10);
for(let i=0;i<baseline.rows.length;i++) assert.deepEqual(current[i].jobs,clean(baseline.rows[i].jobs,current[i].time),`non-weather scheduler drift at ${current[i].time}`);
const baselineSlots=baseline.slots.filter(s=>s.postType!=="weather"&&s.id!=="weather_0930"&&s.time!=="09:30");
assert.deepEqual(DAILY_DELIVERY_SLOTS,baselineSlots,"all remaining official slots/times must be byte-equivalent data");
console.log("scheduler-24h.weather-disabled: PASS — 288 ticks, 0 Weather jobs, all non-Weather jobs unchanged");
