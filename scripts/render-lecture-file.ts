/**
 * scripts/render-lecture-file.ts
 * DB 없이 장면 JSON 파일 하나로 AI 강의 영상을 만든다 (관리자 PC 전용).
 * 외부에서 받은 강의 원고를 장면 JSON(scenesJson과 같은 형식)으로 옮긴 뒤 바로 MP4로 뽑을 때 쓴다.
 *
 *   npm run lecture:render-file -- <장면 JSON 경로> [--title 제목] [--out 폴더] [--no-subtitles] [--audio-only]
 *
 * - 음성: ElevenLabs(.env.local의 ELEVENLABS_*)로 세그먼트마다 MP3를 만들어 <out>/audio에 저장한다.
 *   파일 이름에 문장 해시가 들어가므로, 문장을 고쳐 다시 실행하면 바뀐 문장만 새로 만든다 (글자 수 과금).
 * - 렌더: Remotion 컴포지션(render-lecture.ts와 같은 화면). 음성은 로컬 HTTP 서버로 넘긴다.
 * - 결과: <out>/<제목>.mp4, .srt, -설명문.txt
 * - --audio-only: 음성만 만들고 렌더하지 않음 (길이 확인용)
 */

import * as dotenv from 'dotenv'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { parseVideoScenes, formatVideoSceneErrors } from '../src/types/grammar-video'
import { resolveAudioVoices, synthesizeSegment } from '../src/lib/grammar/elevenlabs'
import { isSpokenSegment, segmentAudioHash } from '../src/lib/grammar/video/audio-plan'
import { getMp3DurationSec } from '../src/lib/grammar/video/mp3-duration'
import { buildTimeline, toSrt } from '../src/lib/grammar/video/timeline'
import { buildYoutubeDescription, exportFileBase } from '../src/lib/grammar/video/export/youtube-text'
import {
  LECTURE_COMPOSITION_ID,
  type LectureCompositionProps,
} from '../src/components/grammar/video/remotion/composition-props'

dotenv.config({ path: '.env.local' })
dotenv.config()

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TTS_PARALLEL = 3

const args = process.argv.slice(2)
const has = (name: string) => args.includes(name)
function arg(name: string): string | null {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] ?? null : null
}
const VALUE_FLAGS = ['--out', '--title', '--concurrency']
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.includes(args[i - 1])))

function formatSec(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`
}

function browserOptions(): { browserExecutable: string; chromeMode: 'chrome-for-testing' } | null {
  const custom = process.env.REMOTION_BROWSER_EXECUTABLE
  if (custom) return { browserExecutable: custom, chromeMode: 'chrome-for-testing' }
  if (process.platform === 'darwin' && existsSync(MAC_CHROME)) {
    return { browserExecutable: MAC_CHROME, chromeMode: 'chrome-for-testing' }
  }
  return null
}

/** 음성 폴더를 렌더 중에만 여는 로컬 서버 */
function serveFolder(dir: string): Promise<{ base: string; close: () => void }> {
  const server = createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '')
    const file = path.join(dir, path.basename(name))
    if (!name || !existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' })
    res.end(readFileSync(file))
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ base: `http://127.0.0.1:${port}`, close: () => server.close() })
    })
  })
}

async function main() {
  if (!target) {
    console.log('사용법: npm run lecture:render-file -- <장면 JSON 경로> [--title 제목] [--out 폴더] [--no-subtitles] [--audio-only]')
    process.exitCode = 1
    return
  }
  const jsonPath = path.resolve(target)
  const parsed = parseVideoScenes(JSON.parse(readFileSync(jsonPath, 'utf8')))
  if (!parsed.ok) throw new Error(`장면에 오류가 있습니다.\n${formatVideoSceneErrors(parsed.errors).join('\n')}`)
  const scenes = parsed.scenes

  const opening = scenes.find((s) => s.template === 'opening')
  const title = arg('--title') ?? (opening && opening.template === 'opening' ? opening.data.titleKo : path.basename(jsonPath, '.json'))
  const outDir = path.resolve(arg('--out') ?? path.dirname(jsonPath))
  const audioDir = path.join(outDir, 'audio')
  mkdirSync(audioDir, { recursive: true })

  // 1) 음성 — 같은 문장·목소리면 저장된 파일을 다시 쓴다
  const voices = resolveAudioVoices()
  if (!voices) throw new Error('ELEVENLABS_KO_VOICE_ID / ELEVENLABS_EN_VOICE_ID를 .env.local에 넣어 주세요.')
  const spoken = scenes.flatMap((s) => s.segments).filter(isSpokenSegment)
  let made = 0
  let chars = 0
  const queue = [...spoken]
  async function worker() {
    for (let seg = queue.shift(); seg; seg = queue.shift()) {
      const hash = segmentAudioHash(seg, voices!)
      const fileName = `${seg.id}-${hash}.mp3`
      const file = path.join(audioDir, fileName)
      let bytes: Uint8Array
      if (existsSync(file)) {
        bytes = new Uint8Array(readFileSync(file))
      } else {
        const v = voices![seg.lang]
        const res = await synthesizeSegment(seg.text, seg.lang, v.voiceId, { modelId: v.modelId, speed: v.speed })
        writeFileSync(file, res.audio)
        bytes = res.audio
        made += 1
        chars += res.chars
        console.log(`  음성 ${seg.id} (${res.durationSec.toFixed(1)}초)`)
      }
      seg.audioPath = fileName
      seg.textHash = hash
      seg.durationSec = getMp3DurationSec(bytes) ?? (bytes.byteLength * 8) / 128_000
    }
  }
  await Promise.all(Array.from({ length: TTS_PARALLEL }, () => worker()))
  const timeline = buildTimeline(scenes)
  console.log(`▶ "${title}" · ${scenes.length}장면 · ${formatSec(timeline.duration)} · 새 음성 ${made}개(${chars}자) / 전체 ${spoken.length}개`)
  if (has('--audio-only')) return

  // 2) 렌더
  const server = await serveFolder(audioDir)
  try {
    const audioUrls: Record<string, string> = {}
    for (const s of spoken) audioUrls[s.id] = `${server.base}/${encodeURIComponent(s.audioPath as string)}`
    const inputProps: LectureCompositionProps = { scenes, audioUrls, imageUrls: {}, subtitles: !has('--no-subtitles') }

    console.log('  Remotion 번들 만드는 중…')
    const serveUrl = await bundle({ entryPoint: path.resolve('remotion/index.ts') })
    const browser = browserOptions()
    const composition = await selectComposition({ serveUrl, id: LECTURE_COMPOSITION_ID, inputProps, ...(browser ?? {}) })

    const base = exportFileBase('lecture', title)
    const outputLocation = path.join(outDir, `${base}.mp4`)
    const concurrency = arg('--concurrency') ? Number(arg('--concurrency')) : null
    const started = Date.now()
    let lastPct = -1
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      audioCodec: 'aac',
      crf: 18,
      outputLocation,
      inputProps,
      concurrency,
      licenseKey: process.env.REMOTION_LICENSE_KEY || null,
      ...(browser ?? {}),
      onProgress: ({ progress, renderedFrames }) => {
        const pct = Math.floor(progress * 100)
        if (pct !== lastPct && pct % 5 === 0) {
          lastPct = pct
          console.log(`  렌더 ${pct}% (${renderedFrames}/${composition.durationInFrames} 프레임)`)
        }
      },
    })

    const point = { code: 'lecture', title, summary: null, categoryName: null }
    writeFileSync(path.join(outDir, `${base}.srt`), toSrt(timeline))
    writeFileSync(path.join(outDir, `${base}-설명문.txt`), buildYoutubeDescription(scenes, timeline, point))
    console.log(`✔ 완료 (${formatSec(Date.now() - started)} 걸림)`)
    console.log(`  ${outputLocation}`)
  } finally {
    server.close()
  }
}

main().catch((error) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
