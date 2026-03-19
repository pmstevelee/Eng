'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { QuestionDomain } from '@/generated/prisma'

export type QuestionContentJson = {
  type: 'multiple_choice' | 'fill_blank' | 'short_answer' | 'essay'
  question_text: string
  question_text_ko?: string
  options?: string[]
  correct_answer?: string
  explanation?: string
  passage?: string
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
      },
    })
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
    revalidatePath('/teacher/tests/questions')
    return {}
  } catch {
    return { error: '문제 수정에 실패했습니다.' }
  }
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
    revalidatePath('/teacher/tests/questions')
    return {}
  } catch {
    return { error: '문제 삭제에 실패했습니다.' }
  }
}
