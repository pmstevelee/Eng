// 숏폼 단계 — 본 강의의 일상회화 패턴마다 숏폼 1편
// runShortsScript: AI 대본 → shorts-NN-script.json + 검토 파일 + 유튜브 정보 (여기서 멈춤)
// runShortsRender: 음성(한국어 1.1배) + 발음 검수 → 1080×1920 mp4

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { findPatternGroups } from '../../../src/lib/lecture-pipeline/patterns'
import { buildScriptReview } from '../../../src/lib/lecture-pipeline/review'
import { SHORTS_LENGTH } from '../../../src/lib/lecture-pipeline/shorts'
import { formatClock, layoutTimeline } from '../../../src/lib/lecture-pipeline/timing'
import { formatIssues, parseLectureScript, type LectureScript } from '../../../src/lib/lecture-pipeline/types'
import { SHORTS_VIDEO_ID, type ShortsVideoProps } from '../../../src/components/lecture-video/props'
import { buildShortsYoutubeMd, generateShorts } from '../ai-social'
import { browserOptions, formatDuration, loadDict, readScript, rel, serveFolder, shortsPaths } from '../common'
import { getBundle } from './render'
import { runVoiceFor, type VoiceOptions } from './voice'

function writeShortsScript(slug: string, n: number, script: LectureScript, notes: string[]): void {
  const p = shortsPaths(slug, n)
  mkdirSync(p.dir, { recursive: true })
  writeFileSync(p.script, JSON.stringify(script, null, 2) + '\n')
  const review = buildScriptReview(script, loadDict(), notes)
    .replace(`lectures/${script.slug}/`, `lectures/${slug}/shorts/`)
    .replace(/`script\.json`/g, `\`${p.name}-script.json\``)
    .replace(/npm run voice -- [^\s`]+/g, `npm run shorts:render -- ${slug} --only ${n}`)
  writeFileSync(p.review, review)
}

function readShortsScript(slug: string, n: number): LectureScript {
  const p = shortsPaths(slug, n)
  let json: unknown
  try {
    json = JSON.parse(readFileSync(p.script, 'utf8'))
  } catch (e) {
    throw new Error(`${rel(p.script)}의 JSON 형식이 깨졌어요: ${e instanceof Error ? e.message : String(e)}`)
  }
  const { script, issues } = parseLectureScript(json)
  const warns = issues.filter((i) => i.level === 'warn')
  if (warns.length) console.log(formatIssues(warns).map((l) => `  ${l}`).join('\n'))
  if (!script) throw new Error(`${rel(p.script)}에 고칠 곳이 있어요:\n${formatIssues(issues.filter((i) => i.level === 'error')).join('\n')}`)
  return script
}

/** 이미 만든 숏폼 번호 목록 */
export function existingShorts(slug: string): number[] {
  const dir = shortsPaths(slug, 1).dir
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map((f) => f.match(/^shorts-(\d+)-script\.json$/)?.[1])
    .filter((x): x is string => !!x)
    .map(Number)
    .sort((a, b) => a - b)
}

export async function runShortsScript(slug: string, opts: { only?: number[] | null; force?: boolean } = {}): Promise<number[]> {
  const lecture = readScript(slug)
  const groups = findPatternGroups(lecture).filter((g) => !opts.only || opts.only.includes(g.index))
  if (findPatternGroups(lecture).length === 0) {
    throw new Error(`본 강의에 일상회화 패턴(pattern 슬라이드)이 없어요. 대본을 다시 만들 때 --patterns 1 이상으로 만들어 주세요.`)
  }
  console.log(`▶ 숏폼 대본: ${lecture.title} · 패턴 ${groups.length}개 → 숏폼 ${groups.length}편`)
  const made: number[] = []
  for (const g of groups) {
    const p = shortsPaths(slug, g.index)
    if (existsSync(p.script) && !opts.force) {
      console.log(`  ${p.name}: 이미 있어요 (고친 내용을 지키려고 건너뜀 — 새로 만들려면 --force). 검토 파일만 새로 고쳐 썼어요.`)
      writeShortsScript(slug, g.index, readShortsScript(slug, g.index), [])
      made.push(g.index)
      continue
    }
    console.log(`  ${p.name}: "${g.pattern.data.pattern}" 문구 쓰는 중…`)
    const { script, youtube, notes } = await generateShorts(lecture, g, (m) => console.log(m))
    writeShortsScript(slug, g.index, script, notes)
    writeFileSync(p.youtube, buildShortsYoutubeMd(script, youtube, p.name, lecture.title))
    console.log(`    예상 ${formatClock(layoutTimeline(script).totalMs)} · ${rel(p.review)}`)
    made.push(g.index)
  }
  console.log(`✔ 숏폼 대본 ${made.length}편 · 검토: lectures/${slug}/shorts/shorts-NN-review.md (고칠 곳은 shorts-NN-script.json)`)
  return made
}

export interface ShortsRenderOptions extends Pick<VoiceOptions, 'regenFailed' | 'regenIds' | 'force' | 'skipQa' | 'repeatBed' | 'bedDb'> {
  only?: number[] | null
  autoRetry?: number
  concurrency?: number | null
  /** 음성만 만들고 렌더하지 않기 */
  voiceOnly?: boolean
}

export async function runShortsRender(slug: string, opts: ShortsRenderOptions = {}): Promise<void> {
  const list = existingShorts(slug).filter((n) => !opts.only || opts.only.includes(n))
  if (!list.length) throw new Error(`숏폼 대본이 없어요. 먼저 npm run shorts -- ${slug}`)
  for (const n of list) {
    const p = shortsPaths(slug, n)
    const script = readShortsScript(slug, n)
    const { timeline, failed } = await runVoiceFor(
      {
        label: `${slug} ${p.name}`,
        script,
        saveScript: (s, notes) => writeShortsScript(slug, n, s, notes),
        files: { audioDir: p.audioDir, cleanDir: p.cleanDir, narration: p.narration, timeline: p.timeline, srt: p.srt, qa: p.qa },
        voiceCmd: `npm run shorts:render -- ${slug} --only ${n}`,
      },
      { autoRetry: opts.autoRetry ?? 1, regenFailed: opts.regenFailed, regenIds: opts.regenIds, force: opts.force, skipQa: opts.skipQa, repeatBed: opts.repeatBed, bedDb: opts.bedDb },
    )
    const sec = timeline.totalMs / 1000
    if (sec < SHORTS_LENGTH.minSec || sec > SHORTS_LENGTH.maxSec) {
      console.log(`  ⚠ ${p.name} 길이 ${sec.toFixed(1)}초 — 목표 ${SHORTS_LENGTH.minSec}~${SHORTS_LENGTH.maxSec}초를 벗어났어요. ${p.name}-script.json 한국어 문장을 ${sec < SHORTS_LENGTH.minSec ? '늘려' : '줄여'} 주세요.`)
    }
    if (failed) console.log(`  ⚠ 발음 검수 불합격 ${failed}개 — ${rel(p.qa)}`)
    if (opts.voiceOnly) continue

    const server = await serveFolder(p.dir)
    try {
      const final = readShortsScript(slug, n)
      const inputProps: ShortsVideoProps = { script: final, timeline, audioUrl: `${server.base}/${p.name}-narration.wav?v=${statSync(p.narration).mtimeMs}` }
      const serveUrl = await getBundle()
      const browser = browserOptions()
      const composition = await selectComposition({ serveUrl, id: SHORTS_VIDEO_ID, inputProps, ...browser })
      console.log(`▶ 숏폼 렌더: ${p.name} · ${formatDuration((composition.durationInFrames / composition.fps) * 1000)} · 1080×1920`)
      const started = Date.now()
      let lastPct = -1
      await renderMedia({
        composition, serveUrl, codec: 'h264', audioCodec: 'aac', crf: 18, jpegQuality: 100, pixelFormat: 'yuv420p',
        outputLocation: p.mp4, inputProps, concurrency: opts.concurrency ?? null, licenseKey: process.env.REMOTION_LICENSE_KEY || null, ...browser,
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 100)
          if (pct !== lastPct && pct % 10 === 0) {
            lastPct = pct
            console.log(`  렌더 ${pct}%`)
          }
        },
      })
      console.log(`  ✔ ${rel(p.mp4)} (${formatDuration(Date.now() - started)} 걸림) · 업로드 정보 ${rel(p.youtube)}`)
    } finally {
      server.close()
    }
  }
}
