/**
 * prisma/seed-partb7.ts
 * Book 1 - Part B7 공용 문제 시드 (Modals - Elementary / Pre-Intermediate)
 *
 * 출처: partb7.pdf
 * - B7: Elementary / Pre-Intermediate, 조동사 (Modals) (100문제)
 *
 * 모두 공용 문제(academyId=null)로 등록.
 *
 * 실행: npm run seed:partb7
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
  B7: SectionData
}

const SOURCE_TAG = 'partb7'

async function main() {
  console.log('📚 Part B7 공용 문제 시드 시작...\n')

  const dataPath = path.join(__dirname, 'data-partb7.json')
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const data = JSON.parse(raw) as AllData

  const section = data.B7
  console.log(`── B7 (${section.label}) ─────────────`)
  console.log(`   대상 문제: ${section.questions.length}개`)
  console.log(`   영역: GRAMMAR / 조동사 (초·중급)`)
  console.log(`   CEFR: A2 상 (난이도 5)`)

  // 기존에 등록된 같은 sourceTag 문제 제거 (재실행 안전성)
  const existing = await prisma.question.findMany({
    where: {
      academyId: null,
      contentJson: { path: ['source_tag'], equals: SOURCE_TAG },
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

    if (optionsArr.filter((o) => o).length < 2) {
      skipped++
      continue
    }

    const contentJson: Prisma.InputJsonValue = {
      type: 'multiple_choice',
      question_text: q.question_text,
      options: optionsArr,
      correct_answer: ans,
      source_tag: SOURCE_TAG,
      source_number: q.number,
    }

    await prisma.question.create({
      data: {
        academyId: null,
        domain: QuestionDomain.GRAMMAR,
        subCategory: '조동사 (초·중급)',
        difficulty: 5,
        cefrLevel: 'A2 상',
        source: QuestionSource.SYSTEM,
        isVerified: true,
        isActive: true,
        contentJson,
        statsJson: { attempt_count: 0, correct_count: 0, correct_rate: 0 },
      },
    })
    created++
  }

  console.log(`   ✅ 등록 ${created}개 / 건너뜀 ${skipped}개\n`)

  const totalPublic = await prisma.question.count({
    where: { academyId: null, source: QuestionSource.SYSTEM },
  })
  console.log('───────────────────────────────')
  console.log(`🎯 등록: ${created}개 / 건너뜀: ${skipped}개`)
  console.log(`📦 현재 공용 문제 뱅크: ${totalPublic}개`)
  console.log('\n✨ Part B7 공용 문제 시드 완료!')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
