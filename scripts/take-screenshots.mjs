import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { WebSocket } from 'ws'
import http from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', 'public', 'images')
const BASE_URL = 'http://localhost:3000'
const DEBUG_PORT = 9232
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const sleep = ms => new Promise(r => setTimeout(r, ms))

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.id = 1
    this.pending = new Map()
    this.eventHandlers = new Map()
    this.ws.on('message', raw => {
      const msg = JSON.parse(raw)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
      if (msg.method) {
        const handlers = this.eventHandlers.get(msg.method) || []
        handlers.forEach(h => h(msg.params))
      }
    })
  }
  ready() { return new Promise(r => this.ws.on('open', r)) }
  on(event, handler) {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, [])
    this.eventHandlers.get(event).push(handler)
  }
  off(event, handler) {
    const handlers = this.eventHandlers.get(event) || []
    this.eventHandlers.set(event, handlers.filter(h => h !== handler))
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => { this.pending.delete(id); reject(new Error(`Timeout: ${method}`)) }, 25000)
    })
  }
  close() { this.ws.close() }
}

async function getPage(retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      const targets = await new Promise((resolve, reject) => {
        http.get({ hostname: 'localhost', port: DEBUG_PORT, path: '/json' }, res => {
          let raw = ''; res.on('data', d => raw += d)
          res.on('end', () => resolve(JSON.parse(raw)))
        }).on('error', reject)
      })
      const page = targets.find(t => t.type === 'page')
      if (page) return page
    } catch {}
    await sleep(500)
  }
  throw new Error('Chrome page not found')
}

async function main() {
  console.log('Chrome 시작...')
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--window-size=1440,900', 'about:blank'
  ])
  chrome.stderr.on('data', () => {})
  await sleep(2500)

  const page = await getPage()
  const cdp = new CDP(page.webSocketDebuggerUrl)
  await cdp.ready()
  await cdp.send('Page.enable')
  await cdp.send('Network.enable')
  console.log('Chrome 연결됨')

  const navigate = async (url, extraWait = 4000) => {
    await new Promise(async (resolve) => {
      const onLoad = () => { cdp.off('Page.loadEventFired', onLoad); resolve() }
      cdp.on('Page.loadEventFired', onLoad)
      await cdp.send('Page.navigate', { url })
      // 최대 10초 대기
      setTimeout(resolve, 10000)
    })
    await sleep(extraWait) // React hydration + data fetch 대기
  }

  const eval_ = async expr => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true })
    return r?.result?.value
  }

  const clearSession = async () => {
    await cdp.send('Network.clearBrowserCookies')
    await cdp.send('Network.clearBrowserCache')
    console.log('  세션 초기화됨')
  }

  const login = async (email, password) => {
    await clearSession()
    await navigate(`${BASE_URL}/login`, 2000)
    await eval_(`
      (() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        const email = document.querySelector('input[type="email"]')
        const pass = document.querySelector('input[type="password"]')
        if (!email || !pass) { console.error('inputs not found'); return }
        setter.call(email, '${email}')
        email.dispatchEvent(new Event('input', {bubbles:true}))
        email.dispatchEvent(new Event('change', {bubbles:true}))
        setter.call(pass, '${password}')
        pass.dispatchEvent(new Event('input', {bubbles:true}))
        pass.dispatchEvent(new Event('change', {bubbles:true}))
      })()
    `)
    await sleep(500)
    await eval_(`document.querySelector('button[type="submit"]')?.click()`)
    await sleep(5000) // 인증 완료 대기
    const url = await eval_('window.location.href')
    console.log(`  로그인 후 URL: ${url}`)
  }

  const capture = async (filename) => {
    const r = await cdp.send('Page.captureScreenshot', {
      format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 }
    })
    const buf = Buffer.from(r.data, 'base64')
    writeFileSync(join(PUBLIC_DIR, filename), buf)
    const url = await eval_('window.location.href')
    console.log(`  ✅ ${filename} (${Math.round(buf.length/1024)}KB) @ ${url}`)
  }

  try {
    // Feature 01: 레벨 테스트 결과 (학생)
    console.log('\n1️⃣  레벨 테스트 결과...')
    await login('student30@happy-english.com', 'password123')
    await navigate(`${BASE_URL}/student/tests/934138fc-bfbd-4b8a-a9b8-c74df6c39e90/result`, 5000)
    await capture('screenshot-level-test.png')

    // Feature 02: AI 맞춤형 학습 (학생 - 세션 유지)
    console.log('\n2️⃣  AI 맞춤형 학습...')
    await navigate(`${BASE_URL}/student/learn`, 4000)
    await capture('screenshot-ai-analysis.png')

    // Feature 03: 교사 문제 뱅크
    console.log('\n3️⃣  교사 문제 뱅크...')
    await login('teacher1@happy-english.com', 'password123')
    await navigate(`${BASE_URL}/teacher/tests/questions`, 4000)
    await capture('screenshot-teacher-questions.png')

    // Feature 04: 학원장 분석
    console.log('\n4️⃣  분석 통계...')
    await login('owner@happy-english.com', 'password123')
    await navigate(`${BASE_URL}/owner/analytics`, 5000)
    await capture('screenshot-analytics.png')

    // Role Tab 01: 학원장 대시보드
    console.log('\n5️⃣  학원장 대시보드 (탭용)...')
    await navigate(`${BASE_URL}/owner`, 5000)
    await capture('screenshot-role-owner.png')

    // Role Tab 02: 교사 학생 관리
    console.log('\n6️⃣  교사 학생 관리 (탭용)...')
    await login('teacher1@happy-english.com', 'password123')
    await navigate(`${BASE_URL}/teacher/students`, 4000)
    await capture('screenshot-role-teacher.png')

    // Role Tab 03: 학생 홈
    console.log('\n7️⃣  학생 홈 (탭용)...')
    await login('student30@happy-english.com', 'password123')
    await navigate(`${BASE_URL}/student`, 4000)
    await capture('screenshot-role-student.png')

    console.log('\n✅ 모든 스크린샷 완료!')
  } finally {
    cdp.close()
    chrome.kill()
  }
}

main().catch(e => { console.error('❌', e); process.exit(1) })
