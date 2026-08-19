export const WEATHER_VERSION = 'weather-v2.5-full-420-independent';

export const WEATHER_RULES = Object.freeze({
  targetForecasts: 420,
  dailySampleSize: 420,
  fullScanBatchSize: 6,
  manualBatchSize: 6,
  forecastConcurrency: 3,
  resolverConcurrency: 2,
  geoWarmupBatchSize: 5,
  metTimeoutMs: 9000,
  wikiTimeoutMs: 6500,
  wikidataTimeoutMs: 6500,
  maxResolveAttempts: 2,
  maxMetAttempts: 2,
  eligiblePoolLimit: 96,
  finalistPoolSize: 18,
  minFinalRevalidateOk: 6,
  minCoveragePct: 78,
  targetCoveragePct: 88,
  minGeoZones: 5,
  minHourlyPoints: 4,
  recentHardBlockDays: 2,
  recentPenaltyDays: 10,
  nearbyCooldownDays: 4,
  nearbyCooldownKm: 45,
  minTopScore: 66,
  minFreshScore: 62,
  minDifferentScore: 60,
  minDistanceKm: 90,
  topRepeatTolerance: 4
});

export function tehranDateParts(value=new Date()){
  const f=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  return Object.fromEntries(f.formatToParts(value).map(p=>[p.type,p.value]));
}
export function tehranDateKey(value=new Date()){const p=tehranDateParts(value);return `${p.year}-${p.month}-${p.day}`;}
export function stableWeatherHash(value=''){let h=2166136261;for(const c of String(value)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function normalizedWeatherSymbol(raw='cloudy'){return String(raw).replace(/_(day|night|polartwilight)$/i,'').toLowerCase();}
function severeSymbol(symbol=''){return /thunder|heavyrain|heavysnow|sleet/i.test(normalizedWeatherSymbol(symbol));}
function profileConfig(profile='CITY'){
  const configs={
    CITY:{idealMin:16,idealMax:27,windSoft:18,windHard:34,rainSoft:0.6,rainHard:4.5,humiditySoft:75,heatHard:36,coldHard:-4},
    HERITAGE:{idealMin:15,idealMax:27,windSoft:18,windHard:32,rainSoft:0.5,rainHard:4,humiditySoft:75,heatHard:35,coldHard:-4},
    NATURE:{idealMin:12,idealMax:25,windSoft:16,windHard:30,rainSoft:0.5,rainHard:3.5,humiditySoft:80,heatHard:34,coldHard:-5},
    MOUNTAIN:{idealMin:8,idealMax:22,windSoft:14,windHard:27,rainSoft:0.4,rainHard:3,humiditySoft:80,heatHard:30,coldHard:-6},
    COAST_ISLAND:{idealMin:19,idealMax:29,windSoft:20,windHard:34,rainSoft:0.7,rainHard:5,humiditySoft:82,heatHard:36,coldHard:4},
    DESERT:{idealMin:14,idealMax:27,windSoft:18,windHard:32,rainSoft:0.3,rainHard:3,humiditySoft:70,heatHard:34,coldHard:0}
  };
  return configs[profile]||configs.CITY;
}
function comfortScore(temp,cfg){
  if(temp<cfg.coldHard||temp>cfg.heatHard)return 0;
  if(temp>=cfg.idealMin&&temp<=cfg.idealMax)return 100;
  const delta=temp<cfg.idealMin?cfg.idealMin-temp:temp-cfg.idealMax;
  return Math.max(20,100-delta*9);
}
function rainForScore(hour){
  if(hour?.rain!==null&&hour?.rain!==undefined&&Number.isFinite(Number(hour.rain))) return Number(hour.rain);
  if(hour?.rain6!==null&&hour?.rain6!==undefined&&Number.isFinite(Number(hour.rain6))) return Math.max(0,Number(hour.rain6))/6;
  return 0;
}
export function weatherHourlyScore(hour,profile='CITY'){
  const cfg=profileConfig(profile); const temp=Number(hour.temp),wind=Number(hour.wind||0),rain=rainForScore(hour),humidity=Number(hour.humidity||0),rain6=Number(hour.rain6);
  if(!Number.isFinite(temp))return 0;
  if(severeSymbol(hour.symbol)||wind>cfg.windHard||rain>cfg.rainHard||(Number.isFinite(rain6)&&rain6>cfg.rainHard*2.5)||temp>cfg.heatHard||temp<cfg.coldHard)return 0;
  let score=comfortScore(temp,cfg);
  score-=Math.max(0,wind-cfg.windSoft)*2.3;
  score-=Math.max(0,rain-cfg.rainSoft)*10;
  if(humidity>cfg.humiditySoft&&temp>24)score-=(humidity-cfg.humiditySoft)*0.75;
  if(/rain|snow|fog/i.test(normalizedWeatherSymbol(hour.symbol)))score-=8;
  return Math.max(0,Math.min(100,Math.round(score*10)/10));
}
function localHour(date){return Number(tehranDateParts(date).hour);}
export function extractTodayWeatherHours(series=[],now=new Date()){
  const today=tehranDateKey(now); const current=localHour(now);
  // Automatic scans occur before 09:30, so every destination uses the identical
  // 10:00–19:00 horizon. Manual scans later in the day naturally ignore hours
  // that have already passed.
  const earliest=current<10?10:Math.min(18,current);
  return (Array.isArray(series)?series:[]).map(point=>{
    const when=new Date(point?.time); const p=tehranDateParts(when); const key=`${p.year}-${p.month}-${p.day}`; const hour=Number(p.hour);
    if(key!==today||hour<earliest||hour>19)return null;
    const details=point?.data?.instant?.details||{}; const next1=point?.data?.next_1_hours; const next6=point?.data?.next_6_hours;
    const rain1=Number(next1?.details?.precipitation_amount); const rain6=Number(next6?.details?.precipitation_amount);
    const symbol=next1?.summary?.symbol_code||next6?.summary?.symbol_code||'cloudy';
    return {hour,time:point.time,temp:Number(details.air_temperature),humidity:Number(details.relative_humidity||0),wind:Number(details.wind_speed||0)*3.6,rain:Number.isFinite(rain1)?rain1:null,rain6:Number.isFinite(rain6)?rain6:null,symbol};
  }).filter(Boolean).filter(h=>Number.isFinite(h.temp));
}
function bestWindow(hours,profile){
  if(hours.length<3)return null; let best=null;
  const maxSize=Math.min(5,hours.length);
  for(let size=3;size<=maxSize;size++){
    for(let i=0;i<=hours.length-size;i++){
      const chunk=hours.slice(i,i+size); if(chunk.some((h,j)=>j>0&&h.hour!==chunk[j-1].hour+1))continue;
      const scores=chunk.map(h=>weatherHourlyScore(h,profile)); const avg=scores.reduce((a,b)=>a+b,0)/scores.length; const min=Math.min(...scores);
      // Evaluate all 3–5 hour windows. A small duration bonus prevents a nearly
      // identical 3h window from always beating a useful 5h window, while a
      // materially better short window can still win.
      const combined=avg*0.74+min*0.26+(size-3)*0.7;
      const rounded=Math.round(combined*10)/10;
      if(!best||rounded>best.score)best={start:chunk[0].hour,end:chunk.at(-1).hour+1,score:rounded,hours:chunk};
    }
  }
  return best;
}
function dominantSymbol(hours){const f={};for(const h of hours){const s=normalizedWeatherSymbol(h.symbol);f[s]=(f[s]||0)+1;}return Object.entries(f).sort((a,b)=>b[1]-a[1])[0]?.[0]||'cloudy';}
function precipitationTotal(hours=[]){
  const oneHour=hours.filter(h=>h.rain!==null&&h.rain!==undefined&&Number.isFinite(Number(h.rain))).map(h=>Number(h.rain));
  if(oneHour.length>=Math.ceil(hours.length/2))return Math.round(oneHour.reduce((a,b)=>a+b,0)*10)/10;
  // next_6_hours values overlap between adjacent timestamps, so they must not be
  // summed. When hourly precipitation is sparse, use the largest six-hour risk
  // window as a conservative fallback instead of double-counting it.
  const six=hours.filter(h=>h.rain6!==null&&h.rain6!==undefined&&Number.isFinite(Number(h.rain6))).map(h=>Number(h.rain6));
  return six.length?Math.round(Math.max(...six)*10)/10:0;
}
export function assessWeather(destination,series,now=new Date()){
  const hours=extractTodayWeatherHours(series,now); if(hours.length<WEATHER_RULES.minHourlyPoints)return {...destination,eligible:false,rejectReason:'INSUFFICIENT_TODAY_POINTS',hoursCount:hours.length};
  const cfg=profileConfig(destination.profile); const win=bestWindow(hours,destination.profile); if(!win)return {...destination,eligible:false,rejectReason:'NO_CONTIGUOUS_WINDOW',hoursCount:hours.length};
  const temps=hours.map(h=>h.temp),winds=hours.map(h=>h.wind),humid=hours.map(h=>h.humidity).filter(Number.isFinite);
  const severe=hours.find(h=>severeSymbol(h.symbol)||h.wind>cfg.windHard||rainForScore(h)>cfg.rainHard||(Number.isFinite(Number(h.rain6))&&Number(h.rain6)>cfg.rainHard*2.5)||h.temp>cfg.heatHard||h.temp<cfg.coldHard);
  const totalRain=precipitationTotal(hours); const maxWind=Math.round(Math.max(...winds));
  const dayScores=hours.map(h=>weatherHourlyScore(h,destination.profile)); const avgScore=dayScores.reduce((a,b)=>a+b,0)/dayScores.length;
  const score=Math.round((win.score*0.7+avgScore*0.3)*10)/10;
  const eligible=!severe&&score>=WEATHER_RULES.minDifferentScore&&totalRain<=Math.max(cfg.rainHard*2,5);
  return {...destination,hoursCount:hours.length,hours,minTemp:Math.round(Math.min(...temps)),maxTemp:Math.round(Math.max(...temps)),avgTemp:Math.round((temps.reduce((a,b)=>a+b,0)/temps.length)*10)/10,humidity:humid.length?Math.round(humid.reduce((a,b)=>a+b,0)/humid.length):0,maxWind,precipitation:totalRain,symbol:dominantSymbol(hours),bestWindow:win,score,eligible,rejectReason:severe?'SEVERE_WEATHER':eligible?null:'WEATHER_SCORE_LOW'};
}
export function weatherReason(item){
  const w=item.bestWindow; const window=w?`${String(w.start).padStart(2,'0')}:00 تا ${String(w.end).padStart(2,'0')}:00`:'';
  if(item.precipitation<=0.2&&item.maxWind<=16)return `کم‌بارش و آرام؛ بهترین بازه امروز ${window}`;
  if(item.maxTemp<=24&&item.precipitation<=0.8)return `هوای خنک و مناسب گردش؛ بهترین بازه ${window}`;
  if(item.maxWind>=22)return `دمای مناسب؛ باد در بعضی ساعت‌ها محسوس است. بازه بهتر: ${window}`;
  if(item.humidity>=78&&item.avgTemp>23)return `دمای قابل‌قبول با رطوبت محسوس؛ بازه بهتر: ${window}`;
  return `شرایط متعادل برای گردش؛ بهترین بازه امروز ${window}`;
}
export function haversineKm(a,b){if(!a||!b||!Number.isFinite(Number(a.lat))||!Number.isFinite(Number(a.lon))||!Number.isFinite(Number(b.lat))||!Number.isFinite(Number(b.lon)))return Infinity;const r=x=>x*Math.PI/180,dlat=r(Number(b.lat)-Number(a.lat)),dlon=r(Number(b.lon)-Number(a.lon)),la1=r(Number(a.lat)),la2=r(Number(b.lat));const h=Math.sin(dlat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlon/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
function recentAgeDays(id,history,dateKey){const target=new Date(`${dateKey}T00:00:00Z`).getTime();let best=Infinity;for(const h of history||[]){if(h?.id!==id||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(h.date||''))continue;best=Math.min(best,Math.round((target-new Date(`${h.date}T00:00:00Z`).getTime())/86400000));}return best;}
function recentNearbyAgeDays(item,history,dateKey,radiusKm=WEATHER_RULES.nearbyCooldownKm){
  const target=new Date(`${dateKey}T00:00:00Z`).getTime();let best=Infinity;
  for(const h of history||[]){if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(h.date||''))continue;if(haversineKm(item,h)>radiusKm)continue;best=Math.min(best,Math.round((target-new Date(`${h.date}T00:00:00Z`).getTime())/86400000));}
  return best;
}
export function editorialWeatherRank(item,history=[],dateKey=tehranDateKey(new Date())){
  const age=recentAgeDays(item.id,history,dateKey),near=recentNearbyAgeDays(item,history,dateKey);let s=item.score;
  if(age<=1)s-=30;else if(age<=2)s-=22;else if(age<=4)s-=14;else if(age<=7)s-=8;else if(age<=10)s-=4;
  if(near<=1)s-=16;else if(near<=WEATHER_RULES.nearbyCooldownDays)s-=8;
  return s;
}
function differentProvince(a,b){return !a?.province||!b?.province||a.province!==b.province;}
function differentZone(a,b){return !a?.zone||!b?.zone||a.zone!==b.zone;}
export function selectWeatherPicks(items=[],history=[],dateKey=tehranDateKey(new Date())){
  const raw=items.filter(x=>x?.eligible).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'fa'));
  if(!raw.length)return [];
  const ranked=raw.map(x=>({...x,editorialScore:editorialWeatherRank(x,history,dateKey)})).sort((a,b)=>b.editorialScore-a.editorialScore||b.score-a.score||a.name.localeCompare(b.name,'fa'));
  const rawTop=raw.find(x=>x.score>=WEATHER_RULES.minTopScore)||raw[0];
  const comparableFresh=raw.find(x=>x.id!==rawTop?.id&&recentAgeDays(x.id,history,dateKey)>1&&recentNearbyAgeDays(x,history,dateKey)>1&&x.score>=WEATHER_RULES.minTopScore&&rawTop.score-x.score<=WEATHER_RULES.topRepeatTolerance);
  const top=recentAgeDays(rawTop.id,history,dateKey)<=1&&comparableFresh?comparableFresh:rawTop;
  const picks=[];if(top)picks.push({...top,role:'TOP'});
  const fresh=ranked.find(x=>x.id!==top?.id&&recentAgeDays(x.id,history,dateKey)>WEATHER_RULES.recentPenaltyDays&&recentNearbyAgeDays(x,history,dateKey)>WEATHER_RULES.nearbyCooldownDays&&differentProvince(top,x)&&differentZone(top,x)&&haversineKm(top,x)>=WEATHER_RULES.minDistanceKm&&x.score>=WEATHER_RULES.minFreshScore)
    ||ranked.find(x=>x.id!==top?.id&&recentAgeDays(x.id,history,dateKey)>WEATHER_RULES.recentHardBlockDays&&recentNearbyAgeDays(x,history,dateKey)>2&&differentProvince(top,x)&&haversineKm(top,x)>=WEATHER_RULES.minDistanceKm&&x.score>=WEATHER_RULES.minFreshScore)
    ||ranked.find(x=>x.id!==top?.id&&recentAgeDays(x.id,history,dateKey)>WEATHER_RULES.recentHardBlockDays&&haversineKm(top,x)>=60&&x.score>=WEATHER_RULES.minFreshScore);
  if(fresh)picks.push({...fresh,role:'FRESH'});
  const anchors=picks;
  const different=ranked.find(x=>!anchors.some(a=>a.id===x.id)&&anchors.every(a=>haversineKm(a,x)>=WEATHER_RULES.minDistanceKm)&&anchors.every(a=>differentProvince(a,x))&&anchors.every(a=>differentZone(a,x))&&!anchors.some(a=>a.profile===x.profile)&&recentAgeDays(x.id,history,dateKey)>WEATHER_RULES.recentHardBlockDays&&recentNearbyAgeDays(x,history,dateKey)>2&&x.score>=WEATHER_RULES.minDifferentScore)
    ||ranked.find(x=>!anchors.some(a=>a.id===x.id)&&anchors.every(a=>haversineKm(a,x)>=WEATHER_RULES.minDistanceKm)&&!anchors.some(a=>a.profile===x.profile)&&recentAgeDays(x.id,history,dateKey)>WEATHER_RULES.recentHardBlockDays&&x.score>=WEATHER_RULES.minDifferentScore)
    ||ranked.find(x=>!anchors.some(a=>a.id===x.id)&&anchors.every(a=>haversineKm(a,x)>=60)&&x.score>=WEATHER_RULES.minDifferentScore)
    ||ranked.find(x=>!anchors.some(a=>a.id===x.id)&&x.score>=WEATHER_RULES.minDifferentScore);
  if(different)picks.push({...different,role:'DIFFERENT'});
  return picks.slice(0,3);
}
export function candidateSeasonScore(item,month,history=[],dateKey=''){
  let s=item.tier==='A'?30:item.tier==='B'?20:10; const p=item.profile;
  const warm=month>=5&&month<=9,cold=month===12||month<=3;
  if(warm){if(p==='MOUNTAIN')s+=22;if(p==='NATURE')s+=13;if(p==='DESERT')s-=22;if(p==='COAST_ISLAND')s-=5;}
  if(cold){if(p==='COAST_ISLAND')s+=18;if(p==='DESERT')s+=15;if(p==='MOUNTAIN')s-=12;}
  const age=recentAgeDays(item.id,history,dateKey||'2099-01-01'); if(age<=2)s-=20;else if(age<=7)s-=8;
  s+=stableWeatherHash(`${dateKey}|${item.id}`)%17;
  return s;
}
