/**
 * 사용자가 제공한 시험별(IELTS/CELPIP/TOEFL/TOEIC/SAT) 단어 목록 파일을 읽어
 * 기존 Oxford Word 데이터에 카테고리 태그(WordExamCategory)를 붙인다.
 *
 * - 새 Word를 생성하지 않는다 — 파일의 단어가 기존 Oxford 마스터 단어집(3000+5000)에
 *   없으면 "미매칭"으로만 보고하고 건너뛴다.
 * - 같은 단어가 여러 카테고리에 속할 수 있으므로, 이미 다른 카테고리로 태깅된 단어도
 *   이번 카테고리 태그를 추가로 받을 수 있다(중복 소속).
 * - 입력 파일 형식: 한 줄에 "term" 또는 "term,partOfSpeech" (# 로 시작하는 줄은 주석)
 *
 * 실행: npm run words:import-category -- --category=IELTS --file=data/ielts.txt [--dry-run]
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

type FileEntry = { term: string; partOfSpeech?: string; line: number }

function parseFile(filePath: string): FileEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const entries: FileEntry[] = []
  raw.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) return
    const [termPart, posPart] = line.split(',').map((s) => s.trim())
    if (!termPart) return
    entries.push({ term: termPart, partOfSpeech: posPart || undefined, line: idx + 1 })
  })
  return entries
}

async function main() {
  const { category, file, dryRun } = parseArgs()

  if (!category || !VALID_CATEGORIES.includes(category as ExamCategory)) {
    console.error(`--category는 다음 중 하나여야 합니다: ${VALID_CATEGORIES.join(', ')}`)
    process.exit(1)
  }
  if (!file) {
    console.error('--file=<파일경로> 를 지정하세요.')
    process.exit(1)
  }
  const filePath = path.resolve(process.cwd(), file)
  if (!fs.existsSync(filePath)) {
    console.error(`파일을 찾을 수 없습니다: ${filePath}`)
    process.exit(1)
  }

  const cat = category as ExamCategory
  const entries = parseFile(filePath)
  console.log(
    `▶ ${cat} 카테고리 가져오기 — 파일: ${filePath} (${entries.length}줄)${dryRun ? ' [dry-run]' : ''}\n`,
  )

  if (entries.length === 0) {
    console.log('처리할 단어가 없습니다.')
    await prisma.$disconnect()
    return
  }

  const termToEntry = new Map<string, FileEntry>()
  for (const e of entries) {
    termToEntry.set(e.term.toLowerCase(), e)
  }
  const uniqueTerms = Array.from(termToEntry.keys())

  // 대량 OR 조건 방지를 위해 청크 단위로 조회
  const CHUNK = 200
  const matchedWords: { id: string; term: string; partOfSpeech: string }[] = []
  for (let i = 0; i < uniqueTerms.length; i += CHUNK) {
    const chunk = uniqueTerms.slice(i, i + CHUNK)
    const rows = await prisma.word.findMany({
      where: {
        source: { in: ['OXFORD_3000', 'OXFORD_5000'] },
        OR: chunk.map((t) => ({ term: { equals: t, mode: 'insensitive' as const } })),
      },
      select: { id: true, term: true, partOfSpeech: true },
    })
    matchedWords.push(...rows)
  }

  const matchedTermsLower = new Set(matchedWords.map((w) => w.term.toLowerCase()))
  const unmatchedTerms = uniqueTerms
    .filter((t) => !matchedTermsLower.has(t))
    .map((t) => termToEntry.get(t)!.term)

  // partOfSpeech를 파일에서 지정한 경우 해당 품사만, 없으면 동음이의어 전부 태깅
  const toTag = matchedWords.filter((w) => {
    const entry = termToEntry.get(w.term.toLowerCase())
    if (!entry?.partOfSpeech) return true
    return w.partOfSpeech.toLowerCase() === entry.partOfSpeech.toLowerCase()
  })

  const wordIds = toTag.map((w) => w.id)
  const existingTags = wordIds.length
    ? await prisma.wordExamCategory.findMany({
        where: { category: cat, wordId: { in: wordIds } },
        select: { wordId: true },
      })
    : []
  const alreadyTaggedIds = new Set(existingTags.map((t) => t.wordId))
  const toCreate = toTag.filter((w) => !alreadyTaggedIds.has(w.id))

  if (!dryRun && toCreate.length > 0) {
    await prisma.wordExamCategory.createMany({
      data: toCreate.map((w) => ({ wordId: w.id, category: cat })),
      skipDuplicates: true,
    })
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  가져오기 결과')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  파일 내 고유 단어: ${uniqueTerms.length}`)
  console.log(`  DB 매칭:          ${matchedTermsLower.size}`)
  console.log(`  신규 태깅:         ${toCreate.length}`)
  console.log(`  이미 태깅됨:       ${toTag.length - toCreate.length}`)
  console.log(`  미매칭:            ${unmatchedTerms.length}`)

  if (unmatchedTerms.length > 0) {
    const reportPath = path.join(
      __dirname,
      'data',
      `unmatched-${cat.toLowerCase()}-${Date.now()}.txt`,
    )
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, unmatchedTerms.join('\n') + '\n', 'utf-8')
    console.log(`\n  ⚠ 미매칭 단어는 현재 Oxford 마스터 단어집에 없어 태깅하지 못했습니다.`)
    console.log(`    목록 저장: ${reportPath}`)
    console.log(`    (처음 10개: ${unmatchedTerms.slice(0, 10).join(', ')})`)
  }
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
