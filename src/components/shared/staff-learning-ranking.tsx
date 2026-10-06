import Link from 'next/link'
import { Trophy } from 'lucide-react'
import {
  getLearningRanking,
  parseRankingPeriod,
  type RankingPeriod,
  type RankingScope,
} from '@/lib/learning/ranking'
import { LearningRankingBoard } from '@/components/shared/learning-ranking-board'

// 학원장·교사용 학습 랭킹 화면 (학원 전체 / 반별)

export async function StaffLearningRanking({
  academyId,
  classes,
  basePath,
  period: periodParam,
  classId: classParam,
}: {
  academyId: string
  classes: { id: string; name: string }[]
  basePath: string
  period?: string
  classId?: string
}) {
  const period = parseRankingPeriod(periodParam)
  const classId = classes.some((c) => c.id === classParam) ? (classParam ?? null) : null
  const scope: RankingScope = classId ? 'class' : 'academy'

  const result = await getLearningRanking({ scope, period, academyId, classId, viewer: null })

  const query = (p: RankingPeriod, cls: string | null) =>
    `${basePath}?period=${p}${cls ? `&class=${cls}` : ''}`
  const hrefFor = (p: RankingPeriod) => query(p, classId)

  const classFilter =
    classes.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        <Link
          href={query(period, null)}
          className={`flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold ${
            !classId ? 'border-[#1865F2] bg-[#1865F2] text-white' : 'border-gray-200 bg-white text-gray-500'
          }`}
        >
          학원 전체
        </Link>
        {classes.map((c) => (
          <Link
            key={c.id}
            href={query(period, c.id)}
            className={`flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold ${
              classId === c.id ? 'border-[#1865F2] bg-[#1865F2] text-white' : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>
    ) : null

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFB100]">
          <Trophy size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">학습 랭킹</h1>
          <p className="mt-1 text-sm text-gray-500">
            학생들의 단어·문법 학습량과 포인트 순위입니다. 학생 화면에도 같은 랭킹이 보여요.
          </p>
        </div>
      </div>
      <LearningRankingBoard result={result} scopes={[scope]} hrefFor={hrefFor} extraFilter={classFilter} />
    </div>
  )
}
