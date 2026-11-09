import { initSchema, get, closePool } from './postgres-db.mjs'
try{
 await initSchema()
 const u=await get('SELECT COUNT(*) AS n FROM users')
 const schools=await get('SELECT COUNT(*) AS n FROM schools')
 const results=await get('SELECT COUNT(*) AS n FROM results')
 console.log('NEON ALOQA: MUVAFFAQIYAT!')
 console.log('Foydalanuvchilar:',u.n,'Maktablar:',schools.n,'Test natijalari:',results.n)
 console.log('Eslatma: ma’lumotlar avtomatik ko‘chirilmadi; migratsiya alohida bajariladi.')
}catch(e){console.error('NEON ULASH XATOSI:',e.message);process.exitCode=1}
finally{await closePool()}
