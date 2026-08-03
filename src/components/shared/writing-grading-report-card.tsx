'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import type { WritingError, WritingGradingReport } from '@/lib/ai/writing-grading'
import {
  getRubricItemGradeLabel,
  getWritingGradeBand,
  rubricItemContribution,
  sumRubricPoints,
} from '@/lib/ai/writing-grading'

const CATEGORY_LABELS: Record<keyof WritingGradingReport['categoryScores'], string> = {
  grammar: '문법',
  spelling: '철자',
  vocabulary: '어휘',
  sentenceStructure: '문장 구조',
  coherence: '응집성',
  taskAchievement: '과제 수행도',
}

const SEVERITY_STYLE: Record<WritingError['severity'], string> = {
  minor: 'border-blue-200 bg-blue-50 text-blue-700',
  moderate: 'border-[#FFB100]/30 bg-[#FFB100]/10 text-[#8a6200]',
  major: 'border-[#D92916]/30 bg-[#D92916]/10 text-[#D92916]',
}

const SEVERITY_LABELS: Record<WritingError['severity'], string> = {
  minor: '경미',
  moderate: '보통',
  major: '중요',
}

const ITEM_GRADE_STYLE: Record<string, string> = {
  우수: 'bg-[#1FAF54]/10 text-[#1FAF54]',
  양호: 'bg-[#1865F2]/10 text-[#1865F2]',
  보통: 'bg-[#FFB100]/15 text-[#8a6200]',
  미흡: 'bg-[#D92916]/10 text-[#D92916]',
}

const TASK_FORMAT_LABELS: Record<string, string> = {
  sentence_practice: '문장 쓰기 연습',
  academic_essay: '논술형 에세이',
}

export function WritingGradingReportCard({
  report,
  showTeacherNote = false,
}: {
  report: WritingGradingReport
  showTeacherNote?: boolean
}) {
  const [showImproved, setShowImproved] = useState(false)

  const rubricItems = report.rubricItems ?? []
  const hasRubric = rubricItems.length > 0
  const totalPoints = hasRubric ? sumRubricPoints(rubricItems) : report.overallScore
  const totalMax = 100
  const band = getWritingGradeBand(totalPoints)
  const essay = report.essayAnalysis
  const taskFormatLabel = report.detectedTaskFormat
    ? TASK_FORMAT_LABELS[report.detectedTaskFormat]
    : null

  return (
    <div className="rounded-lg border border-purple-100 bg-purple-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[#7854F7]" />
          <p className="text-xs font-medium text-[#7854F7]">
            AI 쓰기 채점 리포트 ({report.cefrEstimate} · {report.wordCount}단어
            {taskFormatLabel ? ` · ${taskFormatLabel}` : ''})
          </p>
        </div>
        <span className="text-sm font-bold text-[#7854F7]">{report.overallScore}점</span>
      </div>

      {/* 성적 (등급 + 총점) */}
      {hasRubric && (
        <div className="flex items-center gap-3 rounded-lg bg-white/70 p-3">
          <div
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl"
            style={{ backgroundColor: band.color + '18' }}
          >
            <span className="text-xl font-black leading-none" style={{ color: band.color }}>
              {band.grade}
            </span>
            <span className="mt-0.5 text-[10px] font-medium" style={{ color: band.color }}>
              {band.label}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">종합 성적</p>
            <p className="text-lg font-bold text-gray-900">
              {totalPoints}
              <span className="text-sm font-medium text-gray-400"> / {totalMax}점</span>
            </p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((totalPoints / totalMax) * 100))}%`,
                  backgroundColor: band.color,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 평가항목별 배점/점수/평가 */}
      {hasRubric && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-800">평가항목별 채점</p>
          {rubricItems.map((item) => {
            const gradeLabel = getRubricItemGradeLabel(item.score)
            const contribution = rubricItemContribution(item)
            return (
              <div key={item.key} className="rounded-lg border border-gray-200 bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ITEM_GRADE_STYLE[gradeLabel] ?? ''}`}
                    >
                      {gradeLabel}
                    </span>
                    <span className="text-[11px] text-gray-400">가중치 {item.weight}%</span>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-gray-900">
                    {item.score}
                    <span className="text-xs font-medium text-gray-400"> / 100점</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-[#7854F7]"
                    style={{ width: `${Math.min(100, Math.round(item.score))}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">총점 반영 {contribution.toFixed(1)}점</p>
                {item.comment && (
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.comment}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 종합 총평 */}
      {report.overallEvaluation && (
        <div className="rounded-lg border border-[#7854F7]/20 bg-white/70 p-3">
          <p className="mb-1.5 text-xs font-semibold text-[#7854F7]">종합 총평</p>
          <p className="text-sm leading-relaxed text-gray-700">
            {report.overallEvaluation.summaryKo}
          </p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            <div className="rounded-lg bg-[#1FAF54]/10 px-2.5 py-2">
              <p className="text-[11px] font-semibold text-[#1FAF54]">강점 항목</p>
              <p className="text-xs text-gray-700">{report.overallEvaluation.strongestArea}</p>
            </div>
            <div className="rounded-lg bg-[#D92916]/10 px-2.5 py-2">
              <p className="text-[11px] font-semibold text-[#D92916]">보완 항목</p>
              <p className="text-xs text-gray-700">{report.overallEvaluation.weakestArea}</p>
            </div>
            <div className="rounded-lg bg-[#FFB100]/15 px-2.5 py-2">
              <p className="text-[11px] font-semibold text-[#8a6200]">우선 실천</p>
              <p className="text-xs text-gray-700">{report.overallEvaluation.priorityAction}</p>
            </div>
          </div>
        </div>
      )}

      {/* 영역별 점수 */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(Object.keys(CATEGORY_LABELS) as (keyof WritingGradingReport['categoryScores'])[]).map((key) => (
          <div key={key} className="rounded-lg bg-white/70 py-2 text-center">
            <p className="text-[11px] text-gray-500">{CATEGORY_LABELS[key]}</p>
            <p className="text-sm font-bold text-[#7854F7]">{report.categoryScores[key]}</p>
          </div>
        ))}
      </div>

      {/* 잘한 점 */}
      {report.strengths.length > 0 && (
        <div className="rounded-lg bg-white/70 p-3">
          <p className="mb-1 text-xs font-semibold text-[#1FAF54]">잘한 점</p>
          <ul className="space-y-0.5 text-sm text-gray-700">
            {report.strengths.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 논술형 심화 분석 */}
      {essay && <EssayAnalysisSection analysis={essay} />}

      {/* 오류 목록 */}
      {report.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-800">오류 상세 ({report.errors.length}건)</p>
          {report.errors.map((err, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white/70 p-3 text-sm">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${SEVERITY_STYLE[err.severity]}`}>
                  {SEVERITY_LABELS[err.severity]}
                </span>
                <span className="text-[11px] font-medium text-gray-500">{err.subType}</span>
                {err.occurrenceCount > 1 && (
                  <span className="text-[11px] text-gray-400">동일 유형 오류 {err.occurrenceCount}회 반복</span>
                )}
              </div>
              <p className="text-[#D92916] line-through">{err.original}</p>
              <p className="text-[#1FAF54]">{err.corrected}</p>
              <p className="mt-1 text-gray-600">{err.explanationKo}</p>
              {err.whyItsWrong && (
                <p className="mt-1 text-gray-600">
                  <span className="font-medium text-gray-800">왜 틀렸나요? </span>
                  {err.whyItsWrong}
                </p>
              )}
              {err.howToRemember && (
                <p className="mt-1 text-gray-600">
                  <span className="font-medium text-gray-800">암기 팁 </span>
                  {err.howToRemember}
                </p>
              )}
              {err.detailedExplanationKo && (
                <p className="mt-1 leading-relaxed text-gray-600">{err.detailedExplanationKo}</p>
              )}
              {err.similarCorrectExamples && err.similarCorrectExamples.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                  {err.similarCorrectExamples.map((ex, j) => (
                    <li key={j}>· {ex}</li>
                  ))}
                </ul>
              )}
              {err.otherOccurrences && err.otherOccurrences.length > 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  반복 위치: {err.otherOccurrences.join(' / ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 철자/문법 오류 요약 */}
      {(report.spellingErrorSummary.length > 0 || report.grammarErrorSummary.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {report.spellingErrorSummary.length > 0 && (
            <div className="rounded-lg bg-white/70 p-3">
              <p className="mb-1 text-xs font-semibold text-gray-800">철자 오류 요약</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {report.spellingErrorSummary.map((s, i) => (
                  <li key={i}>
                    <span className="text-[#D92916] line-through">{s.misspelled}</span> → {s.correct} ({s.occurrenceCount}회)
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.grammarErrorSummary.length > 0 && (
            <div className="rounded-lg bg-white/70 p-3">
              <p className="mb-1 text-xs font-semibold text-gray-800">문법 오류 요약</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {report.grammarErrorSummary.map((g, i) => (
                  <li key={i}>
                    {g.category} {g.count}건{g.examples.length > 0 ? ` — ${g.examples.join(', ')}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 수정본 */}
      {report.improvedVersion && (
        <div className="rounded-lg bg-white/70 p-3">
          <button
            type="button"
            onClick={() => setShowImproved((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold text-gray-800"
          >
            수정 버전 보기
            {showImproved ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showImproved && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {report.improvedVersion}
            </p>
          )}
        </div>
      )}

      {showTeacherNote && report.teacherNote && (
        <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
          <p className="mb-1 text-xs font-semibold text-gray-800">교사 참고 메모</p>
          <p className="text-sm text-gray-700">{report.teacherNote}</p>
        </div>
      )}

      {report.nextStepRecommendation && (
        <div className="rounded-lg border border-[#FFB100]/30 bg-[#FFB100]/10 p-3">
          <p className="mb-1 text-xs font-semibold text-[#8a6200]">다음 학습 추천</p>
          <p className="text-sm text-[#8a6200]">{report.nextStepRecommendation}</p>
        </div>
      )}
    </div>
  )
}

function PassFailIcon({ passed }: { passed: boolean }) {
  return passed ? (
    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1FAF54]" />
  ) : (
    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D92916]" />
  )
}

function EssayAnalysisSection({
  analysis,
}: {
  analysis: NonNullable<WritingGradingReport['essayAnalysis']>
}) {
  const [open, setOpen] = useState(false)
  const { questionAnalysis, taskCoverage, structureMap, peelAnalysis, sentenceVariety, cohesiveDevices, revisionChecklist, improvedParagraphSample } = analysis

  const varietyRows: { label: string; count: number }[] = [
    { label: '단문', count: sentenceVariety.simple },
    { label: '중문', count: sentenceVariety.compound },
    { label: '복문', count: sentenceVariety.complex },
    { label: '관계절', count: sentenceVariety.relativeClause },
    { label: '분사구문', count: sentenceVariety.participial },
  ]

  return (
    <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold text-gray-800"
      >
        논술형 심화 분석 (구성·PEEL·연결어)
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* 질문 분석 + 요구사항 충족 */}
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs font-semibold text-gray-800">질문 요구사항 충족</p>
            <p className="mb-1.5 text-xs text-gray-500">주제: {questionAnalysis.topic}</p>
            <ul className="space-y-1 text-sm text-gray-700">
              {taskCoverage.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <PassFailIcon passed={c.covered} />
                  <span>
                    {c.requirement}
                    {c.note ? <span className="text-gray-500"> — {c.note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 문단 구성 */}
          {structureMap.length > 0 && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1.5 text-xs font-semibold text-gray-800">문단 구성</p>
              <ul className="space-y-1.5 text-sm text-gray-700">
                {structureMap.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium text-gray-800">{p.role}</span>
                    {!p.onTopic && (
                      <span className="ml-1 rounded-full bg-[#D92916]/10 px-2 py-0.5 text-[11px] text-[#D92916]">
                        주제 이탈
                      </span>
                    )}
                    <span className="block text-xs text-gray-600">{p.mainIdea}</span>
                    {p.note && <span className="block text-xs text-gray-500">{p.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* PEEL */}
          {peelAnalysis.length > 0 && (
            <div className="space-y-2">
              {peelAnalysis.map((p, i) => (
                <div key={i} className="rounded-lg bg-gray-50 p-3">
                  <p className="mb-1.5 text-xs font-semibold text-gray-800">{p.paragraph} — PEEL 분석</p>
                  <ul className="space-y-1 text-xs text-gray-700">
                    <li className="flex items-start gap-1.5">
                      <PassFailIcon passed={p.point.present} />
                      <span>Point: {p.point.quote || '없음'}</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <PassFailIcon passed={p.evidence.present} />
                      <span>
                        Evidence ({p.evidence.quality === 'specific' ? '구체적' : '모호함'}): {p.evidence.quote || '없음'}
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <PassFailIcon passed={p.explanation.present} />
                      <span>Explanation: {p.explanation.quote || '없음'}</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <PassFailIcon passed={p.link.present} />
                      <span>Link: {p.link.quote || '없음'}</span>
                    </li>
                  </ul>
                  {p.note && <p className="mt-1.5 text-xs text-gray-500">{p.note}</p>}
                </div>
              ))}
            </div>
          )}

          {/* 문장 구조 + 연결어 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1.5 text-xs font-semibold text-gray-800">문장 구조 분포</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {varietyRows.map((r) => (
                  <li key={r.label}>
                    {r.label} {r.count}개
                  </li>
                ))}
              </ul>
              {sentenceVariety.note && (
                <p className="mt-1.5 text-xs text-gray-500">{sentenceVariety.note}</p>
              )}
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1.5 text-xs font-semibold text-gray-800">연결어 사용</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {cohesiveDevices.used.length > 0 && <li>사용: {cohesiveDevices.used.join(', ')}</li>}
                {cohesiveDevices.overused.length > 0 && (
                  <li className="text-[#8a6200]">과다 반복: {cohesiveDevices.overused.join(', ')}</li>
                )}
                {cohesiveDevices.missingCategories.length > 0 && (
                  <li className="text-[#D92916]">미사용: {cohesiveDevices.missingCategories.join(', ')}</li>
                )}
              </ul>
              {cohesiveDevices.note && (
                <p className="mt-1.5 text-xs text-gray-500">{cohesiveDevices.note}</p>
              )}
            </div>
          </div>

          {/* 수정 체크리스트 */}
          {revisionChecklist.length > 0 && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1.5 text-xs font-semibold text-gray-800">수정 체크리스트</p>
              <ul className="space-y-1 text-xs text-gray-700">
                {revisionChecklist.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <PassFailIcon passed={c.passed} />
                    <span>
                      {c.item}
                      {c.note ? <span className="text-gray-500"> — {c.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 문단 개선 예시 */}
          {improvedParagraphSample?.after && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1.5 text-xs font-semibold text-gray-800">
                문단 보완 예시 ({improvedParagraphSample.targetParagraph})
              </p>
              <p className="text-xs text-gray-500">Before</p>
              <p className="mb-2 whitespace-pre-wrap text-sm text-gray-600">
                {improvedParagraphSample.before}
              </p>
              <p className="text-xs text-[#1FAF54]">After</p>
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {improvedParagraphSample.after}
              </p>
              {improvedParagraphSample.whatChangedKo && (
                <p className="mt-1.5 text-xs text-gray-500">{improvedParagraphSample.whatChangedKo}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
