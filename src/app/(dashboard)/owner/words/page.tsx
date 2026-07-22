import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Users, Star, TrendingUp, Activity, Plus } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { Button } from '@/components/ui/button'
import { getOwnerWordStats } from './_actions/report'
import { ClassComparisonChart } from './_components/owner-word-charts'
import { OwnerSetsList } from './_components/owner-sets-list'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

const SOURCE_LABEL: Record<string, string> = {
  PUBLISHER: '시스템',
  TEACHER: '학원 제작',
  AI_GENERATED: 'AI 자동',
  OXFORD_3000: 'Oxford 3000',
  OXFORD_5000: 'Oxford 5000',
}

const CEFR_MAP: Record<number, string> = {
  1: 'Pre-A1', 2: 'A1', 3: 'A1+', 4: 'A2', 5: 'A2+',
  6: 'B1', 7: 'B1+', 8: 'B2', 9: 'B2+', 10: 'C1',
}

export default async function OwnerWordsPage({ searchParams }: Props) {
  const { tab } = await searchParams
  const activeTab = tab === 'sets' ? 'sets' : 'stats'

  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">단어학습 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">학원 전체 단어학습 현황 및 세트 관리</p>
        </div>
        {activeTab === 'sets' && (
          <Link href="/owner/words/sets/new">
            <Button size="sm" className="h-9 gap-2 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white">
              <Plus className="w-4 h-4" />
              세트 만들기
            </Button>
          </Link>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200">
        <Link
          href="/owner/words?tab=stats"
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === 'stats'
              ? 'border-[#1865F2] text-[#1865F2]'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          학습 현황
        </Link>
        <Link
          href="/owner/words?tab=sets"
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === 'sets'
              ? 'border-[#1865F2] text-[#1865F2]'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          세트 관리
        </Link>
      </div>

      {activeTab === 'stats' ? (
        <StatsTab />
      ) : (
        <SetsTab academyId={user.academyId} />
      )}
    </div>
  )
}

async function StatsTab() {
  const stats = await getOwnerWordStats()

  if (!stats) {
    return (
      <div className="py-16 text-center text-gray-400">
        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  const { summary, classComparison } = stats

  return (
    <div className="space-y-6">
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

async function SetsTab({ academyId }: { academyId: string }) {
  const wordSets = await prisma.wordSet.findMany({
    where: {
      AND: [
        { OR: [{ academyId }, { isPublic: true }] },
        { source: { notIn: ['OXFORD_3000', 'OXFORD_5000'] } },
      ],
    },
    select: {
      id: true,
      title: true,
      cefrLevel: true,
      source: true,
      _count: { select: { items: true } },
    },
    orderBy: [{ source: 'asc' }, { cefrLevel: 'asc' }],
  })

  const systemSets = wordSets.filter((s) => s.source === 'PUBLISHER')
  const customSets = wordSets.filter((s) => s.source !== 'PUBLISHER')

  return (
    <div className="space-y-6">
      {/* 학원 제작 세트 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">학원 제작 세트</h2>
          <Link href="/owner/words/sets/new" className="text-xs text-[#1865F2] font-medium hover:underline">
            + 새 세트
          </Link>
        </div>
        {customSets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400 mb-3">아직 만든 세트가 없습니다.</p>
            <Link href="/owner/words/sets/new">
              <Button size="sm" className="h-9 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white">
                <Plus className="w-4 h-4 mr-1" />
                첫 세트 만들기
              </Button>
            </Link>
          </div>
        ) : (
          <OwnerSetsList sets={customSets} />
        )}
      </section>

      {/* 시스템 기본 세트 */}
      {systemSets.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Oxford 기본 제공 세트
            <span className="ml-2 text-xs font-normal text-gray-400">(시스템 자동 생성)</span>
          </h2>
          <div className="space-y-2">
            {systemSets.map((set) => (
              <div
                key={set.id}
                className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-[#1865F2] bg-[#1865F2]/10 px-2 py-0.5 rounded-full">
                      {CEFR_MAP[set.cefrLevel] ?? `Lv${set.cefrLevel}`}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{set.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{set._count.items}단어</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {wordSets.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400 mb-1">등록된 단어 세트가 없습니다.</p>
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
