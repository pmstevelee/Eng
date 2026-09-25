import { Clock, Link2Off, Phone, ShieldAlert } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { formatPhone } from '@/lib/consultation/constants'
import { asLearningSummary } from '@/lib/consultation/learning-summary-types'
import { academyDisplayName } from '@/lib/consultation/notify'
import { LearningSummaryView } from '@/components/shared/consultation/learning-summary-view'
import { NoticeScreen, isPageRateLimited } from '@/app/(placement)/placement/public-page-utils'

export const dynamic = 'force-dynamic'

const KST_DATE = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })

const ACADEMY_SELECT = {
  name: true,
  businessName: true,
  branchName: true,
  parentAcademyId: true,
  phone: true,
  parentAcademy: { select: { name: true, businessName: true, phone: true } },
} as const

/**
 * 학부모 공유 학습 리포트 — 토큰으로만 조회, 발급 후 30일간 공개.
 * 학습 요약 스냅샷과 "학부모 공유용 코멘트"만 조회한다.
 * 교사 내부 메모(memo)·요청사항 등 다른 상담 필드는 select 하지 않는다.
 */
export default async function ParentReportPage({ params }: { params: { token: string } }) {
  if (isPageRateLimited('student-report')) {
    return (
      <NoticeScreen
        icon={ShieldAlert}
        iconClassName="bg-accent-gold-light text-accent-gold"
        title="잠시 후 다시 시도해주세요"
        description="짧은 시간에 요청이 너무 많았습니다."
      />
    )
  }

  const token = params.token
  const consultation = /^[A-Za-z0-9_-]{20,64}$/.test(token)
    ? await prisma.consultation.findUnique({
        where: { reportToken: token },
        select: {
          consultedAt: true,
          parentComment: true,
          reportSnapshot: true,
          reportExpiresAt: true,
          counselor: { select: { name: true } },
          student: {
            select: {
              status: true,
              user: { select: { name: true, isDeleted: true, academy: { select: ACADEMY_SELECT } } },
            },
          },
        },
      })
    : null

  const student = consultation?.student
  const academy = student?.user.academy
  if (!consultation || !student || !academy || student.user.isDeleted) {
    return (
      <NoticeScreen
        icon={Link2Off}
        iconClassName="bg-gray-100 text-gray-500"
        title="리포트를 찾을 수 없습니다"
        description={'링크 주소를 다시 확인해주세요.\n문제가 계속되면 학원으로 문의해주세요.'}
      />
    )
  }

  const academyName = academyDisplayName(academy)
  if (!consultation.reportExpiresAt || consultation.reportExpiresAt.getTime() < Date.now()) {
    return (
      <NoticeScreen
        icon={Clock}
        iconClassName="bg-gray-100 text-gray-500"
        academyName={academyName}
        title="리포트 공개 기간이 지났습니다"
        description={'학습 리포트는 발송일로부터 30일 동안 확인할 수 있습니다.\n리포트가 필요하시면 학원으로 문의해주세요.'}
      />
    )
  }

  const summary = asLearningSummary(consultation.reportSnapshot)
  const phone = academy.phone ?? academy.parentAcademy?.phone

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12 space-y-5">
      <header className="text-center space-y-1">
        <p className="text-lg font-bold text-gray-900">{academyName}</p>
        <p className="text-sm text-gray-500">학습 리포트</p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-6 text-center space-y-1">
        <p className="text-2xl font-bold text-gray-900">{student.user.name} 학생</p>
        <p className="text-sm text-gray-500">{KST_DATE.format(consultation.consultedAt)} 상담</p>
      </section>

      {consultation.parentComment && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-2">
          <h2 className="text-base font-semibold text-gray-900">선생님 코멘트</h2>
          <p className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">{consultation.parentComment}</p>
          {consultation.counselor && (
            <p className="text-sm text-gray-500 text-right">{consultation.counselor.name} 선생님</p>
          )}
        </section>
      )}

      {summary && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">학습 요약</h2>
          <LearningSummaryView summary={summary} />
        </section>
      )}

      <footer className="text-center space-y-2 pt-2">
        <p className="text-sm text-gray-500">리포트에 대해 궁금하신 점은 학원으로 문의해 주세요.</p>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
          >
            <Phone size={16} />
            {formatPhone(phone)}
          </a>
        )}
        <p className="text-xs text-gray-500">
          이 리포트는 {KST_DATE.format(consultation.reportExpiresAt)}까지 열람할 수 있습니다.
        </p>
      </footer>
    </main>
  )
}
