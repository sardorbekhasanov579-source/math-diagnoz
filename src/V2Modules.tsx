import {useEffect,useMemo,useState,type FormEvent,type ChangeEvent} from 'react'
import mammoth from 'mammoth'
import {parseAssessmentText,type AssessmentDraft} from './assessmentWord'
import {api,type SignedUser} from './AuthScreen'
import './V2Modules.css'

type DraftQuestion={text:string;options:string[];correct:number;explanation?:string}
type V2Book={id:number;title:string;grade:number;chapters:{id:number;title:string;topics:string[]}[]}
type Props={page:'ai'|'international'|'teacher-tools'|'student-assistant'|'help';role:SignedUser['role'];name:string;books:V2Book[];onImport?:(bookId:number,chapterId:number,topic:string,questions:DraftQuestion[])=>Promise<void>}
const levelText=['1-bosqich — asosiy ko‘nikmalar','2-bosqich — amaliy/murakkab topshiriqlar']
const programData=[{id:'PISA',icon:'🌐',desc:'15 yoshli o‘quvchilar uchun matematik savodxonlik',note:'5–9-sinflarda moslashtirilgan namuna'},{id:'TIMSS',icon:'📊',desc:'Matematika va tabiiy fanlar',note:'Asl dastur 4 va 8-sinflarda'},{id:'PIRLS',icon:'📖',desc:'O‘qib tushunish savodxonligi',note:'Asl dastur 4-sinf uchun'},{id:'TALIS',icon:'👩‍🏫',desc:'O‘qituvchi va rahbarlar so‘rovnomasi',note:'O‘quvchi uchun test emas'}]
const teacherTasks=[
 {id:'quiz',icon:'🎮',name:'Jonli uslubdagi viktorina',desc:'Kahoot uslubidagi mashq, taymer va ball'},
 {id:'worksheet',icon:'🧩',name:'Kartochka va topshiriq',desc:'Matematik moslashtirish va savol kartochkalari'},
 {id:'plan',icon:'📋',name:'Dars ishlanmasi',desc:'Maqsad, bosqichlar va baholash'},
 {id:'protocol',icon:'🗂️',name:'Bayonnoma va hisobot',desc:'Maktab uchun tahrirlanadigan namuna'},
 {id:'schedule',icon:'📅',name:'Ish reja',desc:'Mavzu, haftalik ish va mas’ullar'},
 {id:'slides',icon:'📽️',name:'Taqdimot rejasi',desc:'Slaydlar uchun tuzilma va tezislar'}
] as const
const exampleQuiz=[
 {q:'3x + 6 = 15. x ni toping.',options:['2','3','4','5'],right:1,why:'3x=9, demak x=3.'},
 {q:'Tomoni 5 sm bo‘lgan kvadratning perimetri?',options:['10','15','20','25'],right:2,why:'P=4×5=20 sm.'},
 {q:'25% oddiy kasrda?',options:['1/4','1/2','3/4','1/5'],right:0,why:'25/100=1/4.'},
 {q:'√64 sonining qiymati?',options:['6','7','8','9'],right:2,why:'8×8=64.'}
]
const validRole=(role:SignedUser['role'])=>['teacher','admin','assistant_admin'].includes(role)
const pdfSafe=(s:string)=>s.replace(/[^\p{L}\p{N} _-]/gu,'').trim().replace(/\s+/g,'-').slice(0,40)||'hujjat'
function saveText(text:string,file:string){const blob=new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=file;link.click();window.setTimeout(()=>URL.revokeObjectURL(link.href),1000)}
function safeError(e:unknown){return e instanceof Error?e.message:'Amal bajarilmadi'}
export default function V2Modules({page,role,name,books,onImport}:Props){
 const isEducator=validRole(role)
 const isAdmin=role==='admin'||role==='assistant_admin'
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [feedback,setFeedback]=useState('')
 const [config,setConfig]=useState<{configured:boolean;provider:string;model:string}|null>(null)
 const [bookId,setBookId]=useState(books[0]?.id||0)
 const book=books.find(b=>b.id===bookId)
 const [chapterId,setChapterId]=useState(0)
 const chapter=book?.chapters.find(c=>c.id===chapterId)||book?.chapters[0]
 const [topic,setTopic]=useState('')
 const [count,setCount]=useState(10)
 const [difficulty,setDifficulty]=useState('O‘rtacha')
 const [questions,setQuestions]=useState<DraftQuestion[]>([])
 const [selected,setSelected]=useState<number[]>([])
 const [source,setSource]=useState('')
 const [program,setProgram]=useState('PISA')
 const [stage,setStage]=useState(1)
 const [evalQuestions,setEvalQuestions]=useState<{id:number;text:string;options:string[]}[]>([])
 const [evalVersion,setEvalVersion]=useState('')
 const [assessmentFile,setAssessmentFile]=useState('')
 const [assessmentDraft,setAssessmentDraft]=useState<AssessmentDraft[]>([])
 const [assessmentErrors,setAssessmentErrors]=useState<string[]>([])
 const [assessmentMode,setAssessmentMode]=useState<'append'|'replace'>('append')
 const [assessmentBank,setAssessmentBank]=useState<{count:number;source:string;questions:AssessmentDraft[]}|null>(null)
 const [answers,setAnswers]=useState<Record<number,number>>({})
 const [evalResult,setEvalResult]=useState<{score:number;total:number;passed:boolean;details:{correct:number;why:string;chosen:number}[]}|null>(null)
 const [progress,setProgress]=useState<{program:string;stage:number;score:number;total:number;createdAt:number}[]>([])
 const [tool,setTool]=useState<typeof teacherTasks[number]['id']>('quiz')
 const [toolTopic,setToolTopic]=useState('Geometrik shakllar')
 const [toolGrade,setToolGrade]=useState(5)
 const [toolSchool,setToolSchool]=useState('Sinov maktabi')
 const [toolOutput,setToolOutput]=useState('')
 const [quizIndex,setQuizIndex]=useState(0)
 const [quizAnswer,setQuizAnswer]=useState<number|null>(null)
 const [quizScore,setQuizScore]=useState(0)
 const [tutorText,setTutorText]=useState('')
 const [tutorAnswer,setTutorAnswer]=useState('')
 const [tutorGrade,setTutorGrade]=useState(5)
 const [tickets,setTickets]=useState<Array<{id:number;title:string;message:string;category:string;status:string;answer:string;created_at:number;author_name?:string}>>([])
 const [ticketTitle,setTicketTitle]=useState('')
 const [ticketMessage,setTicketMessage]=useState('')
 const [ticketCategory,setTicketCategory]=useState('technical')
 const [replyDraft,setReplyDraft]=useState<Record<number,string>>({})
 const [filter,setFilter]=useState('all')
 const [assistMode,setAssistMode]=useState<'explain'|'practice'>('explain')
 useEffect(()=>{if(page==='ai'||page==='student-assistant'||page==='teacher-tools'||page==='international')api<typeof config>('/api/v2/config').then(d=>setConfig(d)).catch(()=>{})},[page])
 useEffect(()=>{if(page==='help')void refreshTickets()},[page])
 useEffect(()=>{if(page==='international')api<{rows:typeof progress}>('/api/v2/assessment/progress').then(d=>setProgress(d.rows)).catch(()=>{})},[page])
 useEffect(()=>{if(page==='international'&&isAdmin)void refreshAssessmentBank()},[page,program,stage,isAdmin])
 useEffect(()=>{setQuestions([]);setSelected([]);setSource('');setTopic('')},[bookId])
 const selectedGrade=book?.grade||5
 const topics=useMemo(()=>chapter?.topics||[],[chapter])
 async function refreshTickets(){try{const d=await api<{rows:typeof tickets}>('/api/v2/support');setTickets(d.rows)}catch(e){setError(safeError(e))}}
 async function generate(e:FormEvent){e.preventDefault();if(!isEducator)return;setError('');setFeedback('');setBusy(true)
  try{const picked=topic.trim()||topics[0]||chapter?.title||'Matematika';const d=await api<{source:string;warning:string;questions:DraftQuestion[]}>('/api/v2/ai/generate','POST',{grade:selectedGrade,topic:picked,count,difficulty});setQuestions(d.questions);setSelected(d.questions.map((_,i)=>i));setSource(d.source);setFeedback(d.warning)}catch(e){setError(safeError(e))}finally{setBusy(false)}
 }
 async function importToBank(){if(!onImport||!book||!chapter||selected.length===0)return;setError('');setBusy(true);try{await onImport(book.id,chapter.id,topic.trim()||topics[0]||chapter.title,questions.filter((_,i)=>selected.includes(i)));setFeedback(`${selected.length} ta savol savollar bankiga kiritildi. O‘quvchiga yuborishdan oldin test tuzing.`);setQuestions([]);setSelected([])}catch(e){setError(safeError(e))}finally{setBusy(false)}}
 async function refreshAssessmentBank(){try{const d=await api<{count:number;source:string;questions:AssessmentDraft[]}>(`/api/v2/assessment/bank?program=${program}&stage=${stage}`);setAssessmentBank(d)}catch(e){setAssessmentBank(null);setError(safeError(e))}}
 async function readAssessmentFile(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value='';if(!file)return
  setError('');setFeedback('');setAssessmentDraft([]);setAssessmentErrors([]);setAssessmentFile(file.name)
  if(!/\.(docx|txt)$/i.test(file.name)){setError('Faqat .docx yoki .txt fayl yuklang. PDF va rasmlar hozircha qo‘llanmaydi.');return}
  if(file.size>5*1024*1024){setError('Word fayl 5 MB dan kichik bo‘lsin');return}
  setBusy(true)
  try{
   const raw=file.name.toLowerCase().endsWith('.docx')?(await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value:await file.text()
   const parsed=parseAssessmentText(raw)
   setAssessmentDraft(parsed.questions);setAssessmentErrors(parsed.errors)
   if(!parsed.errors.length)setFeedback(`${parsed.questions.length} ta savol tekshiruvga tayyor. Javoblarni tasdiqlab yuklang.`)
  }catch(e){setError('Fayl o‘qilmadi: '+safeError(e))}finally{setBusy(false)}
 }
 async function generateAssessmentAI(){
  if(!isAdmin||!config?.configured)return
  setBusy(true);setError('');setFeedback('');setAssessmentDraft([]);setAssessmentErrors([]);setAssessmentFile('')
  try{
   const d=await api<{questions:AssessmentDraft[];warning:string}>('/api/v2/assessment/ai/generate','POST',{program,stage,count:10})
   setAssessmentDraft(d.questions);setAssessmentFile('Gemini AI orqali yaratilgan savollar');setFeedback(d.warning)
  }catch(e){setError(safeError(e))}finally{setBusy(false)}
 }
 async function uploadAssessment(){
  if(!isAdmin||!assessmentDraft.length||assessmentErrors.length)return
  if(assessmentMode==='replace'&&!window.confirm(`${program} ${stage}-bosqichdagi oldingi yuklangan savollarni almashtirasizmi?`))return
  setBusy(true);setError('');setFeedback('')
  try{
   const d=await api<{added:number;total:number}>('/api/v2/assessment/import','POST',{program,stage,mode:assessmentMode,questions:assessmentDraft})
   setAssessmentDraft([]);setAssessmentErrors([]);setAssessmentFile('');setEvalQuestions([]);setEvalResult(null);setEvalVersion('')
   setFeedback(`${d.added} ta savol saqlandi! ${program} ${stage}-bosqichida jami ${d.total} ta savol. O‘quvchilar shu savollarni ko‘radi.`)
   await refreshAssessmentBank()
  }catch(e){setError(safeError(e))}finally{setBusy(false)}
 }
 async function loadAssessment(){setBusy(true);setError('');setEvalResult(null);setAnswers({});try{const d=await api<{questions:typeof evalQuestions;version:string}>(`/api/v2/assessment/questions?program=${program}&stage=${stage}`);setEvalQuestions(d.questions);setEvalVersion(d.version)}catch(e){setEvalQuestions([]);setEvalVersion('');setError(safeError(e))}finally{setBusy(false)}}
 async function submitAssessment(){setBusy(true);setError('');try{const d=await api<NonNullable<typeof evalResult>>('/api/v2/assessment/submit','POST',{program,stage,version:evalVersion,answers:evalQuestions.map((_,i)=>answers[i])});setEvalResult(d);setEvalQuestions([]);const p=await api<{rows:typeof progress}>('/api/v2/assessment/progress');setProgress(p.rows)}catch(e){setError(safeError(e))}finally{setBusy(false)}}
 function createTeacherDoc(){const g=toolGrade,subject=`${g}-sinf. ${toolTopic.trim()||'Matematika'}`;let text='';
  if(tool==='plan')text=`DARS ISHLANMASI\nMaktab: ${toolSchool}\nSinf va mavzu: ${subject}\nSana: __________\n\nDars maqsadi:\n1. O‘quvchilar asosiy tushunchalarni izohlay oladilar.\n2. Mavzuga mos misollarni mustaqil bajaradilar.\n\nDars bosqichlari (45 daqiqa):\nTashkiliy qism — 3 daqiqa\nO‘tgan mavzuni mustahkamlash — 7 daqiqa\nYangi mavzu — 15 daqiqa\nAmaliy mashqlar — 15 daqiqa\nBaholash va uy vazifasi — 5 daqiqa\n\nBaholash mezonlari: to‘g‘rilik, izohlash va mustaqillik.\nO‘qituvchi: __________`
  else if(tool==='protocol')text=`BAYONNOMA № ____\n${toolSchool}\nSana: __________\nQatnashdilar: __________\n\nKUN TARTIBI:\n1. ${subject} bo‘yicha o‘quvchilarning o‘zlashtirish holati.\n2. Diagnostika natijalari va keyingi ishlar.\n\nESHITILDI: ___________________________________\nMUHOKAMA: __________________________________\n\nQAROR QILINDI:\n1. Zaif mavzular bo‘yicha qo‘shimcha mashg‘ulotlar o‘tkazilsin.\n2. Natijalar keyingi yig‘ilishda tahlil qilinsin.\n\nRais: __________  Kotib: __________`
  else if(tool==='schedule')text=`ISH REJA\nMaktab: ${toolSchool}\nYo‘nalish: ${subject}\n\n1-hafta: Bilim darajasini aniqlash — diagnostika\n2-hafta: Qiyin mavzular ustida ishlash — mashqlar\n3-hafta: Mustaqil ish va o‘zaro baholash\n4-hafta: Yakuniy test, natijalar va tavsiyalar\n\nMas’ul: __________\nTasdiqlovchi: __________`
  else if(tool==='slides')text=`TAQDIMOT REJASI\n${subject}\n\n1-slayd: Mavzu va maqsad\n2-slayd: Tayanch tushunchalar\n3-slayd: Nazariy qoida\n4-slayd: Birinchi yechilgan misol\n5-slayd: Ikkinchi yechilgan misol\n6-slayd: Juftlikda mashq\n7-slayd: Mustaqil bajarish\n8-slayd: Real hayotdagi qo‘llanish\n9-slayd: Nazorat savollari\n10-slayd: Xulosa va uy vazifasi`
  else text=`MASHQ KARTOCHKALARI\n${subject}\n\n1) 3x+6=15, x=?\n2) Tomoni 5 sm kvadrat perimetri=?\n3) 25% ni oddiy kasrda yozing.\n4) √64=?\n\nJavoblar: 3; 20 sm; 1/4; 8.\nEslatma: misollarni tanlangan mavzuga moslab tahrirlang.`
  setToolOutput(text)
 }
 async function makeAiTeacherDoc(){setBusy(true);setError('');try{const d=await api<{text:string;warning:string}>('/api/v2/ai/teacher-doc','POST',{kind:tool,grade:toolGrade,topic:toolTopic,school:toolSchool});setToolOutput(d.text);setFeedback(d.warning)}catch(e){setError(safeError(e))}finally{setBusy(false)}}
 async function explain(e:FormEvent){e.preventDefault();setError('');setTutorAnswer('');setBusy(true);try{const d=await api<{answer:string}>('/api/v2/ai/tutor','POST',{question:tutorText,grade:tutorGrade});setTutorAnswer(d.answer)}catch(e){setError(safeError(e))}finally{setBusy(false)}}
 async function sendTicket(e:FormEvent){e.preventDefault();setError('');setBusy(true);try{await api('/api/v2/support','POST',{title:ticketTitle,message:ticketMessage,category:ticketCategory});setTicketTitle('');setTicketMessage('');setFeedback('Murojaat qabul qilindi. Javobni shu bo‘limda kuzatishingiz mumkin.');await refreshTickets()}catch(e){setError(safeError(e))}finally{setBusy(false)}}
 async function updateTicket(id:number,status:string){setBusy(true);try{await api(`/api/v2/support/${id}`,'PATCH',{status,answer:replyDraft[id]||''});await refreshTickets();setFeedback('Murojaat yangilandi.')}catch(e){setError(safeError(e))}finally{setBusy(false)}}
 const intro={ai:{icon:'✦',title:'AI test generatori',sub:'Mavzu, sinf va bob bo‘yicha savollar; avval tekshirish, so‘ng savollar bankiga qo‘shish.'},international:{icon:'🌐',title:'Xalqaro baholash dasturlari',sub:'PISA, TIMSS, PIRLS va TALIS uslubiga mos original tayyorgarlik mashqlari.'},'teacher-tools':{icon:'🎓',title:'O‘qituvchi yordamchisi',sub:'Interaktiv viktorina, dars ishlanmasi, bayonnoma va ish rejalari.'},'student-assistant':{icon:'🤖',title:'O‘quvchi yordamchisi',sub:'Masalani tushunish, bosqichli izoh va individual mashqlar.'},help:{icon:'🎧',title:'Yordam va murojaatlar',sub:'Savol, taklif yoki nosozlik haqida yozing. Javoblarni shu yerda kuzating.'}}[page]
 return <div className="v2-root">
   <div className="v2-hero"><span className="v2-hero-icon">{intro.icon}</span><div><div className="v2-kicker">MATH-DIAGNOZ • TA’LIM TEXNOLOGIYALARI</div><h2>{intro.title}</h2><p>{intro.sub}</p></div><span className="v2-spark">✧ · ∑ · √ · π</span></div>
   {error&&<div className="v2-alert error" role="alert">⚠️ {error} <button type="button" onClick={()=>setError('')}>×</button></div>}
   {feedback&&<div className="v2-alert" role="status">✓ {feedback} <button type="button" onClick={()=>setFeedback('')}>×</button></div>}
   {page==='ai'&&isEducator&&<div className="v2-grid v2-ai-grid"><section className="v2-card">
      <h3>✦ Savol yaratish</h3><p className="v2-hint">AI kaliti sozlansa, Gemini savollar tuzadi. Kalitsiz faqat oflayn namunalar tayyorlanadi.</p>
      <div className="v2-badge">{config?.configured?'🟢 Gemini AI ulangan':'🟠 Oflayn namuna rejimi'}</div>
      <form onSubmit={generate} className="v2-form"><label>Darslik va sinf<select value={bookId} onChange={e=>{setBookId(+e.target.value);setChapterId(0)}}>{books.map(b=><option key={b.id} value={b.id}>{b.grade}-sinf · {b.title}</option>)}</select></label>
      <label>Bob<select value={chapter?.id||''} onChange={e=>{setChapterId(+e.target.value);setTopic('')}}>{book?.chapters.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
      <label>Mavzu<input list="v2-topics" value={topic} onChange={e=>setTopic(e.target.value)} placeholder={topics[0]||'Masalan: Tenglamalar'} minLength={3} maxLength={110}/><datalist id="v2-topics">{topics.map(t=><option key={t} value={t}/>)}</datalist></label>
      <div className="v2-fields"><label>Savollar soni<select value={count} onChange={e=>setCount(+e.target.value)}>{[5,10,20,30].map(v=><option key={v}>{v}</option>)}</select></label><label>Qiyinchilik<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option>Oson</option><option>O‘rtacha</option><option>Murakkab</option></select></label></div>
      <button disabled={busy||!book||!chapter} className="v2-action" type="submit">{busy?'Yaratilmoqda...':'✦ Test savollarini yaratish'}</button></form></section>
      <section className="v2-card"><h3>✓ Savollarni ko‘rib chiqish</h3><p className="v2-hint">To‘g‘ri javoblarni tekshiring. Faqat belgilangani savollar bankiga saqlanadi.</p>
      {!questions.length?<div className="v2-empty">Hozircha savollar yaratilmagan. Chap tomonda sinf va mavzuni tanlang.</div>:<><div className="v2-toolbar"><span>{questions.length} ta savol · {source==='ai'?'AI yaratgan':'Namuna generatori'}</span><button type="button" onClick={()=>setSelected(questions.map((_,i)=>i))}>Barchasi</button><button type="button" onClick={()=>setSelected([])}>Tozalash</button></div><div className="v2-scroll">{questions.map((q,i)=><article className="v2-question" key={i}><label className="v2-question-top"><input checked={selected.includes(i)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,i]:prev.filter(v=>v!==i))} type="checkbox"/><b>{i+1}. {q.text}</b></label><div className="v2-options">{q.options.map((o,j)=><span key={j} className={j===q.correct?'right':''}>{String.fromCharCode(65+j)}. {o}</span>)}</div><small>Izoh: {q.explanation||'O‘qituvchi izohini kiriting'}</small></article>)}</div><button disabled={busy||!selected.length} onClick={()=>void importToBank()} className="v2-action">Tanlangan {selected.length} ta savolni bankga saqlash</button></>}
      </section></div>}
   {page==='international'&&<><div className="v2-programs">{programData.filter(p=>p.id!=='TALIS'||isEducator).map(p=><button className={'v2-program '+(program===p.id?'active':'')} type="button" key={p.id} onClick={()=>{setProgram(p.id);setStage(1);setEvalQuestions([]);setEvalVersion('');setEvalResult(null);setAnswers({});setAssessmentDraft([]);setAssessmentFile('');setAssessmentErrors([])}}><span>{p.icon}</span><strong>{p.id}</strong><small>{p.desc}</small><em>{p.note}</em></button>)}</div>
      <div className="v2-card"><div className="v2-row"><div><h3>Ikki bosqichli baholash</h3><p className="v2-hint">Tayyorgarlik uchun original namunalar. Bu rasmiy PISA/TIMSS/PIRLS/TALIS testlari emas.</p></div><div className="v2-stage-tabs">{[1,2].map(s=><button type="button" className={stage===s?'active':''} key={s} onClick={()=>{setStage(s);setEvalResult(null);setEvalQuestions([]);setEvalVersion('');setAnswers({});setAssessmentDraft([]);setAssessmentFile('');setAssessmentErrors([])}}>{s}-bosqich</button>)}</div></div>
        <p className="v2-hint">{levelText[stage-1]} · 2-bosqichga o‘tish uchun 1-bosqichdan kamida 60% kerak.</p>
        {!evalQuestions.length&&!evalResult&&<button disabled={busy} className="v2-action v2-short" onClick={()=>void loadAssessment()}>{busy?'Ochilyapti...':`${program} ${stage}-bosqich testini boshlash →`}</button>}
        {evalQuestions.length>0&&<><div className="v2-assessment">{evalQuestions.map((q,i)=><article key={q.id} className="v2-question"><strong>{i+1}. {q.text}</strong><div className="v2-options buttons">{q.options.map((o,j)=><button type="button" className={answers[i]===j?'selected':''} key={j} onClick={()=>setAnswers(v=>({...v,[i]:j}))}>{String.fromCharCode(65+j)}. {o}</button>)}</div></article>)}</div><button className="v2-action v2-short" disabled={busy||Object.keys(answers).length!==evalQuestions.length} onClick={()=>void submitAssessment()}>Natijani tekshirish</button></>}
        {evalResult&&<div className="v2-result"><strong>Natija: {evalResult.score}/{evalResult.total} ({Math.round(evalResult.score/evalResult.total*100)}%) — {evalResult.passed?'O‘tdingiz':'Tayyorgarlikni davom ettiring'}</strong>{evalResult.details.map((d,i)=><p key={i}>{i+1}-savol: {d.correct===d.chosen?'✓ To‘g‘ri':'✕ Xato'} · {d.why}</p>)}<button type="button" onClick={()=>{setEvalResult(null);setStage(evalResult.passed?2:1)}} className="v2-button">{evalResult.passed&&stage===1?'2-bosqichga o‘tish':'Qayta mashq qilish'}</button></div>}
      </div>
      {isAdmin&&<section className="v2-card v2-import-card"><div className="v2-row"><div><h3>📥 Xalqaro baholashga savol yuklash (administrator)</h3><p className="v2-hint">Tanlangan dastur va bosqich: <b>{program} · {stage}-bosqich</b>. Word yoki TXT fayldagi savollarni avval ko‘rib chiqing, keyin Neon bazasiga saqlang.</p></div><span className="v2-import-count">{assessmentBank?`${assessmentBank.count} ta ${assessmentBank.source==='uploaded'?'yuklangan':'namunaviy'} savol`: 'Yuklanmoqda...'}</span></div>
        <div className="v2-import-controls"><a className="v2-button" href="/templates/MATH-DIAGNOZ-XALQARO-BAHOLASH-SHABLON.docx" download>↓ Word shablonni yuklash</a><label className="v2-button v2-file-button">⬆ Word / TXT tanlash<input type="file" accept=".docx,.txt" onChange={e=>void readAssessmentFile(e)} disabled={busy}/></label>{config?.configured&&<button type="button" className="v2-button" disabled={busy} onClick={()=>void generateAssessmentAI()}>✦ AI bilan 10 ta savol yaratish</button>}<label>Yuklash usuli<select value={assessmentMode} onChange={e=>setAssessmentMode(e.target.value as 'append'|'replace')}><option value="append">Mavjudlariga qo‘shish</option><option value="replace">Yuklangan savollarni almashtirish</option></select></label></div>
        <p className="v2-hint">Shablonda SAVOL:, A), B), C), D), JAVOB: A ko‘rinishida yozing. AI ulangan bo‘lsa shu sahifada 10 ta yangi topshiriq yaratib, tahrirdan oldin ko‘rib chiqishingiz mumkin. Hozircha faqat <b>matnli</b> savollar qo‘llanadi, Worddagi rasmlar yuklanmaydi. Bir faylda ko‘pi bilan 50 ta savol bo‘lsin. Yuklangan savollar namunalar o‘rnida ishlatiladi; «Almashtirish» rejimida shu dastur/bosqichning oldin yuklangan savollari almashtiriladi.</p>
        {assessmentFile&&<p className="v2-hint">Fayl: <b>{assessmentFile}</b> · {assessmentDraft.length} ta to‘g‘ri formatdagi savol</p>}
        {assessmentErrors.length>0&&<div className="v2-alert error" role="alert">{assessmentErrors.slice(0,10).map((x,i)=><div key={i}>{x}</div>)}</div>}
        {assessmentDraft.length>0&&<><div className="v2-scroll">{assessmentDraft.slice(0,5).map((q,i)=><article key={i} className="v2-question"><strong>{i+1}. {q.text}</strong><div className="v2-options">{q.options.map((o,j)=><span key={j} className={j===q.correct?'right':''}>{String.fromCharCode(65+j)}. {o}</span>)}</div>{q.explanation&&<small>{q.explanation}</small>}</article>)}</div>{assessmentDraft.length>5&&<p className="v2-hint">Yana {assessmentDraft.length-5} ta savol. Hammasini Word faylda oldindan tekshiring.</p>}<button type="button" disabled={busy||assessmentErrors.length>0} className="v2-action v2-short" onClick={()=>void uploadAssessment()}>{busy?'Saqlanmoqda...':`✓ ${assessmentDraft.length} ta savolni ${program} ${stage}-bosqichga saqlash`}</button></>}
        {assessmentBank&&<details className="v2-import-details"><summary>Hozirgi savollardan namuna ({assessmentBank.source==='uploaded'?'yuklangan':'dastlabki'})</summary>{assessmentBank.questions.slice(0,5).map((q,i)=><p key={i}>{i+1}. {q.text} <strong>— {String.fromCharCode(65+q.correct)}</strong></p>)}</details>}
      </section>}
      <div className="v2-card"><h3>📈 Mening baholash natijalarim</h3>{!progress.length?<p className="v2-hint">Hali natija yo‘q.</p>:<div className="v2-history">{progress.slice(0,10).map((r,i)=><span key={i}>{r.program} • {r.stage}-bosqich <b>{Math.round(r.score/r.total*100)}%</b></span>)}</div>}</div></>}
   {page==='teacher-tools'&&isEducator&&<><div className="v2-tool-grid">{teacherTasks.map(t=><button type="button" className={'v2-tool '+(tool===t.id?'active':'')} key={t.id} onClick={()=>{setTool(t.id);setToolOutput('')}}><span>{t.icon}</span><b>{t.name}</b><small>{t.desc}</small></button>)}</div><div className="v2-card"><h3>{teacherTasks.find(t=>t.id===tool)?.name}</h3>{tool==='quiz'?<><p className="v2-hint">O‘qituvchi proyektor orqali namoyish qilishi mumkin bo‘lgan mahalliy mini-viktorina. Hozircha ko‘p qurilmali jonli o‘yin emas.</p><div className="v2-game"><span>Savol {quizIndex+1} / {exampleQuiz.length} · {quizScore} ball</span><h3>{exampleQuiz[quizIndex].q}</h3><div className="v2-options buttons">{exampleQuiz[quizIndex].options.map((o,i)=><button type="button" key={i} disabled={quizAnswer!==null} className={quizAnswer===i?'selected':''} onClick={()=>{setQuizAnswer(i);if(i===exampleQuiz[quizIndex].right)setQuizScore(n=>n+1)}}>{String.fromCharCode(65+i)}. {o}</button>)}</div>{quizAnswer!==null&&<p className="v2-hint">{quizAnswer===exampleQuiz[quizIndex].right?'✓ To‘g‘ri':'Yana mashq qiling'} · {exampleQuiz[quizIndex].why}</p>}<button type="button" className="v2-action v2-short" disabled={quizAnswer===null} onClick={()=>{setQuizIndex(v=>(v+1)%exampleQuiz.length);setQuizAnswer(null);if(quizIndex===exampleQuiz.length-1)setQuizScore(0)}}>{quizIndex===exampleQuiz.length-1?'Boshidan boshlash':'Keyingi savol →'}</button></div></>:<><div className="v2-fields"><label>Maktab<input value={toolSchool} onChange={e=>setToolSchool(e.target.value)} maxLength={100}/></label><label>Sinf<select value={toolGrade} onChange={e=>setToolGrade(+e.target.value)}>{[5,6,7,8,9].map(g=><option key={g} value={g}>{g}-sinf</option>)}</select></label></div><label className="v2-label">Mavzu<input value={toolTopic} onChange={e=>setToolTopic(e.target.value)} maxLength={120}/></label><div className="v2-toolbar"><button type="button" className="v2-action v2-short" onClick={createTeacherDoc}>Namuna yaratish</button>{config?.configured&&<button type="button" className="v2-button" disabled={busy} onClick={()=>void makeAiTeacherDoc()}>{busy?'AI ishlayapti...':'✦ AI bilan tayyorlash'}</button>}{toolOutput&&<button type="button" className="v2-button" onClick={()=>saveText(toolOutput,`${pdfSafe(tool)}-${toolGrade}-sinf.txt`)}>↓ Matnli hujjatni yuklab olish</button>}</div>{toolOutput&&<textarea className="v2-document" rows={16} value={toolOutput} onChange={e=>setToolOutput(e.target.value)}/>}<p className="v2-hint">Bular tahrirlanadigan namunalar. Rasmiy hujjat sifatida ishlatishdan oldin maktab talablari bilan tekshiring.</p></>}</div></>}
   {page==='student-assistant'&&<div className="v2-grid"><div className="v2-card"><h3>🤖 Masalani bosqichma-bosqich tushuntirish</h3><div className="v2-badge">{config?.configured?'🟢 AI faol':'🟠 AI kaliti ulanmagan'}</div><form onSubmit={explain} className="v2-form"><label>Sinf<select value={tutorGrade} onChange={e=>setTutorGrade(+e.target.value)}>{[5,6,7,8,9].map(g=><option key={g} value={g}>{g}-sinf</option>)}</select></label><label>Matematika savoli<textarea value={tutorText} onChange={e=>setTutorText(e.target.value)} minLength={8} maxLength={800} rows={5} placeholder="Masalan: 2x + 7 = 19 tenglamani qanday yechaman?"/></label><button type="submit" disabled={busy||!config?.configured} className="v2-action">{busy?'Tushuntirilmoqda...':'AI dan yordam olish'}</button></form><p className="v2-hint">Ism, telefon, manzil yoki maxfiy ma’lumotlarni savolga kiritmang. Bepul API’da yuborilgan ma’lumotlar provayder tomonidan qayta ishlanishi mumkin.</p></div><div className="v2-card"><h3>📘 Mening o‘quv yordamchim</h3>{tutorAnswer?<div className="v2-chat"><strong>AI tushuntirishi</strong><p>{tutorAnswer}</p></div>:<div className="v2-empty">{config?.configured?'Masalani yuboring, yechish usulini o‘rganing.':'Super-admin AI API kalitini sozlaguncha mavjud “Individual mashqlar” bo‘limidan foydalaning.'}</div>}<div className="v2-starter"><button type="button" className={assistMode==='explain'?'active':''} onClick={()=>{setAssistMode('explain');setTutorText('2x + 7 = 19 tenglamani qanday yechaman?')}}>Tenglama namunasi</button><button type="button" className={assistMode==='practice'?'active':''} onClick={()=>{setAssistMode('practice');setTutorText('Kvadrat perimetrini misol bilan tushuntiring.')}}>Geometriya namunasi</button></div></div></div>}
   {page==='help'&&<div className="v2-grid"><section className="v2-card"><h3>✉ Yangi murojaat</h3><p className="v2-hint">Texnik xatolik, hisob, kontent yoki yangi g‘oya bo‘yicha savolingizni yuboring.</p><form className="v2-form" onSubmit={sendTicket}><label>Murojaat turi<select value={ticketCategory} onChange={e=>setTicketCategory(e.target.value)}><option value="technical">Texnik nosozlik</option><option value="content">Darslik yoki testlar</option><option value="account">Login va hisob</option><option value="idea">Taklif</option></select></label><label>Mavzu<input value={ticketTitle} minLength={5} maxLength={130} onChange={e=>setTicketTitle(e.target.value)} required placeholder="Qisqacha mavzu"/></label><label>Xabar<textarea value={ticketMessage} minLength={12} maxLength={2500} onChange={e=>setTicketMessage(e.target.value)} required rows={6} placeholder="Muammoni batafsil tushuntiring..."/></label><button className="v2-action" disabled={busy} type="submit">Murojaatni yuborish →</button></form><div className="v2-faq"><h3>Ko‘p so‘raladigan savollar</h3><details><summary>Testni qayerdan ochaman?</summary><p>O‘quvchi kabinetidagi “Mening testlarim” bo‘limidan.</p></details><details><summary>Parolni unutdim, nima qilaman?</summary><p>Maktab administratoriga murojaat qiling; u yangi parol belgilaydi.</p></details><details><summary>AI nima uchun ishlamayapti?</summary><p>Serverda Gemini API kaliti sozlanmagan yoki bepul limit tugagan bo‘lishi mumkin.</p></details></div></section><section className="v2-card"><div className="v2-row"><h3>📬 {isAdmin?'Barcha murojaatlar':'Mening murojaatlarim'}</h3><button type="button" className="v2-button" onClick={()=>void refreshTickets()}>↻ Yangilash</button></div>{isAdmin&&<select className="v2-filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Barcha holatlar</option><option value="new">Yangi</option><option value="review">Ko‘rib chiqilmoqda</option><option value="done">Hal qilingan</option></select>}<div className="v2-scroll">{tickets.filter(t=>filter==='all'||t.status===filter).length===0?<p className="v2-empty">Murojaat yo‘q.</p>:tickets.filter(t=>filter==='all'||t.status===filter).map(t=><article className="v2-ticket" key={t.id}><div className="v2-row"><strong>#{t.id} · {t.title}</strong><span className={'v2-status '+t.status}>{t.status==='new'?'Yangi':t.status==='review'?'Ko‘rilmoqda':'Hal qilindi'}</span></div><small>{t.author_name||name} · {new Date(t.created_at).toLocaleDateString('uz-UZ')}</small><p>{t.message}</p>{t.answer&&<blockquote>{t.answer}</blockquote>}{isAdmin&&<><textarea value={replyDraft[t.id]??t.answer??''} rows={2} onChange={e=>setReplyDraft(v=>({...v,[t.id]:e.target.value}))} placeholder="Javob yozing..."/><div className="v2-toolbar"><button type="button" onClick={()=>void updateTicket(t.id,'review')} disabled={busy}>Ko‘rib chiqilmoqda</button><button type="button" onClick={()=>void updateTicket(t.id,'done')} disabled={busy}>Hal qilindi</button></div></>}</article>)}</div></section></div>}
 </div>
}
