// MATH-DIAGNOZ v1.0 — Windows / macOS / Linux ishga tushirish tuzatmasi.
// Node yo'lida bo'shliq bo'lsa ham API va Vite alohida ishga tushadi.
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apiEntry = resolve(root, 'server', 'server.mjs')
const viteEntry = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js')
const running = []
let closing = false

if (!existsSync(viteEntry)) {
  console.error('Vite topilmadi. Loyiha papkasida npm.cmd install buyrug‘ini bajaring.')
  process.exit(1)
}

function shutdown(code = 0) {
  if (closing) return
  closing = true
  for (const processInfo of running) {
    try { processInfo.child.kill() } catch { /* ignored */ }
  }
  // Child jarayonlari tugashi uchun qisqa imkon.
  process.exitCode = code
}

function start(name, entry) {
  // MUHIM: shell:false. process.execPath ichidagi "Program Files" xavfsiz o'tadi.
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })
  running.push({ name, child })
  child.on('error', error => {
    console.error(`[${name}] ishga tushmadi:`, error.message)
    shutdown(1)
  })
  child.on('exit', (code, signal) => {
    if (closing) return
    console.error(`[${name}] to‘xtadi (kod: ${code ?? 'noma’lum'}, signal: ${signal || 'yo‘q'}).`)
    shutdown(code || 1)
  })
}

start('API', apiEntry)
start('Vite', viteEntry)
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
console.log('MATH-DIAGNOZ: http://localhost:5173/')
console.log('API: http://127.0.0.1:4317/api/status')
