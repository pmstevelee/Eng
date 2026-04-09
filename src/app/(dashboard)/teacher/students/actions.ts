'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'

export async function saveTeacherComment(input: {
  studentId: string
  content: string
  month: string // "YYYY-MM"
}): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER') return { error: '권한이 없습니다.' }
  if (input.content.trim().length === 0) return { error: '코멘트를 입력해주세요.' }
  if (input.content.length > 300) return { error: '코멘트는 300자 이내로 작성해주세요.' }

  const existing = await prisma.teacherComment.findFirst({
    where: { teacherId: user.id, studentId: input.studentId, type: input.month },
  })

  if (existing) {
    await prisma.teacherComment.update({
      where: { id: existing.id },
      data: { content: input.content },
    })
  } else {
    await prisma.teacherComment.create({
      data: {
        teacherId: user.id,
        studentId: input.studentId,
        content: input.content,
        type: input.month,
      },
    })
  }

  revalidatePath(`/teacher/students/${input.studentId}`)
  return {}
}

export async function saveBulkTeacherComment(input: {
  studentIds: string[]
  content: string
  month: string
}): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER') return { error: '권한이 없습니다.' }
  if (input.content.trim().length === 0) return { error: '코멘트를 입력해주세요.' }
  if (input.content.length > 300) return { error: '코멘트는 300자 이내로 작성해주세요.' }

  for (const studentId of input.studentIds) {
    const existing = await prisma.teacherComment.findFirst({
      where: { teacherId: user.id, studentId, type: input.month },
    })
    if (existing) {
      await prisma.teacherComment.update({
        where: { id: existing.id },
        data: { content: input.content },
      })
    } else {
      await prisma.teacherComment.create({
        data: { teacherId: user.id, studentId, content: input.content, type: input.month },
      })
    }
  }

  revalidateTag(`teacher-${user.id}-students`)
  revalidatePath('/teacher/students')
  return {}
}

export async function updateAttendance(input: {
  studentId: string
  classId: string
  date: string // "YYYY-MM-DD"
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
}): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER') return { error: '권한이 없습니다.' }

  const date = new Date(`${input.date}T00:00:00.000Z`)

  await prisma.attendance.upsert({
    where: {
      studentId_classId_date: {
        studentId: input.studentId,
        classId: input.classId,
        date,
      },
    },
    update: { status: input.status },
    create: {
      studentId: input.studentId,
      classId: input.classId,
      date,
      status: input.status,
    },
  })

  revalidatePath(`/teacher/students/${input.studentId}`)
  return {}
}

export async function bulkCheckAttendance(input: {
  classId: string
  studentIds: string[]
  date: string
}): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER') return { error: '권한이 없습니다.' }

  const date = new Date(`${input.date}T00:00:00.000Z`)

  await prisma.$transaction(
    input.studentIds.map((studentId) =>
      prisma.attendance.upsert({
        where: { studentId_classId_date: { studentId, classId: input.classId, date } },
        update: { status: 'PRESENT' },
        create: { studentId, classId: input.classId, date, status: 'PRESENT' },
      })
    )
  )

  revalidateTag(`teacher-${user.id}-students`)
  revalidatePath('/teacher/students')
  return {}
}

export async function regenerateLearningPath(studentId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER') return { error: '권한이 없습니다.' }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      testSessions: {
        where: { status: { in: ['COMPLETED', 'GRADED'] } },
        orderBy: { completedAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  const sessions = student.testSessions
  const weaknesses: string[] = []

  if (sessions.length > 0) {
    const avg = (vals: (number | null)[]) => {
      const valid = vals.filter((v): v is number => v !== null)
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 100
    }
    if (avg(sessions.map((s) => s.grammarScore)) < 75) weaknesses.push('Grammar')
    if (avg(sessions.map((s) => s.vocabularyScore)) < 75) weaknesses.push('Vocabulary')
    if (avg(sessions.map((s) => s.readingScore)) < 75) weaknesses.push('Reading')
    if (avg(sessions.map((s) => s.writingScore)) < 75) weaknesses.push('Writing')
  }

  await prisma.learningPath.updateMany({
    where: { studentId, isActive: true },
    data: { isActive: false },
  })

  type Step = { id: string; title: string; domain: string; description: string }
  const steps: Step[] = []
  let stepId = 1

  if (weaknesses.includes('Grammar')) {
    steps.push({ id: String(stepId++), title: '현재시제', domain: 'GRAMMAR', description: '현재시제 기초 및 활용 학습' })
    steps.push({ id: String(stepId++), title: '과거시제', domain: 'GRAMMAR', description: '과거시제 심화 학습' })
    steps.push({ id: String(stepId++), title: '완료시제', domain: 'GRAMMAR', description: '현재완료/과거완료 학습' })
  }
  if (weaknesses.includes('Reading')) {
    steps.push({ id: String(stepId++), title: '주제 파악', domain: 'READING', description: '글의 주제와 요지 파악하기' })
    steps.push({ id: String(stepId++), title: '추론 읽기', domain: 'READING', description: '문맥에서 의미 추론하기' })
  }
  if (weaknesses.includes('Vocabulary')) {
    steps.push({ id: String(stepId++), title: '핵심 어휘', domain: 'VOCABULARY', description: 'A1-A2 수준 핵심 어휘 학습' })
    steps.push({ id: String(stepId++), title: '어휘 확장', domain: 'VOCABULARY', description: 'B1 수준 어휘 확장 학습' })
  }
  if (weaknesses.includes('Writing')) {
    steps.push({ id: String(stepId++), title: '문장 구성', domain: 'WRITING', description: '올바른 문장 구조 학습' })
    steps.push({ id: String(stepId++), title: '단락 쓰기', domain: 'WRITING', description: '단락 구성 및 논리 전개' })
  }
  if (steps.length === 0) {
    steps.push({ id: '1', title: '종합 실력 향상', domain: 'GRAMMAR', description: '전반적인 영어 실력 향상을 위한 종합 학습' })
  }

  const progressJson: Record<string, { progress: number }> = {}
  steps.forEach((s) => { progressJson[s.id] = { progress: 0 } })

  await prisma.learningPath.create({
    data: {
      studentId,
      title: 'AI 추천 학습 경로',
      description: weaknesses.length > 0 ? `약점 영역: ${weaknesses.join(', ')}` : '전반적 실력 향상',
      goalsJson: { weaknesses, steps },
      progressJson,
      isActive: true,
    },
  })

  revalidatePath(`/teacher/students/${studentId}`)
  return {}
}

// ─── 레벨 수동 조정 ────────────────────────────────────────────────────────────

export async function overrideStudentLevel(input: {
  studentId: string
  targetLevel: number
  reason: string
}): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER') return { error: '권한이 없습니다.' }
  if (input.targetLevel < 1 || input.targetLevel > 10) return { error: '레벨은 1~10 사이여야 합니다.' }
  if (!input.reason.trim()) return { error: '조정 사유를 입력해주세요.' }

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { currentLevel: true, userId: true, user: { select: { academyId: true } } },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  await prisma.$transaction(async (tx) => {
    // 이전 isCurrent 플래그 해제
    await tx.levelAssessment.updateMany({
      where: { studentId: input.studentId, isCurrent: true },
      data: { isCurrent: false },
    })

    // 수동 조정 이력 생성
    await tx.levelAssessment.create({
      data: {
        studentId: input.studentId,
        overrideBy: user.id,
        assessmentType: 'TEACHER_OVERRIDE',
        grammarLevel: input.targetLevel,
        vocabularyLevel: input.targetLevel,
        readingLevel: input.targetLevel,
        listeningLevel: null,
        writingLevel: input.targetLevel,
        overallLevel: input.targetLevel,
        detailJson: { reason: input.reason, previousLevel: student.currentLevel },
        assessedBy: 'TEACHER_OVERRIDE',
        isCurrent: true,
      },
    })

    // 학생 레벨 업데이트
    await tx.student.update({
      where: { id: input.studentId },
      data: { currentLevel: input.targetLevel },
    })

    // 알림 생성
    await tx.notification.create({
      data: {
        userId: student.userId,
        academyId: student.user.academyId,
        type: 'INFO',
        title: '레벨 조정',
        message: `선생님이 레벨을 Level ${input.targetLevel}로 조정했습니다.`,
        link: '/student/grades',
      },
    })
  })

  revalidatePath(`/teacher/students/${input.studentId}`)
  return {}
}

// ─── 레벨 테스트 배포 ─────────────────────────────────────────────────────────

export async function deployLevelTestToStudent(input: {
  studentId: string
}): Promise<{ error?: string; sessionId?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) return { error: '권한이 없습니다.' }

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { currentLevel: true, userId: true, user: { select: { academyId: true } } },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  // 적응형 레벨 테스트 생성
  const test = await prisma.test.create({
    data: {
      academyId: user.academyId,
      title: `레벨 테스트 (${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })})`,
      type: 'LEVEL_TEST',
      status: 'PUBLISHED',
      createdBy: user.id,
      isAdaptive: true,
      adaptiveConfig: {
        questionsPerDomain: 8,
        startLevel: student.currentLevel,
        domains: ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING'],
      },
      totalScore: 100,
      timeLimitMin: 40,
    },
  })

  // 학생 세션 생성
  const session = await prisma.testSession.create({
    data: {
      testId: test.id,
      studentId: input.studentId,
      status: 'NOT_STARTED',
      isPlacement: true,
    },
  })

  revalidatePath(`/teacher/students/${input.studentId}`)
  return { sessionId: session.id }
}
