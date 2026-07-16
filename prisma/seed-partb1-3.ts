/**
 * prisma/seed-partb1-3.ts
 * Book 1 - Part B 공용 문제 시드 (Pronouns/Adverbs/Adjectives/Determiners + Tenses/Passives)
 *
 * 출처: partb1-3.pdf
 * - B1: Elementary / Pre-Intermediate, 대명사·부사·형용사·한정사 (233문제)
 * - B2: Intermediate / Upper-Intermediate, 대명사·부사·형용사·한정사 (195문제)
 * - B3: Elementary / Pre-Intermediate, 시제·수동태 (295문제)
 *
 * 모두 공용 문제(academyId=null)로 등록.
 *
 * 실행: npm run seed:partb1-3
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient, Prisma, QuestionDomain, QuestionSource } from '../src/generated/prisma'

const prisma = new PrismaClient()

// ── 타입 ─────────────────────────────────────────────────────────────────────
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
  B1: SectionData
  B2: SectionData
  B3: SectionData
}

// ── 섹션 메타데이터 ──────────────────────────────────────────────────────────
type SectionMeta = {
  id: 'B1' | 'B2' | 'B3'
  domain: QuestionDomain
  subCategory: string
  cefrLevel: string
  difficulty: number
  sourceTag: string
}

const SECTION_META: SectionMeta[] = [
  {
    id: 'B1',
    domain: 'GRAMMAR',
    subCategory: '대명사·부사·형용사·한정사 (기초)',
    cefrLevel: 'A1 상',
    difficulty: 3,
    sourceTag: 'partb1',
  },
  {
    id: 'B2',
    domain: 'GRAMMAR',
    subCategory: '대명사·부사·형용사·한정사 (중급)',
    cefrLevel: 'B1 상',
    difficulty: 7,
    sourceTag: 'partb2',
  },
  {
    id: 'B3',
    domain: 'GRAMMAR',
    subCategory: '시제·수동태 (기초)',
    cefrLevel: 'A2 상',
    difficulty: 5,
    sourceTag: 'partb3',
  },
]

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📚 Part B 공용 문제 시드 시작...\n')

  const dataPath = path.join(__dirname, 'data-partb1-3.json')
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const data = JSON.parse(raw) as AllData

  let totalCreated = 0
  let totalSkipped = 0

  for (const meta of SECTION_META) {
    const section = data[meta.id]
    console.log(`── ${meta.id} (${section.label}) ─────────────`)
    console.log(`   대상 문제: ${section.questions.length}개`)
    console.log(`   영역: ${meta.domain} / ${meta.subCategory}`)
    console.log(`   CEFR: ${meta.cefrLevel} (난이도 ${meta.difficulty})`)

    // 기존에 등록된 같은 sourceTag 문제 제거 (재실행 안전성)
    const existing = await prisma.question.findMany({
      where: {
        academyId: null,
        contentJson: { path: ['source_tag'], equals: meta.sourceTag },
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

      // 옵션을 A→D 순서 배열로 (없는 옵션은 빈 문자열)
      const optionsArr: string[] = ['A', 'B', 'C', 'D'].map((k) => {
        const v = q.options[k as 'A' | 'B' | 'C' | 'D']
        return (v ?? '').trim()
      })

      // 옵션이 2개 이하면 건너뜀
      if (optionsArr.filter((o) => o).length < 2) {
        skipped++
        continue
      }

      const contentJson: Prisma.InputJsonValue = {
        type: 'multiple_choice',
        question_text: q.question_text,
        options: optionsArr,
        correct_answer: ans,
        source_tag: meta.sourceTag,
        source_number: q.number,
      }

      await prisma.question.create({
        data: {
          academyId: null,
          domain: meta.domain,
          subCategory: meta.subCategory,
          difficulty: meta.difficulty,
          cefrLevel: meta.cefrLevel,
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
    totalCreated += created
    totalSkipped += skipped
  }

  console.log('───────────────────────────────')
  console.log(`🎯 총 등록: ${totalCreated}개 / 건너뜀: ${totalSkipped}개`)

  const totalPublic = await prisma.question.count({
    where: { academyId: null, source: QuestionSource.SYSTEM },
  })
  console.log(`📦 현재 공용 문제 뱅크: ${totalPublic}개`)
  console.log('\n✨ Part B 공용 문제 시드 완료!')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
