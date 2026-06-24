import { redirect } from 'next/navigation'
import { BookOpen, Users, Star, TrendingUp, Activity } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getOwnerWordStats } from './_actions/report'
import { ClassComparisonChart } from './_components/owner-word-charts'

export default async function OwnerWordsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  const stats = await getOwnerWordStats()

  if (!stats) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400">
        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  const { summary, classComparison } = stats

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">단어학습 현황</h1>
        <p className="text-sm text-gray-400 mt-0.5">학원 전체 단어학습 통계</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Users className="w-4 h-4 text-[#1865F2]" />}
          label="전체 학생"
          value={summary.totalStudents}
          unit="명"
          bg="#EFF4FE"
        />
        <SummaryCard
          icon={<Activity className="w-4 h-4 text-[#1FAF54]" />}
          label="7일 활성"
          value={summary.activeStudents}
          unit="명"
          bg="#F0FDF4"
          sub={`전체의 ${summary.totalStudents > 0 ? Math.round((summary.activeStudents / summary.totalStudents) * 100) : 0}%`}
        />
        <SummaryCard
          icon={<BookOpen className="w-4 h-4 text-[#7854F7]" />}
          label="누적 학습"
          value={summary.totalLearned}
          unit="개"
          bg="#F3F0FF"
        />
        <SummaryCard
          icon={<Star className="w-4 h-4 text-[#FFB100]" />}
          label="마스터율"
          value={summary.masterRate}
          unit="%"
          bg="#FFFBEB"
          sub={`마스터 ${summary.totalMastered.toLocaleString()}개`}
        />
      </div>

      {/* 반별 비교 차트 */}
      {classComparison.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#1865F2]" />
            <p className="text-sm font-semibold text-gray-700">반별 학습 비교</p>
          </div>
          <ClassComparisonChart data={classComparison} />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
          <p className="text-sm">등록된 반이 없습니다.</p>
        </div>
      )}

      {/* 반별 상세 테이블 */}
      {classComparison.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">반별 상세 현황</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <th className="text-left px-5 py-3 font-medium">반 이름</th>
                  <th className="text-right px-4 py-3 font-medium">학생 수</th>
                  <th className="text-right px-4 py-3 font-medium">평균 학습</th>
                  <th className="text-right px-4 py-3 font-medium">평균 마스터</th>
                  <th className="text-right px-4 py-3 font-medium">평균 정답률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {classComparison.map((cls) => (
                  <tr key={cls.classId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{cls.className}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{cls.studentCount}명</td>
                    <td className="px-4 py-3 text-right text-gray-600">{cls.avgLearned.toLocaleString()}개</td>
                    <td className="px-4 py-3 text-right text-gray-600">{cls.avgMastered.toLocaleString()}개</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        cls.avgAccuracy >= 80
                          ? 'text-[#1FAF54]'
                          : cls.avgAccuracy >= 60
                          ? 'text-[#FFB100]'
                          : 'text-[#D92916]'
                      }`}
                    >
                      {cls.avgAccuracy}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  unit,
  bg,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: number
  unit: string
  bg: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: bg }}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value.toLocaleString()}
        <span className="text-sm font-medium text-gray-400 ml-0.5">{unit}</span>
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-300 mt-0.5">{sub}</p>}
    </div>
  )
}
