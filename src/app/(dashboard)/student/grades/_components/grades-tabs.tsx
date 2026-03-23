'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { GradesDomainLineChart } from './grades-domain-line-chart'

type DomainKey = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING'
type TabKey = 'history' | 'domain' | 'level'

const DOMAIN_COLOR: Record<DomainKey, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

const DOMAIN_LABELS: Record<DomainKey, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  WRITING: '쓰기',
}

const TEST_TYPE_LABELS: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습 테스트',
}

const TEST_TYPE_BG: Record<string, string> = {
  LEVEL_TEST: '#EEF4FF',
  UNIT_TEST: '#F3EFFF',
  PRACTICE: '#E6FAF8',
}
const TEST_TYPE_TEXT: Record<string, string> = {
  LEVEL_TEST: '#1865F2',
  UNIT_TEST: '#7854F7',
  PRACTICE: '#0FBFAD',
}

type HistoryItem = {
  id: string
  date: string
  title: string
  type: string
  score: number | null
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  writingScore: number | null
  durationMin: number | null
}

type SubCategoryItem = {
  subCategory: string
  correct: number
  total: number
  rate: number
}

type LevelHistoryItem = {
  date: string
  fromLevel: number
  toLevel: number
  score: number | null
}

type SessionPoint = {
  id: string
  title: string
  type: string
  date: string
  score: number | null
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  writingScore: number | null
}

type Props = {
  historyData: HistoryItem[]
  subCategoryData: Record<DomainKey, SubCategoryItem[]>
  levelHistory: LevelHistoryItem[]
  currentLevel: number
  domainSessionPoints: SessionPoint[]
}

const PAGE_SIZE = 10

function scoreColor(score: number | null) {
  if (score === null) return '#6B6F7A'
  if (score >= 80) return '#1FAF54'
  if (score >= 60) return '#FFB100'
  return '#D92916'
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'history', label: '전체 이력' },
  { key: 'domain', label: '영역별 상세' },
  { key: 'level', label: '레벨 히스토리' },
]

const DOMAINS: DomainKey[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']

export function GradesTabs({
  historyData,
  subCategoryData,
  levelHistory,
  currentLevel,
  domainSessionPoints,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('history')
  const [page, setPage] = useState(1)
  const [selectedDomain, setSelectedDomain] = useState<DomainKey>('GRAMMAR')

  const totalPages = Math.ceil(historyData.length / PAGE_SIZE)
  const pagedHistory = historyData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const levelUpCount = levelHistory.filter((h) => h.toLevel > h.fromLevel).length

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Tab bar */}
      <div className="border-b border-gray-200 px-2 pt-2">
        <div className="flex gap-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-none border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-[#1865F2] text-[#1865F2]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab 1: 전체 이력 ── */}
      {activeTab === 'history' && (
        <>
          {historyData.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20">
              <p className="text-base font-medium text-gray-400">완료된 테스트가 없습니다</p>
              <p className="text-sm text-gray-300">테스트를 응시하면 여기에 기록됩니다</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {[
                        '날짜',
                        '테스트명',
                        '유형',
                        '총점',
                        '문법',
                        '어휘',
                        '독해',
                        '쓰기',
                        '소요시간',
                      ].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 first:pl-5"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                        onClick={() => router.push(`/student/tests/${item.id}/result`)}
                      >
                        <td className="whitespace-nowrap py-3.5 pl-5 pr-4 text-sm text-gray-500">
                          {item.date}
                        </td>
                        <td className="max-w-[180px] px-4 py-3.5 text-sm font-medium text-gray-900">
                          <span className="line-clamp-1">{item.title}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: TEST_TYPE_BG[item.type] ?? '#F0F1F3',
                              color: TEST_TYPE_TEXT[item.type] ?? '#6B6F7A',
                            }}
                          >
                            {TEST_TYPE_LABELS[item.type] ?? item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className="text-sm font-bold"
                            style={{ color: scoreColor(item.score) }}
                          >
                            {item.score ?? '—'}
                          </span>
                        </td>
                        {(
                          [
                            'grammarScore',
                            'vocabularyScore',
                            'readingScore',
                            'writingScore',
                          ] as const
                        ).map((k) => (
                          <td key={k} className="px-4 py-3.5 text-sm text-gray-600">
                            {item[k] ?? '—'}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-500">
                          {item.durationMin != null ? `${item.durationMin}분` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 border-t border-gray-100 py-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Tab 2: 영역별 상세 ── */}
      {activeTab === 'domain' && (
        <div className="p-6">
          {/* Domain selector */}
          <div className="mb-6 flex flex-wrap gap-2">
            {DOMAINS.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDomain(d)}
                className={`min-h-[36px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedDomain === d
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={selectedDomain === d ? { backgroundColor: DOMAIN_COLOR[d] } : {}}
              >
                {DOMAIN_LABELS[d]}
              </button>
            ))}
          </div>

          {/* Subcategory correctness */}
          <div className="mb-8">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">카테고리별 정답률</h3>
            {subCategoryData[selectedDomain].length === 0 ? (
              <p className="rounded-xl bg-gray-50 py-8 text-center text-sm text-gray-400">
                응시한 문제 데이터가 없습니다
              </p>
            ) : (
              <div className="space-y-4">
                {subCategoryData[selectedDomain].map((item) => {
                  const barColor =
                    item.rate >= 80 ? '#1FAF54' : item.rate >= 60 ? '#FFB100' : '#D92916'
                  const isWeak = item.rate < 60
                  return (
                    <div key={item.subCategory}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span
                          className={`text-sm ${isWeak ? 'font-semibold text-[#D92916]' : 'text-gray-700'}`}
                        >
                          {item.subCategory}
                          {isWeak && (
                            <span className="ml-1.5 rounded-full bg-[#D92916]/10 px-1.5 py-0.5 text-xs font-normal text-[#D92916]">
                              집중 필요
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-bold" style={{ color: barColor }}>
                          {item.rate}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${item.rate}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {item.correct} / {item.total}문제 정답
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Domain score trend */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              {DOMAIN_LABELS[selectedDomain]} 점수 추이
            </h3>
            <GradesDomainLineChart
              sessions={domainSessionPoints}
              domain={selectedDomain}
              color={DOMAIN_COLOR[selectedDomain]}
            />
          </div>
        </div>
      )}

      {/* ── Tab 3: 레벨 히스토리 ── */}
      {activeTab === 'level' && (
        <div className="p-6">
          {/* Current level banner */}
          <div className="mb-6 flex items-center gap-4 rounded-xl bg-[#EEF4FF] px-5 py-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1865F2] text-white">
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase leading-none tracking-wide opacity-80">
                  Level
                </p>
                <p className="text-2xl font-bold leading-tight">{currentLevel}</p>
              </div>
            </div>
            <div>
              <p className="font-bold text-[#1865F2]">현재 레벨 {currentLevel}</p>
              <p className="text-sm text-[#1865F2]/70">
                {levelUpCount > 0
                  ? `레벨업 ${levelUpCount}회 달성`
                  : '첫 번째 레벨업에 도전해보세요!'}
              </p>
            </div>
          </div>

          {/* Timeline */}
          {levelHistory.length === 0 ? (
            <div className="rounded-xl bg-gray-50 py-14 text-center">
              <p className="text-sm font-medium text-gray-400">레벨 변화 기록이 없습니다</p>
              <p className="mt-1 text-xs text-gray-300">레벨 테스트를 응시하면 기록됩니다</p>
            </div>
          ) : (
            <div className="relative pl-7">
              <div className="absolute left-[13px] top-2 h-[calc(100%-2rem)] w-0.5 bg-gray-200" />
              {[...levelHistory].reverse().map((item, idx) => {
                const isLevelUp = item.toLevel > item.fromLevel
                return (
                  <div key={idx} className="relative mb-4">
                    <div
                      className="absolute -left-7 top-4 h-4 w-4 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: isLevelUp ? '#1FAF54' : '#D92916' }}
                    />
                    <div className="rounded-xl border border-gray-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-400">{item.date}</p>
                          <p
                            className="mt-0.5 text-sm font-semibold"
                            style={{ color: isLevelUp ? '#1FAF54' : '#D92916' }}
                          >
                            Level {item.fromLevel} → Level {item.toLevel}{' '}
                            {isLevelUp ? '🎉' : '📉'}
                          </p>
                        </div>
                        {item.score !== null && (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            {item.score}점
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
