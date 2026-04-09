import { ChevronLeft, TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from 'lucide-react'
import type { PlacementResult, AdaptiveDomain } from '@/lib/assessment/adaptive-test-engine'
import { LEVELS } from '@/lib/constants/levels'
import Link from 'next/link'

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<AdaptiveDomain, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  LISTENING: '#E91E8A',
  WRITING: '#E35C20',
}

const DOMAIN_LABEL: Record<AdaptiveDomain, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  LISTENING: '듣기',
  WRITING: '쓰기',
}

// ─── 레벨 정보 헬퍼 ────────────────────────────────────────────────────────────

function getLevelInfo(level: number) {
  const clamp = Math.max(1, Math.min(10, level))
  return LEVELS.find((l) => l.level === clamp) ?? LEVELS[0]
}

// ─── 도메인 레벨 바 ────────────────────────────────────────────────────────────

function DomainLevelBar({
  domain,
  level,
  overallLevel,
}: {
  domain: AdaptiveDomain
  level: number | null
  overallLevel: number
}) {
  const color = DOMAIN_COLOR[domain]

  // 미측정 (듣기 문제 부족 등)
  if (level === null) {
    return (
      <div className="flex items-center gap-3">
        <span className="w-8 text-xs font-medium text-gray-500">{DOMAIN_LABEL[domain]}</span>
        <div className="flex-1 h-2 rounded-full bg-gray-100" />
        <div className="w-36 text-xs text-gray-400">미측정</div>
      </div>
    )
  }

  const info = getLevelInfo(level)
  const isWeak = level <= overallLevel - 3

  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-xs font-medium text-gray-500">{DOMAIN_LABEL[domain]}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${(level / 10) * 100}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex items-center gap-1.5 w-36">
        <span className="text-sm font-bold" style={{ color }}>
          Lv.{level}
        </span>
        <span className="text-xs text-gray-400 truncate">{info.cefr}</span>
        {isWeak && (
          <span title="집중 학습 필요">
            <AlertTriangle className="h-3.5 w-3.5 text-[#FFB100]" />
          </span>
        )}
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

type Props = {
  sessionId: string
  testTitle: string
  placementResult: PlacementResult
  completedAt: string | null
}

export function PlacementResultView({ sessionId, testTitle, placementResult, completedAt }: Props) {
  const {
    overallLevel,
    grammarLevel,
    vocabularyLevel,
    readingLevel,
    listeningLevel,
    writingLevel,
    imbalanceWarning,
    weakestDomain,
    strongestDomain,
    previousLevel,
    levelChange,
  } = placementResult

  const overallInfo = getLevelInfo(overallLevel)

  const domainEntries: { domain: AdaptiveDomain; level: number | null }[] = [
    { domain: 'GRAMMAR', level: grammarLevel },
    { domain: 'VOCABULARY', level: vocabularyLevel },
    { domain: 'READING', level: readingLevel },
    { domain: 'LISTENING', level: listeningLevel ?? null },
    { domain: 'WRITING', level: writingLevel },
  ]

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      {/* 브레드크럼 */}
      <Link
        href="/student/tests"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        테스트 목록
      </Link>

      {/* 헤더 */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#7854F7]/10 px-2.5 py-0.5 text-xs font-medium text-[#7854F7]">
            적응형 배치 시험
          </span>
          <span className="rounded-full bg-[#1FAF54]/10 px-2.5 py-0.5 text-xs font-medium text-[#1FAF54]">
            채점 완료
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{testTitle} — 배치 결과</h1>
        {completedAt && (
          <p className="mt-1 text-sm text-gray-500">
            제출: {new Date(completedAt).toLocaleString('ko-KR')}
          </p>
        )}
      </div>

      {/* 종합 레벨 카드 */}
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center space-y-4">
        <p className="text-sm font-medium text-gray-500">당신의 영어 레벨은</p>

        <div className="inline-flex flex-col items-center">
          <div
            className="h-24 w-24 rounded-full border-4 flex items-center justify-center"
            style={{ borderColor: '#7854F7' }}
          >
            <div className="text-center">
              <p className="text-3xl font-black text-[#7854F7] leading-none">{overallLevel}</p>
              <p className="text-xs text-gray-400 mt-0.5">Level</p>
            </div>
          </div>
          <p className="mt-3 text-lg font-bold text-gray-900">{overallInfo.cefr}</p>
          <p className="text-sm text-gray-500">{overallInfo.name}</p>
        </div>

        {/* 이전 레벨 대비 */}
        {previousLevel !== null && levelChange !== null && (
          <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-400">이전: Lv.{previousLevel}</span>
            <span className="text-gray-200">→</span>
            {levelChange > 0 ? (
              <span className="flex items-center gap-1 text-sm font-bold text-[#1FAF54]">
                <TrendingUp className="h-4 w-4" />
                +{levelChange} 상승
              </span>
            ) : levelChange < 0 ? (
              <span className="flex items-center gap-1 text-sm font-bold text-[#D92916]">
                <TrendingDown className="h-4 w-4" />
                {levelChange} 하락
              </span>
            ) : (
              <span className="text-sm font-medium text-gray-400">변동 없음</span>
            )}
          </div>
        )}
      </div>

      {/* 영역별 레벨 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          영역별 레벨
        </h2>
        <div className="space-y-3">
          {domainEntries.map(({ domain, level }) => (
            <DomainLevelBar
              key={domain}
              domain={domain}
              level={level}
              overallLevel={overallLevel}
            />
          ))}
        </div>

        {/* 분석 코멘트 */}
        <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 space-y-1">
          {listeningLevel === null && (
            <p className="text-gray-400 text-xs mb-1">
              * 듣기 미측정 — 듣기 문제가 충분해지면 다음 레벨 테스트에서 측정됩니다.
            </p>
          )}
          <p>
            <span className="font-semibold" style={{ color: DOMAIN_COLOR[strongestDomain] }}>
              {DOMAIN_LABEL[strongestDomain]}
            </span>
            이 가장 강하고,{' '}
            <span className="font-semibold" style={{ color: DOMAIN_COLOR[weakestDomain] }}>
              {DOMAIN_LABEL[weakestDomain]}
            </span>
            이 가장 약합니다.
          </p>
          {imbalanceWarning && (
            <p className="flex items-center gap-1.5 text-[#FFB100] font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {DOMAIN_LABEL[weakestDomain]} 영역이 전체보다 3단계 이상 낮아 집중 학습이 필요합니다.
            </p>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-center gap-3 pb-4">
        <Link
          href="/student/tests"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          테스트 목록
        </Link>
        <Link
          href="/student/learn"
          className="inline-flex min-h-[44px] items-center rounded-xl bg-[#1865F2] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1558d6]"
        >
          학습 시작하기
        </Link>
      </div>
    </div>
  )
}
