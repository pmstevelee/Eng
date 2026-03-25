/**
 * prisma/fix-question-format.ts
 * 기존 문제 contentJson/statsJson 포맷 일괄 수정 스크립트
 *
 * 변경 사항:
 *   contentJson.type: 'mcq' → 'multiple_choice'
 *   contentJson.question → contentJson.question_text
 *   contentJson.correctAnswer → contentJson.correct_answer
 *   contentJson.options: 'A. text' → 'text' (레터 프리픽스 제거)
 *   statsJson: { timesUsed, avgScore } → { attempt_count, correct_count, correct_rate }
 *
 * 실행: npm run fix:question-format
 */

import { PrismaClient, Prisma } from '../src/generated/prisma'
import * as dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

// 선택지 앞의 "A. " / "B. " 등의 프리픽스를 제거
function stripOptionPrefix(opt: string): string {
  return opt.replace(/^[A-Z]\.\s*/, '').trim()
}

async function main() {
  console.log('🔧 문제 포맷 수정 시작...\n')

  const questions = await prisma.question.findMany({
    select: { id: true, contentJson: true, statsJson: true },
  })

  console.log(`📊 전체 문제 수: ${questions.length}개\n`)

  let fixedContent = 0
  let fixedStats = 0
  let skipped = 0

  for (const q of questions) {
    const content = q.contentJson as Record<string, unknown>
    const stats = q.statsJson as Record<string, unknown> | null

    let newContent: Record<string, unknown> | null = null
    let newStats: Record<string, unknown> | null = null

    // ── contentJson 수정 ────────────────────────────────────────────────────
    const needsContentFix =
      content.type === 'mcq' ||
      ('question' in content && !('question_text' in content)) ||
      ('correctAnswer' in content && !('correct_answer' in content))

    if (needsContentFix) {
      const rawOptions = (content.options as string[] | undefined) ?? []
      const cleanedOptions = rawOptions.map(stripOptionPrefix)

      newContent = {
        type: 'multiple_choice',
        question_text: (content.question_text as string) || (content.question as string) || '',
        options: cleanedOptions,
        correct_answer: (content.correct_answer as string) || (content.correctAnswer as string) || '',
        explanation: (content.explanation as string) || undefined,
      }
      // explanation이 없으면 키 제거
      if (!newContent.explanation) delete newContent.explanation

      fixedContent++
    }

    // ── statsJson 수정 ──────────────────────────────────────────────────────
    const needsStatsFix =
      stats !== null &&
      ('timesUsed' in (stats ?? {}) || !('correct_rate' in (stats ?? {})))

    if (needsStatsFix) {
      newStats = {
        attempt_count: 0,
        correct_count: 0,
        correct_rate: 0,
      }
      fixedStats++
    }

    if (newContent || newStats) {
      await prisma.question.update({
        where: { id: q.id },
        data: {
          ...(newContent ? { contentJson: newContent as Prisma.InputJsonValue } : {}),
          ...(newStats ? { statsJson: newStats as Prisma.InputJsonValue } : {}),
        },
      })
    } else {
      skipped++
    }
  }

  console.log('✅ 수정 완료:')
  console.log(`   contentJson 수정: ${fixedContent}개`)
  console.log(`   statsJson 수정:   ${fixedStats}개`)
  console.log(`   변경 없음:        ${skipped}개`)
  console.log('\n✨ 완료!')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
