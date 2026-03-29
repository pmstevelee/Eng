'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

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
  const user = await getAuthedTeacher()
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
    revalidateTag(`teacher-${user.id}-tests`)
    revalidateTag(`teacher-${user.id}-dashboard`)
    revalidatePath('/teacher/tests')
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
  const user = await getAuthedTeacher()
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

    revalidateTag(`teacher-${user.id}-tests`)
    revalidateTag(`teacher-${user.id}-dashboard`)
    revalidatePath('/teacher/tests')
    return { id: test.id }
  } catch (e) {
    console.error(e)
    return { error: '배포에 실패했습니다.' }
  }
}

// 기존 DRAFT 테스트 배포
export async function deployExistingTest(
  testId: string,
  studentIds: string[],
): Promise<{ error?: string }> {
  const user = await getAuthedTeacher()
  if (!user) return { error: '권한이 없습니다.' }
  if (studentIds.length === 0) return { error: '배포할 학생을 선택해 주세요.' }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { id: true, title: true, createdBy: true, academyId: true, timeLimitMin: true },
  })
  if (!test || test.createdBy !== user.id || test.academyId !== user.academyId) {
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

    revalidateTag(`teacher-${user.id}-tests`)
    revalidateTag(`teacher-${user.id}-dashboard`)
    revalidatePath('/teacher/tests')
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
  const user = await getAuthedTeacher()
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

// 테스트 수정
export async function updateTest(
  testId: string,
  input: TestFormInput,
): Promise<{ error?: string }> {
  const user = await getAuthedTeacher()
  if (!user) return { error: '권한이 없습니다.' }
  if (!input.title.trim()) return { error: '제목을 입력해 주세요.' }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { createdBy: true, academyId: true },
  })
  if (!test || test.createdBy !== user.id || test.academyId !== user.academyId) {
    return { error: '권한이 없습니다.' }
  }

  try {
    await prisma.test.update({
      where: { id: testId },
      data: {
        title: input.title.trim(),
        type: input.type,
        classId: input.classId || null,
        timeLimitMin: input.timeLimitMin || null,
        instructions: input.instructions || null,
        questionOrder: input.questionIds,
        totalScore: input.questionIds.length || 0,
      },
    })
    revalidateTag(`teacher-${user.id}-tests`)
    revalidateTag(`teacher-${user.id}-dashboard`)
    revalidatePath('/teacher/tests')
    return {}
  } catch (e) {
    console.error(e)
    return { error: '수정에 실패했습니다.' }
  }
}

// 테스트 삭제
export async function deleteTest(testId: string): Promise<{ error?: string }> {
  const user = await getAuthedTeacher()
  if (!user) return { error: '권한이 없습니다.' }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { createdBy: true, academyId: true },
  })
  if (!test || test.createdBy !== user.id || test.academyId !== user.academyId) {
    return { error: '권한이 없습니다.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sessions = await tx.testSession.findMany({
        where: { testId },
        select: { id: true },
      })
      const sessionIds = sessions.map((s) => s.id)
      if (sessionIds.length > 0) {
        await tx.questionResponse.deleteMany({
          where: { sessionId: { in: sessionIds } },
        })
        await tx.testSession.deleteMany({ where: { testId } })
      }
      await tx.test.delete({ where: { id: testId } })
    })
    revalidateTag(`teacher-${user.id}-tests`)
    revalidateTag(`teacher-${user.id}-dashboard`)
    revalidatePath('/teacher/tests')
    return {}
  } catch (e) {
    console.error(e)
    return { error: '삭제에 실패했습니다.' }
  }
}

// 테스트 편집용 데이터 조회
export async function getTestForEdit(testId: string): Promise<{
  test?: {
    id: string
    title: string
    type: 'LEVEL_TEST' | 'UNIT_TEST' | 'PRACTICE'
    status: 'DRAFT' | 'PUBLISHED'
    classId: string | null
    timeLimitMin: number | null
    instructions: string | null
    questionOrder: string[]
    deployedSessions: Array<{ studentId: string; status: string }>
  }
  error?: string
}> {
  const user = await getAuthedTeacher()
  if (!user) return { error: '권한이 없습니다.' }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      classId: true,
      timeLimitMin: true,
      instructions: true,
      questionOrder: true,
      createdBy: true,
      academyId: true,
      testSessions: {
        select: { studentId: true, status: true },
      },
    },
  })

  if (!test || test.createdBy !== user.id || test.academyId !== user.academyId) {
    return { error: '테스트를 찾을 수 없습니다.' }
  }

  return {
    test: {
      id: test.id,
      title: test.title,
      type: test.type as 'LEVEL_TEST' | 'UNIT_TEST' | 'PRACTICE',
      status: test.status as 'DRAFT' | 'PUBLISHED',
      classId: test.classId,
      timeLimitMin: test.timeLimitMin,
      instructions: test.instructions,
      questionOrder: test.questionOrder as string[],
      deployedSessions: test.testSessions.map((s) => ({
        studentId: s.studentId,
        status: s.status,
      })),
    },
  }
}

// 배포 학생 수정 (추가/제거)
export async function updateDeployedStudents(
  testId: string,
  newStudentIds: string[],
): Promise<{ error?: string }> {
  const user = await getAuthedTeacher()
  if (!user) return { error: '권한이 없습니다.' }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      title: true,
      createdBy: true,
      academyId: true,
      timeLimitMin: true,
      status: true,
    },
  })
  if (!test || test.createdBy !== user.id || test.academyId !== user.academyId) {
    return { error: '권한이 없습니다.' }
  }

  try {
    const existingSessions = await prisma.testSession.findMany({
      where: { testId },
      select: { id: true, studentId: true, status: true },
    })

    const existingStudentIds = new Set(existingSessions.map((s) => s.studentId))
    const newStudentIdSet = new Set(newStudentIds)

    // 새로 추가할 학생 (기존 세션 없는 경우만)
    const toAddIds = newStudentIds.filter((id) => !existingStudentIds.has(id))

    // NOT_STARTED 상태이고 새 목록에 없는 세션 제거
    const toRemoveSessions = existingSessions.filter(
      (s) => s.status === 'NOT_STARTED' && !newStudentIdSet.has(s.studentId),
    )

    const toAddStudents = await prisma.student.findMany({
      where: { id: { in: toAddIds }, status: 'ACTIVE' },
      select: { id: true, userId: true },
    })

    await prisma.$transaction(async (tx) => {
      // DRAFT → PUBLISHED 전환 (학생 추가 시)
      if (test.status === 'DRAFT' && newStudentIds.length > 0) {
        await tx.test.update({ where: { id: testId }, data: { status: 'PUBLISHED' } })
      }

      // NOT_STARTED 세션 제거
      if (toRemoveSessions.length > 0) {
        await tx.testSession.deleteMany({
          where: { id: { in: toRemoveSessions.map((s) => s.id) } },
        })
      }

      // 새 세션 생성 + 알림 발송
      for (const student of toAddStudents) {
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
    })

    revalidateTag(`teacher-${user.id}-tests`)
    revalidateTag(`teacher-${user.id}-dashboard`)
    revalidatePath('/teacher/tests')
    return {}
  } catch (e) {
    console.error(e)
    return { error: '배포 학생 수정에 실패했습니다.' }
  }
}

// 자동 문제 선택
export async function getAutoQuestions(
  configs: AutoConfig[],
): Promise<{ questions: QuestionRowMin[]; error?: string }> {
  const user = await getAuthedTeacher()
  if (!user) return { questions: [], error: '권한이 없습니다.' }

  const results: QuestionRowMin[] = []
  const usedIds = new Set<string>()

  for (const config of configs) {
    if (config.count <= 0) continue

    const questions = await prisma.question.findMany({
      where: {
        academyId: user.academyId!,
        domain: config.domain,
        ...(config.cefrLevel ? { cefrLevel: config.cefrLevel } : {}),
        NOT: { id: { in: Array.from(usedIds) } },
      },
      take: config.count * 3, // fetch more for shuffling
      select: {
        id: true,
        domain: true,
        cefrLevel: true,
        difficulty: true,
        contentJson: true,
        subCategory: true,
      },
    })

    // shuffle and take
    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, config.count)
    for (const q of shuffled) {
      usedIds.add(q.id)
      results.push({
        id: q.id,
        domain: q.domain,
        cefrLevel: q.cefrLevel,
        difficulty: q.difficulty,
        contentJson: q.contentJson as QuestionContentJson,
        subCategory: q.subCategory,
      })
    }
  }

  return { questions: results }
}
