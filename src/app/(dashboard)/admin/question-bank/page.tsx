import Link from 'next/link'
import { Library, AlertTriangle, Star, TrendingUp, Database } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getQuestionBankOverview, getHeatmapData } from '@/lib/questions/cached-queries'
import { getAdminQuestions } from './actions'
import QuestionBankHeatmap from './_components/heatmap'
import AdminQuestionTable from './_components/admin-question-table'
import GenerateButton from './_components/generate-button'

export default async function AdminQuestionBankPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  const [overview, heatmapStats, questions] = await Promise.all([
    getQuestionBankOverview(),
    getHeatmapData(),
    getAdminQuestions({}),
  ])

  // 저품질 문제 수 (qualityScore < 0.4 또는 미집계)
  const lowQualityCount = questions.filter(
    (q) => q.qualityScore !== null && q.qualityScore < 0.4,
  ).length

  // 이번 달 AI 공유 추가
  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)
  const aiAddedThisMonth = questions.filter(
    (q) =>
      (q.source === 'AI_SHARED' || q.source === 'AI_GENERATED') &&
      new Date(q.createdAt) >= thisMonth,
  ).length

  const statCards = [
    {
      label: '공용 문제 총 수',
      value: overview.totalPublic.toLocaleString() + '개',
      icon: Database,
      color: '#1865F2',
      bg: '#EEF4FF',
    },
    {
      label: '이번 달 AI 공유 추가',
      value: `+${aiAddedThisMonth}개`,
      icon: TrendingUp,
      color: '#1FAF54',
      bg: '#EAFAF1',
    },
    {
      label: '평균 품질 점수',
      value: overview.avgQuality > 0 ? `${overview.avgQuality.toFixed(2)}/1.0` : '-',
      icon: Star,
      color: '#FFB100',
      bg: '#FFF8E6',
    },
    {
      label: '저품질 문제 경고',
      value: `${lowQualityCount}개`,
      icon: AlertTriangle,
      color: '#D92916',
      bg: '#FEF2F0',
    },
  ]

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <Library size={20} className="text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">문제 뱅크 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">공용 문제를 관리하고 품질을 유지하세요.</p>
          </div>
        </div>
        <Link
          href="/admin/question-bank/quality"
          className="text-sm text-primary-700 font-medium hover:underline"
        >
          품질 관리 →
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: card.bg }}
                >
                  <Icon size={16} style={{ color: card.color }} />
                </div>
                <span className="text-xs text-gray-500">{card.label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: card.color }}>
                {card.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* 영역별 요약 */}
      <div className="grid grid-cols-5 gap-3">
        {(
          [
            { label: '문법', key: 'GRAMMAR', color: '#1865F2' },
            { label: '어휘', key: 'VOCABULARY', color: '#7854F7' },
            { label: '읽기', key: 'READING', color: '#0FBFAD' },
            { label: '쓰기', key: 'WRITING', color: '#E35C20' },
            { label: '듣기', key: 'LISTENING', color: '#1FAF54' },
          ] as const
        ).map((d) => (
          <div key={d.key} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {d.label}
              </span>
            </div>
            <p className="text-xl font-bold" style={{ color: d.color }}>
              {overview.byDomain[d.key]}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">문제</p>
          </div>
        ))}
      </div>

      {/* 히트맵 + AI 생성 버튼 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
        <QuestionBankHeatmap data={heatmapStats} />

        <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">AI 자동 생성</h2>
            <p className="text-xs text-gray-400 mt-1">
              히트맵에서 10개 미만인 영역을 자동 감지하여 문제를 생성합니다.
              한 번에 최대 3개 영역을 처리합니다.
            </p>
          </div>
          <GenerateButton />
        </div>
      </div>

      {/* 문제 목록 */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">공용 문제 목록</h2>
        <AdminQuestionTable initialQuestions={questions} />
      </div>
    </div>
  )
}
