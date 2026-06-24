import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, BookOpen, Star, TrendingUp, Flame, ChevronRight } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getStudentWordStats } from '../_actions/report'
import { CefrProgressChart, WeeklyActivityHeatmap } from './_components/report-charts'

export default async function StudentWordReportPage() {
  const { studentId } = await requireStudent().catch(() => ({ studentId: null }))
  if (!studentId) redirect('/login')

  const stats = await getStudentWordStats()

  const masterRate = stats.totalLearned > 0
    ? Math.round((stats.totalMastered / stats.totalLearned) * 100)
    : 0

  const weekStreak = stats.weeklyActivity.filter((d) => d.count > 0).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/student/words" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">단어학습 리포트</h1>
          <p className="text-sm text-gray-400 mt-0.5">내 학습 현황을 확인하세요</p>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-[#1865F2]" />}
          label="학습 단어"
          value={stats.totalLearned.toLocaleString()}
          unit="개"
          bg="#EFF4FE"
        />
        <StatCard
          icon={<Star className="w-5 h-5 text-[#7854F7]" />}
          label="마스터"
          value={stats.totalMastered.toLocaleString()}
          unit="개"
          bg="#F3F0FF"
        />
        <StatCard
          icon={<Flame className="w-5 h-5 text-[#E35C20]" />}
          label="7일 활동"
          value={String(weekStreak)}
          unit="일"
          bg="#FEF3EC"
        />
      </div>

      {/* 마스터율 게이지 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">마스터율</p>
          <span className="text-lg font-bold text-[#1865F2]">{masterRate}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1865F2] transition-all"
            style={{ width: `${masterRate}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          전체 {stats.totalLearned}개 중 {stats.totalMastered}개 마스터
        </p>
      </div>

      {/* CEFR 레벨별 진도 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#1865F2]" />
          <p className="text-sm font-semibold text-gray-700">레벨별 학습 현황</p>
        </div>
        <div className="flex gap-4 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#DDE8FD]" />학습
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#1865F2]" />마스터
          </span>
        </div>
        <CefrProgressChart data={stats.cefrProgress} />
      </div>

      {/* 최근 7일 활동 히트맵 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">최근 7일 활동</p>
        <WeeklyActivityHeatmap data={stats.weeklyActivity} />
      </div>

      {/* 약점 단어 TOP10 */}
      {stats.weakWords.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">
            약점 단어 TOP{stats.weakWords.length}
          </p>
          <div className="space-y-2">
            {stats.weakWords.map((w, i) => (
              <div key={w.word} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: i < 3 ? '#FEF3EC' : '#F9FAFB', color: i < 3 ? '#E35C20' : '#9CA3AF' }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{w.word}</p>
                  {w.meaning && <p className="text-xs text-gray-400 truncate">{w.meaning}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-[#D92916] font-medium">오답 {w.wrongCount}회</p>
                  <p className="text-xs text-gray-400">정답 {w.correctCount}회</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 다음 추천 세트 */}
      {stats.nextRecommendedSet && (
        <div className="rounded-xl border border-[#1865F2]/20 bg-[#EFF4FE] p-5">
          <p className="text-xs font-semibold text-[#1865F2] mb-2 uppercase tracking-wide">다음 추천 세트</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">{stats.nextRecommendedSet.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {stats.nextRecommendedSet.itemCount}개 단어 · 레벨 {stats.nextRecommendedSet.cefrLevel}
              </p>
            </div>
            <Link
              href={`/student/words/${stats.nextRecommendedSet.id}/flashcard`}
              className="flex items-center gap-1 bg-[#1865F2] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1865F2]/90 transition-colors"
            >
              학습하기
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  unit,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  bg: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">
          {value}
          <span className="text-sm font-medium text-gray-400 ml-0.5">{unit}</span>
        </p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  )
}
