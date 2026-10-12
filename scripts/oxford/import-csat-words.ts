/**
 * 수능 필수 영단어 VOCA 5000(엑셀 → csat5000-raw.json)을 단어학습에 등록한다.
 *
 * - 모든 단어에 CSAT(수능영어) 카테고리 태그를 붙인다.
 * - 기존 Word(Oxford/SAT 등)와 term이 같으면 뜻·레벨을 유지하고 태그만 추가한다.
 * - 없는 단어는 파일의 뜻 그대로 새로 등록하고(source: PUBLISHER), 레벨(Word.cefrLevel 2/4/6/8/10)은
 *   기존 단어집에 있는 원형(파생어 규칙)의 레벨을 따르고, 원형을 찾지 못하면 10(C1)로 둔다.
 * - DAY별로 공용 시스템 세트("수능영어 DAY 01" …)를 만든다. 이미 있으면 건너뛴다.
 *
 * 실행: npm run words:import-csat -- [--dry-run]
 */
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma/client'
import type { OxfordCefr } from '@/generated/prisma'

type Entry = { day: number; term: string; partOfSpeech: string; meaning: string }

const BAND_TO_CEFR: Record<number, OxfordCefr> = { 2: 'A1', 4: 'A2', 6: 'B1', 8: 'B2', 10: 'C1' }
const SUFFIX_RULES: [string, string][] = [
  ['ies', 'y'], ['es', ''], ['s', ''], ['ied', 'y'], ['ed', ''], ['ed', 'e'], ['d', ''],
  ['ing', ''], ['ing', 'e'], ['ily', 'y'], ['ly', ''], ['ness', ''], ['ment', ''], ['ity', ''],
  ['ity', 'e'], ['ation', 'e'], ['ation', ''], ['tion', 'te'], ['ion', ''], ['ion', 'e'],
  ['er', ''], ['er', 'e'], ['or', ''], ['ist', ''], ['ism', ''], ['ive', ''], ['al', ''],
  ['ous', ''], ['ful', ''], ['less', ''], ['able', ''], ['able', 'e'], ['ability', 'able'],
  ['ize', ''], ['ise', ''], ['ify', ''], ['y', ''],
]
const PREFIXES = ['un', 'in', 'im', 'ir', 'il', 'dis', 're', 'non', 'mis', 'over', 'under', 'out', 'pre', 'anti', 'co', 'inter', 'sub', 'super']

function baseCandidates(term: string): string[] {
  const out: string[] = []
  for (const [suf, rep] of SUFFIX_RULES) {
    if (term.length > suf.length + 2 && term.endsWith(suf)) out.push(term.slice(0, -suf.length) + rep)
  }
  for (const pre of PREFIXES) {
    if (term.length > pre.length + 3 && term.startsWith(pre)) out.push(term.slice(pre.length))
  }
  return out
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const file = path.resolve(process.cwd(), 'scripts/oxford/data/csat5000-raw.json')
  const raw: Entry[] = JSON.parse(fs.readFileSync(file, 'utf-8'))
  console.log(`▶ 수능영어 VOCA 5000 가져오기 (${raw.length}개)${dryRun ? ' [dry-run]' : ''}\n`)

  // 기존 Word 전체 (term 소문자 → id/level)
  const all = await prisma.word.findMany({ select: { id: true, term: true, cefrLevel: true } })
  const byTerm = new Map<string, { ids: string[]; level: number }>()
  for (const w of all) {
    const k = w.term.toLowerCase()
    const cur = byTerm.get(k)
    if (cur) {
      cur.ids.push(w.id)
      cur.level = Math.min(cur.level, w.cefrLevel)
    } else byTerm.set(k, { ids: [w.id], level: w.cefrLevel })
  }

  const seen = new Set<string>()
  const toCreate: (Entry & { level: number; inferred: boolean })[] = []
  for (const e of raw) {
    const k = e.term.toLowerCase()
    if (seen.has(k) || byTerm.has(k)) {
      seen.add(k)
      continue
    }
    seen.add(k)
    let level = 10
    let inferred = false
    for (const base of baseCandidates(k)) {
      const hit = byTerm.get(base)
      if (hit) {
        level = hit.level
        inferred = true
        break
      }
    }
    toCreate.push({ ...e, level, inferred })
  }

  const dist: Record<number, number> = {}
  for (const c of toCreate) dist[c.level] = (dist[c.level] ?? 0) + 1
  console.log(`  기존 단어와 매칭: ${raw.length - toCreate.length}개 (뜻·레벨 유지)`)
  console.log(`  신규 등록: ${toCreate.length}개 (원형 기반 레벨 추정 ${toCreate.filter((c) => c.inferred).length}개)`)
  console.log('  신규 단어 레벨 분포:', dist, '\n')

  if (dryRun) {
    console.log('※ dry-run 완료 — DB에 저장되지 않았습니다.')
    await prisma.$disconnect()
    return
  }

  for (let i = 0; i < toCreate.length; i += 500) {
    await prisma.word.createMany({
      data: toCreate.slice(i, i + 500).map((c) => ({
        term: c.term.toLowerCase(),
        partOfSpeech: c.partOfSpeech,
        meaning: c.meaning,
        cefrLevel: c.level,
        oxfordCefr: BAND_TO_CEFR[c.level] ?? 'C1',
        source: 'PUBLISHER' as const,
      })),
      skipDuplicates: true,
    })
  }

  // term → wordId (신규 포함 재조회)
  const idByTerm = new Map<string, { id: string; level: number }>()
  const fresh = await prisma.word.findMany({ select: { id: true, term: true, cefrLevel: true, meaning: true } })
  const csatTerms = new Set(raw.map((r) => r.term.toLowerCase()))
  for (const w of fresh) {
    const k = w.term.toLowerCase()
    if (csatTerms.has(k) && w.meaning && !idByTerm.has(k)) idByTerm.set(k, { id: w.id, level: w.cefrLevel })
  }

  // 카테고리 태그 (동음이의어 포함 전체 id)
  const tagIds = new Set<string>()
  for (const w of fresh) if (csatTerms.has(w.term.toLowerCase())) tagIds.add(w.id)
  const tagData = Array.from(tagIds).map((wordId) => ({ wordId, category: 'CSAT' as const }))
  for (let i = 0; i < tagData.length; i += 1000) {
    await prisma.wordExamCategory.createMany({ data: tagData.slice(i, i + 1000), skipDuplicates: true })
  }
  console.log(`  CSAT 태깅 대상: ${tagIds.size}개`)

  // DAY별 세트
  const days = Array.from(new Set(raw.map((r) => r.day))).sort((a, b) => a - b)
  let created = 0
  for (const day of days) {
    const title = `수능영어 DAY ${String(day).padStart(2, '0')}`
    const exists = await prisma.wordSet.findFirst({
      where: { title, examCategory: 'CSAT', isPublic: true },
      select: { id: true },
    })
    if (exists) continue
    const items = raw.filter((r) => r.day === day).map((r) => idByTerm.get(r.term.toLowerCase())).filter((x): x is { id: string; level: number } => !!x)
    if (items.length === 0) continue
    const levels = items.map((x) => x.level)
    const bandOf = (l: number) => Math.min(10, Math.max(2, Math.ceil(l / 2) * 2))
    const counts = new Map<number, number>()
    for (const l of levels) counts.set(bandOf(l), (counts.get(bandOf(l)) ?? 0) + 1)
    const cefrLevel = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
    const set = await prisma.wordSet.create({
      data: {
        title,
        description: `수능 필수 영단어 DAY ${day} (${items.length}개)`,
        cefrLevel,
        examCategory: 'CSAT',
        isPublic: true,
        academyId: null,
        source: 'PUBLISHER',
      },
      select: { id: true },
    })
    await prisma.wordSetItem.createMany({
      data: items.map((x, order) => ({ setId: set.id, wordId: x.id, order })),
      skipDuplicates: true,
    })
    created++
  }
  console.log(`  DAY 세트 생성: ${created}/${days.length}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
