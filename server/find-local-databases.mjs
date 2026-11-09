import { DatabaseSync } from 'node:sqlite'
import { existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
const roots=[resolve('.'),resolve('..'),resolve('../MATH-DIAGNOZ-ESKI'),resolve('../MATH-DIAGNOZ-v1.4'),resolve('../MATH-DIAGNOZ-v1.5')]
const files=new Set()
for (const d of roots){
 for(const sub of ['server/data','MATH-DIAGNOZ/server/data','']){
  const candidate=resolve(d,sub,'math-diagnoz.sqlite');if(existsSync(candidate))files.add(candidate)
 }
 const path=resolve(d,'server','backups')
 if(existsSync(path))for(const folder of readdirSync(path)){
  const candidate=join(path,folder,'math-diagnoz.sqlite');if(existsSync(candidate))files.add(candidate)
 }
}
console.log('\nTOPILGAN SQLITE BAZALAR (faqAT O‘QISH):\n')
for(const f of files){
 try{const db=new DatabaseSync(f,{readOnly:true});const users=db.prepare('SELECT COUNT(*) n FROM users').get().n
 const admins=db.prepare("SELECT username FROM users WHERE role='admin'").all().map(x=>x.username).join(', ')
 const results=db.prepare("SELECT COUNT(*) n FROM results").get().n
 console.log('FAYL:',f,'\n  Admin loginlar:',admins||'—','\n  Foydalanuvchilar:',users,' Natijalar:',results,'\n')
 db.close()
 }catch(e){console.log('FAYL:',f,' — O‘QIB BO‘LMADI:',e.message)}
}
if(!files.size)console.log('Baza topilmadi. Windows Explorer orqali eski MATH-DIAGNOZ/server/data/math-diagnoz.sqlite ni qidiring.')
