import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Search, UserRound } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { formatCredits } from '@/lib/credits/constants'
import { parseStudentPaidFeatures } from '@/lib/student-credits/constants'
import { cn } from '@/lib/utils'
import { StudentCreditAdjustForm } from './_components/student-credit-adjust-form'

export const metadata = { title: '학생 크레딧 — EduLevel Admin' }

const TX_LABEL: Record<string, string> = { CHARGE: '충전', USE: '사용', REFUND: '결제 취소', ADMIN_ADJUST: '관리자 조정' }

const DATE_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const studentSelect = {
  id: true,
  user: { select: { name: true, email: true, academy: { select: { name: true, businessName: true } } } },
  creditWallet: { select: { balance: true } },
} as const

type StudentListRow = { id: string; name: string; email: string; academyName: string; balance: number }

async function findStudents(q: string): Promise<StudentListRow[]> {
  // 검색어가 없으면 크레딧 지갑이 있는 학생을 최근 변동 순으로
  const students = q
    ? await prisma.student.findMany({
        where: {
          user: {
            role: 'STUDENT',
            isDeleted: false,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: studentSelect,
      })
    : (
        await prisma.studentCreditWallet.findMany({
          where: { student: { user: { isDeleted: false } } },
          orderBy: { updatedAt: 'desc' },
          take: 50,
          select: { student: { select: studentSelect } },
        })
      ).map((w) => w.student)

  return students.map((s) => ({
    id: s.id,
    name: s.user.name,
    email: s.user.email,
    academyName: s.user.academy ? (s.user.academy.businessName ?? s.user.academy.name) : '-',
    balance: s.creditWallet?.balance ?? 0,
  }))
}

async function getStudentDetail(studentId: string) {
  const [student, transactions] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, user: { role: 'STUDENT', isDeleted: false } },
      select: {
        id: true,
        grade: true,
        status: true,
        user: {
          select: {
            name: true,
            email: true,
            academy: { select: { name: true, businessName: true, settingsJson: true } },
          },
        },
        creditWallet: { select: { balance: true } },
      },
    }),
    prisma.studentCreditTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, type: true, amount: true, balanceAfter: true, memo: true, createdAt: true },
    }),
  ])
  return student ? { student, transactions } : null
}

function hrefFor(q: string, id?: string) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (id) params.set('id', id)
  const s = params.toString()
  return `/admin/credits/students${s ? `?${s}` : ''}`
}

export default async function AdminStudentCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string }>
}) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 100)
  const selectedId = params.id ?? ''

  const [rows, detail] = await Promise.all([findStudents(q), selectedId ? getStudentDetail(selectedId) : null])

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Link href="/admin/credits" className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline">
          <ArrowLeft size={14} /> 크레딧
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">학생 크레딧</h1>
        <p className="text-sm text-gray-500 mt-1">
          학생 개인 크레딧(AI 플래시카드용)을 학생 아이디로 찾아 직접 지급·차감하고 사용 내역을 확인합니다. 학원 통합 크레딧과는
          별개입니다.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* 학생 검색 · 목록 */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <form action="/admin/credits/students" method="get" className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="학생 이름 또는 아이디(이메일)"
                aria-label="학생 검색"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
              />
            </div>
            <button type="submit" className="h-11 shrink-0 rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white">
              검색
            </button>
          </form>
          <p className="mt-4 mb-2 text-xs font-semibold text-gray-500">
            {q ? `검색 결과 ${rows.length}명${rows.length === 50 ? ' (상위 50명)' : ''}` : '최근 크레딧 변동 학생'}
          </p>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={hrefFor(q, r.id)}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50',
                    r.id === selectedId && 'bg-primary-100/40',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{r.name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {r.email} · {r.academyName}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{formatCredits(r.balance)}</span>
                </Link>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-gray-500">
                {q ? '검색 결과가 없습니다.' : '아직 크레딧이 있는 학생이 없습니다. 학생을 검색해 지급해보세요.'}
              </li>
            )}
          </ul>
        </section>

        {/* 선택한 학생 */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
          {!detail ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UserRound size={36} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                {selectedId ? '학생을 찾을 수 없습니다.' : '왼쪽에서 학생을 선택하면 잔액 조정과 사용 내역을 볼 수 있습니다.'}
              </p>
            </div>
          ) : (
            <StudentDetail detail={detail} />
          )}
        </section>
      </div>
    </div>
  )
}

function StudentDetail({ detail }: { detail: NonNullable<Awaited<ReturnType<typeof getStudentDetail>>> }) {
  const { student, transactions } = detail
  const academy = student.user.academy
  const enabled = parseStudentPaidFeatures(academy?.settingsJson).aiFlashcard
  const balance = student.creditWallet?.balance ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900">{student.user.name}</p>
          <p className="text-sm text-gray-500 break-all">{student.user.email}</p>
          <p className="mt-1 text-sm text-gray-500">
            {academy ? (academy.businessName ?? academy.name) : '소속 학원 없음'}
            {student.grade ? ` · ${student.grade}` : ''}
            {student.status !== 'ACTIVE' && (
              <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">비활성</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">현재 잔액</p>
          <p className="text-3xl font-bold tabular-nums text-gray-900">
            {formatCredits(balance)}
            <span className="ml-1 text-base font-medium text-gray-500">크레딧</span>
          </p>
        </div>
      </div>

      {!enabled && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-gray-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-gold" />
          이 학생의 학원은 학생 결제(AI 플래시카드) 기능이 꺼져 있어, 지급해도 학생이 크레딧을 사용할 수 없습니다.
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-bold text-gray-900">크레딧 지급 · 차감</h2>
        <StudentCreditAdjustForm key={student.id} studentId={student.id} balance={balance} />
      </div>

      <div>
        <h2 className="mb-3 text-base font-bold text-gray-900">최근 사용 내역</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
              <tr>
                <th className="px-4 py-3 text-left font-medium">일시</th>
                <th className="px-4 py-3 text-left font-medium">구분</th>
                <th className="px-4 py-3 text-left font-medium">내용</th>
                <th className="px-4 py-3 text-right font-medium">증감</th>
                <th className="px-4 py-3 text-right font-medium">잔액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{DATE_FMT.format(t.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        t.type === 'CHARGE' && 'bg-green-50 text-accent-green',
                        t.type === 'USE' && 'bg-blue-50 text-primary-700',
                        t.type === 'REFUND' && 'bg-red-50 text-accent-red',
                        t.type === 'ADMIN_ADJUST' && 'bg-amber-50 text-gray-900',
                      )}
                    >
                      {TX_LABEL[t.type] ?? t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{t.memo ?? '-'}</td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-semibold tabular-nums',
                      t.amount >= 0 ? 'text-accent-green' : 'text-accent-red',
                    )}
                  >
                    {t.amount >= 0 ? '+' : ''}
                    {formatCredits(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">{formatCredits(t.balanceAfter)}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    크레딧 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
