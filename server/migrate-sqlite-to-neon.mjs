// One-time import of the user's existing SQLite v1.5 data into a fresh Neon DB.
// Requires a stopped SQLite server and DATABASE_URL configured locally.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { initSchema, getClient, closePool } from './postgres-db.mjs'

const source=process.argv[2] ? resolve(process.argv[2]) : resolve('server','data','math-diagnoz.sqlite')
if(!existsSync(source)){console.error('SQLite baza topilmadi:',source);process.exit(1)}
const sqlite=new DatabaseSync(source,{readOnly:true})
let client
const list=['schools','users','classes','app_state','exams','results','assets','audit','practice_attempts']
const numericIdentity=['schools','users','classes','results','audit','practice_attempts']
const ddlColumn={
 schools:['id','name','region','district','code'],
 users:['id','username','name','role','class_id','child_ids','salt','pass_hash','active','last_login_at'],
 classes:['id','name','grade','teacher_id','school_id'],
 app_state:['key','value'],
 exams:['id','user_id','test_id','started_at','deadline_at','answers','status'],
 results:['id','user_id','exam_id','test_id','data'],
 assets:['id','kind','filename','mime','bytes','uploaded_by','created_at'],
 audit:['id','actor_id','action','details','created_at'],
 practice_attempts:['id','user_id','question_id','correct','created_at']
}
function sourceExists(table){return !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)}
function getSourceRows(table){return sourceExists(table)?sqlite.prepare(`SELECT * FROM "${table}"`).all():[]}
try{
 const sourceUsers=getSourceRows('users')
 const adminUsers=sourceUsers.filter(x=>x.role==='admin')
 if(!adminUsers.length)throw new Error('Eski bazada administrator hisobi topilmadi. Boshqa SQLite bazani tanlang.')
 await initSchema();client=await getClient();await client.query('BEGIN')
 const existing=await client.query('SELECT count(*) n FROM users')
 if(Number(existing.rows[0].n)>0)throw new Error('Neon bazasida foydalanuvchilar bor. Mavjud ma’lumotni ustidan yozish to‘xtatildi.')
 const existingResults=await client.query('SELECT count(*) n FROM results')
 if(Number(existingResults.rows[0].n)>0)throw new Error('Neon bazasida test natijalari bor; migratsiya bekor qilindi.')
 const existingClasses=await client.query('SELECT count(*) n FROM classes')
 if(Number(existingClasses.rows[0].n)>0)throw new Error('Neon bazasida sinflar bor; migratsiya bekor qilindi.')
 // A server may have created just the sample school, but it must be the only data present.
 const oldSchools=getSourceRows('schools')
 let fallbackSchoolId=oldSchools[0]?.id??null
 if(oldSchools.length){
  const existingSchools=await client.query('SELECT * FROM schools')
  if(existingSchools.rows.some(x=>x.name!=='Namuna maktab (tahrirlang)'))throw new Error('Neon maktablar ro‘yxati bo‘sh emas; o‘zgartirish bekor qilindi.')
  await client.query('DELETE FROM schools')
 } else {
  const sample=await client.query("INSERT INTO schools(name,region,district,code) VALUES('Namuna maktab (tahrirlang)','Surxondaryo','','') RETURNING id")
  fallbackSchoolId=sample.rows[0].id
 }
 let fileCount=0, missingFiles=0
 for(const table of list){
  const rows=getSourceRows(table),columns=ddlColumn[table]
  for(const raw of rows){
   const row={...raw}
   if(table==='users'&&!('last_login_at' in row))row.last_login_at=null
   if(table==='classes'&&!('school_id' in row))row.school_id=fallbackSchoolId
   if(table==='classes'&&row.school_id===null)row.school_id=fallbackSchoolId
   const names=columns.filter(c=>c in row)
   const marks=names.map((_,i)=>'$'+(i+1)).join(',')
   await client.query(`INSERT INTO "${table}" (${names.map(c=>'"'+c+'"').join(',')}) VALUES (${marks})`,names.map(c=>row[c]))
  }
  console.log(`${table}: ${rows.length} ta yozuv`)
 }
 const assets=getSourceRows('assets'),assetFolder=resolve(dirname(source),'uploads')
 for(const a of assets){
  const filepath=resolve(assetFolder,String(a.id))
  if(!existsSync(filepath)){missingFiles++;continue}
  await client.query('INSERT INTO asset_blobs(id,content) VALUES($1,$2)',[a.id,readFileSync(filepath)])
  fileCount++
 }
 for(const table of numericIdentity){
  await client.query(`SELECT setval(pg_get_serial_sequence('${table}','id'), GREATEST(COALESCE((SELECT MAX(id) FROM ${table}),0),1), (SELECT COUNT(*)>0 FROM ${table}))`)
 }
 const check=await client.query('SELECT count(*) n FROM users')
 if(Number(check.rows[0].n)!==sourceUsers.length)throw new Error('Migratsiya tekshiruvi xato: foydalanuvchilar soni mos emas')
 await client.query('COMMIT')
 console.log('\nMUVAFFAQIYAT: NEON GA IMPORT TUGADI')
 console.log('Adminlar:',adminUsers.length,'Foydalanuvchilar:',sourceUsers.length,'Fayllar:',fileCount,'Topilmagan fayllar:',missingFiles)
 console.log('Eski login va parol o‘zgarishsiz qoldi. Eski SQLite faylingiz o‘chirilmagan.')
 if(missingFiles)console.log('DIQQAT: ayrim rasm/PDF fayllari eski uploads papkasida yo‘q. Ularni keyin yuklash kerak.')
}catch(error){
 if(client)try{await client.query('ROLLBACK')}catch{}
 console.error('\nMIGRATSIYA TO‘XTADI:',error.message)
 process.exitCode=1
}finally{if(client)client.release();sqlite.close();await closePool()}
