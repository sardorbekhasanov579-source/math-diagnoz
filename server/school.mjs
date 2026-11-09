// One-school pilot. Built Vite app and API share one same-origin local HTTP port.
import { networkInterfaces } from 'node:os'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..')
if(!existsSync(resolve(project,'dist','index.html'))){
 console.error('Sayt yig‘ilmagan. Avval npm.cmd run build buyrug‘ini bajaring.')
 process.exit(1)
}
process.env.MD_API_PORT=process.env.MD_SCHOOL_PORT||'4173'
process.env.MD_BIND_HOST='0.0.0.0'
process.env.MD_SERVE_DIST='1'
process.env.MD_SCHOOL_MODE='1'
const port=process.env.MD_API_PORT
console.log('\n============================================')
console.log(' MATH-DIAGNOZ v1.5 | BIR MAKTAB PILOTI')
console.log('============================================')
console.log('Server kompyuterida: http://localhost:'+port+'/')
const found=[]
for(const [label, addresses] of Object.entries(networkInterfaces())){
 for(const a of addresses||[]){
  if(a.family!=='IPv4'||a.internal)continue
  if(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address))found.push({label,ip:a.address})
 }
}
for(const x of found)console.log('Maktab Wi-Fi/LAN tarmog‘ida ('+x.label+'): http://'+x.ip+':'+port+'/')
if(!found.length)console.log('Maktab tarmog‘i IP manzili topilmadi; ipconfig orqali aniqlang.')
console.log('ESLATMA: faqat ishonchli ichki tarmoq. Router port-forwarding YOQ.')
console.log('Windows Firewall sorasa faqat PRIVATE networkga ruxsat bering.')
console.log('Toxtatish: Ctrl+C.\n')
await import('./server.mjs')
