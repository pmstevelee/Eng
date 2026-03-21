'use client'

import { useState, useTransition } from 'react'
import { Loader2, Sparkles, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAiAnalysis, gradeSession } from '../actions'
import type { WritingGrade } from '../actions'

type WritingQuestion = {
  responseId: string
  questionId: string
  questionText: string
  essayText: string
}

type StudentSession = {
  sessionId: string
  studentName: string
  submittedAt: string
  writingQuestions: WritingQuestion[]
}

type GradeState = {
  grammarScore: number
  structureScore: number
  vocabularyScore: number
  expressionScore: number
  teacherComment: string
  aiAnalysis: string | null
}

export function GradeClient({ sessions }: { sessions: StudentSession[] }) {
  const [expandedSession, setExpandedSession] = useState<string | null>(
    sessions.length === 1 ? sessions[0].sessionId : null
  )
  const [grades, setGrades] = useState<Record<string, GradeState>>({})
  const [submitting, startSubmitting] = useTransition()
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})
  const [submittedSessions, setSubmittedSessions] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const getGrade = (responseId: string): GradeState => {
    return grades[responseId] ?? {
      grammarScore: 20,
      structureScore: 20,
      vocabularyScore: 20,
      expressionScore: 20,
      teacherComment: '',
      aiAnalysis: null,
    }
  }

  const updateGrade = (responseId: string, field: keyof GradeState, value: number | string | null) => {
    setGrades((prev) => ({
      ...prev,
      [responseId]: { ...getGrade(responseId), [field]: value },
    }))
  }

  const getTotal = (responseId: string) => {
    const g = getGrade(responseId)
    return g.grammarScore + g.structureScore + g.vocabularyScore + g.expressionScore
  }

  const handleAiAnalysis = async (q: WritingQuestion) => {
    setAiLoading((prev) => ({ ...prev, [q.responseId]: true }))
    const result = await getAiAnalysis(q.questionText, q.essayText)
    setAiLoading((prev) => ({ ...prev, [q.responseId]: false }))

    if (result.result) {
      setGrades((prev) => ({
        ...prev,
        [q.responseId]: {
          ...getGrade(q.responseId),
          grammarScore: result.result!.grammarScore,
          structureScore: result.result!.structureScore,
          vocabularyScore: result.result!.vocabularyScore,
          expressionScore: result.result!.expressionScore,
          aiAnalysis: result.result!.feedback,
        },
      }))
    }
  }

  const handleSubmit = (session: StudentSession) => {
    setErrors((prev) => ({ ...prev, [session.sessionId]: '' }))
    startSubmitting(async () => {
      const writingGrades: WritingGrade[] = session.writingQuestions.map((q) => {
        const g = getGrade(q.responseId)
        return {
          responseId: q.responseId,
          questionId: q.questionId,
          grammarScore: g.grammarScore,
          structureScore: g.structureScore,
          vocabularyScore: g.vocabularyScore,
          expressionScore: g.expressionScore,
          teacherScore: getTotal(q.responseId),
          teacherComment: g.teacherComment,
        }
      })

      const result = await gradeSession(session.sessionId, writingGrades)
      if (result.error) {
        setErrors((prev) => ({ ...prev, [session.sessionId]: result.error! }))
      } else {
        setSubmittedSessions((prev) => new Set(Array.from(prev).concat(session.sessionId)))
      }
    })
  }

  if (sessions.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">채점할 답안이 없습니다</h3>
        <p className="mt-2 text-sm text-gray-500">모든 제출이 채점 완료되었거나 쓰기 문제가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => {
        const isSubmitted = submittedSessions.has(session.sessionId)
        const isExpanded = expandedSession === session.sessionId

        return (
          <div key={session.sessionId} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {/* 학생 헤더 */}
            <button
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
              onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                  {session.studentName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{session.studentName}</p>
                  <p className="text-xs text-gray-500">
                    제출: {new Date(session.submittedAt).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isSubmitted ? (
                  <span className="rounded-full bg-[#1FAF54]/10 px-3 py-1 text-xs font-medium text-[#1FAF54]">
                    채점 완료
                  </span>
                ) : (
                  <span className="rounded-full bg-[#FFB100]/10 px-3 py-1 text-xs font-medium text-[#FFB100]">
                    채점 대기
                  </span>
                )}
                <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* 채점 영역 */}
            {isExpanded && !isSubmitted && (
              <div className="border-t border-gray-100 px-5 py-5 space-y-8">
                {session.writingQuestions.map((q, idx) => {
                  const g = getGrade(q.responseId)
                  const total = getTotal(q.responseId)
                  const isAiLoading = aiLoading[q.responseId]

                  return (
                    <div key={q.responseId} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">
                          쓰기 문제 {idx + 1}
                        </h3>
                        <button
                          type="button"
                          disabled={isAiLoading || !q.essayText}
                          onClick={() => handleAiAnalysis(q)}
                          className="flex items-center gap-1.5 rounded-lg border border-[#7854F7] px-3 py-1.5 text-xs font-medium text-[#7854F7] hover:bg-purple-50 disabled:opacity-50"
                        >
                          {isAiLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          AI 분석
                        </button>
                      </div>

                      {/* 문제 */}
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">문제</p>
                        <p className="text-sm text-gray-800">{q.questionText}</p>
                      </div>

                      {/* 학생 에세이 */}
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">학생 답안</p>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {q.essayText || '(미응답)'}
                        </p>
                      </div>

                      {/* AI 분석 결과 */}
                      {g.aiAnalysis && (
                        <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Sparkles className="h-4 w-4 text-[#7854F7]" />
                            <p className="text-xs font-medium text-[#7854F7]">AI 분석 결과</p>
                          </div>
                          <p className="text-sm text-purple-800">{g.aiAnalysis}</p>
                        </div>
                      )}

                      {/* 항목별 점수 입력 */}
                      <div>
                        <p className="mb-3 text-sm font-medium text-gray-700">항목별 점수 (각 25점 만점)</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {[
                            { label: '문법', field: 'grammarScore' as const, val: g.grammarScore },
                            { label: '구성', field: 'structureScore' as const, val: g.structureScore },
                            { label: '어휘', field: 'vocabularyScore' as const, val: g.vocabularyScore },
                            { label: '표현력', field: 'expressionScore' as const, val: g.expressionScore },
                          ].map((item) => (
                            <div key={item.field} className="space-y-1">
                              <label className="text-xs font-medium text-gray-500">{item.label}</label>
                              <input
                                type="number"
                                min={0}
                                max={25}
                                value={item.val}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateGrade(q.responseId, item.field, Math.min(25, Math.max(0, Number(e.target.value))))
                                }
                                className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium focus:border-[#7854F7] focus:outline-none focus:ring-1 focus:ring-[#7854F7]"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2">
                          <span className="text-sm font-medium text-gray-700">총점</span>
                          <span
                            className={`text-xl font-bold ${total >= 60 ? 'text-green-600' : total >= 40 ? 'text-amber-600' : 'text-red-500'}`}
                          >
                            {total} / 100
                          </span>
                        </div>
                      </div>

                      {/* 코멘트 */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">교사 코멘트</label>
                        <textarea
                          value={g.teacherComment}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            updateGrade(q.responseId, 'teacherComment', e.target.value)
                          }
                          placeholder="학생에게 전달할 피드백을 입력해 주세요."
                          rows={3}
                          className="min-h-[44px] w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1865F2] focus:outline-none focus:ring-1 focus:ring-[#1865F2]"
                        />
                      </div>

                      {idx < session.writingQuestions.length - 1 && (
                        <hr className="border-gray-100" />
                      )}
                    </div>
                  )
                })}

                {/* 에러 */}
                {errors[session.sessionId] && (
                  <p className="text-sm text-red-600">{errors[session.sessionId]}</p>
                )}

                {/* 채점 완료 버튼 */}
                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <Button
                    onClick={() => handleSubmit(session)}
                    disabled={submitting}
                    className="bg-[#1865F2] hover:bg-[#1558d6] min-h-[44px] px-8"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      '채점 완료'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* 채점 완료 상태 */}
            {isExpanded && isSubmitted && (
              <div className="border-t border-gray-100 p-6 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-green-500 mb-2" />
                <p className="font-medium text-gray-900">채점이 완료되었습니다</p>
                <p className="text-sm text-gray-500 mt-1">학생에게 결과 알림이 전송되었습니다.</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
