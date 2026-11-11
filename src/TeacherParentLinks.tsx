import { useEffect, useState, type FormEvent } from 'react'
import { api } from './AuthScreen'

type GradeClass = { id:number; name:string; grade:number; teacherId?:number|null; schoolId?:number }
type Student = { id:number; name:string; role:string; classId?:number; active:boolean }
type Link = { studentId:number; parentId:number; parentName:string; parentUsername:string }

export default function TeacherParentLinks({teacherId, classes, users}:{teacherId:number;classes:GradeClass[];users:Student[]}) {
  const [classId,setClassId] = useState(0)
  const [studentId,setStudentId] = useState(0)
  const [parentLogin,setParentLogin] = useState('')
  const [links,setLinks] = useState<Link[]>([])
  const [busy,setBusy] = useState(false)
  const [notice,setNotice] = useState('')
  const mine = classes.filter(c=>c.teacherId===teacherId)
  const selectedClassId = mine.some(c=>c.id===classId) ? classId : mine[0]?.id||0
  const students = users.filter(u=>u.role==='student'&&u.active&&u.classId===selectedClassId)
  const selectedStudentId = students.some(s=>s.id===studentId)?studentId:students[0]?.id||0

  async function reload(cid:number){
    if(!cid){setLinks([]);return}
    try {const result=await api<{rows:Link[]}>(`/api/teacher/parent-links?classId=${cid}`);setLinks(result.rows)}
    catch(err){setNotice(err instanceof Error?err.message:'Bog‘lanishlarni yuklab bo‘lmadi')}
  }
  useEffect(()=>{void reload(selectedClassId)},[selectedClassId])

  async function link(e:FormEvent){
    e.preventDefault()
    if(!selectedClassId||!selectedStudentId||!parentLogin.trim())return
    setBusy(true);setNotice('')
    try {
      await api('/api/teacher/parent-links','POST',{classId:selectedClassId,studentId:selectedStudentId,parentLogin:parentLogin.trim()})
      setParentLogin('');await reload(selectedClassId);setNotice('Ota-ona o‘quvchiga biriktirildi.')
    } catch(err){setNotice(err instanceof Error?err.message:'Ota-onani biriktirib bo‘lmadi')}
    finally{setBusy(false)}
  }
  async function unlink(entry:Link){
    if(!window.confirm(`${entry.parentName} ni tanlangan o‘quvchidan ajratasizmi?`))return
    setBusy(true);setNotice('')
    try {
      await api('/api/teacher/parent-links','DELETE',{classId:selectedClassId,studentId:selectedStudentId,parentId:entry.parentId})
      await reload(selectedClassId);setNotice('Ota-ona ushbu o‘quvchidan ajratildi.')
    }catch(err){setNotice(err instanceof Error?err.message:'Ajratib bo‘lmadi')}
    finally{setBusy(false)}
  }
  return <div className="two-cols">
    <section className="panel">
      <h2>Ota-onani farzandiga biriktirish</h2>
      <p className="hint">Faqat sizga biriktirilgan sinflar. Ota-onaning allaqachon yaratilgan hisobidagi <strong>login</strong>ni kiriting.</p>
      {mine.length===0?<div className="empty">Sizga hali sinf biriktirilmagan. Maktab administratoriga murojaat qiling.</div>:
        <form className="form" onSubmit={e=>void link(e)}>
          <label>Sinf
            <select value={selectedClassId} onChange={e=>{setClassId(Number(e.target.value));setStudentId(0);setNotice('')}}>
              {mine.map(c=><option value={c.id} key={c.id}>{c.name} · {c.grade}-sinf</option>)}
            </select>
          </label>
          <label>O‘quvchi
            <select value={selectedStudentId} onChange={e=>setStudentId(Number(e.target.value))} disabled={!students.length}>
              {students.length===0&&<option value={0}>O‘quvchi topilmadi</option>}
              {students.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>Ota-onaning logini
            <input value={parentLogin} onChange={e=>setParentLogin(e.target.value)} required maxLength={32} autoComplete="off" placeholder="Masalan: otaona_01"/>
          </label>
          <div className="md-button-row"><button className="btn btn-primary" disabled={busy||!selectedStudentId||!parentLogin.trim()}>{busy?'Saqlanmoqda...':'＋ Ota-onani biriktirish'}</button></div>
        </form>}
      {notice&&<p className="hint" role="status">{notice}</p>}
    </section>
    <section className="panel">
      <h2>Biriktirilgan ota-onalar</h2>
      <p className="hint">Tanlangan o‘quvchiga bog‘langan ota-onalar. Boshqa farzandlar bilan bog‘lanishlar o‘zgarmaydi.</p>
      {links.filter(x=>x.studentId===selectedStudentId).length===0?<div className="empty">Bu o‘quvchiga hali ota-ona biriktirilmagan.</div>:
        links.filter(x=>x.studentId===selectedStudentId).map(entry=><div className="md-v08-list" key={entry.parentId}>
          <div><strong>{entry.parentName}</strong><small>Login: {entry.parentUsername}</small></div>
          <button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void unlink(entry)}>Ajratish</button>
        </div>)}
    </section>
  </div>
}
