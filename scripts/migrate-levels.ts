/**
 * 레벨 시스템 마이그레이션: 5단계 → 10단계
 *
 * 실행 방법:
 *   npx tsx scripts/migrate-levels.ts
 *
 * 매핑:
 *   Level 1 → Level 2  (A1 하)
 *   Level 2 → Level 4  (A2 하)
 *   Level 3 → Level 6  (B1 하)
 *   Level 4 → Level 8  (B2 하)
 *   Level 5 → Level 10 (C1+)
 *
 * cefrLevel 매핑:
 *   A1     → A1 하
 *   A1-A2  → A1 하
 *   A2     → A2 하
 *   B1     → B1 하
 *   B2     → B2 하
 *   C1     → C1+
 *   C1-C2  → C1+
 *   C2     → C1+
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// .env 파일 로드 (프로젝트 루트 기준)
config({ path: resolve(process.cwd(), '.env') })

import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

// 5단계 → 10단계 레벨 매핑
const LEVEL_MAP: Record<number, number> = {
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
}

// cefrLevel 문자열 변환 매핑
const CEFR_MAP: Record<string, string> = {
  'Pre-A1': 'Pre-A1',
  'A1':     'A1 하',
  'A1-A2':  'A1 하',
  'A2':     'A2 하',
  'B1':     'B1 하',
  'B2':     'B2 하',
  'C1':     'C1+',
  'C1-C2':  'C1+',
  'C2':     'C1+',
}

async function main() {
  console.log('=== 레벨 마이그레이션 시작 (5단계 → 10단계) ===\n')

  // ── 1. Student.currentLevel 업데이트 ─────────────────────────────────────────
  console.log('[1/3] Student.currentLevel 업데이트 중...')

  let studentUpdated = 0
  for (const [from, to] of Object.entries(LEVEL_MAP)) {
    const result = await prisma.student.updateMany({
      where: { currentLevel: Number(from) },
      data: { currentLevel: to },
    })
    console.log(`  Level ${from} → Level ${to}: ${result.count}명`)
    studentUpdated += result.count
  }
  console.log(`  완료: ${studentUpdated}명 업데이트\n`)

  // ── 2. Question.difficulty 업데이트 ──────────────────────────────────────────
  console.log('[2/3] Question.difficulty 업데이트 중...')

  let questionUpdated = 0
  for (const [from, to] of Object.entries(LEVEL_MAP)) {
    const result = await prisma.question.updateMany({
      where: { difficulty: Number(from) },
      data: { difficulty: to },
    })
    console.log(`  difficulty ${from} → ${to}: ${result.count}개`)
    questionUpdated += result.count
  }
  console.log(`  완료: ${questionUpdated}개 업데이트\n`)

  // ── 3. Question.cefrLevel 업데이트 ───────────────────────────────────────────
  console.log('[3/3] Question.cefrLevel 업데이트 중...')

  let cefrUpdated = 0
  for (const [from, to] of Object.entries(CEFR_MAP)) {
    if (from === to) continue
    const result = await prisma.question.updateMany({
      where: { cefrLevel: from },
      data: { cefrLevel: to },
    })
    if (result.count > 0) {
      console.log(`  "${from}" → "${to}": ${result.count}개`)
      cefrUpdated += result.count
    }
  }
  console.log(`  완료: ${cefrUpdated}개 업데이트\n`)

  console.log('=== 마이그레이션 완료 ===')
  console.log(`총 업데이트: 학생 ${studentUpdated}명, 문제 난이도 ${questionUpdated}개, CEFR ${cefrUpdated}개`)
}

main()
  .catch((e) => {
    console.error('마이그레이션 실패:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
