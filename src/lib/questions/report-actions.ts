'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { QuestionReportType, QuestionReportStatus } from '@/generated/prisma'

// ── 인증 헬퍼 ──────────────────────────────────────────────────────────────────

async function getAuthedUser() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  return user
}

// ── 문제 오류 신고 ─────────────────────────────────────────────────────────────

export type ReportQuestionInput = {
  questionId: string
  reportType: QuestionReportType
  description?: string
}

export async function reportQuestion(
  input: ReportQuestionInput,
): Promise<{ error?: string }> {
  const user = await getAuthedUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  if (!input.questionId) return { error: '문제 ID가 필요합니다.' }

  try {
    // 문제 존재 여부 확인
    const question = await prisma.question.findUnique({
      where: { id: input.questionId },
      select: { id: true },
    })
    if (!question) return { error: '문제를 찾을 수 없습니다.' }

    // 같은 사용자가 같은 문제에 중복 신고 방지 (PENDING 상태인 경우)
    const existing = await prisma.questionReport.findFirst({
      where: {
        questionId: input.questionId,
        reportedBy: user.id,
        status: 'PENDING',
      },
    })
    if (existing) return { error: '이미 신고한 문제입니다. 처리 완료 후 재신고할 수 있습니다.' }

    await prisma.questionReport.create({
      data: {
        questionId: input.questionId,
        reportedBy: user.id,
        reportType: input.reportType,
        description: input.description?.trim() || null,
        status: 'PENDING',
      },
    })

    return {}
  } catch {
    return { error: '신고 접수에 실패했습니다.' }
  }
}

// ── 신고 목록 조회 (어드민: 공용 문제) ────────────────────────────────────────

export type QuestionReportRow = {
  id: string
  questionId: string
  questionText: string
  questionDomain: string
  questionDifficulty: number
  isPublic: boolean
  reportType: QuestionReportType
  description: string | null
  status: QuestionReportStatus
  reporterName: string
  resolveNote: string | null
  createdAt: string
  resolvedAt: string | null
}

export async function getAdminQuestionReports(filters: {
  status?: QuestionReportStatus
}): Promise<QuestionReportRow[]> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return []

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true },
  })
  if (!user || user.role !== 'SUPER_ADMIN') return []

  const where: Record<string, unknown> = {
    question: { academyId: null }, // 공용 문제만
  }
  if (filters.status) where.status = filters.status

  const reports = await prisma.questionReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      questionId: true,
      reportType: true,
      description: true,
      status: true,
      resolveNote: true,
      createdAt: true,
      resolvedAt: true,
      reporter: { select: { name: true } },
      question: {
        select: {
          domain: true,
          difficulty: true,
          academyId: true,
          contentJson: true,
        },
      },
    },
  })

  return reports.map((r) => {
    const content = r.question.contentJson as { question_text?: string; instruction?: string }
    return {
      id: r.id,
      questionId: r.questionId,
      questionText: content.question_text || content.instruction || '(내용 없음)',
      questionDomain: r.question.domain,
      questionDifficulty: r.question.difficulty,
      isPublic: r.question.academyId === null,
      reportType: r.reportType,
      description: r.description,
      status: r.status,
      reporterName: r.reporter.name,
      resolveNote: r.resolveNote,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    }
  })
}

// ── 신고 목록 조회 (학원장: 학원 자체 문제) ────────────────────────────────────

export async function getOwnerQuestionReports(filters: {
  status?: QuestionReportStatus
}): Promise<QuestionReportRow[]> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return []

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return []

  const where: Record<string, unknown> = {
    question: { academyId: user.academyId },
  }
  if (filters.status) where.status = filters.status

  const reports = await prisma.questionReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      questionId: true,
      reportType: true,
      description: true,
      status: true,
      resolveNote: true,
      createdAt: true,
      resolvedAt: true,
      reporter: { select: { name: true } },
      question: {
        select: {
          domain: true,
          difficulty: true,
          academyId: true,
          contentJson: true,
        },
      },
    },
  })

  return reports.map((r) => {
    const content = r.question.contentJson as { question_text?: string; instruction?: string }
    return {
      id: r.id,
      questionId: r.questionId,
      questionText: content.question_text || content.instruction || '(내용 없음)',
      questionDomain: r.question.domain,
      questionDifficulty: r.question.difficulty,
      isPublic: r.question.academyId === null,
      reportType: r.reportType,
      description: r.description,
      status: r.status,
      reporterName: r.reporter.name,
      resolveNote: r.resolveNote,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    }
  })
}

// ── 신고 처리 (해결/반려) ──────────────────────────────────────────────────────

export async function resolveQuestionReport(
  reportId: string,
  action: 'RESOLVED' | 'DISMISSED',
  resolveNote?: string,
): Promise<{ error?: string }> {
  const user = await getAuthedUser()
  if (!user) return { error: '권한이 없습니다.' }
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ACADEMY_OWNER') {
    return { error: '권한이 없습니다.' }
  }

  try {
    const report = await prisma.questionReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        question: { select: { academyId: true } },
      },
    })
    if (!report) return { error: '신고를 찾을 수 없습니다.' }
    if (report.status !== 'PENDING') return { error: '이미 처리된 신고입니다.' }

    // 학원장은 자신의 학원 문제 신고만 처리 가능
    if (user.role === 'ACADEMY_OWNER') {
      if (report.question.academyId !== user.academyId) {
        return { error: '권한이 없습니다.' }
      }
    }

    await prisma.questionReport.update({
      where: { id: reportId },
      data: {
        status: action,
        resolvedBy: user.id,
        resolvedAt: new Date(),
        resolveNote: resolveNote?.trim() || null,
      },
    })

    // 페이지 캐시 무효화
    if (user.role === 'SUPER_ADMIN') {
      revalidatePath('/admin/question-bank')
    } else {
      revalidatePath('/owner/tests/questions')
    }

    return {}
  } catch {
    return { error: '처리에 실패했습니다.' }
  }
}

// ── 신고 건수 조회 (배지용) ────────────────────────────────────────────────────

export async function getPendingReportCount(): Promise<{
  adminCount: number
  ownerCount: number
}> {
  const user = await getAuthedUser()
  if (!user) return { adminCount: 0, ownerCount: 0 }

  if (user.role === 'SUPER_ADMIN') {
    const count = await prisma.questionReport.count({
      where: { status: 'PENDING', question: { academyId: null } },
    })
    return { adminCount: count, ownerCount: 0 }
  }

  if (user.role === 'ACADEMY_OWNER' && user.academyId) {
    const count = await prisma.questionReport.count({
      where: { status: 'PENDING', question: { academyId: user.academyId } },
    })
    return { adminCount: 0, ownerCount: count }
  }

  return { adminCount: 0, ownerCount: 0 }
}
