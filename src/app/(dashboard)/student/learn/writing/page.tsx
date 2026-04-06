import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, PenLine, History } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { WritingClient } from './_components/writing-client'
import type { StudentProfileForWriting } from './_components/writing-client'

const CEFR_MAP: Record<number, string> = {
  1: 'Pre-A1',
  2: 'A1-A2',
  3: 'B1',
  4: 'B2',
  5: 'C1-C2',
}

export default async function WritingPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  // 학생 레코드 조회
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id, isDeleted: false },
    select: {
      student: {
        select: { id: true, currentLevel: true },
      },
    },
  })

  if (!dbUser?.student) redirect('/login')
  const { id: studentId, currentLevel } = dbUser.student

  // 최근 스킬 평가 점수 조회
  const skillAssessments = await prisma.skillAssessment.findMany({
    where: { studentId },
    orderBy: { assessedAt: 'desc' },
    take: 50,
    select: { domain: true, score: true },
  })

  // 도메인별 최신 점수 추출
  const latestByDomain: Record<string, number | null> = {}
  for (const sa of skillAssessments) {
    if (!(sa.domain in latestByDomain)) {
      latestByDomain[sa.domain] = sa.score
    }
  }

  // 최근 쓰기 점수 추이 (최근 5회)
  const recentWritingScores = skillAssessments
    .filter((sa) => sa.domain === 'WRITING' && sa.score !== null)
    .slice(0, 5)
    .map((sa) => sa.score as number)

  const studentProfile: StudentProfileForWriting = {
    currentLevel: Math.min(Math.max(currentLevel, 1), 5),
    cefrLevel: CEFR_MAP[currentLevel] ?? 'Pre-A1',
    grammarAvg: latestByDomain['GRAMMAR'] ?? null,
    vocabAvg: latestByDomain['VOCABULARY'] ?? null,
    readingAvg: latestByDomain['READING'] ?? null,
    writingAvg: latestByDomain['WRITING'] ?? null,
    recentWritingScores,
  }

  return (
    <div className="space-y-4">
      {/* 뒤로가기 + 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/student/learn"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">쓰기 연습</h1>
          <p className="text-xs text-gray-500">
            Level {studentProfile.currentLevel} ({studentProfile.cefrLevel}) · 레벨 맞춤 주제
          </p>
        </div>
        <Link
          href="/student/learn/writing/history"
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <History className="h-4 w-4" />
          이력
        </Link>
      </div>

      {/* 안내 배너 */}
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
        style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#E35C20' }}
        >
          <PenLine className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">AI 맞춤형 쓰기 평가</p>
          <p className="text-xs text-gray-500">
            현재 레벨 기준으로 문법·구성·어휘·표현을 평가하고 레벨업 전략을 제시해 드립니다
          </p>
        </div>
      </div>

      <WritingClient studentProfile={studentProfile} />
    </div>
  )
}
