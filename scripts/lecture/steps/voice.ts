// 음성 단계 — 세그먼트별 TTS → 무음 정리·음량 맞춤 → Whisper 발음 검수(→ 다시 만들기) → 쉼 넣어 합치기 → -16 LUFS
// 결과: audio/{id}.mp3(+.json), audio/clean/{id}.wav, narration.wav, timeline.json, subtitles.srt, qa-report.md

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { compileNormalizer } from '../../../src/lib/lecture-pipeline/normalize'
import { splitMixedSegments } from '../../../src/lib/lecture-pipeline/mixed'
import { alignmentToWords, compareTranscript, shiftWords } from '../../../src/lib/lecture-pipeline/qa'
import { buildCues, formatClock, layoutTimeline, toSrt, type TimedWord, type Timeline } from '../../../src/lib/lecture-pipeline/timing'
import { parseLectureScript, type LectureScript, type Segment } from '../../../src/lib/lecture-pipeline/types'
import { addBed, applyGain, BED_MAX_DB, decodeToPcm, fadeEdges, levelGain, loudnormFile, mixdown, samplesToMs, trimSilence, writeWav, type BedKind } from '../audio'
import { formatDuration, loadDict, mapLimit, paths, readScript, rel, writeScript } from '../common'
import { audioHash, createTtsProvider, type TtsAlignment, type TtsProvider, type VoiceVariant } from '../tts'
import { transcribe } from '../whisper'

interface QaResult {
  hash: string
  transcript: string
  errorRate: number
  threshold: number
  passed: boolean
  unit: string
  words?: TimedWord[]
}

interface AudioMeta {
  id: string
  hash: string
  lang: 'ko' | 'en'
  text: string
  spokenText: string
  provider: string
  model: string
  voice: string
  file: string
  seed?: number
  createdAt: string
  alignment?: TtsAlignment
  qa?: QaResult
}

export interface VoiceOptions {
  /** 다시 만들 세그먼트 id (기존 음성 무시) */
  regenIds?: string[]
  /** 지난 검수에서 불합격한 세그먼트를 다시 만들기 */
  regenFailed?: boolean
  /** 모든 세그먼트 다시 만들기 */
  force?: boolean
  /** 검수 불합격 세그먼트를 자동으로 다시 만들어 볼 횟수 */
  autoRetry?: number
  skipQa?: boolean
  /** 따라하기 대기 구간 배경음 (기본 off, env LECTURE_REPEAT_BED) */
  repeatBed?: BedKind
  /** 배경음 크기 dBFS (기본 -34, -30보다 크게는 안 됨) */
  bedDb?: number
}

/** 음성을 만들 대상 — 본 강의(lectures/{slug}/) 또는 숏폼(lectures/{slug}/shorts/) */
export interface VoiceTarget {
  /** 화면에 보일 이름 (예: "present-perfect", "present-perfect 숏폼 1") */
  label: string
  script: LectureScript
  saveScript: (script: LectureScript, notes: string[]) => void
  files: { audioDir: string; cleanDir: string; narration: string; timeline: string; srt: string; qa: string }
  /** 다시 만들기 안내에 쓸 명령 (예: "npm run voice -- present-perfect") */
  voiceCmd: string
}

/** 배경음 옵션 해석 — CLI 값 > env LECTURE_REPEAT_BED > off */
export function resolveBed(value?: string | null): BedKind {
  const v = (value ?? process.env.LECTURE_REPEAT_BED ?? 'off').trim().toLowerCase()
  if (v === 'pad' || v === 'noise' || v === 'off') return v
  throw new Error(`배경음 옵션 "${v}"는 없어요 (off | pad | noise)`)
}

interface Clean {
  durationMs: number
  words?: TimedWord[]
}

const metaPath = (dir: string, id: string) => path.join(dir, `${id}.json`)

function readMeta(dir: string, id: string): AudioMeta | null {
  const p = metaPath(dir, id)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as AudioMeta
  } catch {
    return null
  }
}

const pipeEscape = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

export async function runVoice(slug: string, opts: VoiceOptions = {}): Promise<{ failed: number; timeline: Timeline }> {
  const p = paths(slug)
  return runVoiceFor(
    {
      label: slug,
      script: readScript(slug),
      saveScript: writeScript,
      files: { audioDir: p.audioDir, cleanDir: p.cleanDir, narration: p.narration, timeline: p.timeline, srt: p.srt, qa: p.qa },
      voiceCmd: `npm run voice -- ${slug}`,
    },
    opts,
  )
}

export async function runVoiceFor(target: VoiceTarget, opts: VoiceOptions = {}): Promise<{ failed: number; timeline: Timeline; script: LectureScript }> {
  const p = target.files
  const dict = loadDict()
  const normalize = compileNormalizer(dict)
  let script = target.script

  // 1) 한국어 문장 속 영어를 영어 세그먼트로 분리 (대본에 반영)
  const split = splitMixedSegments(script.segments, dict)
  if (split.changed > 0) {
    const parsed = parseLectureScript({ ...script, segments: split.segments })
    if (!parsed.script) throw new Error('영어 분리 후 대본 검증에 실패했어요. script.json을 확인해 주세요.')
    script = parsed.script
    target.saveScript(script, split.notes.map((n) => `${n.segmentId}: ${n.message}`))
    console.log(`  한국어 문장 속 영어를 분리했어요 (${split.changed}개 세그먼트 → 대본·검토 파일 갱신)`)
  }

  const provider = createTtsProvider()
  const hasDialogue = script.segments.some((s) => s.speaker)
  console.log(
    `▶ 음성 (${target.label}): ${provider.id} · ${provider.model} · 한국어 ${provider.voice('ko')} / 영어 ${provider.voice('en')}` +
      (hasDialogue ? ` · 대화 A(남) ${provider.voice('en', 'A')} / B(여) ${provider.voice('en', 'B')}` : ''),
  )
  mkdirSync(p.cleanDir, { recursive: true })

  const tempo = script.tempo
  /** 세그먼트 속도·화자 — 세그먼트 speed > 숏폼 박자(한국어 배수·영어 속도) > 기본 */
  const variantOf = (s: Segment): VoiceVariant | undefined => {
    const speed =
      s.speed ?? (s.lang === 'ko' && tempo?.koSpeedScale ? provider.baseSpeed('ko') * tempo.koSpeedScale : s.lang === 'en' && tempo?.enSpeed ? tempo.enSpeed : undefined)
    const v: VoiceVariant = { ...(speed ? { speed: Math.round(speed * 100) / 100 } : {}), ...(s.speaker ? { speaker: s.speaker } : {}) }
    return Object.keys(v).length ? v : undefined
  }
  /**
   * 공급자가 속도 설정을 무시하면(eleven_v4) 만든 뒤 빠르기를 바꾼다 — 원래 음성은 자연 속도(1.0)이므로
   * 따라하기는 speed 그대로(0.85), 숏폼 한국어는 배수 그대로(1.1). 속도를 따로 정하지 않은 세그먼트는 그대로 둔다.
   */
  const stretchOf = (s: Segment): number => {
    if (provider.appliesSpeed) return 1
    return s.speed ?? (s.lang === 'ko' ? tempo?.koSpeedScale : tempo?.enSpeed) ?? 1
  }
  if (!provider.appliesSpeed && script.segments.some((s) => stretchOf(s) !== 1)) {
    console.log(`  ${provider.model}는 속도 설정을 쓰지 않아 ffmpeg로 빠르기를 맞춰요 (음 높이 그대로)`)
  }
  const spoken = script.segments.filter((s) => !s.waitSec && s.text)
  const spokenText = new Map(spoken.map((s) => [s.id, normalize(s.text, s.lang)]))
  const hashOf = (s: Segment) => audioHash(provider, s.lang, s.emotion, spokenText.get(s.id) ?? '', variantOf(s))
  const metas = new Map<string, AudioMeta | null>(spoken.map((s) => [s.id, readMeta(p.audioDir, s.id)]))

  const regen = new Set(opts.regenIds ?? [])
  if (opts.regenFailed) for (const [id, m] of Array.from(metas)) if (m?.qa && !m.qa.passed) regen.add(id)
  const unknown = Array.from(regen).filter((id) => !metas.has(id))
  if (unknown.length) console.log(`  ⚠ 없는 세그먼트 id: ${unknown.join(', ')}`)

  const needs = spoken.filter((s) => {
    const m = metas.get(s.id)
    return opts.force || regen.has(s.id) || !m || m.hash !== hashOf(s) || !existsSync(path.join(p.audioDir, m.file))
  })

  // 2) TTS — 같은 슬라이드·같은 언어 앞뒤 문장을 문맥으로 넘겨 억양을 자연스럽게
  let charsUsed = 0
  const neighbor = (s: Segment, dir: -1 | 1): string | undefined => {
    const i = script.segments.indexOf(s) + dir
    const n = script.segments[i]
    // 같은 화자·같은 종류만 문맥으로 (대화 상대 말·속도가 다른 따라하기는 넘기지 않음)
    return n && n.slideId === s.slideId && n.lang === s.lang && n.text && n.speaker === s.speaker && n.type === s.type && n.speed === s.speed ? spokenText.get(n.id) : undefined
  }
  const synth = async (s: Segment, seed?: number, targetFile?: string): Promise<AudioMeta> => {
    const text = spokenText.get(s.id) ?? ''
    const res = await provider.synthesize({ text, lang: s.lang, emotion: s.emotion, previousText: neighbor(s, -1), nextText: neighbor(s, 1), seed, ...variantOf(s) })
    charsUsed += text.length
    const file = targetFile ?? `${s.id}.${res.ext}`
    mkdirSync(p.audioDir, { recursive: true })
    writeFileSync(path.join(p.audioDir, file), res.audio)
    return {
      id: s.id, hash: hashOf(s), lang: s.lang, text: s.text, spokenText: text,
      provider: provider.id, model: provider.model, voice: provider.voice(s.lang, s.speaker), file,
      ...(seed !== undefined ? { seed } : {}), createdAt: new Date().toISOString(),
      ...(res.alignment ? { alignment: res.alignment } : {}),
    }
  }

  if (needs.length) {
    console.log(`  음성 만들기 ${needs.length}개 (기존 ${spoken.length - needs.length}개 재사용)`)
    let done = 0
    await mapLimit(needs, 3, async (s) => {
      const seed = regen.has(s.id) || opts.force ? Math.floor(Math.random() * 1e9) : undefined
      const meta = await synth(s, seed)
      writeFileSync(metaPath(p.audioDir, s.id), JSON.stringify(meta, null, 2))
      metas.set(s.id, meta)
      done++
      if (done % 10 === 0 || done === needs.length) console.log(`    ${done}/${needs.length}`)
    })
  } else console.log(`  음성 ${spoken.length}개 모두 최신이에요 (다시 만들지 않음)`)

  // 3) 무음 정리·음량 맞춤
  const clean = new Map<string, Clean>()
  const processOne = async (s: Segment) => {
    const meta = metas.get(s.id) as AudioMeta
    const tempo = stretchOf(s)
    const pcm = await decodeToPcm(path.join(p.audioDir, meta.file), { tempo })
    const { start, end } = trimSilence(pcm)
    const cut = pcm.subarray(start, end)
    const out = fadeEdges(applyGain(cut, levelGain(cut)))
    writeWav(path.join(p.cleanDir, `${s.id}.wav`), out)
    const durationMs = samplesToMs(out.length)
    // 빠르기를 바꿨으면 글자 시간도 같은 비율로
    const scale = (list: number[]) => list.map((t) => t / tempo)
    const words = meta.alignment
      ? shiftWords(alignmentToWords(meta.alignment.chars, scale(meta.alignment.starts), scale(meta.alignment.ends)), samplesToMs(start), durationMs)
      : undefined
    clean.set(s.id, { durationMs, words })
  }
  await mapLimit(spoken, 4, processOne)

  // 4) 발음 검수
  const check = async (s: Segment): Promise<QaResult> => {
    const meta = metas.get(s.id) as AudioMeta
    const t = await transcribe(path.join(p.cleanDir, `${s.id}.wav`), s.lang)
    const r = compareTranscript([spokenText.get(s.id) ?? s.text, s.text], t.text, s.lang)
    return { hash: meta.hash + (meta.seed ?? ''), transcript: t.text, ...r, ...(t.words ? { words: t.words } : {}) }
  }
  const qaKey = (m: AudioMeta) => m.hash + (m.seed ?? '')
  if (!opts.skipQa) {
    const todo = spoken.filter((s) => {
      const m = metas.get(s.id) as AudioMeta
      return !m.qa || m.qa.hash !== qaKey(m)
    })
    console.log(`  발음 검수 (Whisper) ${todo.length}개${todo.length < spoken.length ? ` (나머지 ${spoken.length - todo.length}개는 지난 결과 사용)` : ''}`)
    await mapLimit(todo, 4, async (s) => {
      const meta = metas.get(s.id) as AudioMeta
      meta.qa = await check(s)
      writeFileSync(metaPath(p.audioDir, s.id), JSON.stringify(meta, null, 2))
    })

    // 5) 불합격 세그먼트 자동 다시 만들기 — 더 나은 결과만 남긴다
    for (let round = 1; round <= (opts.autoRetry ?? 0); round++) {
      const failed = spoken.filter((s) => !(metas.get(s.id) as AudioMeta).qa?.passed)
      if (failed.length === 0) break
      console.log(`  검수 불합격 ${failed.length}개 다시 만들기 (${round}회차)`)
      await mapLimit(failed, 3, async (s) => {
        const old = metas.get(s.id) as AudioMeta
        const tmpFile = `${s.id}.retry.mp3`
        const fresh = await synth(s, Math.floor(Math.random() * 1e9), tmpFile)
        const backupClean = path.join(p.cleanDir, `${s.id}.wav`)
        copyFileSync(backupClean, `${backupClean}.bak`)
        metas.set(s.id, fresh)
        await processOne(s)
        fresh.qa = await check(s)
        if ((fresh.qa.errorRate ?? 1) < (old.qa?.errorRate ?? 1)) {
          renameSync(path.join(p.audioDir, tmpFile), path.join(p.audioDir, old.file))
          fresh.file = old.file
          writeFileSync(metaPath(p.audioDir, s.id), JSON.stringify(fresh, null, 2))
          rmSync(`${backupClean}.bak`)
        } else {
          rmSync(path.join(p.audioDir, tmpFile))
          renameSync(`${backupClean}.bak`, backupClean)
          metas.set(s.id, old)
          await processOne(s)
        }
      })
    }
  }

  // 6) 타임라인 → 이어 붙이기 → -16 LUFS
  const durations = new Map<string, number>()
  const words = new Map<string, TimedWord[]>()
  for (const s of spoken) {
    const c = clean.get(s.id) as Clean
    durations.set(s.id, c.durationMs)
    const w = c.words ?? (s.lang === 'en' ? (metas.get(s.id) as AudioMeta).qa?.words : undefined)
    if (w?.length) words.set(s.id, w)
  }
  for (const s of script.segments) if (s.waitSec) durations.set(s.id, s.waitSec * 1000)
  const timeline = layoutTimeline(script, durations, words)

  const clips = await Promise.all(
    timeline.segments.filter((t) => !t.wait).map(async (t) => ({ startMs: t.startMs, pcm: await decodeToPcm(path.join(p.cleanDir, `${t.id}.wav`)) })),
  )
  const rawTrack = path.join(p.audioDir, 'track-raw.wav')
  writeWav(rawTrack, mixdown(timeline.totalMs, clips))
  const loud = await loudnormFile(rawTrack, p.narration)
  rmSync(rawTrack)

  // 따라하기 대기 구간 배경음 — 음량을 맞춘 뒤에 얹어 크기가 정확히 유지되게
  const bed = opts.repeatBed ?? 'off'
  const pauses = timeline.segments.filter((t) => t.pauseEndMs).map((t) => ({ startMs: t.endMs + 150, endMs: (t.pauseEndMs as number) - 100 }))
  if (bed !== 'off' && pauses.length) {
    const db = Math.min(opts.bedDb ?? -34, BED_MAX_DB)
    writeWav(p.narration, addBed(await decodeToPcm(p.narration), pauses, bed, db))
    console.log(`  따라하기 대기 ${pauses.length}곳에 배경음(${bed}, ${db}dBFS)을 깔았어요`)
  }

  const finalTimeline: Timeline = { ...timeline, audioFile: 'narration.wav', loudnessLufs: loud.after, provider: `${provider.id}/${provider.model}` }
  writeFileSync(p.timeline, JSON.stringify(finalTimeline, null, 2))
  writeFileSync(p.srt, toSrt(buildCues(script, finalTimeline)))

  const failedSegs = opts.skipQa ? [] : spoken.filter((s) => !(metas.get(s.id) as AudioMeta).qa?.passed)
  writeFileSync(p.qa, buildQaReport(script, provider, metas, spokenText, finalTimeline, loud, charsUsed, !!opts.skipQa, target.voiceCmd))

  console.log(`✔ 음성 완료 · 길이 ${formatDuration(finalTimeline.totalMs)} · 음량 ${loud.before.toFixed(1)} → ${loud.after.toFixed(1)} LUFS · 이번에 쓴 글자 ${charsUsed}자`)
  console.log(`  ${rel(p.narration)}\n  ${rel(p.srt)}\n  ${rel(p.qa)}`)
  if (failedSegs.length) {
    console.log(`  ⚠ 발음 검수 불합격 ${failedSegs.length}개: ${failedSegs.map((s) => s.id).join(', ')}`)
    console.log(`    들어 보고 다시 만들려면: ${target.voiceCmd} --regen-failed`)
  }
  return { failed: failedSegs.length, timeline: finalTimeline, script }
}

function buildQaReport(
  script: LectureScript,
  provider: TtsProvider,
  metas: Map<string, AudioMeta | null>,
  spokenText: Map<string, string>,
  timeline: Timeline,
  loud: { before: number; after: number },
  charsUsed: number,
  skipped: boolean,
  voiceCmd: string,
): string {
  const rows = script.segments.filter((s) => !s.waitSec && s.text)
  const failed = rows.filter((s) => !metas.get(s.id)?.qa?.passed)
  const startById = new Map(timeline.segments.map((t) => [t.id, t.startMs]))
  const line = (s: Segment) => {
    const qa = metas.get(s.id)?.qa
    const spoken = spokenText.get(s.id) ?? s.text
    const original = spoken !== s.text ? `${pipeEscape(s.text)}<br>(읽기: ${pipeEscape(spoken)})` : pipeEscape(s.text)
    const rate = qa ? `${Math.round(qa.errorRate * 100)}% (${qa.unit}, 기준 ${Math.round(qa.threshold * 100)}%)` : '-'
    const lang = s.speaker ? `🇺🇸${s.speaker}` : s.type === 'repeat' ? `🇺🇸🎤${s.speed ?? ''}` : s.lang === 'ko' ? '🇰🇷' : '🇺🇸'
    return `| \`${s.id}\` | ${formatClock(startById.get(s.id) ?? 0)} | ${lang} | ${original} | ${qa ? pipeEscape(qa.transcript) : '-'} | ${rate} | ${qa ? (qa.passed ? '✅' : '❌') : '-'} |`
  }
  const head = '| 세그먼트 | 시간 | 언어 | 원문 | 받아쓰기(Whisper) | 오류율 | 결과 |\n|---|---|---|---|---|---|---|'
  const out = [
    `# 발음 검수 리포트 — ${script.title}`,
    '',
    `- 음성: ${provider.id} · ${provider.model} · 한국어 보이스 \`${provider.voice('ko')}\` · 영어 보이스 \`${provider.voice('en')}\`` +
      (script.segments.some((s) => s.speaker) ? ` · 대화 A(남) \`${provider.voice('en', 'A')}\` / B(여) \`${provider.voice('en', 'B')}\`` : ''),
    `- 길이: ${formatClock(timeline.totalMs)} · 음량: ${loud.before.toFixed(1)} → **${loud.after.toFixed(1)} LUFS** (목표 -16)`,
    `- 이번 실행에서 만든 음성 글자 수: ${charsUsed}자`,
    skipped ? '- ⚠ 이번에는 발음 검수를 건너뛰었어요 (--skip-qa)' : `- 검수: ${rows.length}개 중 **${rows.length - failed.length}개 합격**, ${failed.length}개 확인 필요`,
    '',
    '> 오류율은 Whisper 받아쓰기와 원문의 차이예요. 한국어는 글자, 영어는 단어 기준으로 셉니다.',
    '> Whisper도 틀릴 수 있으니 ❌는 **직접 들어 보고** 이상할 때만 다시 만드세요.',
    `> 다시 만들기: \`${voiceCmd} --regen-failed\` 또는 \`--regen 세그먼트id,세그먼트id\``,
    '> 음성 파일 위치: `audio/clean/세그먼트id.wav`',
    '',
  ]
  if (failed.length && !skipped) out.push('## 확인이 필요한 세그먼트', '', head, ...failed.map(line), '')
  out.push('## 전체 세그먼트', '', head, ...rows.map(line), '')
  return out.join('\n')
}
