'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react'
import type { WritingHistoryItem } from '../page'

const SCORE_LABELS: Record<string, string> = {
  grammar: '문법',
  organization: '구성',
  vocabulary: '어휘',
  expression: '표현',
}

const CATEGORY_LABELS: Record<string, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  expression: '표현',
}

function getScoreColor(pct: number) {
  if (pct >= 80) return '#1FAF54'
  if (pct >= 60) return '#FFB100'
  return '#D92916'
}

function getScoreBg(pct: number) {
  if (pct >= 80) return '#F0FDF4'
  if (pct >= 60) return '#FFFBEB'
  return '#FEF2F2'
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function WritingHistoryAccordion({ history }: { history: WritingHistoryItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {history.map((item) => {
        const isOpen = openId === item.id
        const pct = item.data.percentage
        const color = getScoreColor(pct)
        const bg = getScoreBg(pct)

        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            {/* 헤더 */}
            <button
              className="flex w-full items-center justify-between px-4 py-4 text-left hover:bg-gray-50"
              onClick={() => setOpenId(isOpen ? null : item.id)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                  style={{ backgroundColor: bg, color }}
                >
                  {Math.round(pct)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.data.topicTitle}</p>
                  <p className="text-xs text-gray-400">
                    Level {item.data.level} · {item.data.wordCount}단어 · {formatDate(item.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: bg, color }}
                >
                  {item.data.totalScore}/{item.data.totalMaxScore}점
                </span>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* 상세 내용 */}
            {isOpen && (
              <div className="border-t border-gray-100 px-4 pb-5 pt-4 space-y-5">
                {/* 영역별 점수 */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    영역별 점수
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.entries(item.data.scores) as [string, { score: number; maxForLevel: number; details: string }][]).map(
                      ([key, val]) => (
                        <div
                          key={key}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center"
                        >
                          <p className="mb-1 text-xs text-gray-500">{SCORE_LABELS[key]}</p>
                          <p className="text-lg font-bold" style={{ color: getScoreColor((val.score / val.maxForLevel) * 100) }}>
                            {val.score}
                            <span className="text-xs font-normal text-gray-400">/{val.maxForLevel}</span>
                          </p>
                          <p className="mt-1 text-xs text-gray-500 leading-relaxed">{val.details}</p>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* 전체 총평 */}
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    AI 총평
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{item.data.overallComment}</p>
                </div>

                {/* 에세이 원문 */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    작성한 에세이
                  </p>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                      {item.data.essay}
                    </p>
                  </div>
                </div>

                {/* 오류 교정 */}
                {item.data.corrections.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      교정 포인트
                    </p>
                    <div className="space-y-2">
                      {item.data.corrections.map((c, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="mb-1 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: '#D92916' }} />
                            <span className="text-xs font-medium" style={{ color: '#D92916' }}>
                              {CATEGORY_LABELS[c.category] ?? c.category}
                            </span>
                          </div>
                          <p className="mb-0.5 text-sm text-gray-500 line-through">{c.original}</p>
                          <p className="mb-1 text-sm font-medium text-gray-900">{c.corrected}</p>
                          <p className="text-xs text-gray-500">{c.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 모범 답안 */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" style={{ color: '#1865F2' }} />
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      모범 답안 ({item.data.modelEssay.wordCount}단어)
                    </p>
                  </div>
                  <div
                    className="rounded-xl border p-4"
                    style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
                  >
                    <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                      {item.data.modelEssay.text}
                    </p>
                    {item.data.modelEssay.keyFeatures.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {item.data.modelEssay.keyFeatures.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#1865F2' }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
