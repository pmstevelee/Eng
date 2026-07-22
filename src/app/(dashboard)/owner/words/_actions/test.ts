'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import type { WordTestMode } from '@/generated/prisma'

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

// ─── 학원 반 목록 ────────────────────────────────────────────────────────────────

export async function getClassesForOwner() {
  const owner = await getAuthedOwner()
  if (!owner) return []

  const classes = await prisma.class.findMany({
    where: { academyId: owner.academyId!, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      students: {
        where: { status: 'ACTIVE' },
        orderBy: { user: { name: 'asc' } },
        select: { id: true, user: { select: { name: true } } },
      },
    },
  })

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    students: c.students.map((s) => ({ id: s.id, name: s.user.name })),
  }))
}

// ─── 단어 시험 생성 ─────────────────────────────────────────────────────────────

const CreateWordTestSchema = z.object({
  setId: z.string().uuid(),
  title: z.string().min(1).max(100),
  mode: z.enum(['EN_TO_KO', 'KO_TO_EN', 'SPELL', 'MIXED']),
  timePerQuestion: z.coerce.number().int().min(1).max(60),
  numQuestions: z.coerce.number().int().min(5).max(100),
  passingScore: z.coerce.number().int().min(1).max(100),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  classIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string().uuid()).optional(),
})

export type CreateOwnerWordTestInput = z.infer<typeof CreateWordTestSchema>

export async function createOwnerWordTestAssignment(
  input: CreateOwnerWordTestInput,
): Promise<{ error?: string; id?: string }> {
  const owner = await getAuthedOwner()
  if (!owner) return { error: '인증이 필요합니다.' }

  const parsed = CreateWordTestSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const { setId, title, mode, timePerQuestion, numQuestions, passingScore, startsAt, endsAt, classIds, studentIds } =
    parsed.data

  // 세트가 접근 가능한지 확인
  const wordSet = await prisma.wordSet.findFirst({
    where: {
      id: setId,
      OR: [{ academyId: owner.academyId }, { isPublic: true }, { ownerId: owner.id }],
    },
    select: { id: true, _count: { select: { items: true } } },
  })
  if (!wordSet) return { error: '단어 세트를 찾을 수 없습니다.' }
  if (wordSet._count.items < numQuestions) {
    return { error: `단어 세트에 문항 수(${numQuestions})보다 단어가 부족합니다.` }
  }

  const assignment = await prisma.wordTestAssignment.create({
    data: {
      teacherId: owner.id,
      academyId: owner.academyId!,
      setId,
      title,
      mode: mode as WordTestMode,
      timePerQuestion,
      numQuestions,
      passingScore,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      classAssignments:
        classIds && classIds.length > 0
          ? { create: classIds.map((classId) => ({ classId })) }
          : undefined,
      studentAssignments:
        studentIds && studentIds.length > 0
          ? { create: studentIds.map((studentId) => ({ studentId })) }
          : undefined,
    },
  })

  revalidatePath(`/owner/words/sets/${setId}`)
  return { id: assignment.id }
}

// ─── 보충 세트 생성 (오답 단어만) ────────────────────────────────────────────────

export async function createOwnerSupplementarySet(
  assignmentId: string,
  studentId: string,
): Promise<{ error?: string; setId?: string }> {
  const owner = await getAuthedOwner()
  if (!owner) return { error: '인증이 필요합니다.' }

  const attempt = await prisma.wordTestAttempt.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    select: { answers: true, assignment: { select: { title: true, setId: true } } },
  })
  if (!attempt) return { error: '응시 기록이 없습니다.' }

  const answers = attempt.answers as { wordId: string; isCorrect: boolean }[]
  const wrongWordIds = answers.filter((a) => !a.isCorrect).map((a) => a.wordId)
  if (wrongWordIds.length === 0) return { error: '오답이 없습니다.' }

  const newSet = await prisma.$transaction(async (tx) => {
    const set = await tx.wordSet.create({
      data: {
        title: `[보충] ${attempt.assignment.title}`,
        cefrLevel: 1,
        isPublic: false,
        source: 'AI_GENERATED',
        ownerId: owner.id,
        academyId: owner.academyId!,
      },
    })
    await tx.wordSetItem.createMany({
      data: wrongWordIds.map((wordId, i) => ({ setId: set.id, wordId, order: i })),
    })
    return set
  })

  revalidatePath(`/owner/words/sets`)
  return { setId: newSet.id }
}
