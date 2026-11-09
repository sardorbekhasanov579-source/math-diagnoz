import { useEffect, useState, type FormEvent } from 'react'
import './AuthScreen.css'

type Role = 'student'|'parent'
type GradeClass={id:number;name:string;grade:number;schoolId?:number;schoolName?:string}
export type SignedUser={id:number;name:string;username:string;role:'admin'|'teacher'|'student'|'parent';classId?:number;childIds?:number[];active:boolean}
export async function api<T=any>(url:string,method='GET',data?:unknown):Promise<T>{
 const response=await fetch(url,{method,credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined})
 const payload=await response.json().catch(()=>({error:'Server javobini o‘qib bo‘lmadi'}))
 if(!response.ok)throw new Error(payload.error||`Server xatoligi (${response.status})`)
 return payload as T
}
function CountingNumber({value}:{value:number}){
 const [current,setCurrent]=useState(0)
 useEffect(()=>{
   if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){setCurrent(value);return}
   let frame=0
   const started=performance.now()
   const tick=(now:number)=>{const p=Math.min(1,(now-started)/1100);setCurrent(Math.round(value*(1-(1-p)**3)));if(p<1)frame=requestAnimationFrame(tick)}
   frame=requestAnimationFrame(tick)
   return ()=>cancelAnimationFrame(frame)
 },[value])
 return <>{current.toLocaleString('uz-UZ')}</>
}
const SYMBOLS=['π','∑','x²','√','△','∞','÷','∫','θ','≈','%','f(x)','∠','+','×','∂']
export default function AuthScreen({onAuth,booksCount,questionCount,onBack,initialMode='login'}:{onAuth:(user:SignedUser)=>void;booksCount:number;questionCount:number;onBack?:()=>void;initialMode?:'login'|'register'}){
 const [mode,setMode]=useState<'login'|'register'>(initialMode)
 const [initialized,setInitialized]=useState(true)
 const [schoolMode,setSchoolMode]=useState(false)
 const [schoolName,setSchoolName]=useState('')
 const [classes,setClasses]=useState<GradeClass[]>([])
 const [connection,setConnection]=useState('')
 const [name,setName]=useState('')
 const [username,setUsername]=useState('')
 const [password,setPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const [showPassword,setShowPassword]=useState(false)
 const [role,setRole]=useState<Role>('student')
 const [classId,setClassId]=useState('')
 const [agree,setAgree]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [showDemo,setShowDemo]=useState(false)
 const [sampleAnswer,setSampleAnswer]=useState<number|null>(null)
 useEffect(()=>{
   api<{initialized:boolean;classes:GradeClass[];schoolMode?:boolean;schoolName?:string}>('/api/status')
     .then(d=>{setInitialized(d.initialized);setSchoolMode(Boolean(d.schoolMode));setSchoolName(d.schoolName||'Sinov maktabi');setClasses(d.classes);setClassId(d.classes[0]?.id?.toString()||'');setConnection('')})
     .catch(()=>setConnection('Server ishga tushmagan. START-MATH-DIAGNOZ.bat faylini oching.'))
 },[])
 async function submit(e:FormEvent){
   e.preventDefault();setError('');
   if(schoolMode&&initialized&&mode==='register')return setError('Maktabda hisoblarni administrator beradi.');
   if(mode==='register'||!initialized){
     if(name.trim().length<2)return setError('Ismingizni to‘liq kiriting.')
     if(password.length<8)return setError('Parol kamida 8 belgidan iborat bo‘lsin.')
     if(password!==confirmPassword)return setError('Parollar bir xil emas.')
     if(!agree)return setError('Foydalanish shartlarini tasdiqlang.')
   }
   setBusy(true)
   try{
    const endpoint=!initialized?'/api/auth/setup':mode==='register'?'/api/auth/register':'/api/auth/login'
    const body={name,username,password,role,classId:Number(classId)}
    const data=await api<{user:SignedUser}>(endpoint,'POST',body)
    onAuth(data.user)
   }catch(err){setError(err instanceof Error?err.message:'Kirish bajarilmadi')}
   finally{setBusy(false)}
 }
 const signup=mode==='register'||!initialized
 const goToAuth=(newMode:'login'|'register')=>{setMode(newMode);setError('');document.getElementById('md-auth-card')?.scrollIntoView({behavior:'smooth',block:'center'})}
 const points=[{icon:'📘',title:'Elektron darsliklar',text:'5–9-sinf mavzulari, boblar va PDF materiallar'},
 {icon:'🧠',title:'Aqlli diagnostika',text:'Xatolarni mavzu va kompetensiyalar bo‘yicha o‘rganish'},
 {icon:'🏆',title:'O‘quvchilar reytingi',text:'Natijalar, yutuqlar va shaxsiy rivojlanish'},
 {icon:'👨‍👩‍👧',title:'Oila nazorati',text:'Bir nechta farzandning natijalarini ko‘rish'}]
 return <div className="md-authsite md14-auth-only">
   <header className="md-authsite-header">
     <a className="md-authsite-brand" href="#bosh" onClick={e=>{if(onBack){e.preventDefault();onBack()}}}><span className="md-authsite-logo">M<span>✦</span></span><span><b>MATH-DIAGNOZ</b><small>Bilimni aniqlang. Natijani oshiring.</small></span></a>
     <nav aria-label="Asosiy menyu"><a href="#afzalliklar">Imkoniyatlar</a><a href="#qanday">Qanday ishlaydi?</a><a href="#reyting">Reyting</a></nav>
     <div className="md-authsite-actions">{onBack&&<button className="md14-auth-back" onClick={onBack}>← Bosh sahifa</button>}<button onClick={()=>goToAuth('login')}>Kirish</button><button className="md-cta" onClick={()=>goToAuth('register')}>Ro‘yxatdan o‘tish ↗</button></div>
   </header>
   <main id="bosh">
     <section className="md-authsite-hero">
       <div className="md-authsite-noise" aria-hidden="true"/>
       <div className="md-authsite-glow md-authsite-glow-one" aria-hidden="true"/><div className="md-authsite-glow md-authsite-glow-two" aria-hidden="true"/>
       {SYMBOLS.map((s,i)=><span aria-hidden="true" className="md-authsite-particle" key={i} style={{left:`${6+(i*37)%89}%`,top:`${8+(i*29)%86}%`,animationDelay:`-${(i*2.7)%11}s`,animationDuration:`${9+(i%5)*2}s`}}>{s}</span>)}
       <div className="md-authsite-hero-inner">
         <div className="md-authsite-hero-text">
           <div className="md-authsite-overline"><i/> 5–9-SINFLAR UCHUN MATEMATIKA PLATFORMASI</div>
           <h1>Bilimingizni <em>kashf eting.</em> Kelajagingizni <span>quring.</span></h1>
           <p>Test yeching, xatolaringizni tushuning, matematik pasportingizni rivojlantiring va o‘z sinfingiz reytingida yuqorilang.</p>
           <div className="md-authsite-hero-buttons"><button className="md-cta" onClick={()=>goToAuth('register')}>🚀 Bepul boshlash <span>→</span></button><button className="md-ghost" onClick={()=>setShowDemo(v=>!v)}>▶ Mini-testni sinash</button></div>
           <div className="md-authsite-trust"><span>😊</span><span>🤓</span><span>🥳</span><p><strong>Har bir o‘quvchi — alohida imkoniyat</strong><small>Bilim · O‘sish · Rag‘bat</small></p></div>
           {showDemo&&<div className="md-authsite-inline-quiz"><b>Mini-test: 3x + 6 = 15. x = ?</b><div>{[2,3,4].map(n=><button key={n} className={sampleAnswer===n?'selected':''} onClick={()=>setSampleAnswer(n)}>{n}</button>)}</div><small>{sampleAnswer===null?'Javobni tanlang':sampleAnswer===3?'🎉 Ajoyib, to‘g‘ri javob!':'💡 6 ni ayiring va 3 ga bo‘ling.'}</small></div>}
         </div>
         <div className="md-authsite-auth-card" id="md-auth-card">
           <div className="md-authsite-card-top"><span className="md-authsite-card-emblem">✦</span><div><small>SHAXSIY KABINET</small><h2>{!initialized?'Birinchi administrator':signup?'Hisob yaratish':'Xush kelibsiz!'}</h2></div></div>
           <p className="md-authsite-card-sub">{!initialized?'Tizimni ilk marta sozlash':signup?'MATH-DIAGNOZ oilasiga qo‘shiling':'Akkauntingizga xavfsiz kirish'}</p>
           {initialized&&<div className="md-authsite-tabs" role="tablist"><button role="tab" aria-selected={mode==='login'} className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>Kirish</button><button role="tab" aria-selected={mode==='register'} className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>Ro‘yxatdan o‘tish</button></div>}
           {schoolMode&&initialized&&mode==='register' ? <div className="md15-school-signup">
             <span className="md15-school-signup-icon">🏫</span>
             <strong>Maktabning yopiq sinov tizimi</strong>
             <p><b>{schoolName}</b> uchun o‘quvchi, o‘qituvchi va ota-ona login-parollarini faqat administrator yaratadi. Sinf rahbaridan login va vaqtinchalik parolingizni oling.</p>
             <button type="button" onClick={()=>goToAuth('login')}>Login bilan kirish →</button>
           </div> : <form onSubmit={submit} className="md-authsite-form">
             {signup&&<><label>To‘liq ism-familiya<input type="text" placeholder="Ism va familiyangiz" autoComplete="name" required value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label>
             {initialized&&<div className="md-authsite-role-picker"><label className={role==='student'?'active':''}><input type="radio" name="role" checked={role==='student'} onChange={()=>setRole('student')}/>🎓 O‘quvchi</label><label className={role==='parent'?'active':''}><input type="radio" name="role" checked={role==='parent'} onChange={()=>setRole('parent')}/>👪 Ota-ona</label></div>}
             {initialized&&role==='student'&&<label>Sinfingiz<select value={classId} onChange={e=>setClassId(e.target.value)} required><option value="">Sinfni tanlang</option>{classes.map(c=><option value={c.id} key={c.id}>{c.schoolName?c.schoolName+" — ":""}{c.name}</option>)}</select></label>}</>}
             <label>Login<input type="text" placeholder="Masalan: alisher_07" autoComplete="username" minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]+" required value={username} onChange={e=>setUsername(e.target.value)}/></label>
             <label>Parol<div className="md-authsite-password"><input type={showPassword?'text':'password'} placeholder="Kamida 8 belgi" autoComplete={signup?'new-password':'current-password'} required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" aria-label={showPassword?'Parolni yashirish':'Parolni ko‘rsatish'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?'🙈':'👁'}</button></div></label>
             {signup&&<><div className="md-authsite-strength"><span style={{width:`${Math.min(100,Math.max(5,password.length*7+( /\d/.test(password)?10:0)+(/[A-Z]/.test(password)?10:0)+(/[^\w]/.test(password)?10:0)))}%`}}/></div><label>Parolni takrorlang<input type={showPassword?'text':'password'} placeholder="Parolni qayta kiriting" autoComplete="new-password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><label className="md-authsite-agree"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>Foydalanish qoidalari va ma’lumotlar himoyasi haqida ogohlantirishni qabul qilaman.</span></label></>}
             {(error||connection)&&<div className="md-authsite-error" role="alert">⚠️ {error||connection}</div>}
             <button className="md-authsite-submit" type="submit" disabled={busy||!!connection}>{busy?'Tekshirilmoqda...':!initialized?'Administratorni yaratish':signup?'Akkaunt yaratish →':'Kabinetga kirish →'}</button>
             {signup&&initialized&&<small>O‘qituvchi hisobini administrator yaratadi. Ota-ona va farzandlar bog‘lanishini ham administrator tasdiqlaydi.</small>}
           </form>}
           <div className="md-authsite-secure">🔒 <span>Ma’lumotlar mahalliy pilot serverida saqlanadi</span></div>
         </div>
       </div>
     </section>
     <section className="md-authsite-numbers" aria-label="Platforma statistikasi">
       <div><strong><CountingNumber value={5}/></strong><span>ta sinf (5–9)</span></div><div><strong><CountingNumber value={4}/></strong><span>ta kabinet</span></div><div><strong><CountingNumber value={booksCount}/></strong><span>mahalliy darslik</span></div><div><strong><CountingNumber value={questionCount}/></strong><span>test savoli (mahalliy)</span></div>
     </section>
     <section className="md-authsite-features" id="afzalliklar"><div className="md-authsite-title"><span>PLATFORMA IMKONIYATLARI</span><h2>O‘qishning yanada aqlli yo‘li</h2><p>Bilim, test va rivojlanish yagona muhitda</p></div><div className="md-authsite-feature-grid">{points.map((p,i)=><article key={p.title} className={`md-authsite-feature md-feature-${i}`}><div>{p.icon}</div><h3>{p.title}</h3><p>{p.text}</p><span>O‘rganish ↗</span></article>)}</div></section>
     <section className="md-authsite-how" id="qanday"><div className="md-authsite-title"><span>TO‘RT BOSQICH</span><h2>Natijaga olib boradigan yo‘l</h2></div><div className="md-authsite-how-steps">{[['🔍','01','Aniqla','Bilimingizni diagnostika qiling'],['🧠','02','Tushuntir','Xato sabablarini o‘rganing'],['🚀','03','Rivojlantir','Individual mashqlar ishlang'],['🏆','04','Qayta o‘lcha','O‘sishingizni kuzating']].map(([emoji,no,t,d])=><div key={no}><span>{emoji}</span><small>{no}</small><b>{t}</b><p>{d}</p></div>)}</div></section>
     <section className="md-authsite-ranking" id="reyting"><span>🏆 MATEMATIK YUTUQLAR</span><h2>Har bir yutuq — keyingi cho‘qqiga qadam</h2><p>Shaxsiy kabinetingizda sinf va 5–9-sinflar bo‘yicha reytinglarni ko‘ring. Boshqalarning natijalari shaxsiylikni saqlagan holda ko‘rsatiladi.</p><button onClick={()=>goToAuth('register')}>Reytingda qatnashish →</button></section>
   </main>
   <footer className="md-authsite-footer"><strong>✦ MATH-DIAGNOZ</strong><span>Matematika diagnostikasi · Mahalliy pilot versiya · Rasmiy davlat tizimi emas</span></footer>
 </div>
}
