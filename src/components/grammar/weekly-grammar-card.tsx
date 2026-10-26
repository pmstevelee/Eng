'use client'

// '이번 주 문법' 카드 — 학생 문법 홈 하단, 교사 학생 상세 '문법' 탭 상단
// 통계는 서버에서 받은 값을 그리고, 이번 주 AI 코멘트가 빠진 취약 포인트만 화면이 뜬 뒤 채운다.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarRange, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import type { GrammarWeeklyReport } from '@/lib/grammar/weekly-report'
import { formatReportRange } from '@/lib/grammar/weekly-report-logic'
import { ensureMyWeakComments, ensureStudentWeakComments } from '@/lib/grammar/weekly-report-actions'

interface Props {
  report: GrammarWeeklyReport
  /** 교사·학원장 화면이면 학생 id (없으면 학생 본인) */
  studentId?: string
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export function WeeklyGrammarCard({ report, studentId }: Props) {
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(report.weak.flatMap((w) => (w.comment ? [[w.pointId, w.comment]] : []))),
  )
  const needsAi = report.weak.some((w) => !w.comment && w.canComment)
  const [loading, setLoading] = useState(needsAi)

  useEffect(() => {
    if (!needsAi) return
    let cancelled = false
    const run = studentId ? ensureStudentWeakComments(studentId) : ensureMyWeakComments()
    run
      .then((res) => {
        if (!cancelled && res.ok) setComments((prev) => ({ ...prev, ...res.comments }))
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [needsAi, studentId])

  const forTeacher = Boolean(studentId)
  const empty = report.solved === 0 && report.studiedUnits === 0 && report.weak.length === 0

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <CalendarRange className="h-5 w-5 text-[#1865F2]" aria-hidden />
          이번 주 문법
        </h2>
        <p className="text-xs text-gray-500">최근 7일 · {formatReportRange(report.fromKey, report.toKey)}</p>
      </div>

      {empty ? (
        <p className="mt-3 text-sm text-gray-500">
          {forTeacher ? '최근 7일 동안 문법 학습 기록이 없어요.' : '이번 주엔 아직 문법 학습 기록이 없어요. 오늘 한 단원부터 시작해 볼까요?'}
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="학습한 단원" value={`${report.studiedUnits}개`} />
            <Stat label="통과" value={`${report.passed}개`} sub={report.mastered > 0 ? `숙달 ${report.mastered}개` : undefined} />
            <Stat label="푼 문항" value={`${report.solved}개`} />
            <Stat label="정답률" value={report.accuracy !== null ? `${report.accuracy}%` : '-'} />
          </div>

          <div className="mt-5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <AlertTriangle className="h-4 w-4 text-[#D92916]" aria-hidden />
              다시 볼 취약 포인트
            </h3>
            {report.weak.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">취약 포인트가 없어요.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {report.weak.map((w) => {
                  const comment = comments[w.pointId]
                  const title = (
                    <>
                      <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">{w.title}</span>
                      {w.weekWrong > 0 && <span className="shrink-0 text-xs font-semibold text-[#D92916]">이번 주 {w.weekWrong}문항 틀림</span>}
                    </>
                  )
                  return (
                    <li key={w.pointId} className="rounded-xl border border-gray-100 p-3">
                      {forTeacher ? (
                        <div className="flex items-center gap-2 text-sm">{title}</div>
                      ) : (
                        <Link href={`/student/grammar/${w.code}`} className="flex min-h-[44px] items-center gap-2 text-sm hover:text-[#1865F2]">
                          {title}
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                        </Link>
                      )}

                      {comment ? (
                        <p className="mt-2 flex gap-2 rounded-lg bg-[#F3F0FF] px-3 py-2 text-sm leading-relaxed text-gray-800">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#7854F7]" aria-label="AI 코멘트" />
                          <span>{comment}</span>
                        </p>
                      ) : w.canComment && loading ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI가 틀린 문제를 살펴보는 중
                        </p>
                      ) : !w.canComment ? (
                        <p className="mt-2 text-xs text-gray-400">틀린 문제가 조금 더 쌓이면 AI 코멘트가 생겨요.</p>
                      ) : null}

                      {w.samples.length > 0 && (
                        <details className="mt-2 text-sm">
                          <summary className="flex min-h-[36px] cursor-pointer items-center text-xs text-gray-500 hover:text-gray-800">
                            틀린 문제 {w.samples.length}개 보기
                          </summary>
                          <ul className="mt-1 space-y-2">
                            {w.samples.map((s, i) => (
                              <li key={i} className="rounded-lg bg-gray-50 px-3 py-2">
                                <p className="whitespace-pre-line text-gray-900">{s.question}</p>
                                <p className="mt-1 text-xs">
                                  <span className="text-[#D92916]">{forTeacher ? '학생 답' : '내 답'}: {s.myAnswer}</span>
                                  <span className="ml-3 text-[#15803D]">정답: {s.correctAnswer}</span>
                                </p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
