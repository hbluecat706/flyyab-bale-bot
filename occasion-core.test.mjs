import assert from 'node:assert/strict';
import {
  BOT_VERSION,OCCASION_VERSION,cleanCommandArg,resolveOccasionDate,displayDate,scoreEvent,selectEvents,dedupeEvents,chooseStoryEvent,buildCaption,buildOccasionPackage,emojiForName,polishFaTitle,currentTehranIso
} from './occasion-core.mjs';

function response(data,status=200,headers={}){
  return new Response(typeof data==='string'?data:JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
}

const today=currentTehranIso(new Date());
const [ty,tm,td]=today.split('-');
const checkidayToday=`${tm}/${td}/${ty}`;
const checkidayEvents=[
  {id:'vlog',name:'International Vlogging Day',url:'https://www.checkiday.com/vlog'},
  {id:'lazy',name:'National Lazy Day',url:'https://www.checkiday.com/lazy'},
  {id:'smores',name:"National S'mores Day",url:'https://www.checkiday.com/smores'},
  {id:'lion',name:'World Lion Day',url:'https://www.checkiday.com/lion'}
];

const baseFetch=async (url)=>{
  const u=String(url);
  if(u.startsWith('https://pnldev.com/api/calender')) return response({status:true,result:{solar:{day:19,month:5,year:1405},holiday:false,event:[]}});
  if(u.startsWith('https://api.apilayer.com/checkiday/events')) return response({timezone:'America/Chicago',date:checkidayToday,events:checkidayEvents,multiday_starting:[],multiday_ongoing:[]},200,{'x-ratelimit-remaining-month':'88'});
  if(u.startsWith('https://nagerholidays.com/api/v4/Holidays/')) return response([]);
  if(u.startsWith('https://calendarific.com/api/v2/holidays')) return response({meta:{code:200},response:{holidays:[]}});
  throw new Error('Unexpected URL '+u);
};

assert.equal(BOT_VERSION,'6.9.1');
assert.equal(OCCASION_VERSION,'occasion-v4.0-arvan-editorial-calendar');
assert.equal(cleanCommandArg('\u200f   '),'');
assert.equal(resolveOccasionDate('',new Date('2026-08-10T12:00:00Z')),'2026-08-10');
assert.equal(resolveOccasionDate('2026-08-11',new Date()),'2026-08-11');
assert.equal(displayDate('2026-08-10').solar,'دوشنبه، ۱۹ مرداد ۱۴۰۵');
assert.ok(scoreEvent({scope:'GLOBAL',name:'World Lion Day',category:'GLOBAL_OBSERVANCE'})>=35);
assert.ok(scoreEvent({scope:'GLOBAL',name:'National Lazy Day',category:'GLOBAL_OBSERVANCE'})<35);
assert.equal(emojiForName('World Photography Day'),'📷');
assert.equal(polishFaTitle('International Vlogging Day','روز بین المللی ولوگینگ'),'روز بین‌المللی ولاگ‌نویسی');

const selection=selectEvents(checkidayEvents.map(x=>({id:x.id,name:x.name,scope:'GLOBAL',category:'GLOBAL_OBSERVANCE',confidence:90,source:'Checkiday'})));
assert.deepEqual(selection.global.map(x=>x.name),['World Lion Day','International Vlogging Day']);
assert.ok(selection.rejected.some(x=>x.name==='National Lazy Day'));

// Without Arvan configured, the package must still publish a clean calendar.
// It must never invent generic filler paragraphs.
const noAiEnv={CHECKIDAY_API_KEY:'test',CALENDARIFIC_API_KEY:'test'};
const calendarOnly=await buildOccasionPackage(noAiEnv,today,{fetchImpl:baseFetch});
assert.equal(calendarOnly.status,'READY');
assert.equal(calendarOnly.storyWriterMode,'calendar-only');
assert.equal(calendarOnly.counts.selected,2);
assert.ok(calendarOnly.caption.startsWith('📌 <b>امروز چه روزی است؟</b>'));
assert.ok(calendarOnly.caption.includes('امروز در تقویم:'));
assert.ok(calendarOnly.caption.includes('🦁 روز جهانی شیر'));
assert.ok(calendarOnly.caption.includes('🎥 روز بین‌المللی ولاگ‌نویسی'));
assert.ok(!calendarOnly.caption.includes('فرصتی برای توجه'));
assert.ok(!calendarOnly.caption.includes('در میان مناسبت‌های منتخب'));
assert.ok(calendarOnly.diagnostic.includes('CALENDAR_ONLY'));

// Arvan is a single editorial call: translate titles + choose feature + write it.
let arvanCalls=0;
let arvanPrompt='';
const arvanEnv={
  CHECKIDAY_API_KEY:'test',CALENDARIFIC_API_KEY:'test',
  ARVAN_AI_API_KEY:'apikey test-key',
  ARVAN_AI_ENDPOINT:'https://arvan.example/v1'
};
const arvanFetch=async (url,opts={})=>{
  const u=String(url);
  if(u.startsWith('https://pnldev.com/')) return response({status:true,result:{event:[]}});
  if(u.startsWith('https://api.apilayer.com/checkiday/events')) return response({date:checkidayToday,events:checkidayEvents,multiday_starting:[],multiday_ongoing:[]});
  if(u.startsWith('https://nagerholidays.com/')) return response([]);
  if(u.startsWith('https://calendarific.com/')) return response({meta:{code:200},response:{holidays:[]}});
  if(u==='https://www.checkiday.com/lion') return new Response('<html><head><meta name="description" content="World Lion Day raises awareness of lion conservation and the pressures facing wild lion populations."></head></html>',{status:200,headers:{'content-type':'text/html'}});
  if(u==='https://www.checkiday.com/vlog') return new Response('<html><head><meta name="description" content="International Vlogging Day celebrates video blogging and people who tell stories through video."></head></html>',{status:200,headers:{'content-type':'text/html'}});
  if(u.startsWith('https://en.wikipedia.org/api/rest_v1/page/summary/World_Lion_Day')) return response({title:'World Lion Day',extract:'World Lion Day is an annual observance that raises awareness of lions and conservation issues affecting them.',content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/World_Lion_Day'}}});
  if(u.startsWith('https://en.wikipedia.org/api/rest_v1/page/summary/International_Vlogging_Day')) return response({},404);
  if(u.startsWith('https://en.wikipedia.org/w/api.php')) return response({query:{search:[]}});
  if(u==='https://arvan.example/v1/chat/completions'){
    arvanCalls++;
    const body=JSON.parse(opts.body);
    arvanPrompt=body.messages.at(-1).content;
    return response({choices:[{message:{content:JSON.stringify({
      calendar_titles:[{id:'checkiday-lion',fa_name:'روز جهانی شیر'},{id:'checkiday-vlog',fa_name:'روز بین‌المللی ولاگ‌نویسی'}],
      feature_id:'checkiday-lion',
      headline:'روز جهانی شیر | دیدن حیات‌وحش فقط تماشا نیست',
      body:'شیرها فقط سوژه‌ای تماشایی برای عکس‌های سفر نیستند؛ بقای آن‌ها به سلامت زیستگاه و کاهش فشارهای انسانی وابسته است. همین نگاه، تفاوت میان تماشای حیات‌وحش و تجربه مسئولانه آن را روشن می‌کند.\n\nاگر مقصدی را برای دیدن جانوران انتخاب می‌کنیم، ارزش سفر فقط در نزدیک‌شدن بیشتر نیست؛ احترام به فاصله، زیستگاه و رفتار طبیعی حیوان بخشی از همان تجربه است.',
      extra:'🌿 در طبیعت، کمترین مزاحمت معمولاً بهترین ردپای مسافر است.'
    })}}]});
  }
  throw new Error('Unexpected URL '+u);
};
const arvanPkg=await buildOccasionPackage(arvanEnv,today,{fetchImpl:arvanFetch});
assert.equal(arvanCalls,1);
assert.ok(arvanPrompt.includes('خلاصه Wikipedia'));
assert.equal(arvanPkg.storyWriterMode,'arvan-editorial');
assert.equal(arvanPkg.storyWriterProvider,'ArvanCloud AIaaS');
assert.equal(arvanPkg.storyEventId,'checkiday-lion');
assert.ok(arvanPkg.caption.includes('دیدن حیات‌وحش فقط تماشا نیست'));
assert.ok(arvanPkg.caption.includes('احترام به فاصله'));
assert.ok(arvanPkg.diagnostic.includes('ARVAN_EDITORIAL'));

// Real target scenario: sensitive Iranian history stays in the calendar, while
// World Photography Day is the only safe editorial candidate.
let photographyPrompt='';
const mordadFetch=async (url,opts={})=>{
  const u=String(url);
  if(u.startsWith('https://pnldev.com/')) return response({status:true,result:{event:['سالروز فاجعه آتش زدن سینما رکس آبادان','سالروز وقایع 28 مرداد پس از برکناری محمد مصدق‌السلطنه']}});
  if(u.startsWith('https://api.apilayer.com/checkiday/events')) return response({date:checkidayToday,events:[{id:'photo',name:'World Photography Day',url:'https://www.checkiday.com/photo'}],multiday_starting:[],multiday_ongoing:[]});
  if(u.startsWith('https://nagerholidays.com/')) return response([]);
  if(u.startsWith('https://calendarific.com/')) return response({meta:{code:200},response:{holidays:[]}});
  if(u==='https://www.checkiday.com/photo') return new Response('<meta name="description" content="World Photography Day is a global observance celebrating photography, photographers, and visual storytelling.">',{status:200});
  if(u.startsWith('https://en.wikipedia.org/api/rest_v1/page/summary/World_Photography_Day')) return response({title:'World Photography Day',extract:'World Photography Day is an annual worldwide celebration of the art, craft, science and history of photography.',content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/World_Photography_Day'}}});
  if(u==='https://arvan.example/v1/chat/completions'){
    const body=JSON.parse(opts.body); photographyPrompt=body.messages.at(-1).content;
    return response({choices:[{message:{content:JSON.stringify({
      calendar_titles:[
        {id:`iran-${today}-0`,fa_name:'سالروز فاجعه آتش‌سوزی سینما رکس آبادان'},
        {id:`iran-${today}-1`,fa_name:'سالروز رویدادهای ۲۸ مرداد'},
        {id:'checkiday-photo',fa_name:'روز جهانی عکاسی'}
      ],
      feature_id:'checkiday-photo',
      headline:'روز جهانی عکاسی | قاب خوب چه چیزی درباره مقصد می‌گوید؟',
      body:'عکس سفر فقط مدرکی برای «من اینجا بودم» نیست. یک قاب خوب می‌تواند چیزی از نور، آدم‌ها، معماری یا ریتم زندگی مقصد را ثبت کند؛ جزئیاتی که شاید چند سال بعد از خود مسیر سفر هم ماندگارتر بمانند.\n\nبرای همین گاهی عکس یک بازار محلی، دست‌های یک صنعتگر یا یک خیابان معمولی بیشتر از نمای کارت‌پستالی درباره جایی که دیده‌ایم حرف می‌زند.',
      extra:'📷 پیش از فشردن شاتر بپرسید: این قاب چه چیزی درباره اینجا تعریف می‌کند؟'
    })}}]});
  }
  throw new Error('Unexpected '+u);
};
const mordadPkg=await buildOccasionPackage(arvanEnv,today,{fetchImpl:mordadFetch});
assert.equal(mordadPkg.storyEventId,'checkiday-photo');
assert.ok(mordadPkg.caption.includes('سینما رکس آبادان'));
assert.ok(mordadPkg.caption.includes('وقایع 28 مرداد')); // Iranian source title stays source-locked.
assert.ok(mordadPkg.caption.includes('روز جهانی عکاسی'));
assert.ok(mordadPkg.caption.includes('قاب خوب چه چیزی درباره مقصد می‌گوید'));
assert.ok(!photographyPrompt.includes('CANDIDATE 2\nشناسه: iran-'),'sensitive Iranian events must not be offered as feature candidates');

// If Arvan is unavailable, the verified calendar survives and no filler story is created.
const arvanDownFetch=async (url,opts={})=>{
  const u=String(url);
  if(u.startsWith('https://pnldev.com/')) return response({status:true,result:{event:[]}});
  if(u.startsWith('https://api.apilayer.com/checkiday/events')) return response({date:checkidayToday,events:[{id:'photo',name:'World Photography Day'}],multiday_starting:[]});
  if(u.startsWith('https://nagerholidays.com/')) return response([]);
  if(u.startsWith('https://calendarific.com/')) return response({meta:{code:200},response:{holidays:[]}});
  if(u.startsWith('https://en.wikipedia.org/')) return response({},404);
  if(u.startsWith('https://arvan.example/')) return response({error:{message:'down'}},503);
  throw new Error('Unexpected '+u);
};
const downPkg=await buildOccasionPackage(arvanEnv,today,{fetchImpl:arvanDownFetch});
assert.equal(downPkg.status,'READY');
assert.equal(downPkg.storyWriterMode,'calendar-only');
assert.ok(downPkg.caption.includes('روز جهانی عکاسی'));
assert.ok(!downPkg.caption.includes('فرصتی برای'));
assert.match(downPkg.storyWriterError,/ARVAN_HTTP_503/);

// Sensitive-only day: list it once, no AI feature.
const onlySensitiveFetch=async (url)=>{
  const u=String(url);
  if(u.startsWith('https://pnldev.com/')) return response({status:true,result:{event:['شهادت امام رضا علیه السلام [ ٣٠ صفر ]']}});
  if(u.startsWith('https://api.apilayer.com/checkiday/events')) return response({date:checkidayToday,events:[],multiday_starting:[]});
  if(u.startsWith('https://nagerholidays.com/')) return response([]);
  if(u.startsWith('https://calendarific.com/')) return response({meta:{code:200},response:{holidays:[]}});
  throw new Error('Unexpected '+u);
};
const sensitivePkg=await buildOccasionPackage(arvanEnv,today,{fetchImpl:onlySensitiveFetch});
assert.equal(sensitivePkg.storyWriterMode,'calendar-only');
assert.equal((sensitivePkg.caption.match(/شهادت امام رضا \(ع\)/g)||[]).length,1);
assert.ok(!sensitivePkg.caption.includes('Feature'));

// Calendar stays compact: at most two Iran + two global rows.
const manyFetch=async (url)=>{
  const u=String(url);
  if(u.startsWith('https://pnldev.com/')) return response({status:true,result:{event:['روز ملی صنایع دستی','روز ملی ادبیات','روز ملی میراث سوم']}});
  if(u.startsWith('https://api.apilayer.com/checkiday/events')) return response({date:checkidayToday,events:[
    {id:'lion',name:'World Lion Day'},{id:'tourism',name:'World Tourism Day'},{id:'photo',name:'World Photography Day'}
  ],multiday_starting:[]});
  if(u.startsWith('https://nagerholidays.com/')) return response([]);
  if(u.startsWith('https://calendarific.com/')) return response({meta:{code:200},response:{holidays:[]}});
  throw new Error('Unexpected '+u);
};
const compactPkg=await buildOccasionPackage(noAiEnv,today,{fetchImpl:manyFetch});
assert.equal(compactPkg.counts.selected,4);
assert.equal(compactPkg.selected.iran.length,2);
assert.equal(compactPkg.selected.global.length,2);

// A very long AI body is gracefully fitted under Telegram sendMessage limits.
const selectedForFit={iran:[],global:[{id:'g',name:'World Photography Day',faName:'روز جهانی عکاسی',scope:'GLOBAL',emoji:'📷'}]};
const longBody=('این جمله درباره عکاسی و نگاه دقیق به مقصد است. ').repeat(180);
const fitted=buildCaption(today,selectedForFit,{headline:'روز جهانی عکاسی | نگاه تازه به سفر',body:longBody,extra:'💡 نکته کوتاه'},{id:'g',name:'World Photography Day',faName:'روز جهانی عکاسی',scope:'GLOBAL',emoji:'📷'});
assert.ok(fitted.length<=4050);
assert.ok(fitted.includes('@FlyYab'));

// No-event path.
const noEventFetch=async (url)=>{
  const u=String(url);
  if(u.startsWith('https://pnldev.com/')) return response({status:true,result:{event:[]}});
  if(u.startsWith('https://api.apilayer.com/checkiday/events')) return response({events:[],multiday_starting:[]});
  if(u.startsWith('https://nagerholidays.com/')) return response([]);
  if(u.startsWith('https://calendarific.com/')) return response({meta:{code:200},response:{holidays:[]}});
  throw new Error('Unexpected '+u);
};
const skipped=await buildOccasionPackage(noAiEnv,today,{fetchImpl:noEventFetch});
assert.equal(skipped.status,'SKIPPED');
assert.equal(skipped.caption,null);

// Future-date Checkiday is deferred on Free/Starter.
let futureCheckidayCalls=0;
const futureFetch=async (url)=>{
  const u=String(url);
  if(u.startsWith('https://api.apilayer.com/checkiday/')){futureCheckidayCalls++;throw new Error('must defer');}
  if(u.startsWith('https://pnldev.com/')) return response({status:true,result:{event:[]}});
  if(u.startsWith('https://nagerholidays.com/')) return response([]);
  if(u.startsWith('https://calendarific.com/')) return response({meta:{code:200},response:{holidays:[]}});
  throw new Error('Unexpected '+u);
};
const futureIso=currentTehranIso(new Date(Date.now()+2*86400000));
const futurePkg=await buildOccasionPackage(noAiEnv,futureIso,{fetchImpl:futureFetch});
assert.equal(futureCheckidayCalls,0);
assert.equal(futurePkg.sources.find(x=>x.name==='Checkiday')?.deferred,true);

// Independent source corroboration is preserved.
const corroborated=dedupeEvents([
  {id:'n1',name:'Independence Day',scope:'GLOBAL',category:'NATIONAL_HOLIDAY',confidence:94,source:'Nager.Holidays',countryCode:'IN'},
  {id:'c1',name:'Independence Day',scope:'GLOBAL',category:'NATIONAL_HOLIDAY',confidence:91,source:'Calendarific',countryCode:'IN'}
]);
assert.equal(corroborated.length,1);
assert.deepEqual(new Set(corroborated[0].verifiedBy),new Set(['Nager.Holidays','Calendarific']));
assert.equal(corroborated[0].confidence,98);

// Sensitive events are never selected as deterministic editorial candidates.
const sensitiveSelection={iran:[{id:'ir',name:'سالروز کودتا',faName:'سالروز کودتا',scope:'IRAN',score:100}],global:[{id:'p',name:'World Photography Day',faName:'روز جهانی عکاسی',scope:'GLOBAL',score:70}]};
assert.equal(chooseStoryEvent(sensitiveSelection)?.id,'p');

console.log('occasion v4 editorial tests: ok',BOT_VERSION,OCCASION_VERSION);
