'use server'

import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'

async function getAuthedOwner() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return null
  return user
}

export type AcademyWordSummary = {
  totalStudents: number
  activeStudents: number // 최근 7일 내 학습
  totalLearned: number
  totalMastered: number
  masterRate: number
}

export type ClassWordComparison = {
  classId: string
  className: string
  studentCount: number
  avgLearned: number
  avgMastered: number
  avgAccuracy: number
}

export type OwnerWordStats = {
  summary: AcademyWordSummary
  classComparison: ClassWordComparison[]
}

export async function getOwnerWordStats(): Promise<OwnerWordStats | null> {
  const owner = await getAuthedOwner()
  if (!owner) return null

  const academyId = owner.academyId!
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const students = await prisma.student.findMany({
    where: { user: { academyId, isDeleted: false }, status: 'ACTIVE' },
    select: {
      id: true,
      classId: true,
      wordProgress: {
        select: {
          stage: true,
          wrongCount: true,
          correctCount: true,
          lastStudiedAt: true,
        },
      },
    },
  })

  const totalStudents = students.length
  const activeStudents = students.filter((s) =>
    s.wordProgress.some((p) => p.lastStudiedAt && p.lastStudiedAt >= sevenDaysAgo),
  ).length

  const totalLearned = students.reduce((sum, s) => sum + s.wordProgress.length, 0)
  const totalMastered = students.reduce(
    (sum, s) => sum + s.wordProgress.filter((p) => p.stage === 'MASTERED').length,
    0,
  )
  const masterRate = totalLearned > 0 ? Math.round((totalMastered / totalLearned) * 100) : 0

  // 반별 비교
  const classes = await prisma.class.findMany({
    where: { academyId, isActive: true },
    select: { id: true, name: true },
  })

  const classComparison: ClassWordComparison[] = classes.map((cls) => {
    const classStudents = students.filter((s) => s.classId === cls.id)
    const count = classStudents.length
    if (count === 0) {
      return { classId: cls.id, className: cls.name, studentCount: 0, avgLearned: 0, avgMastered: 0, avgAccuracy: 0 }
    }
    const avgLearned = Math.round(classStudents.reduce((s, st) => s + st.wordProgress.length, 0) / count)
    const avgMastered = Math.round(
      classStudents.reduce((s, st) => s + st.wordProgress.filter((p) => p.stage === 'MASTERED').length, 0) / count,
    )
    const totalAnswers = classStudents.reduce(
      (s, st) => s + st.wordProgress.reduce((ss, p) => ss + p.correctCount + p.wrongCount, 0),
      0,
    )
    const totalCorrect = classStudents.reduce(
      (s, st) => s + st.wordProgress.reduce((ss, p) => ss + p.correctCount, 0),
      0,
    )
    const avgAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0

    return { classId: cls.id, className: cls.name, studentCount: count, avgLearned, avgMastered, avgAccuracy }
  })

  return {
    summary: { totalStudents, activeStudents, totalLearned, totalMastered, masterRate },
    classComparison,
  }
}
