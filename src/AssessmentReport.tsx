import {useEffect,useMemo,useState} from 'react'
import {api} from './AuthScreen'
import './AssessmentReport.css'

type Row={id:number;userId:number;userName:string;userRole:string;classId:number|null;className:string|null;schoolId:number|null;schoolName:string|null;program:string;stage:number;score:number;total:number;createdAt:number}
const percent=(r:Row)=>Math.round(r.score/Math.max(1,r.total)*100)
function csvCell(v:unknown){const s=String(v??'');const safe=/^[=+\-@\t\r]/.test(s)?"'"+s:s;return '"'+safe.replace(/"/g,'""')+'"'}
export default function AssessmentReport(){
 const [rows,setRows]=useState<Row[]>([])
 const [truncated,setTruncated]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [program,setProgram]=useState('all')
 const [stage,setStage]=useState('all')
 const [school,setSchool]=useState('all')
 const [klass,setKlass]=useState('all')
 const [search,setSearch]=useState('')
 const load=()=>{setLoading(true);setError('');api<{rows:Row[];truncated:boolean}>('/api/v2/assessment/report').then(d=>{setRows(d.rows);setTruncated(d.truncated)}).catch(e=>setError(e instanceof Error?e.message:'Hisobot yuklanmadi')).finally(()=>setLoading(false))}
 useEffect(()=>{load()},[])
 const schoolOptions=useMemo(()=>[...new Map(rows.filter(r=>r.schoolId!==null).map(r=>[String(r.schoolId),r.schoolName||'Maktab'])).entries()], [rows])
 const classesForSchool=useMemo(()=>rows.filter(r=>school==='all'||String(r.schoolId)===school),[rows,school])
 const classOptions=useMemo(()=>[...new Map(classesForSchool.filter(r=>r.classId!==null).map(r=>[String(r.classId),r.className||'Sinf'])).entries()],[classesForSchool])
 const shown=useMemo(()=>rows.filter(r=>(program==='all'||r.program===program)&&(stage==='all'||String(r.stage)===stage)&&(school==='all'||String(r.schoolId)===school)&&(klass==='all'||String(r.classId)===klass)&&r.userName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[rows,program,stage,school,klass,search])
 const mean=shown.length?Math.round(shown.reduce((n,r)=>n+percent(r),0)/shown.length):0
 const students=new Set(shown.map(r=>r.userId)).size
 function exportCsv(){
  const header=['Dastur','Bosqich','Ism','Rol','Maktab','Sinf','Ball','Jami','Foiz','Sana']
  const data=shown.map(r=>[r.program,r.stage,r.userName,r.userRole,r.schoolName||'',r.className||'',r.score,r.total,percent(r),new Date(Number(r.createdAt)).toLocaleString('uz-UZ')])
  const csv='\uFEFF'+[header,...data].map(row=>row.map(csvCell).join(';')).join('\r\n')
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a');link.href=url;link.download='MATH-DIAGNOZ-xalqaro-hisobot.csv';link.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 return <section className="v2-card ar-card">
  <div className="v2-row"><div><h3>📊 Xalqaro baholash — umumiy hisobot</h3><p className="v2-hint">PISA, TIMSS, PIRLS va TALIS natijalari. O‘qituvchiga faqat o‘z sinflari, administratorga barcha maktablar ko‘rinadi. TALIS o‘qituvchilar natijasi alohida.</p></div><button className="v2-button" type="button" onClick={load} disabled={loading}>↻ Yangilash</button></div>
  {error&&<div role="alert" className="v2-alert error">{error}</div>}
  {loading?<p className="v2-hint">Hisobot yuklanmoqda...</p>:<>
    <div className="ar-filters">
      <label>Dastur<select value={program} onChange={e=>setProgram(e.target.value)}><option value="all">Barchasi</option>{['PISA','TIMSS','PIRLS','TALIS'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Bosqich<select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">Barchasi</option><option value="1">1-bosqich</option><option value="2">2-bosqich</option></select></label>
      <label>Maktab<select value={school} onChange={e=>{setSchool(e.target.value);setKlass('all')}}><option value="all">Barcha maktablar</option>{schoolOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>Sinf<select value={klass} onChange={e=>setKlass(e.target.value)}><option value="all">Barcha sinflar</option>{classOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>Ism bo‘yicha qidirish<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="O‘quvchining ismi"/></label>
    </div>
    <div className="ar-stats"><span><strong>{shown.length}</strong> ta urinish</span><span><strong>{students}</strong> ta ishtirokchi</span><span><strong>{mean}%</strong> o‘rtacha natija</span><button type="button" className="v2-button" onClick={exportCsv} disabled={!shown.length}>↓ Excel uchun CSV</button></div>
    {truncated&&<p className="v2-hint" role="status">Faqat so‘nggi 1000 ta urinish ko‘rsatilmoqda. Katta hajmli to‘liq hisobot keyingi versiyada qo‘shiladi.</p>}
    <div className="ar-scroll"><table className="ar-table"><thead><tr><th>Sana</th><th>Ishtirokchi</th><th>Maktab</th><th>Sinf</th><th>Dastur</th><th>Bosqich</th><th>Natija</th><th>Holat</th></tr></thead><tbody>{shown.map(r=><tr key={r.id}><td>{new Date(Number(r.createdAt)).toLocaleDateString('uz-UZ')}</td><td>{r.userName}{r.userRole==='teacher'?' (o‘qituvchi)':''}</td><td>{r.schoolName||'—'}</td><td>{r.className||'—'}</td><td>{r.program}</td><td>{r.stage}</td><td>{r.score}/{r.total} ({percent(r)}%)</td><td>{percent(r)>=60?'O‘tdi':'Tayyorgarlik kerak'}</td></tr>)}</tbody></table></div>
    {!shown.length&&<p className="v2-hint">Tanlangan filtrlar bo‘yicha hozircha natija yo‘q.</p>}
  </>}
 </section>
}
