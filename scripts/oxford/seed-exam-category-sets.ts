/**
 * 시험 카테고리(IELTS/CELPIP/TOEFL/TOEIC/SAT)로 태깅된 단어를 묶어
 * 공용 시스템 단어 세트(WordSet, isPublic=true, source=PUBLISHER)를 생성한다.
 *
 * - import-exam-category.ts로 카테고리 태깅을 마친 뒤 카테고리별로 실행한다.
 * - --force: 해당 카테고리의 기존 PUBLISHER 시스템 세트를 지우고 다시 생성한다
 *   (새 단어 파일을 추가로 가져온 뒤 세트를 재구성할 때 사용).
 *
 * 실행: npm run words:seed-category-sets -- --category=IELTS [--size=20] [--force]
 */
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '@/lib/prisma/client'
import { ExamCategory } from '@/generated/prisma'

const VALID_CATEGORIES = Object.values(ExamCategory)

function parseArgs() {
  const args = process.argv.slice(2)
  const category = args.find((a) => a.startsWith('--category='))?.split('=')[1]
  const sizeArg = args.find((a) => a.startsWith('--size='))?.split('=')[1]
  const force = args.includes('--force')
  const size = sizeArg ? Number(sizeArg) : 20
  return { category, size: Number.isFinite(size) && size > 0 ? size : 20, force }
}

const CATEGORY_LABEL: Record<ExamCategory, string> = {
  IELTS: '아이엘츠',
  CELPIP: '셀핍',
  TOEFL: '토플',
  TOEIC: '토익',
  SAT: 'SAT',
}

async function main() {
  const { category, size, force } = parseArgs()

  if (!category || !VALID_CATEGORIES.includes(category as ExamCategory)) {
    console.error(`--category는 다음 중 하나여야 합니다: ${VALID_CATEGORIES.join(', ')}`)
    process.exit(1)
  }
  const cat = category as ExamCategory
  const label = CATEGORY_LABEL[cat]

  if (force) {
    const existingSets = await prisma.wordSet.findMany({
      where: { examCategory: cat, source: 'PUBLISHER' },
      select: { id: true },
    })
    const ids = existingSets.map((s) => s.id)
    if (ids.length > 0) {
      await prisma.$transaction([
        prisma.wordSetItem.deleteMany({ where: { setId: { in: ids } } }),
        prisma.wordSet.deleteMany({ where: { id: { in: ids } } }),
      ])
      console.log(`▶ 기존 ${label} 시스템 세트 ${ids.length}개 삭제 (--force)\n`)
    }
  }

  const tags = await prisma.wordExamCategory.findMany({
    where: { category: cat },
    select: {
      word: { select: { id: true, term: true, cefrLevel: true, meaning: true } },
    },
  })

  const words = tags
    .map((t) => t.word)
    .filter((w) => w.meaning !== null)
    .sort((a, b) => a.cefrLevel - b.cefrLevel || a.term.localeCompare(b.term))

  if (words.length === 0) {
    console.log(`${label}로 태깅된 단어가 없습니다. import-exam-category.ts를 먼저 실행하세요.`)
    await prisma.$disconnect()
    return
  }

  console.log(`▶ ${label} 시스템 세트 생성 — 태깅된 단어 ${words.length}개, 세트당 ${size}개\n`)

  let createdSets = 0
  let createdItems = 0
  let skipped = 0

  for (let i = 0, setIndex = 1; i < words.length; i += size, setIndex++) {
    const chunk = words.slice(i, i + size)
    const title = `${label} 필수단어 ${setIndex}`

    const existing = await prisma.wordSet.findFirst({
      where: { title, isPublic: true, examCategory: cat },
      select: { id: true },
    })
    if (existing) {
      skipped++
      console.log(`  ⏭  "${title}" 이미 존재 — 스킵`)
      continue
    }

    const cefrLevel = chunk[0].cefrLevel
    const set = await prisma.wordSet.create({
      data: {
        title,
        description: `${label} 필수 어휘 ${chunk.length}개`,
        cefrLevel,
        examCategory: cat,
        isPublic: true,
        academyId: null,
        source: 'PUBLISHER',
      },
      select: { id: true },
    })

    await prisma.wordSetItem.createMany({
      data: chunk.map((w, idx) => ({ setId: set.id, wordId: w.id, order: idx })),
    })

    createdSets++
    createdItems += chunk.length
    console.log(`  ✅ "${title}" (${chunk.length}단어)`)
  }

  console.log(`\n완료 — 신규 세트: ${createdSets}, 항목: ${createdItems}, 스킵: ${skipped}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
