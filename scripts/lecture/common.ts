// 강의 영상 파이프라인 CLI 공용 — 경로·환경 변수·대본 읽기/쓰기·ffmpeg·로컬 파일 서버·렌더 브라우저

import * as dotenv from 'dotenv'
import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { formatIssues, parseLectureScript, type LectureScript } from '../../src/lib/lecture-pipeline/types'
import type { PronunciationDict } from '../../src/lib/lecture-pipeline/normalize'
import { buildScriptReview } from '../../src/lib/lecture-pipeline/review'
import type { Timeline } from '../../src/lib/lecture-pipeline/timing'

dotenv.config({ path: '.env.local' })
dotenv.config()

export const LECTURES_DIR = path.resolve('lectures')
export const DICT_PATH = path.join(LECTURES_DIR, 'pronunciation-dict.json')

export function lectureDir(slug: string): string {
  return path.join(LECTURES_DIR, slug)
}

export const paths = (slug: string) => {
  const dir = lectureDir(slug)
  return {
    dir,
    script: path.join(dir, 'script.json'),
    review: path.join(dir, 'script-review.md'),
    audioDir: path.join(dir, 'audio'),
    cleanDir: path.join(dir, 'audio', 'clean'),
    narration: path.join(dir, 'narration.wav'),
    timeline: path.join(dir, 'timeline.json'),
    qa: path.join(dir, 'qa-report.md'),
    srt: path.join(dir, 'subtitles.srt'),
    mp4: path.join(dir, 'output.mp4'),
    thumbnail: path.join(dir, 'thumbnail.png'),
    youtube: path.join(dir, 'youtube.md'),
  }
}

// ── 인자 ──────────────────────────────────────────────────

export function parseArgs(argv: string[], valueFlags: string[] = []) {
  const flags = new Map<string, string | true>()
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2)
      if (v !== undefined) flags.set(k, v)
      else if (valueFlags.includes(k) && argv[i + 1] !== undefined) flags.set(k, argv[++i])
      else flags.set(k, true)
    } else positional.push(a)
  }
  return {
    positional,
    has: (k: string) => flags.has(k),
    get: (k: string): string | null => {
      const v = flags.get(k)
      return typeof v === 'string' ? v : null
    },
  }
}

// ── 대본·사전 ─────────────────────────────────────────────

export function loadDict(): PronunciationDict {
  const raw = JSON.parse(readFileSync(DICT_PATH, 'utf8')) as Partial<PronunciationDict>
  return { ko: raw.ko ?? {}, en: raw.en ?? {} }
}

/** script.json 읽기 + 검증. 오류가 있으면 목록을 보여 주고 멈춘다 */
export function readScript(slug: string): LectureScript {
  const p = paths(slug).script
  if (!existsSync(p)) throw new Error(`대본이 없어요: ${path.relative(process.cwd(), p)}\n먼저 npm run script -- "강의 타이틀" 로 대본을 만들어 주세요.`)
  let json: unknown
  try {
    json = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    throw new Error(`script.json의 JSON 형식이 깨졌어요 (쉼표·따옴표 확인): ${e instanceof Error ? e.message : String(e)}`)
  }
  const { script, issues } = parseLectureScript(json)
  const warns = issues.filter((i) => i.level === 'warn')
  if (warns.length) console.log(formatIssues(warns).map((l) => `  ${l}`).join('\n'))
  if (!script) throw new Error(`script.json에 고칠 곳이 있어요:\n${formatIssues(issues.filter((i) => i.level === 'error')).join('\n')}`)
  return script
}

export function writeScript(script: LectureScript, notes: string[] = []): void {
  const p = paths(script.slug)
  mkdirSync(p.dir, { recursive: true })
  writeFileSync(p.script, JSON.stringify(script, null, 2) + '\n')
  writeFileSync(p.review, buildScriptReview(script, loadDict(), notes))
}

export function readTimeline(slug: string): Timeline | null {
  const p = paths(slug).timeline
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Timeline) : null
}

// ── ffmpeg ────────────────────────────────────────────────
// 시스템 ffmpeg(또는 FFMPEG_PATH)가 있으면 그것을, 없으면 Remotion에 들어 있는 ffmpeg를 쓴다.

interface FfmpegCmd { bin: string; prefix: string[]; env: NodeJS.ProcessEnv }
let ffmpegCmd: FfmpegCmd | null = null

function resolveFfmpeg(): FfmpegCmd {
  if (ffmpegCmd) return ffmpegCmd
  const custom = process.env.FFMPEG_PATH?.trim()
  if (custom) return (ffmpegCmd = { bin: custom, prefix: [], env: process.env })
  const which = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' })
  if (which.status === 0 && which.stdout.trim()) return (ffmpegCmd = { bin: which.stdout.trim(), prefix: [], env: process.env })
  const arch = process.platform === 'linux' ? `${process.arch}-gnu` : process.platform === 'win32' ? `${process.arch}-msvc` : process.arch
  const dir = path.resolve('node_modules', '@remotion', `compositor-${process.platform}-${arch}`)
  const bin = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  if (existsSync(bin)) {
    const libVar = process.platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : 'LD_LIBRARY_PATH'
    return (ffmpegCmd = { bin, prefix: [], env: { ...process.env, [libVar]: dir } })
  }
  return (ffmpegCmd = { bin: path.resolve('node_modules', '.bin', 'remotion'), prefix: ['ffmpeg'], env: process.env })
}

/** ffmpeg 실행 → 표준출력(Buffer)·표준오류(문자열) */
export function ffmpeg(args: string[]): Promise<{ stdout: Buffer; stderr: string }> {
  const cmd = resolveFfmpeg()
  return new Promise((resolve, reject) => {
    const child = spawn(cmd.bin, [...cmd.prefix, '-hide_banner', ...args], { env: cmd.env })
    const out: Buffer[] = []
    let err = ''
    child.stdout.on('data', (d: Buffer) => out.push(d))
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err })
      else reject(new Error(`ffmpeg 실패 (코드 ${code}): ${err.split('\n').slice(-4).join(' ')}`))
    })
  })
}

// ── 로컬 파일 서버 (Remotion이 음성을 받아 가는 곳) ─────────

const MIME: Record<string, string> = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.json': 'application/json' }

/** 폴더 하나를 127.0.0.1에 띄운다 (Range 요청 지원 — 오디오 탐색용) */
export function serveFolder(dir: string, port = 0): Promise<{ base: string; close: () => void }> {
  const server = createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '')
    const file = path.join(dir, name)
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    const size = statSync(file).size
    const type = MIME[path.extname(file)] ?? 'application/octet-stream'
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/)
    if (range) {
      const start = range[1] ? Number(range[1]) : 0
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 })
      createReadStream(file, { start, end }).pipe(res)
      return
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = server.address() as AddressInfo
      resolve({ base: `http://127.0.0.1:${p}`, close: () => server.close() })
    })
  })
}

// ── 렌더 브라우저 ─────────────────────────────────────────
// Mac은 설치된 Chrome으로 렌더한다 (Remotion 전용 headless Chrome이 일부 Intel Mac에서 바로 꺼짐 — 2026-10 확인)

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export function browserOptions(): { browserExecutable: string; chromeMode: 'chrome-for-testing' } | Record<string, never> {
  const custom = process.env.REMOTION_BROWSER_EXECUTABLE
  if (custom) return { browserExecutable: custom, chromeMode: 'chrome-for-testing' }
  if (process.platform === 'darwin' && existsSync(MAC_CHROME)) return { browserExecutable: MAC_CHROME, chromeMode: 'chrome-for-testing' }
  return {}
}

// ── 기타 ──────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`
}

/** 동시에 n개씩 처리 */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

export function rel(p: string): string {
  return path.relative(process.cwd(), p)
}

/** CLI 진입점 공통 — 오류는 한국어 한 줄로 */
export function runCli(main: () => Promise<void>): void {
  main().catch((error) => {
    console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
