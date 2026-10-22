import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { prisma } from '@/lib/prisma/client'
import { getStudentFlashcardQuota, isStudentAiFlashcardEnabled } from '@/lib/student-credits/wallet'
import { StudentCreditPackages } from './_components/student-credit-packages'

export const metadata = { title: '내 크레딧' }

const TX_LABEL: Record<string, string> = { CHARGE: '충전', USE: '사용', REFUND: '결제 취소', ADMIN_ADJUST: '조정' }

const DATE_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default async function StudentCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ charged?: string; error?: string }>
}) {
  const { user, studentId } = await requireStudent()
  if (!(await isStudentAiFlashcardEnabled(user.academyId))) redirect('/student/words')

  const params = await searchParams
  const [quota, transactions] = await Promise.all([
    getStudentFlashcardQuota(studentId),
    prisma.studentCreditTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, type: true, amount: true, balanceAfter: true, memo: true, createdAt: true },
    }),
  ])
  const charged = Number(params.charged)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">내 크레딧</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI 플래시카드를 만들 때 쓰는 학습 크레딧입니다. 충전한 크레딧은 만료되지 않습니다.
        </p>
      </div>

      {Number.isInteger(charged) && charged > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-accent-green">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {charged.toLocaleString('ko-KR')} 크레딧이 충전되었습니다.
        </div>
      )}
      {params.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-accent-red">
          {params.error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">현재 잔액</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {quota.creditBalance.toLocaleString('ko-KR')}
              <span className="ml-1 text-base font-medium text-gray-500">크레딧</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              이번 달 무료 {quota.remainingFree}/{quota.freeLimit}단어 남음 · 무료를 다 쓰면 단어당 {quota.creditPerWord}크레딧
            </p>
          </div>
          <Link
            href="/student/words/ai"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-accent-purple/30 px-4 text-sm font-semibold text-accent-purple hover:bg-accent-purple/5"
          >
            <Sparkles size={16} /> AI 플래시카드 만들기
          </Link>
        </div>
      </section>

      <section id="charge" className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">충전하기</h2>
        <StudentCreditPackages creditPerWord={quota.creditPerWord} customerName={user.name} customerEmail={user.email} />
        <p className="text-xs text-gray-500">
          만 19세 미만은 보호자 동의 후 결제해주세요. 사용하지 않은 크레딧의 환불은 학원으로 문의해주세요.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">최근 내역</h2>
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
            아직 충전·사용 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">일시</th>
                  <th className="px-4 py-2 text-left font-medium">내용</th>
                  <th className="px-4 py-2 text-right font-medium">크레딧</th>
                  <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">잔액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{DATE_FMT.format(t.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {TX_LABEL[t.type] ?? t.type}
                      {t.memo && <span className="ml-1 text-gray-500">· {t.memo}</span>}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${t.amount >= 0 ? 'text-accent-green' : 'text-gray-900'}`}>
                      {t.amount >= 0 ? '+' : ''}
                      {t.amount.toLocaleString('ko-KR')}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-gray-500 sm:table-cell">
                      {t.balanceAfter.toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
