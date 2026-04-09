import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, PenLine, History } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { calculateDomainLevels } from '@/lib/ai/domain-level-calculator'
import { getLevelInfo } from '@/lib/constants/levels'
import { WritingClient } from './_components/writing-client'
import type { StudentProfileForWriting } from './_components/writing-client'

export default async function WritingPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

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

  // 최근 스킬 평가 점수 조회 (최근 쓰기 점수 추이용)
  const recentWriting = await prisma.skillAssessment.findMany({
    where: { studentId, domain: 'WRITING', score: { not: null } },
    orderBy: { assessedAt: 'desc' },
    take: 5,
    select: { score: true },
  })
  const recentWritingScores = recentWriting.map((r) => r.score as number)

  // 5영역 10단계 레벨 계산 (듣기는 데이터 없으면 null)
  const domainLevels = await calculateDomainLevels(studentId)

  // currentLevel은 10단계 기준으로 보정 (1~10)
  const safeLevel = Math.min(Math.max(currentLevel, 1), 10)
  const levelInfo = getLevelInfo(safeLevel)

  const studentProfile: StudentProfileForWriting = {
    currentLevel: safeLevel,
    cefrLevel: levelInfo.cefr,
    grammarAvg: domainLevels.grammar.score || null,
    vocabAvg: domainLevels.vocabulary.score || null,
    readingAvg: domainLevels.reading.score || null,
    writingAvg: domainLevels.writing.score || null,
    recentWritingScores,
    domainLevels,
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
            Level {safeLevel} ({levelInfo.cefr}) · 레벨 맞춤 주제
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
          <p className="text-sm font-semibold text-gray-900">AI 10단계 쓰기 레벨 평가</p>
          <p className="text-xs text-gray-500">
            에세이 실력을 독립적으로 판정하고, 4영역 간 레벨 격차를 분석해 드립니다
          </p>
        </div>
      </div>

      <WritingClient studentProfile={studentProfile} />
    </div>
  )
}
