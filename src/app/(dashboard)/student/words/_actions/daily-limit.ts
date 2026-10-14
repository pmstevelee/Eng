'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { DAILY_NEW_WORDS_RANGE } from '@/lib/words/settings'

type UpdateResult = { ok: true } | { ok: false; error: string }

/** 학생이 하루 신규 단어 수를 직접 조정한다. null이면 학원 기본값으로 되돌린다. */
export async function updateMyDailyNewWords(value: number | null): Promise<UpdateResult> {
  try {
    const { studentId, userId } = await requireStudent()

    if (value !== null) {
      if (
        !Number.isInteger(value) ||
        value < DAILY_NEW_WORDS_RANGE.min ||
        value > DAILY_NEW_WORDS_RANGE.max
      ) {
        return {
          ok: false,
          error: `${DAILY_NEW_WORDS_RANGE.min}~${DAILY_NEW_WORDS_RANGE.max}개 사이로 입력해 주세요.`,
        }
      }
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { dailyNewWordsOverride: value },
    })

    revalidateTag(`user-${userId}`)
    revalidatePath('/student/words')
    revalidatePath('/student/settings')
    return { ok: true }
  } catch {
    return { ok: false, error: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
