// 대본 단계 — 강의 타이틀 → 문법 포인트 찾기 → AI 대본 → 영어 분리 → script.json + script-review.md

import { existsSync } from 'node:fs'
import { splitMixedSegments } from '../../../src/lib/lecture-pipeline/mixed'
import { parseLectureScript } from '../../../src/lib/lecture-pipeline/types'
import { layoutTimeline, formatClock, sentenceKey } from '../../../src/lib/lecture-pipeline/timing'
import { joinTokens } from '../../../src/lib/lecture-pipeline/types'
import { findGrammarScope, generateLectureScript, sanitizeSlug, type GrammarScope } from '../ai'
import { lectureDir, loadDict, paths, rel, writeScript } from '../common'

export interface ScriptOptions {
  minutes?: number
  pointCode?: string | null
  slug?: string | null
  force?: boolean
  noDb?: boolean
}

export async function runScript(title: string, opts: ScriptOptions = {}): Promise<string> {
  const minutes = opts.minutes && opts.minutes > 0 ? opts.minutes : 10
  const dict = loadDict()
  console.log(`▶ 대본 만들기: "${title}" (약 ${minutes}분)`)

  let scope: GrammarScope | null = null
  if (!opts.noDb) {
    try {
      scope = await findGrammarScope(title, opts.pointCode)
      console.log(scope ? `  문법학습관리 연결: ${scope.code} ${scope.title} (${scope.kind === 'point' ? '포인트' : '중분류'}, 원고 ${scope.sourceText ? '있음' : '없음'})` : '  ⚠ 맞는 문법 포인트를 찾지 못했어요 (--point 코드로 지정 가능)')
    } catch (e) {
      console.log(`  ⚠ DB에 연결하지 못해 원고 없이 만들어요: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
    }
  }

  const { script: generated, notes } = await generateLectureScript({ title, minutes, scope, dict, log: (m) => console.log(m) })

  // 폴더 이름(slug) — 이미 있으면 덮어쓰지 않고 -2, -3…
  let slug = sanitizeSlug(opts.slug ?? '') || generated.slug
  if (!opts.force) {
    const base = slug
    for (let n = 2; existsSync(lectureDir(slug)); n++) slug = `${base}-${n}`
  }

  const split = splitMixedSegments(generated.segments, dict)
  const parsed = parseLectureScript({ ...generated, slug, segments: split.segments })
  if (!parsed.script) throw new Error('영어 분리 후 대본 검증에 실패했어요. 다시 실행해 주세요.')
  const script = parsed.script

  // 예문 화면 문장을 영어 보이스가 그대로 읽는지 (단어 하이라이트 조건)
  const extra = [...notes, ...split.notes.map((n) => `${n.segmentId}: ${n.message}`)]
  for (const s of script.slides) {
    if (s.type !== 'example') continue
    const key = sentenceKey(joinTokens(s.data.sentence))
    const read = script.segments.some((g) => g.slideId === s.id && g.lang === 'en' && sentenceKey(g.text) === key)
    if (!read) extra.push(`${s.id}(예문): 화면 문장을 영어 세그먼트가 그대로 읽지 않아 단어 하이라이트가 안 돼요`)
  }

  writeScript(script, extra)
  const p = paths(slug)
  const est = layoutTimeline(script)
  console.log(`✔ 대본 완료 · 슬라이드 ${script.slides.length}장 · 세그먼트 ${script.segments.length}개 · 예상 ${formatClock(est.totalMs)}`)
  console.log(`  ${rel(p.script)}\n  ${rel(p.review)}  ← 이 파일을 읽고 검토하세요`)
  if (extra.length) console.log(`  확인할 점 ${extra.length}개 (script-review.md 맨 위)`)
  return slug
}
