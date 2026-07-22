'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { shareQuestionToPublicPool } from '@/lib/questions/share-to-pool'
import type { Prisma } from '@/generated/prisma'
import type { QuestionRow, QuestionDomainType, QuestionType } from '@/components/shared/question-bank-client'

type QuestionDomain = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING' | 'LISTENING'

export type QuestionContentJson = {
  type: 'multiple_choice' | 'fill_blank' | 'short_answer' | 'essay' | 'writing_prompt' | 'word_bank' | 'question_set' | 'sentence_order'
  question_text: string
  question_text_ko?: string
  options?: string[]
  option_images?: (string | null)[]
  correct_answer?: string
  explanation?: string
  passage?: string
  passage_image_url?: string
  question_image_url?: string
  word_limit?: number
  audio_url?: string
  audio_script?: string
  word_bank?: string[]
  sentences?: { label: string; text: string; correct_answer: string; image_url?: string | null }[]
  sub_questions?: { label: string; question_text: string; options: string[]; option_images?: (string | null)[]; correct_answer: string }[]
  order_sentences?: { label: string; display_text: string; words: string[]; correct_answer: string; image_url?: string | null }[]
}

type CreateQuestionInput = {
  domain: QuestionDomain
  subCategory?: string
  difficulty: number
  cefrLevel?: string
  contentJson: QuestionContentJson
  source?: 'AI_GENERATED' | 'TEACHER_CREATED'
}

type UpdateQuestionInput = CreateQuestionInput & { id: string }

async function getAuthedTeacher() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'TEACHER' || !user.academyId) return null
  return user
}

export async function createQuestion(
  input: CreateQuestionInput,
): Promise<{ error?: string; id?: string }> {
  const user = await getAuthedTeacher()
  if (!user) return { error: '권한이 없습니다.' }

  try {
    const question = await prisma.question.create({
      data: {
        academyId: user.academyId!,
        domain: input.domain,
        subCategory: input.subCategory || null,
        difficulty: input.difficulty,
        cefrLevel: input.cefrLevel || null,
        contentJson: input.contentJson as object,
        createdBy: user.id,
        source: input.source === 'AI_GENERATED' ? 'AI_GENERATED' : 'TEACHER_CREATED',
      },
    })

    // AI 유사문제는 공용 풀에 비동기 공유
    if (input.source === 'AI_GENERATED') {
      shareQuestionToPublicPool({
        id: question.id,
        domain: question.domain,
        subCategory: question.subCategory,
        difficulty: question.difficulty,
        cefrLevel: question.cefrLevel,
        contentJson: input.contentJson as Record<string, unknown> & { question_text: string },
      }).catch(console.error)
    }

    revalidateTag(`academy-${user.academyId}-questions`)
    revalidatePath('/teacher/tests/questions')
    return { id: question.id }
  } catch {
    return { error: '문제 저장에 실패했습니다.' }
  }
}

export async function updateQuestion(
  input: UpdateQuestionInput,
): Promise<{ error?: string }> {
  const user = await getAuthedTeacher()
  if (!user) return { error: '권한이 없습니다.' }

  try {
    const existing = await prisma.question.findUnique({
      where: { id: input.id },
      select: { academyId: true, createdBy: true },
    })
    // 교사는 본인이 만든 문제만 수정 가능
    if (!existing || existing.academyId !== user.academyId || existing.createdBy !== user.id) {
      return { error: '본인이 생성한 문제만 수정할 수 있습니다.' }
    }

    await prisma.question.update({
      where: { id: input.id },
      data: {
        domain: input.domain,
        subCategory: input.subCategory || null,
        difficulty: input.difficulty,
        cefrLevel: input.cefrLevel || null,
        contentJson: input.contentJson as object,
      },
    })
    revalidateTag(`academy-${user.academyId}-questions`)
    revalidatePath('/teacher/tests/questions')
    return {}
  } catch {
    return { error: '문제 수정에 실패했습니다.' }
  }
}

export async function getQuestionDetail(id: string): Promise<QuestionContentJson | null> {
  const user = await getAuthedTeacher()
  if (!user) return null

  const q = await prisma.question.findUnique({
    where: { id, academyId: user.academyId! },
    select: { contentJson: true },
  })
  return (q?.contentJson as QuestionContentJson) ?? null
}

export async function deleteQuestion(id: string): Promise<{ error?: string }> {
  const user = await getAuthedTeacher()
  if (!user) return { error: '권한이 없습니다.' }

  try {
    const existing = await prisma.question.findUnique({
      where: { id },
      select: { academyId: true, createdBy: true },
    })
    if (!existing || existing.academyId !== user.academyId || existing.createdBy !== user.id) {
      return { error: '본인이 생성한 문제만 삭제할 수 있습니다.' }
    }

    await prisma.questionResponse.deleteMany({ where: { questionId: id } })
    await prisma.question.delete({ where: { id } })
    revalidateTag(`academy-${user.academyId}-questions`)
    revalidatePath('/teacher/tests/questions')
    return {}
  } catch {
    return { error: '문제 삭제에 실패했습니다.' }
  }
}

// ── 문제 뱅크 목록 (서버 페이지네이션) ────────────────────────────────────────

export type QuestionBankPageParams = {
  scope: 'academy' | 'all'
  page: number
  pageSize: number
  search?: string
  domain?: QuestionDomainType | 'ALL'
  questionType?: string
  cefrLevel?: string
  difficulty?: number
}

export async function getQuestionBankPage(
  params: QuestionBankPageParams,
): Promise<{ rows: QuestionRow[]; total: number }> {
  const user = await getAuthedTeacher()
  if (!user) return { rows: [], total: 0 }

  const scopeFilter: Prisma.QuestionWhereInput =
    params.scope === 'all'
      ? { OR: [{ academyId: user.academyId }, { academyId: null, isActive: true }] }
      : { academyId: user.academyId }

  const AND: Prisma.QuestionWhereInput[] = [scopeFilter]

  if (params.domain && params.domain !== 'ALL') AND.push({ domain: params.domain })
  if (params.cefrLevel && params.cefrLevel !== 'ALL') AND.push({ cefrLevel: params.cefrLevel })
  if (params.difficulty) AND.push({ difficulty: params.difficulty })
  if (params.questionType && params.questionType !== 'ALL') {
    AND.push({ contentJson: { path: ['type'], equals: params.questionType } })
  }
  if (params.search?.trim()) {
    const search = params.search.trim()
    AND.push({
      OR: [
        { contentJson: { path: ['question_text'], string_contains: search, mode: 'insensitive' } },
        { subCategory: { contains: search, mode: 'insensitive' } },
      ],
    })
  }

  const where: Prisma.QuestionWhereInput = { AND }
  const pageSize = Math.min(Math.max(params.pageSize, 1), 100)
  const page = Math.max(params.page, 1)

  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        domain: true,
        subCategory: true,
        difficulty: true,
        cefrLevel: true,
        contentJson: true,
        statsJson: true,
        createdAt: true,
        creator: { select: { name: true } },
      },
    }),
    prisma.question.count({ where }),
  ])

  return {
    rows: rows.map((q) => {
      const content = q.contentJson as { type?: string; question_text?: string }
      return {
        id: q.id,
        domain: q.domain as QuestionDomainType,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
        questionType: (content.type ?? 'multiple_choice') as QuestionType,
        questionText: content.question_text ?? '',
        statsJson: q.statsJson as QuestionRow['statsJson'],
        createdAt: q.createdAt.toISOString(),
        creator: q.creator,
      }
    }),
    total,
  }
}
