// MATH-DIAGNOZ v1.6 — PostgreSQL on Neon + Render web service (Node 22+)
// Default server binds to 127.0.0.1. School launcher opts in to local-network access.
// This HTTP pilot is ONLY for a trusted PRIVATE school LAN, not the public Internet.
// HTTPS, external audit and production-grade security are still required for public use.
import { createServer } from 'node:http'
import { get, all, run, initSchema, ensureSchool, backupTables, filePut, fileGet } from './postgres-db.mjs'
import { createGzip } from 'node:zlib'
import { randomBytes, scryptSync, createHash, timingSafeEqual } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync, readdirSync, statSync, createReadStream, rmSync } from 'node:fs'
import { resolve, dirname, extname, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const schoolMode = true
const serveDist = true
const distDir = resolve(root, '..', 'dist')
const staticMime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
function serveBuiltSite(req,res,pathname){
  if(!['GET','HEAD'].includes(req.method||'GET')) return fail(res,405,'Bu manzilda faqat ko‘rishga ruxsat bor')
  let decoded
  try{decoded=decodeURIComponent(pathname)}catch{return fail(res,400,'Manzil xato')}
  if(decoded.includes('\\')||decoded.includes('\0'))return fail(res,400,'Manzil xato')
  const file = resolve(distDir,'.'+(decoded.endsWith('/')?decoded+'index.html':decoded))
  const rel = relative(distDir,file)
  if(rel.startsWith('..')||isAbsolute(rel))return fail(res,403,'Ruxsat yo‘q')
  let target = file
  if(!existsSync(target)||!statSync(target).isFile()){
    if(extname(decoded)||!String(req.headers.accept||'').includes('text/html'))return fail(res,404,'Fayl topilmadi')
    target = resolve(distDir,'index.html')
  }
  if(!existsSync(target))return fail(res,503,'Sayt yig‘ilmagan. npm.cmd run build buyrug‘ini bajaring')
  const ext=extname(target),headers={
    'Content-Type':staticMime[ext]||'application/octet-stream',
    'Content-Length':statSync(target).size,
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer',
    'Cache-Control':ext==='.html'?'no-store':'public, max-age=600'
  }
  res.writeHead(200,headers)
  if(req.method==='HEAD')return res.end()
  createReadStream(target).pipe(res)
}

const backupDir = resolve(root,'backups')
// PostgreSQL and media blobs are durable in Neon, not on Render's ephemeral disk.
await initSchema()
const defaultSchool = await ensureSchool()
const hash = x=>createHash('sha256').update(x).digest('hex')
const passHash=(p,s)=>scryptSync(p,s,64).toString('hex')
async function audit(actor, action, details='') {
 try {await run('INSERT INTO audit(actor_id,action,details,created_at) VALUES(?,?,?,?)',actor?.id??null,action,String(details).slice(0,250),Date.now())}
 catch(e) {console.error('[AUDIT]', e?.message)}
}
async function readBinary(req,limit){
 const chunks=[];let size=0
 for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('Fayl hajmi ruxsat etilgan chegaradan katta');chunks.push(chunk)}
 if(!size)throw new Error('Bo‘sh fayl yuklanmaydi')
 return Buffer.concat(chunks)
}
function assetType(buffer,kind){
 if(kind==='pdf')return buffer.subarray(0,5).toString('ascii')==='%PDF-'?'application/pdf':null
 if(kind!=='image')return null
 if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png'
 if(buffer.subarray(0,3).equals(Buffer.from([255,216,255])))return 'image/jpeg'
 if(['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString('ascii')))return 'image/gif'
 if(buffer.subarray(0,4).toString('ascii')==='RIFF'&&buffer.subarray(8,12).toString('ascii')==='WEBP')return 'image/webp'
 return null
}
const safeUser = u => u ? ({ id:u.id, username:u.username, name:u.name, role:u.role, classId:u.class_id ?? undefined, childIds:JSON.parse(u.child_ids||'[]'), active:Boolean(u.active),lastLoginAt:u.last_login_at??null }) : null
const state = async k => { try {return JSON.parse((await get('SELECT value FROM app_state WHERE key=?',k))?.value??'null')} catch{return null} }
const store = async (k,v) => await run('INSERT INTO app_state(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',k,JSON.stringify(v))
const issue = async (res,id) => {await run('UPDATE users SET last_login_at=? WHERE id=?',Date.now(),id);const token=randomBytes(32).toString('hex');const maxAge=schoolMode?8*3600:7*86400;await run('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)',hash(token),id,Date.now()+maxAge*1000);res.setHeader('Set-Cookie',`md_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.RENDER ? '; Secure' : ''}`)}
async function auth(req){const token=/(?:^|;\s*)md_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];if(!token)return null;const row=await get('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.hash=? AND sessions.expires>? AND users.active=1',hash(token),Date.now());return row||null}
function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))}
function fail(res,code,message){send(res,code,{error:message})}
async function readJson(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>2_500_000)throw new Error('Ma’lumot juda katta')}try{return JSON.parse(data||'{}')}catch{throw new Error('JSON noto‘g‘ri')}}
const roles=['admin','teacher','student','parent']
const clean=s=>String(s??'').trim()
const validLogin=s=>/^[a-zA-Z0-9._-]{3,32}$/.test(s)
const validPass=s=>typeof s==='string'&&s.length>=8&&s.length<=128
const sanitizeUserList=async (actor)=>{
  const allUsers=await all(actor.role==='admin'?'SELECT * FROM users ORDER BY id':'SELECT * FROM users WHERE active=1 ORDER BY id')
  if(actor.role==='admin')return allUsers.map(safeUser)
  if(actor.role==='teacher') {const myClasses=(await all('SELECT id FROM classes WHERE teacher_id=?',actor.id)).map(c=>c.id);return allUsers.filter(u=>u.id===actor.id||u.role==='student'&&myClasses.includes(u.class_id)).map(safeUser)}
  if(actor.role==='parent'){const ids=JSON.parse(actor.child_ids||'[]');return allUsers.filter(u=>u.id===actor.id||ids.includes(u.id)).map(safeUser)}
  return allUsers.filter(u=>u.id===actor.id).map(safeUser)
}
const attemptsFor=async (actor)=>{
  const recs=await all('SELECT results.data,users.class_id,results.user_id FROM results JOIN users ON users.id=results.user_id ORDER BY results.id DESC')
  const classIds=actor.role==='teacher'?(await all('SELECT id FROM classes WHERE teacher_id=?',actor.id)).map(c=>c.id):[]
  const children=actor.role==='parent'?JSON.parse(actor.child_ids||'[]'):[]
  return recs.filter(r=>actor.role==='admin'||actor.role==='teacher'&&classIds.includes(r.class_id)||actor.role==='student'&&r.user_id===actor.id||actor.role==='parent'&&children.includes(r.user_id)).map(r=>JSON.parse(r.data))
}
async function leaderboard(actor,filterGrade,filterClass){
 const students=await all("SELECT u.id,u.name,u.class_id,c.grade,c.name AS class_name FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.role='student' AND u.active=1")
 const records=await all('SELECT user_id,data FROM results')
 const out=[]
 for(const u of students){
  if(filterGrade&&u.grade!==filterGrade||filterClass&&u.class_id!==filterClass)continue
  const best=new Map()
  for(const r of records){if(r.user_id!==u.id)continue;const a=JSON.parse(r.data);if(!a.total)continue;const pct=a.score/a.total*100;best.set(a.testId,Math.max(best.get(a.testId)??-1,pct))}
  if(!best.size)continue
  const avg=Math.round([...best.values()].reduce((a,b)=>a+b,0)/best.size*10)/10
  const mine=actor.id===u.id||actor.role==='admin'||actor.role==='teacher'&&await get('SELECT 1 FROM classes WHERE id=? AND teacher_id=?',u.class_id,actor.id)
  const parts=u.name.trim().split(/\s+/)
  const displayName=mine?u.name:`${parts[0]} ${parts.length>1?parts[1][0]+'.':''}`.trim()
  out.push({studentId:u.id,displayName,className:u.class_name||'—',grade:u.grade,average:avg,tests:best.size,isMe:actor.id===u.id})
 }
 out.sort((a,b)=>b.average-a.average||b.tests-a.tests||a.studentId-b.studentId)
 return out.map((r,i)=>({...r,rank:i+1}))
}
const publicClasses=async ()=>await all('SELECT c.id,c.name,c.grade,c.school_id AS schoolId,s.name AS schoolName FROM classes c LEFT JOIN schools s ON s.id=c.school_id ORDER BY c.grade,c.name')
const allClasses=async ()=>await all('SELECT id,name,grade,teacher_id AS teacherId,school_id AS schoolId FROM classes ORDER BY grade,name')
const allSchools=async ()=>await all('SELECT id,name,region,district,code FROM schools ORDER BY name,id')
const validSchool=async (id)=>await get('SELECT id FROM schools WHERE id=?', Number(id))
const validTeacher=async (id)=>!id||await get("SELECT id FROM users WHERE id=? AND role='teacher' AND active=1",Number(id))
const validChildren=async (ids)=>{
 if(!Array.isArray(ids))return false
 for(const id of ids){if(!Number.isInteger(Number(id))||!await get("SELECT id FROM users WHERE id=? AND role='student' AND active=1",Number(id)))return false}
 return true
}

async function verifyExam(test,user){
 if(!test||!test.active)throw new Error('Test faol emas')
 const availableQuestions=await state('questions')||[]; if(!(test.questionIds||[]).some(id=>availableQuestions.some(q=>q.id===id)))throw new Error('Test savollari topilmadi')
 if(test.kind==='quarter'){
   const grade=(await get('SELECT grade FROM classes WHERE id=?',user.class_id))?.grade
   const book=(await state('books')||[]).find(b=>b.id===test.bookId)
   const gated=(await state('quarterGates')||[]).some(g=>g.grade===grade&&g.quarter===(test.quarter||1)&&g.enabled)
   if(!book||book.grade!==grade||!gated)throw new Error('Bu sinf uchun choraklik test hali ochilmagan')
 }
 const now=Date.now();if(test.availableFrom&&now<new Date(test.availableFrom).getTime()||test.availableUntil&&now>=new Date(test.availableUntil).getTime())throw new Error('Test uchun belgilangan vaqt kelmagan yoki tugagan')
 const assigned=(await state('assignments')||[]).some(a=>a.testId===test.id&&a.classId===user.class_id)
 if(!assigned)throw new Error('Test sinfingizga tayinlanmagan')
 const attempted=(await get('SELECT COUNT(*) AS n FROM results WHERE user_id=? AND test_id=?',user.id,test.id)).n
 const s=await state('adminSettings')||{};if(attempted >= (test.attemptLimit??s.maxAttempts??3))throw new Error('Urinish limiti tugagan')
}
async function finishExam(user,exam){
 const current=await get('SELECT * FROM exams WHERE id=? AND user_id=?',exam.id,user.id)
 if(!current)throw new Error('Sinov topilmadi')
 const prev=await get('SELECT data FROM results WHERE exam_id=?',exam.id)
 if(prev)return JSON.parse(prev.data)
 const test=(await state('testSets')||[]).find(t=>t.id===exam.test_id)
 const qs=await state('questions')||[],books=await state('books')||[],settings=await state('adminSettings')||{}
 const answers=JSON.parse(current.answers||'{}'),topics=new Map();let score=0,total=0
 for(const id of test?.questionIds||[]){const q=qs.find(q=>q.id===id);if(!q)continue;total++;const ok=answers[q.id]===q.correct;if(ok)score++
   const topic=q.topic||books.find(b=>b.id===q.bookId)?.chapters?.find(c=>c.id===q.chapterId)?.title||'Umumiy mavzu'
   const item=topics.get(topic)||{topic,correct:0,total:0};item.total++;if(ok)item.correct++;topics.set(topic,item)
 }
 const u=await get('SELECT * FROM users WHERE id=?',user.id)
 const percent=total?Math.round(score/total*100):0
 const duration=Math.max(1,Math.ceil((current.deadline_at-current.started_at)/60000))
 const record={id:Date.now(),testId:exam.test_id,testTitle:test?.title||'Test',grade:books.find(b=>b.id===test?.bookId)?.grade||(await get('SELECT grade FROM classes WHERE id=?',u.class_id))?.grade||5,score,total,topicResults:[...topics.values()],createdAt:new Date().toISOString(),reason:Date.now()>=current.deadline_at?'expired':'submitted',passed:percent>=(test?.passingPercent??settings.passingPercent??60),durationMinutes:duration,elapsedSeconds:Math.max(0,Math.round((Date.now()-current.started_at)/1000)),studentId:user.id,classId:u.class_id}
 await run('INSERT OR IGNORE INTO results(user_id,exam_id,test_id,data) VALUES(?,?,?,?)',user.id,current.id,exam.test_id,JSON.stringify(record));await run("UPDATE exams SET status='finished' WHERE id=?",exam.id)
 return record
}
const PRACTICE=[
 {id:'5g1',grade:5,topic:'Geometrik shakllar',q:'Tomoni 6 sm bo‘lgan kvadratning perimetri nechaga teng?',options:['12 sm','24 sm','36 sm','18 sm'],right:1,hint:'Kvadratning barcha to‘rt tomoni teng.',why:'Perimetr 4 × 6 = 24 sm.'},
 {id:'5g2',grade:5,topic:'Geometrik shakllar',q:'Tomonlari 8 sm va 3 sm bo‘lgan to‘g‘ri to‘rtburchakning yuzi?',options:['22 sm²','24 sm²','11 sm²','16 sm²'],right:1,hint:'Yuza uzunlik bilan enning ko‘paytmasi.',why:'Yuza 8 × 3 = 24 sm².'},
 {id:'5g3',grade:5,topic:'Geometrik shakllar',q:'Tomonlari 3, 4, 5 sm bo‘lgan uchburchakning perimetri?',options:['10 sm','12 sm','15 sm','9 sm'],right:1,hint:'Perimetr barcha tomonlarning yig‘indisi.',why:'3 + 4 + 5 = 12 sm.'},
 {id:'5g4',grade:5,topic:'Geometrik shakllar',q:'Kvadratning perimetri 28 sm. Uning bir tomoni necha sm?',options:['6 sm','8 sm','7 sm','14 sm'],right:2,hint:'Perimetrni teng tomonlar soniga bo‘ling.',why:'28 ÷ 4 = 7 sm.'},
 {id:'6p1',grade:6,topic:'Nisbat va proporsiya',q:'3:4 = x:20 bo‘lsa, x ni toping.',options:['12','15','16','18'],right:1,hint:'To‘g‘ri proporsiyada ko‘paytmalarni tenglashtiring.',why:'3 × 20 = 4x, shuning uchun x = 15.'},
 {id:'6p2',grade:6,topic:'Nisbat va proporsiya',q:'5 kg olma 40 000 so‘m bo‘lsa, 2 kg olma qancha?',options:['12 000','14 000','16 000','20 000'],right:2,hint:'Avval bir kilogramm narxini toping.',why:'40 000 ÷ 5 × 2 = 16 000 so‘m.'},
 {id:'6p3',grade:6,topic:'Nisbat va proporsiya',q:'12 sonining 25 foizi nechaga teng?',options:['2','3','4','6'],right:1,hint:'25% — butunning to‘rtdan bir qismi.',why:'12 ÷ 4 = 3.'},
 {id:'7t1',grade:7,topic:'Tenglamalar',q:'2x + 4 = 10 bo‘lsa, x ni toping.',options:['2','3','4','5'],right:1,hint:'Avval 4 ni o‘tkazing, keyin 2 ga bo‘ling.',why:'2x = 6, x = 3.'},
 {id:'7t2',grade:7,topic:'Tenglamalar',q:'3x − 7 = 14 bo‘lsa, x ni toping.',options:['5','6','7','8'],right:2,hint:'Tenglamaning ikki tomoniga 7 qo‘shing.',why:'3x = 21, x = 7.'},
 {id:'7t3',grade:7,topic:'Tenglamalar',q:'5(x − 2) = 25 bo‘lsa, x ni toping.',options:['5','7','9','3'],right:1,hint:'Ikki tomonni 5 ga bo‘lishdan boshlang.',why:'x − 2 = 5, x = 7.'},
 {id:'8i1',grade:8,topic:'Kvadrat ildizlar',q:'√81 qiymati nechaga teng?',options:['7','8','9','10'],right:2,hint:'O‘ziga ko‘paytirilganda 81 beradigan musbat sonni toping.',why:'9 × 9 = 81, √81 = 9.'},
 {id:'8i2',grade:8,topic:'Kvadrat ildizlar',q:'√49 + √16 ni hisoblang.',options:['9','10','11','12'],right:2,hint:'Har ikkala ildizni alohida hisoblang.',why:'7 + 4 = 11.'},
 {id:'8i3',grade:8,topic:'Kvadrat tenglamalar',q:'x² = 25 tenglamaning nechta haqiqiy yechimi bor?',options:['0 ta','1 ta','2 ta','5 ta'],right:2,hint:'Musbat va manfiy sonlarning kvadrati musbat bo‘lishi mumkin.',why:'x = 5 va x = −5, jami 2 ta yechim.'},
 {id:'9f1',grade:9,topic:'Funksiyalar',q:'f(x) = 2x + 3 bo‘lsa, f(4) ni toping.',options:['9','10','11','12'],right:2,hint:'x o‘rniga 4 ni qo‘ying.',why:'2 × 4 + 3 = 11.'},
 {id:'9f2',grade:9,topic:'Funksiyalar',q:'y = 3x − 6 funksiya x=2 bo‘lganda qanday qiymat oladi?',options:['0','2','3','6'],right:0,hint:'x qiymatini formulaga qo‘ying.',why:'3 × 2 − 6 = 0.'},
 {id:'9f3',grade:9,topic:'Tengsizliklar',q:'2x > 10 tengsizlikning yechimlari qaysi?',options:['x < 5','x = 5','x > 5','x ≥ 5'],right:2,hint:'Ikki tomonni musbat 2 ga bo‘ling.',why:'2x > 10 dan x > 5.'}
]
const RATE=new Map()
function loginRate(ip){const now=Date.now(),v=RATE.get(ip)||{count:0,until:0};if(now>v.until){v.count=0;v.until=now+5*60000}v.count++;RATE.set(ip,v);return v.count<=15}
const server=createServer(async(req,res)=>{
  const url=new URL(req.url||'/', 'http://localhost');const path=url.pathname,method=req.method||'GET'
  if(!path.startsWith('/api/'))return serveDist?serveBuiltSite(req,res,path):fail(res,404,'Topilmadi')
  // Same-origin POST only. Localhost:5173 is needed by the old VS Code dev workflow.
  if(['POST','PUT','PATCH','DELETE'].includes(method)){
    const origin=req.headers.origin
    if(origin){
      let accepted=false
      try{
        const parsed=new URL(origin)
        accepted=(parsed.protocol==='http:'||parsed.protocol==='https:') && (
          parsed.host === req.headers.host ||
          /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin)
        )
      }catch{}
      if(!accepted)return fail(res,403,'Origin rad etildi')
    }
  }
  try{
    if(path==='/api/status'&&method==='GET')return send(res,200,{initialized:!!await get('SELECT id FROM users LIMIT 1'),schoolMode,schoolName:(await get('SELECT name FROM schools ORDER BY id LIMIT 1'))?.name||'Sinov maktabi',classes:schoolMode?[]:await publicClasses()})
    if(path==='/api/auth/setup'&&method==='POST'){
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||''))return fail(res,403,'Birinchi administratorni SQLite import orqali kiriting')
      if(await get('SELECT id FROM users LIMIT 1'))return fail(res,403,'Administrator allaqachon yaratilgan')
      const d=await readJson(req);if(!validLogin(clean(d.username))||!validPass(d.password)||clean(d.name).length<2)return fail(res,400,'Ism, 3–32 belgili login, kamida 8 belgili parol kiriting')
      const salt=randomBytes(16).toString('hex');const id=Number((await run('INSERT INTO users(username,name,role,salt,pass_hash) VALUES(?,?,?,?,?)',clean(d.username).toLowerCase(),clean(d.name),'admin',salt,passHash(d.password,salt))).lastInsertRowid)
      for(const grade of [5,6,7,8,9])await run('INSERT INTO classes(name,grade,school_id) VALUES(?,?,?)',`${grade}-A`,grade,defaultSchool)
      await issue(res,id);return send(res,201,{user:safeUser(await get('SELECT * FROM users WHERE id=?',id))})
    }
    if(path==='/api/auth/register'&&method==='POST'){
      if(schoolMode)return fail(res,403,'Maktab sinovida hisoblarni faqat administrator yaratadi')
      if(!await get('SELECT id FROM users LIMIT 1'))return fail(res,400,'Avval administrator hisobini yarating')
      const d=await readJson(req),role=clean(d.role)
      if(!['student','parent'].includes(role))return fail(res,403,'O‘qituvchi hisobini administrator yaratadi')
      if(!validLogin(clean(d.username))||!validPass(d.password)||clean(d.name).length<2)return fail(res,400,'Login/parol/ism ma’lumotlarini tekshiring')
      if(role==='student'&&!await get('SELECT id FROM classes WHERE id=?',Number(d.classId)))return fail(res,400,'Sinfni tanlang')
      const salt=randomBytes(16).toString('hex')
      const id=Number((await run('INSERT INTO users(username,name,role,class_id,salt,pass_hash) VALUES(?,?,?,?,?,?)',clean(d.username).toLowerCase(),clean(d.name),role,role==='student'?Number(d.classId):null,salt,passHash(d.password,salt))).lastInsertRowid)
      await issue(res,id);return send(res,201,{user:safeUser(await get('SELECT * FROM users WHERE id=?',id))})
    }
    if(path==='/api/auth/login'&&method==='POST'){
      const d=await readJson(req);if(!loginRate(clean(d.username).toLowerCase()))return fail(res,429,'Bu login uchun urinishlar juda ko‘p, keyinroq qayting')
      const u=await get('SELECT * FROM users WHERE username=? AND active=1',clean(d.username).toLowerCase())
      const candidate=passHash(String(d.password||''),u?.salt||'00000000000000000000000000000000');const expected=u?.pass_hash||'0'.repeat(128)
      if(!u||!timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(expected,'hex')))return fail(res,401,'Login yoki parol noto‘g‘ri')
      await issue(res,u.id);await audit(u,'auth.login','Tizimga kirish');return send(res,200,{user:safeUser(u)})
    }
    if(path==='/api/auth/logout'&&method==='POST'){
      const t=/(?:^|;\s*)md_session=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1];if(t)await run('DELETE FROM sessions WHERE hash=?',hash(t));res.setHeader('Set-Cookie','md_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');return send(res,200,{ok:true})
    }
    const actor=await auth(req)
    if(path==='/api/auth/me'&&method==='GET')return send(res,200,{user:safeUser(actor)})
    if(!actor)return fail(res,401,'Avval tizimga kiring')
    // PDF and image bytes persist as PostgreSQL bytea (pilot quota 200 MB).
    if(path==='/api/assets/pdf'&&method==='POST'||path==='/api/assets/image'&&method==='POST'){
      if(!['admin','teacher'].includes(actor.role))return fail(res,403,'Yuklashga ruxsat yo‘q')
      const kind=path.endsWith('/pdf')?'pdf':'image'
      const max=kind==='pdf'?40*1024*1024:4*1024*1024
      const name=clean(url.searchParams.get('name')|| (kind==='pdf'?'darslik.pdf':'rasm.png')).slice(0,150)
      const bytes=await readBinary(req,max)
      const mime=assetType(bytes,kind)
      if(!mime)return fail(res,400,'Fayl formati mos emas (PDF, PNG, JPG, GIF yoki WEBP)')
      const total=(await get('SELECT COALESCE(SUM(bytes),0) AS total FROM assets')).total
      if(total+bytes.length>200*1024*1024)return fail(res,413,'Neon sinov fayllari uchun 200 MB ajratilgan limit tugadi')
      const id=randomBytes(18).toString('hex')
      await run('INSERT INTO assets(id,kind,filename,mime,bytes,uploaded_by,created_at) VALUES(?,?,?,?,?,?,?)',id,kind,name,mime,bytes.length,actor.id,Date.now())
      try{await filePut(id,bytes)}catch(err){await run('DELETE FROM assets WHERE id=?',id);throw err}
      await audit(actor,'asset.upload',kind+' · '+name)
      return send(res,201,{key:'server:'+id,name,bytes:bytes.length})
    }
    const assetPath=/^\/api\/assets\/([a-f0-9]{36})$/.exec(path)
    if(assetPath&&method==='GET'){
      const item=await get('SELECT * FROM assets WHERE id=?',assetPath[1]);if(!item)return fail(res,404,'Fayl topilmadi')
      const file=await fileGet(item.id);if(!file)return fail(res,404,'Fayl saqlash joyida topilmadi')
      res.writeHead(200,{'Content-Type':item.mime,'Content-Length':item.bytes,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="'+(item.kind==='pdf'?'document.pdf':'image')+'"'})
      return res.end(file)
    }
    if(path==='/api/system/health'&&method==='GET'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      const total=(await get('SELECT COUNT(*) n FROM assets')).n
      return send(res,200,{version:'1.6.0',mode:'neon-render-pilot',users:(await get('SELECT COUNT(*) n FROM users WHERE active=1')).n,schools:(await get('SELECT COUNT(*) n FROM schools')).n,classes:(await get('SELECT COUNT(*) n FROM classes')).n,results:(await get('SELECT COUNT(*) n FROM results')).n,files:total,fileBytes:(await get('SELECT COALESCE(SUM(bytes),0) n FROM assets')).n,lastBackup:'Qo‘lda eksport yuklab oling'})
    }
    if(path==='/api/system/activity'&&method==='GET'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      return send(res,200,{events:await all('SELECT a.action,a.details,a.created_at AS createdAt,u.name AS actor FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 50')})
    }
    if(path==='/api/system/backup'&&method==='POST'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      await audit(actor,'backup.request','PostgreSQL eksport')
      return send(res,200,{ok:true,folder:'Yuklab olish orqali',downloadUrl:'/api/system/backup/download'})
    }
    if(path==='/api/system/backup/download'&&method==='GET'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      res.writeHead(200,{
        'Content-Type':'application/gzip',
        'Content-Disposition':`attachment; filename="math-diagnoz-neon-${new Date().toISOString().slice(0,10)}.json.gz"`,
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff'
      })
      const gz=createGzip({level:6});gz.pipe(res)
      try{
        gz.write(JSON.stringify({format:'math-diagnoz-1.6-export',createdAt:new Date().toISOString()}).slice(0,-1)+',"tables":{')
        const tables=['users','sessions','schools','classes','app_state','exams','results','assets','audit','practice_attempts','asset_blobs']
        for(let i=0;i<tables.length;i++){
          const table=tables[i];const records=await backupTables(table)
          if(i)gz.write(',')
          if(table==='asset_blobs'){
            gz.write('"asset_blobs":[')
            for(let j=0;j<records.length;j++){
              if(j)gz.write(',')
              gz.write(JSON.stringify({id:records[j].id,contentBase64:records[j].content.toString('base64')}))
            }
            gz.write(']')
          }else gz.write(JSON.stringify(table)+':'+JSON.stringify(records))
        }
        gz.end('}}')
      }catch(err){console.error('[EXPORT XATO]',err?.message);gz.destroy(err)}
      return
    }
    if(path==='/api/bootstrap'&&method==='GET'){
      const result={user:safeUser(actor),users:await sanitizeUserList(actor),schools:await allSchools(),classes:await allClasses(),state:Object.fromEntries(await Promise.all(['books','questions','testSets','assignments','adminSettings','quarterGates'].map(async k=>[k,await state(k)]))),testAttempts:await attemptsFor(actor)}
      if(actor.role==='student'||actor.role==='parent'){
        // Do not send correct answer keys to learners before/during tests.
        result.state.questions=(result.state.questions||[]).map(q=>({...q,correct:-1}))
      }
      return send(res,200,result)
    }
    if(path==='/api/leaderboard'&&method==='GET')return send(res,200,{rows:await leaderboard(actor,Number(url.searchParams.get('grade'))||0,Number(url.searchParams.get('classId'))||0)})
    if(path==='/api/practice/questions'&&method==='GET'){
      if(actor.role!=='student')return fail(res,403,'Faqat o‘quvchi')
      const grade=(await get('SELECT grade FROM classes WHERE id=?',actor.class_id))?.grade
      const visible=PRACTICE.filter(q=>q.grade===grade).map(({right,why,...q})=>q)
      return send(res,200,{questions:visible,grade})
    }
    if(path==='/api/practice/progress'&&method==='GET'){
      if(actor.role!=='student')return fail(res,403,'Faqat o‘quvchi')
      const records=await all('SELECT question_id,MAX(correct) as mastered,COUNT(*) AS attempts FROM practice_attempts WHERE user_id=? GROUP BY question_id',actor.id)
      return send(res,200,{mastered:records.filter(r=>r.mastered).length,attempted:records.length,totalAttempts:records.reduce((n,r)=>n+r.attempts,0),items:records})
    }
    if(path==='/api/practice/answer'&&method==='POST'){
      if(actor.role!=='student')return fail(res,403,'Faqat o‘quvchi')
      const d=await readJson(req),q=PRACTICE.find(q=>q.id===d.id)
      const grade=(await get('SELECT grade FROM classes WHERE id=?',actor.class_id))?.grade
      if(!q||q.grade!==grade||!Number.isInteger(d.answer)||d.answer<0||d.answer>3)return fail(res,400,'Mashq yoki javob noto‘g‘ri')
      const correct=Number(q.right===d.answer)
      await run('INSERT INTO practice_attempts(user_id,question_id,correct,created_at) VALUES(?,?,?,?)',actor.id,q.id,correct,Date.now())
      await audit(actor,'practice.answer',q.topic)
      return send(res,200,{correct:Boolean(correct),explanation:q.why})
    }

    if(path==='/api/schools'&&method==='GET'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      return send(res,200,{schools:await allSchools()})
    }
    if(path==='/api/schools'&&method==='POST'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      const d=await readJson(req),name=clean(d.name),region=clean(d.region),district=clean(d.district),code=clean(d.code)
      if(name.length<3||name.length>120||region.length>100||district.length>100||code.length>30)return fail(res,400,'Maktab ma’lumotlari noto‘g‘ri')
      const id=Number((await run('INSERT INTO schools(name,region,district,code) VALUES(?,?,?,?)',name,region,district,code)).lastInsertRowid)
      await audit(actor,'school.create',name);return send(res,201,{school:await get('SELECT id,name,region,district,code FROM schools WHERE id=?',id)})
    }
    const schoolMatch=/^\/api\/schools\/(\d+)$/.exec(path)
    if(schoolMatch&&['PATCH','DELETE'].includes(method)){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      const id=Number(schoolMatch[1]),school=await validSchool(id)
      if(!school)return fail(res,404,'Maktab topilmadi')
      if(method==='DELETE'){
        if((await get('SELECT COUNT(*) AS n FROM classes WHERE school_id=?',id)).n)return fail(res,409,'Avval maktab sinflarini boshqa maktabga o‘tkazing yoki o‘chiring')
        await run('DELETE FROM schools WHERE id=?',id);return send(res,200,{ok:true})
      }
      const d=await readJson(req),name=clean(d.name),region=clean(d.region),district=clean(d.district),code=clean(d.code)
      if(name.length<3||name.length>120||region.length>100||district.length>100||code.length>30)return fail(res,400,'Maktab ma’lumotlari noto‘g‘ri')
      await run('UPDATE schools SET name=?,region=?,district=?,code=? WHERE id=?',name,region,district,code,id)
      return send(res,200,{school:await get('SELECT id,name,region,district,code FROM schools WHERE id=?',id)})
    }
    if(path==='/api/classes'&&method==='POST'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      const d=await readJson(req),grade=Number(d.grade),name=clean(d.name)
      const schoolId=Number(d.schoolId)||defaultSchool
      if(![5,6,7,8,9].includes(grade)||!name||name.length>40||!await validSchool(schoolId))return fail(res,400,'Sinf, daraja yoki maktab noto‘g‘ri')
      if(await get('SELECT id FROM classes WHERE school_id=? AND name=?',schoolId,name))return fail(res,409,'Bu maktabda shunday sinf mavjud')
      const id=Number((await run('INSERT INTO classes(name,grade,school_id) VALUES (?,?,?)',name,grade,schoolId)).lastInsertRowid)
      return send(res,201,{id,name,grade,schoolId})
    }
    const classMatch=/^\/api\/classes\/(\d+)$/.exec(path)
    if(classMatch&&['PATCH','DELETE'].includes(method)){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      const id=Number(classMatch[1]),row=await get('SELECT * FROM classes WHERE id=?',id)
      if(!row)return fail(res,404,'Sinf topilmadi')
      if(method==='DELETE'){
        if((await get('SELECT COUNT(*) AS n FROM users WHERE class_id=? AND active=1',id)).n)return fail(res,409,'Bu sinfda o‘quvchilar mavjud')
        if((await state('assignments')||[]).some(a=>a.classId===id))return fail(res,409,'Bu sinfga testlar tayinlangan')
        await run('DELETE FROM classes WHERE id=?',id);return send(res,200,{ok:true})
      }
      const d=await readJson(req),name=clean(d.name??row.name),grade=Number(d.grade??row.grade)
      const schoolId=Number(d.schoolId??row.school_id),teacherId=d.teacherId===null?null:Number(d.teacherId??row.teacher_id)||null
      if(![5,6,7,8,9].includes(grade)||!name||name.length>40||!await validSchool(schoolId)||!await validTeacher(teacherId))return fail(res,400,'Sinf yoki o‘qituvchi noto‘g‘ri')
      if(await get('SELECT id FROM classes WHERE school_id=? AND name=? AND id<>?',schoolId,name,id))return fail(res,409,'Bu nomli sinf mavjud')
      await run('UPDATE classes SET name=?,grade=?,school_id=?,teacher_id=? WHERE id=?',name,grade,schoolId,teacherId,id)
      return send(res,200,{class:(await allClasses()).find(c=>c.id===id)})
    }
    if(path==='/api/users'&&method==='POST'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      const d=await readJson(req),role=clean(d.role)
      if(!['teacher','student','parent'].includes(role)||!validLogin(clean(d.username))||!validPass(d.password)||clean(d.name).length<2)return fail(res,400,'Ism, rol, login va kamida 8 belgili parol kiriting')
      if(role==='student'&&!await get('SELECT id FROM classes WHERE id=?',Number(d.classId)))return fail(res,400,'Sinfni tanlang')
      if(role==='parent'&&d.childIds&&!await validChildren(d.childIds))return fail(res,400,'Farzand ID larini tekshiring')
      const salt=randomBytes(16).toString('hex');const id=Number((await run('INSERT INTO users(username,name,role,class_id,child_ids,salt,pass_hash) VALUES(?,?,?,?,?,?,?)',clean(d.username).toLowerCase(),clean(d.name),role,role==='student'?Number(d.classId)||null:null,JSON.stringify(role==='parent'&&Array.isArray(d.childIds)?d.childIds:[]),salt,passHash(d.password,salt))).lastInsertRowid)
      return send(res,201,{user:safeUser(await get('SELECT * FROM users WHERE id=?',id))})
    }
    const userMatch=/^\/api\/users\/(\d+)$/.exec(path)
    if(userMatch&&method==='PATCH'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      const id=Number(userMatch[1]),d=await readJson(req),u=await get('SELECT * FROM users WHERE id=?',id)
      if(!u)return fail(res,404,'Foydalanuvchi yo‘q')
      if(u.role==='admin'&&actor.id!==id)return fail(res,403,'Boshqa adminni o‘zgartirmang')
      const name=clean(d.name)||u.name;const classId=u.role==='student'?Number(d.classId)||null:null
      if(u.role==='student'&&classId&&!await get('SELECT id FROM classes WHERE id=?',classId))return fail(res,400,'Sinf topilmadi')
      const childIds=u.role==='parent'&&Array.isArray(d.childIds)?d.childIds:JSON.parse(u.child_ids||'[]')
      if(u.role==='parent'&&!await validChildren(childIds))return fail(res,400,'Farzandlardan biri mavjud emas')
      const active=u.role==='admin'?1:d.active===undefined?u.active:Number(Boolean(d.active))
      if(d.password!==undefined&&!validPass(d.password))return fail(res,400,'Yangi parol kamida 8 belgi')
      await run('UPDATE users SET name=?,class_id=?,child_ids=?,active=? WHERE id=?',name,classId,JSON.stringify(childIds),active,id)
      if(d.password!==undefined){const salt=randomBytes(16).toString('hex');await run('UPDATE users SET salt=?,pass_hash=? WHERE id=?',salt,passHash(d.password,salt),id);await run('DELETE FROM sessions WHERE user_id=?',id)}
      if(u.role==='teacher'&&Array.isArray(d.teacherClassIds)){
        await run('UPDATE classes SET teacher_id=NULL WHERE teacher_id=?',id)
        for(const c of d.teacherClassIds){if(!await get('SELECT id FROM classes WHERE id=?',Number(c)))return fail(res,400,'Sinf topilmadi')}
        for(const c of d.teacherClassIds)await run('UPDATE classes SET teacher_id=? WHERE id=?',id,Number(c))
      }
      return send(res,200,{user:safeUser(await get('SELECT * FROM users WHERE id=?',id))})
    }
    if(userMatch&&method==='DELETE'){
      if(actor.role!=='admin')return fail(res,403,'Faqat administrator')
      const id=Number(userMatch[1]);if(id===actor.id)return fail(res,403,'O‘zingizni o‘chira olmaysiz')
      await run('UPDATE users SET active=0 WHERE id=? AND role<>\'admin\'',id);await run('DELETE FROM sessions WHERE user_id=?',id)
      return send(res,200,{ok:true})
    }
    const stateMatch=/^\/api\/state\/(books|questions|testSets|assignments|adminSettings|quarterGates)$/.exec(path)
    if(stateMatch&&method==='PUT'){
      const k=stateMatch[1];if(!['admin','teacher'].includes(actor.role)||actor.role==='teacher'&&['adminSettings','quarterGates'].includes(k))return fail(res,403,'Ruxsat yo‘q')
      const d=await readJson(req)
      if(!Array.isArray(d.value)&&k!=='adminSettings')return fail(res,400,'Noto‘g‘ri ma’lumot')
      if(k==='quarterGates'&&(d.value.length>20||d.value.some(g=>![5,6,7,8,9].includes(g.grade)||![1,2,3,4].includes(g.quarter)||typeof g.enabled!=='boolean')))return fail(res,400,'Chorak sozlamalari noto‘g‘ri')
      if(k==='assignments'&&actor.role==='teacher'){
        const mine=(await all('SELECT id FROM classes WHERE teacher_id=?',actor.id)).map(c=>c.id)
        const old=await state('assignments')||[]; if(d.value.filter(a=>!old.some(x=>x.id===a.id)).some(a=>!mine.includes(a.classId)) || old.filter(a=>!mine.includes(a.classId)).some(a=>!d.value.some(x=>x.id===a.id&&x.classId===a.classId&&x.testId===a.testId)))return fail(res,403,'O‘zingizga tegishli sinflargagina tayinlang')
      }
      await store(k,d.value);await audit(actor,'state.update',k);return send(res,200,{ok:true})
    }
    if(path==='/api/exams/current'&&method==='GET'){
      const ex=await get("SELECT * FROM exams WHERE user_id=? AND status='running' ORDER BY started_at DESC LIMIT 1",actor.id)
      return send(res,200,{exam:ex?{id:ex.id,testId:ex.test_id,startedAt:ex.started_at,deadlineAt:ex.deadline_at,answers:JSON.parse(ex.answers)}:null})
    }
    if(path==='/api/exams/start'&&method==='POST'){
      if(actor.role!=='student')return fail(res,403,'Faqat o‘quvchi test ishlaydi')
      const d=await readJson(req),test=(await state('testSets')||[]).find(t=>t.id===Number(d.testId))
      await verifyExam(test,actor)
      const active=await get("SELECT id FROM exams WHERE user_id=? AND status='running'",actor.id)
      if(active)return fail(res,409,'Boshlangan testingiz bor')
      const duration=(test.durationMinutes??(await state('adminSettings'))?.durationMinutes??20)*60000
      const start=Date.now(),deadline=Math.min(start+duration,test.availableUntil?new Date(test.availableUntil).getTime():Infinity),id=randomBytes(18).toString('hex')
      await run('INSERT INTO exams(id,user_id,test_id,started_at,deadline_at) VALUES(?,?,?,?,?)',id,actor.id,test.id,start,deadline)
      await audit(actor,'exam.start',test.title);return send(res,201,{exam:{id,testId:test.id,startedAt:start,deadlineAt:deadline,answers:{}}})
    }
    if(path==='/api/exams/answer'&&method==='POST'){
      const d=await readJson(req),ex=await get("SELECT * FROM exams WHERE id=? AND user_id=? AND status='running'",clean(d.examId),actor.id)
      if(!ex)return fail(res,404,'Boshlangan test yo‘q')
      if(Date.now()>=ex.deadline_at)return fail(res,409,'Test vaqti tugagan')
      const test=(await state('testSets')||[]).find(t=>t.id===ex.test_id)
      const qid=Number(d.questionId),value=Number(d.answer)
      if(!test?.questionIds.includes(qid)||!Number.isInteger(value)||value<0||value>3)return fail(res,400,'Javob noto‘g‘ri')
      const answers=JSON.parse(ex.answers||'{}');answers[qid]=value;await run('UPDATE exams SET answers=? WHERE id=?',JSON.stringify(answers),ex.id)
      return send(res,200,{ok:true})
    }
    if(path==='/api/exams/finish'&&method==='POST'){
      const d=await readJson(req),ex=await get('SELECT * FROM exams WHERE id=? AND user_id=?',clean(d.examId),actor.id)
      if(!ex)return fail(res,404,'Test topilmadi')
      const record=await finishExam(actor,ex);await audit(actor,'exam.finish',record.testTitle);return send(res,200,{record})
    }
    return fail(res,404,'Manzil topilmadi')
  }catch(e){const message=e?.message||'Server xatoligi';if(e?.code==='23505'||message.includes('UNIQUE constraint failed'))return fail(res,409,'Bu login band, boshqa login tanlang');console.error('[API]',message);return fail(res,400,message)}
})
const PORT=Number(process.env.PORT||process.env.MD_API_PORT||4317)
const HOST=process.env.MD_BIND_HOST||'0.0.0.0'
server.listen(PORT,HOST,()=>console.log(`MATH-DIAGNOZ ${schoolMode?'MAKTAB LAN':'LOCAL'}: http://localhost:${PORT} (host ${HOST})`))
