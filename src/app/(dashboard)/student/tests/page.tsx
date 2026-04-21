import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import Link from 'next/link'
import { FileText, Clock, CheckCircle, BarChart2, ChevronRight, PlayCircle } from 'lucide-react'

const STATUS_CONFIG = {
  NOT_STARTED: {
    label: '미응시',
    className: 'bg-gray-100 text-gray-600',
  },
  IN_PROGRESS: {
    label: '응시 중',
    className: 'bg-amber-50 text-[#FFB100]',
  },
  COMPLETED: {
    label: '제출 완료',
    className: 'bg-green-50 text-[#1FAF54]',
  },
  GRADED: {
    label: '채점 완료',
    className: 'bg-[#EEF4FF] text-[#1865F2]',
  },
}

const TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습 테스트',
}

type CachedSession = {
  id: string
  status: string
  startedAt: string
  completedAt: string | null
  timeLimitMin: number | null
  score: number | null
  test: {
    title: string
    type: string
    timeLimitMin: number | null
    totalScore: number
  }
}

const getCachedStudentSessions = (studentId: string) =>
  unstable_cache(
    async () => {
      const sessions = await prisma.testSession.findMany({
        where: { studentId },
        orderBy: { startedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          timeLimitMin: true,
          score: true,
          test: {
            select: {
              title: true,
              type: true,
              timeLimitMin: true,
              totalScore: true,
            },
          },
        },
      })
      return sessions.map((s): CachedSession => ({
        ...s,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
      }))
    },
    ['student-sessions', studentId],
    { revalidate: 120, tags: [`student-${studentId}-tests`] },
  )()

export default async function StudentTestsPage() {
  const { studentId } = await requireStudent()
  const sessions = await getCachedStudentSessions(studentId)

  const notStarted = sessions.filter((s) => s.status === 'NOT_STARTED')
  const inProgress = sessions.filter((s) => s.status === 'IN_PROGRESS')
  const completed = sessions.filter(
    (s) => s.status === 'COMPLETED' || s.status === 'GRADED',
  )

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">테스트</h1>
        <p className="mt-1 text-sm text-gray-500">배포된 테스트를 응시하고 결과를 확인하세요.</p>
      </div>

      {/* 응시 중인 테스트 */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <span className="inline-block h-2 w-2 rounded-full bg-[#FFB100]" />
            응시 중
          </h2>
          <div className="space-y-2">
            {inProgress.map((s) => (
              <TestSessionCard key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}

      {/* 미응시 테스트 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
          미응시 ({notStarted.length})
        </h2>
        {notStarted.length === 0 ? (
          <EmptyState message="미응시 테스트가 없습니다." />
        ) : (
          <div className="space-y-2">
            {notStarted.map((s) => (
              <TestSessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>

      {/* 완료된 테스트 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          <span className="inline-block h-2 w-2 rounded-full bg-[#1FAF54]" />
          완료 ({completed.length})
        </h2>
        {completed.length === 0 ? (
          <EmptyState message="완료된 테스트가 없습니다." />
        ) : (
          <div className="space-y-2">
            {completed.map((s) => (
              <TestSessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

type SessionCardProps = {
  session: CachedSession
}

function TestSessionCard({ session }: SessionCardProps) {
  const status = session.status as keyof typeof STATUS_CONFIG
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_STARTED
  const questionCount = session.test.totalScore
  const isCompleted = status === 'COMPLETED' || status === 'GRADED'
  const isInProgress = status === 'IN_PROGRESS'

  return (
    <Link
      href={`/student/tests/${session.id}`}
      className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      {/* 아이콘 */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          isCompleted
            ? 'bg-green-50'
            : isInProgress
              ? 'bg-amber-50'
              : 'bg-[#EEF4FF]'
        }`}
      >
        {isCompleted ? (
          <CheckCircle className="h-5 w-5 text-[#1FAF54]" />
        ) : isInProgress ? (
          <PlayCircle className="h-5 w-5 text-[#FFB100]" />
        ) : (
          <FileText className="h-5 w-5 text-[#1865F2]" />
        )}
      </div>

      {/* 정보 */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">
            {session.test.title}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
            {cfg.label}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span>{TYPE_LABEL[session.test.type] ?? session.test.type}</span>
          {questionCount > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {questionCount}문제
              </span>
            </>
          )}
          {session.test.timeLimitMin && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {session.test.timeLimitMin}분
              </span>
            </>
          )}
          {isCompleted && session.score !== null && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 font-medium text-[#1865F2]">
                <BarChart2 className="h-3 w-3" />
                점수 {session.score}점
              </span>
            </>
          )}
        </div>
      </div>

      {/* 화살표 */}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
      <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}
