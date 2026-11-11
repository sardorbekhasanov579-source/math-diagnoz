import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import mammoth from 'mammoth'
import AuthScreen, { api, type SignedUser } from './AuthScreen'
import PublicLanding from './PublicLanding'
import PracticePanel from './PracticePanel'
import V2Modules from './V2Modules'
import MathAnswer from './MathAnswer'
import ParentChildPicker from './ParentChildPicker'
import TeacherParentLinks from './TeacherParentLinks'
import AssessmentReport from './AssessmentReport'
import './App.css'

type Page = 'schools' | 'diagnostics' | 'dashboard' | 'books' | 'chapters' | 'questions' | 'tests' | 'students' | 'reports' | 'settings' | 'classes' | 'users' | 'assignments' | 'library' | 'children' | 'ranking' | 'quarterly' | 'system' | 'practice' | 'admins' | 'ai' | 'international' | 'teacher-tools' | 'student-assistant' | 'help' | 'parent-links'
type Chapter = { id: number; title: string; topics: string[]; startPage?: number; endPage?: number }
type Book = { id: number; title: string; grade: number; author: string; chapters: Chapter[]; pdfKey?: string; pdfName?: string }
type Question = { id: number; bookId: number; chapterId: number; topic?: string; text: string; options: string[]; correct: number; imageKeys?: string[]; optionImageKeys?: string[][] }
type TestSet = { id: number; title: string; bookId: number; chapterId: number; questionIds: number[]; active: boolean; createdAt: string;
  durationMinutes?: number; attemptLimit?: number; passingPercent?: number; showResult?: boolean; availableFrom?: string; availableUntil?: string; kind?: 'regular' | 'quarter'; quarter?: number }
type TopicResult = { topic: string; correct: number; total: number }
type TestAttempt = { id: number; testId: number; testTitle: string; grade: number; score: number; total: number; topicResults: TopicResult[]; createdAt: string;
  reason?: 'submitted' | 'expired'; passed?: boolean; durationMinutes?: number; elapsedSeconds?: number; studentId?: number; classId?: number }

type AdminSettings = { durationMinutes: number; maxAttempts: number; passingPercent: number; showResult: boolean; warnBeforeMinutes: number }
type ActiveSession = { testId: number; studentId?: number; startedAt: number; deadlineAt: number; questionIds: number[];
  answers: Record<number,number>; status: 'running' | 'finished'; resultId?: number; serverExamId?: string; durationMinutes: number; passingPercent: number; showResult: boolean }
type DemoRole = 'admin' | 'assistant_admin' | 'teacher' | 'student' | 'parent'
type School = { id:number; name:string; region:string; district:string; code:string }
type QuarterGate = {grade: number; quarter: number; enabled: boolean}
type SchoolClass = { id: number; name: string; grade: number; teacherId?: number | null; schoolId?: number }
type DemoUser = { id: number; name: string; role: DemoRole; username?: string; classId?: number; childIds?: number[]; active: boolean; verified?: boolean; lastLoginAt?: number | null }
type Assignment = { id: number; testId: number; classId: number; createdAt: string; startAt?: string }
type AssignmentStudentStatus = {id:number; name:string; status:'scheduled'|'pending'|'running'|'finished'|'expired'|'closed'; attempts:number; score:number|null; total:number|null; finishedAt:string|null; startedAt:number|null}
type AssignmentStatus = {id:number;testId:number;classId:number;startAt:string|null;endAt:string|null;total:number;finished:number;running:number;waiting:number;expired:number;students:AssignmentStudentStatus[]}
function scheduledStart(assignment:Assignment|undefined, test:TestSet):number{
  const values=[assignment?.createdAt,assignment?.startAt,test.availableFrom].filter(Boolean).map(v=>Date.parse(v!)).filter(Number.isFinite)
  if(!values.length&&assignment?.createdAt)values.push(Date.parse(assignment.createdAt))
  return values.length?Math.max(...values):0
}
function localDatetimeInput(value:string|undefined):string{
  if(!value)return ''
  const date=new Date(value)
  if(!Number.isFinite(date.getTime()))return ''
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60000)
  return local.toISOString().slice(0,16)
}
function dateInputToIso(value:string):string|undefined{
  if(!value)return undefined
  const date=new Date(value)
  return Number.isFinite(date.getTime())?date.toISOString():undefined
}
function displayDateTime(value:string|number|null|undefined):string{
  if(value===undefined||value===null||value==='')return 'Belgilanmagan'
  const date=new Date(value)
  return Number.isFinite(date.getTime())?date.toLocaleString('uz-UZ',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'Belgilanmagan'
}
const DEMO_CLASSES: SchoolClass[] = [
  {id:101,name:'5-A',grade:5,teacherId:2},
  {id:102,name:'7-A',grade:7,teacherId:2},
  {id:103,name:'9-A',grade:9,teacherId:2},
]
const DEMO_USERS: DemoUser[] = [
  {id:1,name:'Administrator (namuna)',role:'admin',active:true},
  {id:2,name:'O‘qituvchi (namuna)',role:'teacher',active:true},
  {id:3,name:'O‘quvchi 1 (namuna)',role:'student',classId:101,active:true},
  {id:4,name:'O‘quvchi 2 (namuna)',role:'student',classId:102,active:true},
  {id:5,name:'O‘quvchi 3 (namuna)',role:'student',classId:101,active:true},
  {id:6,name:'Ota-ona (namuna)',role:'parent',childIds:[3,5],active:true},
]
const ROLE_NAMES: Record<DemoRole,string> = {admin:'Super-admin',assistant_admin:'Yordamchi admin',teacher:'O‘qituvchi',student:'O‘quvchi',parent:'Ota-ona'}
const CLASS_KEY = 'math-diagnoz-classes-v08'
const USER_KEY = 'math-diagnoz-users-v08'
const ASSIGN_KEY = 'math-diagnoz-assignments-v08'
const DEFAULT_ADMIN_SETTINGS: AdminSettings = { durationMinutes: 20, maxAttempts: 3, passingPercent: 60, showResult: true, warnBeforeMinutes: 5 }
const SETTINGS_KEY = 'math-diagnoz-admin-settings-v07'
const SESSION_KEY = 'math-diagnoz-student-session-v07'
function isAvailableNow(test: TestSet, now: number): boolean {
  if (!test.active) return false
  if (test.availableFrom && now < new Date(test.availableFrom).getTime()) return false
  if (test.availableUntil && now >= new Date(test.availableUntil).getTime()) return false
  return true
}
function formatCountdown(sec: number): string {
  const s = Math.max(0, sec)
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
function csvSafe(value: string | number): string {
  const raw = String(value)
  const protectedValue = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${protectedValue.replace(/"/g, '""')}"`
}
function downloadText(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], {type:mime}))
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click()
  window.setTimeout(()=>URL.revokeObjectURL(url), 1000)
}


type ParsedWordQuestion = { text: string; options: string[]; correct: number; topic?: string; images: string[]; optionImages: string[][] }
type WordParseResult = { questions: ParsedWordQuestion[]; errors: string[] }


// Yangi PDF/rasmlar serverda. Eski fayllar uchun IndexedDB o‘qish migratsiyasi saqlangan.
const DB_NAME = 'math-diagnoz-local-v2'
const PDF_STORE = 'pdf-files'
const IMAGE_STORE = 'question-images'
function pdfDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PDF_STORE)) db.createObjectStore(PDF_STORE)
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function checkedResponse(res: Response, fallback: string): Promise<any> {
 const text = await res.text().catch(() => '')
 let payload: any = {}
 try { payload = JSON.parse(text) } catch { /* Proxy may return HTML instead of JSON */ }
 if (!res.ok) throw new Error(payload.error || `${fallback} (HTTP ${res.status}). Internet, server va fayl hajmini tekshiring.`)
 return payload
}
// Store big PDFs in small independently retried pieces; existing server: keys remain valid.
async function uploadPdfChunked(file: File, onProgress?: (loaded: number, total: number) => void): Promise<string> {
 const size=2*1024*1024, parts=Math.ceil(file.size/size)
 let id=''
 try {
  const start=await fetch('/api/assets/pdf/start',{
   method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({name:file.name,bytes:file.size,parts})
  })
  const session=await checkedResponse(start,'PDF yuklashni boshlashda xato')
  id=session.id
  if(!/^[a-f0-9]{36}$/.test(id)||session.partSize!==size)throw new Error('Server PDF yuklash protokolini qo‘llab-quvvatlamayapti')
  for(let index=0;index<parts;index++) {
   const chunk=file.slice(index*size,Math.min(file.size,(index+1)*size))
   let error: Error | null=null
   for(let attempt=0;attempt<3;attempt++) {
    try {
     const res=await fetch(`/api/assets/pdf/${id}/parts/${index}`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream'},body:chunk})
     await checkedResponse(res,`PDFning ${index+1}-bo‘lagini yuklashda xato`)
     error=null;break
    } catch (e) {error=e instanceof Error?e:new Error('Tarmoq xatosi');if(attempt<2)await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)))}
   }
   if(error)throw error
   onProgress?.(index+1,parts)
  }
  const done=await fetch(`/api/assets/pdf/${id}/complete`,{method:'POST',credentials:'same-origin'})
  const result=await checkedResponse(done,'PDF saqlanishini tasdiqlashda xato')
  if(typeof result.key!=='string'||!result.key.startsWith('server:'))throw new Error('Server PDF kalitini qaytarmadi')
  return result.key
 } catch (e) {
  if(id)void fetch(`/api/assets/pdf/${id}`,{method:'DELETE',credentials:'same-origin'}).catch(()=>{})
  throw e
 }
}
async function uploadAsset(kind:'pdf'|'image',data:Blob,name:string):Promise<string>{
 const res=await fetch(`/api/assets/${kind}?name=${encodeURIComponent(name)}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':data.type || 'application/octet-stream'},body:data})
 const payload=await res.json().catch(()=>({error:'Server fayl javobini o‘qib bo‘lmadi'}))
 if(!res.ok)throw new Error(payload.error || 'Serverga fayl yuklanmadi')
 return payload.key as string
}
async function serverAsset(key:string):Promise<Blob|undefined>{
 if(!key.startsWith('server:'))return undefined
 const res=await fetch(`/api/assets/${key.slice(7)}`,{credentials:'same-origin'})
 if(!res.ok)throw new Error('Serverdagi faylni o‘qib bo‘lmadi')
 return res.blob()
}
async function savePdf(key: string, file: File, onProgress?: (done: number, total: number) => void): Promise<string> {
  if (key.startsWith('server:')) return key
  return uploadPdfChunked(file,onProgress)
}
async function loadPdf(key: string): Promise<Blob | undefined> {
  if(key.startsWith('server:'))return serverAsset(key)
  const db = await pdfDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_STORE, 'readonly')
      const request = tx.objectStore(PDF_STORE).get(key)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}
// Rasm fayllari localStorage emas, mavjud IndexedDB bazasida alohida saqlanadi.
async function saveImageBlob(key: string, blob: Blob): Promise<string> {
  return uploadAsset('image',blob,`test-${key}.png`)
}
async function loadImageBlob(key: string): Promise<Blob | undefined> {
  if(key.startsWith('server:'))return serverAsset(key)
  const db = await pdfDb()
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(IMAGE_STORE, 'readonly').objectStore(IMAGE_STORE).get(key)
      req.onsuccess = () => resolve(req.result as Blob | undefined)
      req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}
async function deleteImageBlob(key: string): Promise<void> {
  if(key.startsWith('server:'))return // Server may retain this asset for earlier backups.
  const db = await pdfDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, 'readwrite')
      tx.objectStore(IMAGE_STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally { db.close() }
}
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
function validImage(file: File) {
  return ['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) && file.size <= MAX_IMAGE_BYTES
}
function decodeImageDataUrl(dataUrl: string): Blob {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i.exec(dataUrl)
  if (!match) throw new Error('Word rasmining formati qo‘llab-quvvatlanmaydi (PNG, JPG, WEBP, GIF).')
  const bin = atob(match[2])
  if (bin.length > MAX_IMAGE_BYTES) throw new Error('Worddagi bir rasm 4 MB dan katta bo‘lmasin.')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: match[1].toLowerCase() })
}
function makeImageKey() { return `question-image-${Date.now()}-${Math.random().toString(36).slice(2)}` }
function allImageKeys(q: Question) { return [...(q.imageKeys || []), ...(q.optionImageKeys || []).flat()] }

function SavedQuestionImages({ imageKeys, label }: { imageKeys?: string[]; label: string }) {
  const [urls, setUrls] = useState<string[]>([])
  const joined = (imageKeys || []).join('|')
  useEffect(() => {
    let live = true
    const localUrls: string[] = []
    const keys = joined ? joined.split('|') : []
    void Promise.all(keys.map(async key => {
      const blob = await loadImageBlob(key)
      if (!blob) return ''
      const url = URL.createObjectURL(blob)
      localUrls.push(url)
      return url
    })).then(result => { if (live) setUrls(result.filter(Boolean)); else localUrls.forEach(URL.revokeObjectURL) })
      .catch(() => { if (live) setUrls([]) })
    return () => { live = false; localUrls.forEach(URL.revokeObjectURL) }
  }, [joined])
  if (!joined) return null
  return <div className="md-image-gallery">{urls.map((url, i) => <img key={url} src={url} alt={`${label} — ${i+1}-rasm`} loading="lazy" />)}</div>
}

function readStored<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback }
  catch { return fallback }
}

const grades = [5, 6, 7, 8, 9] as const

const initialBooks: Book[] = [
  { id: 1, title: 'Matematika', grade: 5, author: 'Namuna darslik', chapters: [
    { id: 11, title: 'Natural sonlar', topics: ['Natural sonlarni taqqoslash', 'Amallar'] },
    { id: 12, title: 'Geometrik shakllar', topics: ['Shakllar va ularning xossalari', 'Perimetr va yuza'] },
    { id: 13, title: 'Oddiy kasrlar', topics: ['Kasr tushunchasi'] },
  ] },
]
const nav: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Boshqaruv paneli', icon: '▦' },
  { id: 'books', label: 'Elektron darsliklar', icon: '▤' },
  { id: 'chapters', label: 'Bob va mavzular', icon: '▱' },
  { id: 'questions', label: 'Savollar banki', icon: '☷' },
  { id: 'tests', label: 'Testlarni boshqarish', icon: '◫' },
  { id: 'quarterly', label: 'Choraklik testlar', icon: '▦' },
  { id: 'students', label: 'O‘quvchilar', icon: '♙' },
  { id: 'reports', label: 'Hisobotlar', icon: '▥' },
  { id: 'settings', label: 'Admin sozlamalari', icon: '⚙' },
  { id: 'system', label: 'Tizim va zaxira', icon: '◈' },
  { id: 'practice', label: 'Individual mashqlar', icon: '✦' },
  { id: 'schools', label: 'Maktablar', icon: '⌂' },
  { id: 'classes', label: 'Maktab sinflari', icon: '▦' },
  { id: 'diagnostics', label: 'Matematik diagnostika', icon: '◉' },
  { id: 'users', label: 'Foydalanuvchilar', icon: '♧' },
  { id: 'parent-links', label: 'Ota-onani biriktirish', icon: '♧' },
  { id: 'admins', label: 'Super-admin va yordamchilar', icon: '♛' },
  { id: 'assignments', label: 'Testni sinfga yuborish', icon: '⇢' },
  { id: 'library', label: 'Darsliklarni o‘qish', icon: '▤' },
  { id: 'children', label: 'Farzandlar natijasi', icon: '♧' },
  { id: 'ranking', label: 'O‘quvchilar reytingi', icon: '🏆' },
  {id:'ai',label:'AI test generatori',icon:'✦'},
  {id:'international',label:'Xalqaro baholash',icon:'◉'},
  {id:'teacher-tools',label:'O‘qituvchi yordamchisi',icon:'⚒'},
  {id:'student-assistant',label:'O‘quvchi yordamchisi',icon:'✦'},
  {id:'help',label:'Yordam markazi',icon:'? '},
]

const NAV_GROUPS: {title:string;icon:string;ids:Page[]}[] = [
  {title:'Bosh sahifa',icon:'⌂',ids:['dashboard']},
  {title:'Maktab boshqaruvi',icon:'🏫',ids:['schools','classes','students','users','parent-links','admins']},
  {title:'Ta’lim materiallari',icon:'▤',ids:['books','chapters','library']},
  {title:'Test va diagnostika',icon:'☑',ids:['questions','tests','quarterly','assignments','diagnostics','reports','ranking','practice']},
  {title:'Xalqaro baholash',icon:'🌐',ids:['international']},
  {title:'AI va ta’lim yordamchilari',icon:'✦',ids:['ai','teacher-tools','student-assistant']},
  {title:'Tizim boshqaruvi',icon:'⚙',ids:['settings','system']},
  {title:'Yordam markazi',icon:'?',ids:['help']}
]

// Mammoth Worddagi matn va rasmlarni HTMLga aylantiradi. HTMLni kod sifatida
// ko‘rsatmaymiz: faqat matn hamda rasmning data: URI manzilini ajratamiz.
function parseWordQuestions(html: string): WordParseResult {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = Array.from(doc.body.querySelectorAll('p, li'))
  const result: ParsedWordQuestion[] = []
  const errors: string[] = []
  let draft: { text: string; options: Record<string,string>; answer: string; topic?: string; images: string[]; optionImages: Record<string,string[]> } | null = null
  let questionNo = 0
  let lastPart: 'question' | 'A' | 'B' | 'C' | 'D' = 'question'
  const optionNames = ['A','B','C','D'] as const
  function finish() {
    if (!draft) return
    const d = draft
    const missing = optionNames.filter(k => !d.options[k]?.trim() && !d.optionImages[k]?.length)
    if ((!d.text.trim() && !d.images.length) || missing.length || !optionNames.includes(d.answer as typeof optionNames[number])) {
      errors.push(`${questionNo}-savol: ${missing.length ? `yetishmayotgan variantlar: ${missing.join(', ')}` : (!d.text.trim() && !d.images.length) ? 'savol matni yoki rasmi yo‘q' : 'JAVOB: A, B, C yoki D bo‘lishi kerak'}`)
    } else {
      result.push({text:d.text, options:optionNames.map(k=>d.options[k]||''), correct:optionNames.indexOf(d.answer as typeof optionNames[number]), topic:d.topic, images:d.images, optionImages:optionNames.map(k=>d.optionImages[k]||[])})
    }
    draft = null
  }
  for (const block of blocks) {
    const lines = (block.textContent || '').replace(/\r/g, '').split('\n').map(x=>x.trim()).filter(Boolean)
    const imgs = Array.from(block.querySelectorAll('img')).map(img => img.getAttribute('src') || '').filter(Boolean)
    if (!lines.length && imgs.length && draft) {
      if (lastPart === 'question') draft.images.push(...imgs)
      else (draft.optionImages[lastPart] ||= []).push(...imgs)
      continue
    }
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]
      const lineImages = lineIndex === 0 ? imgs : []
      const q = line.match(/^\s*(?:\d+[.)]\s*)?SAVOL\s*:\s*(.*)$/i)
      if (q) { finish(); questionNo++; draft = {text:q[1].trim(),options:{},answer:'',images:[...lineImages],optionImages:{}}; lastPart='question'; continue }
      if (!draft) continue
      const topic = line.match(/^MAVZU\s*:\s*(.*)$/i)
      if (topic) { draft.topic = topic[1].trim() || undefined; continue }
      const answer = line.match(/^JAVOB\s*:\s*([A-D])\s*[).]?\s*$/i)
      if (answer) { draft.answer=answer[1].toUpperCase(); continue }
      const opt = line.match(/^([A-D])\s*[).:]\s*(.*)$/i)
      if (opt) { const k=opt[1].toUpperCase(); draft.options[k]=opt[2].trim(); (draft.optionImages[k] ||= []).push(...lineImages); lastPart=k as typeof lastPart; continue }
      if (draft.answer || /^(IZOH|ESLATMA)\s*:/i.test(line)) continue
      if (lastPart==='question') {draft.text += ' ' + line; draft.images.push(...lineImages)}
      else { draft.options[lastPart]=(draft.options[lastPart]||'')+' '+line; (draft.optionImages[lastPart] ||= []).push(...lineImages) }
    }
  }
  finish()
  if (!questionNo) errors.push('Word faylda SAVOL: bilan boshlanadigan savol topilmadi.')
  return {questions:result,errors}
}


/** MATH-DIAGNOZ local pilot: login + 4 roles + leaderboards. */
function App() {
  // Local server validates user passwords and sessions; production audit is still required.
  const [schools, setSchools] = useState<School[]>([])
  const [openSchoolId, setOpenSchoolId] = useState<number | null>(null)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [showSchoolForm, setShowSchoolForm] = useState(false)
  const [schoolStudentSearch, setSchoolStudentSearch] = useState('')
  const [quarterGates, setQuarterGates] = useState<QuarterGate[]>([])
  const [quarterGrade, setQuarterGrade] = useState(5)
  const [quarterNumber, setQuarterNumber] = useState(1)
  const [draftTestKind, setDraftTestKind] = useState<'regular'|'quarter'>('regular')
  const [draftTestQuarter, setDraftTestQuarter] = useState(1)
  const [classes, setClasses] = useState<SchoolClass[]>(() => readStored(CLASS_KEY, DEMO_CLASSES))
  const [users, setUsers] = useState<DemoUser[]>(() => readStored(USER_KEY, DEMO_USERS))
  const [assignments, setAssignments] = useState<Assignment[]>(() => readStored(ASSIGN_KEY, []))
  const [currentUserId, setCurrentUserId] = useState(1)
  const [authUser, setAuthUser] = useState<SignedUser | null>(null)
  const [entryView, setEntryView] = useState<'home' | 'login' | 'register'>('home')
  const [showPublicPage, setShowPublicPage] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [diagnosticStudentId,setDiagnosticStudentId] = useState(0)
  // v2.1: filters are presentation-only; server users and results stay unchanged.
  const [userRoleFilter,setUserRoleFilter] = useState<'all'|DemoRole>('all')
  const [userSearch,setUserSearch] = useState('')
  const [studentSchoolFilter,setStudentSchoolFilter] = useState(0)
  const [studentClassFilter,setStudentClassFilter] = useState(0)
  const [editingTopicIndex,setEditingTopicIndex] = useState<number|null>(null)
  const [editingTopicName,setEditingTopicName] = useState('')
  const [rankGrade,setRankGrade] = useState(0)
  const [rankClass,setRankClass] = useState(0)
  const [ranking,setRanking] = useState<{studentId:number;displayName:string;className:string;grade:number;average:number;tests:number;rank:number;isMe:boolean}[]>([])
  const [newUserUsername,setNewUserUsername] = useState('')
  const [newUserPassword,setNewUserPassword] = useState('')
  const [userResetPassword,setUserResetPassword] = useState('')
  const [newTeacherClassIds,setNewTeacherClassIds] = useState<number[]>([])
  const [schoolEditingId,setSchoolEditingId] = useState<number|null>(null)
  const [schoolName,setSchoolName] = useState('')
  const [schoolRegion,setSchoolRegion] = useState('Surxondaryo')
  const [schoolDistrict,setSchoolDistrict] = useState('')
  const [schoolCode,setSchoolCode] = useState('')
  const [classSchoolId,setClassSchoolId] = useState(0)
  const [newClassGrade, setNewClassGrade] = useState(5)
  const [newClassName, setNewClassName] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [assistantName,setAssistantName]=useState('')
  const [assistantLogin,setAssistantLogin]=useState('')
  const [assistantPassword,setAssistantPassword]=useState('')
  const [newUserRole, setNewUserRole] = useState<DemoRole>('student')
  const [newUserClassId, setNewUserClassId] = useState(0)
  const [newParentChildIds, setNewParentChildIds] = useState<number[]>([])
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [assignmentTestId, setAssignmentTestId] = useState(0)
  const [assignmentClassId, setAssignmentClassId] = useState(0)
  const [assignmentStartInput,setAssignmentStartInput] = useState('')
  const [expandedAssignment,setExpandedAssignment] = useState<number|null>(null)
  const [previewAssignmentQuestions,setPreviewAssignmentQuestions] = useState(false)
  const [assignmentStatuses,setAssignmentStatuses] = useState<AssignmentStatus[]>([])
  const [assignmentStatusError,setAssignmentStatusError] = useState('')
  const [assignmentStatusLoading,setAssignmentStatusLoading] = useState(false)
  const [parentChildId, setParentChildId] = useState(3)
  const currentUser = authUser ? (users.find(u => u.id === authUser.id && u.role === authUser.role) || authUser) : (users.find(u => u.id === currentUserId) || DEMO_USERS[0])
  const role = currentUser.role
  const isManager = role==='admin'||role==='assistant_admin'
  const roleNav = nav.filter(n => {
    if (role === 'admin') return !['library','children','practice'].includes(n.id)
    if (role === 'assistant_admin') return !['library','children','practice','settings','system','admins'].includes(n.id)
    if (role === 'teacher') return ['dashboard','books','chapters','questions','tests','quarterly','assignments','students','parent-links','reports','library','ranking','diagnostics','ai','international','teacher-tools','student-assistant','help'].includes(n.id)
    if (role === 'student') return ['dashboard','library','students','quarterly','practice','reports','ranking','diagnostics','international','student-assistant','help'].includes(n.id)
    return ['dashboard','children','reports','ranking','diagnostics','help'].includes(n.id)
  }).map(n => n.id === 'students' && role === 'student' ? {...n,label:'Mening testlarim'} : n)
  const [loggedIn, setLoggedIn] = useState(false)
  const [page, setPage] = useState<Page>('dashboard')
  const [openGroups, setOpenGroups] = useState<Record<string,boolean>>({'Bosh sahifa':true,'AI va ta’lim yordamchilari':true})
  const [books, setBooks] = useState<Book[]>(() => readStored('math-diagnoz-books-v2', initialBooks))
  const [questions, setQuestions] = useState<Question[]>(() => readStored('math-diagnoz-questions-v2', []))
  const [testSets, setTestSets] = useState<TestSet[]>(() => readStored('math-diagnoz-tests-v06', []))
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>(() => readStored('math-diagnoz-attempts-v06', []))
  const [newTestName, setNewTestName] = useState('')
  const [chosenQuestions, setChosenQuestions] = useState<number[]>([])
  const [studentGrade, setStudentGrade] = useState(5)
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => readStored(SETTINGS_KEY, DEFAULT_ADMIN_SETTINGS))
  const [settingsDraft, setSettingsDraft] = useState<AdminSettings>(adminSettings)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => readStored<ActiveSession | null>(SESSION_KEY, null))
  const [clockNow, setClockNow] = useState(Date.now())
  const finishLock = useRef(false)
  const [draftDuration, setDraftDuration] = useState('')
  const [draftAttempts, setDraftAttempts] = useState('')
  const [draftPassing, setDraftPassing] = useState('')
  const [draftShowResult, setDraftShowResult] = useState('default')
  const [draftAvailableFrom, setDraftAvailableFrom] = useState('')
  const [draftAvailableUntil, setDraftAvailableUntil] = useState('')

  const [selectedBook, setSelectedBook] = useState(1)
  const [bookTitle, setBookTitle] = useState('Matematika')
  const [bookGrade, setBookGrade] = useState(5)
  const [catalogGrade, setCatalogGrade] = useState(5)
  const [bookAuthor, setBookAuthor] = useState('')
  const [editingBookId, setEditingBookId] = useState<number | null>(null)
  const [editBookTitle, setEditBookTitle] = useState('')
  const [editBookAuthor, setEditBookAuthor] = useState('')
  const [editBookPdf, setEditBookPdf] = useState<File | null>(null)
  const [bookActionBusy, setBookActionBusy] = useState<number | null>(null)
  const [bookActionProgress, setBookActionProgress] = useState('')
  const skipNextCatalogSync = useRef(false)
  const [selectedChapter, setSelectedChapter] = useState(12)
  const [newChapter, setNewChapter] = useState('')
  const [startPage, setStartPage] = useState('')
  const [endPage, setEndPage] = useState('')
  const [topicForQuestion, setTopicForQuestion] = useState('')
  const [, setPreviewAnswers] = useState<Record<number, number>>({})
  const [, setPreviewFinished] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(0)
  const [notice, setNotice] = useState('')
  const [selectedPdfFiles, setSelectedPdfFiles] = useState<File[]>([])
  const [bookFileEpoch, setBookFileEpoch] = useState(0)
  const [bookUploadProgress, setBookUploadProgress] = useState('')
  const [uploading, setUploading] = useState(false)
  const [wordBusy, setWordBusy] = useState(false)
  const [wordPreview, setWordPreview] = useState<WordParseResult | null>(null)
  const [wordFileName, setWordFileName] = useState('')
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
  const [questionImageFile, setQuestionImageFile] = useState<File | null>(null)
  const [optionImageFiles, setOptionImageFiles] = useState<(File | null)[]>([null,null,null,null])
  const [keptQuestionImages, setKeptQuestionImages] = useState<string[]>([])
  const [keptOptionImages, setKeptOptionImages] = useState<string[][]>([[],[],[],[]])
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [fileInputEpoch, setFileInputEpoch] = useState(0)
  const [serverHealth,setServerHealth]=useState<{version:string;mode?:string;users:number;schools:number;classes:number;results:number;files:number;fileBytes:number;lastBackup:string|null}|null>(null)
  const [auditEvents,setAuditEvents]=useState<{actor:string|null;action:string;details:string;createdAt:number}[]>([])
  const [systemBusy,setSystemBusy]=useState(false)
  const [systemFeedback,setSystemFeedback]=useState('')
  async function refreshSystem(){
    if(role!=='admin')return
    try{
      const [health,events]=await Promise.all([
        api<NonNullable<typeof serverHealth>>('/api/system/health'),
        api<{events:typeof auditEvents}>('/api/system/activity')
      ])
      setServerHealth(health);setAuditEvents(events.events)
    }catch(error){setSystemFeedback(error instanceof Error?error.message:'Server ma’lumotlarini olib bo‘lmadi')}
  }
  async function createSystemBackup(){
    const cloud=serverHealth?.mode==='neon-render-pilot'
    if(!window.confirm(cloud?'Neon ma’lumotlarini (PDF va rasmlar bilan) kompyuterga zaxira fayl qilib yuklab olasizmi?':'SQLite baza va serverdagi PDF/rasmlarning zaxira nusxasini yaratasizmi?'))return
    setSystemBusy(true)
    try{
      if(cloud){
        const resp=await fetch('/api/system/backup/download',{credentials:'same-origin'})
        if(!resp.ok)throw new Error('Neon zaxira faylini yuklab bo‘lmadi')
        const blob=await resp.blob()
        const url=URL.createObjectURL(blob)
        const a=document.createElement('a');a.href=url;a.download=`math-diagnoz-neon-${new Date().toISOString().slice(0,10)}.json.gz`
        document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),3000)
        setSystemFeedback('Neon zaxirasi kompyuteringizga yuklandi. Faylni xavfsiz joyda saqlang!')
      }else{
        const result=await api<{folder:string}>('/api/system/backup','POST',{})
        setSystemFeedback(`Zaxira yaratildi: server/backups/${result.folder}`)
      }
      await refreshSystem()
    }catch(error){setSystemFeedback(error instanceof Error?error.message:'Zaxira yaratilmadi')}
    finally{setSystemBusy(false)}
  }
  async function migrateLocalFiles(){
    if(!window.confirm('Eski brauzer xotirasidagi PDF va rasmlarni serverga ko‘chirasizmi? Oldingi ma’lumotlar o‘chirilmaydi.'))return
    setSystemBusy(true)
    try{
      const nextBooks=[...books],nextQuestions=[...questions]
      let changed=0, missing=0
      for(let i=0;i<nextBooks.length;i++){
        const book=nextBooks[i],key=book.pdfKey
        if(!key||key.startsWith('server:'))continue
        const blob=await loadPdf(key)
        if(!blob){missing++;continue}
        const uploaded=await uploadAsset('pdf',blob,book.pdfName||`${book.title}.pdf`)
        nextBooks[i]={...book,pdfKey:uploaded};changed++
      }
      const cache=new Map<string,string>()
      for(let i=0;i<nextQuestions.length;i++){
        const q=nextQuestions[i]
        const convert=async(key:string)=>{
          if(key.startsWith('server:'))return key
          if(cache.has(key))return cache.get(key)!
          const blob=await loadImageBlob(key)
          if(!blob){missing++;return key}
          const uploaded=await uploadAsset('image',blob,`savol-${q.id}.png`)
          cache.set(key,uploaded);changed++
          return uploaded
        }
        const imageKeys=await Promise.all((q.imageKeys||[]).map(convert))
        const optionImageKeys=await Promise.all((q.optionImageKeys||[]).map(keys=>Promise.all(keys.map(convert))))
        nextQuestions[i]={...q,imageKeys,optionImageKeys}
      }
      // Force synchronous metadata write before announcing successful migration.
      await api('/api/state/books','PUT',{value:nextBooks})
      await api('/api/state/questions','PUT',{value:nextQuestions})
      setBooks(nextBooks);setQuestions(nextQuestions)
      setSystemFeedback(`${changed} ta fayl serverga ko‘chirildi. ${missing} ta eski fayl topilmadi.`)
      await refreshSystem()
    }catch(error){setSystemFeedback(error instanceof Error?error.message:'Fayllarni ko‘chirishda xatolik')}
    finally{setSystemBusy(false)}
  }
  useEffect(()=>{if(page==='system'&&role==='admin'&&hydrated)void refreshSystem()},[page,role,hydrated])
  // Login cookie is checked by local API. No public demo role bypass.
  useEffect(() => {
    api<{user:SignedUser|null}>('/api/auth/me').then(d=>{
      if(d.user){setAuthUser(d.user);setCurrentUserId(d.user.id);setLoggedIn(true)}
    }).catch(()=>{}).finally(()=>setCheckingSession(false))
  }, [])
  useEffect(()=>{
    if(!loggedIn || !authUser)return
    let cancelled=false
    setHydrated(false)
    void api<{user:SignedUser;users:DemoUser[];classes:SchoolClass[];schools:School[];
      state:{books:Book[]|null;questions:Question[]|null;testSets:TestSet[]|null;quarterGates:QuarterGate[]|null;
        assignments:Assignment[]|null;adminSettings:AdminSettings|null};testAttempts:TestAttempt[]}>('/api/bootstrap')
    .then(async d=>{
      if(cancelled)return
      setUsers(d.users);setClasses(d.classes);setSchools(d.schools||[]);setCurrentUserId(d.user.id)
      setClassSchoolId(old=>d.schools.some(s=>s.id===old)?old:d.schools[0]?.id||0)
      setNewUserClassId(old=>d.classes.some(c=>c.id===old)?old:d.classes[0]?.id||0)
      setAssignmentClassId(old=>d.classes.some(c=>c.id===old)?old:d.classes[0]?.id||0)
      if(d.state.books!==null)setBooks(d.state.books);else setBooks([])
      if(d.state.questions!==null)setQuestions(d.state.questions);else setQuestions([])
      if(d.state.testSets!==null)setTestSets(d.state.testSets);else setTestSets([])
      setQuarterGates(d.state.quarterGates||[])
      if(d.state.assignments!==null)setAssignments(d.state.assignments);else setAssignments([])
      if(d.state.adminSettings!==null){setAdminSettings(d.state.adminSettings);setSettingsDraft(d.state.adminSettings)}
      setTestAttempts(d.testAttempts)
      try{
        const running=await api<{exam:{id:string;testId:number;startedAt:number;deadlineAt:number;answers:Record<number,number>}|null}>('/api/exams/current')
        if(!cancelled&&running.exam){
          const ex=running.exam
          const tests=d.state.testSets||testSets, t=tests.find(x=>x.id===ex.testId)
          const settings=d.state.adminSettings||adminSettings
          setActiveSession({testId:ex.testId,studentId:d.user.id,startedAt:ex.startedAt,deadlineAt:ex.deadlineAt,questionIds:t?.questionIds||[],answers:ex.answers,status:'running',serverExamId:ex.id,durationMinutes:t?.durationMinutes??settings.durationMinutes,passingPercent:t?.passingPercent??settings.passingPercent,showResult:t?.showResult??settings.showResult})
          setPage('students')
        }else if(!cancelled)setActiveSession(null)
      }catch{}
      if(!cancelled)setHydrated(true)
    }).catch(err=>{if(!cancelled)setNotice(`Server ma’lumotlari yuklanmadi: ${err instanceof Error?err.message:'xatolik'}`)})
    return ()=>{cancelled=true}
  },[loggedIn,authUser?.id])
  // Shared metadata: preserved local state is migrated on the admin's first login.
  // Debounce writes to avoid overwriting fast consecutive edits out of order.
  function syncState(key:string,value:unknown,allowed:boolean){
    if(!hydrated||!allowed)return ()=>{}
    const timer=window.setTimeout(()=>{void api(`/api/state/${key}`,'PUT',{value}).catch(err=>setNotice(`Serverga saqlash xatosi: ${err instanceof Error?err.message:'xatolik'}`))},450)
    return ()=>window.clearTimeout(timer)
  }
  useEffect(()=>{if(skipNextCatalogSync.current){skipNextCatalogSync.current=false;return}return syncState('books',books,isManager||role==='teacher')},[books,hydrated,role])
  useEffect(()=>syncState('questions',questions,isManager||role==='teacher'),[questions,hydrated,role])
  useEffect(()=>syncState('testSets',testSets,isManager||role==='teacher'),[testSets,hydrated,role])
  useEffect(()=>syncState('quarterGates',quarterGates,isManager),[quarterGates,hydrated,role])
  useEffect(()=>syncState('assignments',assignments,isManager||role==='teacher'),[assignments,hydrated,role])
  useEffect(()=>{
    if(!loggedIn||!hydrated||page!=='assignments'||!(isManager||role==='teacher'))return
    let active=true
    const refresh=async()=>{
      try{
        const reply=await api<{rows:AssignmentStatus[]}>('/api/assignments/status')
        if(active){setAssignmentStatuses(reply.rows);setAssignmentStatusError('')}
      }catch(e){if(active)setAssignmentStatusError(e instanceof Error?e.message:'Monitoringni yangilab bo‘lmadi')}
    }
    void refresh()
    const timer=window.setInterval(()=>void refresh(),20000)
    return()=>{active=false;window.clearInterval(timer)}
  },[loggedIn,hydrated,page,role,isManager,assignments.length])
  async function refreshAssignmentStatus(){
    setAssignmentStatusLoading(true)
    try{const result=await api<{rows:AssignmentStatus[]}>('/api/assignments/status');setAssignmentStatuses(result.rows);setAssignmentStatusError('')}
    catch(e){setAssignmentStatusError(e instanceof Error?e.message:'Monitoringni yangilab bo‘lmadi')}
    finally{setAssignmentStatusLoading(false)}
  }
  useEffect(()=>syncState('adminSettings',adminSettings,role==='admin'),[adminSettings,hydrated,role])
  useEffect(()=>{if(loggedIn&&hydrated)void loadRanking()},[loggedIn,hydrated,rankGrade,rankClass,testAttempts.length])
  async function loadRanking(){
    try{const params=new URLSearchParams();if(rankGrade)params.set('grade',String(rankGrade));if(rankClass)params.set('classId',String(rankClass))
      const d=await api<{rows:typeof ranking}>(`/api/leaderboard?${params.toString()}`);setRanking(d.rows)
    }catch{}
  }
  function authenticated(u:SignedUser){setEntryView('home');setShowPublicPage(false);setActiveSession(null);setAuthUser(u);setCurrentUserId(u.id);setPage('dashboard');setLoggedIn(true);setNotice('')}
  async function logout(){try{await api('/api/auth/logout','POST')}catch{}setEntryView('home');setShowPublicPage(false);setHydrated(false);setAuthUser(null);setLoggedIn(false);setActiveSession(null);setPage('dashboard')}
  useEffect(() => { localStorage.setItem(CLASS_KEY, JSON.stringify(classes)) }, [classes])
  useEffect(() => { localStorage.setItem(USER_KEY, JSON.stringify(users)) }, [users])
  useEffect(() => { localStorage.setItem(ASSIGN_KEY, JSON.stringify(assignments)) }, [assignments])
  useEffect(() => { localStorage.setItem('math-diagnoz-books-v2', JSON.stringify(books)) }, [books])
  useEffect(() => { localStorage.setItem('math-diagnoz-questions-v2', JSON.stringify(questions)) }, [questions])
  useEffect(() => { localStorage.setItem('math-diagnoz-tests-v06', JSON.stringify(testSets)) }, [testSets])
  useEffect(() => { localStorage.setItem('math-diagnoz-attempts-v06', JSON.stringify(testAttempts)) }, [testAttempts])
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(adminSettings)) }, [adminSettings])
  useEffect(() => {
    if (activeSession) localStorage.setItem(SESSION_KEY, JSON.stringify(activeSession))
    else localStorage.removeItem(SESSION_KEY)
  }, [activeSession])
  useEffect(() => {
    const tick = () => setClockNow(Date.now())
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick) }
  }, [])
  // Qayta yuklanganda ham server bo‘lmagan demo muddatni boshlanishdan hisoblaydi.
  useEffect(() => {
    if (activeSession?.status === 'running' && Date.now() >= activeSession.deadlineAt) finishStudentTest('expired')
  }, [clockNow, activeSession])

  const currentBook = books.find(b => b.id === selectedBook)
  const gradeBooks = books.filter(b => b.grade === catalogGrade)
  const currentChapter = currentBook?.chapters.find(c => c.id === selectedChapter) || currentBook?.chapters[0]
  const currentClass = classes.find(c => c.id === currentUser.classId)
  const selectedSchool = schools.find(x=>x.id===openSchoolId)
  const selectedSchoolClasses = classes.filter(c=>c.schoolId===openSchoolId)
  const selectedSchoolStudents = users.filter(u=>u.role==='student'&&selectedSchoolClasses.some(c=>c.id===u.classId))
  const schoolTestAttempts = testAttempts.filter(a=>selectedSchoolStudents.some(u=>u.id===a.studentId))
  const quarterIsEnabled=(grade:number,quarter:number)=>quarterGates.some(g=>g.grade===grade&&g.quarter===quarter&&g.enabled)
  const quarterTestGrade=(t:TestSet)=>books.find(b=>b.id===t.bookId)?.grade
  const quarterIsAvailable=(t:TestSet)=>t.kind!=='quarter'||Boolean(quarterTestGrade(t)&&quarterIsEnabled(quarterTestGrade(t)!,t.quarter||1))
  const myClassIds = classes.filter(c => c.teacherId === currentUser.id).map(c => c.id)
  const userRoleOptions: {id:'all'|DemoRole;label:string}[] = [
    {id:'all',label:'Barchasi'}, {id:'admin',label:'Super-admin'}, {id:'assistant_admin',label:'Yordamchi admin'},
    {id:'teacher',label:'O‘qituvchilar'}, {id:'parent',label:'Ota-onalar'}, {id:'student',label:'O‘quvchilar'}
  ]
  const filteredUsers=users.filter(u=>(userRoleFilter==='all'||u.role===userRoleFilter)
    &&([u.name,u.username||'',ROLE_NAMES[u.role],classes.find(c=>c.id===u.classId)?.name||''].join(' ').toLocaleLowerCase().includes(userSearch.toLocaleLowerCase().trim())))
  const studentVisibleClasses=classes.filter(c=>(isManager||myClassIds.includes(c.id))
    &&(!studentSchoolFilter||c.schoolId===studentSchoolFilter)
    &&(!studentClassFilter||c.id===studentClassFilter))

  const childIds = (currentUser.childIds || []).filter(id => users.some(u => u.id === id && u.role === 'student'))
  const viewedChild = users.find(u => u.id === parentChildId && childIds.includes(u.id)) || users.find(u=>u.id===childIds[0])
  const visibleAttempts = testAttempts.filter(a => isManager ? true : role === 'teacher' ? a.classId!==undefined && myClassIds.includes(a.classId) : role === 'student' ? a.studentId===currentUser.id : a.studentId!==undefined && childIds.includes(a.studentId))
  const diagnosticStudents = users.filter(u=>u.role==='student' && (isManager||role==='student'&&u.id===currentUser.id||role==='teacher'&&myClassIds.includes(u.classId||-1)||role==='parent'&&childIds.includes(u.id)))
  const diagnosticAttempts=diagnosticStudentId?visibleAttempts.filter(a=>a.studentId===diagnosticStudentId):visibleAttempts
  const diagnosticProgress=diagnosticAttempts.slice().sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()).slice(-8)
  const assignedToStudent = (testId:number, studentId:number) => {
    const u=users.find(x=>x.id===studentId)
    return !!u && !!u.classId && assignments.some(a=>a.testId===testId&&a.classId===u.classId)
  }
  function clearSchoolForm(){setSchoolEditingId(null);setSchoolName('');setSchoolRegion('Surxondaryo');setSchoolDistrict('');setSchoolCode('')}
  async function saveSchool(e:FormEvent){
    e.preventDefault()
    if(!schoolName.trim())return
    try{
      const body={name:schoolName.trim(),region:schoolRegion.trim(),district:schoolDistrict.trim(),code:schoolCode.trim()}
      if(schoolEditingId!==null){
        const d=await api<{school:School}>(`/api/schools/${schoolEditingId}`,'PATCH',body)
        setSchools(old=>old.map(s=>s.id===schoolEditingId?d.school:s))
      }else{
        const d=await api<{school:School}>('/api/schools','POST',body)
        setSchools(old=>[...old,d.school])
        setClassSchoolId(d.school.id)
      }
      clearSchoolForm();setNotice('Maktab ma’lumotlari bazaga saqlandi.')
    }catch(err){setNotice(err instanceof Error?err.message:'Maktab saqlanmadi')}
  }
  function editSchool(s:School){setSchoolEditingId(s.id);setSchoolName(s.name);setSchoolRegion(s.region);setSchoolDistrict(s.district);setSchoolCode(s.code)}
  async function deleteSchool(s:School){
    if(!window.confirm(`${s.name} maktabini o‘chirasizmi?`))return
    try{await api(`/api/schools/${s.id}`,'DELETE');setSchools(old=>old.filter(x=>x.id!==s.id));setNotice('Maktab o‘chirildi.')}catch(err){setNotice(err instanceof Error?err.message:'Maktab o‘chirilmadi')}
  }
  async function updateClass(c:SchoolClass,changes:Partial<SchoolClass>){
    try{
      const d=await api<{class:SchoolClass}>(`/api/classes/${c.id}`,'PATCH',{...c,...changes})
      setClasses(old=>old.map(x=>x.id===c.id?d.class:x))
      setNotice('Sinf ma’lumotlari serverda yangilandi.')
    }catch(err){setNotice(err instanceof Error?err.message:'Sinfni tahrirlab bo‘lmadi')}
  }
  async function deleteClass(c:SchoolClass){
    if(!window.confirm(`${c.name} sinfini o‘chirasizmi?`))return
    try{await api(`/api/classes/${c.id}`,'DELETE');setClasses(old=>old.filter(x=>x.id!==c.id));setNotice('Sinf o‘chirildi.')}catch(err){setNotice(err instanceof Error?err.message:'Sinfni o‘chirib bo‘lmadi')}
  }
  async function toggleUser(u:DemoUser){
    if(u.role==='admin'||(u.role==='assistant_admin'&&role!=='admin'))return
    try{
      const d=await api<{user:DemoUser}>(`/api/users/${u.id}`,'PATCH',{name:u.name,classId:u.classId,childIds:u.childIds,active:!u.active})
      setUsers(old=>old.map(x=>x.id===u.id?d.user:x));setNotice(u.active?'Hisob bloklandi.':'Hisob faollashtirildi.')
    }catch(err){setNotice(err instanceof Error?err.message:'Hisob holati o‘zgarmadi')}
  }
  async function toggleVerified(u:DemoUser){
    if(!isManager||!['student','parent'].includes(u.role))return
    try{const d=await api<{user:DemoUser}>(`/api/users/${u.id}`,'PATCH',{verified:!u.verified});setUsers(old=>old.map(x=>x.id===u.id?d.user:x));setNotice(u.verified?'Maktab tasdig‘i bekor qilindi.':'Hisob maktabga biriktirildi.')}
    catch(err){setNotice(err instanceof Error?err.message:'Tasdiqlashda xatolik')}
  }
  async function createAssistant(e:FormEvent){
    e.preventDefault()
    try{const d=await api<{user:DemoUser}>('/api/users','POST',{name:assistantName,username:assistantLogin,password:assistantPassword,role:'assistant_admin'})
      setUsers(old=>[...old,d.user]);setAssistantName('');setAssistantLogin('');setAssistantPassword('');setNotice('Yordamchi administrator yaratildi. Login va parolni xavfsiz yo‘l bilan bering.')}
    catch(err){setNotice(err instanceof Error?err.message:'Yordamchi admin yaratilmadi')}
  }
  async function addClass(e:FormEvent){
    e.preventDefault();if(!newClassName.trim())return
    try{const c=await api<SchoolClass>('/api/classes','POST',{name:newClassName.trim(),grade:newClassGrade,schoolId:classSchoolId})
      setClasses(old=>[...old,c]);setNewClassName('');setNotice('Sinf serverga qo‘shildi.')}
    catch(err){setNotice(err instanceof Error?err.message:'Sinf qo‘shilmadi')}
  }
  async function addOrEditUser(e:FormEvent){
    e.preventDefault();if(!newUserName.trim())return
    try{
      const data=editingUserId!==null
        ?await api<{user:DemoUser}>(`/api/users/${editingUserId}`,'PATCH',{name:newUserName,classId:newUserClassId,childIds:newParentChildIds,teacherClassIds:newTeacherClassIds,...(userResetPassword?{password:userResetPassword}:{})})
        :await api<{user:DemoUser}>('/api/users','POST',{name:newUserName,username:newUserUsername,password:newUserPassword,role:newUserRole,classId:newUserClassId,childIds:newParentChildIds})
      setUsers(old=>editingUserId===null?[...old,data.user]:old.map(u=>u.id===editingUserId?data.user:u))
      if(newUserRole==='teacher'){
        if(editingUserId===null && newTeacherClassIds.length){
          await api(`/api/users/${data.user.id}`,'PATCH',{name:newUserName,teacherClassIds:newTeacherClassIds})
        }
        const result=await api<{classes:SchoolClass[]}>('/api/bootstrap');setClasses(result.classes)
      }
      setEditingUserId(null);setNewUserName('');setNewUserUsername('');setNewUserPassword('');setUserResetPassword('');setNewParentChildIds([]);setNewTeacherClassIds([])
      setNotice('Foydalanuvchi serverga saqlandi.')
    }catch(err){setNotice(err instanceof Error?err.message:'Foydalanuvchi saqlanmadi')}
  }
  function editUser(u:DemoUser){setEditingUserId(u.id);setUserResetPassword('');setNewUserName(u.name);setNewUserUsername(u.username||'');setNewUserRole(u.role);setNewUserClassId(u.classId||classes[0]?.id||0);setNewParentChildIds(u.childIds||[]);setNewTeacherClassIds(classes.filter(c=>c.teacherId===u.id).map(c=>c.id))}
  async function deleteUser(u:DemoUser){
    if(u.role==='admin'||(u.role==='assistant_admin'&&role!=='admin')||u.id===currentUser.id){setNotice('Administratorni yoki o‘zingizni o‘chira olmaysiz.');return}
    if(!window.confirm(`${u.name} (${ROLE_NAMES[u.role]}) hisobini BUTUNLAY o‘chirasizmi?\n\nUning shaxsiy test natijalari va murojaatlari ham o‘chiriladi. Bu amalni qaytarib bo‘lmaydi. Umumiy darsliklar saqlanadi.`))return
    try{
      await api(`/api/users/${u.id}`,'DELETE')
      setUsers(old=>old.filter(x=>x.id!==u.id).map(x=>x.role==='parent'?{...x,childIds:(x.childIds||[]).filter(id=>id!==u.id)}:x))
      setTestAttempts(old=>old.filter(x=>x.studentId!==u.id))
      setClasses(old=>old.map(c=>c.teacherId===u.id?{...c,teacherId:null}:c))
      setNewParentChildIds(old=>old.filter(id=>id!==u.id))
      if(editingUserId===u.id)setEditingUserId(null)
      setNotice('Foydalanuvchi bazadan butunlay o‘chirildi.')
    }
    catch(err){setNotice(err instanceof Error?err.message:'Xatolik')}
  }
  function assignTest(e:FormEvent){
    e.preventDefault()
    const test=testSets.find(t=>t.id===assignmentTestId)
    const cls=classes.find(c=>c.id===assignmentClassId)
    if(!test||!cls||books.find(b=>b.id===test.bookId)?.grade!==cls.grade){setNotice('Test sinfi bilan tanlangan sinf mos emas.');return}
    if(role==='teacher'&&!myClassIds.includes(cls.id)){setNotice('Faqat o‘zingizga biriktirilgan sinfga test tayinlang.');return}
    if(assignments.some(a=>a.testId===test.id&&a.classId===cls.id)){setNotice('Test bu sinfga oldin tayinlangan.');return}
    let startAt:string|undefined
    if(assignmentStartInput){
      const time=new Date(assignmentStartInput).getTime()
      if(!Number.isFinite(time)){setNotice('Boshlanish vaqtini to‘g‘ri kiriting.');return}
      if(test.availableUntil&&time>=new Date(test.availableUntil).getTime()){setNotice('Boshlanish vaqti test yopilishidan oldin bo‘lishi kerak.');return}
      startAt=new Date(time).toISOString()
    }
    setAssignments(old=>[...old,{id:Date.now(),testId:test.id,classId:cls.id,createdAt:new Date().toISOString(),startAt}])
    setAssignmentStartInput('');setNotice('Test sinfga tayinlandi. Belgilangan boshlanish vaqti o‘quvchiga ko‘rinadi.')
  }


  async function addBook(e: FormEvent) {
    e.preventDefault()
    if (uploading) return
    const files = [...selectedPdfFiles]
    if (!files.length && !bookTitle.trim()) {
      setNotice('Darslik nomini yozing yoki PDF fayllarni tanlang.')
      return
    }
    // Har bir PDF — mustaqil darslik. Shunday qilib bob, test va fayl bog‘lanishlari
    // bir-biridan ajralgan holda saqlanadi; avvalgi darsliklar o‘zgarmaydi.
    const firstId = Math.max(Date.now(), 1, ...books.map(b => b.id + 1))
    const added: Book[] = []
    const failed: File[] = []
    const failedMessages: string[] = []
    setUploading(true)
    try {
      if (!files.length) {
        added.push({id:firstId,title:bookTitle.trim(),grade:bookGrade,author:bookAuthor.trim()||'Kiritilmagan',chapters:[]})
      } else {
        for (const [index,file] of files.entries()) {
          setBookUploadProgress(`${index+1}/${files.length} · ${file.name}`)
          try {
            const id = firstId + index
            const pdfKey = await savePdf(`book-${id}`,file,(done,total)=>setBookUploadProgress(`${index+1}/${files.length} · ${file.name} · bo‘lak ${done}/${total}`))
            const filenameTitle = file.name.replace(/\.pdf$/i,'').replace(/[_]+/g,' ').trim()
            added.push({
              id, grade:bookGrade,
              title:files.length===1&&bookTitle.trim()?bookTitle.trim():(filenameTitle||`Darslik ${index+1}`),
              author:bookAuthor.trim()||'Kiritilmagan', chapters:[], pdfKey, pdfName:file.name
            })
          } catch (err) {
            failed.push(file)
            failedMessages.push(`${file.name}: ${err instanceof Error?err.message:'Noma’lum xato'}`)
          }
        }
      }
      if (added.length) {
        setBooks(old => [...old, ...added])
        setSelectedBook(added[0].id)
        setSelectedChapter(0)
        setCatalogGrade(bookGrade)
        setBookTitle('')
        setBookAuthor('')
      }
      setSelectedPdfFiles(failed)
      setBookFileEpoch(n=>n+1)
      if (failed.length) {
        setNotice(`${added.length} ta darslik qo‘shildi; ${failed.length} ta PDF yuklanmadi. Sabab: ${failedMessages.slice(0,2).join(' | ')}${failedMessages.length>2?' va boshqa xatolar':''}`)
      } else {
        setNotice(`${added.length} ta darslik ${bookGrade}-sinf ro‘yxatiga qo‘shildi. Oldingi darsliklar saqlandi.`)
      }
    } finally {
      setBookUploadProgress('')
      setUploading(false)
    }
  }
  function selectPdfs(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) { setSelectedPdfFiles([]); return }
    const invalid = files.find(file => (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') || file.size>40*1024*1024 || file.size===0)
    if (invalid) {
      setNotice(`Noto‘g‘ri PDF: ${invalid.name}. Har bir PDF 40 MB gacha va bo‘sh bo‘lmasligi kerak.`)
      setSelectedPdfFiles([])
      e.target.value=''
      return
    }
    const totalSize = files.reduce((sum,file)=>sum+file.size,0)
    if (totalSize>200*1024*1024) {
      setNotice('Bir martalik tanlov 200 MB dan oshmasin. Fayllarni kichikroq guruhlarga bo‘lib yuklang.')
      setSelectedPdfFiles([])
      e.target.value=''
      return
    }
    setSelectedPdfFiles(files)
    setNotice(`${files.length} ta PDF tanlandi. «Darsliklarni saqlash» tugmasini bosing.`)
  }
  // v2.6: server-confirmed edit/delete; avoids losing updates on refresh.
  function startEditingBook(book:Book) {
    if(bookActionBusy!==null)return
    setEditingBookId(book.id)
    setEditBookTitle(book.title)
    setEditBookAuthor(book.author==='Kiritilmagan'?'':book.author)
    setEditBookPdf(null)
    setBookActionProgress('')
    setNotice('')
  }
  function closeEditingBook() {
    if(bookActionBusy!==null)return
    setEditingBookId(null)
    setEditBookPdf(null)
    setBookActionProgress('')
  }
  async function saveEditedBook(e:FormEvent,book:Book) {
    e.preventDefault()
    if(bookActionBusy!==null)return
    const title=editBookTitle.trim()
    if(title.length<2||title.length>160){setNotice('Darslik nomi 2–160 belgidan iborat bo‘lsin.');return}
    if(editBookAuthor.trim().length>160){setNotice('Muallif yoki nashriyot nomi 160 belgidan oshmasin.');return}
    if(editBookPdf&&(!/\.pdf$/i.test(editBookPdf.name)||!editBookPdf.size||editBookPdf.size>40*1024*1024)){
      setNotice('PDF bo‘sh bo‘lmasligi va 40 MB dan oshmasligi kerak.');return
    }
    if(editBookPdf&&book.pdfKey&&!window.confirm(`«${book.title}» darsligining mavjud PDF fayli yangisiga almashtirilsinmi?`))return
    setBookActionBusy(book.id)
    setBookActionProgress('')
    try{
      const changes:{title:string;author:string;pdfKey?:string;pdfName?:string}={title,author:editBookAuthor.trim()}
      if(editBookPdf){
        const pdfFile=editBookPdf
        changes.pdfKey=await savePdf(`book-${book.id}`,pdfFile,(done,total)=>setBookActionProgress(`PDF yuborilmoqda: ${done}/${total} bo‘lak`))
        changes.pdfName=pdfFile.name
      }
      const response=await api<{books:Book[];book:Book}>(`/api/books/${book.id}`,'PATCH',changes)
      skipNextCatalogSync.current=true
      setBooks(response.books)
      setEditingBookId(null)
      setEditBookPdf(null)
      setNotice(`«${response.book.title}» darsligi muvaffaqiyatli yangilandi.`)
    }catch(err){setNotice(`Darslik tahrirlanmadi: ${err instanceof Error?err.message:'Noma’lum xato'}`)}
    finally{setBookActionProgress('');setBookActionBusy(null)}
  }
  async function removeBook(book:Book) {
    if(bookActionBusy!==null)return
    const linkedQuestions=questions.filter(q=>q.bookId===book.id).length
    const linkedTests=testSets.filter(t=>t.bookId===book.id).length
    if(linkedQuestions||linkedTests){
      setNotice(`«${book.title}» darsligida ${linkedQuestions} ta savol va ${linkedTests} ta test bor. Ma’lumotlar buzilmasligi uchun uni hozircha o‘chirib bo‘lmaydi.`)
      return
    }
    const chaptersInfo=book.chapters.length?` ${book.chapters.length} ta bob ham o‘chadi.`:''
    if(!window.confirm(`«${book.title}» darsligini va unga tegishli PDFni butunlay o‘chirasizmi?${chaptersInfo} Bu amalni ortga qaytarib bo‘lmaydi. Zaxira nusxangiz borligini tekshiring.`))return
    setBookActionBusy(book.id)
    try{
      const response=await api<{books:Book[];deletedId:number}>(`/api/books/${book.id}`,'DELETE')
      skipNextCatalogSync.current=true
      setBooks(response.books)
      if(selectedBook===book.id){
        const next=response.books.find(b=>b.grade===catalogGrade)||response.books[0]
        setSelectedBook(next?.id??0)
        setSelectedChapter(next?.chapters[0]?.id??0)
      }
      if(editingBookId===book.id)setEditingBookId(null)
      setNotice(`«${book.title}» darsligi bazadan va ro‘yxatdan o‘chirildi.`)
    }catch(err){setNotice(`Darslik o‘chirilmadi: ${err instanceof Error?err.message:'Noma’lum xato'}`)}
    finally{setBookActionBusy(null)}
  }
  async function openPdf(book: Book, pageNumber?: number) {
    if (!book.pdfKey) { setNotice('Bu darslikka hali PDF biriktirilmagan.'); return }
    try {
      const blob = await loadPdf(book.pdfKey)
      if (!blob) { setNotice('PDF topilmadi. Brauzer ma’lumotlari tozalangan bo‘lishi mumkin.'); return }
      const url = URL.createObjectURL(blob)
      const pageFragment = pageNumber && pageNumber > 0 ? `#page=${pageNumber}` : ''
      const win = window.open(url + pageFragment, '_blank')
      if (!win) { URL.revokeObjectURL(url); setNotice('Brauzer yangi oynani blokladi. Pop-up ruxsatini yoqing.'); return }
      // PDFni yangi oynada ko‘rish uchun vaqtincha URL ochiq qoladi.
    } catch { setNotice('PDF ochilmadi. Brauzer xotirasini tekshiring.') }
  }
  function addChapter(e: FormEvent) {
    e.preventDefault()
    if (!newChapter.trim()) return
    const firstPage = Number(startPage)
    const lastPage = Number(endPage)
    if (startPage && endPage && lastPage < firstPage) { setNotice('Oxirgi sahifa birinchi sahifadan kichik bo‘lishi mumkin emas.'); return }
    if ((startPage && firstPage < 1) || (endPage && lastPage < 1)) { setNotice('Sahifa raqami 1 dan boshlanishi kerak.'); return }
    const id = Date.now()
    setBooks(old => old.map(b => b.id !== selectedBook ? b : { ...b, chapters: [...b.chapters, { id, title: newChapter.trim(), topics: [], startPage: startPage ? firstPage : undefined, endPage: endPage ? lastPage : undefined }] }))
    setSelectedChapter(id)
    setNewChapter('')
    setStartPage('')
    setEndPage('')
    setNotice('Bob va PDF sahifalari saqlandi.')
  }
  function updateChapterPages(e: FormEvent) {
    e.preventDefault()
    if (!currentChapter) return
    const first = Number(startPage)
    const last = Number(endPage)
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first) {
      setNotice('Sahifalarni to‘g‘ri kiriting: boshlanish >= 1, tugash >= boshlanish.')
      return
    }
    setBooks(old => old.map(b => b.id !== selectedBook ? b : {
      ...b, chapters: b.chapters.map(c => c.id === currentChapter.id ? {...c, startPage: first, endPage: last} : c)
    }))
    setStartPage('')
    setEndPage('')
    setNotice('Bob sahifalari yangilandi.')
  }

  function renameChapter(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!currentChapter)return
    const title=String(new FormData(e.currentTarget).get('chapterTitle')||'').trim()
    if(!title){setNotice('Bob nomi bo‘sh bo‘lmasin.');return}
    if(currentBook?.chapters.some(c=>c.id!==currentChapter.id&&c.title.toLocaleLowerCase()===title.toLocaleLowerCase())){
      setNotice('Bu darslikda shu nomli bob allaqachon mavjud.');return
    }
    setBooks(old=>old.map(b=>b.id!==selectedBook?b:{...b,chapters:b.chapters.map(c=>c.id===currentChapter.id?{...c,title}:c)}))
    setNotice('Bob nomi yangilandi. Savollar va testlar shu bobga biriktirilgan holda qoladi.')
  }
  function deleteChapter(){
    if(!currentChapter||!currentBook)return
    const relatedQuestions=questions.filter(q=>q.bookId===currentBook.id&&q.chapterId===currentChapter.id).length
    const relatedTests=testSets.filter(t=>t.bookId===currentBook.id&&t.chapterId===currentChapter.id).length
    if(relatedQuestions||relatedTests){
      setNotice(`Bobni o‘chirib bo‘lmaydi: unga ${relatedQuestions} ta savol va ${relatedTests} ta test biriktirilgan. Avval ularni xavfsiz ko‘chiring yoki o‘chiring.`)
      return
    }
    if(!window.confirm(`«${currentChapter.title}» bobini va uning mavzularini o‘chirasizmi?`))return
    const nextChapters=currentBook.chapters.filter(c=>c.id!==currentChapter.id)
    setBooks(old=>old.map(b=>b.id!==selectedBook?b:{...b,chapters:nextChapters}))
    setSelectedChapter(nextChapters[0]?.id||0)
    setEditingTopicIndex(null)
    setNotice('Bo‘sh bob o‘chirildi. Boshqa darslik va testlarga tegilmadi.')
  }
  function renameTopic(e:FormEvent<HTMLFormElement>,index:number){
    e.preventDefault()
    if(!currentChapter)return
    const oldName=currentChapter.topics[index]
    const title=editingTopicName.trim()
    if(oldName===undefined||!title){setNotice('Mavzu nomi bo‘sh bo‘lmasin.');return}
    if(currentChapter.topics.some((t,i)=>i!==index&&t.toLocaleLowerCase()===title.toLocaleLowerCase())){
      setNotice('Shu nomli mavzu bobda mavjud.');return
    }
    setBooks(old=>old.map(b=>b.id!==selectedBook?b:{...b,chapters:b.chapters.map(c=>c.id===currentChapter.id?{...c,topics:c.topics.map((t,i)=>i===index?title:t)}:c)}))
    // Preserve questions when the topic label is renamed.
    setQuestions(old=>old.map(q=>q.bookId===selectedBook&&q.chapterId===currentChapter.id&&q.topic===oldName?{...q,topic:title}:q))
    setTopicForQuestion(t=>t===oldName?title:t)
    setEditingTopicIndex(null);setEditingTopicName('')
    setNotice('Mavzu tahrirlandi. Unga biriktirilgan savollarning mavzu nomi ham yangilandi.')
  }
  function deleteTopic(index:number){
    if(!currentChapter)return
    const name=currentChapter.topics[index]
    if(name===undefined)return
    const related=questions.filter(q=>q.bookId===selectedBook&&q.chapterId===currentChapter.id&&q.topic===name).length
    if(related){setNotice(`«${name}» mavzusida ${related} ta savol bor. Savollarni saqlash uchun mavzuni hozircha o‘chirib bo‘lmaydi.`);return}
    if(!window.confirm(`«${name}» mavzusini o‘chirasizmi?`))return
    setBooks(old=>old.map(b=>b.id!==selectedBook?b:{...b,chapters:b.chapters.map(c=>c.id===currentChapter.id?{...c,topics:c.topics.filter((_,i)=>i!==index)}:c)}))
    setEditingTopicIndex(null);setEditingTopicName('')
    setNotice('Mavzu o‘chirildi.')
  }

  function addTopic(e: FormEvent) {
    e.preventDefault()
    if (!newTopic.trim() || !currentChapter) return
    setBooks(old => old.map(b => b.id !== selectedBook ? b : { ...b, chapters: b.chapters.map(c => c.id !== currentChapter.id ? c : { ...c, topics: [...c.topics, newTopic.trim()] }) }))
    setNewTopic('')
    setNotice('Mavzu qo‘shildi.')
  }
  async function importWordFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setWordPreview(null)
    setWordFileName(file.name)
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setNotice('Word test faqat .docx formatida bo‘lishi kerak. Eski .doc faylni Word orqali .docx qilib saqlang.')
      return
    }
    if (file.size > 15 * 1024 * 1024) { setNotice('Word test fayli 15 MB dan oshmasin.'); return }
    setWordBusy(true)
    try {
      const buffer = await file.arrayBuffer()
      const extracted = await mammoth.convertToHtml({ arrayBuffer: buffer })
      const parsed = parseWordQuestions(extracted.value)
      setWordPreview(parsed)
      setNotice(parsed.errors.length ? `Tekshiruv tugadi: ${parsed.questions.length} ta to‘g‘ri, ${parsed.errors.length} ta xatoli savol.` : `${parsed.questions.length} ta savol (rasmlari bilan) tekshirildi. «Savollarni qo‘shish» tugmasini bosing.`)
    } catch {
      setNotice('Word faylni o‘qib bo‘lmadi. Shablondan foydalaning va .docx formatida saqlang.')
    } finally { setWordBusy(false) }
  }

  async function confirmWordImport() {
    if (!currentBook || !currentChapter || !wordPreview || wordPreview.errors.length || !wordPreview.questions.length || wordBusy) {
      setNotice('Avval bobni tanlang va Word fayldagi xatolarni tuzating.')
      return
    }
    setWordBusy(true)
    const createdKeys: string[] = []
    try {
      const now = Date.now()
      const newQuestions: Question[] = []
      for (let i = 0; i < wordPreview.questions.length; i++) {
        const q = wordPreview.questions[i]
        const imageKeys: string[] = []
        const optionImageKeys: string[][] = [[],[],[],[]]
        for (const src of q.images) {
          const key = makeImageKey()
          const serverKey=await saveImageBlob(key, decodeImageDataUrl(src))
          createdKeys.push(serverKey); imageKeys.push(serverKey)
        }
        for (let k = 0; k < 4; k++) {
          for (const src of q.optionImages[k] || []) {
            const key = makeImageKey()
            const serverKey=await saveImageBlob(key, decodeImageDataUrl(src))
            createdKeys.push(serverKey); optionImageKeys[k].push(serverKey)
          }
        }
        newQuestions.push({ id: now+i, bookId: currentBook.id, chapterId: currentChapter.id,
          topic:q.topic||topicForQuestion||undefined, text:q.text, options:q.options, correct:q.correct, imageKeys, optionImageKeys })
      }
      setQuestions(old=>[...old,...newQuestions])
      setWordPreview(null)
      setWordFileName('')
      setNotice(`${newQuestions.length} ta savol rasmlari bilan «${currentChapter.title}» bobiga saqlandi.`)
    } catch (e) {
      await Promise.allSettled(createdKeys.map(deleteImageBlob))
      setNotice(`Word import xatosi: ${e instanceof Error ? e.message : 'Xotirada joy yetarli emas.'} Import bekor qilindi.`)
    } finally { setWordBusy(false) }
  }

  function resetQuestionForm() {
    setEditingQuestionId(null)
    setQuestionText('')
    setOptions(['','','',''])
    setCorrect(0)
    setTopicForQuestion('')
    setQuestionImageFile(null)
    setOptionImageFiles([null,null,null,null])
    setKeptQuestionImages([])
    setKeptOptionImages([[],[],[],[]])
    setFileInputEpoch(x=>x+1)
  }

  function startEditing(q: Question) {
    setEditingQuestionId(q.id)
    setSelectedBook(q.bookId)
    setSelectedChapter(q.chapterId)
    setTopicForQuestion(q.topic || '')
    setQuestionText(q.text)
    setOptions([...q.options])
    setCorrect(q.correct)
    setKeptQuestionImages([...(q.imageKeys||[])])
    setKeptOptionImages([0,1,2,3].map(i=>[...(q.optionImageKeys?.[i]||[])]))
    setQuestionImageFile(null)
    setOptionImageFiles([null,null,null,null])
    setFileInputEpoch(x=>x+1)
    setNotice('Savol tahrirlash uchun ochildi. O‘zgartirishlarni saqlang yoki bekor qiling.')
    document.getElementById('md-question-editor')?.scrollIntoView({behavior:'smooth',block:'start'})
  }

  function changeQuestionImage(file: File | null) {
    if (file && !validImage(file)) { setNotice('Rasm JPG, PNG, WEBP yoki GIF va 4 MB gacha bo‘lishi kerak.'); return }
    setQuestionImageFile(file)
  }
  function changeOptionImage(index: number, file: File | null) {
    if (file && !validImage(file)) { setNotice('Rasm JPG, PNG, WEBP yoki GIF va 4 MB gacha bo‘lishi kerak.'); return }
    setOptionImageFiles(old=>old.map((x,i)=>i===index?file:x))
  }

  async function addQuestion(e: FormEvent) {
    e.preventDefault()
    if (!currentBook || !currentChapter || savingQuestion) {setNotice('Avval darslik va bobni tanlang.');return}
    if (!questionText.trim() && !questionImageFile && !keptQuestionImages.length) {setNotice('Savol matni yoki rasmini kiriting.');return}
    if (options.some((o,i)=>!o.trim() && !optionImageFiles[i] && !keptOptionImages[i]?.length)) {
      setNotice('Har bir A–D variantida matn yoki rasm bo‘lishi kerak.');return
    }
    setSavingQuestion(true)
    const createdKeys: string[] = []
    try {
      const imageKeys = [...keptQuestionImages]
      const optionImageKeys = [0,1,2,3].map(i=>[...(keptOptionImages[i]||[])])
      if (questionImageFile) {
        const key=makeImageKey();const serverKey=await saveImageBlob(key,questionImageFile);createdKeys.push(serverKey);imageKeys.push(serverKey)
      }
      for (let i=0;i<4;i++) {
        const file=optionImageFiles[i]
        if (file) {const key=makeImageKey();const serverKey=await saveImageBlob(key,file);createdKeys.push(serverKey);optionImageKeys[i].push(serverKey)}
      }
      const data={bookId:currentBook.id,chapterId:currentChapter.id,topic:topicForQuestion||undefined,text:questionText.trim(),options:[...options],correct,imageKeys,optionImageKeys}
      const oldQuestion = questions.find(q=>q.id===editingQuestionId)
      if (oldQuestion) {
        setQuestions(old=>old.map(q=>q.id===oldQuestion.id?{...q,...data}:q))
        const keep = new Set([...imageKeys,...optionImageKeys.flat()])
        void Promise.allSettled(allImageKeys(oldQuestion).filter(k=>!keep.has(k)).map(deleteImageBlob))
        setNotice('Savol va rasmlari tahrirlandi, o‘zgarishlar saqlandi.')
      } else {
        setQuestions(old=>[...old,{id:Date.now(),...data}])
        setNotice('Yangi savol rasmlari bilan savollar bankiga qo‘shildi.')
      }
      resetQuestionForm()
    } catch {
      await Promise.allSettled(createdKeys.map(deleteImageBlob))
      setNotice('Savol yoki rasm saqlanmadi. Brauzer xotirasini tekshiring.')
    } finally {setSavingQuestion(false)}
  }

  function removeQuestion(q: Question) {
    if (!window.confirm(`«${q.text.slice(0,80) || 'Rasmli savol'}» savolini butunlay o‘chirasizmi?`)) return
    setQuestions(old=>old.filter(item=>item.id!==q.id))
    if (editingQuestionId===q.id) resetQuestionForm()
    void Promise.allSettled(allImageKeys(q).map(deleteImageBlob))
    setNotice('Savol o‘chirildi. Test natijalari qayta hisoblanadi.')
  }

  // Test sozlamalari: umumiy admin standartlari va har bir testning o‘ziga xos parametrlari.
  const currentChapterQuestions = questions.filter(q => q.bookId === selectedBook && q.chapterId === currentChapter?.id)
  const runningTest = activeSession && (activeSession.studentId===undefined || activeSession.studentId===currentUser.id) ? testSets.find(t => t.id === activeSession.testId) : undefined
  const runningQuestions = activeSession ? activeSession.questionIds.map(id => questions.find(q => q.id === id)).filter((q): q is Question => Boolean(q)) : []
  const studentAnswers = activeSession?.answers || {}
  const studentFinished = activeSession?.status === 'finished'
  const studentTestResult = activeSession?.resultId ? testAttempts.find(a => a.id === activeSession.resultId) : null
  const secondsLeft = activeSession ? Math.max(0, Math.ceil((activeSession.deadlineAt - clockNow) / 1000)) : 0
  const eligibleTests = testSets.filter(t =>
    t.active && books.find(b => b.id === t.bookId)?.grade === (role==='student'?currentClass?.grade:studentGrade) && assignedToStudent(t.id,currentUser.id) &&
    t.questionIds.some(id => questions.some(q => q.id === id)))
  const attemptsUsed = (id: number) => testAttempts.filter(a => a.testId === id && (role!=='student' || a.studentId===currentUser.id)).length
  const testDuration = (t: TestSet) => t.durationMinutes ?? adminSettings.durationMinutes
  const testAttemptsLimit = (t: TestSet) => t.attemptLimit ?? adminSettings.maxAttempts
  const testPassing = (t: TestSet) => t.passingPercent ?? adminSettings.passingPercent
  const testShowResult = (t: TestSet) => t.showResult ?? adminSettings.showResult

  function createTest(e: FormEvent) {
    e.preventDefault()
    if (!currentBook || !currentChapter) { setNotice('Avval darslik va bobni tanlang.'); return }
    const ids = chosenQuestions.filter(id => currentChapterQuestions.some(q => q.id === id))
    if (!newTestName.trim()) { setNotice('Test nomini kiriting.'); return }
    if (!ids.length) { setNotice('Kamida 1 ta savolni belgilang.'); return }
    if (draftAvailableFrom && draftAvailableUntil && new Date(draftAvailableUntil).getTime() <= new Date(draftAvailableFrom).getTime()) {
      setNotice('Test yopilish vaqti boshlanish vaqtidan keyin bo‘lishi shart.'); return
    }
    const optionalNumber = (value: string, min: number, max: number) => value.trim() === '' ? undefined : Math.min(max, Math.max(min, Number(value)))
    const test: TestSet = { id: Date.now(), title: newTestName.trim(), bookId: selectedBook,
      chapterId: currentChapter.id, questionIds: ids, active: false, createdAt: new Date().toISOString(),
      durationMinutes: optionalNumber(draftDuration, 1, 240), attemptLimit: optionalNumber(draftAttempts, 1, 20),
      passingPercent: optionalNumber(draftPassing, 0, 100),
      showResult: draftShowResult === 'default' ? undefined : draftShowResult === 'yes',
      availableFrom: dateInputToIso(draftAvailableFrom), availableUntil: dateInputToIso(draftAvailableUntil),
      kind: draftTestKind, quarter: draftTestKind==='quarter'?draftTestQuarter:undefined }
    setTestSets(old => [...old, test])
    setNewTestName(''); setChosenQuestions([])
    setDraftDuration(''); setDraftAttempts(''); setDraftPassing(''); setDraftShowResult('default')
    setDraftAvailableFrom(''); setDraftAvailableUntil('')
    setDraftTestKind('regular');setDraftTestQuarter(1)
    setNotice('Test qoralama bo‘lib saqlandi. Testni faollashtiring. Belgilangan vaqt saqlanib qoladi.')
  }
  function toggleQuarter(grade:number,quarter:number){
    if(role!=='admin')return
    setQuarterGates(old=>[...old.filter(g=>g.grade!==grade||g.quarter!==quarter),{grade,quarter,enabled:!quarterIsEnabled(grade,quarter)}])
    setNotice(`${grade}-sinf, ${quarter}-chorak faolligi yangilandi. Serverga saqlanadi.`)
  }
  function patchTest(testId: number, patch: Partial<TestSet>) {
    setTestSets(old => old.map(t => t.id === testId ? { ...t, ...patch } : t))
  }
  function toggleTest(testId: number) {
    setTestSets(old => old.map(t => t.id === testId ? {...t,active:!t.active} : t))
    setNotice('Testning faolligi saqlandi.')
  }
  function removeTest(test: TestSet) {
    if (!window.confirm(`«${test.title}» testini o‘chirasizmi? Savollar bankidagi savollar o‘chmaydi.`)) return
    setTestSets(old => old.filter(t => t.id !== test.id))
    if (activeSession?.testId === test.id) setActiveSession(null)
    setNotice('Test o‘chirildi. Oldingi natijalar hisobotda qoladi.')
  }
  async function startStudentTest(id: number) {
    const studentId=currentUser.id
    if(role!=='student'){setNotice('Testni sinash uchun o‘quvchi akkaunti bilan kiring.');return}
    if(role==='student'&&testSets.find(t=>t.id===id)?.kind==='quarter'&&!quarterIsAvailable(testSets.find(t=>t.id===id)!)){setNotice('Bu chorak hali faol emas.');return}
    if(role==='student'&&!assignedToStudent(id, studentId)){setNotice('Test sizning sinfingizga tayinlanmagan.');return}
    const test = testSets.find(t => t.id === id)
    if (!test || !isAvailableNow(test, Date.now())) { setNotice('Test hozir faol emas yoki belgilangan vaqt oralig‘ida emas.'); return }
    if (activeSession?.status === 'running') {
      if (activeSession.testId === id) { setPage('students'); setNotice('Oldingi test davom ettirildi. Vaqt qaytadan boshlanmaydi.'); return }
      setNotice('Avval boshlangan testni yakunlang. Uni tashlab boshqasini boshlab bo‘lmaydi.'); setPage('students'); return
    }
    if (testAttempts.filter(a=>a.testId===id&&a.studentId===studentId).length >= testAttemptsLimit(test)) { setNotice('Ushbu o‘quvchining urinishlar limiti tugagan.'); return }
    const validQuestions = test.questionIds.filter(qid => questions.some(q => q.id === qid))
    if (!validQuestions.length) { setNotice('Test uchun mavjud savollar topilmadi.'); return }
    let serverExam: {id:string;startedAt:number;deadlineAt:number}
    try{const response=await api<{exam:typeof serverExam}>('/api/exams/start','POST',{testId:id});serverExam=response.exam}
    catch(err){setNotice(err instanceof Error?err.message:'Test boshlanmadi');return}
    const startedAt = serverExam.startedAt
    const durationMinutes = testDuration(test)
    const closesAt = test.availableUntil ? new Date(test.availableUntil).getTime() : Infinity
    const deadlineAt = Math.min(serverExam.deadlineAt, closesAt)
    finishLock.current = false
    setActiveSession({testId:id, studentId, startedAt, deadlineAt, questionIds:validQuestions, answers:{}, status:'running',serverExamId:serverExam.id,
      durationMinutes, passingPercent:testPassing(test), showResult:testShowResult(test)})
    setStudentGrade(books.find(b=>b.id===test.bookId)?.grade||5)
    setPage('students')
    setNotice(`Test boshlandi: ${durationMinutes} daqiqa. Sahifa yangilansa ham vaqt davom etadi.`)
  }
  const pendingAnswers=useRef<Promise<unknown>>(Promise.resolve())
  function answerQuestion(questionId:number,answer:number){
    if(!activeSession||activeSession.status!=='running')return
    setActiveSession(old=>old&&old.status==='running'?{...old,answers:{...old.answers,[questionId]:answer}}:old)
    if(activeSession.serverExamId){
      pendingAnswers.current=pendingAnswers.current.catch(()=>{}).then(()=>api('/api/exams/answer','POST',{examId:activeSession.serverExamId,questionId,answer}))
      void pendingAnswers.current.catch(err=>setNotice(`Javobni serverga saqlashda muammo: ${err instanceof Error?err.message:'xatolik'}`))
    }
  }
  async function finishStudentTest(reason:'submitted'|'expired'='submitted'){
    if(finishLock.current||!activeSession||activeSession.status!=='running'||!activeSession.serverExamId)return
    const unanswered=runningQuestions.filter(q=>activeSession.answers[q.id]===undefined).length
    if(reason==='submitted'&&unanswered>0&&!window.confirm(`${unanswered} ta savol javobsiz. Testni yakunlaysizmi?`))return
    finishLock.current=true
    try{
      await pendingAnswers.current.catch(()=>{})
      const result=await api<{record:TestAttempt}>('/api/exams/finish','POST',{examId:activeSession.serverExamId})
      setTestAttempts(old=>[result.record,...old.filter(a=>a.id!==result.record.id)])
      setActiveSession(old=>old?{...old,status:'finished',resultId:result.record.id}:old)
      setNotice(result.record.reason==='expired'?'Vaqt tugadi, javoblar serverda baholandi.':'Natija serverga saqlandi.')
      void loadRanking()
    }catch(err){finishLock.current=false;setNotice(err instanceof Error?err.message:'Test yakunlanmadi')}
  }
  function saveGlobalSettings(e: FormEvent) {
    e.preventDefault()
    const s = settingsDraft
    if (!Number.isInteger(s.durationMinutes) || s.durationMinutes<1 || s.durationMinutes>240 ||
      !Number.isInteger(s.maxAttempts) || s.maxAttempts<1 || s.maxAttempts>20 ||
      !Number.isInteger(s.passingPercent) || s.passingPercent<0 || s.passingPercent>100 ||
      !Number.isInteger(s.warnBeforeMinutes) || s.warnBeforeMinutes<1 || s.warnBeforeMinutes>30) {
      setNotice('Sozlamalarni tekshiring: vaqt 1–240 daqiqa, urinish 1–20, ball 0–100%, ogohlantirish 1–30 daqiqa.'); return
    }
    setAdminSettings({...s})
    setNotice('Admin standartlari serverga saqlanadi. Yangi boshlanadigan testlarga tatbiq qilinadi.')
  }
  function exportAttemptsCsv() {
    const rows = [['Test','O‘quvchi','Sinf','To‘g‘ri','Jami','Foiz','Holat','Sabab','Sana'],
      ...visibleAttempts.map(a=>[a.testTitle, users.find(u=>u.id===a.studentId)?.name||'O‘quvchi',`${a.grade}`,`${a.score}`,`${a.total}`,`${Math.round(a.score/a.total*100)}`,a.passed===undefined?'—':a.passed?'O‘tdi':'O‘tmadi',a.reason==='expired'?'Vaqt tugadi':'Yakunlandi',a.createdAt])]
    downloadText('\uFEFF'+rows.map(row=>row.map(csvSafe).join(',')).join('\r\n'), 'math-diagnoz-hisobot.csv', 'text/csv;charset=utf-8')
    setNotice('Hisobot CSV formatida yuklab olindi.')
  }
  function exportMetadataBackup() {
    const data = {version:'1.2', exportedAt:new Date().toISOString(), adminSettings, books, questions, testSets, quarterGates, testAttempts, classes, users, assignments,
      note:'Bu JSON faqat matn va metadata. PDF va rasm fayllari IndexedDBda; ushbu nusxaga kirmaydi.'}
    downloadText(JSON.stringify(data,null,2), 'math-diagnoz-zaxira-metadata.json', 'application/json;charset=utf-8')
    setNotice('Ma’lumotlar zaxirasi yuklandi (PDF/rasmlarsiz).')
  }

  async function importAiQuestions(bookId:number, chapterId:number, topic:string, draft:{text:string;options:string[];correct:number}[]){
    if(!(isManager||role==='teacher'))throw new Error('Faqat o‘qituvchi yoki administrator')
    if(!books.some(b=>b.id===bookId&&b.chapters.some(c=>c.id===chapterId)))throw new Error('Bob topilmadi. Darslikni tekshiring.')
    const first=Math.max(0,...questions.map(q=>q.id)) + 1
    const added:Question[]=draft.map((q,i)=>({id:first+i,bookId,chapterId,topic,text:q.text,options:q.options,correct:q.correct}))
    const updated=[...questions,...added]
    await api('/api/state/questions','PUT',{value:updated})
    setQuestions(updated)
    setNotice(`${added.length} ta AI/namuna savoli savollar bankiga saqlandi. Tekshiruvdan keyin test yarating.`)
  }

  const bookSelect = <select value={selectedBook} onChange={e => { const id = Number(e.target.value); setSelectedBook(id); setSelectedChapter(books.find(b => b.id === id)?.chapters[0]?.id || 0) }}>
    {books.map(b => <option key={b.id} value={b.id}>{b.grade}-sinf · {b.title}</option>)}
  </select>
  const chapterSelect = <select value={currentChapter?.id ?? ''} onChange={e => setSelectedChapter(Number(e.target.value))}>
    {currentBook?.chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
  </select>

  if(checkingSession)return <div className="md-v10-loading">MATH-DIAGNOZ yuklanmoqda...</div>
  if(showPublicPage && loggedIn) return <PublicLanding loggedIn onLogin={()=>setShowPublicPage(false)} onRegister={()=>setShowPublicPage(false)} onDashboard={()=>setShowPublicPage(false)}/>
  if(!loggedIn){
    if(entryView==='home')return <PublicLanding onLogin={()=>setEntryView('login')} onRegister={()=>setEntryView('register')}/>
    return <AuthScreen key={entryView} initialMode={entryView} onBack={()=>setEntryView('home')} onAuth={authenticated} booksCount={books.length} questionCount={questions.length}/>
  }

  return <div className="app-shell">
    <aside className="sidebar"><div className="sidebar-head"><div className="brand-mark">M</div><div className="brand-name">MATH-DIAGNOZ <small>{ROLE_NAMES[role].toUpperCase()}</small></div></div><div className="sidebar-caption">BO‘LIMLAR</div><nav className="v2-sidebar-nav">{NAV_GROUPS.map(group=>{
      const items=roleNav.filter(n=>group.ids.includes(n.id))
      if(!items.length)return null
      const single=items.length===1
      const opened=openGroups[group.title]===undefined?items.some(n=>n.id===page):openGroups[group.title]
      return <div key={group.title} className="v2-nav-group">
        {single?<button className={'nav-item v2-topnav '+(page===items[0].id?'active':'')} onClick={()=>{setPage(items[0].id);setNotice('')}}><span>{group.icon}</span>{group.title==='Bosh sahifa'?group.title:items[0].label}</button>
        :<><button type="button" className={'v2-group-button '+(opened?'open':'')} onClick={()=>setOpenGroups(p=>({...p,[group.title]:!opened}))}><span className="v2-nav-icon">{group.icon}</span><strong>{group.title}</strong><span aria-hidden="true">{opened?'⌄':'›'}</span></button>{opened&&<div className="v2-subnav">{items.map(n=><button type="button" key={n.id} onClick={()=>{setPage(n.id);setNotice('')}} className={'nav-item '+(page===n.id?'active':'')}><span>{n.icon}</span>{n.label}</button>)}</div>}</>}
      </div>
    })}</nav><div className="side-footer">MATH-DIAGNOZ</div></aside>
    <div className="main-area"><header className="topbar"><div><span className="muted">MATH-DIAGNOZ</span><span className="slash"> / </span>{roleNav.find(n => n.id === page)?.label}</div><div className="topbar-actions"><button className="ghost" onClick={()=>setShowPublicPage(true)} title="Bosh sahifani ko‘rish">⌂ Bosh sahifa</button><span className="avatar">{currentUser.name.slice(0,1).toUpperCase()}</span><span>{currentUser.name}</span><button className="ghost" onClick={()=>{void logout()}}>Chiqish</button></div></header>
      <main className="content">{currentUser.verified===false&&<div className="md17-pending-banner"><strong>⌛ Maktab tasdig‘i kutilmoqda</strong><span>Hisobingiz yaratildi. Administrator sinfingizni yoki ota-ona maqomingizni tasdiqlaguncha ayrim imkoniyatlar yopiq. Ota-ona farzandini o‘zi biriktira olmaydi.</span></div>}<div className="page-heading"><div><div className="eyebrow">BOSHQARUV TIZIMI</div><h1>{roleNav.find(n => n.id === page)?.label}</h1><p>Ta’lim materiallarini tizimli boshqarish va diagnostika qilish</p></div></div>
      {notice && <div className="notice" role="status">{notice}<button className="ghost" onClick={() => setNotice('')}>×</button></div>}
      {['ai','international','teacher-tools','student-assistant','help'].includes(page) && <V2Modules key={page} page={page as 'ai'|'international'|'teacher-tools'|'student-assistant'|'help'} role={role} name={currentUser.name} books={books} onImport={importAiQuestions}/>}
      {page==='dashboard'&&<section className="md13-welcome"><div><span className="md13-kicker">✦ MATH-DIAGNOZ · RAQAMLI TA’LIM</span><h2>Xush kelibsiz, {currentUser.name.split(' ')[0]}!</h2><p>{isManager?'Barcha maktablar, sinflar va bilim natijalarini bitta joyda boshqaring.':role==='teacher'?'Har bir o‘quvchining o‘sishini kuzating va individual yordamni tashkil qiling.':role==='student'?'Yangi bilimlarni egallang, testlarda qatnashing va o‘z rekordingizni yangilang.':'Farzandlaringizning yutuqlari va bilim rivojlanishini kuzating.'}</p><div className="md-button-row"><button className="md13-welcome-btn" onClick={()=>setPage(role==='student'?'students':role==='parent'?'children':role==='teacher'?'assignments':'quarterly')}>{isManager?'Chorak testlarini boshqarish':role==='teacher'?'Test tayinlash':role==='student'?'Testlarimni ochish':'Farzandlarim'} ↗</button><button className="md13-welcome-ghost" onClick={()=>setPage('diagnostics')}>Matematik pasport →</button></div></div><div className="md13-orbit" aria-hidden="true"><span>π</span><span>∑</span><span>√</span><span>△</span><strong>f(x)</strong></div></section>}
      {page === 'dashboard' && isManager && <section className="v2-home-links" aria-label="Yangi v2 bo‘limlari">
        <button type="button" onClick={()=>setPage('ai')}><span>✦</span><strong>AI test generatori</strong><small>Avtomatik savol tayyorlash</small></button>
        <button type="button" onClick={()=>setPage('international')}><span>🌐</span><strong>Xalqaro baholash</strong><small>PISA, TIMSS, PIRLS, TALIS</small></button>
        <button type="button" onClick={()=>setPage('teacher-tools')}><span>🎓</span><strong>O‘qituvchi yordamchisi</strong><small>O‘yinlar va hujjatlar</small></button>
        <button type="button" onClick={()=>setPage('help')}><span>🎧</span><strong>Yordam markazi</strong><small>Murojaat va texnik yordam</small></button>
      </section>}
      {page === 'dashboard' && isManager && <>
        <section className="md-dashboard-overview" aria-label="Boshqaruv bo‘limlari">
          <button type="button" className="md-dashboard-tile" onClick={() => setPage('books')}>
            <span className="md-dashboard-tile-top"><span className="md-dashboard-tile-icon" aria-hidden="true">▤</span><span className="md-dashboard-tile-arrow" aria-hidden="true">↗</span></span>
            <span className="md-dashboard-tile-label">DARSLIKLAR</span>
            <strong>{books.length}</strong>
            <small>Elektron kutubxona</small>
          </button>
          <button type="button" className="md-dashboard-tile" onClick={() => setPage('students')}>
            <span className="md-dashboard-tile-top"><span className="md-dashboard-tile-icon" aria-hidden="true">♙</span><span className="md-dashboard-tile-arrow" aria-hidden="true">↗</span></span>
            <span className="md-dashboard-tile-label">O‘QUVCHILAR</span>
            <strong>{users.filter(u => u.role === 'student').length}</strong>
            <small>Ro‘yxat va o‘zlashtirish</small>
          </button>
          <button type="button" className="md-dashboard-tile" onClick={() => setPage('users')}>
            <span className="md-dashboard-tile-top"><span className="md-dashboard-tile-icon" aria-hidden="true">♧</span><span className="md-dashboard-tile-arrow" aria-hidden="true">↗</span></span>
            <span className="md-dashboard-tile-label">FOYDALANUVCHILAR</span>
            <strong>{users.length}</strong>
            <small>Administrator, ustoz va ota-onalar</small>
          </button>
          <button type="button" className="md-dashboard-tile" onClick={() => setPage('tests')}>
            <span className="md-dashboard-tile-top"><span className="md-dashboard-tile-icon" aria-hidden="true">☷</span><span className="md-dashboard-tile-arrow" aria-hidden="true">↗</span></span>
            <span className="md-dashboard-tile-label">TESTLAR</span>
            <strong>{testSets.length}</strong>
            <small>{testAttempts.length} ta test natijasi</small>
          </button>
        </section>
        <section className="md-dashboard-mini" aria-label="Qisqa statistika">
          <button type="button" onClick={() => setPage('schools')}>🏫 <b>{schools.length}</b> maktab</button>
          <button type="button" onClick={() => setPage('classes')}>▦ <b>{classes.length}</b> sinf</button>
          <button type="button" onClick={() => setPage('chapters')}>▱ <b>{books.reduce((n,book)=>n+book.chapters.length,0)}</b> bob</button>
          <button type="button" onClick={() => setPage('questions')}>☷ <b>{questions.length}</b> savol</button>
        </section>
        <section className="md-dashboard-panels">
          <div className="panel md-dashboard-panel">
            <div className="panel-head"><h2>Tezkor amallar</h2><span className="tag">Boshqarish</span></div>
            <div className="md-dashboard-actions">
              <button type="button" onClick={() => setPage('books')}><span aria-hidden="true">▤</span><b>Darsliklarni boshqarish</b><i aria-hidden="true">→</i></button>
              <button type="button" onClick={() => setPage('chapters')}><span aria-hidden="true">▱</span><b>Bob va mavzular</b><i aria-hidden="true">→</i></button>
              <button type="button" onClick={() => setPage('students')}><span aria-hidden="true">♙</span><b>O‘quvchilar ro‘yxati</b><i aria-hidden="true">→</i></button>
              <button type="button" onClick={() => setPage('users')}><span aria-hidden="true">♧</span><b>Foydalanuvchilar</b><i aria-hidden="true">→</i></button>
              <button type="button" onClick={() => setPage('tests')}><span aria-hidden="true">☷</span><b>Testlarni boshqarish</b><i aria-hidden="true">→</i></button>
              <button type="button" onClick={() => setPage('quarterly')}><span aria-hidden="true">▦</span><b>Choraklik testlar</b><i aria-hidden="true">→</i></button>
              {role === 'admin' && <>
                <button type="button" onClick={() => setPage('settings')}><span aria-hidden="true">⚙</span><b>Admin sozlamalari</b><i aria-hidden="true">→</i></button>
                <button type="button" onClick={() => setPage('system')}><span aria-hidden="true">◈</span><b>Tizim va zaxira</b><i aria-hidden="true">→</i></button>
              </>}
            </div>
          </div>
          <div className="panel md-dashboard-panel">
            <div className="panel-head"><h2>Ish holati va nazorat</h2><span className="tag">Umumiy ko‘rinish</span></div>
            <div className="md-dashboard-monitor">
              <div><span className="md-dashboard-monitor-index">01</span><span><b>Maktablar va sinflar</b><small>{schools.length} ta maktab, {classes.length} ta sinf ro‘yxatda</small></span></div>
              <div><span className="md-dashboard-monitor-index">02</span><span><b>Elektron darsliklar</b><small>{books.length} darslik, {books.reduce((n,book)=>n+book.chapters.length,0)} bob</small></span></div>
              <div><span className="md-dashboard-monitor-index">03</span><span><b>Test banki</b><small>{questions.length} savol, {testSets.length} test</small></span></div>
              <div><span className="md-dashboard-monitor-index">04</span><span><b>O‘zlashtirish va hisobot</b><small>{testAttempts.length} saqlangan test natijasi</small></span></div>
            </div>
            <div className="md-dashboard-links"><button type="button" className="btn btn-outline" onClick={() => setPage('diagnostics')}>Matematik pasport →</button><button type="button" className="btn btn-outline" onClick={() => setPage('reports')}>Hisobotlar →</button></div>
          </div>
        </section>
      </>}
      {page === 'dashboard' && !isManager && <>
        <section className="stat-grid">
          <div className="stat"><span>KABINET</span><strong className="stat-word">{ROLE_NAMES[role]}</strong><small>{currentUser.name}</small></div>
          <div className="stat"><span>{role==='teacher'?'MENING SINFLARIM':role==='student'?'SINFIM':'FARZANDLAR'}</span><strong>{role==='teacher'?myClassIds.length:role==='student'?currentClass?.name||'—':childIds.length}</strong><small>Maktab ma’lumotlari</small></div>
          <div className="stat"><span>NATIJALAR</span><strong>{visibleAttempts.length}</strong><small>Saqlangan urinishlar</small></div>
          <div className="stat"><span>TESTLAR</span><strong>{role==='student'?eligibleTests.length:testSets.length}</strong><small>{role==='student'?'Menga tayinlangan':'Katalogdagi testlar'}</small></div>
        </section>
        <section className="panel"><h2>{role==='student'?'O‘qishni boshlash':role==='teacher'?'O‘qituvchining ish joyi':'Ota-ona kuzatuvi'}</h2>
          <p>{role==='student'?'Sizga yuborilgan testlarni yeching, darsliklarni oching va natijangizni kuzating.':role==='teacher'?'Bob va testlarni boshqaring, testni sinflarga yuboring, natijalarni ko‘ring.':'Farzandlaringizning matematika bo‘yicha test natijalarini tanlab ko‘ring.'}</p>
          <div className="md-button-row"><button className="btn btn-primary" onClick={()=>setPage(role==='student'?'students':role==='teacher'?'assignments':'children')}>{role==='student'?'Testlarim':role==='teacher'?'Testlarni tayinlash':'Farzandlarim'} →</button><button className="btn btn-outline" onClick={()=>setPage('reports')}>Hisobotlar →</button><button className="btn btn-outline" onClick={()=>setPage('ranking')}>🏆 Reyting →</button>{role==='student'&&<><button className="btn btn-outline" onClick={()=>setPage('practice')}>🧠 Individual mashqlar →</button><button className="btn btn-outline" onClick={()=>setPage('student-assistant')}>✦ AI yordamchi →</button></>}</div>
        </section>
      </>}
      {page === 'books' && (isManager||role==='teacher') && <>
        <section className="panel" style={{marginBottom:20}}>
          <div className="panel-head"><h2>Sinflar bo‘yicha elektron kutubxona</h2><span className="tag">5–9-sinflar</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(155px, 1fr))',gap:12,marginTop:16}}>
            {grades.map(grade => {
              const count = books.filter(b => b.grade === grade).length
              const active = catalogGrade === grade
              return <button key={grade} type="button" aria-pressed={active} onClick={() => {
                setCatalogGrade(grade)
                setEditingBookId(null)
                setEditBookPdf(null)
                setBookGrade(grade)
                const first = books.find(b => b.grade === grade)
                setSelectedBook(first?.id ?? 0)
                setSelectedChapter(first?.chapters[0]?.id ?? 0)
                setNotice('')
              }} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:9,padding:'20px 16px',background:active?'#e8f2ff':'#fff',border:active?'2px solid #2574bd':'1px solid #d9e2ef',borderRadius:12,color:'#143b65',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                <span style={{fontSize:25}}>▤</span>
                <strong style={{fontSize:19}}>{grade}-sinf</strong>
                <span style={{fontSize:12,color:'#647b94'}}>{count ? `${count} ta darslik` : 'Darslik yuklanmagan'}</span>
              </button>
            })}
          </div>
        </section>
        <div className="two-cols">
          <section className="panel">
            <div className="panel-head"><h2>{catalogGrade}-sinf darsliklari</h2><span className="tag">{gradeBooks.length} ta</span></div>
            {gradeBooks.length > 0 ? <div className="book-list" aria-label={`${catalogGrade}-sinf uchun yuklangan darsliklar`}>{gradeBooks.map((b,index) => <div key={b.id} className="md-book-item">
              <div className="md-book-item-top">
                <div className="md-book-item-info">
                  <div className="md-book-item-title">{index+1}. {b.title}</div>
                  <div className="md-book-item-detail">{b.author} · {b.chapters.length} bob · {b.pdfName || 'PDF biriktirilmagan'}</div>
                </div>
                {bookActionBusy===b.id&&<span className="tag">Saqlanmoqda...</span>}
              </div>
              <div className="md-book-actions">
                <button type="button" className="md-book-action" disabled={bookActionBusy!==null} title="Darslikning bob va mavzularini ochish" onClick={()=>{setSelectedBook(b.id);setSelectedChapter(b.chapters[0]?.id||0);setPage('chapters')}}>▤ <span>Boblar</span></button>
                <button type="button" className="md-book-action" disabled={!b.pdfKey||bookActionBusy!==null} title="PDF faylni ochish" onClick={()=>void openPdf(b)}>↗ <span>PDF</span></button>
                <button type="button" className={'md-book-action'+(editingBookId===b.id?' md-book-action-selected':'')} disabled={bookActionBusy!==null} aria-expanded={editingBookId===b.id} aria-label={`${b.title} darsligini tahrirlash`} onClick={()=>editingBookId===b.id?closeEditingBook():startEditingBook(b)}>✎ <span>Tahrir</span></button>
                {isManager&&<button type="button" className="md-book-action md-book-action-danger" disabled={bookActionBusy!==null} aria-label={`${b.title} darsligini o‘chirish`} title="Butunlay o‘chirish" onClick={()=>void removeBook(b)}>🗑 <span>O‘chirish</span></button>}
              </div>
              {editingBookId===b.id&&<form className="md-book-edit" onSubmit={e=>void saveEditedBook(e,b)}>
                <div className="md-book-edit-grid">
                  <label>Darslik nomi<input value={editBookTitle} onChange={e=>setEditBookTitle(e.target.value)} maxLength={160} required disabled={bookActionBusy!==null} /></label>
                  <label>Muallif / nashriyot<input value={editBookAuthor} onChange={e=>setEditBookAuthor(e.target.value)} maxLength={160} placeholder="Kiritilmagan" disabled={bookActionBusy!==null} /></label>
                </div>
                <label>PDFni almashtirish (ixtiyoriy, 40 MB gacha)
                  <input key={`edit-pdf-${b.id}`} type="file" accept=".pdf,application/pdf" disabled={bookActionBusy!==null} onChange={e=>setEditBookPdf(e.target.files?.[0]||null)} />
                </label>
                {bookActionProgress&&<div className="hint" role="status">{bookActionProgress}</div>}
                <div className="md-book-edit-footer">
                  <button type="submit" className="btn btn-primary" disabled={bookActionBusy!==null||editBookTitle.trim().length<2}>{bookActionBusy===b.id?'Saqlanmoqda...':'✓ Saqlash'}</button>
                  <button type="button" className="btn btn-outline" disabled={bookActionBusy!==null} onClick={closeEditingBook}>Bekor qilish</button>
                </div>
              </form>}
            </div>)}</div> : <div className="empty">{catalogGrade}-sinf uchun darslik hali qo‘shilmagan. O‘ng tomondagi shakldan yangi darslik qo‘shishingiz mumkin.</div>}
            <p className="hint">Darslik ma’lumotlari server bazasida, yangi PDFlar server fayl omborida saqlanadi. Eski brauzer fayllari uchun migratsiya mavjud.</p>
          </section>
          <section className="panel"><div className="panel-head"><h2>Darsliklarni yuklash</h2><span className="tag">{bookGrade}-sinf</span></div>
            <form onSubmit={addBook} className="form">
              <label>Sinf<select value={bookGrade} onChange={e=>setBookGrade(Number(e.target.value))} disabled={uploading}>{grades.map(n=><option key={n} value={n}>{n}-sinf</option>)}</select></label>
              <label>PDF darsliklar (bir nechta tanlash mumkin, har biri 40 MB gacha)
                <input key={`book-pdfs-${bookFileEpoch}`} type="file" accept=".pdf,application/pdf" multiple onChange={selectPdfs} disabled={uploading}/>
              </label>
              <label>Darslik nomi (bitta PDF yoki PDFsiz darslik uchun)
                <input value={bookTitle} onChange={e=>setBookTitle(e.target.value)} required={selectedPdfFiles.length===0} disabled={uploading} placeholder="Masalan: Matematika" />
              </label>
              <label>Muallif / nashriyot<input value={bookAuthor} onChange={e=>setBookAuthor(e.target.value)} disabled={uploading} placeholder="Muallif yoki nashriyot"/></label>
              {selectedPdfFiles.length>0 && <div style={{background:'#f5f9ff',border:'1px solid #dbe6f3',borderRadius:10,padding:12}}>
                <strong style={{color:'#163c65'}}>{selectedPdfFiles.length} ta PDF tanlandi</strong>
                <ul style={{margin:'8px 0 0',paddingLeft:20,color:'#52708d'}}>{selectedPdfFiles.map((file,index)=><li key={`${file.name}-${index}`}>{file.name} · {(file.size/1024/1024).toFixed(1)} MB</li>)}</ul>
                {selectedPdfFiles.length>1&&<p className="hint" style={{marginBottom:0}}>Har bir PDF alohida darslik bo‘ladi. Nomlar PDF fayllarining nomidan olinadi. Barchasi {bookGrade}-sinf ro‘yxatiga qo‘shiladi.</p>}
              </div>}
              {bookUploadProgress && <p role="status" className="hint">Yuklanmoqda: {bookUploadProgress}</p>}
              <button className="btn btn-primary" type="submit" disabled={uploading}>{uploading ? 'PDFlar yuklanmoqda...' : selectedPdfFiles.length>1?`+ ${selectedPdfFiles.length} ta darslikni saqlash`:'+ Darslikni saqlash'}</button>
              <p className="hint">Yangi darsliklar avvalgi darsliklarni almashtirmaydi. Saqlangach chap tomondagi sinf ro‘yxatida ko‘rinadi.</p>
            </form>
          </section>
        </div>
      </>}
       {page === 'chapters' && (isManager||role==='teacher') && <div className="two-cols">
         <section className="panel">
           <div className="panel-head"><h2>Bob va mavzular ro‘yxati</h2><span className="tag">{currentBook?.chapters.length ?? 0} bob</span></div>
           <label className="field-label">Darslik{bookSelect}</label>
           {currentBook?.chapters.length ? <div className="chapters">{currentBook.chapters.map((c,i) =>
             <button key={c.id} className={'chapter-row ' + (currentChapter?.id === c.id ? 'selected' : '')} onClick={()=>{setSelectedChapter(c.id);setStartPage('');setEndPage('');setEditingTopicIndex(null)}}>
               <strong>{i+1}-bob. {c.title}</strong>
               <small>{c.topics.length} ta mavzu · {c.startPage && c.endPage ? `${c.startPage}–${c.endPage}-sahifalar` : 'Sahifalar belgilanmagan'}</small>
             </button>)}</div> : <p className="hint">Boblar yo‘q. O‘ng tomondagi shakl orqali qo‘shing.</p>}
           {currentBook?.pdfKey && currentChapter?.startPage && <button type="button" className="btn btn-outline" style={{marginTop:14}} onClick={()=>void openPdf(currentBook,currentChapter.startPage)}>📄 Bob PDF sahifasini ochish</button>}
         </section>
         <section className="panel"><h2>Bob va mavzu muharriri</h2>
           <form onSubmit={addChapter} className="form">
             <label>Yangi bob nomi<input value={newChapter} onChange={e=>setNewChapter(e.target.value)} required placeholder="Masalan: Geometrik shakllar"/></label>
             <div className="option-grid"><label>PDF boshlanish sahifasi<input type="number" min="1" value={startPage} onChange={e=>setStartPage(e.target.value)} placeholder="Masalan: 26"/></label><label>PDF tugash sahifasi<input type="number" min="1" value={endPage} onChange={e=>setEndPage(e.target.value)} placeholder="Masalan: 48"/></label></div>
             <button className="btn btn-primary" type="submit">+ Bob qo‘shish</button>
           </form>
           <hr/>
           {currentChapter && <>
             <h3>Tanlangan bob: {currentChapter.title}</h3>
             <form className="form md21-editor-form" onSubmit={renameChapter}>
               <label>Bob nomini tahrirlash<input key={`${currentChapter.id}-${currentChapter.title}`} name="chapterTitle" required defaultValue={currentChapter.title} maxLength={180}/></label>
               <div className="md-button-row"><button className="btn btn-outline" type="submit">✎ Bob nomini saqlash</button>
                 <button className="btn md-btn-danger" type="button" onClick={deleteChapter}>Bo‘sh bobni o‘chirish</button></div>
             </form>
             <p className="hint">Sahifalar: {currentChapter.startPage && currentChapter.endPage ? `${currentChapter.startPage}–${currentChapter.endPage}` : 'Belgilanmagan'}. Raqamlar PDF fayl sahifalariga tegishli (kitobdagi bosma raqam boshqa bo‘lishi mumkin).</p>
             <form className="form" onSubmit={updateChapterPages}>
               <div className="option-grid"><label>Boshlanish sahifasi<input required type="number" min="1" value={startPage} onChange={e=>setStartPage(e.target.value)} placeholder={String(currentChapter.startPage ?? '1')}/></label><label>Tugash sahifasi<input required type="number" min="1" value={endPage} onChange={e=>setEndPage(e.target.value)} placeholder={String(currentChapter.endPage ?? '20')}/></label></div>
               <button className="btn btn-outline" type="submit">Sahifalarni yangilash</button>
             </form>
             <h3>Mavzular</h3>
             {currentChapter.topics.length===0&&<p className="hint">Bu bobda mavzu hali yo‘q.</p>}
             <ul className="topic-list md21-topics">{currentChapter.topics.map((t,i)=><li key={`${currentChapter.id}-${i}`}>
               {editingTopicIndex===i?<form className="md21-topic-edit" onSubmit={e=>renameTopic(e,i)}>
                 <input aria-label="Mavzu nomi" value={editingTopicName} maxLength={180} required onChange={e=>setEditingTopicName(e.target.value)}/>
                 <button className="btn btn-primary" type="submit">Saqlash</button>
                 <button className="btn btn-outline" type="button" onClick={()=>setEditingTopicIndex(null)}>Bekor</button>
               </form>:<div className="md21-topic-row"><span>{i+1}. {t}</span><div className="md21-topic-actions">
                 <button type="button" className="btn btn-outline" onClick={()=>{setEditingTopicIndex(i);setEditingTopicName(t)}}>Tahrirlash</button>
                 <button type="button" className="btn md-btn-danger" onClick={()=>deleteTopic(i)}>O‘chirish</button>
               </div></div>}
             </li>)}</ul>
             <form onSubmit={addTopic} className="form"><label>Yangi mavzu<input value={newTopic} onChange={e=>setNewTopic(e.target.value)} required placeholder="Mavzu nomi"/></label><button className="btn btn-outline">+ Mavzu qo‘shish</button></form>
             <button type="button" className="btn btn-outline" style={{marginTop:12}} onClick={()=>{setPage('questions');setTopicForQuestion('')}}>+ Shu bobga test tuzish →</button>
           </>}
         </section>
       </div>}
       {page === 'questions' && (isManager||role==='teacher') && <>
         <section className="panel" style={{marginBottom:20}}>
           <div className="panel-head"><h2>Word orqali test yuklash</h2><span className="tag">DOCX · Shablon</span></div>
           <p className="hint">Shablonni yuklab oling, Wordda savollar va rasmlarni joylashtiring. Rasm SAVOL: yoki A)–D) qatoridan keyin kelsa, shu joyga biriktiriladi. Har bir savolning to‘g‘ri javobini kiriting.</p>
           <div className="option-grid">
             <label>Darslik{bookSelect}</label><label>Bob{chapterSelect}</label>
           </div>
           <label className="field-label">Mavzu (agar Wordda MAVZU: yozilmagan bo‘lsa){' '}
             <select value={topicForQuestion} onChange={e=>setTopicForQuestion(e.target.value)}>
               <option value="">Umumiy bob testi</option>
               {currentChapter?.topics.map(t=><option key={t} value={t}>{t}</option>)}
             </select>
           </label>
           <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginTop:16}}>
             <a className="btn btn-outline" href="/templates/MATH-DIAGNOZ-Word-test-shablon.docx" download="MATH-DIAGNOZ-Word-test-shablon.docx">⬇ Word shablonni yuklab olish</a>
             <label className="btn btn-primary" style={{cursor:wordBusy?'wait':'pointer'}}>
               {wordBusy?'⏳ Tekshirilmoqda...':'⬆ Word testni yuklash'}
               <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={wordBusy || !currentChapter} style={{display:'none'}} onChange={e=>void importWordFile(e)}/>
             </label>
           </div>
           {!currentChapter && <p className="hint">Testni yuklash uchun oldin darslikka bob qo‘shing.</p>}
           {wordPreview && <div style={{border:'1px solid #dbe3ed',borderRadius:10,padding:16,marginTop:16}}>
             <h3>Tekshiruv natijasi: {wordFileName}</h3>
             <p>{wordPreview.questions.length} ta to‘g‘ri savol · {wordPreview.errors.length} ta xato</p>
             {wordPreview.errors.map((error,i)=><p key={i} style={{color:'#b42318'}}>⚠ {error}</p>)}
             {wordPreview.questions.map((q,i)=><div className="question-row" key={i}><b>{i+1}. <MathAnswer compact answer={q.text || 'Rasmli savol'}/></b>
             {q.images.map((src,k)=><img key={k} src={src} alt={`${i+1}-savol rasmi`} className="md-word-image" />)}
             {q.options.map((v,k)=><div key={k}><small>{String.fromCharCode(65+k)}) <MathAnswer compact answer={v}/></small>{(q.optionImages[k]||[]).map((src,j)=><img key={j} src={src} alt="Variant rasmi" className="md-word-image" />)}</div>)}
             <small>{q.topic || topicForQuestion || 'Bob testi'} · To‘g‘ri: {String.fromCharCode(65+q.correct)}</small></div>)}
             <div style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap'}}>
               <button type="button" className="btn btn-primary" disabled={wordPreview.errors.length>0 || wordPreview.questions.length===0} onClick={confirmWordImport}>✓ {wordPreview.questions.length} ta savolni bobga qo‘shish</button>
               <button type="button" className="btn btn-outline" onClick={()=>{setWordPreview(null);setWordFileName('')}}>Bekor qilish</button>
             </div>
           </div>}
         </section>
         <div className="two-cols">
           <section className="panel" id="md-question-editor">
             <div className="panel-head"><h2>{editingQuestionId!==null?'Savolni tahrirlash':'Yangi test savoli'}</h2>{editingQuestionId!==null&&<span className="tag">Tahrirlash rejimi</span>}</div>
             <form className="form" onSubmit={e=>void addQuestion(e)}>
               <label>Darslik{bookSelect}</label><label>Bob{chapterSelect}</label>
               <label>Mavzu (ixtiyoriy)<select value={topicForQuestion} onChange={e=>setTopicForQuestion(e.target.value)}><option value="">Umumiy bob testi</option>{currentChapter?.topics.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
               <label>Savol matni<textarea value={questionText} onChange={e=>setQuestionText(e.target.value)} rows={3} placeholder="Masalan: Rasmdagi shaklning nomini toping"/></label>
               <label>Savolga rasm qo‘shish (JPG/PNG/WEBP/GIF, 4 MB gacha)
                 <input key={`question-file-${editingQuestionId??'new'}-${fileInputEpoch}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>changeQuestionImage(e.target.files?.[0]||null)} />
               </label>
               {questionImageFile&&<small style={{color:'#2878af'}}>Yangi rasm: {questionImageFile.name}</small>}
               {editingQuestionId!==null&&keptQuestionImages.length>0&&<div>
                 <SavedQuestionImages imageKeys={keptQuestionImages} label="Saqlangan savol rasmi"/>
                 <button type="button" className="btn btn-outline" onClick={()=>setKeptQuestionImages([])}>Eski savol rasmlarini olib tashlash</button>
               </div>}
               <div className="option-grid">{options.map((o,i)=><div key={i} className="md-option-card">
                 <label>Variant {String.fromCharCode(65+i)}<input value={o} onChange={e=>setOptions(old=>old.map((x,j)=>j===i?e.target.value:x))} placeholder="Matn yoki rasm"/></label>
                 <label>Variant rasmi<input key={`option-${editingQuestionId??'new'}-${i}-${fileInputEpoch}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>changeOptionImage(i,e.target.files?.[0]||null)}/></label>
                 {optionImageFiles[i]&&<small>Yangi rasm: {optionImageFiles[i]?.name}</small>}
                 {editingQuestionId!==null&&keptOptionImages[i]?.length>0&&<>
                   <SavedQuestionImages imageKeys={keptOptionImages[i]} label={`Variant ${String.fromCharCode(65+i)} rasmi`} />
                   <button type="button" className="btn btn-outline" onClick={()=>setKeptOptionImages(old=>old.map((arr,j)=>j===i?[]:arr))}>Eski rasmni olib tashlash</button>
                 </>}
               </div>)}</div>
               <label>To‘g‘ri javob<select value={correct} onChange={e=>setCorrect(Number(e.target.value))}>{options.map((_,i)=><option key={i} value={i}>{String.fromCharCode(65+i)}</option>)}</select></label>
               <div className="md-button-row">
                 <button className="btn btn-primary" type="submit" disabled={savingQuestion||!currentChapter}>{savingQuestion?'Saqlanmoqda...':editingQuestionId!==null?'✓ O‘zgartirishlarni saqlash':'+ Savolni qo‘shish'}</button>
                 {editingQuestionId!==null&&<button className="btn btn-outline" type="button" onClick={resetQuestionForm}>Bekor qilish</button>}
               </div>
             </form>
           </section>
           <section className="panel"><div className="panel-head"><h2>Tanlangan bob savollari</h2><span className="tag">{questions.filter(q=>q.bookId===selectedBook&&q.chapterId===currentChapter?.id).length} ta</span></div>
             {questions.filter(q=>q.bookId===selectedBook&&q.chapterId===currentChapter?.id).length===0?<div className="empty">Bu bobga hali savol biriktirilmagan.</div>:questions.filter(q=>q.bookId===selectedBook&&q.chapterId===currentChapter?.id).map((q,i)=><div className="question-row" key={q.id}>
               <b>{i+1}. <MathAnswer compact answer={q.text||'Rasmli savol'}/></b>
               <SavedQuestionImages imageKeys={q.imageKeys} label={`${i+1}-savol rasmi`} />
               {q.options.map((o,k)=><div key={k} className="md-option-view">
                 <span style={{fontSize:12}}>{String.fromCharCode(65+k)}) <MathAnswer compact answer={o}/>{q.correct===k?' ✓':''}</span>
                 <SavedQuestionImages imageKeys={q.optionImageKeys?.[k]} label="Variant rasmi"/>
               </div>)}
               <small>{q.topic||'Umumiy bob testi'} · To‘g‘ri javob: {String.fromCharCode(65+q.correct)}</small>
               <div className="md-button-row">
                 <button type="button" className="btn btn-outline" onClick={()=>startEditing(q)}>✎ Tahrirlash</button>
                 <button type="button" className="btn md-btn-danger" onClick={()=>removeQuestion(q)}>🗑 O‘chirish</button>
               </div>
             </div>)}
             <button className="btn btn-outline" type="button" style={{marginTop:16}} onClick={()=>{setPage('tests');setPreviewAnswers({});setPreviewFinished(false)}}>▶ Bob testini sinab ko‘rish</button>
           </section>
       </div></>}
       {page === 'tests' && (isManager||role==='teacher') && <>
         <section className="panel" style={{marginBottom:18}}>
           <div className="panel-head"><h2>Testlarni yaratish va boshqarish</h2><span className="tag">{testSets.length} ta test</span></div>
           <p className="hint">Avval «Savollar banki»da bobga savollar qo‘shing. Keyin ularni tanlab alohida test tuzing. Yangi test avtomatik qoralama bo‘ladi.</p>
           <div className="option-grid"><label className="field-label">Darslik{bookSelect}</label><label className="field-label">Bob{chapterSelect}</label></div>
           <form className="form" onSubmit={createTest}>
             <label>Test nomi<input required value={newTestName} onChange={e=>setNewTestName(e.target.value)} placeholder="Masalan: 5-sinf. Geometrik shakllar — 1-test" /></label>
             <div className="md-v12-kind"><label>Test toifasi<select value={draftTestKind} onChange={e=>setDraftTestKind(e.target.value as 'regular'|'quarter')}><option value="regular">Oddiy mavzu yoki bob testi</option><option value="quarter">Choraklik test (1–4)</option></select></label>
               {draftTestKind==='quarter'&&<label>Qaysi chorak?<select value={draftTestQuarter} onChange={e=>setDraftTestQuarter(Number(e.target.value))}>{[1,2,3,4].map(q=><option key={q} value={q}>{q}-chorak</option>)}</select></label>}</div>
             <div className="md-v07-settings-grid">
               <label>Vaqt (daqiqa; bo‘sh bo‘lsa umumiy: {adminSettings.durationMinutes})<input type="number" min="1" max="240" value={draftDuration} onChange={e=>setDraftDuration(e.target.value)} placeholder={`${adminSettings.durationMinutes}`} /></label>
               <label>Urinishlar soni (umumiy: {adminSettings.maxAttempts})<input type="number" min="1" max="20" value={draftAttempts} onChange={e=>setDraftAttempts(e.target.value)} placeholder={`${adminSettings.maxAttempts}`} /></label>
               <label>O‘tish bali, % (umumiy: {adminSettings.passingPercent})<input type="number" min="0" max="100" value={draftPassing} onChange={e=>setDraftPassing(e.target.value)} placeholder={`${adminSettings.passingPercent}`} /></label>
               <label>Natijani o‘quvchiga ko‘rsatish<select value={draftShowResult} onChange={e=>setDraftShowResult(e.target.value)}><option value="default">Umumiy sozlama</option><option value="yes">Ha</option><option value="no">Yo‘q</option></select></label>
               <label>Testni ochish sanasi (ixtiyoriy)<input type="datetime-local" value={draftAvailableFrom} onChange={e=>setDraftAvailableFrom(e.target.value)} /></label>
               <label>Testni yopish sanasi (ixtiyoriy)<input type="datetime-local" value={draftAvailableUntil} onChange={e=>setDraftAvailableUntil(e.target.value)} /></label>
             </div>
             <p className="hint">Bo‘sh qoldirilgan parametrlar «Admin sozlamalari»dagi qiymatdan olinadi. Bitta testning vaqtini alohida belgilash mumkin.</p>
             <div className="md-v06-toolbar"><strong>Testga kiritiladigan savollar</strong><button type="button" className="btn btn-outline" onClick={()=>setChosenQuestions(currentChapterQuestions.map(q=>q.id))}>Hammasini belgilash</button><button type="button" className="btn btn-outline" onClick={()=>setChosenQuestions([])}>Tozalash</button></div>
             {currentChapterQuestions.length===0?<div className="empty">Ushbu bobda savol yo‘q. Avval savollar bankiga Word yoki qo‘lda savol qo‘shing.</div>:currentChapterQuestions.map((q,i)=><label className="md-v06-checkrow" key={q.id}><input type="checkbox" checked={chosenQuestions.includes(q.id)} onChange={e=>setChosenQuestions(old=>e.target.checked?[...new Set([...old,q.id])]:old.filter(id=>id!==q.id))}/><span>{i+1}. <MathAnswer compact answer={q.text||'Rasmli savol'}/> <small>({q.topic||'Bob testi'})</small></span></label>)}
             <button className="btn btn-primary" disabled={!currentChapter||!currentChapterQuestions.length}>+ Tanlangan {chosenQuestions.filter(id=>currentChapterQuestions.some(q=>q.id===id)).length} ta savoldan test yaratish</button>
           </form>
         </section>
         <section className="panel">
           <div className="panel-head"><h2>Yaratilgan testlar</h2><span className="tag">Faollashtirish / o‘chirish</span></div>
           {testSets.length===0?<div className="empty">Hozircha testlar yaratilmagan.</div>:<div className="md-v06-testlist">{testSets.map(t=>{
             const book=books.find(b=>b.id===t.bookId)
             const chapter=book?.chapters.find(c=>c.id===t.chapterId)
             const existing=t.questionIds.filter(id=>questions.some(q=>q.id===id)).length
             return <div className="md-v06-testcard" key={t.id}>
               <div className="md-v06-testhead"><strong>{t.title}</strong><span className={t.active?'md-v06-active':'md-v06-draft'}>{t.active?'Faol':'Qoralama'}</span></div>
               <p>{book?.grade||'?'}-sinf · {chapter?.title||'Bob topilmadi'} · {existing}/{t.questionIds.length} ta savol {t.kind==='quarter'?` · ${t.quarter||1}-chorak`:''}</p>
               {t.kind==='quarter'&&<p className="md-v12-gate-status">{quarterIsAvailable(t)?'✅ Chorak sinf uchun ochiq':'🔒 Chorak admin tomonidan yopilgan'}</p>}
               {existing!==t.questionIds.length&&<p className="md-v06-warning">Diqqat: ba’zi savollar bankdan o‘chirilgan.</p>}
                              <div className="md-v07-testdetails">
                 <span>⏱ {testDuration(t)} daqiqa</span><span>↻ {attemptsUsed(t.id)}/{testAttemptsLimit(t)} urinish</span><span>✓ O‘tish bali: {testPassing(t)}%</span>
               </div>
               <div className="md-v12-kind md-v12-kind-inline"><label>Test turi<select value={t.kind||'regular'} onChange={e=>patchTest(t.id,{kind:e.target.value as 'regular'|'quarter',quarter:e.target.value==='quarter'?(t.quarter||1):undefined})}><option value="regular">Oddiy test</option><option value="quarter">Choraklik test</option></select></label>{t.kind==='quarter'&&<label>Chorak<select value={t.quarter||1} onChange={e=>patchTest(t.id,{quarter:Number(e.target.value)})}>{[1,2,3,4].map(q=><option key={q} value={q}>{q}-chorak</option>)}</select></label>}</div>
               <div className="md-v07-settings-grid md-v07-inline">
                 <label>Test vaqti (daqiqa)<input type="number" min="1" max="240" placeholder={`Umumiy: ${adminSettings.durationMinutes}`} value={t.durationMinutes??''} onChange={e=>patchTest(t.id,{durationMinutes:e.target.value===''?undefined:Math.max(1,Math.min(240,Number(e.target.value)))})}/></label>
                 <label>Urinishlar soni<input type="number" min="1" max="20" placeholder={`Umumiy: ${adminSettings.maxAttempts}`} value={t.attemptLimit??''} onChange={e=>patchTest(t.id,{attemptLimit:e.target.value===''?undefined:Math.max(1,Math.min(20,Number(e.target.value)))})}/></label>
                 <label>O‘tish bali (%)<input type="number" min="0" max="100" placeholder={`Umumiy: ${adminSettings.passingPercent}`} value={t.passingPercent??''} onChange={e=>patchTest(t.id,{passingPercent:e.target.value===''?undefined:Math.max(0,Math.min(100,Number(e.target.value)))})}/></label>
                 <label>Natija ko‘rsatilishi<select value={t.showResult===undefined?'default':t.showResult?'yes':'no'} onChange={e=>patchTest(t.id,{showResult:e.target.value==='default'?undefined:e.target.value==='yes'})}><option value="default">Umumiy sozlama</option><option value="yes">Ko‘rsatish</option><option value="no">Yashirish</option></select></label>
                 <label>Faol bo‘lishidan boshlab<input type="datetime-local" value={localDatetimeInput(t.availableFrom)} onChange={e=>patchTest(t.id,{availableFrom:dateInputToIso(e.target.value)})}/></label>
                 <label>Faol bo‘lishi tugaguncha<input type="datetime-local" min={localDatetimeInput(t.availableFrom)||undefined} value={localDatetimeInput(t.availableUntil)} onChange={e=>patchTest(t.id,{availableUntil:dateInputToIso(e.target.value)})}/></label>
               </div>
               <small className="md-v07-savehint">O‘zgartirishlar avtomatik saqlanadi. Boshlangan testning hisoblagichi o‘zgarmaydi.</small>
               <div className="md-button-row"><button type="button" className="btn btn-outline" onClick={()=>toggleTest(t.id)}>{t.active?'Testni yopish':'Faollashtirish'}</button>
               <button type="button" className="btn btn-outline" onClick={()=>setNotice('Testni tekshirish uchun o‘quvchi login-paroli bilan kiring.')}>▶ O‘quvchi orqali sinash</button>
               <button type="button" className="btn md-btn-danger" onClick={()=>removeTest(t)}>🗑 O‘chirish</button></div>
             </div>
           })}</div>}
         </section>
       </>}
       {page === 'students' && role==='student' && <>
         <section className="panel" style={{marginBottom:18}}>
           <div className="panel-head"><h2>O‘quvchi testlari — {currentUser.name}</h2><span className="tag">{currentClass?.name||'Sinf biriktirilmagan'}</span></div>
           <p className="hint">Administrator test vaqtini va urinishlar sonini boshqaradi. Test vaqtini server nazorat qiladi; sahifani yangilash vaqtni qayta boshlamaydi.</p>
           <p className="md-v08-note">Testni administrator yoki o‘qituvchi sinfingizga tayinlagan bo‘lishi kerak. Sinf: <b>{currentClass?.name||'biriktirilmagan'}</b>. Sahifani yangilash test vaqtini qaytarmaydi.</p>
           {activeSession?.status==='running'&&<div className="md-v07-notice">Sizda boshlangan test bor. Boshqa bo‘limga o‘tsangiz ham vaqt davom etadi. Shu sahifaga qaytib davom ettiring.</div>}
           {!runningTest&&<>{eligibleTests.length===0?<div className="empty">Bu sinfga hali test yuborilmagan.</div>:eligibleTests.map(t=>{
             const assignment=assignments.find(a=>a.testId===t.id&&a.classId===currentUser.classId)
             const starts=scheduledStart(assignment,t)
             const waiting=Boolean(starts&&clockNow<starts)
             const closed=Boolean(t.availableUntil&&clockNow>=new Date(t.availableUntil).getTime())
             const gated=!quarterIsAvailable(t)
             const used=attemptsUsed(t.id)>=testAttemptsLimit(t)
             return <div className="md-v06-testcard md27-student-test" key={t.id}>
               <div className="md27-test-title"><strong>{t.title}</strong><span className={'md27-status '+(waiting?'future':closed||gated?'closed':'open')}>{waiting?'Boshlanishi kutilmoqda':closed?'Muddati tugagan':gated?'Hozircha yopiq':used?'Yakunlangan':'Ochiq'}</span></div>
               <p>{t.questionIds.length} ta savol · ⏱ {testDuration(t)} daqiqa · Urinish: {attemptsUsed(t.id)}/{testAttemptsLimit(t)}</p>
               <div className="md27-start-info"><span>📅 Test boshlanishi</span><strong>{displayDateTime(starts||assignment?.createdAt)}</strong>{t.availableUntil&&<small>Yopilish vaqti: {displayDateTime(t.availableUntil)}</small>}</div>
               <button className="btn btn-primary" disabled={used||waiting||closed||gated} onClick={()=>startStudentTest(t.id)}>{used?'Urinishlar tugagan':waiting?'Belgilangan vaqtni kuting':closed?'Test yopilgan':gated?'Chorak testi yopiq':'Testni boshlash →'}</button>
             </div>
           })}</>}
         </section>
         {runningTest&&<section className="panel">
           <div className="panel-head"><h2>{runningTest.title}</h2><span className="tag">{runningQuestions.length} ta savol</span></div>
           {!studentFinished ? <>
             <div className={'md-v07-countdown ' + (secondsLeft <= adminSettings.warnBeforeMinutes*60 ? 'md-v07-countdown-warn' : '')} aria-live="off">
               <span>Qolgan vaqt</span><strong aria-label={`${secondsLeft} soniya qoldi`}>{formatCountdown(secondsLeft)}</strong>
               <small>⏱ Vaqt tugashi bilan test avtomatik yakunlanadi.</small>
             </div>
             <p className="hint">Javoblaringiz avtomatik saqlanadi. Javobsiz savollar 0 ball bo‘ladi. «Testni yakunlash» tugmasini muddatdan oldin ham bosish mumkin.</p>
             {runningQuestions.map((q,i)=><div className="question-row" key={q.id}><b>{i+1}. <MathAnswer compact answer={q.text||'Rasmli savol'}/></b>
               <SavedQuestionImages imageKeys={q.imageKeys} label="Savol rasmi"/>
               {q.options.map((opt,k)=><label className="md-test-option" key={k}><input type="radio" name={`student-${q.id}`} checked={studentAnswers[q.id]===k} onChange={()=>answerQuestion(q.id,k)}/><span>{String.fromCharCode(65+k)}) <MathAnswer compact answer={opt}/><SavedQuestionImages imageKeys={q.optionImageKeys?.[k]} label="Variant rasmi"/></span></label>)}
             </div>)}
             <div className="md-v06-toolbar"><span>Javob berildi: {runningQuestions.filter(q=>studentAnswers[q.id]!==undefined).length}/{runningQuestions.length}</span><button type="button" className="btn btn-primary" onClick={()=>finishStudentTest('submitted')}>Testni yakunlash</button><button type="button" className="btn btn-outline" onClick={()=>{setPage('dashboard');setNotice('Test davom etmoqda. Hisoblagich to‘xtamaydi. O‘quvchilar sahifasiga qaytib yakunlang.')}}>Boshqa bo‘limga o‘tish</button></div>
           </> : <div className="md-v06-result">
             {activeSession?.showResult&&studentTestResult ? <>
               <h3>{studentTestResult.reason==='expired'?'Vaqt tugadi — test yakunlandi':'Test yakunlandi'}</h3>
               <h2>{Math.round(studentTestResult.score/studentTestResult.total*100)}% · {studentTestResult.passed?'O‘tdi':'O‘tmadi'}</h2>
               <p><strong>{studentTestResult.score} / {studentTestResult.total}</strong> ta to‘g‘ri javob</p>
               <h3>Mavzular bo‘yicha matematik pasport</h3>
               {studentTestResult.topicResults.map(t=><div key={t.topic} className="md-v06-topic"><span>{t.topic}</span><span>{t.correct}/{t.total} · {Math.round(t.correct/t.total*100)}%</span><div className="md-v06-meter"><span style={{width:`${t.correct/t.total*100}%`,background:t.correct/t.total<0.5?'#ce5252':t.correct/t.total<0.8?'#d9a53f':'#2f9e78'}}/></div></div>)}
               <p className="hint">Kam savolli test diagnostikasi ilmiy baholash emas, taxminiy natija hisoblanadi.</p>
             </> : <><h3>Test yakunlandi</h3><p>Administrator sozlamasiga binoan natija o‘quvchiga ko‘rsatilmaydi. Hisobot admin panelida saqlangan.</p></>}
             <button className="btn btn-primary" onClick={()=>{finishLock.current=false;setActiveSession(null)}}>Boshqa testni tanlash</button>
           </div>}
         </section>}
       </>}
      {page === 'library' && <section className="panel">
        <h2>5–9-sinf elektron kutubxonasi</h2><p className="hint">Darsliklar o‘quvchi uchun ko‘rish rejimida. Yangi PDFlar serverda saqlanadi; eski fayllarni administrator «Tizim va zaxira» sahifasidan ko‘chirishi mumkin.</p>
        {books.filter(b=>role!=='student'||b.grade===currentClass?.grade).map(b=><div className="md-v08-list" key={b.id}><div><strong>{b.grade}-sinf · {b.title}</strong><small>{b.author} · {b.chapters.length} ta bob</small></div><button className="btn btn-outline" disabled={!b.pdfKey} onClick={()=>void openPdf(b)}>{b.pdfKey?'PDFni ochish':'PDF mavjud emas'}</button><div className="md-v08-chapters">{b.chapters.map((c,i)=><span key={c.id}>{i+1}. {c.title}{c.startPage?` (${c.startPage}–${c.endPage||'?'}-sahifalar)`:''}</span>)}</div></div>)}
      </section>}
      {page === 'students' && (isManager||role==='teacher') && <section className="panel">
        <div className="panel-head"><h2>O‘quvchilar ro‘yxati va o‘zlashtirish</h2><span className="tag">{users.filter(u=>u.role==='student'&&(isManager||myClassIds.includes(u.classId||-1))).length} nafar</span></div>
        <p className="hint">Maktab va sinf bo‘yicha tanlang. O‘qituvchi faqat o‘ziga biriktirilgan sinflarni ko‘radi. O‘quvchi profillari «Foydalanuvchilar» bo‘limida boshqariladi.</p>
        <div className="md21-filters">
          <label>Maktab<select value={studentSchoolFilter} onChange={e=>{setStudentSchoolFilter(Number(e.target.value));setStudentClassFilter(0)}}>
            <option value={0}>Barcha maktablar</option>
            {schools.filter(s=>isManager||classes.some(c=>c.schoolId===s.id&&myClassIds.includes(c.id))).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <label>Sinf<select value={studentClassFilter} onChange={e=>setStudentClassFilter(Number(e.target.value))}>
            <option value={0}>Barcha sinflar</option>
            {classes.filter(c=>(isManager||myClassIds.includes(c.id))&&(!studentSchoolFilter||c.schoolId===studentSchoolFilter)).map(c=><option key={c.id} value={c.id}>{c.name} · {c.grade}-sinf</option>)}
          </select></label>
          <span className="md21-filter-total">{users.filter(u=>u.role==='student'&&studentVisibleClasses.some(c=>c.id===u.classId)).length} nafar o‘quvchi</span>
        </div>
        {studentVisibleClasses.length===0&&<div className="empty">Bu tanlov bo‘yicha sinf topilmadi.</div>}
        {studentVisibleClasses.map(c=><div key={c.id} className="md-v08-list"><strong>{c.name} · {c.grade}-sinf</strong>
          {users.filter(u=>u.role==='student'&&u.classId===c.id).length===0?<small>Bu sinfda hali o‘quvchi yo‘q.</small>:users.filter(u=>u.role==='student'&&u.classId===c.id).map(u=>{
            const attempts=testAttempts.filter(a=>a.studentId===u.id)
            const avg=attempts.length?Math.round(attempts.reduce((sum,a)=>sum+a.score/Math.max(1,a.total),0)/attempts.length*100):null
            return <div key={u.id} className="md-v08-roster"><span>{u.name}</span><span>{attempts.length} ta test</span><strong>{avg===null?'Natija yo‘q':avg+'%'}</strong></div>
          })}
        </div>)}
      </section>}
      {page === 'schools' && isManager && <div className="md-v12-schools-page">
        <section className="panel md-v12-school-overview">
          <div className="panel-head"><div><h2>🏫 Maktablar — yagona ro‘yxat</h2><p className="hint">Maktabni bosing: sinflar, ro‘yxatdan o‘tgan o‘quvchilar, platformaga kirganlar va test natijalari shu sahifaning o‘zida ochiladi.</p></div><button className="btn btn-primary" onClick={()=>{clearSchoolForm();setShowSchoolForm(v=>!v)}}>{showSchoolForm?'Formani yopish':'+ Maktab qo‘shish'}</button></div>
          <div className="md-v12-metrics"><div><span>Maktablar</span><b>{schools.length}</b></div><div><span>Ro‘yxatdagi o‘quvchilar</span><b>{users.filter(u=>u.role==='student').length}</b></div><div><span>Tizimga kirgan o‘quvchilar</span><b>{users.filter(u=>u.role==='student'&&u.lastLoginAt).length}</b></div><div><span>O‘quvchi kirgan maktablar</span><b>{schools.filter(s=>users.some(u=>u.role==='student'&&u.lastLoginAt&&classes.some(c=>c.id===u.classId&&c.schoolId===s.id))).length}</b></div></div>
          <div className="md-v12-toolbar"><label>🔎 Maktab qidirish<input value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)} placeholder="Maktab nomi, tuman yoki kod" /></label><span className="tag">Ko‘rsatilgan: {schools.filter(s=>[s.name,s.region,s.district,s.code].join(' ').toLocaleLowerCase().includes(schoolSearch.toLocaleLowerCase())).length}</span></div>
          <div className="md-v12-school-list">{schools.filter(s=>[s.name,s.region,s.district,s.code].join(' ').toLocaleLowerCase().includes(schoolSearch.toLocaleLowerCase())).map(s=>{
            const schoolClasses=classes.filter(c=>c.schoolId===s.id)
            const pupils=users.filter(u=>u.role==='student'&&schoolClasses.some(c=>c.id===u.classId))
            const entered=pupils.filter(u=>Boolean(u.lastLoginAt)).length
            const attempts=testAttempts.filter(a=>pupils.some(u=>u.id===a.studentId))
            return <div key={s.id} className={'md-v12-school-item '+(openSchoolId===s.id?'selected':'')}>
              <button type="button" className="md-v12-school-open" aria-expanded={openSchoolId===s.id} onClick={()=>{setOpenSchoolId(openSchoolId===s.id?null:s.id);setSchoolStudentSearch('')}}><span className="md-v12-school-logo">🏫</span><span className="md-v12-school-name"><strong>{s.name}</strong><small>{[s.region,s.district].filter(Boolean).join(' · ')}{s.code?' · '+s.code:''}</small></span><span className="md-v12-school-count"><b>{pupils.length}</b><small>o‘quvchi</small></span><span className="md-v12-school-count"><b>{entered}</b><small>kirgan</small></span><span className="md-v12-school-count"><b>{attempts.length}</b><small>test</small></span><span className="md-v12-school-arrow">{openSchoolId===s.id?'−':'+'}</span></button>
              <div className="md-v12-school-actions"><button className="btn btn-outline" onClick={()=>{editSchool(s);setShowSchoolForm(true)}}>✎ Tahrirlash</button><button className="btn md-btn-danger" onClick={()=>void deleteSchool(s)}>O‘chirish</button></div>
            </div>
          })}</div>
        </section>
        {showSchoolForm&&<section className="panel md-v12-school-form"><h2>{schoolEditingId===null?'Yangi maktab qo‘shish':'Maktab ma’lumotlarini tahrirlash'}</h2><form className="form" onSubmit={async e=>{await saveSchool(e);setShowSchoolForm(false)}}><div className="md-v12-form-grid"><label>Maktab nomi<input required minLength={3} maxLength={120} value={schoolName} onChange={e=>setSchoolName(e.target.value)} placeholder="Masalan: 94-maktab"/></label><label>Viloyat<input value={schoolRegion} onChange={e=>setSchoolRegion(e.target.value)}/></label><label>Tuman / shahar<input value={schoolDistrict} onChange={e=>setSchoolDistrict(e.target.value)}/></label><label>Maktab kodi<input value={schoolCode} onChange={e=>setSchoolCode(e.target.value)}/></label></div><div className="md-button-row"><button className="btn btn-primary" type="submit">Saqlash</button><button className="btn btn-outline" type="button" onClick={()=>{clearSchoolForm();setShowSchoolForm(false)}}>Bekor qilish</button></div></form></section>}
        {selectedSchool&&<section className="panel md-v12-school-detail" id="school-detail"><div className="panel-head"><div><div className="eyebrow">MAKTAB TAFSILOTI</div><h2>{selectedSchool.name}</h2><p className="hint">{[selectedSchool.region,selectedSchool.district].filter(Boolean).join(' · ')}</p></div><button className="btn btn-outline" type="button" onClick={()=>setOpenSchoolId(null)}>Yopish ×</button></div>
          <div className="md-v12-metrics"><div><span>Sinflar</span><b>{selectedSchoolClasses.length}</b></div><div><span>Ro‘yxatda</span><b>{selectedSchoolStudents.length}</b></div><div><span>Kamida bir marta kirgan</span><b>{selectedSchoolStudents.filter(u=>Boolean(u.lastLoginAt)).length}</b></div><div><span>Topshirilgan testlar</span><b>{schoolTestAttempts.length}</b></div></div>
          <div className="md-v12-section-head"><h3>Sinflar kesimida</h3><span className="tag">5–9-sinflar</span></div>
          {selectedSchoolClasses.length?<div className="md-v12-class-grid">{selectedSchoolClasses.map(c=>{const pupils=selectedSchoolStudents.filter(u=>u.classId===c.id),a=schoolTestAttempts.filter(x=>x.classId===c.id);return <div key={c.id} className="md-v12-class-card"><strong>{c.name}</strong><span>{c.grade}-sinf</span><small>{pupils.length} ro‘yxatda · {pupils.filter(u=>u.lastLoginAt).length} kirgan</small><small>{a.length} ta test · {a.length?Math.round(a.reduce((n,x)=>n+x.score/Math.max(1,x.total),0)/a.length*100):'—'}% o‘rtacha</small></div>})}</div>:<div className="empty">Bu maktabga sinf biriktirilmagan. «Maktab sinflari» bo‘limidan yarating.</div>}
          <div className="md-v12-section-head"><h3>O‘quvchilar va kirishlar</h3><button className="btn btn-outline" type="button" onClick={()=>{const lines=[['Maktab','Sinf','O‘quvchi','Login','Ro‘yxat holati','Oxirgi kirish','Testlar','O‘rtacha foiz'],...selectedSchoolStudents.map(u=>{const a=schoolTestAttempts.filter(x=>x.studentId===u.id);return [selectedSchool.name,classes.find(c=>c.id===u.classId)?.name||'',u.name,u.username||'',u.active?'Faol':'Faolsiz',u.lastLoginAt?new Date(u.lastLoginAt).toLocaleString('uz-UZ'):'Kirmagan',a.length,a.length?Math.round(a.reduce((n,x)=>n+x.score/Math.max(x.total,1),0)/a.length*100):'']})];downloadText('\uFEFF'+lines.map(row=>row.map(csvSafe).join(',')).join('\r\n'),`maktab-${selectedSchool.id}-oquvchilar.csv`,'text/csv;charset=utf-8')}}>↓ Excel uchun CSV</button></div>
          <label className="md-v12-pupil-search">O‘quvchini qidirish<input value={schoolStudentSearch} onChange={e=>setSchoolStudentSearch(e.target.value)} placeholder="Ism, login yoki sinf" /></label>
          <div className="md-v12-table-wrap"><table className="md-v12-table"><thead><tr><th>O‘quvchi</th><th>Sinf</th><th>Holati</th><th>Oxirgi kirish</th><th>Testlar</th><th>O‘rtacha natija</th></tr></thead><tbody>{selectedSchoolStudents.filter(u=>[u.name,u.username,classes.find(c=>c.id===u.classId)?.name].join(' ').toLocaleLowerCase().includes(schoolStudentSearch.toLocaleLowerCase())).map(u=>{const a=schoolTestAttempts.filter(x=>x.studentId===u.id);return <tr key={u.id}><td><strong>{u.name}</strong><small>{u.username||''}</small></td><td>{classes.find(c=>c.id===u.classId)?.name||'—'}</td><td><span className={u.lastLoginAt?'md-v12-online':'md-v12-offline'}>{u.lastLoginAt?'Kirgan':'Hali kirmagan'}</span></td><td>{u.lastLoginAt?new Date(u.lastLoginAt).toLocaleString('uz-UZ'):'—'}</td><td>{a.length}</td><td>{a.length?`${Math.round(a.reduce((n,x)=>n+x.score/Math.max(1,x.total),0)/a.length*100)}%`:'—'}</td></tr>})}</tbody></table>{selectedSchoolStudents.length===0&&<p className="hint">Hozircha bu maktabdan o‘quvchi ro‘yxatdan o‘tmagan.</p>}</div>
          <p className="hint">«Kirgan» — v1.2 va undan keyin tizimga muvaffaqiyatli login qilgan o‘quvchi. Eski hisoblardagi avvalgi kirishlar qayta tiklanmaydi. «Ro‘yxatda» esa shu maktab sinfiga biriktirilgan hisoblar soni.</p>
        </section>}
      </div>}
      {page==='quarterly' && <section className="panel md-v12-quarter-page">
        <div className="panel-head"><div><div className="eyebrow">CHORAKLIK BAHOLASH</div><h2>1–4-chorak testlari</h2><p className="hint">Har bir sinf uchun choraklarni administrator ochadi. Oddiy testdan farqli ravishda chorak yopiq bo‘lsa, o‘quvchi choraklik testni boshlay olmaydi.</p></div><span className="tag">5–9-sinflar</span></div>
        <div className="md-v12-grade-nav">{[5,6,7,8,9].map(g=><button key={g} type="button" onClick={()=>setQuarterGrade(g)} className={quarterGrade===g?'selected':''}>{g}-sinf</button>)}</div>
        <div className="md-v12-quarter-grid">{[1,2,3,4].map(q=>{const enabled=quarterIsEnabled(quarterGrade,q);const ts=testSets.filter(t=>t.kind==='quarter'&&(t.quarter||1)===q&&quarterTestGrade(t)===quarterGrade);return <div key={q} className={'md-v12-quarter-card '+(enabled?'enabled':'disabled')}>
          <div className="md-v12-quarter-icon">{enabled?'🔓':'🔒'}</div><h3>{q}-chorak</h3><p>{enabled?'Faol — test topshirishga ruxsat':'Hali faol emas'}</p><small>{ts.length} ta choraklik test</small>
          {isManager&&<button className={'btn '+(enabled?'btn-outline':'btn-primary')} onClick={()=>toggleQuarter(quarterGrade,q)}>{enabled?'Chorakni yopish':'Chorakni ochish'}</button>}
          {role==='teacher'&&<span className="tag">{enabled?'Ochiq':'Yopiq'} · admin boshqaradi</span>}
          {role==='student'&&<span className="tag">{enabled?'Faol':'Hali faol emas'}</span>}
          <button className="btn btn-outline" type="button" onClick={()=>setQuarterNumber(q)}>{quarterNumber===q?'Tanlangan':'Testlarni ko‘rish'}</button>
        </div>})}</div>
        <div className="md-v12-section-head"><h3>{quarterGrade}-sinf · choraklik testlar</h3>{(isManager||role==='teacher')&&<button className="btn btn-primary" type="button" onClick={()=>{const book=books.find(b=>b.grade===quarterGrade);if(!book){setCatalogGrade(quarterGrade);setPage('books');setNotice(`${quarterGrade}-sinf uchun avval darslik yarating.`);return}setSelectedBook(book.id);setSelectedChapter(book.chapters[0]?.id||0);setDraftTestKind('quarter');setDraftTestQuarter(quarterNumber);setPage('tests');setNotice(`${quarterGrade}-sinf, ${quarterNumber}-chorak uchun savollarni tanlab test yarating.`)}}>+ Chorak testini yaratish</button>}</div>
        <div className="md-v12-quarter-filter"><label>Chorak<select value={quarterNumber} onChange={e=>setQuarterNumber(Number(e.target.value))}>{[1,2,3,4].map(q=><option key={q} value={q}>{q}-chorak</option>)}</select></label></div>
        {testSets.filter(t=>t.kind==='quarter'&&quarterTestGrade(t)===quarterGrade&&(t.quarter||1)===quarterNumber).length===0?<div className="empty">Bu chorak uchun test hali yaratilmagan. «Savollar banki»da savollar tuzing, so‘ng «Testlarni boshqarish»da turini «Choraklik test» deb tanlang.</div>:testSets.filter(t=>t.kind==='quarter'&&quarterTestGrade(t)===quarterGrade&&(t.quarter||1)===quarterNumber).map(t=>{const used=assignments.filter(a=>a.testId===t.id),count=testAttempts.filter(a=>a.testId===t.id).length;return <div className="md-v12-quarter-test" key={t.id}><div><strong>{t.title}</strong><small>{t.questionIds.length} ta savol · {testDuration(t)} daqiqa · {count} yakunlangan urinish</small><small>Tayinlangan: {used.map(a=>classes.find(c=>c.id===a.classId)?.name||'Sinf').join(', ')||'Hech bir sinfga yuborilmagan'}</small></div><div className="md-button-row"><span className={t.active&&quarterIsAvailable(t)?'md-v12-online':'md-v12-offline'}>{t.active&&quarterIsAvailable(t)?'Ochiq':'Yopiq'}</span>{(isManager||role==='teacher')&&<button className="btn btn-outline" onClick={()=>{setAssignmentTestId(t.id);setPage('assignments')}}>Sinfga yuborish →</button>}{role==='student'&&assignedToStudent(t.id,currentUser.id)&&t.active&&quarterIsAvailable(t)&&<><small>📅 Boshlanish: {displayDateTime(scheduledStart(assignments.find(a=>a.testId===t.id&&a.classId===currentUser.classId),t))}</small><button className="btn btn-primary" disabled={clockNow<scheduledStart(assignments.find(a=>a.testId===t.id&&a.classId===currentUser.classId),t)||!isAvailableNow(t,clockNow)} onClick={()=>startStudentTest(t.id)}>Testni boshlash →</button></>}</div></div>})}
        <p className="hint">Chorak faolligi serverdagi bazaga saqlanadi. O‘quvchi uchun sinfga tayinlash, testning «Faol» holati, chorak ochiqligi va urinish limiti birgalikda tekshiriladi.</p>
      </section>}
      {page === 'classes' && isManager  && <div className="two-cols">
        <section className="panel"><h2>Maktab sinflari</h2>{classes.map(c=><div className="md-v08-list" key={c.id}>
        <strong>{c.name} · {c.grade}-sinf</strong><small>{schools.find(s=>s.id===c.schoolId)?.name||'Maktab belgilanmagan'} · {users.filter(u=>u.role==='student'&&u.classId===c.id&&u.active).length} o‘quvchi</small>
        <label>Maktab<select value={c.schoolId??0} onChange={e=>void updateClass(c,{schoolId:Number(e.target.value)})}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Biriktirilgan o‘qituvchi<select value={c.teacherId??0} onChange={e=>void updateClass(c,{teacherId:Number(e.target.value)||null})}><option value={0}>Tanlanmagan</option>{users.filter(u=>u.role==='teacher'&&u.active).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <button className="btn md-btn-danger" disabled={users.some(u=>u.classId===c.id&&u.active)||assignments.some(a=>a.classId===c.id)} onClick={()=>void deleteClass(c)}>O‘chirish</button></div>)}</section>
        <section className="panel"><h2>Yangi sinf</h2><form className="form" onSubmit={addClass}><label>Sinf nomi<input value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="Masalan: 6-B" required/></label><label>Maktab<select required value={classSchoolId} onChange={e=>setClassSchoolId(Number(e.target.value))}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>O‘quv darajasi<select value={newClassGrade} onChange={e=>setNewClassGrade(Number(e.target.value))}>{grades.map(g=><option key={g} value={g}>{g}-sinf</option>)}</select></label><button className="btn btn-primary">+ Sinf qo‘shish</button></form><p className="hint">O‘qituvchini chapdagi ro‘yxatda biriktirish mumkin.</p></section>
      </div>}

      {page === 'admins' && role==='admin' && <div className="md17-admin-layout">
        <section className="panel md17-admin-intro">
          <div className="md17-admin-icon">♛</div><h2>Super-admin boshqaruvi</h2>
          <p>Bosh administrator barcha maktablar, tizim sozlamalari, zaxiralar va yordamchi administratorlarni boshqaradi. <b>Yordamchi admin</b> maktablar, sinflar, testlar, o‘qituvchilar va o‘quvchilar bilan ishlaydi, lekin super-adminni yoki tizim zaxiralarini o‘zgartira olmaydi.</p>
          <div className="md17-admin-grid"><div><small>SUPER-ADMIN</small><b>{users.filter(u=>u.role==='admin').length}</b></div><div><small>YORDAMCHI ADMIN</small><b>{users.filter(u=>u.role==='assistant_admin'&&u.active).length}</b></div><div><small>TASDIQ KUTAYOTGANLAR</small><b>{users.filter(u=>u.verified===false&&u.active).length}</b></div></div>
        </section>
        <section className="panel">
          <h2>Yordamchi admin yaratish</h2><p className="hint">Bu hisobni faqat super-admin yarata oladi. O‘qituvchi yoki ota-ona o‘zi administratorga aylana olmaydi.</p>
          <form className="form" onSubmit={e=>void createAssistant(e)}><label>Ism-familiya<input value={assistantName} onChange={e=>setAssistantName(e.target.value)} minLength={2} required placeholder="Maktab administratori"/></label>
          <label>Login<input value={assistantLogin} onChange={e=>setAssistantLogin(e.target.value)} minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]+" required placeholder="yordamchi_admin"/></label>
          <label>Vaqtinchalik parol<input type="password" value={assistantPassword} onChange={e=>setAssistantPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></label>
          <button className="btn btn-primary" type="submit">＋ Yordamchi admin yaratish</button></form>
        </section>
        <section className="panel md17-admin-list"><h2>Administratorlar</h2>
          {users.filter(u=>u.role==='admin'||u.role==='assistant_admin').map(u=><div className="md17-admin-item" key={u.id}><div className="md17-admin-avatar">{u.role==='admin'?'♛':'♟'}</div><div><b>{u.name}</b><small>@{u.username} · {ROLE_NAMES[u.role]} · {u.active?'Faol':'Bloklangan'}</small></div>{u.role==='assistant_admin'&&<button className="btn btn-outline" onClick={()=>void toggleUser(u)}>{u.active?'Bloklash':'Faollashtirish'}</button>}</div>)}
        </section>
      </div>}
      {page === 'users' && isManager && <div className="two-cols">
        <section className="panel"><h2>Foydalanuvchilar · {users.length} ta</h2>
          <div className="md21-role-tabs" aria-label="Foydalanuvchi rollari">
            {userRoleOptions.filter(opt=>role==='admin'||opt.id!=='admin'&&opt.id!=='assistant_admin').map(opt=><button key={opt.id} type="button" aria-pressed={userRoleFilter===opt.id} className={'md21-role-pill '+(userRoleFilter===opt.id?'selected':'')} onClick={()=>setUserRoleFilter(opt.id)}>{opt.label} <b>{opt.id==='all'?users.length:users.filter(u=>u.role===opt.id).length}</b></button>)}
          </div>
          <label className="md21-search">🔎 Qidirish<input type="search" value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="Ism, login, sinf yoki rol"/></label>
          <p className="hint">Ko‘rsatilmoqda: {filteredUsers.length} ta · Ro‘yxatni rol bo‘yicha ajratish ma’lumotlarni o‘chirmaydi.</p>
          <div className="md-v08-scroll">{filteredUsers.length===0&&<div className="empty">Tanlangan rol yoki qidiruv bo‘yicha foydalanuvchi topilmadi.</div>}{filteredUsers.map(u=><div className="md-v08-list" key={u.id}><div><strong>{u.name} {u.verified===false&&<span className="md17-pending-tag">Tasdiq kutilmoqda</span>} {!u.active&&<span style={{color:'#c13c3c'}}> (bloklangan)</span>}</strong><small>{ROLE_NAMES[u.role]} {u.classId?' · '+(classes.find(c=>c.id===u.classId)?.name||'Sinf yo‘q'):''}{u.childIds?.length?' · '+u.childIds.length+' farzand':''}</small></div><div className="md-button-row">{['student','parent'].includes(u.role)&&<button className="btn btn-outline" onClick={()=>void toggleVerified(u)}>{u.verified===false?'✓ Tasdiqlash':'Tasdiqni bekor qilish'}</button>}<button className="btn btn-outline" disabled={u.role==='admin'&&u.id!==currentUser.id||u.role==='assistant_admin'&&role!=='admin'} onClick={()=>editUser(u)}>Tahrirlash</button><button className="btn md-btn-danger" disabled={u.role==='admin'||u.role==='assistant_admin'&&role!=='admin'||u.id===currentUser.id} onClick={()=>void deleteUser(u)}>Butunlay o‘chirish</button><button className="btn btn-outline" disabled={u.role==='admin'||u.role==='assistant_admin'&&role!=='admin'||u.id===currentUser.id} onClick={()=>void toggleUser(u)}>{u.active?'Bloklash':'Faollashtirish'}</button></div></div>)}</div></section>
        <section className="panel"><h2>{editingUserId===null?'Yangi foydalanuvchi':'Profilni tahrirlash'}</h2><form className="form" onSubmit={addOrEditUser}><label>Ism / profil nomi<input value={newUserName} required onChange={e=>setNewUserName(e.target.value)}/></label>{editingUserId===null&&<><label>Yangi login<input value={newUserUsername} required minLength={3} maxLength={32} placeholder="Masalan: ustoz2026" onChange={e=>setNewUserUsername(e.target.value)}/></label><label>Vaqtinchalik parol<input type="password" value={newUserPassword} minLength={8} required placeholder="Kamida 8 belgi" onChange={e=>setNewUserPassword(e.target.value)}/></label></>}<label>Rol<select value={newUserRole} onChange={e=>setNewUserRole(e.target.value as DemoRole)}>{role==='admin'&&<option value="assistant_admin">Yordamchi admin</option>}<option value="teacher">O‘qituvchi</option><option value="student">O‘quvchi</option><option value="parent">Ota-ona</option></select></label>{newUserRole==='student'&&<label>Sinf<select value={newUserClassId} onChange={e=>setNewUserClassId(Number(e.target.value))}>{classes.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}{newUserRole==='teacher'&&<div><strong>O‘qituvchiga biriktiriladigan sinflar</strong>{classes.map(c=><label key={c.id} className="md-v08-check"><input type="checkbox" checked={newTeacherClassIds.includes(c.id)} onChange={e=>setNewTeacherClassIds(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/>{c.name}</label>)}</div>}{newUserRole==='parent'&&<ParentChildPicker key={editingUserId??'new'} schools={schools} classes={classes} users={users} value={newParentChildIds} onChange={setNewParentChildIds}/> }{editingUserId!==null&&<label>Yangi parol (ixtiyoriy, kamida 8 belgi)<input type="password" minLength={8} value={userResetPassword} onChange={e=>setUserResetPassword(e.target.value)} placeholder="Parolni o‘zgartirmaslik uchun bo‘sh qoldiring"/></label>}<div className="md-button-row"><button className="btn btn-primary">Saqlash</button>{editingUserId!==null&&<button type="button" className="btn btn-outline" onClick={()=>{setEditingUserId(null);setNewUserName('')}}>Bekor qilish</button>}</div></form><p className="hint">Yangi foydalanuvchi login va parol bilan kiradi. Parollar Neon PostgreSQL bazasida xesh shaklida saqlanadi. Ota-ona va farzand aloqasini administrator belgilaydi.</p></section>
      </div>}
      {page === 'parent-links' && role==='teacher' && <TeacherParentLinks teacherId={currentUser.id} classes={classes} users={users} />}
      {page === 'assignments' && (isManager||role==='teacher') && <div className="two-cols md27-assign-layout">
        <section className="panel"><h2>Testni sinfga yuborish</h2><form className="form" onSubmit={assignTest}>
          <label>Test<select value={assignmentTestId} onChange={e=>setAssignmentTestId(Number(e.target.value))}><option value={0}>Testni tanlang</option>{testSets.filter(t=>t.active).map(t=><option key={t.id} value={t.id}>{t.title} ({books.find(b=>b.id===t.bookId)?.grade}-sinf)</option>)}</select></label>
          <label>Sinf<select value={assignmentClassId} onChange={e=>setAssignmentClassId(Number(e.target.value))}>{classes.filter(c=>isManager||myClassIds.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.name} ({c.grade}-sinf)</option>)}</select></label>
          <label>📅 Boshlanish vaqti (ixtiyoriy)<input type="datetime-local" value={assignmentStartInput} onChange={e=>setAssignmentStartInput(e.target.value)}/></label>
          <p className="hint">Vaqt belgilamasangiz test darhol ochiladi (testning o‘zida keyinroq vaqt belgilanmagan bo‘lsa). O‘quvchi boshlanish sanasi va soatini ko‘radi.</p>
          <button className="btn btn-primary" disabled={!assignmentTestId}>⇢ Testni sinfga yuborish</button></form></section>
        <section className="panel"><div className="panel-head"><h2>Yuborilgan testlar · {assignments.filter(a=>isManager||myClassIds.includes(a.classId)).length} ta</h2><button type="button" className="btn btn-outline" disabled={assignmentStatusLoading} onClick={()=>void refreshAssignmentStatus()}>{assignmentStatusLoading?'Yangilanmoqda...':'↻ Holatni yangilash'}</button></div>
          {assignmentStatusError&&<p className="md27-error" role="alert">{assignmentStatusError}</p>}
          {assignments.length===0?<div className="empty">Hali sinfga test yuborilmagan.</div>:assignments.filter(a=>isManager||myClassIds.includes(a.classId)).map(a=>{
            const test=testSets.find(t=>t.id===a.testId)
            const report=assignmentStatuses.find(r=>r.id===a.id)
            const opened=expandedAssignment===a.id
            const startsAt=report?.startAt||scheduledStart(a,test||{availableFrom:undefined} as TestSet)
            const waitingForStart=Boolean(startsAt&&clockNow<new Date(startsAt).getTime())
            const pastDeadline=Boolean(test?.availableUntil&&clockNow>=new Date(test.availableUntil).getTime())
            const stateLabel=!test?.active?'Yopiq':pastDeadline?'Muddat tugagan':waitingForStart?'Rejalangan':'Ochiq'
            return <div className="md27-assignment" key={a.id}>
              <div className="md27-assignment-head"><div><strong>{test?.title||'O‘chirilgan test'}</strong><small>{classes.find(c=>c.id===a.classId)?.name||'Sinf topilmadi'} · Yuborilgan: {displayDateTime(a.createdAt)}</small><small>Boshlanishi: <b>{displayDateTime(report?.startAt||scheduledStart(a,test||{availableFrom:undefined} as TestSet))}</b></small></div>
              <span className={'md27-status '+(stateLabel==='Ochiq'?'open':stateLabel==='Rejalangan'?'future':'closed')}>{stateLabel}</span></div>
              {report&&<div className="md27-counter-row"><span>Jami <b>{report.total}</b></span><span>Yakunladi <b>{report.finished}</b></span><span>Jarayonda <b>{report.running}</b></span><span>Kutmoqda <b>{report.waiting}</b></span><span>Yopilgan <b>{report.expired}</b></span></div>}
              <div className="md-button-row md27-actions"><button type="button" className="btn btn-outline" aria-expanded={opened} onClick={()=>{setExpandedAssignment(opened?null:a.id);setPreviewAssignmentQuestions(false);if(!opened)void refreshAssignmentStatus()}}>{opened?'▴ Yopish':'◉ Holatini ko‘rish'}</button><button type="button" className="btn md-btn-danger" onClick={()=>{if(window.confirm('Testni bu sinfdan olib tashlaysizmi?')){setAssignments(old=>old.filter(x=>x.id!==a.id));setExpandedAssignment(null)}}}>Bekor qilish</button></div>
              {opened&&<div className="md27-detail"><div className="md27-detail-header"><strong>Test ma’lumotlari</strong><button type="button" className="btn btn-outline" onClick={()=>setPreviewAssignmentQuestions(v=>!v)}>{previewAssignmentQuestions?'Savollarni yashirish':'Savollarni ko‘rish'}</button></div>
                <div className="md27-meta"><span>Savollar: <b>{test?.questionIds.length||0}</b></span><span>Davomiylik: <b>{test?testDuration(test):'—'} daqiqa</b></span><span>Yopilishi: <b>{displayDateTime(report?.endAt||test?.availableUntil)}</b></span></div>
                {previewAssignmentQuestions&&<ol className="md27-question-list">{test?.questionIds.map(id=>questions.find(q=>q.id===id)).filter((q):q is Question=>Boolean(q)).map(q=><li key={q.id}><b><MathAnswer compact answer={q.text||'Rasmli savol'}/></b><SavedQuestionImages imageKeys={q.imageKeys} label="Savol rasmi"/><ul>{q.options.map((opt,i)=><li className={q.correct===i?'md27-correct':''} key={i}>{String.fromCharCode(65+i)}) <MathAnswer compact answer={opt}/>{q.correct===i?' ✓':''}<SavedQuestionImages imageKeys={q.optionImageKeys?.[i]} label="Variant rasmi"/></li>)}</ul></li>)}</ol>}
                <strong>O‘quvchilar holati</strong>
                {!report?<p className="hint">Monitoring yuklanmoqda. «Holatni yangilash»ni bosing.</p>:report.students.length===0?<p className="hint">Sinfga faol o‘quvchi biriktirilmagan.</p>:<div className="md27-student-list">{report.students.map(u=><div key={u.id} className="md27-student-row"><span>{u.name}</span><span>{u.status==='finished'?`✓ Yakunladi · ${u.score}/${u.total}`:u.status==='running'?'▶ Ishlamoqda':u.status==='expired'?'⏰ Vaqti tugagan':u.status==='scheduled'?'◷ Boshlanishni kutmoqda':u.status==='closed'?'⏰ Test yopilgan':'— Boshlamagan'}</span></div>)}</div>}
                <small className="hint">Natijalar 20 soniyada yangilanadi. Har bir o‘quvchining yakunlangan testi hisobga olinadi.</small>
              </div>}
            </div>
          })}</section>
      </div>}
      {page === 'children' && role==='parent' && <section className="panel"><h2>Farzandlarim</h2><p className="hint">Ota-onaga bir nechta farzand biriktirish mumkin. Har birining natijalari alohida ko‘rsatiladi.</p>{childIds.length===0?<div className="empty">Hali sizga farzand biriktirilmagan. Admin panelida bog‘lang.</div>:<><label className="field-label">Farzand<select value={viewedChild?.id??''} onChange={e=>setParentChildId(Number(e.target.value))}>{childIds.map(id=>{const u=users.find(x=>x.id===id);return <option key={id} value={id}>{u?.name||id} · {classes.find(c=>c.id===u?.classId)?.name||''}</option>})}</select></label><div className="md-v08-profile"><h3>{viewedChild?.name}</h3><p>{classes.find(c=>c.id===viewedChild?.classId)?.name||'Sinf yo‘q'}</p>{testAttempts.filter(a=>a.studentId===viewedChild?.id).length===0?<p>Hozircha test natijalari mavjud emas.</p>:testAttempts.filter(a=>a.studentId===viewedChild?.id).map(a=><div className="md-v08-list" key={a.id}><strong>{a.testTitle}</strong><span>{a.score}/{a.total} · {Math.round(a.score/a.total*100)}% · {a.passed?'O‘tdi':'O‘tmadi'}</span><small>{new Date(a.createdAt).toLocaleString('uz-UZ')}</small>{a.topicResults.map(t=><small key={t.topic}>{t.topic}: {t.correct}/{t.total}</small>)}</div>)}</div></>}</section>}
      {page === 'diagnostics' && <section className="panel">
        <div className="panel-head"><h2>Matematik pasport va bilim bo‘shliqlari</h2><span className="tag">{diagnosticAttempts.length} ta test</span></div>
        <label className="field-label" style={{maxWidth:420,marginBottom:16}}>Natijalarni kim bo‘yicha ko‘rish
          <select value={diagnosticStudentId} onChange={e=>setDiagnosticStudentId(Number(e.target.value))}>
            <option value={0}>Barcha ruxsat etilgan o‘quvchilar</option>
            {diagnosticStudents.map(u=><option key={u.id} value={u.id}>{u.name} · {classes.find(c=>c.id===u.classId)?.name||''}</option>)}
          </select>
        </label>
        <p className="hint">Diagnostika testlarda mavzu belgisi qo‘yilgan savollar natijasidan hisoblanadi. Bir nechta savolli mavzular bo‘yicha xulosa ishonchliroq bo‘ladi; bu statistik pedagogik baholashning yakuniy xulosasi emas.</p>
        {diagnosticAttempts.length===0?<div className="empty">Natija yo‘q. O‘quvchi sinfga tayinlangan testni ishlab yakunlashi kerak.</div>:<>
          <div className="md-v06-results-summary"><span><b>{diagnosticAttempts.length}</b> ta yakunlangan urinish</span><span><b>{Math.round(diagnosticAttempts.reduce((n,a)=>n+a.score/Math.max(a.total,1),0)/diagnosticAttempts.length*100)}%</b> umumiy o‘rtacha</span></div>
          <div className="md-v11-progress"><strong>Natijalarning vaqt bo‘yicha o‘zgarishi (oxirgi 8 ta test)</strong>
            {diagnosticProgress.map(a=><div className="md-v11-progress-row" key={a.id}><span>{a.testTitle}</span><div><i style={{width:`${Math.round(a.score/Math.max(1,a.total)*100)}%`}}/></div><b>{Math.round(a.score/Math.max(1,a.total)*100)}%</b></div>)}
          </div>
          {Array.from(diagnosticAttempts.flatMap(a=>a.topicResults).reduce((map,t)=>{const x=map.get(t.topic)||{topic:t.topic,correct:0,total:0};x.correct+=t.correct;x.total+=t.total;map.set(t.topic,x);return map},new Map<string,TopicResult>()).values()).sort((a,b)=>a.correct/a.total-b.correct/b.total).map(t=>{const pct=Math.round(t.correct/Math.max(1,t.total)*100);return <div key={t.topic} className="md-v06-topic">
            <span><strong>{t.topic}</strong> · {t.correct}/{t.total} to‘g‘ri</span><span>{pct}% {pct<50?'🔴 Qo‘shimcha mashqlar kerak':pct<80?'🟡 Takrorlash kerak':'🟢 Yaxshi'}</span>
            <div className="md-v06-meter"><span style={{width:`${pct}%`,background:pct<50?'#ce5252':pct<80?'#d9a53f':'#2f9e78'}}/></div>
            {pct<80&&<small>Tavsiya: «{t.topic}» mavzusidan nazariyani ko‘rib chiqing, kamida 5 ta yangi misol ishlang va qayta diagnostikadan o‘ting.</small>}
          </div>})}
        </>}
      </section>}
       {page === 'reports' && ['admin','assistant_admin','teacher'].includes(role) && <AssessmentReport/>}
       {page === 'reports' && <section className="panel"><div className="panel-head"><h2>Test natijalari</h2><span className="tag">{visibleAttempts.length} ta urinish</span></div><button className="btn btn-outline" type="button" onClick={exportAttemptsCsv} disabled={visibleAttempts.length===0}>↓ Natijalarni CSV (Excel) yuklab olish</button>
         <p className="hint">Natijalar ma’lumotlar bazasida saqlanadi. Shaxsiy ma’lumotlarni ruxsatsiz tarqatmang.</p>
         {visibleAttempts.length===0?<div className="empty">Sinov natijalari hali yo‘q. «O‘quvchilar» sahifasida faol testni bajarib ko‘ring.</div>:<>
           <div className="md-v06-results-summary"><span><b>{visibleAttempts.length}</b> ta test ishlangan</span><span><b>{Math.round(visibleAttempts.reduce((sum,a)=>sum+a.score/a.total,0)/visibleAttempts.length*100)}%</b> o‘rtacha natija</span></div>
           <div className="md-v06-report-table"><div className="md-v06-report-row md-v08-report-row md-v06-report-heading"><span>Test nomi</span><span>O‘quvchi</span><span>Sinf</span><span>Natija</span><span>O‘tish</span><span>Sabab</span><span>Sana</span></div>{visibleAttempts.map(a=><div className="md-v06-report-row md-v08-report-row" key={a.id}><span>{a.testTitle}</span><span>{users.find(u=>u.id===a.studentId)?.name||"O‘quvchi"}</span><span>{a.grade}-sinf</span><span>{a.score}/{a.total} ({Math.round(a.score/a.total*100)}%)</span><span>{a.passed===undefined?'—':a.passed?'O‘tdi':'O‘tmadi'}</span><span>{a.reason==='expired'?'Vaqt tugadi':'Yakunlandi'}</span><span>{new Date(a.createdAt).toLocaleString('uz-UZ')}</span></div>)}</div>
         </>}
       </section>}
      {page==='practice'&&role==='student'&&<PracticePanel grade={currentClass?.grade||5}/>}
      {page==='system'&&role==='admin'&&<div className="md13-system">
        <section className="md13-hero"><div><span className="md13-kicker">TIZIM NAZORATI · v1.3</span><h2>Platforma salomatligi va zaxira</h2><p>Markaziy baza, darslik va rasmlar, so‘nggi kirishlar va amal jurnali bir joyda.</p></div><span className="md13-health-pill">● {serverHealth?.mode==='neon-render-pilot'?'Neon + Render':'Mahalliy server'}</span></section>
        <div className="md13-grid4">
          {[['Faol foydalanuvchilar',serverHealth?.users,'♙'],['Maktablar',serverHealth?.schools,'▥'],['Test natijalari',serverHealth?.results,'◫'],['Server fayllari',serverHealth?.files,'▤']].map(([label,value,icon])=><div className="md13-metric" key={String(label)}><span className="md13-metric-icon">{icon}</span><small>{label}</small><strong>{value??'—'}</strong></div>)}
        </div>
        <div className="two-cols">
          <section className="panel md13-panel"><div className="panel-head"><h2>Ma’lumotlar xavfsizligi</h2><span className="tag">Admin</span></div><p>Oxirgi zaxira: <b>{serverHealth?.lastBackup||'Hali yaratilmagan'}</b></p><p>Serverda saqlangan fayllar hajmi: <b>{((serverHealth?.fileBytes||0)/1024/1024).toFixed(1)} MB</b></p><div className="md-button-row"><button className="btn btn-primary" disabled={systemBusy} onClick={()=>void createSystemBackup()}>◈ To‘liq zaxira yaratish</button><button className="btn btn-outline" disabled={systemBusy} onClick={()=>void migrateLocalFiles()}>⇧ Eski fayllarni serverga ko‘chirish</button><button className="btn btn-outline" onClick={()=>void refreshSystem()}>↻ Yangilash</button></div><p className="hint">{serverHealth?.mode==='neon-render-pilot'?'Neon zaxirasi .json.gz fayl sifatida kompyuteringizga yuklanadi. Uni boshqa xavfsiz joyga ham nusxalang.':'Zaxiralar loyiha ichidagi server/backups/ papkasiga yoziladi. Serverni to‘xtatgach, bu papkani tashqi diskka ko‘chiring.'}</p>{systemFeedback&&<div className="md13-feedback" role="status">{systemFeedback}</div>}</section>
          <section className="panel md13-panel"><div className="panel-head"><h2>Oxirgi amallar</h2><span className="tag">Audit</span></div><div className="md13-events">{auditEvents.length?auditEvents.slice(0,12).map((ev,i)=><div key={i}><span className="md13-event-dot"/><div><b>{ev.actor||'Tizim'}</b><small>{ev.action} · {ev.details}</small></div><time>{new Date(ev.createdAt).toLocaleString('uz-UZ')}</time></div>):<p className="hint">Hozircha amallar jurnali bo‘sh.</p>}</div></section>
        </div>
        <section className="panel md13-panel"><h2>Ishga tushirishdan oldingi tekshiruv</h2><div className="md13-readiness"><div><b>✓</b><span>Administrator va rollar</span></div><div><b>✓</b><span>5–9-sinflar, maktablar</span></div><div><b>✓</b><span>Word, PDF va rasmli savollar</span></div><div><b>✓</b><span>Choraklik va vaqtli testlar</span></div><div><b>✓</b><span>Server natijalari va reyting</span></div><div><b>!</b><span>Internetga chiqarish oldidan HTTPS, audit va yuklama sinovi zarur</span></div></div></section>
      </div>}
      {page === 'settings' && role==='admin' && <>
        <section className="panel" style={{marginBottom:18}}>
          <div className="panel-head"><h2>Administrator — testning umumiy sozlamalari</h2><span className="tag">Saqlanadigan standartlar</span></div>
          <p className="hint">Bu parametrlar barcha 5–9-sinflar uchun standart bo‘ladi. Ayrim testlarga alohida vaqt belgilash mumkin. Parametrlar serverga saqlanadi.</p>
          <form className="form" onSubmit={saveGlobalSettings}>
            <div className="md-v07-settings-grid">
              <label>Test davomiyligi (daq.)<input type="number" min="1" max="240" required value={settingsDraft.durationMinutes} onChange={e=>setSettingsDraft(old=>({...old,durationMinutes:Number(e.target.value)}))}/></label>
              <label>Bir test uchun urinishlar soni<input type="number" min="1" max="20" required value={settingsDraft.maxAttempts} onChange={e=>setSettingsDraft(old=>({...old,maxAttempts:Number(e.target.value)}))}/></label>
              <label>O‘tish bali (%)<input type="number" min="0" max="100" required value={settingsDraft.passingPercent} onChange={e=>setSettingsDraft(old=>({...old,passingPercent:Number(e.target.value)}))}/></label>
              <label>Vaqt tugashi haqida ogohlantirish (daq.)<input type="number" min="1" max="30" required value={settingsDraft.warnBeforeMinutes} onChange={e=>setSettingsDraft(old=>({...old,warnBeforeMinutes:Number(e.target.value)}))}/></label>
              <label>Natija o‘quvchiga ko‘rinsinmi?<select value={settingsDraft.showResult?'yes':'no'} onChange={e=>setSettingsDraft(old=>({...old,showResult:e.target.value==='yes'}))}><option value="yes">Ha</option><option value="no">Yo‘q, faqat admin ko‘rsin</option></select></label>
            </div>
            <div className="md-button-row"><button type="submit" className="btn btn-primary">✓ Sozlamalarni saqlash</button><button type="button" className="btn btn-outline" onClick={()=>setSettingsDraft({...adminSettings})}>Saqlanmagan o‘zgarishlarni bekor qilish</button></div>
          </form>
        </section>
        <section className="panel" style={{marginBottom:18}}>
          <h2>Ma’lumotlarni nazorat qilish va zaxira</h2>
          <div className="md-v07-settings-grid">
            <div className="md-v07-mini"><strong>Darsliklar</strong><span>{books.length}</span></div>
            <div className="md-v07-mini"><strong>Savollar</strong><span>{questions.length}</span></div>
            <div className="md-v07-mini"><strong>Testlar</strong><span>{testSets.length}</span></div>
            <div className="md-v07-mini"><strong>Sinovlar</strong><span>{testAttempts.length}</span></div>
          </div>
          <div className="md-button-row"><button className="btn btn-outline" type="button" onClick={exportMetadataBackup}>↓ JSON zaxira (matn va sozlamalar)</button><button className="btn btn-outline" type="button" onClick={exportAttemptsCsv} disabled={!testAttempts.length}>↓ Hisobot CSV</button></div>
          <p className="hint">JSON eksport faqat matn va sozlamalar uchun. To‘liq zaxira yaratish «Tizim va zaxira» bo‘limida mavjud.</p>
        </section>
        
      </>}
      {page==='ranking'&&<section className="panel md-v10-ranking-panel">
        <div className="panel-head"><div><div className="eyebrow">🏆 MATH-DIAGNOZ</div><h2>O‘quvchilar reytingi</h2><p className="hint">Har bir testning eng yaxshi natijasi olinadi, turli testlar bo‘yicha o‘rtacha foiz hisoblanadi. Qayta-qayta ishlash reytingni oshirmaydi.</p></div><button className="btn btn-outline" type="button" onClick={()=>void loadRanking()}>↻ Yangilash</button></div>
        <div className="md-v10-ranking-filters"><label>Sinf darajasi<select value={rankGrade} onChange={e=>{setRankGrade(Number(e.target.value));setRankClass(0)}}><option value={0}>5–9-sinflar</option>{[5,6,7,8,9].map(g=><option key={g} value={g}>{g}-sinf</option>)}</select></label><label>Guruh<select value={rankClass} onChange={e=>setRankClass(Number(e.target.value))}><option value={0}>Barcha guruhlar</option>{classes.filter(c=>!rankGrade||c.grade===rankGrade).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
        {ranking.length===0?<div className="empty">Hozircha yakunlangan testlar yo‘q. O‘quvchilar test ishlagach reyting avtomatik shakllanadi.</div>:<>
          <div className="md-v10-podium">{ranking.slice(0,3).map((r,i)=><div key={r.studentId} className={`md-v10-podium-card rank-${i}`}><span>{['🥇','🥈','🥉'][i]}</span><b>{r.displayName}</b><small>{r.className} · {r.tests} ta test</small><strong>{r.average}%</strong></div>)}</div>
          <div className="md-v10-table-wrap"><table className="md-v10-rank-table"><thead><tr><th>O‘rin</th><th>O‘quvchi</th><th>Sinf</th><th>Testlar</th><th>O‘rtacha</th></tr></thead><tbody>{ranking.map(r=><tr key={r.studentId} className={r.isMe?'is-me':''}><td>#{r.rank}</td><td>{r.displayName} {r.isMe&&<span className="md-v10-you">Siz</span>}</td><td>{r.className}</td><td>{r.tests}</td><td><b>{r.average}%</b></td></tr>)}</tbody></table></div>
        </>}
        <p className="hint">Reyting faqat tizimga kirganlarga ko‘rsatiladi. Boshqa o‘quvchilarning familiyalari qisqartiriladi.</p>
      </section>}
      </main><footer className="md27-site-author">Muallif: Xolmurodova Shaxnoza Zayirovna</footer>
    </div>
  </div>
}
export default App
