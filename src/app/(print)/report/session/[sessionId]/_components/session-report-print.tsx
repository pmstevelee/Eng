'use client'

import { useEffect, useState, useRef } from 'react'
import { Printer, Sparkles, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { TestSessionAnalysis } from '@/app/api/ai/analyze-test-session/route'
import type { WritingCategoryScores } from '@/lib/ai/writing-grading'

const WRITING_CATEGORY_FIELDS: { key: keyof WritingCategoryScores; label: string }[] = [
  { key: 'grammar', label: '문법' },
  { key: 'spelling', label: '철자' },
  { key: 'vocabulary', label: '어휘' },
  { key: 'sentenceStructure', label: '문장 구조' },
  { key: 'coherence', label: '응집성' },
  { key: 'taskAchievement', label: '과제 수행도' },
]

type AcademyInfo = {
  name: string
  businessName: string | null
  address: string | null
  phone: string | null
} | null

type QuestionResult = {
  index: number
  id: string
  domain: string
  questionText: string
  type: string
  answer: string | null
  isCorrect: boolean | null
  correctAnswer: string | null
  explanation: string | null
  writingData: {
    teacherScore?: number
    teacherComment?: string
    categoryScores?: WritingCategoryScores
  } | null
}

type Props = {
  sessionId: string
  academy: AcademyInfo
  student: { name: string; currentLevel: number; className: string | null }
  test: { title: string; type: string }
  scores: {
    total: number | null
    grammar: number | null
    vocabulary: number | null
    reading: number | null
    writing: number | null
    listening: number | null
    prevTotal: number | null
  }
  completedAt: string | null
  status: string
  questionResults: QuestionResult[]
  savedAnalysis: (TestSessionAnalysis & { metadata: Record<string, string> }) | null
  canViewerDownload: boolean
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  WRITING: '쓰기',
  LISTENING: '듣기',
}

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
  LISTENING: '#E91E8A',
}

const TEST_TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습 테스트',
}

export function SessionReportPrint({
  sessionId,
  academy,
  student,
  test,
  scores,
  completedAt,
  status,
  questionResults,
  savedAnalysis,
  canViewerDownload,
}: Props) {
  const [analysis, setAnalysis] = useState<TestSessionAnalysis | null>(
    savedAnalysis ?? null,
  )
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const hasFetched = useRef(false)

  useEffect(() => {
    if (savedAnalysis || hasFetched.current) return
    hasFetched.current = true
    setGenerating(true)
    fetch('/api/ai/analyze-test-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setAnalysis(json.data as TestSessionAnalysis)
        } else {
          setAiError(json.error ?? 'AI 분석 실패')
        }
      })
      .catch(() => setAiError('AI 분석 중 네트워크 오류가 발생했습니다.'))
      .finally(() => setGenerating(false))
  }, [sessionId, savedAnalysis])

  const domainEntries = [
    { key: 'grammar', label: '문법', score: scores.grammar, domain: 'GRAMMAR' },
    { key: 'vocabulary', label: '어휘', score: scores.vocabulary, domain: 'VOCABULARY' },
    { key: 'reading', label: '독해', score: scores.reading, domain: 'READING' },
    { key: 'writing', label: '쓰기', score: scores.writing, domain: 'WRITING' },
    { key: 'listening', label: '듣기', score: scores.listening, domain: 'LISTENING' },
  ].filter((d) => d.score !== null)

  const totalDiff =
    scores.total !== null && scores.prevTotal !== null
      ? scores.total - scores.prevTotal
      : null

  const correctCount = questionResults.filter((q) => q.isCorrect === true).length
  const gradedCount = questionResults.filter((q) => q.isCorrect !== null).length
  const correctRate = gradedCount > 0 ? Math.round((correctCount / gradedCount) * 100) : null

  return (
    <div className="bg-white min-h-screen">
      {/* 인쇄 시 숨길 툴바 */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">테스트 결과 리포트</span>
          {(generating) && (
            <span className="flex items-center gap-1 text-xs text-[#7854F7]">
              <Loader2 className="h-3 w-3 animate-spin" />
              AI 분석 생성 중...
            </span>
          )}
          {analysis && !generating && (
            <span className="flex items-center gap-1 rounded-full bg-[#7854F7]/10 px-2 py-0.5 text-xs font-medium text-[#7854F7]">
              <Sparkles className="h-3 w-3" />
              AI 분석 완료
            </span>
          )}
        </div>
        {canViewerDownload && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-[#1865F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1558d6]"
          >
            <Printer className="h-4 w-4" />
            PDF 저장 / 인쇄
          </button>
        )}
      </div>

      {/* 리포트 본문 */}
      <div className="mx-auto max-w-3xl px-8 py-10 print:px-6 print:py-8">
        {/* 헤더: 학원 + 타이틀 */}
        <div className="mb-8 border-b-2 border-[#0C2340] pb-6">
          <div className="flex items-start justify-between">
            <div>
              {academy && (
                <p className="text-sm font-semibold text-[#0C2340]">
                  {academy.businessName ?? academy.name}
                </p>
              )}
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                테스트 결과 분석 리포트
              </h1>
            </div>
            <div className="text-right text-xs text-gray-400">
              {completedAt && (
                <p>제출: {new Date(completedAt).toLocaleString('ko-KR')}</p>
              )}
              <p>출력: {new Date().toLocaleDateString('ko-KR')}</p>
            </div>
          </div>

          {/* 학생 + 테스트 정보 */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-400">학생</span>
              <span className="ml-2 font-semibold text-gray-800">{student.name}</span>
            </div>
            {student.className && (
              <div>
                <span className="text-gray-400">반</span>
                <span className="ml-2 font-semibold text-gray-800">{student.className}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">레벨</span>
              <span className="ml-2 font-semibold text-gray-800">Level {student.currentLevel}</span>
            </div>
            <div>
              <span className="text-gray-400">테스트</span>
              <span className="ml-2 font-semibold text-gray-800">{test.title}</span>
              <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {TEST_TYPE_LABEL[test.type] ?? test.type}
              </span>
            </div>
          </div>
        </div>

        {/* 종합 점수 */}
        <section className="mb-8">
          <h2 className="mb-4 text-base font-bold text-gray-900">종합 점수</h2>
          <div className="flex flex-wrap items-center gap-6">
            {/* 총점 */}
            <div className="flex items-center gap-3">
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-[#1865F2]">
                <span className="text-3xl font-bold text-[#1865F2]">{scores.total ?? '—'}</span>
                <span className="text-xs text-gray-400">/ 100</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">종합 점수</p>
                {totalDiff !== null && (
                  <p
                    className={`text-sm font-bold ${totalDiff > 0 ? 'text-[#1FAF54]' : totalDiff < 0 ? 'text-[#D92916]' : 'text-gray-400'}`}
                  >
                    {totalDiff > 0 ? `▲ +${totalDiff}` : totalDiff < 0 ? `▼ ${totalDiff}` : '±0'}
                    <span className="ml-1 text-xs font-normal text-gray-400">이전 대비</span>
                  </p>
                )}
                {correctRate !== null && (
                  <p className="text-xs text-gray-400">
                    정답률 {correctRate}% ({correctCount}/{gradedCount})
                  </p>
                )}
              </div>
            </div>

            {/* 영역별 점수 바 */}
            <div className="flex-1 min-w-[200px] space-y-2">
              {domainEntries.map(({ domain, label, score }) => (
                <div key={domain} className="flex items-center gap-2">
                  <span className="w-8 text-xs font-medium text-gray-500">{label}</span>
                  <div className="h-5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${score ?? 0}%`,
                        backgroundColor: DOMAIN_COLOR[domain] ?? '#1865F2',
                      }}
                    />
                  </div>
                  <span
                    className="w-8 text-right text-xs font-bold"
                    style={{ color: DOMAIN_COLOR[domain] ?? '#1865F2' }}
                  >
                    {score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI 분석 리포트 */}
        <section className="mb-8 rounded-xl border border-[#7854F7]/20 bg-[#7854F7]/5 p-6 print:border-[#7854F7]/30">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#7854F7]" />
            <h2 className="text-base font-bold text-[#7854F7]">AI 상세 분석</h2>
          </div>

          {generating && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#7854F7]" />
              AI가 결과를 분석하고 있습니다...
            </div>
          )}

          {aiError && !generating && (
            <p className="text-sm text-[#D92916]">{aiError}</p>
          )}

          {analysis && !generating && (
            <div className="space-y-5">
              {/* 종합 평가 */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#7854F7]">
                  종합 평가
                </p>
                <p className="text-sm leading-relaxed text-gray-700">{analysis.summary}</p>
              </div>

              {/* 영역별 분석 */}
              {Object.keys(analysis.domainAnalysis).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7854F7]">
                    영역별 분석
                  </p>
                  <div className="space-y-2">
                    {(
                      [
                        ['grammar', 'GRAMMAR'],
                        ['vocabulary', 'VOCABULARY'],
                        ['reading', 'READING'],
                        ['writing', 'WRITING'],
                        ['listening', 'LISTENING'],
                      ] as Array<[keyof TestSessionAnalysis['domainAnalysis'], string]>
                    )
                      .filter(([key]) => analysis.domainAnalysis[key])
                      .map(([key, domain]) => (
                        <div key={key} className="flex gap-2 text-sm">
                          <span
                            className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                            style={{ backgroundColor: DOMAIN_COLOR[domain] }}
                          >
                            {DOMAIN_LABEL[domain]}
                          </span>
                          <p className="leading-relaxed text-gray-700">
                            {analysis.domainAnalysis[key]}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 강점 / 개선점 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#1FAF54]">
                    강점
                  </p>
                  <ul className="space-y-1">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1FAF54]" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#D92916]">
                    개선 필요
                  </p>
                  <ul className="space-y-1">
                    {analysis.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D92916]" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 오답 패턴 */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#7854F7]">
                  오답 패턴 분석
                </p>
                <p className="text-sm leading-relaxed text-gray-700">{analysis.wrongPatterns}</p>
              </div>

              {/* 학습 권고사항 */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1865F2]">
                  학습 권고사항
                </p>
                <ol className="space-y-1.5">
                  {analysis.studyRecommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1865F2] text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      {r}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>

        {/* 문제별 결과 */}
        <section>
          <h2 className="mb-4 text-base font-bold text-gray-900">문제별 결과</h2>
          <div className="space-y-3">
            {questionResults.map((q) => {
              const isEssay = q.type === 'essay'
              const isWritingGraded = q.writingData?.teacherScore !== undefined

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-gray-100 p-4 print:break-inside-avoid"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">Q{q.index}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: DOMAIN_COLOR[q.domain] ?? '#1865F2' }}
                      >
                        {DOMAIN_LABEL[q.domain] ?? q.domain}
                      </span>
                    </div>
                    {!isEssay && (
                      q.isCorrect === true ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-[#1FAF54]">
                          <CheckCircle2 className="h-3.5 w-3.5" />정답
                        </span>
                      ) : q.isCorrect === false ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-[#D92916]">
                          <XCircle className="h-3.5 w-3.5" />오답
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">미응답</span>
                      )
                    )}
                    {isEssay && (
                      isWritingGraded
                        ? <span className="text-xs font-bold text-[#7854F7]">{q.writingData?.teacherScore}점</span>
                        : <span className="text-xs text-[#FFB100]">채점 대기</span>
                    )}
                  </div>

                  <p className="mb-2 text-sm font-medium text-gray-800">{q.questionText}</p>

                  {!isEssay && (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-gray-400">내 답:</span>
                      <span
                        className={q.isCorrect === false ? 'font-medium text-[#D92916] line-through' : 'font-medium text-gray-700'}
                      >
                        {q.answer ?? '(미응답)'}
                      </span>
                      {q.isCorrect === false && q.correctAnswer && (
                        <>
                          <span className="text-gray-300">→</span>
                          <span className="font-medium text-[#1FAF54]">{q.correctAnswer}</span>
                        </>
                      )}
                    </div>
                  )}

                  {isEssay && q.answer && (
                    <div className="mt-1 rounded-lg bg-gray-50 p-2.5">
                      <p className="text-xs text-gray-400 mb-1">작성 답안</p>
                      <p className="text-sm leading-relaxed text-gray-700 line-clamp-3">{q.answer}</p>
                    </div>
                  )}

                  {!isEssay && q.isCorrect === false && q.explanation && (
                    <div className="mt-2 rounded-lg border border-[#1865F2]/20 bg-[#1865F2]/5 p-2.5">
                      <p className="text-xs font-semibold text-[#1865F2] mb-0.5">해설</p>
                      <p className="text-xs text-[#1865F2]/80">{q.explanation}</p>
                    </div>
                  )}

                  {/* 서술형 채점 결과 */}
                  {isEssay && isWritingGraded && (
                    <div className="mt-2 rounded-lg border border-[#7854F7]/20 bg-[#7854F7]/5 p-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {WRITING_CATEGORY_FIELDS.map((item) => (
                          <div key={item.key} className="rounded bg-white/70 py-1">
                            <p className="text-gray-400">{item.label}</p>
                            <p className="font-bold text-[#7854F7]">
                              {q.writingData?.categoryScores?.[item.key] ?? '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                      {q.writingData?.teacherComment && (
                        <p className="mt-2 text-xs text-gray-600">{q.writingData.teacherComment}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* 푸터 */}
        <div className="mt-10 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
          {academy && <span>{academy.businessName ?? academy.name} · </span>}
          EduLevel LMS · AI 분석 리포트
        </div>
      </div>

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  )
}
