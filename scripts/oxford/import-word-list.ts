/**
 * 사용자가 제공한 "단어+뜻+정의"가 포함된 시험별 단어 목록(JSON)을 가져와
 * 기존 Word와 매칭되면 카테고리만 태깅하고, 없으면 파일 데이터 그대로 새 Word를 등록한다.
 *
 * - AI로 뜻/정의를 새로 만들지 않는다 — 전부 사용자가 제공한 파일의 원본 데이터를 사용한다.
 * - 이미 DB에 있는 단어(Oxford 등)는 기존 뜻/정의를 건드리지 않고 카테고리 태그만 추가한다.
 * - 새로 만드는 단어는 source: PUBLISHER, oxfordCefr: C1, cefrLevel: 10 (Oxford 범위 밖의
 *   고급 어휘라는 의미)로 저장한다.
 *
 * 입력 JSON 형식: [{ term, partOfSpeech?, meaning?, definition? }, ...]
 *
 * 실행: npm run words:import-word-list -- --category=SAT --file=data/sat5000-raw.json [--dry-run]
 */
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma/client'
import { ExamCategory } from '@/generated/prisma'

const VALID_CATEGORIES = Object.values(ExamCategory)

function parseArgs() {
  const args = process.argv.slice(2)
  const category = args.find((a) => a.startsWith('--category='))?.split('=')[1]
  const file = args.find((a) => a.startsWith('--file='))?.split('=')[1]
  const dryRun = args.includes('--dry-run')
  return { category, file, dryRun }
}

type ListEntry = {
  term: string
  partOfSpeech?: string | null
  meaning?: string | null
  definition?: string | null
}

async function main() {
  const { category, file, dryRun } = parseArgs()

  if (!category || !VALID_CATEGORIES.includes(category as ExamCategory)) {
    console.error(`--category는 다음 중 하나여야 합니다: ${VALID_CATEGORIES.join(', ')}`)
    process.exit(1)
  }
  if (!file) {
    console.error('--file=<JSON 파일경로> 를 지정하세요.')
    process.exit(1)
  }
  const filePath = path.resolve(process.cwd(), file)
  if (!fs.existsSync(filePath)) {
    console.error(`파일을 찾을 수 없습니다: ${filePath}`)
    process.exit(1)
  }

  const cat = category as ExamCategory
  const raw: ListEntry[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  // 같은 term이 여러 줄이면 첫 항목만 사용 (신규 생성 시 대표값)
  const byTerm = new Map<string, ListEntry>()
  for (const e of raw) {
    const key = e.term.trim().toLowerCase()
    if (!key) continue
    if (!byTerm.has(key)) byTerm.set(key, e)
  }
  const terms = Array.from(byTerm.keys())

  console.log(
    `▶ ${cat} 단어 목록 가져오기 — 파일: ${filePath} (고유 단어 ${terms.length}개)${dryRun ? ' [dry-run]' : ''}\n`,
  )

  // 1) 기존 Word와 매칭되는 term 조회 (전체 source 대상 — 이미 등록된 단어는 재사용)
  const CHUNK = 200
  const existingWords: { id: string; term: string }[] = []
  for (let i = 0; i < terms.length; i += CHUNK) {
    const chunk = terms.slice(i, i + CHUNK)
    const rows = await prisma.word.findMany({
      where: { OR: chunk.map((t) => ({ term: { equals: t, mode: 'insensitive' as const } })) },
      select: { id: true, term: true },
    })
    existingWords.push(...rows)
  }

  const existingByTermLower = new Map<string, string[]>() // term(lower) -> wordIds
  for (const w of existingWords) {
    const key = w.term.toLowerCase()
    const arr = existingByTermLower.get(key) ?? []
    arr.push(w.id)
    existingByTermLower.set(key, arr)
  }

  const termsToCreate = terms.filter((t) => !existingByTermLower.has(t))
  const termsAlreadyInDb = terms.filter((t) => existingByTermLower.has(t))

  console.log(`  기존 Word와 매칭: ${termsAlreadyInDb.length}개 (뜻/정의 유지, 카테고리 태그만 추가)`)
  console.log(`  신규 Word 생성 대상: ${termsToCreate.length}개 (파일의 뜻/정의 그대로 사용)\n`)

  // 2) 신규 Word 생성 (파일 원본 데이터 그대로)
  let created = 0
  if (!dryRun && termsToCreate.length > 0) {
    const createData = termsToCreate.map((t) => {
      const e = byTerm.get(t)!
      return {
        term: t,
        partOfSpeech: e.partOfSpeech?.trim() || 'unknown',
        meaning: e.meaning ?? null,
        definition: e.definition ?? null,
        cefrLevel: 10,
        oxfordCefr: 'C1' as const,
        source: 'PUBLISHER' as const,
      }
    })
    const BATCH = 500
    for (let i = 0; i < createData.length; i += BATCH) {
      const batch = createData.slice(i, i + BATCH)
      await prisma.word.createMany({ data: batch, skipDuplicates: true })
      created += batch.length
      console.log(`  생성 진행: ${Math.min(i + BATCH, createData.length)}/${createData.length}`)
    }
  } else if (dryRun) {
    created = termsToCreate.length
  }

  // 3) 카테고리 태깅 대상 word id 전체 수집 (기존 + 신규)
  let allWordIds: string[] = existingWords.map((w) => w.id)
  if (!dryRun && termsToCreate.length > 0) {
    const CHUNK2 = 200
    for (let i = 0; i < termsToCreate.length; i += CHUNK2) {
      const chunk = termsToCreate.slice(i, i + CHUNK2)
      const rows = await prisma.word.findMany({
        where: { OR: chunk.map((t) => ({ term: { equals: t, mode: 'insensitive' as const } })) },
        select: { id: true },
      })
      allWordIds.push(...rows.map((r) => r.id))
    }
  }
  allWordIds = Array.from(new Set(allWordIds))

  let newlyTagged = 0
  let alreadyTagged = 0
  if (!dryRun) {
    const existingTags = await prisma.wordExamCategory.findMany({
      where: { category: cat, wordId: { in: allWordIds } },
      select: { wordId: true },
    })
    const taggedIds = new Set(existingTags.map((t) => t.wordId))
    const toTag = allWordIds.filter((id) => !taggedIds.has(id))
    alreadyTagged = allWordIds.length - toTag.length
    if (toTag.length > 0) {
      await prisma.wordExamCategory.createMany({
        data: toTag.map((wordId) => ({ wordId, category: cat })),
        skipDuplicates: true,
      })
      newlyTagged = toTag.length
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  가져오기 결과')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  파일 내 고유 단어: ${terms.length}`)
  console.log(`  기존 Word 매칭:    ${termsAlreadyInDb.length}`)
  console.log(`  신규 Word 생성:    ${created}`)
  console.log(`  신규 카테고리 태깅: ${dryRun ? '(dry-run 생략)' : newlyTagged}`)
  console.log(`  이미 태깅됨:       ${dryRun ? '(dry-run 생략)' : alreadyTagged}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (dryRun) {
    console.log('※ dry-run 완료 — DB에 저장되지 않았습니다.\n')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
