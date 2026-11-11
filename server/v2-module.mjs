// MATH-DIAGNOZ v2.0 feature routes. No changes to the existing v1.7 data tables.
// AI requires an explicit server-side API key. Without one, we disclose demo mode.
import { get, all, run, getClient } from './postgres-db.mjs'
import { createHash } from 'node:crypto'

const PROGRAMS = {
 PISA: {title:'PISA tayyorgarligi', audience:'15 yoshli o‘quvchilar; 5–9-sinfda moslashtirilgan mashqlar', program:'PISA'},
 TIMSS: {title:'TIMSS tayyorgarligi', audience:'Asl baholash 4 va 8-sinflar; bu yerda moslashtirilgan mashqlar', program:'TIMSS'},
 PIRLS: {title:'PIRLS tayyorgarligi', audience:'Asl baholash 4-sinf o‘qish savodxonligi; bu yerda mashq namunasi', program:'PIRLS'},
 TALIS: {title:'TALIS so‘rovnomasi', audience:'O‘qituvchi va maktab rahbarlari uchun, o‘quvchi testi emas', program:'TALIS'}
}
const BANK = {
 PISA: [
  [
   {q:'Maktab do‘konida bir daftar 3 500 so‘m. 4 daftar qancha turadi?',options:['12 000','14 000','15 000','16 000'],correct:1,why:'3500 × 4 = 14 000.'},
   {q:'Avtobus 1 soatda 60 km yo‘l yuradi. 2,5 soatda qancha yo‘l bosadi?',options:['120 km','140 km','150 km','180 km'],correct:2,why:'60 × 2,5 = 150 km.'},
   {q:'150 000 so‘mlik mahsulotga 20% chegirma berildi. Narxi qancha?',options:['100 000','110 000','120 000','130 000'],correct:2,why:'150 000 × 0,8 = 120 000.'},
   {q:'Sinfda 12 qiz va 18 o‘g‘il bor. Qizlar ulushi necha foiz?',options:['30%','40%','45%','60%'],correct:1,why:'12 / 30 × 100 = 40%.'}
  ],[
   {q:'Elektr sarfi oyiga 180 kVt·soat. 15% kamaytirilsa yangi sarf qancha?',options:['145','150','153','165'],correct:2,why:'180 × 0,85 = 153.'},
   {q:'24 metr panjaraning 1/3 qismi bo‘yaldi. Qolgan qismi necha metr?',options:['8','12','16','18'],correct:2,why:'24 − 24/3 = 16 metr.'},
   {q:'Bir yo‘nalishda 45 km/soat tezlikda 2 soat yurildi. Orqaga 30 km/soat bilan qancha vaqt ketadi?',options:['2','2,5','3','4'],correct:2,why:'Masofa 90 km, vaqt 90/30 = 3 soat.'},
   {q:'120 litr suvning 25% qismi sarflandi. Necha litr qoldi?',options:['30','60','90','100'],correct:2,why:'120 − 30 = 90 litr.'}
  ]
 ],
 TIMSS: [
  [
   {q:'3(2x + 1)=21 tenglamani yeching.',options:['x=2','x=3','x=4','x=5'],correct:1,why:'6x+3=21, x=3.'},
   {q:'Tomonlari 5 va 9 sm to‘rtburchak yuzini toping.',options:['14','28','40','45'],correct:3,why:'5 × 9 = 45 sm².'},
   {q:'0,75 soni oddiy kasrda qanday yoziladi?',options:['1/2','2/3','3/4','4/5'],correct:2,why:'0,75 = 75/100 = 3/4.'},
   {q:'36 ning 1/6 qismi nechaga teng?',options:['4','5','6','8'],correct:2,why:'36 ÷ 6 = 6.'}
  ],[
   {q:'2x² = 50 bo‘lsa, x ning musbat qiymati?',options:['3','4','5','7'],correct:2,why:'x²=25, musbat x=5.'},
   {q:'Uchburchak burchaklari 45° va 65°. Uchinchi burchak?',options:['60°','65°','70°','75°'],correct:2,why:'180−45−65=70°.'},
   {q:'Sonlar 2, 4, 4, 6, 9. Medianasi?',options:['4','5','6','9'],correct:0,why:'O‘rtadagi son 4.'},
   {q:'Aylana radiusi 7 sm. Diametri necha sm?',options:['7','10','14','21'],correct:2,why:'Diametr 2r=14.'}
  ]
 ],
 PIRLS: [
  [
   {q:'Matn: «Aziza kutubxonadan kitob oldi, chunki ertaga tanlovda qatnashadi». Aziza nima uchun kitob oldi?',options:['Sayohat uchun','Tanlovga tayyorlanish uchun','Sotish uchun','Sovg‘a uchun'],correct:1,why:'Sabab matnda bevosita aytilgan.'},
   {q:'Matn: «Bulutlar quyuqlashdi, bolalar soyabon oldi». Bolalar nimani kutgan?',options:['Quyosh','Qor','Yomg‘ir','Shamol'],correct:2,why:'Bulut va soyabon yomg‘ir ehtimolini ko‘rsatadi.'},
   {q:'«U shoshilmadi, har bir so‘zni diqqat bilan o‘qidi». Qahramonning xususiyati?',options:['E’tiborli','Dangasa','Jahldor','Shoshqaloq'],correct:0,why:'Diqqat bilan o‘qishi e’tiborli ekanini bildiradi.'},
   {q:'Axborot matnining asosiy maqsadi nima?',options:['His uyg‘otish','Ma’lumot berish','Hazil qilish','She’r aytish'],correct:1,why:'Axborot matni fakt va tushuntirish beradi.'}
  ],[
   {q:'Matn: «Qahramon yo‘lni yo‘qotdi, ammo xarita yordamida manzilga yetdi». Asosiy xulosa?',options:['Xarita yordam berdi','Yo‘l yopildi','Safar bekor qilindi','U uyga qaytdi'],correct:0,why:'Matn yakunidagi sabab–natija.'},
   {q:'«Tabiatni asrash har birimizning burchimiz». Muallif nima qilishga undamoqda?',options:['Tabiatni muhofaza qilishga','Iste’molni oshirishga','Daraxt kesishga','Chiqindi tashlashga'],correct:0,why:'Mazmun tabiatni asrashga chaqiradi.'},
   {q:'«Mehnati behuda ketmadi» iborasining ma’nosi?',options:['Foydasiz bo‘ldi','Natija berdi','To‘xtadi','Boshlandi'],correct:1,why:'Mehnat samara berganini bildiradi.'},
   {q:'Qaysi jumla fakt?',options:['Bu eng chiroyli bog‘','Bugun havo ajoyib','Bog‘da 20 daraxt bor','Menimcha, zo‘r'],correct:2,why:'Aniq son bilan tekshiriladigan ma’lumot.'}
  ]
 ],
 TALIS: [
  [
   {q:'Darsda formatif baholashning maqsadi?',options:['Faqat yakuniy baho','O‘quv jarayonini yaxshilash','Jazo berish','Darsni qisqartirish'],correct:1,why:'Formatif baholash qayta aloqa beradi.'},
   {q:'Individual yondashuvga qaysi amal mos?',options:['Hammasiga bir xil topshiriq','O‘quvchi ehtiyojiga qarab topshiriq','Faqat ma’ruza','Savollar bermaslik'],correct:1,why:'Har bir o‘quvchining ehtiyojiga moslashish.'},
   {q:'O‘qituvchilar hamkorligiga qanday misol?',options:['Dars rejalarini birga tahlil qilish','Tajriba almashmaslik','Hisobotni yashirish','Muammoni e’tiborsiz qoldirish'],correct:0,why:'Tajriba almashinuvi hamkorlikni kuchaytiradi.'},
   {q:'Inklyuziv sinfda eng maqbul yondashuv?',options:['Faqat kuchli o‘quvchilar','Barcha o‘quvchilar uchun mos yordam','Faqat test','Faqat mustaqil ish'],correct:1,why:'Barcha bolalar uchun qulay ta’lim.'}
  ],[
   {q:'O‘qituvchi dars samaradorligini qanday tekshiradi?',options:['Faqat davomat','Natijalar va qayta aloqani tahlil qilib','Faqat dars uzunligi','Faqat ta’til'],correct:1,why:'Ko‘p manbali ma’lumot va qayta aloqa muhim.'},
   {q:'Sinfda kiberxavfsizlik bo‘yicha dastlab nima qilinadi?',options:['Parolni ulashish','Maxfiylik qoidalarini o‘rgatish','Barcha havolaga kirish','Hisoblarni ochiq qoldirish'],correct:1,why:'Maxfiylik madaniyatidan boshlanadi.'},
   {q:'Darsdan keyingi refleksiya nimaga xizmat qiladi?',options:['Faoliyatni yaxshilashga','Bahoni yashirishga','Rejani bekor qilishga','Darsni to‘xtatishga'],correct:0,why:'Refleksiya keyingi darsni takomillashtiradi.'},
   {q:'Biror baholashda xolislikni ta’minlash usuli?',options:['Faqat taassurot','Aniq mezon va rubrika','Faqat taxmin','Ismga qarab baholash'],correct:1,why:'Aniq mezonlar baholash xolisligini oshiradi.'}
  ]
 ]
}

export async function initV2Schema(){
 await run(`CREATE TABLE IF NOT EXISTS v2_support_tickets (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, author_id INTEGER NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', answer TEXT NOT NULL DEFAULT '', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`)
 await run(`CREATE TABLE IF NOT EXISTS v2_assessment_results (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, user_id INTEGER NOT NULL, program TEXT NOT NULL, stage INTEGER NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, created_at BIGINT NOT NULL)`)
 await run(`CREATE TABLE IF NOT EXISTS v2_assessment_questions (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, program TEXT NOT NULL, stage INTEGER NOT NULL, question TEXT NOT NULL, options_json TEXT NOT NULL, correct INTEGER NOT NULL, why TEXT NOT NULL DEFAULT '', created_by INTEGER NOT NULL, created_at BIGINT NOT NULL)`)
 await run(`CREATE INDEX IF NOT EXISTS v2_assessment_questions_prog_stage ON v2_assessment_questions(program,stage,id)`)
 await run(`CREATE INDEX IF NOT EXISTS v2_assessment_results_user_date ON v2_assessment_results(user_id,created_at DESC)`)
 await run(`CREATE INDEX IF NOT EXISTS v2_assessment_results_program_stage ON v2_assessment_results(program,stage,created_at DESC)`)

}
const reply=(res,code,payload)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload))}
const err=(res,code,text)=>reply(res,code,{error:text})
const manager=a=>['admin','assistant_admin'].includes(a.role)
const educator=a=>manager(a)||a.role==='teacher'
const scrub=s=>String(s??'').trim()
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n))
const recent=new Map()
function rate(actor,kind,limit){const key=`${actor.id}:${kind}`,now=Date.now();let x=recent.get(key);if(!x||now-x.from>3600_000)x={from:now,count:0};x.count++;recent.set(key,x);return x.count<=limit}
async function body(req,limit=35000){let s='';for await(const c of req){s+=c;if(s.length>limit)throw new Error('So‘rov juda katta')}try{return JSON.parse(s||'{}')}catch{throw new Error('JSON xato')}}
function sampleMath({grade,topic,count}){
 const out=[];const g=clamp(Number(grade)||5,5,9)
 for(let i=0;i<count;i++){
  const a=3+i*2+g,b=2+(i%6),v=a+b;const ops=i%3;
  if(ops===0)out.push({text:`${topic}: ${a} + ${b} = ?`,options:[String(v-2),String(v),String(v+2),String(v+4)],correct:1,explanation:`${a} + ${b} = ${v}.`})
  if(ops===1)out.push({text:`${topic}: ${a} × ${b} = ?`,options:[String(a*b+1),String(a*b-2),String(a*b),String(a*b+2)],correct:2,explanation:`${a} × ${b} = ${a*b}.`})
  if(ops===2)out.push({text:`${topic}: ${a+b} − ${b} = ?`,options:[String(a),String(a+1),String(a-2),String(a+3)],correct:0,explanation:`${a+b} − ${b} = ${a}.`})
 }
 return out
}
function validateQuestions(arr){if(!Array.isArray(arr))throw new Error('AI noto‘g‘ri savollar qaytardi');return arr.slice(0,50).map((q,i)=>{if(typeof q.text!=='string'||q.text.length<6||q.text.length>800||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>300)||!Number.isInteger(q.correct)||q.correct<0||q.correct>3)throw new Error(`${i+1}-savol formati noto‘g‘ri`);return {text:q.text.trim(),options:q.options.map(x=>x.trim()),correct:q.correct,explanation:String(q.explanation||'').slice(0,900)}})}
// Shared formatting guidance for all generated teaching material.
// Output remains untrusted: the browser escapes HTML and renders safe KaTeX.
const MATH_OUTPUT_GUIDE = `Matematik formulalarni bir xil Markdown+LaTeX ko‘rinishida yozing. Satr ichida $a^2+b^2=c^2$, alohida formulada yangi satrlarga $$\n\\frac{a+b}{2}\n$$ yozing. \( \) va \[ \] o‘rniga $ va $$ ishlating. Formula atrofida kod bloki (uchta teskari apostrof) ishlatmang. Sarlavhalar Markdown bilan, qadamlar raqamli ro‘yxatda. Sonli misolda natijani qayta tekshiring. Agar ma’lumot yetishmasa to‘qimang, savol bering. Shaxsiy ma’lumotlarni so‘ramang.`

function config(){return {configured:!!process.env.GEMINI_API_KEY,provider:process.env.GEMINI_API_KEY?'Gemini API':'Oflayn namuna generatori',model:process.env.GEMINI_MODEL||'gemini-2.5-flash'}}
async function gemini(prompt,jsonMode=false,maxTokens=jsonMode?8192:1500){
 const key=process.env.GEMINI_API_KEY
 if(!key)throw new Error('GEMINI_API_KEY sozlanmagan')
 const model=process.env.GEMINI_MODEL||'gemini-2.5-flash'
 if(!/^[-a-zA-Z0-9_.]+$/.test(model))throw new Error('AI_MODEL noto‘g‘ri')
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),28000)
 try{
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.55,maxOutputTokens:maxTokens,...(jsonMode?{responseMimeType:'application/json'}:{})}}),signal:ctl.signal})
  if(!response.ok){const code=response.status;throw new Error(`AI xizmati javob bermadi (HTTP ${code}). API limit yoki kalitni tekshiring.`)}
  const json=await response.json();const text=(json.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('')
  if(!text)throw new Error('AI javobi bo‘sh keldi')
  return text
 }finally{clearTimeout(timer)}
}
// Imported assessment questions live in Neon; built-in samples are fallback only.
async function assessmentSet(program,stage){
 const rows=await all('SELECT id,question,options_json,correct,why FROM v2_assessment_questions WHERE program=? AND stage=? ORDER BY id',program,stage)
 const qs=rows.length?rows.map(r=>({q:r.question,options:JSON.parse(r.options_json),correct:r.correct,why:r.why})):BANK[program][stage-1]
 // Prevent an in-progress test being scored against a different question set.
 const version=createHash('sha256').update(JSON.stringify({program,stage,ids:rows.map(r=>r.id),qs})).digest('hex').slice(0,24)
 return {qs,version,source:rows.length?'uploaded':'demo'}
}
export {sampleMath,validateQuestions,PROGRAMS,BANK}

export async function handleV2({path,method,url,req,res,actor}){
 if(!path.startsWith('/api/v2/'))return false
 if(path==='/api/v2/config'&&method==='GET'){reply(res,200,config());return true}
 if(path==='/api/v2/ai/generate'&&method==='POST'){
  if(!educator(actor))return err(res,403,'Savol generatsiyasi o‘qituvchi va administrator uchun'),true
  if(!rate(actor,'generate',20))return err(res,429,'AI soatlik limiti tugadi'),true
  const d=await body(req),grade=Number(d.grade),topic=scrub(d.topic),count=clamp(Math.trunc(Number(d.count)||10),1,30)
  if(![5,6,7,8,9].includes(grade)||topic.length<3||topic.length>110)return err(res,400,'Sinf va mavzuni tekshiring'),true
  if(!process.env.GEMINI_API_KEY){reply(res,200,{source:'demo',warning:'Bu savollar AI tomonidan emas, oflayn namuna algoritmi bilan tuzildi. Mavzuga mosligini tekshiring.',questions:sampleMath({grade,topic,count})});return true}
  const prompt=`Siz O‘zbekiston 5–9-sinf matematika o‘qituvchisiga yordam berasiz. ${grade}-sinf, mavzu "${topic}". O‘quvchining shaxsiy ma’lumotlari kiritilmagan. ${count} ta turlicha, matematik jihatdan TO‘G‘RI, sodda va o‘rta darajadagi o‘zbekcha ko‘p variantli savol tuzing. Faqat JSON obyekt qaytaring: {"questions":[{"text":"...", "options":["...","...","...","..."],"correct":0,"explanation":"..."}]}. correct 0-3 indeks, aniq bitta to‘g‘ri javob. Formulalarni JSON matn maydonlarida $...$ ichida yozing (masalan, $x^2=9$); JSON escaping qoidalariga rioya qiling. Har bir javobni matematik tekshiring. Mazmunning maqbulligini o‘qituvchi tasdiqlaydi. Boshqa izoh yozmang.`
  const raw=await gemini(prompt,true),parsed=JSON.parse(raw);const qs=validateQuestions(parsed.questions)
  reply(res,200,{source:'ai',model:config().model,questions:qs,warning:'AI matematik xato qilishi mumkin; nashrdan oldin har bir savolni tekshiring.'});return true
 }
 if(path==='/api/v2/ai/teacher-doc'&&method==='POST'){
  if(!educator(actor))return err(res,403,'Faqat o‘qituvchi va administrator'),true
  if(!rate(actor,'teacher-doc',12))return err(res,429,'Soatlik AI limit tugadi'),true
  const d=await body(req),kind=scrub(d.kind),topic=scrub(d.topic),grade=Number(d.grade),school=scrub(d.school)
  if(!['plan','protocol','schedule','slides','worksheet'].includes(kind)||![5,6,7,8,9].includes(grade)||topic.length<3||topic.length>120||school.length>100)return err(res,400,'Hujjat turi, sinf yoki mavzu noto‘g‘ri'),true
  if(!process.env.GEMINI_API_KEY)return err(res,503,'AI hujjat yaratish uchun GEMINI_API_KEY sozlang'),true
  const types={plan:'45 daqiqalik batafsil dars ishlanmasi',protocol:'kafedra yig‘ilishi bayonnomasi namunasi',schedule:'to‘rt haftalik ish reja namunasi',slides:'10 slaydli taqdimot rejasi',worksheet:'10 ta turli mashq va javob kaliti'}
  const answer=await gemini(`O‘zbekiston maktabi uchun o‘zbek tilida tahrirlanadigan ${types[kind]} tayyorlang. Maktab: ${school||'Maktab'}, sinf: ${grade}, mavzu: ${topic}. Matematik aniqlikka e’tibor bering. Shaxsiy ma’lumotlar yoki real imzo va rasmiy tasdiqni to‘qimang; zarur joylarni [to‘ldiring] deb qoldiring. Matn tushunarli bo‘lsin. Tayyor material qog‘ozda ishga yaroqli bo‘lsin. ${MATH_OUTPUT_GUIDE}`)
  reply(res,200,{text:answer.slice(0,11000),source:'ai',warning:'AI matnini rasmiy hujjat sifatida ishlatishdan oldin mas’ul shaxs tekshirsin.'});return true
 }
 if(path==='/api/v2/ai/tutor'&&method==='POST'){
  if(!['student','teacher','admin','assistant_admin'].includes(actor.role))return err(res,403,'Ruxsat yo‘q'),true
  if(actor.role==='student'&&actor.verified===0)return err(res,403,'Hisob tasdiqlanishi kerak'),true
  if(!rate(actor,'tutor',12))return err(res,429,'Maslahatlar soatlik limiti tugadi'),true
  const d=await body(req),question=scrub(d.question),grade=clamp(Number(d.grade)||5,5,9)
  if(question.length<8||question.length>800)return err(res,400,'Savol uzunligi 8–800 belgi bo‘lsin'),true
  if(!process.env.GEMINI_API_KEY)return err(res,503,'AI o‘quvchi yordamchisi uchun GEMINI_API_KEY talab qilinadi. Oflayn mashqlar bo‘limidan foydalaning.'),true
  // Trusted reference facts for common formulas reduce (but cannot eliminate) AI errors.
  const formulaHints = /geron|heron/i.test(question)
   ? 'Nazorat uchun to‘g‘ri Geron formulasi: p=(a+b+c)/2, S=\\sqrt{p(p-a)(p-b)(p-c)}. 3, 4, 5 tomonli uchburchakda p=6 va S=6. a+b>c, a+c>b, b+c>a shartini tekshir.'
   : /pifagor|pythagor/i.test(question)
   ? 'Nazorat uchun Pifagor teoremasi: faqat to‘g‘ri burchakli uchburchakda c^2=a^2+b^2 (c — gipotenuza). Masalan, 3^2+4^2=5^2.'
   : ''
  const prompt = `Siz ${grade}-sinf o‘quvchisining o‘zbekcha matematika yordamchisisiz. Maqsad: o‘quvchini yechimni tushunishga o‘rgatish, tayyor javobni asossiz bermaslik.
Quyidagi qat’iy formatda javob bering:
### 1. Ta’rif va berilganlar
### 2. Formula
### 3. Bosqichma-bosqich yechim
### 4. Tekshirish
### 5. Yakuniy javob
Matematik belgilarni faqat LaTeX formatida yozing: satr ichida $...$, alohida formulalar uchun yangi qatorda $$...$$. Formulani uchta teskari apostrofli kod blokiga joylamang. Har bir hisobni mustaqil qayta hisoblab tekshiring; aniqlanmagan qiymatni to‘qimang. Agar sonlar berilmagan bo‘lsa, umumiy formulani va TO‘G‘RI oddiy misolni ko‘rsating. Xato yoki yetishmayotgan ma’lumot bo‘lsa, buni ochiq ayting. Markdown sarlavha va ro‘yxatlar ishlatishingiz mumkin. Shaxsiy ma’lumotlarni so‘ramang. ${MATH_OUTPUT_GUIDE} ${formulaHints}
O‘quvchi savoli: ${question}`
  const answer=await gemini(prompt,false,3200)
  reply(res,200,{answer:answer.slice(0,10000),source:'ai',warning:'AI matematik xato qilishi mumkin; muhim yechimni tekshiring.'});return true
 }
 if(path==='/api/v2/assessment/bank'&&method==='GET'){
  if(!manager(actor))return err(res,403,'Savollarni faqat administrator boshqaradi'),true
  const program=scrub(url.searchParams.get('program')).toUpperCase(),stage=Number(url.searchParams.get('stage'))
  if(!PROGRAMS[program]||![1,2].includes(stage))return err(res,400,'Dastur yoki bosqich noto‘g‘ri'),true
  const set=await assessmentSet(program,stage)
  reply(res,200,{program,stage,source:set.source,count:set.qs.length,questions:set.qs.slice(0,5).map(q=>({text:q.q,options:q.options,correct:q.correct,explanation:q.why}))});return true
 }
 if(path==='/api/v2/assessment/ai/generate'&&method==='POST'){
  if(!manager(actor))return err(res,403,'Xalqaro savollarni AI orqali faqat administrator yaratadi'),true
  if(!rate(actor,'international-ai',10))return err(res,429,'Xalqaro AI soatlik limit tugadi'),true
  const d=await body(req),program=scrub(d.program).toUpperCase(),stage=Number(d.stage),count=clamp(Math.trunc(Number(d.count)||5),1,15)
  if(!PROGRAMS[program]||![1,2].includes(stage))return err(res,400,'Dastur yoki bosqich noto‘g‘ri'),true
  if(!process.env.GEMINI_API_KEY)return err(res,503,'AI uchun GEMINI_API_KEY kerak'),true
  const scope=PROGRAMS[program].audience
  const prompt=`Siz ta’lim metodisti sifatida O‘zbekiston maktablari uchun tayyorgarlik mashqlari tayyorlaysiz. ${program} uslubidagi, lekin rasmiy testlardan ko‘chirilmagan ORIGINAL ${count} ta topshiriq yarating. Auditoriya: ${scope}. Bosqich ${stage}: ${stage===1?'bazaviy va tushunarli':'murakkabroq, amaliy va asoslashga undovchi'}. TALIS bo‘lsa o‘quvchi matematikasi emas, o‘qituvchilar va rahbarlar uchun pedagogik so‘rovnoma mavzusi bo‘lsin. Faqat o‘zbekcha JSON qaytaring: {"questions":[{"text":"savol","options":["A","B","C","D"],"correct":0,"explanation":"asos"}]}. Har savolda bitta aniq to‘g‘ri javob, correct 0–3. To‘g‘rilikni tekshiring; uchinchi tomonning maxfiy yoki shaxsiy ma’lumotini ishlatmang. Formulalarni JSON qatorlarida $...$ bilan yozing, hisoblarni tekshiring.`
  const raw=await gemini(prompt,true),parsed=JSON.parse(raw),qs=validateQuestions(parsed.questions)
  if(qs.length<1)return err(res,502,'AI savol qaytarmadi'),true
  reply(res,200,{questions:qs,source:'ai',warning:'AI savollari nashr qilinmagan. To‘g‘ri javoblarni tekshirib, Saqlash tugmasini bosing.'});return true
 }
 if(path==='/api/v2/assessment/import'&&method==='POST'){
  if(!manager(actor))return err(res,403,'Savollarni faqat administrator yuklay oladi'),true
  if(!rate(actor,'assessment-import',25))return err(res,429,'Yuklash limiti tugadi'),true
  const d=await body(req,350000),program=scrub(d.program).toUpperCase(),stage=Number(d.stage),mode=scrub(d.mode||'append')
  if(!PROGRAMS[program]||![1,2].includes(stage)||!['append','replace'].includes(mode)||!Array.isArray(d.questions)||d.questions.length<1||d.questions.length>100)return err(res,400,'Dastur, bosqich yoki savollar sonini tekshiring (1–100)'),true
  let qs
  try{qs=validateQuestions(d.questions)}catch(e){return err(res,400,String(e.message||'Savollar noto‘g‘ri')),true}
  // validateQuestions caps at 50; reject instead of silently dropping input.
  if(qs.length!==d.questions.length)return err(res,400,'Bir importda 50 tadan oshmasin; faylni qismlarga bo‘ling'),true
  const client=await getClient()
  try{
   await client.query('BEGIN')
   if(mode==='replace')await client.query('DELETE FROM v2_assessment_questions WHERE program=$1 AND stage=$2',[program,stage])
   await client.query(`INSERT INTO v2_assessment_questions(program,stage,question,options_json,correct,why,created_by,created_at)
     SELECT $2,$3,entry->>'text',(entry->'options')::text,(entry->>'correct')::integer,COALESCE(entry->>'explanation',''),$4,$5
     FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS x(entry,position) ORDER BY position`,[JSON.stringify(qs),program,stage,actor.id,Date.now()])
   await client.query('COMMIT')
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  const updated=await assessmentSet(program,stage)
  reply(res,200,{ok:true,added:qs.length,total:updated.qs.length,program,stage,mode});return true
 }
 if(path==='/api/v2/assessment/catalog'&&method==='GET'){reply(res,200,{programs:PROGRAMS});return true}
 if(path==='/api/v2/assessment/report'&&method==='GET'){
  // Access control is enforced on the SQL query, NEVER by client-supplied school/class filters.
  if(!educator(actor))return err(res,403,'Hisobotni faqat o‘qituvchi yoki administrator ko‘ra oladi'),true
  const managerView=manager(actor)
  const scope=managerView?'TRUE':"((u.role='student' AND c.teacher_id=$1) OR r.user_id=$1)"
  const params=managerView?[]:[actor.id]
  const result=await getClient()
  try {
   const records=await result.query(`SELECT r.id, r.user_id AS "userId", u.name AS "userName",u.role AS "userRole",
       c.id AS "classId",c.name AS "className",s.id AS "schoolId",s.name AS "schoolName",
       r.program,r.stage,r.score,r.total,r.created_at AS "createdAt"
      FROM v2_assessment_results r
      INNER JOIN users u ON u.id=r.user_id
      LEFT JOIN classes c ON c.id=u.class_id
      LEFT JOIN schools s ON s.id=c.school_id
      WHERE ${scope}
      ORDER BY r.created_at DESC,r.id DESC LIMIT 1001`,params)
   const truncated=records.rows.length>1000
   reply(res,200,{rows:records.rows.slice(0,1000),truncated,scope:managerView?'all':'assigned-classes-and-own-results'})
  }finally{result.release()}
  return true
 }
 if(path==='/api/v2/assessment/progress'&&method==='GET'){
  const rows=await all('SELECT program,stage,score,total,created_at AS createdAt FROM v2_assessment_results WHERE user_id=? ORDER BY created_at DESC LIMIT 100',actor.id)
  reply(res,200,{rows});return true
 }
 if(path==='/api/v2/assessment/questions'&&method==='GET'){
  const program=scrub(url.searchParams.get('program')).toUpperCase(),stage=Number(url.searchParams.get('stage'))
  if(!PROGRAMS[program]||![1,2].includes(stage))return err(res,400,'Dastur va bosqichni tanlang'),true
  if(program==='TALIS'&&!educator(actor))return err(res,403,'TALIS — o‘qituvchilar va rahbarlar uchun'),true
  if(actor.role==='student'&&actor.verified===0)return err(res,403,'Maktab tasdig‘ini kuting'),true
  if(stage===2&&!manager(actor)){
   const a=await get('SELECT score,total FROM v2_assessment_results WHERE user_id=? AND program=? AND stage=1 ORDER BY id DESC LIMIT 1',actor.id,program)
   if(!a||a.score*100/a.total<60)return err(res,403,'2-bosqich uchun 1-bosqichdan kamida 60% o‘tish kerak'),true
  }
  const set=await assessmentSet(program,stage)
  reply(res,200,{program,stage,scope:PROGRAMS[program].audience,official:false,source:set.source,version:set.version,questions:set.qs.map((q,i)=>({id:i+1,text:q.q,options:q.options}))});return true
 }
 if(path==='/api/v2/assessment/submit'&&method==='POST'){
  if(!rate(actor,'assessment',50))return err(res,429,'Urinish limiti tugadi'),true
  const d=await body(req),program=scrub(d.program).toUpperCase(),stage=Number(d.stage)
  if(!PROGRAMS[program]||![1,2].includes(stage)||!Array.isArray(d.answers))return err(res,400,'Test noto‘g‘ri'),true
  if(program==='TALIS'&&!educator(actor))return err(res,403,'TALIS — o‘qituvchilar uchun'),true
  if(actor.role==='student'&&actor.verified===0)return err(res,403,'Maktab tasdig‘i kerak'),true
  if(stage===2&&!manager(actor)){
   const a=await get('SELECT score,total FROM v2_assessment_results WHERE user_id=? AND program=? AND stage=1 ORDER BY id DESC LIMIT 1',actor.id,program)
   if(!a||a.score*100/a.total<60)return err(res,403,'Avval 1-bosqichdan o‘ting'),true
  }
  const set=await assessmentSet(program,stage)
  if(typeof d.version!=='string'||d.version!==set.version)return err(res,409,'Savollar yangilangan. Testni qaytadan boshlang'),true
  const qs=set.qs
  if(d.answers.length!==qs.length||d.answers.some(x=>!Number.isInteger(x)||x<0||x>3))return err(res,400,'Barcha savollarga javob bering'),true
  const score=qs.reduce((n,q,i)=>n+(q.correct===d.answers[i]?1:0),0)
  await run('INSERT INTO v2_assessment_results(user_id,program,stage,score,total,created_at) VALUES(?,?,?,?,?,?)',actor.id,program,stage,score,qs.length,Date.now())
  reply(res,200,{score,total:qs.length,passed:score*100/qs.length>=60,details:qs.map((q,i)=>({correct:q.correct,why:q.why,chosen:d.answers[i]}))});return true
 }
 if(path==='/api/v2/support'&&method==='POST'){
  if(!rate(actor,'support',12))return err(res,429,'Murojaatlar limiti tugadi'),true
  const d=await body(req),title=scrub(d.title),message=scrub(d.message),category=scrub(d.category)
  if(title.length<5||title.length>130||message.length<12||message.length>2500||!['technical','content','account','idea'].includes(category))return err(res,400,'Mavzu va xabarni tekshiring'),true
  const id=(await run('INSERT INTO v2_support_tickets(author_id,category,title,message,created_at,updated_at) VALUES(?,?,?,?,?,?)',actor.id,category,title,message,Date.now(),Date.now())).lastInsertRowid
  reply(res,201,{id,ok:true});return true
 }
 if(path==='/api/v2/support'&&method==='GET'){
  const rows=manager(actor)?await all(`SELECT t.*,u.name AS author_name FROM v2_support_tickets t LEFT JOIN users u ON u.id=t.author_id ORDER BY t.id DESC LIMIT 100`):await all('SELECT id,title,message,category,status,answer,created_at,updated_at FROM v2_support_tickets WHERE author_id=? ORDER BY id DESC LIMIT 100',actor.id)
  reply(res,200,{rows});return true
 }
 const match=/^\/api\/v2\/support\/(\d+)$/.exec(path)
 if(match&&method==='PATCH'){
  if(!manager(actor))return err(res,403,'Faqat administrator'),true
  const d=await body(req),status=scrub(d.status),answer=scrub(d.answer)
  if(!['new','review','done'].includes(status)||answer.length>2000)return err(res,400,'Holat yoki javob noto‘g‘ri'),true
  await run('UPDATE v2_support_tickets SET status=?,answer=?,updated_at=? WHERE id=?',status,answer,Date.now(),Number(match[1]))
  reply(res,200,{ok:true});return true
 }
 return err(res,404,'v2 manzil topilmadi'),true
}
