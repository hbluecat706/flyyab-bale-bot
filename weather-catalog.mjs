import { NIGHT_DESTINATIONS } from './night-destination-catalog.mjs';

export const WEATHER_CATALOG_VERSION = 'iran-weather-destinations-v1.1-20260818';

const EXTRA = [
['چلگرد','Chelgerd Iran','CITY'],['فشم','Fasham Iran','CITY'],['میگون','Meygun Iran','CITY'],['اشترانکوه','Oshtorankuh','NATURE'],['کوه دنا','Dena Mountain','NATURE'],['دریاچه نئور','Neor Lake','NATURE'],['دریاچه تار','Tar Lake Iran','NATURE'],['دریاچه هویر','Havir Lake','NATURE'],['افجه','Afjeh Iran','VILLAGE'],['شهرستانک','Shahrestanak Iran','VILLAGE'],['وردیج','Vardij Iran','VILLAGE'],['واریش','Varish Iran','VILLAGE'],
['کرج','Karaj','CITY'],['طالقان','Taleqan','NATURE'],['برغان','Baraghan','VILLAGE'],['آسارا','Asara Iran','NATURE'],['دیزین','Dizin','NATURE'],['گچسر','Gachsar','NATURE'],
['ری','Ray Iran','HERITAGE'],['ورامین','Varamin','CITY'],['فیروزکوه','Firuzkuh Iran','CITY'],['پردیس','Pardis Iran','CITY'],
['چالوس','Chalus Iran','CITY'],['نوشهر','Nowshahr','CITY'],['نمک‌آبرود','Namak Abrud','NATURE'],['تنکابن','Tonekabon','CITY'],['عباس‌آباد','Abbasabad Mazandaran','CITY'],['سلمان‌شهر','Salman Shahr','CITY'],['محمودآباد','Mahmudabad Mazandaran','CITY'],['بابلسر','Babolsar','CITY'],['آمل','Amol','CITY'],['بابل','Babol','CITY'],['بهشهر','Behshahr','CITY'],['سوادکوه','Savadkuh','NATURE'],['پل سفید','Pol Sefid','CITY'],['آلاشت','Alasht','VILLAGE'],['جواهرده','Javaher Deh','VILLAGE'],['پارک جنگلی سیسنگان','Sisangan Forest Park','NATURE'],['دریاچه الیمالات','Elimalat Lake','NATURE'],['جنگل لفور','Lafur Forest','NATURE'],['کیاسر','Kiasar','CITY'],
['رودسر','Rudsar','CITY'],['لنگرود','Langarud','CITY'],['املش','Amlash','CITY'],['سیاهکل','Siahkal','CITY'],['دیلمان','Deylaman','NATURE'],['رودبار','Rudbar Gilan','CITY'],['منجیل','Manjil','CITY'],['شاندرمن','Shanderman','NATURE'],['اسالم','Asalem','CITY'],['پره‌سر','Pareh Sar','CITY'],
['گنبد کاووس','Gonbad-e Kavus','CITY'],['مینودشت','Minudasht','CITY'],['آزادشهر','Azadshahr Golestan','CITY'],['کردکوی','Kordkuy','CITY'],['بندر ترکمن','Bandar Torkaman','CITY'],['جزیره آشوراده','Ashuradeh','ISLAND'],['ناهارخوران','Nahar Khoran','NATURE'],['جهان‌نما','Jahan Nama Golestan','NATURE'],
['خلخال','Khalkhal Iran','CITY'],['نمین','Namin Iran','CITY'],['نیر','Nir Ardabil','CITY'],['کوثر','Kowsar Ardabil','CITY'],['هیر','Hir Ardabil','CITY'],['شابیل','Shabil Iran','NATURE'],
['اسکو','Osku Iran','CITY'],['آذرشهر','Azarshahr','CITY'],['سهند','Sahand Iran','CITY'],['شبستر','Shabestar','CITY'],['مرند','Marand','CITY'],['هوراند','Hurand','CITY'],['خداآفرین','Khoda Afarin County','NATURE'],['آسیاب خرابه','Asiab Kharabeh','NATURE'],
['خوی','Khoy','CITY'],['ماکو','Maku Iran','CITY'],['چالدران','Chaldoran','CITY'],['اشنویه','Oshnavieh','CITY'],['پیرانشهر','Piranshahr','CITY'],['سردشت','Sardasht West Azerbaijan','CITY'],
['بانه','Baneh','CITY'],['سقز','Saqqez','CITY'],['کامیاران','Kamyaran','CITY'],['دیواندره','Divandarreh','CITY'],['سروآباد','Sarvabad','CITY'],['هورامان تخت','Uraman Takht','VILLAGE'],
['جوانرود','Javanrud','CITY'],['روانسر','Ravansar','CITY'],['سرپل ذهاب','Sarpol-e Zahab','CITY'],['قصر شیرین','Qasr-e Shirin','CITY'],['صحنه','Sahneh Iran','CITY'],['هرسین','Harsin','CITY'],['گیلانغرب','Gilan-e Gharb','CITY'],
['مهران','Mehran Iran','CITY'],['دره‌شهر','Darreh Shahr','CITY'],['آبدانان','Abdanan','CITY'],['ایوان','Eyvan Iran','CITY'],['دهلران','Dehloran','CITY'],
['بروجرد','Borujerd','CITY'],['الیگودرز','Aligudarz','CITY'],['دورود','Dorud','CITY'],['ازنا','Azna','CITY'],['الشتر','Aleshtar','CITY'],['نورآباد لرستان','Nurabad Lorestan','CITY'],['کوهدشت','Kuhdasht','CITY'],
['نهاوند','Nahavand','CITY'],['کبودرآهنگ','Kabudarahang','CITY'],['اسدآباد','Asadabad Hamadan','CITY'],['لالجین','Lalejin','CITY'],
['ابهر','Abhar','CITY'],['خرمدره','Khorramdarreh','CITY'],['ماهنشان','Mahneshan','CITY'],
['تاکستان','Takestan','CITY'],['بوئین‌زهرا','Buin Zahra','CITY'],['آوج','Avaj','CITY'],
['اراک','Arak Iran','CITY'],['تفرش','Tafresh','CITY'],['خمین','Khomeyn','CITY'],['دلیجان','Delijan','CITY'],['شازند','Shazand','CITY'],
['قم','Qom','CITY'],['کهک','Kahak Qom','CITY'],
['سمنان','Semnan Iran','CITY'],['مهدی‌شهر','Mehdishahr','CITY'],['گرمسار','Garmsar','CITY'],['ایوانکی','Eyvanekey','CITY'],['بسطام','Bastam Iran','HERITAGE'],['مجن','Mojen','CITY'],['کالپوش','Kalpoosh','NATURE'],
['اسفراین','Esfarayen','CITY'],['شیروان','Shirvan North Khorasan','CITY'],['فاروج','Faruj','CITY'],
['طرقبه','Torqabeh','CITY'],['شاندیز','Shandiz','CITY'],['قوچان','Quchan','CITY'],['درگز','Dargaz','CITY'],['کلات نادری','Kalat Razavi Khorasan','CITY'],['فریمان','Fariman','CITY'],['تربت جام','Torbat-e Jam','CITY'],['تایباد','Taybad','CITY'],
['فردوس','Ferdows Iran','CITY'],['قائن','Qaen','CITY'],['نهبندان','Nehbandan','CITY'],['بشرویه','Boshruyeh','CITY'],['سربیشه','Sarbisheh','CITY'],
['گلپایگان','Golpayegan','CITY'],['نجف‌آباد','Najafabad','CITY'],['شهرضا','Shahreza','CITY'],['سمیرم','Semirom','CITY'],['فریدون‌شهر','Fereydunshahr','CITY'],['چادگان','Chadegan','CITY'],['داران','Daran Iran','CITY'],
['اردکان','Ardakan Yazd','CITY'],['تفت','Taft Iran','CITY'],['مهریز','Mehriz','CITY'],['بافق','Bafq','CITY'],['ابرکوه','Abarkuh','CITY'],['زارچ','Zarch','CITY'],
['رفسنجان','Rafsanjan','CITY'],['سیرجان','Sirjan','CITY'],['جیرفت','Jiroft','CITY'],['بافت','Baft Iran','CITY'],['راین','Rayen Iran','CITY'],['ماهان','Mahan Iran','CITY'],['شهداد','Shahdad','CITY'],['لاله‌زار','Lalehzar','NATURE'],
['مرودشت','Marvdasht','CITY'],['سپیدان','Sepidan','CITY'],['اقلید','Eqlid','CITY'],['آباده','Abadeh','CITY'],['نی‌ریز','Neyriz','CITY'],['فیروزآباد','Firuzabad Fars','CITY'],['جهرم','Jahrom','CITY'],['داراب','Darab','CITY'],['استهبان','Estahban','CITY'],['نورآباد ممسنی','Nurabad Mamasani','CITY'],
['سی‌سخت','Sisakht','CITY'],['دهدشت','Dehdasht','CITY'],['لنده','Lendeh','CITY'],['چرام','Charam','CITY'],
['کوهرنگ','Kuhrang','NATURE'],['بروجن','Borujen','CITY'],['سامان','Saman Iran','CITY'],['فارسان','Farsan','CITY'],
['اندیمشک','Andimeshk','CITY'],['شادگان','Shadegan','CITY'],['هویزه','Hoveyzeh','CITY'],['سوسنگرد','Susangerd','CITY'],['رامهرمز','Ramhormoz','CITY'],['ایذه','Izeh','CITY'],['لالی','Lali Khuzestan','CITY'],['باغملک','Baghmalek','CITY'],
['گناوه','Ganaveh','CITY'],['دیلم','Deylam Bushehr','CITY'],['کنگان','Kangan Iran','CITY'],['عسلویه','Asaluyeh','CITY'],['بندر دیر','Dayyer','CITY'],['جم','Jam Iran','CITY'],['خورموج','Khormuj','CITY'],
['بندر خمیر','Bandar Khamir','CITY'],['پارسیان','Parsian Hormozgan','CITY'],['بستک','Bastak','CITY'],['حاجی‌آباد هرمزگان','Hajiabad Hormozgan','CITY'],['جاسک','Jask','CITY'],['سیریک','Sirik','CITY'],['ابوموسی','Abu Musa Island','ISLAND'],['جزیره سیری','Siri Island','ISLAND'],
['زابل','Zabol','CITY'],['ایرانشهر','Iranshahr Iran','CITY'],['سراوان','Saravan Iran','CITY'],['خاش','Khash Iran','CITY'],['کنارک','Konarak','CITY'],['نیک‌شهر','Nik Shahr','CITY'],
['تنگه واشی','Tangeh Vashi','NATURE'],['آبشار گزو','Gazou Waterfall','NATURE'],['دریاچه ولشت','Valasht Lake','NATURE'],['دریاچه چورت','Churat Lake','NATURE'],['روستای یوش','Yush Iran','VILLAGE'],['روستای کندوان','Kandovan East Azerbaijan','VILLAGE'],['روستای سرآقاسید','Sar Aqa Seyyed','VILLAGE'],['تالاب چغاخور','Choghakhor Wetland','NATURE'],['تالاب گندمان','Gandoman Wetland','NATURE'],['دریاچه پریشان','Parishan Lake','NATURE'],['دریاچه مهارلو','Maharloo Lake','NATURE'],['تنگه تامرادی','Tang-e Tamoradi','NATURE'],['دریاچه سد دز','Dez Dam Lake','NATURE'],['کوهستان الوند','Alvand Mountain','NATURE'],['غار قوری‌قلعه','Quri Qaleh Cave','NATURE'],['سراب نیلوفر','Niloufar Lake Kermanshah','NATURE'],['پارک ملی تندوره','Tandoureh National Park','NATURE'],['دره شمخال','Shamkhal Valley','NATURE'],['کوه بینالود','Binalud Mountain','NATURE'],['آبشار اخلمد','Akhlamad Waterfall','NATURE'],['کوه هزار','Hezar Mountain','NATURE'],['کوه لاله‌زار','Laleh Zar Mountain','NATURE'],['کلوت شهداد','Shahdad Kaluts','NATURE'],['کویر شهداد','Shahdad Desert','NATURE'],['ریگ جن','Rig-e Jenn','NATURE'],['کویر کاراکال','Caracal Desert Iran','NATURE'],['کویر حلوان','Halvan Desert','NATURE'],['ساحل گواتر','Gwadar Bay Iran','NATURE'],['خلیج گواتر','Gwatar Bay','NATURE'],['کوه‌های مریخی چابهار','Martian Mountains Chabahar','NATURE'],['تالاب لیپار','Lipar Wetland','NATURE'],['ساحل رمین','Ramin Beach Iran','NATURE']
];

const SEEDED = {
  Mashhad:[36.2605,59.6168], Shiraz:[29.5918,52.5837], Isfahan:[32.6546,51.6680], Tabriz:[38.0800,46.2919], Ahvaz:[31.3183,48.6706],
  'Bandar Abbas':[27.1832,56.2666], 'Kish Island':[26.5320,53.9800], 'Qeshm Island':[26.9581,56.2719], Rasht:[37.2808,49.5832], 'Sari Iran':[36.5633,53.0601],
  Gorgan:[36.8427,54.4439], Ardabil:[38.2498,48.2933], Urmia:[37.5527,45.0761], Kermanshah:[34.3142,47.0650], Sanandaj:[35.3219,46.9862], Hamedan:[34.7992,48.5146],
  Yazd:[31.8974,54.3569], Kerman:[30.2839,57.0834], Chabahar:[25.2919,60.6430], Bushehr:[28.9234,50.8203], Khorramabad:[33.4878,48.3558], Tehran:[35.6892,51.3890]
};

function slug(value='') { return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function profileFor(item){
  const text=`${item.name||''} ${item.query||''} ${item.type||''}`;
  if (/island|جزیره|beach|coast|bay|ساحل|خلیج|بندر/i.test(text)) return 'COAST_ISLAND';
  if (/desert|کویر|کلوت|ریگ/i.test(text)) return 'DESERT';
  if (/mount|mountain|کوه|اشترانکوه|چلگرد|chelgerd|سرعین|sarein|سی[‌-]?سخت|sisakht|فشم|fasham|میگون|meygun|دیزین|شمشک|کوهرنگ|سبلان|دماوند|تفتان|الوند|بینالود/i.test(text)) return 'MOUNTAIN';
  if (/(NATURE|VILLAGE|SCENIC_ROUTE|جنگل|آبشار|دریاچه|تالاب|دره|تنگه|پارک ملی)/i.test(text)) return 'NATURE';
  if (/HERITAGE/i.test(item.type||'')) return 'HERITAGE';
  return 'CITY';
}

const base = NIGHT_DESTINATIONS.filter(x=>x.scope==='IRAN' && x.status!=='DISABLED').map((x,i)=>({
  id:`weather:${x.id || slug(x.query)||i}`,
  name:x.name,
  query:String(x.query||'').replace(/\s+Iran$/i,''),
  type:x.type||'CITY',
  profile:profileFor(x),
  tier:x.tier||'B',
  source:'night-destination-catalog',
  ...(SEEDED[String(x.query||'').replace(/\s+Iran$/i,'')] ? {lat:SEEDED[String(x.query||'').replace(/\s+Iran$/i,'')][0],lon:SEEDED[String(x.query||'').replace(/\s+Iran$/i,'')][1]} : {})
}));
const extra = EXTRA.map((x,i)=>({id:`weather:extra:${String(i+1).padStart(3,'0')}-${slug(x[1])}`,name:x[0],query:x[1],type:x[2],profile:profileFor({name:x[0],query:x[1],type:x[2]}),tier:'C',source:'weather-extra'}));
const map = new Map();
for (const item of [...base,...extra]) {
  const key=`${item.name}|${item.query}`.replace(/\s+/g,' ').trim().toLowerCase();
  if (!map.has(key)) map.set(key,item);
}
export const IRAN_WEATHER_DESTINATIONS = Object.freeze([...map.values()]);
export function weatherCatalogStats(){
  const byProfile={}; const byType={};
  for(const x of IRAN_WEATHER_DESTINATIONS){byProfile[x.profile]=(byProfile[x.profile]||0)+1;byType[x.type]=(byType[x.type]||0)+1;}
  return {version:WEATHER_CATALOG_VERSION,total:IRAN_WEATHER_DESTINATIONS.length,seeded:IRAN_WEATHER_DESTINATIONS.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)).length,byProfile,byType};
}
