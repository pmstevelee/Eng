'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { Prisma } from '@/generated/prisma'
import type { ExamCategory, OxfordCefr } from '@/generated/prisma'

const OXFORD_CEFRS: OxfordCefr[] = ['A1', 'A2', 'B1', 'B2', 'C1']
const EXAM_CATEGORIES: ExamCategory[] = ['IELTS', 'CELPIP', 'TOEFL', 'TOEIC', 'SAT', 'CSAT']

export type AdminWordInput = {
  term: string
  partOfSpeech: string
  meaning: string
  definition: string
  example: string
  contextNote: string
  cefrLevel: number
  oxfordCefr: OxfordCefr
  homonymIndex: number | null
  examCategories: ExamCategory[]
}

export type AdminWordActionResult = { ok: true } | { ok: false; error: string }

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** 관리자가 단어 콘텐츠(철자·품사·뜻·정의·예문·레벨·시험 태그)를 직접 수정한다. */
export async function updateAdminWord(
  wordId: string,
  input: AdminWordInput,
): Promise<AdminWordActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return { ok: false, error: '권한이 없습니다.' }

  const term = input.term.trim()
  const partOfSpeech = input.partOfSpeech.trim()
  if (!term) return { ok: false, error: '단어를 입력해 주세요.' }
  if (term.length > 100) return { ok: false, error: '단어는 100자 이내로 입력해 주세요.' }
  if (!partOfSpeech) return { ok: false, error: '품사를 입력해 주세요.' }
  if (!Number.isInteger(input.cefrLevel) || input.cefrLevel < 1 || input.cefrLevel > 10) {
    return { ok: false, error: '레벨은 1~10 사이로 선택해 주세요.' }
  }
  if (!OXFORD_CEFRS.includes(input.oxfordCefr)) {
    return { ok: false, error: 'Oxford CEFR 값이 올바르지 않습니다.' }
  }
  if (
    input.homonymIndex !== null &&
    (!Number.isInteger(input.homonymIndex) || input.homonymIndex < 1 || input.homonymIndex > 20)
  ) {
    return { ok: false, error: '동음이의어 번호는 1~20 사이 숫자로 입력해 주세요.' }
  }
  const examCategories = Array.from(new Set(input.examCategories)).filter((c) =>
    EXAM_CATEGORIES.includes(c),
  )

  const existing = await prisma.word.findUnique({
    where: { id: wordId },
    select: { term: true, audioUrl: true },
  })
  if (!existing) return { ok: false, error: '단어를 찾을 수 없습니다.' }

  try {
    await prisma.$transaction([
      prisma.word.update({
        where: { id: wordId },
        data: {
          term,
          partOfSpeech,
          meaning: emptyToNull(input.meaning),
          definition: emptyToNull(input.definition),
          example: emptyToNull(input.example),
          contextNote: emptyToNull(input.contextNote),
          cefrLevel: input.cefrLevel,
          oxfordCefr: input.oxfordCefr,
          homonymIndex: input.homonymIndex,
          // 철자가 바뀌면 기존 녹음 파일은 다른 단어 발음이 되므로 지우고 브라우저 TTS로 재생한다
          ...(existing.term !== term && existing.audioUrl ? { audioUrl: null } : {}),
        },
      }),
      prisma.wordExamCategory.deleteMany({
        where: { wordId, category: { notIn: examCategories } },
      }),
      prisma.wordExamCategory.createMany({
        data: examCategories.map((category) => ({ wordId, category })),
        skipDuplicates: true,
      }),
    ])
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        ok: false,
        error: '같은 단어·품사·동음이의어 번호의 단어가 이미 있습니다. 동음이의어 번호를 바꿔 주세요.',
      }
    }
    console.error('[admin/words] updateAdminWord 실패', error)
    return { ok: false, error: '저장 중 오류가 발생했습니다.' }
  }

  revalidatePath('/admin/words')
  return { ok: true }
}
