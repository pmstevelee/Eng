import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ClipboardList, Pencil } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getOwnerWordTestAssignments } from '../_actions/test'
import { DeleteTestButton } from './_components/delete-test-button'

const MODE_LABELS: Record<string, string> = {
  EN_TO_KO: '영→한',
  KO_TO_EN: '한→영',
  SPELL: '스펠링',
  MIXED: '혼합',
}

function getStatus(startsAt: Date | null, endsAt: Date | null) {
  const now = new Date()
  if (endsAt && now > endsAt) return { label: '마감', className: 'bg-gray-100 text-gray-500' }
  if (startsAt && now < startsAt) return { label: '예정', className: 'bg-[#FFB100]/10 text-[#FFB100]' }
  return { label: '진행중', className: 'bg-[#1FAF54]/10 text-[#1FAF54]' }
}

export default async function OwnerWordTestsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const assignments = await getOwnerWordTestAssignments()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/owner/words"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          단어학습 관리로
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">출제한 단어 시험</h1>
        <p className="text-sm text-gray-400 mt-1">내가 출제한 단어 시험을 확인하고 수정·삭제할 수 있습니다.</p>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400">아직 출제한 단어 시험이 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="divide-y divide-gray-100">
            {assignments.map((a) => {
              const status = getStatus(a.startsAt, a.endsAt)
              const targetCount = a._count.studentAssignments + a._count.classAssignments
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <Link
                    href={`/owner/words/sets/${a.wordSet.id}/test/${a.id}/results`}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {a.wordSet.title} · {MODE_LABELS[a.mode]} · 합격 {a.passingScore}% ·{' '}
                      {a.createdAt.toLocaleDateString('ko-KR')}
                    </p>
                  </Link>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                    {targetCount > 0 ? `배정 ${targetCount} · ` : ''}응시 {a._count.attempts}명
                  </span>
                  <Link href={`/owner/words/tests/${a.id}/edit`}>
                    <button
                      type="button"
                      className="h-9 w-9 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                  <DeleteTestButton testId={a.id} testTitle={a.title} hasAttempts={a._count.attempts > 0} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
