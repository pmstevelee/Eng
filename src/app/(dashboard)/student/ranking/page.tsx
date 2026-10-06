import { Trophy } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { prisma } from '@/lib/prisma/client'
import {
  getLearningRanking,
  parseRankingPeriod,
  parseRankingScope,
  type RankingPeriod,
  type RankingScope,
} from '@/lib/learning/ranking'
import { getAcademyWordLearningSettings } from '@/lib/words/access-guard'
import { LearningRankingBoard } from '@/components/shared/learning-ranking-board'

interface Props {
  searchParams: Promise<{ period?: string; scope?: string }>
}

export default async function StudentRankingPage({ searchParams }: Props) {
  const [{ user, studentId }, params] = await Promise.all([requireStudent(), searchParams])
  const academyId = user.academyId

  const [student, settings] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { currentLevel: true, classId: true, class: { select: { name: true } } },
    }),
    academyId ? getAcademyWordLearningSettings(academyId) : null,
  ])

  const scopes: RankingScope[] = [
    ...(student?.classId ? (['class'] as const) : []),
    'academy',
    ...(settings?.globalRanking !== false ? (['global'] as const) : []),
  ]
  const requested = parseRankingScope(params.scope)
  const scope = scopes.includes(requested) ? requested : 'academy'
  const period = parseRankingPeriod(params.period)

  const result = await getLearningRanking({
    scope,
    period,
    academyId,
    classId: student?.classId ?? null,
    viewer: {
      studentId,
      name: user.name,
      level: student?.currentLevel ?? 1,
      className: student?.class?.name ?? null,
    },
  })

  const hrefFor = (p: RankingPeriod, s: RankingScope) => `/student/ranking?period=${p}&scope=${s}`

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFB100]">
          <Trophy size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">학습 랭킹</h1>
          <p className="mt-1 text-sm text-gray-500">매일 꾸준히 학습하고 포인트를 모아 순위를 올려 보세요</p>
        </div>
      </div>

      <LearningRankingBoard result={result} scopes={scopes} hrefFor={hrefFor} maskedNotice={result.scope === 'global'} />
    </div>
  )
}
