'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'

type QuestionDomain = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING'

export type QuestionContentJson = {
  type: 'multiple_choice' | 'fill_blank' | 'short_answer' | 'essay'
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
}

type CreateQuestionInput = {
  domain: QuestionDomain
  subCategory?: string
  difficulty: number
  cefrLevel?: string
  contentJson: QuestionContentJson
}

type UpdateQuestionInput = CreateQuestionInput & { id: string }

async function getAuthedOwner() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return null
  return user
}

export async function createQuestion(
  input: CreateQuestionInput,
): Promise<{ error?: string; id?: string }> {
  const user = await getAuthedOwner()
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
      },
    })
    revalidateTag(`academy-${user.academyId}-questions`)
    revalidatePath('/owner/tests/questions')
    return { id: question.id }
  } catch {
    return { error: '문제 저장에 실패했습니다.' }
  }
}

export async function updateQuestion(
  input: UpdateQuestionInput,
): Promise<{ error?: string }> {
  const user = await getAuthedOwner()
  if (!user) return { error: '권한이 없습니다.' }

  try {
    const existing = await prisma.question.findUnique({
      where: { id: input.id },
      select: { academyId: true },
    })
    if (!existing || existing.academyId !== user.academyId) {
      return { error: '문제를 찾을 수 없습니다.' }
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
    revalidatePath('/owner/tests/questions')
    return {}
  } catch {
    return { error: '문제 수정에 실패했습니다.' }
  }
}

export async function getQuestionDetail(id: string): Promise<QuestionContentJson | null> {
  const user = await getAuthedOwner()
  if (!user) return null

  const q = await prisma.question.findUnique({
    where: { id, academyId: user.academyId! },
    select: { contentJson: true },
  })
  return (q?.contentJson as QuestionContentJson) ?? null
}

export async function deleteQuestion(id: string): Promise<{ error?: string }> {
  const user = await getAuthedOwner()
  if (!user) return { error: '권한이 없습니다.' }

  try {
    const existing = await prisma.question.findUnique({
      where: { id },
      select: { academyId: true },
    })
    if (!existing || existing.academyId !== user.academyId) {
      return { error: '문제를 찾을 수 없습니다.' }
    }

    await prisma.questionResponse.deleteMany({ where: { questionId: id } })
    await prisma.question.delete({ where: { id } })
    revalidateTag(`academy-${user.academyId}-questions`)
    revalidatePath('/owner/tests/questions')
    return {}
  } catch {
    return { error: '문제 삭제에 실패했습니다.' }
  }
}
