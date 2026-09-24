import { Clock, Link2Off, Phone, ShieldAlert } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { formatPhone } from '@/lib/consultation/constants'
import { toPlacementSummary } from '@/lib/consultation/queries'
import { academyNameOf } from '@/lib/placement/runner'
import {
  PLACEMENT_DOMAIN_COLOR,
  PLACEMENT_DOMAIN_LABEL,
  domainComment,
  levelHeadline,
} from '@/lib/placement/display'
import { NoticeScreen, isPageRateLimited } from '../../public-page-utils'

export const dynamic = 'force-dynamic'

const KST_DATE = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })

/** 학부모용 레벨테스트 결과 리포트 — 토큰으로만 조회, 발급 후 30일간 공개 */
export default async function PlacementResultPage({ params }: { params: { token: string } }) {
  if (isPageRateLimited('result')) {
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
  const attempt = /^[A-Za-z0-9_-]{20,64}$/.test(token)
    ? await prisma.placementAttempt.findUnique({
        where: { resultToken: token },
        select: {
          id: true,
          status: true,
          overallLevel: true,
          assessedLevels: true,
          placementResult: true,
          completedAt: true,
          resultToken: true,
          resultExpiresAt: true,
          lead: { select: { studentName: true } },
          academy: {
            select: {
              name: true,
              businessName: true,
              branchName: true,
              parentAcademyId: true,
              ownerId: true,
              phone: true,
              parentAcademy: { select: { name: true, businessName: true, phone: true } },
            },
          },
        },
      })
    : null

  const summary = attempt?.status === 'COMPLETED' ? toPlacementSummary(attempt) : null
  if (!attempt || !summary) {
    return (
      <NoticeScreen
        icon={Link2Off}
        iconClassName="bg-gray-100 text-gray-500"
        title="결과를 찾을 수 없습니다"
        description={'링크 주소를 다시 확인해주세요.\n문제가 계속되면 학원으로 문의해주세요.'}
      />
    )
  }

  const academyName = academyNameOf(attempt.academy)
  if (attempt.resultExpiresAt && attempt.resultExpiresAt.getTime() < Date.now()) {
    return (
      <NoticeScreen
        icon={Clock}
        iconClassName="bg-gray-100 text-gray-500"
        academyName={academyName}
        title="결과 공개 기간이 지났습니다"
        description={'결과 리포트는 응시 후 30일 동안 확인할 수 있습니다.\n결과가 필요하시면 학원으로 문의해주세요.'}
      />
    )
  }

  const headline = levelHeadline(summary.overallLevel)
  const phone = attempt.academy.phone ?? attempt.academy.parentAcademy?.phone
  const studentName = attempt.lead.studentName

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12 space-y-5">
      <header className="text-center space-y-1">
        <p className="text-lg font-bold text-gray-900">{academyName}</p>
        <p className="text-sm text-gray-500">영어 레벨테스트 결과 리포트</p>
      </header>

      {/* 종합 결과 */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 text-center space-y-3">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{studentName}</span> 학생 ·{' '}
          {KST_DATE.format(new Date(summary.completedAt))} 응시
        </p>
        <p className="text-3xl font-bold text-gray-900">{headline.title}</p>
        <p className="inline-flex rounded-full bg-accent-purple-light text-accent-purple px-3 py-1 text-sm font-semibold">
          국제 기준(CEFR) {headline.cefr}
        </p>
        <p className="text-base text-gray-700 leading-relaxed">{headline.description}</p>
      </section>

      {/* 영역별 결과 */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">영역별 결과</h2>
        <ul className="space-y-5">
          {summary.domains.map((d) => (
            <li key={d.domain} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">{PLACEMENT_DOMAIN_LABEL[d.domain]}</span>
                <span className="tabular-nums text-gray-700">{d.level !== null ? `Level ${d.level}` : '미측정'}</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                {d.level !== null && (
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${d.level * 10}%`, backgroundColor: PLACEMENT_DOMAIN_COLOR[d.domain] }}
                  />
                )}
              </div>
              <p className="text-sm text-gray-500">{domainComment(d.level, summary.overallLevel)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 한눈에 보기 */}
      {(summary.strongestDomain || summary.weakestDomain) && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-2 text-sm text-gray-700 leading-relaxed">
          <h2 className="text-base font-semibold text-gray-900 mb-1">한눈에 보기</h2>
          {summary.strongestDomain && (
            <p>
              <span className="font-semibold text-accent-green">강점</span> · {studentName} 학생은{' '}
              <span className="font-medium text-gray-900">{PLACEMENT_DOMAIN_LABEL[summary.strongestDomain]}</span> 영역에서
              가장 좋은 결과를 보였어요.
            </p>
          )}
          {summary.weakestDomain && summary.weakestDomain !== summary.strongestDomain && (
            <p>
              <span className="font-semibold text-accent-red">보완</span> ·{' '}
              <span className="font-medium text-gray-900">{PLACEMENT_DOMAIN_LABEL[summary.weakestDomain]}</span> 영역을
              꾸준히 연습하면 전체 실력이 더 고르게 성장할 수 있어요.
            </p>
          )}
          {summary.imbalanceWarning && (
            <p className="text-gray-500">영역별 차이가 큰 편이라, 약한 영역을 중심으로 한 맞춤 학습을 권해드려요.</p>
          )}
        </section>
      )}

      <footer className="rounded-xl bg-white border border-gray-200 p-5 text-center text-sm text-gray-700 space-y-2">
        <p>자세한 학습 계획은 상담에서 안내해드릴게요.</p>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl border border-gray-200 font-medium text-primary-700 hover:bg-gray-50"
          >
            <Phone size={15} />
            {academyName} {formatPhone(phone)}
          </a>
        )}
      </footer>
    </main>
  )
}
