'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import { getUsedLevelTestQuestions } from '@/lib/questions/usage-tracker'

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

export type TestFormInput = {
  title: string
  type: 'LEVEL_TEST' | 'UNIT_TEST' | 'PRACTICE'
  classId?: string
  timeLimitMin?: number
  instructions?: string
  questionIds: string[]
}

export type QuestionRowMin = {
  id: string
  domain: 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING' | 'LISTENING'
  cefrLevel: string | null
  difficulty: number
  contentJson: QuestionContentJson
  subCategory: string | null
}

export type AutoConfig = {
  domain: 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING' | 'LISTENING'
  cefrLevel?: string
  count: number
}

// 테스트 임시저장 (DRAFT)
export async function saveTestDraft(
  input: TestFormInput,
): Promise<{ error?: string; id?: string }> {
  const user = await getAuthedOwner()
  if (!user) return { error: '권한이 없습니다.' }
  if (!input.title.trim()) return { error: '제목을 입력해 주세요.' }

  try {
    const test = await prisma.test.create({
      data: {
        academyId: user.academyId!,
        title: input.title.trim(),
        type: input.type,
        status: 'DRAFT',
        classId: input.classId || null,
        timeLimitMin: input.timeLimitMin || null,
        instructions: input.instructions || null,
        questionOrder: input.questionIds,
        totalScore: input.questionIds.length || 0,
        createdBy: user.id,
        isActive: true,
      },
    })
    revalidateTag(`academy-${user.academyId}-tests`)
    revalidatePath('/owner/tests')
    return { id: test.id }
  } catch (e) {
    console.error(e)
    return { error: '저장에 실패했습니다.' }
  }
}

// 테스트 생성 + 즉시 배포
export async function createAndDeployTest(
  input: TestFormInput,
  studentIds: string[],
): Promise<{ error?: string; id?: string }> {
  const user = await getAuthedOwner()
  if (!user) return { error: '권한이 없습니다.' }
  if (!input.title.trim()) return { error: '제목을 입력해 주세요.' }
  if (studentIds.length === 0) return { error: '배포할 학생을 선택해 주세요.' }

  try {
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, status: 'ACTIVE' },
      select: { id: true, userId: true },
    })

    const testTitle = input.title.trim()

    const test = await prisma.$transaction(async (tx) => {
      const created = await tx.test.create({
        data: {
          academyId: user.academyId!,
          title: testTitle,
          type: input.type,
          status: 'PUBLISHED',
          classId: input.classId || null,
          timeLimitMin: input.timeLimitMin || null,
          instructions: input.instructions || null,
          questionOrder: input.questionIds,
          totalScore: input.questionIds.length || 0,
          createdBy: user.id,
          isActive: true,
        },
      })

      for (const student of students) {
        await tx.testSession.create({
          data: {
            testId: created.id,
            studentId: student.id,
            status: 'NOT_STARTED',
            timeLimitMin: input.timeLimitMin || null,
          },
        })
        await tx.notification.create({
          data: {
            userId: student.userId,
            academyId: user.academyId!,
            type: 'INFO',
            title: '새 테스트가 배포되었습니다',
            message: `"${testTitle}" 테스트에 응시해 주세요.`,
          },
        })
      }

      return created
    })

    revalidateTag(`academy-${user.academyId}-tests`)
    revalidatePath('/owner/tests')
    return { id: test.id }
  } catch (e) {
    console.error(e)
    return { error: '배포에 실패했습니다.' }
  }
}

// 기존 DRAFT 테스트 배포 (학원 내 모든 테스트 가능)
export async function deployExistingTest(
  testId: string,
  studentIds: string[],
): Promise<{ error?: string }> {
  const user = await getAuthedOwner()
  if (!user) return { error: '권한이 없습니다.' }
  if (studentIds.length === 0) return { error: '배포할 학생을 선택해 주세요.' }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { id: true, title: true, academyId: true, timeLimitMin: true },
  })
  // 학원장은 학원 내 모든 테스트 배포 가능
  if (!test || test.academyId !== user.academyId) {
    return { error: '권한이 없습니다.' }
  }

  try {
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, status: 'ACTIVE' },
      select: { id: true, userId: true },
    })

    await prisma.$transaction(async (tx) => {
      await tx.test.update({ where: { id: testId }, data: { status: 'PUBLISHED' } })

      for (const student of students) {
        const existing = await tx.testSession.findFirst({
          where: { testId, studentId: student.id },
        })
        if (!existing) {
          await tx.testSession.create({
            data: {
              testId,
              studentId: student.id,
              status: 'NOT_STARTED',
              timeLimitMin: test.timeLimitMin,
            },
          })
          await tx.notification.create({
            data: {
              userId: student.userId,
              academyId: user.academyId!,
              type: 'INFO',
              title: '새 테스트가 배포되었습니다',
              message: `"${test.title}" 테스트에 응시해 주세요.`,
            },
          })
        }
      }
    })

    revalidateTag(`academy-${user.academyId}-tests`)
    revalidatePath('/owner/tests')
    return {}
  } catch (e) {
    console.error(e)
    return { error: '배포에 실패했습니다.' }
  }
}

// 배포 모달용 학급+학생 목록 조회
export async function getStudentsForDeploy(): Promise<{
  classes: Array<{ id: string; name: string; students: Array<{ id: string; name: string }> }>
  error?: string
}> {
  const user = await getAuthedOwner()
  if (!user) return { classes: [], error: '권한이 없습니다.' }

  const classes = await prisma.class.findMany({
    where: { academyId: user.academyId!, isActive: true },
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

  return {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      students: c.students.map((s) => ({ id: s.id, name: s.user.name })),
    })),
  }
}

// 자동 문제 선택
export async function getAutoQuestions(
  configs: AutoConfig[],
  testType?: 'LEVEL_TEST' | 'UNIT_TEST' | 'PRACTICE',
): Promise<{ questions: QuestionRowMin[]; error?: string }> {
  const user = await getAuthedOwner()
  if (!user) return { questions: [], error: '권한이 없습니다.' }

  // 레벨 테스트: 최근 1년 이내 이 학원에서 사용된 문제 ID 조회
  const levelTestExcludeIds =
    testType === 'LEVEL_TEST' ? await getUsedLevelTestQuestions(user.academyId!) : []

  const results: QuestionRowMin[] = []
  const sessionUsedIds = new Set<string>()

  const selectFields = {
    id: true,
    domain: true,
    cefrLevel: true,
    difficulty: true,
    contentJson: true,
    subCategory: true,
  } as const

  for (const config of configs) {
    if (config.count <= 0) continue

    const excludeIds = [...Array.from(sessionUsedIds), ...levelTestExcludeIds]

    // 1차: 공용 풀 + 학원 문제, 품질 높은 것 우선
    let questions = await prisma.question.findMany({
      where: {
        OR: [{ academyId: null }, { academyId: user.academyId! }],
        domain: config.domain,
        isActive: true,
        ...(config.cefrLevel ? { cefrLevel: config.cefrLevel } : {}),
        ...(excludeIds.length > 0 ? { NOT: { id: { in: excludeIds } } } : {}),
      },
      take: config.count * 3,
      select: selectFields,
      orderBy: [{ qualityScore: 'desc' }, { usageCount: 'asc' }],
    })

    // 2차: 레벨 테스트이고 문제 부족 시 1년 이상 된 문제도 허용
    if (testType === 'LEVEL_TEST' && questions.length < config.count) {
      const recentExcludeIds = Array.from(sessionUsedIds)
      questions = await prisma.question.findMany({
        where: {
          OR: [{ academyId: null }, { academyId: user.academyId! }],
          domain: config.domain,
          isActive: true,
          ...(config.cefrLevel ? { cefrLevel: config.cefrLevel } : {}),
          ...(recentExcludeIds.length > 0
            ? { NOT: { id: { in: recentExcludeIds } } }
            : {}),
        },
        take: config.count * 3,
        select: selectFields,
        orderBy: [{ qualityScore: 'desc' }, { usageCount: 'asc' }],
      })
    }

    // 3차: 인접 난이도까지 확장 (cefrLevel 조건 완화)
    if (questions.length < config.count) {
      const recentExcludeIds = Array.from(sessionUsedIds)
      const additional = await prisma.question.findMany({
        where: {
          OR: [{ academyId: null }, { academyId: user.academyId! }],
          domain: config.domain,
          isActive: true,
          ...(recentExcludeIds.length > 0
            ? { NOT: { id: { in: recentExcludeIds } } }
            : {}),
        },
        take: (config.count - questions.length) * 3,
        select: selectFields,
        orderBy: [{ qualityScore: 'desc' }, { usageCount: 'asc' }],
      })
      const existingIds = new Set(questions.map((q) => q.id))
      questions = [...questions, ...additional.filter((q) => !existingIds.has(q.id))]
    }

    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, config.count)
    for (const q of shuffled) {
      sessionUsedIds.add(q.id)
      results.push({
        id: q.id,
        domain: q.domain,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
        contentJson: q.contentJson as QuestionContentJson,
        subCategory: q.subCategory,
      })
    }
  }

  return { questions: results }
}
