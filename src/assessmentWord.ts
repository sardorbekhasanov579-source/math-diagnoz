// Plain-text parser shared by international assessment Word import.
// No HTML is rendered; answers are only shown in the admin preview.
export type AssessmentDraft={text:string;options:string[];correct:number;explanation:string}
export function parseAssessmentText(text:string):{questions:AssessmentDraft[];errors:string[]}{
  const questions:AssessmentDraft[]=[]
  const errors:string[]=[]
  let draft:{text:string;options:Record<string,string>;answer:string;why:string}|null=null
  let last:'question'|'A'|'B'|'C'|'D'='question'
  let number=0
  const keys=['A','B','C','D']
  const finish=()=>{
    if(!draft)return
    const missing=keys.filter(k=>!draft!.options[k]?.trim())
    if(draft.text.trim().length<6||missing.length||!keys.includes(draft.answer)){
      errors.push(`${number}-savol: ${missing.length?'A–D variantlari to‘liq emas':!keys.includes(draft.answer)?'JAVOB: A/B/C/D ko‘rsatilmagan':'savol matni juda qisqa'}`)
    }else{
      questions.push({text:draft.text.trim(),options:keys.map(k=>draft!.options[k].trim()),correct:keys.indexOf(draft.answer),explanation:draft.why.trim()})
    }
    draft=null
  }
  for(const raw of text.replace(/\r/g,'').split('\n')){
    const line=raw.trim()
    if(!line)continue
    const q=/^(?:\d+[.)-]\s*)?SAVOL\s*:\s*(.*)$/i.exec(line)
    if(q){finish();number++;draft={text:q[1],options:{},answer:'',why:''};last='question';continue}
    if(!draft)continue
    if(/^MAVZU\s*:/i.test(line))continue
    const a=/^JAVOB\s*:\s*([A-D])\s*[).]?\s*$/i.exec(line)
    if(a){draft.answer=a[1].toUpperCase();continue}
    const why=/^(?:IZOH|YECHIM)\s*:\s*(.*)$/i.exec(line)
    if(why){draft.why=why[1];continue}
    const option=/^([A-D])\s*[).:]\s*(.*)$/i.exec(line)
    if(option){last=option[1].toUpperCase() as 'A'|'B'|'C'|'D';draft.options[last]=option[2];continue}
    if(draft.answer)continue
    if(last==='question')draft.text+=' '+line
    else draft.options[last]=(draft.options[last]||'')+' '+line
  }
  finish()
  if(!number)errors.push('SAVOL: bilan boshlanadigan savol topilmadi. Word shablondan foydalaning.')
  if(questions.length>50)errors.push('Bir faylda ko‘pi bilan 50 ta savol bo‘lsin. Faylni qismlarga bo‘ling.')
  for(const [i,q] of questions.entries()){
    if(q.text.length>800||q.options.some(o=>o.length>300)||q.explanation.length>900)errors.push(`${i+1}-savol: matn, variant yoki izoh juda uzun`)
  }
  return {questions,errors}
}
