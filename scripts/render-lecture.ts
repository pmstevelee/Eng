/**
 * scripts/render-lecture.ts
 * AI 강의 영상을 관리자 PC에서 Remotion으로 MP4 렌더 (H.264/AAC 1920×1080 30fps).
 * 운영 DB에서 스크립트를 읽고 Storage 음성·배경 그림을 서명 URL로 받아 렌더한다 (DB에는 쓰지 않음).
 *
 *   npm run lecture:render -- <스크립트 id | 포인트 코드>
 *   예) npm run lecture:render -- G06-01-01        포인트의 최근 스크립트
 *       npm run lecture:render -- f8c0ac73-...      스크립트 지정
 *   옵션:
 *     --out <폴더>           저장 폴더 (기본 out/lectures)
 *     --no-subtitles         영상에 자막을 넣지 않음 (SRT는 따로 나옴)
 *     --concurrency <n>      동시에 그릴 프레임 수 (기본: CPU 절반)
 *     --allow-missing-audio  음성이 없거나 오래된 문장이 있어도 소리 없이 렌더
 *     --bundled-chrome       Mac에서도 설치된 Chrome 대신 Remotion 전용 Chrome 사용
 *
 * Mac은 설치된 Google Chrome으로 렌더한다 (Remotion 전용 headless Chrome이 일부 Intel Mac에서
 * GPU 프로세스 오류로 바로 꺼짐 — 2026-10 확인). 다른 경로는 REMOTION_BROWSER_EXECUTABLE로 지정.
 * 그 외에는 처음 실행할 때 Remotion이 렌더용 Chrome(headless shell)을 내려받는다.
 * Remotion 라이선스: 직원 4명 이상 회사는 회사 라이선스 필요 (REMOTION_LICENSE_KEY가 있으면 함께 보냄).
 */

import * as dotenv from 'dotenv'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { PrismaClient } from '../src/generated/prisma'
import { parseVideoScenes, formatVideoSceneErrors } from '../src/types/grammar-video'
import { resolveAudioVoices } from '../src/lib/grammar/elevenlabs'
import { isSpokenSegment, segmentAudioState } from '../src/lib/grammar/video/audio-plan'
import { referencedImagePaths } from '../src/lib/grammar/video/image-plan'
import { buildTimeline, toSrt } from '../src/lib/grammar/video/timeline'
import { buildYoutubeDescription, exportFileBase } from '../src/lib/grammar/video/export/youtube-text'
import { signLectureAudioUrls } from '../src/lib/grammar/lecture-audio-storage'
import {
  LECTURE_COMPOSITION_ID,
  type LectureCompositionProps,
} from '../src/components/grammar/video/remotion/composition-props'

dotenv.config({ path: '.env.local' })
dotenv.config()

/** 렌더가 길어져도 음성·그림 주소가 만료되지 않게 2시간 */
const URL_TTL_SEC = 60 * 60 * 2

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const has = (name: string) => args.includes(name)
function arg(name: string): string | null {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] ?? null : null
}
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--concurrency'].includes(args[i - 1])))

const scriptSelect = {
  id: true,
  title: true,
  status: true,
  scenesJson: true,
  koVoiceId: true,
  enVoiceId: true,
  grammarPoint: { select: { code: true, title: true, summary: true, category: { select: { name: true } } } },
} as const

async function findScript(key: string) {
  const byId = await prisma.grammarLectureScript.findUnique({ where: { id: key }, select: scriptSelect }).catch(() => null)
  if (byId) return byId
  // 포인트 코드면 그 포인트의 최근 스크립트 (YouTube 연결·음성 완료를 먼저)
  const list = await prisma.grammarLectureScript.findMany({
    where: { grammarPoint: { code: key } },
    orderBy: { updatedAt: 'desc' },
    select: scriptSelect,
  })
  const rank = (s: string) => (s === 'LINKED' ? 0 : s === 'AUDIO_READY' ? 1 : 2)
  return list.sort((a, b) => rank(a.status) - rank(b.status))[0] ?? null
}

/** 렌더에 쓸 브라우저 — null이면 Remotion 기본(headless shell) */
function browserOptions(): { browserExecutable: string; chromeMode: 'chrome-for-testing' } | null {
  const custom = process.env.REMOTION_BROWSER_EXECUTABLE
  if (custom) return { browserExecutable: custom, chromeMode: 'chrome-for-testing' }
  if (process.platform === 'darwin' && !has('--bundled-chrome') && existsSync(MAC_CHROME)) {
    return { browserExecutable: MAC_CHROME, chromeMode: 'chrome-for-testing' }
  }
  return null
}

function formatSec(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`
}

async function main() {
  if (!target) {
    console.log('사용법: npm run lecture:render -- <스크립트 id | 포인트 코드> [--out 폴더] [--no-subtitles] [--allow-missing-audio]')
    process.exitCode = 1
    return
  }

  const script = await findScript(target)
  if (!script) throw new Error(`"${target}" 스크립트를 찾을 수 없습니다. 스크립트 id나 포인트 코드를 확인해 주세요.`)
  const parsed = parseVideoScenes(script.scenesJson)
  if (!parsed.ok) {
    throw new Error(`장면에 오류가 있습니다. 관리자 화면에서 고쳐 주세요.\n${formatVideoSceneErrors(parsed.errors).join('\n')}`)
  }
  const scenes = parsed.scenes
  const timeline = buildTimeline(scenes)
  console.log(`▶ ${script.grammarPoint.code} "${script.title}" (${script.status}) · ${scenes.length}장면 · ${formatSec(timeline.duration)}`)

  // 음성 확인 — 모든 문장이 최신 음성이어야 한다
  const voices = resolveAudioVoices(script.koVoiceId, script.enVoiceId)
  const spoken = scenes.flatMap((s) => s.segments).filter(isSpokenSegment)
  const notReady = spoken.filter((s) => !voices || segmentAudioState(s, voices) !== 'ready')
  if (notReady.length > 0 && !has('--allow-missing-audio')) {
    throw new Error(
      `음성이 없거나 문장이 바뀐 세그먼트가 ${notReady.length}개 있습니다. 관리자 화면 음성 단계에서 먼저 만들어 주세요.\n` +
        '(소리 없이 렌더하려면 --allow-missing-audio)',
    )
  }
  const readySegments = spoken.filter((s) => s.audioPath && voices && segmentAudioState(s, voices) === 'ready')
  const imagePaths = Array.from(referencedImagePaths(scenes))
  const signed = await signLectureAudioUrls([...readySegments.map((s) => s.audioPath as string), ...imagePaths], URL_TTL_SEC)

  const audioUrls: Record<string, string> = {}
  for (const s of readySegments) {
    const url = signed.get(s.audioPath as string)
    if (url) audioUrls[s.id] = url
  }
  const imageUrls: Record<string, string> = {}
  for (const p of imagePaths) {
    const url = signed.get(p)
    if (url) imageUrls[p] = url
  }
  console.log(`  음성 ${Object.keys(audioUrls).length}/${spoken.length}개 · 배경 그림 ${Object.keys(imageUrls).length}/${imagePaths.length}개`)

  const inputProps: LectureCompositionProps = { scenes, audioUrls, imageUrls, subtitles: !has('--no-subtitles') }

  console.log('  Remotion 번들 만드는 중…')
  const serveUrl = await bundle({ entryPoint: path.resolve('remotion/index.ts') })
  const browser = browserOptions()
  if (browser) console.log(`  브라우저: ${browser.browserExecutable}`)
  const composition = await selectComposition({ serveUrl, id: LECTURE_COMPOSITION_ID, inputProps, ...(browser ?? {}) })

  const outDir = path.resolve(arg('--out') ?? 'out/lectures')
  mkdirSync(outDir, { recursive: true })
  const point = {
    code: script.grammarPoint.code,
    title: script.grammarPoint.title,
    summary: script.grammarPoint.summary,
    categoryName: script.grammarPoint.category?.name ?? null,
  }
  const base = exportFileBase(point.code, script.title)
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

  writeFileSync(path.join(outDir, `${base}.srt`), toSrt(timeline))
  writeFileSync(path.join(outDir, `${base}-설명문.txt`), buildYoutubeDescription(scenes, timeline, point))
  console.log(`✔ 완료 (${formatSec(Date.now() - started)} 걸림)`)
  console.log(`  ${outputLocation}`)
  console.log(`  ${path.join(outDir, `${base}.srt`)}`)
  console.log(`  ${path.join(outDir, `${base}-설명문.txt`)}`)
}

main()
  .catch((error) => {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
