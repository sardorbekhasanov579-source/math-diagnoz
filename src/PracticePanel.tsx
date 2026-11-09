import { useEffect, useState } from 'react'
import { api } from './AuthScreen'

type Exercise = { id: string; grade: number; topic: string; q: string; options: string[]; hint: string }
type Progress = { mastered: number; attempted: number; totalAttempts: number; items: { question_id:string; mastered:number; attempts:number }[] }

export default function PracticePanel({ grade }: { grade: number }) {
  const [items, setItems] = useState<Exercise[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [result, setResult] = useState<{ correct:boolean; explanation:string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [hint, setHint] = useState(false)
  const [topic, setTopic] = useState('all')
  const update = () => api<Progress>('/api/practice/progress').then(setProgress)
  useEffect(() => {
    let live = true
    api<{ questions: Exercise[] }>('/api/practice/questions')
      .then(r => { if (live) setItems(r.questions) })
      .catch(e => { if (live) setMessage(e instanceof Error ? e.message : 'Mashqlar yuklanmadi') })
    void update().catch(() => {})
    return () => { live = false }
  }, [grade])
  const topics = Array.from(new Set(items.map(q => q.topic)))
  const filtered = items.filter(q => topic === 'all' || q.topic === topic)
  const active = filtered[index] || filtered[0]
  async function check() {
    if (!active || chosen === null || busy || result) return
    setBusy(true)
    try {
      const response = await api<{ correct:boolean; explanation:string }>('/api/practice/answer','POST',{id:active.id,answer:chosen})
      setResult(response)
      await update()
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Javobni tekshirib bo‘lmadi') }
    finally { setBusy(false) }
  }
  function next() { setChosen(null); setResult(null); setHint(false); setIndex(i => filtered.length ? (i + 1) % filtered.length : 0) }
  return <div className="md13-practice">
    <section className="md13-hero"><div><span className="md13-kicker">🧠 SHAXSIY MUSTAHKAMLASH</span><h2>Individual matematik mashqlar</h2><p>Javoblaringiz serverda tekshiriladi. Har bir mashq orqali bilimni mustahkamlang va avvalgi natijangizni yaxshilang.</p></div><span className="md13-health-pill">{grade}-sinf</span></section>
    <div className="md13-grid4 md13-practice-stats">
      <div className="md13-metric"><small>Mashqlar banki</small><strong>{items.length}</strong></div>
      <div className="md13-metric"><small>Ishlangan</small><strong>{progress?.attempted ?? 0}</strong></div>
      <div className="md13-metric"><small>O‘zlashtirilgan</small><strong>{progress?.mastered ?? 0}</strong></div>
      <div className="md13-metric"><small>Urinishlar</small><strong>{progress?.totalAttempts ?? 0}</strong></div>
    </div>
    <section className="panel md13-practice-card">
      <div className="panel-head"><h2>Bilimni mustahkamlash</h2><span className="tag">Natija bazada saqlanadi</span></div>
      <label className="field-label">Mavzuni tanlang
        <select value={topic} onChange={e => { setTopic(e.target.value); setIndex(0); setResult(null); setChosen(null); setHint(false) }}>
          <option value="all">Barcha mavzular</option>{topics.map(t => <option value={t} key={t}>{t}</option>)}
        </select>
      </label>
      {message && <p role="alert" className="md13-feedback">{message}</p>}
      {!active ? <div className="empty">Hozircha bu sinfga mashqlar biriktirilmagan.</div> : <>
        <div className="md13-practice-question"><div className="md13-practice-meta"><span>{active.topic}</span><span>{index + 1} / {filtered.length}</span></div><h3>{active.q}</h3>
          <div className="md13-practice-options">
            {active.options.map((opt,i) => <button key={i} disabled={!!result} className={'md13-practice-option '+(chosen===i?'selected ':'')+(result&&chosen===i?(result.correct?'correct':'incorrect'):'')} onClick={() => {setChosen(i);setMessage('')}}><b>{String.fromCharCode(65+i)}</b><span>{opt}</span></button>)}
          </div>
        </div>
        {!result && <button className="btn btn-outline" onClick={()=>setHint(v=>!v)}>💡 {hint?'Maslahatni yashirish':'Maslahat olish'}</button>}
        {hint&&!result&&<p className="md13-practice-hint">{active.hint}</p>}
        {result&&<div role="status" className={'md13-practice-result '+(result.correct?'correct':'incorrect')}><b>{result.correct?'🎉 To‘g‘ri javob!':'🧩 Yana mashq qiling!'}</b><span>{result.explanation}</span></div>}
        <div className="md-button-row">{!result?<button className="btn btn-primary" disabled={chosen===null||busy} onClick={()=>void check()}>{busy?'Tekshirilmoqda...':'Javobni tekshirish →'}</button>:<button className="btn btn-primary" onClick={next}>Keyingi mashq →</button>}</div>
        <p className="hint">Bu dastlabki 5–9-sinf mashqlar banki. Diagnostika natijalari asosida keyinchalik mavzu va murakkablik darajasi bo‘yicha yanada batafsil tavsiyalar qo‘shiladi.</p>
      </>}
    </section>
  </div>
}
