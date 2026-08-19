export const OCCASION_VERSION = 'occasion-v4.0-arvan-editorial-calendar';
export const BOT_VERSION = '6.9.1';

const TEHRAN_TZ = 'Asia/Tehran';
const CHECKIDAY_BASE = 'https://api.apilayer.com/checkiday/';
const CALENDARIFIC_BASE = 'https://calendarific.com/api/v2/holidays';
const PNLDEV_BASE = 'https://pnldev.com/api/calender';
const NAGER_BASE = 'https://nagerholidays.com/api/v4/Holidays';

export const OCCASION_COUNTRIES = [
  ['TR','ترکیه','🇹🇷'],['AE','امارات','🇦🇪'],['IQ','عراق','🇮🇶'],['SA','عربستان سعودی','🇸🇦'],
  ['QA','قطر','🇶🇦'],['OM','عمان','🇴🇲'],['AM','ارمنستان','🇦🇲'],['AZ','جمهوری آذربایجان','🇦🇿'],
  ['GE','گرجستان','🇬🇪'],['IN','هند','🇮🇳'],['JP','ژاپن','🇯🇵'],['KR','کره جنوبی','🇰🇷'],
  ['CN','چین','🇨🇳'],['TH','تایلند','🇹🇭'],['MY','مالزی','🇲🇾'],['FR','فرانسه','🇫🇷'],
  ['IT','ایتالیا','🇮🇹'],['DE','آلمان','🇩🇪'],['GB','بریتانیا','🇬🇧'],['US','ایالات متحده','🇺🇸']
];

const FOOD_WORDS = /(s'mores|smores|sandwich|burger|pizza|cake|cookie|donut|doughnut|chocolate|coffee|tea|beer|wine|food|bread|zucchini|panini|ice cream|dessert|bacon|waffle)/i;
const COMMERCIAL_WORDS = /(appreciation day|shapewear|garage sale|lazy day|spoil your dog|duran duran)/i;
const HIGH_VALUE_WORDS = /(tourism|travel|aviation|flight|airport|heritage|unesco|museum|photography|photo|vlogging|culture|cultural|nature|wildlife|lion|tiger|animal|ocean|sea|forest|mountain|earth|environment|history|historical|archaeolog|book|literacy|language|peace|humanitarian|independence|national day|liberation|world|international)/i;
const SENSITIVE_WORDS = /(war|victory day|memorial|genocide|terror|suicide|cancer|disease|death|mourning|martyr|politic|election|attack|disaster|tragedy|coup|overthrow|revolution|protest|massacre|bombing|conflict|fatal fire)/i;
const SENSITIVE_WORDS_FA = /(شهادت|رحلت|وفات|سوگ|سوگواری|عزا|عاشورا|تاسوعا|اربعین|جنگ|شهدا|شهید|ترور|کشتار|نسل.?کشی|فاجعه|بیماری|سرطان|ایدز|خشونت|انتخابات|سیاسی|کودتا|برکناری|انقلاب|اعتراض|آتش.?سوزی|سینما.?رکس|انفجار|حمله|درگیری|مرگ|قتل|حادثه)/i;

const KNOWN_FA_TITLES = new Map([
  ['world lion day','روز جهانی شیر'],
  ['international vlogging day','روز بین‌المللی ولاگ‌نویسی'],
  ['world tourism day','روز جهانی گردشگری'],
  ['international museum day','روز جهانی موزه'],
  ['world photography day','روز جهانی عکاسی'],
  ['world environment day','روز جهانی محیط‌زیست'],
  ['world wildlife day','روز جهانی حیات‌وحش'],
  ['international civil aviation day','روز جهانی هوانوردی غیرنظامی'],
  ['world book day','روز جهانی کتاب'],
  ['international mother language day','روز جهانی زبان مادری'],
  ['international day of peace','روز جهانی صلح'],
  ['world oceans day','روز جهانی اقیانوس‌ها'],
  ['world animal day','روز جهانی حیوانات'],
  ['world nature conservation day','روز جهانی حفاظت از طبیعت']
  ,['international left handers day','روز جهانی چپ‌دست‌ها']
  ,['international lefthanders day','روز جهانی چپ‌دست‌ها']
  ,['left handers day','روز جهانی چپ‌دست‌ها']
]);

export function cleanCommandArg(value) {
  return String(value || '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .trim();
}

export function currentTehranIso(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addIsoDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function validateIsoDate(value) {
  const v = cleanCommandArg(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('تاریخ باید به شکل YYYY-MM-DD باشد');
  const d = new Date(`${v}T12:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== v) throw new Error('تاریخ معتبر نیست');
  return v;
}

export function resolveOccasionDate(arg, now = new Date()) {
  const cleaned = cleanCommandArg(arg);
  return cleaned ? validateIsoDate(cleaned) : currentTehranIso(now);
}

export function isoParts(iso) {
  const [year, month, day] = validateIsoDate(iso).split('-').map(Number);
  return { year, month, day };
}

export function persianNumericParts(iso) {
  const date = new Date(`${validateIsoDate(iso)}T12:00:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: TEHRAN_TZ, year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(date).map(p => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

export function displayDate(iso) {
  const date = new Date(`${validateIsoDate(iso)}T12:00:00Z`);
  const solarParts=Object.fromEntries(new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: TEHRAN_TZ, weekday:'long', year:'numeric', month:'long', day:'numeric' }).formatToParts(date).map(p=>[p.type,p.value]));
  const gregParts=Object.fromEntries(new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone: TEHRAN_TZ, year:'numeric', month:'long', day:'numeric' }).formatToParts(date).map(p=>[p.type,p.value]));
  const solar = `${solarParts.weekday}، ${solarParts.day} ${solarParts.month} ${solarParts.year}`;
  const greg = `${gregParts.day} ${gregParts.month} ${gregParts.year}`;
  return { solar, gregorian: greg };
}

function sourceRecord(name, ok, extra = {}) {
  return { name, ok: Boolean(ok), ...extra };
}

async function fetchJson(fetchImpl, url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    return { ok: response.ok, status: response.status, data, text: text.slice(0, 800), headers: response.headers };
  } catch (error) {
    return { ok: false, status: 0, data: null, text: '', error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function flattenCheckiday(data) {
  // Daily FlyYab posts should not repeat month/year-long observances every day.
  // Keep one-day events and multi-day events that START today; ignore ongoing ones.
  const pools = [data?.events, data?.multiday_starting];
  const out = [];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    for (const item of pool) if (item?.name) out.push(item);
  }
  return out;
}

export async function fetchPnlDev(fetchImpl, iso) {
  const p = persianNumericParts(iso);
  const url = `${PNLDEV_BASE}?year=${p.year}&month=${p.month}&day=${p.day}&holiday=false`;
  const r = await fetchJson(fetchImpl, url, { headers: { accept: 'application/json', 'user-agent': 'FlyYab-Occasion/2.3' } });
  const result = r.data?.result;
  const events = r.ok && r.data?.status === true && result ? (Array.isArray(result.event) ? result.event.filter(Boolean) : []) : [];
  return {
    source: sourceRecord('PNLdev', r.ok && r.data?.status === true, { status: r.status, count: events.length, url: PNLDEV_BASE, error: r.ok ? null : (r.data?.message || r.error || r.text) }),
    events: events.map((name, i) => ({
      id: `iran-${iso}-${i}`,
      name: String(name).trim(),
      faName: String(name).trim(),
      scope: 'IRAN',
      category: 'IRAN_OFFICIAL',
      source: 'PNLdev',
      sourceUrl: PNLDEV_BASE,
      confidence: 92,
      countryCode: 'IR',
      countryFa: 'ایران',
      emoji: '🇮🇷',
      details: null
    }))
  };
}


function normalizeCheckidayDate(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
}
export async function fetchCheckiday(fetchImpl, iso, apiKey) {
  if (!apiKey) return { source: sourceRecord('Checkiday', false, { disabled: true, error: 'CHECKIDAY_API_KEY تنظیم نشده' }), events: [] };

  const isToday = iso === currentTehranIso(new Date());
  // APILayer Checkiday Free/Starter plans do not permit the `date` parameter,
  // and `timezone` is Enterprise-only. Therefore Checkiday is intentionally
  // queried only for the current day and only with unrestricted parameters.
  // Future dates are prepared from the other providers and Checkiday is added
  // on the publication day during the 09:45 and 10:10 Tehran refreshes.
  if (!isToday) {
    return {
      source: sourceRecord('Checkiday', true, {
        deferred: true,
        count: 0,
        url: 'https://api.apilayer.com/checkiday/events',
        error: null,
        note: 'بررسی Checkiday در روز انتشار انجام می‌شود'
      }),
      events: []
    };
  }

  const q = new URLSearchParams({ adult: 'false' });
  const url = `${CHECKIDAY_BASE}events?${q}`;
  const r = await fetchJson(fetchImpl, url, {
    headers: { apikey: apiKey, accept: 'application/json', 'user-agent': 'FlyYab-Occasion/2.3' }
  });

  // Checkiday Free uses its own default timezone. Do not silently accept the
  // previous day's feed during the few hours around Tehran midnight.
  const responseDate = normalizeCheckidayDate(r.data?.date);
  if (r.ok && responseDate && responseDate !== iso) {
    return {
      source: sourceRecord('Checkiday', false, {
        status: r.status,
        count: 0,
        deferred: true,
        responseDate,
        url: 'https://api.apilayer.com/checkiday/events',
        error: `تاریخ Checkiday هنوز ${responseDate} است؛ در کنترل 09:45 دوباره بررسی می‌شود`
      }),
      events: []
    };
  }

  const raw = r.ok ? flattenCheckiday(r.data) : [];
  const dedup = new Map();
  for (const item of raw) {
    const key = String(item.id || item.name).toLowerCase();
    if (!dedup.has(key)) dedup.set(key, item);
  }
  const events = [...dedup.values()].map(item => ({
    id: `checkiday-${item.id || slug(item.name)}`,
    sourceId: item.id || null,
    name: String(item.name).trim(),
    faName: null,
    scope: 'GLOBAL',
    category: 'GLOBAL_OBSERVANCE',
    source: 'Checkiday',
    sourceUrl: item.url || 'https://www.checkiday.com/',
    // Checkiday itself is the authoritative source for existence/name of its
    // researched observances. Without Pro detail access, story copy remains
    // strictly title-grounded and cannot invent historical facts.
    confidence: 88,
    countryCode: null,
    countryFa: null,
    emoji: emojiForName(item.name),
    details: null
  }));
  const bodyRemaining = Number(r.data?.rateLimit?.remainingMonth);
  const headerRemaining = Number(r.headers?.get?.('x-ratelimit-remaining-month'));
  const remaining = Number.isFinite(bodyRemaining) ? bodyRemaining : headerRemaining;
  return {
    source: sourceRecord('Checkiday', r.ok, {
      status: r.status,
      count: events.length,
      responseDate: responseDate || null,
      responseTimezone: r.data?.timezone || null,
      url: 'https://api.apilayer.com/checkiday/events',
      remainingMonth: Number.isFinite(remaining) ? remaining : null,
      error: r.ok ? null : (r.data?.message || r.data?.error || r.error || r.text)
    }),
    events
  };
}
async function mapBatched(items, limit, fn) {
  const out = [];
  for (let i=0;i<items.length;i+=limit) {
    const batch = items.slice(i,i+limit);
    const settled = await Promise.allSettled(batch.map(fn));
    for (let j=0;j<settled.length;j++) out.push(settled[j].status === 'fulfilled' ? settled[j].value : { error: settled[j].reason?.message || String(settled[j].reason), item: batch[j] });
  }
  return out;
}

export async function fetchNager(fetchImpl, iso, countries = OCCASION_COUNTRIES) {
  const {year} = isoParts(iso);
  const results = await mapBatched(countries, 4, async ([code, countryFa, flag]) => {
    const r = await fetchJson(fetchImpl, `${NAGER_BASE}/${code}/${year}`, { headers: { accept:'application/json', 'user-agent':'FlyYab-Occasion/2.3' } });
    const rows = r.ok && Array.isArray(r.data) ? r.data.filter(h => h?.date === iso && h?.nationalHoliday !== false) : [];
    return { code, countryFa, flag, ok:r.ok, status:r.status, rows, error:r.ok ? null : (r.error || r.text) };
  });
  const events=[];
  let success=0;
  for (const item of results) {
    if (item.ok) success++;
    for (const h of item.rows || []) events.push({
      id:`nager-${item.code}-${iso}-${slug(h.name)}`,
      name:String(h.name).trim(), faName:null, scope:'GLOBAL', category:'NATIONAL_HOLIDAY', source:'Nager.Holidays', sourceUrl:'https://nagerholidays.com/', confidence:94,
      countryCode:item.code, countryFa:item.countryFa, emoji:item.flag, details:{ holidayTypes:Array.isArray(h.holidayTypes)?h.holidayTypes:[] }
    });
  }
  return { source: sourceRecord('Nager.Holidays', success>0, { status:success ? 200 : 0, count:events.length, countriesOk:success, countriesTotal:countries.length, url:'https://nagerholidays.com/api', error:success ? null : 'هیچ کشور پاسخ موفق نداد' }), events };
}

export async function fetchCalendarific(fetchImpl, iso, apiKey, countries = []) {
  if (!apiKey) return { source: sourceRecord('Calendarific', false, { disabled:true, error:'CALENDARIFIC_API_KEY تنظیم نشده' }), events:[] };
  if (!countries.length) return { source: sourceRecord('Calendarific', true, { skipped:true, count:0, countriesOk:0, countriesTotal:0, url:'https://calendarific.com/api-documentation', error:null, note:'کاندیدای Nager برای تطبیق وجود نداشت' }), events:[] };
  const {year,month,day}=isoParts(iso);
  const results=await mapBatched(countries,4,async ([code,countryFa,flag])=>{
    const q=new URLSearchParams({api_key:apiKey,country:code,year:String(year),month:String(month),day:String(day)});
    const r=await fetchJson(fetchImpl,`${CALENDARIFIC_BASE}?${q}`,{headers:{accept:'application/json','user-agent':'FlyYab-Occasion/2.3'}});
    const holidays=r.ok && r.data?.meta?.code===200 && Array.isArray(r.data?.response?.holidays) ? r.data.response.holidays : [];
    return {code,countryFa,flag,ok:r.ok && r.data?.meta?.code===200,status:r.status,holidays,error:r.ok?null:(r.data?.meta?.error_detail||r.error||r.text)};
  });
  const events=[]; let success=0;
  for(const item of results){
    if(item.ok) success++;
    for(const h of item.holidays||[]){
      const types=Array.isArray(h.type)?h.type:[];
      if(types.some(t=>String(t).toLowerCase()==='local')) continue;
      const lowerTypes=types.map(t=>String(t).toLowerCase());
      const category=lowerTypes.includes('national')?'NATIONAL_HOLIDAY':(lowerTypes.includes('religious')?'RELIGIOUS_OBSERVANCE':'GLOBAL_OBSERVANCE');
      events.push({id:`calendarific-${item.code}-${iso}-${slug(h.name)}`,name:String(h.name).trim(),faName:null,scope:'GLOBAL',category,source:'Calendarific',sourceUrl:'https://calendarific.com/',confidence:91,countryCode:item.code,countryFa:item.countryFa,emoji:item.flag,details:{description:String(h.description||'').trim(),types}});
    }
  }
  return { source: sourceRecord('Calendarific',success>0,{status:success?200:0,count:events.length,countriesOk:success,countriesTotal:countries.length,url:'https://calendarific.com/api-documentation',error:success?null:'هیچ کشور پاسخ موفق نداد'}),events };
}

function slug(value){ return String(value||'').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,80); }
function normalName(value){ return String(value||'').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,' ').trim(); }

function cleanOccasionTitle(value){
  return String(value||'')
    .replace(/[\[\(]\s*\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*[\]\)]/ig,' ')
    .replace(/[\[\(]\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\s*[\]\)]/ig,' ')
    .replace(/[\[\(]\s*[0-9۰-۹٠-٩]{1,3}\s+(?:محرم|صفر|ربیع(?:‌|\s*)الاول|ربیع(?:‌|\s*)الثانی|جمادی(?:‌|\s*)الاول|جمادی(?:‌|\s*)الثانی|رجب|شعبان|رمضان|شوال|ذی(?:‌|\s*)القعده|ذی(?:‌|\s*)الحجه)\s*[\]\)]/g,' ')
    .replace(/\s+(?:علیه(?:‌|\s*)السلام|عليه(?:‌|\s*)السلام)\s*$/g,' (ع)')
    .replace(/چپ\s*دست\s*ها/g,'چپ‌دست‌ها')
    .replace(/بین\s+المللی/g,'بین‌المللی')
    .replace(/\s{2,}/g,' ')
    .trim();
}

function normalizeSourceEvent(event){
  const name=cleanOccasionTitle(event?.name);
  const faName=event?.faName?cleanOccasionTitle(event.faName):null;
  const iranGlobal=event?.scope==='IRAN' && /(?:روز\s+(?:جهانی|بین‌المللی)|world|international)/i.test(`${name} ${faName||''}`);
  return iranGlobal
    ? {...event,name,faName,scope:'GLOBAL',category:'GLOBAL_OBSERVANCE',countryCode:null,countryFa:null,emoji:emojiForName(name),confidence:Math.min(86,Number(event.confidence||80))}
    : {...event,name,faName};
}

export function emojiForName(name){
  const s=String(name||'').toLowerCase();
  if(/left.?hand|چپ.?دست/.test(s)) return '🤚';
  if(/\blion\b/.test(s)) return '🦁';
  if(/\btiger\b/.test(s)) return '🐅';
  if(/\bdog\b/.test(s)) return '🐕';
  if(/\bcat\b/.test(s)) return '🐈';
  if(/animal|wildlife/.test(s)) return '🐾';
  if(/flight|aviation|airport/.test(s)) return '✈️';
  if(/tourism|travel/.test(s)) return '🧳';
  if(/museum|heritage|history|archaeolog/.test(s)) return '🏛️';
  if(/culture|cultural|art|theatre|theater|music/.test(s)) return '🎭';
  if(/vlog|video/.test(s)) return '🎥';
  if(/photo|photography|camera/.test(s)) return '📷';
  if(/ocean|sea/.test(s)) return '🌊';
  if(/forest/.test(s)) return '🌲';
  if(/mountain/.test(s)) return '⛰️';
  if(/nature|earth|environment/.test(s)) return '🌿';
  if(/book|literacy|language/.test(s)) return '📚';
  if(/peace|humanitarian/.test(s)) return '🕊️';
  return '🌍';
}

export function scoreEvent(event){
  if(event.scope==='IRAN') return 100;
  const name=String(event.name||'');
  let score=15;
  if(event.category==='NATIONAL_HOLIDAY') score+=35;
  if(event.category==='RELIGIOUS_OBSERVANCE') score+=20;
  if(/\b(world|international)\b/i.test(name)) score+=22;
  if(/روز\s+(?:جهانی|بین‌المللی)/.test(String(event.faName||name))) score+=22;
  if(HIGH_VALUE_WORDS.test(name)) score+=25;
  if(/museum|heritage|culture|cultural|history|historical|archaeolog/i.test(name)) score+=15;
  if(/nature|wildlife|lion|tiger|animal|ocean|sea|forest|mountain|earth|environment/i.test(name)) score+=18;
  if(/photo|photography|vlog|film|camera|video/i.test(name)) score+=12;
  if(FOOD_WORDS.test(name)) score-=35;
  if(COMMERCIAL_WORDS.test(name)) score-=30;
  if(SENSITIVE_WORDS.test(name)) score-=15;
  return Math.max(0,Math.min(100,score));
}

export function dedupeEvents(events){
  const map=new Map();
  for(const e of events){
    const key=`${e.scope}:${normalName(e.name).replace(/^(world|international|national) /,'')}:${e.countryCode||''}`;
    const prev=map.get(key);
    if(!prev){
      map.set(key,{...e,verifiedBy:[e.source].filter(Boolean)});
      continue;
    }
    const verifiedBy=[...new Set([...(prev.verifiedBy||[prev.source]),e.source].filter(Boolean))];
    const preferred=(e.confidence||0)>(prev.confidence||0)?e:prev;
    const corroborationBonus=verifiedBy.length>1?4:0;
    map.set(key,{...preferred,verifiedBy,confidence:Math.min(99,Math.max(prev.confidence||0,e.confidence||0)+corroborationBonus)});
  }
  return [...map.values()];
}

export function selectEvents(events,{globalLimit=5,minGlobalScore=35}={}){
  const unique=dedupeEvents(events.map(normalizeSourceEvent).filter(e=>e.name)).map(e=>({...e,score:scoreEvent(e)}));
  const iran=unique.filter(e=>e.scope==='IRAN').sort((a,b)=>b.score-a.score || (b.confidence||0)-(a.confidence||0));
  const globalAll=unique.filter(e=>e.scope!=='IRAN').sort((a,b)=>b.score-a.score || (b.confidence||0)-(a.confidence||0));
  const global=globalAll.filter(e=>e.score>=minGlobalScore).slice(0,globalLimit);
  const selectedIds=new Set([...iran,...global].map(e=>e.id));
  const rejected=unique.filter(e=>!selectedIds.has(e.id)).map(e=>({...e,rejectReason:e.scope!=='IRAN'&&e.score<minGlobalScore?'LOW_CONTENT_SCORE':'LIMIT_OR_DUPLICATE'}));
  return {iran,global,rejected,all:unique};
}

function curateCalendarSelection(selection){
  const iran=selection.iran.slice(0,2);
  const global=selection.global.slice(0,2);
  const keep=new Set([...iran,...global].map(e=>e.id));
  const dropped=[...selection.iran,...selection.global]
    .filter(e=>!keep.has(e.id))
    .map(e=>({...e,rejectReason:'CALENDAR_DISPLAY_LIMIT'}));
  return {...selection,iran,global,rejected:[...selection.rejected,...dropped]};
}

function compactDescription(text,max=1000){
  const s=String(text||'').replace(/\s+/g,' ').trim();
  if(s.length<=max) return s;
  const cut=s.slice(0,max);
  const i=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('؛'),cut.lastIndexOf('،'));
  return (i>220?cut.slice(0,i+1):cut).trim();
}

function decodeBasicHtml(value){
  return String(value||'').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}

function stripTitleDecoration(value){
  return String(value||'')
    .replace(/[\r\n\t]+/g,' ')
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}]/gu,' ')
    .replace(/^[\s•●▪▫◦·\-–—:؛،]+|[\s•●▪▫◦·\-–—:؛،]+$/g,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}

export function polishFaTitle(original, translated){
  const originalKey=normalName(original);
  const known=KNOWN_FA_TITLES.get(originalKey);
  if(known) return known;
  let t=stripTitleDecoration(translated || original);
  t=t
    .replace(/بین\s+المللی/g,'بین‌المللی')
    .replace(/حیات\s+وحش/g,'حیات‌وحش')
    .replace(/محیط\s+زیست/g,'محیط‌زیست')
    .replace(/(?:و[ُو]?لوگینگ|ولاگینگ|ولوگینگ|ویدئو\s*بلاگ(?:‌|\s*)نویسی)/g,'ولاگ‌نویسی')
    .replace(/روز\s+بین‌المللی\s+ولاگ$/,'روز بین‌المللی ولاگ‌نویسی');
  return t || String(original||'').trim();
}

function fallbackFaTitle(event){
  if(event?.faName) return polishFaTitle(event.name,event.faName);
  const name=String(event?.name||'').trim();
  const known=KNOWN_FA_TITLES.get(normalName(name));
  if(known) return known;
  if(/^Independence Day$/i.test(name)) return 'روز استقلال';
  if(/^National Day$/i.test(name)) return 'روز ملی';
  if(/^Republic Day$/i.test(name)) return 'روز جمهوری';
  if(/^Constitution Day$/i.test(name)) return 'روز قانون اساسی';
  if(/^Liberation Day$/i.test(name)) return 'روز آزادی';
  return name;
}

function isSensitiveEvent(event){
  const en=String(event?.name||'');
  const fa=String(event?.faName||'');
  return SENSITIVE_WORDS.test(en) || SENSITIVE_WORDS_FA.test(fa) || SENSITIVE_WORDS_FA.test(en);
}

function editorialBucket(event){
  const n=String(event?.name||'').toLowerCase();
  const fa=String(event?.faName||event?.name||'');
  if(/tourism|travel/.test(n) || /(گردشگری|سفر)/.test(fa)) return 'travel';
  if(/flight|aviation|airport/.test(n) || /(هوانوردی|پرواز|فرودگاه)/.test(fa)) return 'aviation';
  if(/photo|photography|vlog|film|camera|video/.test(n) || /(عکاس|عکاسی|تصویر|ولاگ|فیلم|دوربین|ویدئو)/.test(fa)) return 'media';
  if(/lion|tiger|animal|wildlife|nature|forest|ocean|sea|mountain|earth|environment/.test(n) || /(شیر|ببر|حیات.?وحش|طبیعت|جنگل|اقیانوس|دریا|کوه|زمین|محیط.?زیست)/.test(fa)) return 'nature';
  if(/museum|heritage|history|historical|archaeolog/.test(n) || /(موزه|میراث|تاریخ|باستان|آثار تاریخی)/.test(fa)) return 'heritage';
  if(/culture|cultural|book|literacy|language|art|theatre|theater|music|craft/.test(n) || /(فرهنگ|هنر|کتاب|زبان|ادبیات|صنایع.?دستی|موسیقی|تئاتر)/.test(fa)) return 'culture';
  if(/left.?hand/.test(n) || /چپ.?دست/.test(fa)) return 'inclusion';
  if(event?.category==='NATIONAL_HOLIDAY') return 'national';
  return 'general';
}

function evidenceText(event){
  return [event?.details?.description,event?.editorialEvidence?.checkidayDescription,event?.editorialEvidence?.wikipediaExtract]
    .filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
}

function storyPriority(event){
  if(!event || isSensitiveEvent(event)) return -1e9;
  const bucket=editorialBucket(event);
  if(bucket==='general') return -1e9;
  const bonus={travel:72,aviation:68,media:64,nature:60,heritage:56,culture:54,national:42,inclusion:34,general:0}[bucket]||0;
  const evidenceBonus=Math.min(24,Math.floor(evidenceText(event).length/80)*6);
  const verificationBonus=Math.max(0,((event.verifiedBy||[]).length-1)*4);
  return Number(event.score||0)+bonus+evidenceBonus+verificationBonus;
}

function featureCandidates(selected,limit=2){
  return [...selected.iran,...selected.global]
    .filter(e=>!isSensitiveEvent(e) && editorialBucket(e)!=='general')
    .sort((a,b)=>storyPriority(b)-storyPriority(a))
    .slice(0,limit);
}

export function chooseStoryEvent(selected){
  return featureCandidates(selected,1)[0]||null;
}

async function fetchTextWithTimeout(fetchImpl,url,options={},timeoutMs=7000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('timeout'),timeoutMs);
  try{
    const response=await fetchImpl(url,{...options,signal:controller.signal});
    const text=await response.text();
    return {ok:response.ok,status:response.status,text,headers:response.headers};
  }catch(error){return {ok:false,status:0,text:'',error:String(error?.message||error)}}finally{clearTimeout(timer)}
}

async function scrapeSourceDescription(fetchImpl,event){
  if(!event?.sourceUrl || !/^https?:\/\//i.test(String(event.sourceUrl))) return '';
  if(!/^https:\/\/(?:www\.)?checkiday\.com\//i.test(String(event.sourceUrl))) return '';
  const r=await fetchTextWithTimeout(fetchImpl,event.sourceUrl,{headers:{accept:'text/html','user-agent':'FlyYab-Occasion/4.0'}},6500);
  if(!r.ok) return '';
  const html=r.text.slice(0,220000);
  const match=html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
  const description=decodeBasicHtml(match?.[1]||'');
  return description.length>=70&&description.length<=1500?description:'';
}

async function wikipediaSummaryByTitle(fetchImpl,lang,title){
  const clean=String(title||'').trim();
  if(!clean) return null;
  const url=`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean.replace(/ /g,'_'))}`;
  const r=await fetchJson(fetchImpl,url,{headers:{accept:'application/json','user-agent':'FlyYab-Occasion/4.0'}},6500);
  if(!r.ok || !r.data || r.data.type==='https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;
  const extract=String(r.data.extract||'').replace(/\s+/g,' ').trim();
  if(extract.length<90) return null;
  return {lang,title:String(r.data.title||clean),extract:compactDescription(extract,1100),url:String(r.data?.content_urls?.desktop?.page||url)};
}

async function wikipediaSearchSummary(fetchImpl,lang,query){
  const q=String(query||'').trim();
  if(!q) return null;
  const params=new URLSearchParams({action:'query',list:'search',srsearch:q,srlimit:'3',format:'json',origin:'*'});
  const r=await fetchJson(fetchImpl,`https://${lang}.wikipedia.org/w/api.php?${params}`,{headers:{accept:'application/json','user-agent':'FlyYab-Occasion/4.0'}},6500);
  const rows=Array.isArray(r.data?.query?.search)?r.data.query.search:[];
  for(const row of rows.slice(0,2)){
    const summary=await wikipediaSummaryByTitle(fetchImpl,lang,row?.title);
    if(summary) return summary;
  }
  return null;
}

async function enrichFeatureCandidate(fetchImpl,event){
  const existing=String(event?.details?.description||'').replace(/\s+/g,' ').trim();
  let checkidayDescription=existing;
  if(!checkidayDescription) checkidayDescription=await scrapeSourceDescription(fetchImpl,event);
  let wikipedia=null;
  const tries=[];
  const fa=fallbackFaTitle(event);
  if(event.scope==='IRAN' || /[\u0600-\u06FF]/.test(fa)) tries.push(['fa',fa]);
  if(event.name) tries.push(['en',event.name]);
  for(const [lang,title] of tries){
    wikipedia=await wikipediaSummaryByTitle(fetchImpl,lang,title);
    if(!wikipedia) wikipedia=await wikipediaSearchSummary(fetchImpl,lang,title);
    if(wikipedia) break;
  }
  return {...event,editorialEvidence:{checkidayDescription:compactDescription(checkidayDescription,900),wikipediaExtract:wikipedia?.extract||'',wikipediaTitle:wikipedia?.title||'',wikipediaUrl:wikipedia?.url||'',wikipediaLang:wikipedia?.lang||''}};
}

function arvanAiAuthorization(value){
  const key=String(value||'').trim();
  if(!key) throw new Error('ARVAN_AI_API_KEY تنظیم نشده است');
  return /^apikey\s+/i.test(key)?key:`apikey ${key}`;
}

function arvanAiChatUrl(value){
  const endpoint=String(value||'').trim().replace(/\/+$/,'');
  if(!endpoint) throw new Error('ARVAN_AI_ENDPOINT تنظیم نشده است');
  return /\/chat\/completions$/i.test(endpoint)?endpoint:`${endpoint}/chat/completions`;
}

function cleanEditorialText(value,{singleLine=false,max=2600}={}){
  let s=String(value||'')
    .replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')
    .replace(/\*\*/g,'')
    .replace(/<[^>]*>/g,' ')
    .replace(/[\u200B\u200D-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'')
    .trim();
  if(singleLine) s=s.replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ').trim();
  else s=s.replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  return s.slice(0,max).trim();
}

function parseAiJson(content){
  const raw=String(content||'').trim();
  const cleaned=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{return JSON.parse(cleaned)}catch{}
  const first=cleaned.indexOf('{'); const last=cleaned.lastIndexOf('}');
  if(first>=0&&last>first){try{return JSON.parse(cleaned.slice(first,last+1))}catch{}}
  return null;
}

async function runArvanOccasion(env,fetchImpl,messages){
  if(!env?.ARVAN_AI_API_KEY || !env?.ARVAN_AI_ENDPOINT) throw new Error('ARVAN_AI_NOT_CONFIGURED');
  const model=String(env.ARVAN_AI_MODEL||'GPT-4.1-Mini').trim()||'GPT-4.1-Mini';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('Arvan AI timeout'),28000);
  try{
    const response=await fetchImpl(arvanAiChatUrl(env.ARVAN_AI_ENDPOINT),{
      method:'POST',
      headers:{Authorization:arvanAiAuthorization(env.ARVAN_AI_API_KEY),'content-type':'application/json'},
      body:JSON.stringify({model,messages,temperature:0.48,max_tokens:1200}),
      signal:controller.signal
    });
    const raw=await response.text();
    let data=null; try{data=raw?JSON.parse(raw):null}catch{}
    if(!response.ok) throw new Error(`ARVAN_HTTP_${response.status}:${String(data?.error?.message||data?.message||raw||'').slice(0,220)}`);
    const content=String(data?.choices?.[0]?.message?.content||'').trim();
    if(!content) throw new Error('ARVAN_EMPTY_CONTENT');
    return {content,model,httpStatus:response.status};
  }finally{clearTimeout(timer)}
}

function candidateFactPack(event){
  const facts=[];
  facts.push(`شناسه: ${event.id}`);
  facts.push(`عنوان منبع: ${event.name}`);
  facts.push(`عنوان فارسی موجود: ${fallbackFaTitle(event)}`);
  facts.push(`نوع تحریری: ${editorialBucket(event)}`);
  facts.push(`دامنه: ${event.scope==='IRAN'?'ایران':event.countryFa?`مناسبت ملی ${event.countryFa}`:'جهانی'}`);
  if(event.details?.description) facts.push(`توضیح منبع تقویم: ${compactDescription(event.details.description,800)}`);
  if(event.editorialEvidence?.checkidayDescription && event.editorialEvidence.checkidayDescription!==event.details?.description) facts.push(`توضیح صفحه منبع: ${compactDescription(event.editorialEvidence.checkidayDescription,800)}`);
  if(event.editorialEvidence?.wikipediaExtract) facts.push(`خلاصه Wikipedia: ${compactDescription(event.editorialEvidence.wikipediaExtract,1000)}`);
  if(event.countryFa) facts.push(`کشور: ${event.countryFa}`);
  return facts.join('\n');
}

function applyTranslations(selected,translations){
  const map=translations instanceof Map?translations:new Map();
  const apply=e=>({...e,faName:polishFaTitle(e.name,map.get(e.id)||fallbackFaTitle(e))});
  return {...selected,iran:selected.iran.map(apply),global:selected.global.map(apply)};
}

function validateEditorialFeature(payload,candidateIds){
  const featureId=String(payload?.feature_id||'').trim();
  const headline=cleanEditorialText(payload?.headline,{singleLine:true,max:180});
  const body=cleanEditorialText(payload?.body,{singleLine:false,max:2600});
  const extra=cleanEditorialText(payload?.extra,{singleLine:false,max:500});
  if(!featureId || !candidateIds.has(featureId) || !headline || !body) return {featureId:null,headline:null,body:null,extra:null};
  const publicText=`${headline} ${body} ${extra}`;
  if(/\b(?:GPT|API|prompt|fallback|system message|AI)\b|هوش مصنوعی|پرامپت|فکت.?پک|بسته اطلاعات|طبق اطلاعات داده.?شده/i.test(publicText)) return {featureId:null,headline:null,body:null,extra:null};
  return {featureId,headline,body,extra};
}

async function writeOccasionEditorial(env,selected,candidates,iso,fetchImpl){
  const calendar=[...selected.iran,...selected.global];
  const fallbackTranslations=new Map(calendar.map(e=>[e.id,fallbackFaTitle(e)]));
  if(!env?.ARVAN_AI_API_KEY || !env?.ARVAN_AI_ENDPOINT){
    return {translations:fallbackTranslations,featureId:null,headline:null,body:null,extra:null,mode:'calendar-only',provider:'none',model:null,error:'ARVAN_AI_NOT_CONFIGURED'};
  }
  const d=displayDate(iso);
  const calendarBlock=calendar.map((e,i)=>`${i+1}. ID=${e.id} | ${e.scope==='IRAN'?'IRAN':'GLOBAL'} | ${e.name}${e.countryFa?` | ${e.countryFa}`:''}`).join('\n');
  const candidateBlock=candidates.length?candidates.map((e,i)=>`\nCANDIDATE ${i+1}\n${candidateFactPack(e)}`).join('\n'):'هیچ کاندیدای امن و مناسب برای Feature وجود ندارد.';
  const system=`تو سردبیر ارشد فارسی کانال گردشگری فلای‌یاب هستی. این پست یک ستون روزانه کوتاه است: «امروز در تقویم + یک مطلب ارزشمند برای امروز». هدف این است که مخاطب در چند ثانیه مناسبت‌های مهم روز را ببیند و اگر Feature داریم، حداقل یک چیز تازه، مفید یا قابل‌تعریف یاد بگیرد. لحن انسانی، روان، دقیق و مجله‌ای باشد؛ نه دانشنامه‌ای، نه تبلیغاتی و نه شبیه متن ماشینی. فقط از اطلاعات Fact Pack استفاده کن و هیچ واقعیت، تاریخ، عدد، نام شخص یا ادعای بیرونی نساز. ارتباط با سفر فقط وقتی طبیعی و مفید است ایجاد شود؛ ربط اجباری ممنوع است.`;
  const user=`تاریخ امروز:\n${d.solar}\n${d.gregorian}\n\nمناسبت‌های تأییدشده برای نمایش:\n${calendarBlock}\n\nکاندیداهای مجاز برای مطلب ویژه:\n${candidateBlock}\n\nوظیفه:\n1) برای تمام مناسبت‌های بخش تقویم یک عنوان فارسی طبیعی و دقیق بده. شناسه‌ها را تغییر نده.\n2) فقط از بین CANDIDATEها بهترین موضوع را برای مخاطب FlyYab انتخاب کن. معیار انتخاب: ارزش خواندن + ارتباط طبیعی با جهان سفر/فرهنگ/طبیعت/هوانوردی + کیفیت اطلاعات موجود؛ نه صرفاً رسمی یا ایرانی بودن.\n3) برای Feature یک تیتر جذاب و اختصاصی بنویس و سپس 2 تا 4 پاراگراف کوتاه، خواندنی و پرارزش تولید کن. متن باید مخصوص همان موضوع باشد؛ اگر نام مناسبت را عوض کنیم نباید برای ده مناسبت دیگر هم قابل استفاده باشد.\n4) مخاطب پس از خواندن باید حداقل یک نکته تازه بداند یا نگاه تازه‌ای پیدا کند.\n5) اگر یک نکته عملی واقعاً به موضوع می‌خورد، در extra یک خط کوتاه با یکی از ایموجی‌های 💡 ✈️ 🌿 📷 بنویس؛ در غیر این صورت extra را خالی بگذار. CTA مصنوعی نساز.\n6) اگر Fact Pack برای هیچ کاندیدایی برای یک Feature معتبر کافی نیست، feature_id/headline/body/extra را رشته خالی برگردان؛ بخش تقویم به‌تنهایی منتشر می‌شود.\n7) درباره مناسبت‌های حساس/سیاسی/سوگ که در CANDIDATEها نیستند Feature نساز.\n8) هیچ اشاره‌ای به AI، API، Prompt، Fact Pack، منبع داخلی یا فرایند تولید متن در خروجی عمومی نکن.\n\nفقط JSON معتبر با این ساختار برگردان:\n{\n  "calendar_titles":[{"id":"...","fa_name":"..."}],\n  "feature_id":"...",\n  "headline":"...",\n  "body":"...",\n  "extra":"..."\n}`;
  try{
    const result=await runArvanOccasion(env,fetchImpl,[{role:'system',content:system},{role:'user',content:user}]);
    const payload=parseAiJson(result.content);
    if(!payload) throw new Error('ARVAN_JSON_INVALID');
    const translations=new Map(fallbackTranslations);
    const allowed=new Map(calendar.map(e=>[e.id,e]));
    if(Array.isArray(payload.calendar_titles)){
      for(const item of payload.calendar_titles){
        const event=allowed.get(String(item?.id||''));
        if(!event || event.scope==='IRAN') continue; // Persian calendar titles remain source-locked.
        const fa=polishFaTitle(event.name,cleanEditorialText(item?.fa_name,{singleLine:true,max:100}));
        if(fa) translations.set(event.id,fa);
      }
    }
    const feature=validateEditorialFeature(payload,new Set(candidates.map(e=>e.id)));
    return {translations,...feature,mode:feature.featureId?'arvan-editorial':'calendar-only',provider:'ArvanCloud AIaaS',model:result.model,error:feature.featureId?null:'ARVAN_NO_USABLE_FEATURE'};
  }catch(error){
    return {translations:fallbackTranslations,featureId:null,headline:null,body:null,extra:null,mode:'calendar-only',provider:'ArvanCloud AIaaS',model:String(env.ARVAN_AI_MODEL||'GPT-4.1-Mini'),error:String(error?.message||error).slice(0,700)};
  }
}

function escapeHtml(value){return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function eventPrefix(e){
  if(e.scope==='IRAN') return '🇮🇷';
  if(e.countryFa) return e.emoji||'🌍';
  return e.emoji||emojiForName(e.name);
}

function sentenceTrim(text,max){
  const s=String(text||'').trim();
  if(s.length<=max) return s;
  const cut=s.slice(0,max);
  const points=[cut.lastIndexOf('।'),cut.lastIndexOf('.'),cut.lastIndexOf('!'),cut.lastIndexOf('؟'),cut.lastIndexOf('?'),cut.lastIndexOf('؛')];
  const i=Math.max(...points);
  return (i>Math.floor(max*.55)?cut.slice(0,i+1):cut).trim();
}

export function buildCaption(iso,selected,copy,storyEvent=null){
  const d=displayDate(iso);
  const all=[...selected.iran,...selected.global];
  const lines=['📌 <b>امروز چه روزی است؟</b>','',`🗓 ${d.solar}`,`🌍 ${d.gregorian}`,'','امروز در تقویم:'];
  for(const e of all){
    const suffix=e.countryFa&&e.scope!=='IRAN'?` — ${e.countryFa}`:'';
    lines.push(`${eventPrefix(e)} ${escapeHtml(e.faName||e.name)}${escapeHtml(suffix)}`);
  }
  const featureBody=String(copy?.storyBody||copy?.body||'').trim();
  const featureTitle=String(copy?.storyTitle||copy?.headline||'').trim();
  const extra=String(copy?.extra||'').trim();
  if(featureBody&&featureTitle&&storyEvent){
    lines.push('','━━━━━━━━━━━━━━','',`${storyEvent.emoji||emojiForName(storyEvent.faName||storyEvent.name)} <b>${escapeHtml(featureTitle)}</b>`,'',escapeHtml(featureBody));
    if(extra) lines.push('',escapeHtml(extra));
  }
  lines.push('','━━━━━━━━━━━━━━','','❤️ <b>فلای‌یاب؛ لَمس کُن، آسمان و زمین از آن توست.</b>','@FlyYab');
  let caption=lines.join('\n').trim();
  if(caption.length<=3900) return caption;

  // Telegram text messages allow 4096 characters. A too-long AI story must be
  // gracefully shortened, never turn the whole daily post into FAILED.
  const shorterBody=sentenceTrim(featureBody,Math.max(500,featureBody.length-(caption.length-3500)-120));
  const retry={...copy,storyBody:shorterBody,body:shorterBody,extra:''};
  const retryLines=['📌 <b>امروز چه روزی است؟</b>','',`🗓 ${d.solar}`,`🌍 ${d.gregorian}`,'','امروز در تقویم:'];
  for(const e of all){
    const suffix=e.countryFa&&e.scope!=='IRAN'?` — ${e.countryFa}`:'';
    retryLines.push(`${eventPrefix(e)} ${escapeHtml(e.faName||e.name)}${escapeHtml(suffix)}`);
  }
  if(retry.storyBody&&featureTitle&&storyEvent) retryLines.push('','━━━━━━━━━━━━━━','',`${storyEvent.emoji||emojiForName(storyEvent.faName||storyEvent.name)} <b>${escapeHtml(featureTitle)}</b>`,'',escapeHtml(retry.storyBody));
  retryLines.push('','━━━━━━━━━━━━━━','','❤️ <b>فلای‌یاب؛ لَمس کُن، آسمان و زمین از آن توست.</b>','@FlyYab');
  caption=retryLines.join('\n').trim();
  return caption.length<=4050?caption:caption.slice(0,4040).trim();
}

export function diagnosticSummary(pkg){
  const s=pkg?.sources||[];
  const lines=[`نسخه: ${BOT_VERSION} / ${OCCASION_VERSION}`,`تاریخ: ${pkg?.date||'—'}`,`وضعیت: ${pkg?.status||'—'}`,'','منابع:'];
  for(const x of s){
    if(x.skipped){ lines.push(`⏭️ ${x.name}: فراخوانی نشد${x.note?` | ${x.note}`:''}`); continue; }
    if(x.deferred){ lines.push(`⏳ ${x.name}: موکول شد${x.note?` | ${x.note}`:''}${x.error?` | ${String(x.error).slice(0,120)}`:''}`); continue; }
    lines.push(`${x.ok?'✅':'⚠️'} ${x.name}: ${x.count??0} رویداد${x.countriesOk!=null?` | کشورها ${x.countriesOk}/${x.countriesTotal}`:''}${x.error?` | ${String(x.error).slice(0,120)}`:''}`);
  }
  lines.push('',`خام: ${pkg?.counts?.raw??0} | تقویم: ${pkg?.counts?.selected??0} | حذف: ${pkg?.counts?.rejected??0}`);
  const storyState=pkg?.storyWriterMode==='arvan-editorial'?'✅ ARVAN_EDITORIAL':'🗓️ CALENDAR_ONLY';
  lines.push('',`تحریریه: ${storyState}`);
  lines.push(`ارائه‌دهنده: ${pkg?.storyWriterProvider||'—'}${pkg?.storyWriterModel?` | مدل: ${pkg.storyWriterModel}`:''}`);
  if(pkg?.storyWriterError) lines.push(`گزارش AI: ${String(pkg.storyWriterError).slice(0,500)}`);
  if(pkg?.selectedNames?.length) lines.push('',`تقویم امروز: ${pkg.selectedNames.join('، ')}`);
  if(pkg?.featureName) lines.push(`Feature: ${pkg.featureName}`);
  if(pkg?.topRejected?.length) lines.push('',`نمونه حذف‌شده: ${pkg.topRejected.join(' | ')}`);
  if(pkg?.reason) lines.push('',`علت: ${pkg.reason}`);
  return lines.join('\n');
}

export async function buildOccasionPackage(env, iso, { fetchImpl = fetch, includeDetail = false, useCheckiday = true, useCalendarific = true } = {}) {
  iso=validateIsoDate(iso);
  const pnl=await fetchPnlDev(fetchImpl,iso);
  const checkiday=useCheckiday ? await fetchCheckiday(fetchImpl,iso,env?.CHECKIDAY_API_KEY) : { source: sourceRecord('Checkiday', false, { deferred:true, error:'بررسی Checkiday به کنترل روز انتشار موکول شد', count:0 }), events:[] };
  const nager=await fetchNager(fetchImpl,iso);
  const calendarificCountries = useCalendarific
    ? OCCASION_COUNTRIES.filter(([code]) => nager.events.some(e => e.countryCode === code))
    : [];
  const calendarific = useCalendarific
    ? await fetchCalendarific(fetchImpl, iso, env?.CALENDARIFIC_API_KEY, calendarificCountries)
    : { source: sourceRecord('Calendarific', true, { deferred:true, count:0, countriesOk:0, countriesTotal:0, error:null, note:'تطبیق Calendarific در کنترل نهایی انجام می‌شود' }), events:[] };
  const raw=[...pnl.events,...checkiday.events,...nager.events,...calendarific.events];
  let selected=curateCalendarSelection(selectEvents(raw));
  const sourceList=[pnl.source,checkiday.source,nager.source,calendarific.source];
  if(!selected.iran.length && !selected.global.length){
    const pkg={date:iso,status:'SKIPPED',sources:sourceList,counts:{raw:raw.length,selected:0,rejected:selected.rejected.length},rawEvents:raw.slice(0,30).map(e=>({name:e.name,source:e.source,scope:e.scope,countryCode:e.countryCode||null})),selectedNames:[],topRejected:selected.rejected.slice(0,12).map(e=>`${e.name} (${e.rejectReason}/${e.score})`),decisionLog:selected.rejected.slice(0,20).map(e=>({name:e.name,source:e.source,decision:'REJECTED',reason:e.rejectReason,score:e.score})),reason:raw.length?'هیچ مناسبت از آستانه کیفیت فلای‌یاب عبور نکرد':'هیچ منبع فعالی برای این تاریخ مناسبت برنگرداند',caption:null,storyWriterMode:'calendar-only',storyWriterProvider:'none',storyWriterModel:null,storyWriterError:'NO_SELECTED_EVENT',createdAt:new Date().toISOString()};
    pkg.diagnostic=diagnosticSummary(pkg);
    return pkg;
  }

  const prelimCandidates=featureCandidates(selected,2);
  let enrichedCandidates=prelimCandidates;
  if(env?.ARVAN_AI_API_KEY && env?.ARVAN_AI_ENDPOINT && prelimCandidates.length){
    enrichedCandidates=await Promise.all(prelimCandidates.map(e=>enrichFeatureCandidate(fetchImpl,e)));
  }
  const editorial=await writeOccasionEditorial(env,selected,enrichedCandidates,iso,fetchImpl);
  selected=applyTranslations(selected,editorial.translations);
  const selectedFlat=[...selected.iran,...selected.global];
  const story=editorial.featureId?selectedFlat.find(e=>e.id===editorial.featureId)||null:null;
  const storyCopy={storyTitle:editorial.headline,storyBody:editorial.body,extra:editorial.extra,storyMode:editorial.mode,storyProvider:editorial.provider,storyModel:editorial.model,storyError:editorial.error};
  const caption=buildCaption(iso,selected,storyCopy,story);
  const decisionLog=[
    ...selectedFlat.map(e=>({name:e.faName||e.name,source:e.source,decision:e.id===story?.id?'FEATURE':'CALENDAR',reason:e.id===story?.id?'برگزیده تحریریه Arvan GPT-4.1 Mini از میان کاندیداهای امن':'نمایش در تقویم روز',score:e.score,sensitive:isSensitiveEvent(e),bucket:editorialBucket(e)})),
    ...selected.rejected.slice(0,20).map(e=>({name:e.name,source:e.source,decision:'REJECTED',reason:e.rejectReason,score:e.score}))
  ];
  const pkg={date:iso,status:'READY',sources:sourceList,counts:{raw:raw.length,selected:selectedFlat.length,rejected:selected.rejected.length},rawEvents:raw.slice(0,30).map(e=>({name:e.name,source:e.source,scope:e.scope,countryCode:e.countryCode||null})),selected:{iran:selected.iran,global:selected.global},selectedNames:selectedFlat.map(e=>e.faName||e.name),topRejected:selected.rejected.slice(0,12).map(e=>`${e.name} (${e.rejectReason}/${e.score})`),decisionLog,storyEventId:story?.id||null,featureName:story?(story.faName||story.name):null,writerMode:editorial.mode,storyWriterMode:editorial.mode,storyWriterProvider:editorial.provider,storyWriterModel:editorial.model,storyWriterError:editorial.error,caption,createdAt:new Date().toISOString(),reason:null};
  pkg.diagnostic=diagnosticSummary(pkg);
  return pkg;
}
