import { useEffect, useState } from 'react'
import './PublicLanding.css'

type Props = {
  onLogin: () => void
  onRegister: () => void
  loggedIn?: boolean
  onDashboard?: () => void
}

const shapes = ['π', '√', 'x²', '∑', '÷', '∞', '△', '%', '∫', 'f(x)', '∠', '+', '×', '≈']
const features = [
  { icon: '📚', title: 'Elektron darsliklar', text: '5–9-sinf darsliklari, bob va mavzular, PDF materiallar.' },
  { icon: '🧠', title: 'Bilim diagnostikasi', text: 'Xatolar mavzular bo‘yicha aniqlanadi va izohlanadi.' },
  { icon: '🎯', title: 'Individual mashqlar', text: 'O‘quvchining natijasiga mos mustahkamlash topshiriqlari.' },
  { icon: '🏆', title: 'Rivojlanish va reyting', text: 'O‘zlashtirish dinamikasi, sinf reytingi va shaxsiy natijalar.' },
  { icon: '🌍', title: 'Xalqaro baholashga tayyorgarlik', text: 'PISA, TIMSS, PIRLS va TALIS uslubidagi ikki bosqichli mashqlar.' },
  { icon: '✦', title: 'AI va yordamchilar', text: 'API kaliti sozlanganda savollar, dars materiallari va maslahatlar; murojaatlar markazi.' },
]
const steps = [
  { icon: '🔍', n: '01', title: 'Aniqla', desc: 'Mavzu yoki chorak bo‘yicha testdan o‘ting.' },
  { icon: '🧩', n: '02', title: 'Tushuntir', desc: 'Xatolaringiz qaysi ko‘nikmada ekanini biling.' },
  { icon: '🚀', n: '03', title: 'Rivojlantir', desc: 'Mos mashqlar orqali bilimni mustahkamlang.' },
  { icon: '📈', n: '04', title: 'Qayta o‘lcha', desc: 'Keyingi diagnostika bilan o‘sishni kuzating.' },
]
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); return }
    let id = 0
    const start = performance.now()
    const tick = (time: number) => {
      const ratio = Math.min(1, (time - start) / 1050)
      setDisplay(Math.round(value * (1 - (1 - ratio) ** 3)))
      if (ratio < 1) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [value])
  return <>{display}{suffix}</>
}
export default function PublicLanding({ onLogin, onRegister, loggedIn, onDashboard }: Props) {
  const [exampleAnswer, setExampleAnswer] = useState<number | null>(null)
  const [showExample, setShowExample] = useState(false)
  const [schoolMode,setSchoolMode] = useState(false)
  const [schoolName,setSchoolName] = useState('')
  useEffect(()=>{let live=true;fetch('/api/status').then(r=>r.json()).then(d=>{if(live){setSchoolMode(Boolean(d.schoolMode));setSchoolName(d.schoolName||'Sinov maktabi')}}).catch(()=>{});return()=>{live=false}},[])
  const enter = () => loggedIn ? onDashboard?.() : onLogin()
  return <div className="md14-site" id="top">
    <header className="md14-header">
      <a href="#top" className="md14-brand" aria-label="MATH-DIAGNOZ bosh sahifa">
        <span className="md14-brand-icon">M<span>✦</span></span><span><b>MATH-DIAGNOZ</b><small>Raqamli matematika · v2.0</small></span>
      </a>
      <nav aria-label="Bosh sahifa menyusi"><a href="#imkoniyatlar">Imkoniyatlar</a><a href="#qanday-ishlaydi">Qanday ishlaydi?</a><a href="#sinflar">Sinflar</a></nav>
      <div className="md14-nav-actions"><button className="md14-link-btn" onClick={enter}>{loggedIn ? 'Kabinetga qaytish' : 'Kirish'}</button>{!loggedIn && <button className="md14-nav-signup" onClick={onRegister}>{'Ro‘yxatdan o‘tish'} <span>↗</span></button>}</div>
    </header>
    <main>
      <section className="md14-hero" aria-label="MATH-DIAGNOZ taqdimoti">
        <div className="md14-glow md14-glow-a" aria-hidden="true"/><div className="md14-glow md14-glow-b" aria-hidden="true"/>
        {shapes.map((symbol, i) => <span aria-hidden="true" key={i} className="md14-symbol" style={{left:`${4+(i*37)%91}%`,top:`${6+(i*23)%85}%`,animationDelay:`-${(i*1.7)%12}s`,animationDuration:`${9+i%7*2}s`}}>{symbol}</span>)}
        <div className="md14-hero-content">
          <div className="md14-copy">
            <div className="md14-eyebrow"><span/> {schoolMode?`🏫 ${schoolName} · MAKTAB PILOTI`:'5–9-SINFLAR UCHUN ZAMONAVIY TA’LIM'}</div>
            <h1>Matematikani <em>tushuning.</em><br/>Bilimingizni <strong>rivojlantiring.</strong></h1>
            <p>Darsliklar, test va diagnostika, xalqaro baholashga tayyorgarlik, AI yordamchilari va matematik pasport — yagona platformada.</p>
            <div className="md14-hero-buttons"><button className="md14-primary" onClick={loggedIn ? onDashboard : onRegister}> {loggedIn ? 'Kabinetimga o‘tish' : 'Bepul ro‘yxatdan o‘tish'} <span>→</span></button><button className="md14-secondary" onClick={() => {setShowExample(v=>!v); setExampleAnswer(null)}}>{showExample?'Mini-testni yashirish':'Mini-testni sinash'} <span>▶</span></button></div>
            {showExample && <div className="md14-quiz" aria-live="polite"><b>🧠 Mini-test: 3x + 6 = 15. x nechaga teng?</b><div>{[2,3,4].map(n => <button key={n} onClick={()=>setExampleAnswer(n)} className={exampleAnswer===n?'active':''}>{n}</button>)}</div><p>{exampleAnswer===null?'Javobingizni tanlang':exampleAnswer===3?'🎉 To‘g‘ri! x = 3.':'💡 Avval 6 ni ayirib, natijani 3 ga bo‘ling.'}</p></div>}
            <div className="md14-proof"><span>😊</span><span>🤓</span><span>🥳</span><div><b>Har bir o‘quvchi — alohida imkoniyat</b><small>O‘rganing · Sinang · Rivojlaning</small></div></div>
          </div>
          <div className="md14-showcase" aria-label="Matematik pasport ko‘rinishining namunasi">
            <div className="md14-floating md14-floating-top">✨ 5–9-sinflar</div>
            <div className="md14-progress-card">
              <div className="md14-card-head"><span className="md14-card-logo">M</span><div><b>Matematik pasport</b><small>Namuna — shaxsiy bilim xaritasi</small></div><span className="md14-live">● DEMO</span></div>
              <div className="md14-card-score"><div><small>O‘ZLASHTIRISH NAMUNASI</small><strong>78<span>%</span></strong><b>↗ O‘sish sari!</b></div><span className="md14-trophy">🏆</span></div>
              <div className="md14-card-bars">{[{title:'Natural sonlar',val:92,level:'good'},{title:'Kasrlar',val:84,level:'good'},{title:'Geometriya',val:78,level:'mid'},{title:'Tenglamalar',val:43,level:'weak'}].map(b => <div className="md14-card-bar" key={b.title}><div><span>{b.title}</span><strong>{b.val}%</strong></div><div className="md14-track"><span className={b.level} style={{width:`${b.val}%`}}/></div></div>)}</div>
              <div className="md14-advice"><span>💡</span><div><b>Shaxsiy tavsiya</b><small>Tenglamalar bo‘yicha mashqlar bilan bilimingizni mustahkamlang.</small></div></div>
            </div>
            <div className="md14-floating md14-floating-left"><span>🎯</span><div><b>Individual ta’lim</b><small>Har bir o‘quvchiga mos</small></div></div>
            <div className="md14-floating md14-floating-right"><span>📈</span><div><b>Natijani kuzating</b><small>O‘sish dinamikasi</small></div></div>
            <div className="md14-geometry" aria-hidden="true">△</div>
          </div>
        </div>
      </section>
      <section className="md14-stats" aria-label="Tizim imkoniyatlari">
        <div><b><AnimatedNumber value={5}/></b><span>ta sinf · 5–9</span></div><div><b><AnimatedNumber value={4}/></b><span>ta foydalanuvchi kabineti</span></div><div><b><AnimatedNumber value={4}/></b><span>ta chorak testi yo‘nalishi</span></div><div><b><AnimatedNumber value={1} suffix=" ta"/></b><span>yagona ta’lim muhiti</span></div>
      </section>
      <section className="md14-section" id="imkoniyatlar"><div className="md14-section-intro"><span>PLATFORMA IMKONIYATLARI</span><h2>O‘rganishning <em>aqlli yo‘li</em></h2><p>O‘quvchi, o‘qituvchi, ota-ona va administrator bir tizimda ishlaydi.</p></div><div className="md14-features">{features.map(f=><article key={f.title}><span>{f.icon}</span><h3>{f.title}</h3><p>{f.text}</p><span className="md14-feature-note">MATH-DIAGNOZ ↗</span></article>)}</div></section>
      <section className="md14-process" id="qanday-ishlaydi"><div className="md14-process-inner"><div className="md14-process-text"><span>O‘RGANISH MODELI</span><h2>Aniqla → tushuntir → rivojlantir → qayta o‘lcha</h2><p>Platforma faqat baho qo‘ymaydi. Qaysi mavzu qiyinligini topishga va aynan shu mavzuni mustahkamlashga yordam beradi.</p><button onClick={enter}> {loggedIn?'Kabinetga qaytish':'Tizimga kirish'} →</button></div><div className="md14-steps">{steps.map(s=><article key={s.n}><span className="md14-step-icon">{s.icon}</span><small>{s.n}</small><b>{s.title}</b><p>{s.desc}</p></article>)}</div></div></section>
      <section className="md14-section md14-grades" id="sinflar"><div className="md14-section-intro"><span>5–9-SINFLAR</span><h2>Har bir sinf uchun <em>alohida ta’lim yo‘li</em></h2><p>PDF darsliklar, boblar, mavzular va choraklik testlar sinf bo‘yicha ajratiladi.</p></div><div className="md14-grade-grid">{[5,6,7,8,9].map(grade=><button key={grade} onClick={enter}><span>📘</span><b>{grade}-sinf</b><small>Mavzular va testlar</small><i>→</i></button>)}</div></section>
      <section className="md14-bottom"><div><span>✦ MATH-DIAGNOZ</span><h2>Matematikadagi imkoniyatingizni kashf eting!</h2><p>Shaxsiy natijalar, o‘qituvchi monitoringi va rivojlanish mashqlari.</p></div><button onClick={loggedIn?onDashboard:onRegister}>{loggedIn?'Kabinetga qaytish':'Ro‘yxatdan o‘tish'} →</button></section>
    </main>
    <footer className="md14-footer"><div><b>MATH-DIAGNOZ</b><span>Bilimdagi bo‘shliqni aniqlaymiz, yechimini topamiz.</span></div><small>© 2026 · Mahalliy sinov versiyasi · Rasmiy davlat axborot tizimi emas</small></footer>
  </div>
}
