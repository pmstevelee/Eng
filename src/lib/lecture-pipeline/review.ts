// 사람이 읽기 좋은 대본 (script-review.md) — 슬라이드별 화면 내용과 읽을 문장을 순서대로 보여 준다.

import { compileNormalizer, type PronunciationDict } from './normalize'
import { layoutTimeline, formatClock, REPEAT_PAUSE } from './timing'
import { SLIDE_TYPE_LABELS, WEBSITE, type LectureScript, type Slide, type Token } from './types'

const EMOJI = { ko: '🇰🇷', en: '🇺🇸' } as const

function tokenText(tokens: Token[]): string {
  return tokens.map((t) => (t.point ? `__${t.text}__` : t.text)).join(' ').replace(/\s+([.,!?])/g, '$1')
}

function screenLines(slide: Slide): string[] {
  switch (slide.type) {
    case 'title': return [`제목: **${slide.data.title}**`, ...(slide.data.subtitle ? [`부제: ${slide.data.subtitle}`] : [])]
    case 'goal': return slide.data.goals.map((g, i) => `${i + 1}. ☐ ${g}`)
    case 'concept': return [`**${slide.data.heading}**`, ...slide.data.lines.map((l, i) => `${i + 1}. ${l}`)]
    case 'formula': return [
      slide.data.blocks.map((b, i) => `[${i + 1}:${b.text}]`).join(' + '),
      ...(slide.data.example ? [`예: ${tokenText(slide.data.example)}${slide.data.exampleKo ? ` — ${slide.data.exampleKo}` : ''}`] : []),
    ]
    case 'example': return [`1. ${tokenText(slide.data.sentence)}`, `2. ${slide.data.ko}${slide.data.note ? ` / ${slide.data.note}` : ''}`]
    case 'compare': return slide.data.rows.map((r, i) => `${i + 1}. ${r.correct ? '⭕' : '❌'} ${tokenText(r.sentence)}${r.ko ? ` — ${r.ko}` : ''}`)
    case 'mistake': return [`1. ❌ ~~${slide.data.wrong}~~`, `2. ✅ ${tokenText(slide.data.right)}`, `3. 이유: ${slide.data.why}`]
    case 'quiz': return [
      `Q. ${slide.data.question}`,
      ...(slide.data.sentence ? [`   ${slide.data.sentence}`] : []),
      ...slide.data.choices.map((c, i) => `   ${String.fromCharCode(65 + i)}. ${c}${i === slide.data.answer ? '  ← 정답(1단계에 공개)' : ''}`),
      ...(slide.data.explanation ? [`   해설: ${slide.data.explanation}`] : []),
    ]
    case 'summary': return slide.data.points.map((p, i) => `${i + 1}. ${p}`)
    case 'outro': return [slide.data.message ? slide.data.message : '구독·좋아요 안내', ...(slide.data.next ? [`1. 다음 강의: ${slide.data.next}`] : [])]
    case 'pattern': return [
      `1. 패턴: **${slide.data.pattern.replace(/~+/g, `[${slide.data.slot ?? '~'}]`)}**`,
      `2. 의미: ${slide.data.ko}${slide.data.tip ? ` / ${slide.data.tip}` : ''}`,
      ...(slide.data.examples ?? []).map((e, i) => `${i + 3}. ${e.en} — ${e.ko}`),
    ]
    case 'dialogue': return [
      ...(slide.data.situation ? [`상황: ${slide.data.situation}`] : []),
      ...slide.data.lines.map((l, i) => `${i + 1}. ${l.speaker === 'A' ? '🧑 A' : '👩 B'}: ${l.en}${l.ko ? ` — ${l.ko}` : ''}`),
    ]
    case 'repeat': return [
      `문장: **${slide.data.sentence}** — ${slide.data.ko}`,
      ...(slide.data.stress?.length ? [`강세(굵게): ${slide.data.stress.join(', ')}`] : []),
      ...(slide.data.links?.length ? [`연음(밑줄): ${slide.data.links.map((l) => `${l.text} → ${l.hint}`).join(', ')}`] : []),
    ]
    case 'hook': return [`훅: **${slide.data.question}**`, ...(slide.data.sub ? [slide.data.sub] : [])]
    case 'examples': return slide.data.examples.map((e, i) => `${i + 1}. ${e.en} — ${e.ko}`)
    case 'cta': return [slide.data.message || WEBSITE.cta, `본 강의: ${slide.data.lectureTitle}`]
  }
}

function segmentBadge(seg: LectureScript['segments'][number], tempo: LectureScript['tempo']): string {
  if (seg.type === 'pattern') return '🔤패턴 '
  if (seg.type === 'dialogue') return seg.speaker === 'A' ? '🧑A(남) ' : '👩B(여) '
  if (seg.type === 'repeat') {
    const rule = tempo?.repeatPause ?? REPEAT_PAUSE
    const auto = `길이×${rule.factor}${rule.extraSec ? `+${rule.extraSec}초` : ''}`
    return `🎤따라하기 ${seg.speed ?? 1}배${seg.pauseSec !== undefined ? ` · 대기 ${seg.pauseSec}초` : ` · 대기 자동(${auto})`} `
  }
  return seg.speed ? `${seg.speed}배 ` : ''
}

export function buildScriptReview(script: LectureScript, dict: PronunciationDict, notes: string[] = []): string {
  const normalize = compileNormalizer(dict)
  const timeline = layoutTimeline(script)
  const startById = new Map(timeline.slides.map((s) => [s.id, s.startMs]))
  const koChars = script.segments.filter((s) => s.lang === 'ko').reduce((a, s) => a + normalize(s.text, 'ko').length, 0)
  const enChars = script.segments.filter((s) => s.lang === 'en').reduce((a, s) => a + normalize(s.text, 'en').length, 0)

  const out: string[] = []
  out.push(`# ${script.title} — 대본 검토`)
  out.push('')
  out.push(`- 폴더: \`lectures/${script.slug}/\``)
  out.push(`- 문법 포인트: ${script.grammarPoint ? `${script.grammarPoint.code} ${script.grammarPoint.title}` : '(연결 안 됨)'}`)
  out.push(`- 슬라이드 ${script.slides.length}장 · 세그먼트 ${script.segments.length}개 · 예상 길이 약 ${formatClock(timeline.totalMs)} (목표 ${script.targetMinutes}분)`)
  out.push(`- 음성 글자 수: 한국어 ${koChars}자 + 영어 ${enChars}자 = ${koChars + enChars}자 (ElevenLabs 요금 기준)`)
  out.push('')
  out.push('> 고칠 곳은 `script.json`에서 고친 뒤 `npm run voice -- ' + script.slug + '` 를 실행하세요.')
  out.push('> 🇰🇷 한국어 보이스 · 🇺🇸 영어 보이스 · ▶ 화면 요소 등장 · ⏱ 말없이 대기 · (읽기: …)는 발음 사전으로 바꿔 읽는 문장')
  out.push('')
  if (notes.length) {
    out.push('## 확인할 점')
    notes.forEach((n) => out.push(`- ⚠ ${n}`))
    out.push('')
  }

  script.slides.forEach((slide, i) => {
    out.push(`## ${i + 1}. ${SLIDE_TYPE_LABELS[slide.type]} \`${slide.id}\` — ${formatClock(startById.get(slide.id) ?? 0)}${slide.chapter ? ` · 챕터 "${slide.chapter}"` : ''}`)
    out.push('')
    out.push('**화면**')
    out.push('')
    screenLines(slide).forEach((l) => out.push(`> ${l}`))
    out.push('')
    out.push('**나레이션**')
    out.push('')
    for (const seg of script.segments.filter((s) => s.slideId === slide.id)) {
      if (seg.waitSec) {
        out.push(`- ⏱ ${seg.waitSec}초 대기 (카운트다운) \`${seg.id}\``)
        continue
      }
      const reveal = seg.reveal ? `▶${seg.reveal} ` : ''
      const spoken = normalize(seg.text, seg.lang)
      const reading = spoken !== seg.text.trim() ? `  \n  (읽기: ${spoken})` : ''
      out.push(`- ${reveal}${EMOJI[seg.lang]} ${segmentBadge(seg, script.tempo)}[${seg.emotion}] ${seg.text}${seg.joinNext ? ' ↩' : ''} \`${seg.id}\`${reading}`)
    }
    out.push('')
  })
  return out.join('\n')
}
