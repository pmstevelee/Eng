/**
 * prisma/seed-partb8.ts
 * Book 1 - Part B8/B9 공용 문제 시드
 *
 * 출처: partb8.pdf
 * - B8: Intermediate / Upper-Intermediate, 조동사 (Modals) (120문제)
 * - B9: Elementary / Pre-Intermediate, 전치사 (Prepositions) (150문제)
 *
 * 모두 공용 문제(academyId=null)로 등록.
 *
 * 실행: npm run seed:partb8
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient, Prisma, QuestionDomain, QuestionSource } from '../src/generated/prisma'

const prisma = new PrismaClient()

type RawQuestion = {
  number: number
  question_text: string
  options: { A?: string; B?: string; C?: string; D?: string }
  correct_answer: string
}

type SectionData = {
  label: string
  count: number
  questions: RawQuestion[]
}

type AllData = {
  B8: SectionData
  B9: SectionData
}

async function seedSection(params: {
  section: SectionData
  sourceTag: string
  domain: QuestionDomain
  subCategory: string
  difficulty: number
  cefrLevel: string
}) {
  const { section, sourceTag, domain, subCategory, difficulty, cefrLevel } = params

  console.log(`\n── ${sourceTag.toUpperCase()} (${section.label}) ─────────────`)
  console.log(`   대상 문제: ${section.questions.length}개`)
  console.log(`   영역: ${domain} / ${subCategory}`)
  console.log(`   CEFR: ${cefrLevel} (난이도 ${difficulty})`)

  const existing = await prisma.question.findMany({
    where: {
      academyId: null,
      contentJson: { path: ['source_tag'], equals: sourceTag },
    },
    select: { id: true },
  })
  if (existing.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: existing.map((e) => e.id) } } })
    console.log(`   ↺ 기존 ${existing.length}개 삭제 후 재등록`)
  }

  let created = 0
  let skipped = 0

  for (const q of section.questions) {
    const ans = q.correct_answer?.trim().toUpperCase()
    if (!ans || !['A', 'B', 'C', 'D'].includes(ans)) {
      skipped++
      continue
    }

    const optionsArr: string[] = ['A', 'B', 'C', 'D'].map((k) => {
      const v = q.options[k as 'A' | 'B' | 'C' | 'D']
      return (v ?? '').trim()
    })

    if (optionsArr.filter((o) => o && o !== '–').length < 2) {
      skipped++
      continue
    }

    const contentJson: Prisma.InputJsonValue = {
      type: 'multiple_choice',
      question_text: q.question_text,
      options: optionsArr,
      correct_answer: ans,
      source_tag: sourceTag,
      source_number: q.number,
    }

    await prisma.question.create({
      data: {
        academyId: null,
        domain,
        subCategory,
        difficulty,
        cefrLevel,
        source: QuestionSource.SYSTEM,
        isVerified: true,
        isActive: true,
        contentJson,
        statsJson: { attempt_count: 0, correct_count: 0, correct_rate: 0 },
      },
    })
    created++
  }

  console.log(`   ✅ 등록 ${created}개 / 건너뜀 ${skipped}개`)
  return created
}

async function main() {
  console.log('📚 Part B8/B9 공용 문제 시드 시작...\n')

  const dataPath = path.join(__dirname, 'data-partb8.json')
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const data = JSON.parse(raw) as AllData

  const b8Created = await seedSection({
    section: data.B8,
    sourceTag: 'partb8',
    domain: QuestionDomain.GRAMMAR,
    subCategory: '조동사 (중급/중상급)',
    difficulty: 7,
    cefrLevel: 'B1 상',
  })

  const b9Created = await seedSection({
    section: data.B9,
    sourceTag: 'partb9',
    domain: QuestionDomain.GRAMMAR,
    subCategory: '전치사 (초·중급)',
    difficulty: 4,
    cefrLevel: 'A2 하',
  })

  const totalPublic = await prisma.question.count({
    where: { academyId: null, source: QuestionSource.SYSTEM },
  })

  console.log('\n───────────────────────────────')
  console.log(`🎯 총 등록: ${b8Created + b9Created}개 (B8: ${b8Created}개, B9: ${b9Created}개)`)
  console.log(`📦 현재 공용 문제 뱅크: ${totalPublic}개`)
  console.log('\n✨ Part B8/B9 공용 문제 시드 완료!')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
