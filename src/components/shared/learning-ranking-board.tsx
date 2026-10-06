import Link from 'next/link'
import { Trophy, Medal } from 'lucide-react'
import { getLevelInfo } from '@/lib/constants/levels'
import {
  RANKING_PERIOD_LABEL,
  RANKING_SCOPE_LABEL,
  type RankingEntry,
  type RankingPeriod,
  type RankingResult,
  type RankingScope,
} from '@/lib/learning/ranking'

// 학습 랭킹 보드 (학생·교사·학원장 공용, 서버 컴포넌트)

const PERIODS: RankingPeriod[] = ['week', 'month', 'all']

const MEDAL_COLOR: Record<number, string> = {
  1: '#FFB100',
  2: '#9CA3AF',
  3: '#C2410C',
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
        active
          ? 'border-[#1865F2] bg-[#1865F2] text-white'
          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-900'
      }`}
    >
      {children}
    </Link>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank >= 1 && rank <= 3) {
    return (
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: `${MEDAL_COLOR[rank]}1F` }}
        aria-label={`${rank}위`}
      >
        <Medal className="h-5 w-5" style={{ color: MEDAL_COLOR[rank] }} />
      </div>
    )
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center text-sm font-bold text-gray-500">
      {rank > 0 ? rank : '-'}
    </div>
  )
}

function EntryRow({ entry, highlight }: { entry: RankingEntry; highlight?: boolean }) {
  const level = getLevelInfo(entry.level)
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${highlight ? 'bg-[#1865F2]/5' : ''}`}
    >
      <RankBadge rank={entry.rank} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-gray-900">{entry.name}</p>
          {highlight && (
            <span className="rounded-full bg-[#1865F2] px-2 py-0.5 text-[10px] font-bold text-white">나</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          Lv.{entry.level} {level.cefr}
          {entry.className && ` · ${entry.className}`}
          {` · 단어 ${entry.words.toLocaleString()}회`}
          {entry.grammar > 0 && ` · 문법 ${entry.grammar}문제`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-base font-black text-gray-900">{entry.points.toLocaleString()}</p>
        <p className="text-[10px] text-gray-500">포인트</p>
      </div>
    </div>
  )
}

export function LearningRankingBoard({
  result,
  scopes,
  hrefFor,
  extraFilter,
  maskedNotice,
}: {
  result: RankingResult
  /** 노출할 범위 탭 (1개면 탭 숨김) */
  scopes: RankingScope[]
  hrefFor: (period: RankingPeriod, scope: RankingScope) => string
  /** 범위 탭 아래 추가 필터(반 선택 등) */
  extraFilter?: React.ReactNode
  maskedNotice?: boolean
}) {
  const { me, top } = result
  const meInTop = !!me && top.some((e) => e.studentId === me.studentId)

  return (
    <div className="space-y-4">
      {scopes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {scopes.map((s) => (
            <TabLink key={s} href={hrefFor(result.period, s)} active={result.scope === s}>
              {RANKING_SCOPE_LABEL[s]}
            </TabLink>
          ))}
        </div>
      )}
      {extraFilter}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={hrefFor(p, result.scope)}
              className={`flex min-h-[40px] items-center rounded-lg px-4 text-sm font-semibold ${
                result.period === p ? 'bg-gray-50 text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {RANKING_PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          {result.rangeLabel} · 참여 {result.totalParticipants.toLocaleString()}명
        </p>
      </div>

      {me && (
        <div className="rounded-xl border border-[#1865F2]/30 bg-white">
          <p className="px-4 pt-3 text-xs font-semibold text-[#1865F2]">내 순위</p>
          <EntryRow entry={me} highlight />
          {me.rank === 0 && (
            <p className="px-4 pb-3 text-xs text-gray-500">오늘의 단어학습을 시작하면 랭킹에 올라가요!</p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <Trophy className="h-4 w-4 text-[#FFB100]" />
          <span className="text-sm font-semibold text-gray-500">상위 {top.length}명</span>
        </div>
        {top.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Trophy className="h-10 w-10 text-gray-300" />
            <p className="text-sm font-semibold text-gray-500">아직 이 기간의 학습 기록이 없어요</p>
            <p className="text-xs text-gray-500">단어를 학습하고 포인트를 모아 1등에 도전해 보세요</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {top.map((entry) => (
              <EntryRow key={entry.studentId} entry={entry} highlight={meInTop && entry.studentId === me?.studentId} />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-gray-500">
        포인트는 단어 학습(플래시카드·뜻 고르기·스펠링), 복습, 마스터, 문법 미션, 오늘의 학습 완료 보너스로 쌓여요.
        동점이면 단어 학습 횟수가 많은 학생이 앞서요.
        {maskedNotice && ' 전체 랭킹은 개인정보 보호를 위해 이름 일부를 가려서 보여줘요.'}
      </p>
    </div>
  )
}
