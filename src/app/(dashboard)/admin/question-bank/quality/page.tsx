import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getLowQualityQuestions } from './actions'
import QualityList from './_components/quality-list'

export default async function QualityManagementPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  const questions = await getLowQualityQuestions()

  const increaseCount = questions.filter((q) => q.recommendation === 'increase_difficulty').length
  const decreaseCount = questions.filter((q) => q.recommendation === 'decrease_difficulty').length
  const lowCount = questions.filter((q) => q.recommendation === 'low_quality').length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/question-bank"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
          <ShieldCheck size={20} className="text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">품질 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">저품질 문제 검토 및 난이도 자동 보정</p>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">너무 쉬운 문제 (정답률 95%+)</p>
          <p className="text-2xl font-bold text-amber-500">{increaseCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">난이도 상향 권고</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">너무 어려운 문제 (정답률 5% 이하)</p>
          <p className="text-2xl font-bold text-blue-500">{decreaseCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">난이도 하향 권고</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">저품질 문제 (점수 0.4 미만)</p>
          <p className="text-2xl font-bold text-red-500">{lowCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">비활성화 권고</p>
        </div>
      </div>

      {/* 문제 목록 + 자동 보정 */}
      <QualityList questions={questions} />
    </div>
  )
}
