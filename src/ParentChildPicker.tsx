import {useState} from 'react'

type School = {id:number;name:string}
type SchoolClass = {id:number;name:string;grade:number;schoolId?:number}
type Student = {id:number;name:string;username?:string;role:string;classId?:number;active:boolean}

type Props = {
  schools:School[]
  classes:SchoolClass[]
  users:Student[]
  value:number[]
  onChange:(childIds:number[])=>void
}

/** This picker changes only the visual selection; the existing parent-child API persists the IDs. */
export default function ParentChildPicker({schools,classes,users,value,onChange}:Props){
  const [openClassId,setOpenClassId]=useState<number|null>(()=>{
    const first=users.find(u=>u.role==='student'&&value.includes(u.id))
    return first?.classId ?? null
  })
  const students=users.filter(u=>u.role==='student')
  const orderedClasses=[...classes].sort((a,b)=>{
    const sa=schools.find(s=>s.id===a.schoolId)?.name||''
    const sb=schools.find(s=>s.id===b.schoolId)?.name||''
    return sa.localeCompare(sb,'uz')||a.grade-b.grade||a.name.localeCompare(b.name,'uz')
  })
  const openClass=classes.find(c=>c.id===openClassId)
  const classStudents=openClass?students.filter(u=>u.classId===openClass.id):[]
  function toggleStudent(id:number,checked:boolean){
    onChange(checked?Array.from(new Set([...value,id])):value.filter(x=>x!==id))
  }
  return <div className="md21-parent-picker">
    <div className="md21-parent-heading"><strong>Ota-onaga farzand biriktirish</strong><span className="md21-filter-total">{value.length} ta tanlangan</span></div>
    <p className="hint">1. Sinfni bosing. 2. Shu sinfdagi o‘quvchilardan farzandni tanlang. Bir nechta sinfdan tanlash mumkin.</p>
    <div className="md21-parent-classes" aria-label="Sinflar ro‘yxati">
      {orderedClasses.map(c=>{
        const classPupils=students.filter(u=>u.classId===c.id)
        const count=classPupils.filter(u=>value.includes(u.id)).length
        const school=schools.find(s=>s.id===c.schoolId)
        return <button key={c.id} type="button" className={'md21-parent-class'+(openClassId===c.id?' is-open':'')} aria-expanded={openClassId===c.id}
          onClick={()=>setOpenClassId(old=>old===c.id?null:c.id)}>
          <span><b>{c.name}</b><small>{school?.name||'Maktab belgilanmagan'} · {c.grade}-sinf</small></span>
          <span className="md21-parent-class-count">{classPupils.length} o‘quvchi{count?` · ${count} tanlangan`:''} <span aria-hidden="true">{openClassId===c.id?'−':'+'}</span></span>
        </button>
      })}
      {orderedClasses.length===0&&<p className="hint">Sinf topilmadi. Avval «Maktab boshqaruvi → Sinflar» bo‘limida sinf yarating.</p>}
    </div>
    {openClass&&<div className="md21-parent-students">
      <div className="md21-parent-heading"><strong>{openClass.name} — o‘quvchilar</strong><small>{classStudents.length} nafar</small></div>
      {classStudents.length===0?<p className="hint">Bu sinfda hali o‘quvchi yo‘q. O‘quvchilarni shu sinfga biriktiring.</p>:classStudents.map(u=><label key={u.id} className="md-v08-check md21-parent-student">
        <input type="checkbox" checked={value.includes(u.id)} onChange={e=>toggleStudent(u.id,e.target.checked)}/>
        <span><b>{u.name}</b><small>{u.username?`@${u.username}`:''}{!u.active?' · Bloklangan':''}</small></span>
      </label>)}
    </div>}
    {value.length>0&&<div className="md21-parent-selected" aria-live="polite">
      <strong>Biriktiriladigan farzandlar:</strong>
      <div className="md21-parent-chips">{value.map(id=>{
        const u=students.find(s=>s.id===id)
        return <button type="button" key={id} className="md21-parent-chip" aria-label={`${u?.name||id} ni ro‘yxatdan chiqarish`} onClick={()=>toggleStudent(id,false)}>{u?.name||`#${id}`} <span aria-hidden="true">×</span></button>
      })}</div>
    </div>}
  </div>
}
