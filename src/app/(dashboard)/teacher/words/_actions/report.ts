'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'

async function getAuthedTeacher() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null
  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'TEACHER' || !user.academyId) return null
  return user
}

export type StudentWordRow = {
  studentId: string
  name: string
  learned: number
  mastered: number
  lastStudiedAt: string | null
  avgAccuracy: number
}

export type ClassWeakWord = {
  word: string
  meaning: string | null
  totalWrong: number
  affectedStudents: number
}

export type PendingTest = {
  assignmentId: string
  title: string
  endsAt: string | null
  notSubmittedCount: number
  totalAssigned: number
}

export type ClassWordStats = {
  students: StudentWordRow[]
  weakWords: ClassWeakWord[]
  pendingTests: PendingTest[]
  promotionCandidates: { studentId: string; name: string; currentLevel: number }[]
}

export async function getClassWordStats(classId: string): Promise<ClassWordStats | null> {
  const teacher = await getAuthedTeacher()
  if (!teacher) return null

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId: teacher.academyId! },
    select: { id: true },
  })
  if (!cls) return null

  const enrollments = await prisma.enrollment.findMany({
    where: { classId },
    select: {
      student: {
        select: {
          id: true,
          currentLevel: true,
          user: { select: { name: true } },
          wordProgress: {
            select: {
              stage: true,
              wrongCount: true,
              correctCount: true,
              lastStudiedAt: true,
              word: { select: { term: true, meaning: true } },
            },
          },
        },
      },
    },
  })

  const students: StudentWordRow[] = enrollments.map(({ student }) => {
    const wp = student.wordProgress
    const totalAnswers = wp.reduce((s, p) => s + p.correctCount + p.wrongCount, 0)
    const totalCorrect = wp.reduce((s, p) => s + p.correctCount, 0)
    const mastered = wp.filter((p) => p.stage === 'MASTERED').length
    const lastStudied = wp
      .map((p) => p.lastStudiedAt)
      .filter(Boolean)
      .sort((a, b) => (b! > a! ? 1 : -1))[0]

    return {
      studentId: student.id,
      name: student.user.name ?? '(이름없음)',
      learned: wp.length,
      mastered,
      lastStudiedAt: lastStudied ? lastStudied.toISOString().slice(0, 10) : null,
      avgAccuracy: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
    }
  })

  // 반 약점 단어 TOP20
  const wordMap = new Map<string, { meaning: string | null; totalWrong: number; students: Set<string> }>()
  for (const { student } of enrollments) {
    for (const p of student.wordProgress) {
      if (p.wrongCount === 0) continue
      const existing = wordMap.get(p.word.term)
      if (existing) {
        existing.totalWrong += p.wrongCount
        existing.students.add(student.id)
      } else {
        wordMap.set(p.word.term, { meaning: p.word.meaning, totalWrong: p.wrongCount, students: new Set([student.id]) })
      }
    }
  }
  const weakWords: ClassWeakWord[] = Array.from(wordMap.entries())
    .sort((a, b) => b[1].totalWrong - a[1].totalWrong)
    .slice(0, 20)
    .map(([word, data]) => ({
      word,
      meaning: data.meaning,
      totalWrong: data.totalWrong,
      affectedStudents: data.students.size,
    }))

  // 미응시 시험
  const classStudentIds = enrollments.map((e) => e.student.id)
  const assignments = await prisma.wordTestAssignment.findMany({
    where: {
      academyId: teacher.academyId!,
      classAssignments: { some: { classId } },
    },
    select: {
      id: true,
      title: true,
      endsAt: true,
      attempts: { where: { studentId: { in: classStudentIds } }, select: { studentId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const totalInClass = enrollments.length
  const pendingTests: PendingTest[] = assignments
    .map((a) => ({
      assignmentId: a.id,
      title: a.title,
      endsAt: a.endsAt ? a.endsAt.toISOString() : null,
      notSubmittedCount: totalInClass - a.attempts.length,
      totalAssigned: totalInClass,
    }))
    .filter((t) => t.notSubmittedCount > 0)

  // 승급 후보: 현재 레벨 기준 평균 정답률 80% 이상
  const promotionCandidates = students
    .filter((s) => s.avgAccuracy >= 80 && s.mastered >= 30)
    .map((s) => ({
      studentId: s.studentId,
      name: s.name,
      currentLevel: enrollments.find((e) => e.student.id === s.studentId)?.student.currentLevel ?? 1,
    }))

  return { students, weakWords, pendingTests, promotionCandidates }
}

export async function getTeacherClasses() {
  const teacher = await getAuthedTeacher()
  if (!teacher) return []

  return prisma.class.findMany({
    where: { academyId: teacher.academyId!, isActive: true },
    select: { id: true, name: true, _count: { select: { students: true } } },
    orderBy: { name: 'asc' },
  })
}
