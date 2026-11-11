// 손으로 쓴 대본(raw JSON: slides + segments, id 없음)을 script.json으로 마무리한다.
// 패턴·대화·따라하기 원어민 세그먼트 자동 구성 → id 부여 → 영어 분리 → 검증 → script.json + script-review.md
// 사용: npx tsx scripts/lecture/_finalize-manual.ts <slug> <raw.json>
import { readFileSync } from 'node:fs'
import { loadDict, paths, writeScript } from './common'
import { repairPatternSegments, findPatternGroups } from '../../src/lib/lecture-pipeline/patterns'
import { splitMixedSegments } from '../../src/lib/lecture-pipeline/mixed'
import { parseLectureScript, formatIssues, joinTokens } from '../../src/lib/lecture-pipeline/types'
import { layoutTimeline, formatClock, sentenceKey } from '../../src/lib/lecture-pipeline/timing'

const [slug, rawPath] = process.argv.slice(2)
const base = JSON.parse(readFileSync(paths(slug).script, 'utf8'))
const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
const repaired = repairPatternSegments(raw.segments, raw.slides)
const counts = new Map<string, number>()
const withIds = repaired.map((g) => {
  const sid = String(g.slideId)
  const n = (counts.get(sid) ?? 0) + 1
  counts.set(sid, n)
  return { id: `${sid}-${n}`, ...g }
})
const first = parseLectureScript({ ...base, slides: raw.slides, segments: withIds })
if (!first.script) throw new Error(formatIssues(first.issues).join('\n'))
const dict = loadDict()
const split = splitMixedSegments(first.script.segments, dict)
const parsed = parseLectureScript({ ...first.script, segments: split.segments })
if (!parsed.script) throw new Error(formatIssues(parsed.issues).join('\n'))
const script = parsed.script
const notes: string[] = [
  ...formatIssues(parsed.issues.filter((i) => i.level === 'warn')),
  ...split.notes.map((n) => `${n.segmentId}: ${n.message}`),
]
for (const s of script.slides) {
  if (s.type !== 'example') continue
  const key = sentenceKey(joinTokens(s.data.sentence))
  if (!script.segments.some((g) => g.slideId === s.id && g.lang === 'en' && sentenceKey(g.text) === key)) notes.push(`${s.id}(예문): 화면 문장을 영어 세그먼트가 그대로 읽지 않아요`)
}
const groups = findPatternGroups(script)
groups.forEach((g) => {
  if (!g.dialogue) notes.push(`${g.pattern.id}(패턴): 대화 슬라이드 없음`)
  if (!g.repeats.length) notes.push(`${g.pattern.id}(패턴): 따라하기 슬라이드 없음`)
})
writeScript(script, notes)
const est = layoutTimeline(script)
console.log(`✔ 슬라이드 ${script.slides.length} · 세그먼트 ${script.segments.length} · 패턴 ${groups.length} · 예상 ${formatClock(est.totalMs)} · 메모 ${notes.length}`)
notes.forEach((n) => console.log('  - ' + n))
